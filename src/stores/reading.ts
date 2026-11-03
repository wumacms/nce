/**
 * 阅读系统协调器（Vue 版）：课本、单元、歌词、播放与偏好
 * 以 reactive 状态 + ref 暴露给组件，逻辑等价迁移自原 ReadingSystem.js，并保留
 * P1~P4 与"方案A 续读/从头"的全部修复。
 * @module stores/reading
 */

import { reactive, ref } from 'vue';
import { CONFIG, createInitialState } from '../config';
import type { Unit } from '../types';
import { clamp, debounce, formatTime, throttle } from '../utils/helpers';
import {
  getStorage,
  setStorage,
  getPlayTime,
  savePlayTime,
  getCurrentUnitIndex,
  saveCurrentUnitIndex,
} from '../utils/storage';
import { LRCParser } from '../utils/lrc';
import { BookService } from '../services/book';
import { PrefetchService } from '../services/prefetch';
import { useToast } from '../composables/useToast';

const LOOP_MODE_LABELS: Record<string, string> = {
  off: '关闭循环',
  click: '单句点读',
  one: '单句循环',
  list: '本课循环',
  book: '本书循环',
};

const TRANSLATION_LABELS: Record<string, string> = {
  show: '显示双语',
  english: '仅显示英文',
  chinese: '仅显示中文',
  blur: '模糊翻译',
};

function createEngine() {
  const state = reactive(createInitialState());
  const toast = useToast();

  // 音频相关的响应式状态（供组件绑定显示）
  const currentTime = ref(0);
  const duration = ref(0);
  const paused = ref(true);
  const audioDisabled = ref(true);
  const progressPercent = ref(0);

  // 模板 ref：由 PlayerControls 绑定
  const audioEl = ref<HTMLAudioElement | null>(null);
  const progressEl = ref<HTMLElement | null>(null);

  const bookService = new BookService();
  const prefetch = new PrefetchService({
    maxLrc: CONFIG.PLAYER.MAX_LRC_CACHE,
    maxAudio: CONFIG.PLAYER.MAX_AUDIO_CACHE,
  });

  let bookAbort: AbortController | null = null;
  let unitAbort: AbortController | null = null;
  let unitLoadId = 0;
  let ready = false;
  let rate = 1;
  let pendingTime = 0;
  let dragging = false;
  let suppressClick = false;

  const persistProgress = debounce(() => saveProgress(), 1500);

  // ---------- 音频底层 ----------
  function getAudio(): HTMLAudioElement | null {
    return audioEl.value;
  }

  function applyRate(value: number): void {
    const audio = getAudio();
    if (!audio) return;
    try {
      audio.playbackRate = value;
    } catch (error) {
      console.warn(`Failed to set playback rate ${value}:`, error);
    }
  }

  function setRate(value: number): void {
    if (!Number.isFinite(value)) return;
    rate = value;
    const audio = getAudio();
    if (audio) {
      audio.defaultPlaybackRate = value;
      applyRate(value);
    }
  }

  function setLoop(enabled: boolean): void {
    const audio = getAudio();
    if (audio) audio.loop = Boolean(enabled);
  }

  function setSrc(url: string, options: { loop?: boolean; playbackRate?: number; startTime?: number } = {}): void {
    const audio = getAudio();
    if (!audio) return;

    const nextRate = options.playbackRate ?? rate;
    rate = nextRate;

    audio.pause();
    // 换源时浏览器会把 playbackRate 重置为 defaultPlaybackRate，需同步默认值
    audio.defaultPlaybackRate = nextRate;
    audio.src = url;
    audio.loop = Boolean(options.loop);
    applyRate(nextRate);
    pendingTime = Number.isFinite(options.startTime) ? (options.startTime as number) : 0;
    setAudioDisabled(true);
    progressPercent.value = 0;
    currentTime.value = 0;
    audio.load();
    // load() 会同步重置倍速，这里补一次
    applyRate(nextRate);
  }

  function play(): void {
    const audio = getAudio();
    if (!audio) return;
    void audio.play().catch((error: unknown) => {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.warn('Audio play failed:', error);
      }
    });
  }

  function pause(): void {
    getAudio()?.pause();
  }

  function toggle(): void {
    if (paused.value) play();
    else pause();
  }

  function seek(time: number): void {
    const audio = getAudio();
    if (!audio || !Number.isFinite(time)) return;
    const dur = duration.value;
    const max = Number.isFinite(dur) && dur > 0 ? dur : time;
    audio.currentTime = clamp(time, 0, max);
    updateProgress(true);
  }

  function reset(): void {
    const audio = getAudio();
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    pendingTime = 0;
    progressPercent.value = 0;
    currentTime.value = 0;
    duration.value = 0;
    setAudioDisabled(true);
    paused.value = true;
  }

  function setAudioDisabled(disabled: boolean): void {
    audioDisabled.value = disabled;
  }

  function updateProgress(force = false): void {
    const audio = getAudio();
    if (!audio || (dragging && !force)) return;
    const dur = duration.value;
    const cur = currentTime.value;
    progressPercent.value = dur > 0 ? (cur / dur) * 100 : 0;
  }

  function applyPendingTime(): void {
    const audio = getAudio();
    if (!audio) return;
    duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;

    if (pendingTime > 0 && duration.value > 0) {
      const target = Math.min(pendingTime, Math.max(0, duration.value - 0.05));
      if (Number.isFinite(target)) {
        audio.currentTime = target;
      }
      pendingTime = 0;
    }
    updateProgress();
  }

  // ---------- 歌词高亮 / 单句循环 ----------
  function lockedSentenceIndex(): number {
    if (state.loopMode !== 'click' && state.loopMode !== 'one') return -1;
    return state.sentenceLoopIndex;
  }

  function setHighlight(index: number): void {
    if (index === state.currentLyricIndex) return;
    state.currentLyricIndex = index;
  }

  function syncHighlight(): void {
    const locked = lockedSentenceIndex();
    const index =
      locked >= 0
        ? locked
        : LRCParser.findLyricIndexByTime(state.currentLyrics, currentTime.value);
    setHighlight(index);
  }

  function handleSentence(cur: number, dur: number): void {
    const locked = lockedSentenceIndex();
    if (locked < 0 || !Number.isFinite(cur)) return;

    const boundaries = LRCParser.getSentenceBoundaries(state.currentLyrics, locked, dur);
    if (!boundaries || !Number.isFinite(boundaries.startTime)) return;

    if (cur < boundaries.endTime) return;

    seek(boundaries.startTime);
    if (state.loopMode === 'click') pause();
    setHighlight(locked);
  }

  function onAudioTick(cur: number, dur: number): void {
    if (!ready) return;
    handleSentence(cur, dur);
    syncHighlight();
    persistProgress();
  }

  function onAudioEnded(): void {
    saveProgress();
    if (!state.units.length) return;

    if (state.loopMode === 'book') {
      const nextIndex = (state.currentUnitIndex + 1) % state.units.length;
      void loadUnitByIndex(nextIndex).then(() => play());
      return;
    }

    // 单句循环（one/click）兜底：最后一句 endTime 等于音频时长，timeupdate 难以在原生
    // ended 之前可靠触发 seek 回起点，故在此补一次，避免末句循环中断停在本课末尾
    if (
      (state.loopMode === 'one' || state.loopMode === 'click') &&
      state.sentenceLoopIndex >= 0
    ) {
      const boundaries = LRCParser.getSentenceBoundaries(
        state.currentLyrics,
        state.sentenceLoopIndex,
        duration.value,
      );
      if (boundaries && Number.isFinite(boundaries.startTime)) {
        seek(boundaries.startTime);
        if (state.loopMode === 'click') pause();
        else play();
        setHighlight(state.sentenceLoopIndex);
      }
    }
  }

  // ---------- 进度记忆 ----------
  function saveProgress(time: number = currentTime.value): void {
    if (!ready) return;
    if (!state.bookKey || state.currentUnitIndex < 0) return;
    if (!Number.isFinite(time) || time < 0) return;
    savePlayTime(state.bookKey, state.currentUnitIndex, time);
  }

  // ---------- 课本 / 单元 ----------
  async function init(): Promise<void> {
    try {
      restorePreferences();
      state.books = await bookService.loadCatalog();
      await applyBookFromHash();
      await loadUnitFromStorage();
      bindGlobalEvents();
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      console.error('Failed to initialize ReadingSystem:', error);
      state.emptyMessage = CONFIG.ERROR_MESSAGES.LOAD_BOOKS;
    }
  }

  function applyBookFromHash(): Promise<void> {
    const keyFromHash = location.hash.slice(1).trim();
    const storedBookKey = getStorage(CONFIG.STORAGE_KEYS.BOOK_SELECTION);
    const initialBookKey = keyFromHash || storedBookKey || CONFIG.DEFAULT_BOOK_KEY;
    return applyBookChange(initialBookKey);
  }

  async function applyBookChange(bookKey: string): Promise<void> {
    bookAbort?.abort();
    unitAbort?.abort();
    unitLoadId += 1;
    bookAbort = new AbortController();
    const { signal } = bookAbort;

    if (!state.books.length) {
      state.books = await bookService.loadCatalog(signal);
    }

    const resolved = bookService.resolve(bookKey, CONFIG.DEFAULT_BOOK_KEY);
    const resolvedPath = resolved?.path || resolved?.bookPath;
    if (!resolvedPath) {
      state.bookPath = '';
      state.bookKey = '';
      state.units = [];
      state.currentLyrics = [];
      state.emptyMessage = CONFIG.ERROR_MESSAGES.NO_DATA;
      // 未命中课本时务必重置播放器，否则上一课音频会继续播放（P1 修复）
      reset();
      return;
    }

    state.bookKey = resolved.key || bookKey;
    state.bookPath = resolvedPath.trim().replace(/\/$/, '');
    setStorage(CONFIG.STORAGE_KEYS.BOOK_SELECTION, state.bookKey);

    persistProgress.cancel();
    saveProgress();
    ready = false;
    reset();
    state.currentUnitIndex = -1;
    state.currentLyrics = [];
    state.emptyMessage = '加载中...';
    prefetch.clear();

    try {
      const { units, coverUrl, bookName, bookLevel } = await bookService.loadBook(resolved, signal);
      state.units = units;
      state.coverUrl = coverUrl;
      state.bookName = bookName;
      state.bookLevel = bookLevel;
      state.emptyMessage = '';
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error;
      console.error(CONFIG.ERROR_MESSAGES.LOAD_CONFIG, error);
      state.units = [];
      state.currentLyrics = [];
      state.emptyMessage = `${CONFIG.ERROR_MESSAGES.LOAD_CONFIG}: ${state.bookPath}/book.json`;
    }
  }

  async function loadUnitFromStorage(): Promise<void> {
    if (!state.units.length) return;
    const unitIndex = getCurrentUnitIndex(state.bookKey);
    const safeIndex = clamp(unitIndex, 0, state.units.length - 1);
    await loadUnitByIndex(safeIndex, { scroll: true, resume: true });
  }

  async function loadUnitByIndex(
    unitIndex: number,
    options: { scroll?: boolean; resume?: boolean } = {},
  ): Promise<void> {
    const unit: Unit | undefined = state.units[unitIndex];
    if (!unit) return;
    // 点同一课且已就绪则跳过（避免从头覆盖续读进度）
    if (unitIndex === state.currentUnitIndex && ready) return;

    unitAbort?.abort();
    unitAbort = new AbortController();
    const { signal } = unitAbort;
    const loadId = ++unitLoadId;

    persistProgress.cancel();
    saveProgress();
    ready = false;
    state.currentUnitIndex = unitIndex;
    state.currentLyricIndex = -1;
    state.sentenceLoopIndex = -1;
    state.currentLyrics = [];
    saveCurrentUnitIndex(state.bookKey, unitIndex);

    reset();
    state.emptyMessage = '加载中...';

    try {
      const lrcText = await prefetch.loadLrc(unit.lrc, signal);
      if (loadId !== unitLoadId) return;
      state.currentLyrics = LRCParser.parse(lrcText, CONFIG.PLAYER.TIME_OFFSET);
      state.emptyMessage = state.currentLyrics.length ? '' : '没有歌词数据';
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError' || loadId !== unitLoadId) return;
      console.error(CONFIG.ERROR_MESSAGES.LOAD_LYRIC, error);
      state.emptyMessage = CONFIG.ERROR_MESSAGES.LOAD_FAILED;
    }

    if (loadId !== unitLoadId) return;

    // resume=true 时从已保存进度续读（用于刷新/初始化恢复）；手动切换课程则从头开始（方案A）
    const resume = options.resume === true;
    const startTime = resume ? getPlayTime(state.bookKey, unitIndex) : 0;
    state.resumeTime = startTime;
    setSrc(unit.audio, {
      loop: state.loopMode === 'list',
      playbackRate: state.playbackRate,
      startTime,
    });
    ready = true;

    prefetch.prefetch(state.units[unitIndex + 1]);
  }

  // ---------- 用户交互 ----------
  function selectBook(bookKey: string): void {
    if (!bookKey || location.hash.slice(1) === bookKey) return;
    location.hash = bookKey;
  }

  function selectUnit(value: number | 'prev' | 'next'): void {
    if (value === 'prev') {
      if (state.currentUnitIndex > 0) void loadUnitByIndex(state.currentUnitIndex - 1);
      return;
    }
    if (value === 'next') {
      if (state.currentUnitIndex < state.units.length - 1) void loadUnitByIndex(state.currentUnitIndex + 1);
      return;
    }
    if (Number.isFinite(value) && value >= 0) void loadUnitByIndex(value);
  }

  function prevUnit(): void {
    selectUnit('prev');
  }

  function nextUnit(): void {
    selectUnit('next');
  }

  function activateLyric(index: number, time: number): void {
    if (state.loopMode === 'one' || state.loopMode === 'click') {
      state.sentenceLoopIndex = index;
    }
    setHighlight(index);
    seek(time);
    play();
    saveProgress(time);
  }

  function cycleSpeed(): void {
    const speeds = CONFIG.AVAILABLE_SPEEDS;
    const currentIndex = speeds.indexOf(state.playbackRate);
    state.playbackRate = speeds[(currentIndex + 1) % speeds.length];
    setRate(state.playbackRate);
    setStorage(CONFIG.STORAGE_KEYS.PLAYBACK_RATE, state.playbackRate);
    toast.show(`播放速度 ${state.playbackRate}x`);
  }

  function cycleLoopMode(): void {
    const modes = CONFIG.LOOP_MODES;
    const nextMode = modes[(modes.indexOf(state.loopMode) + 1) % modes.length] as typeof state.loopMode;
    state.loopMode = nextMode;

    if ((nextMode === 'one' || nextMode === 'click') && state.currentLyricIndex >= 0) {
      state.sentenceLoopIndex = state.currentLyricIndex;
    }
    if (nextMode === 'list' || nextMode === 'off' || nextMode === 'book') {
      state.sentenceLoopIndex = -1;
    }

    setStorage(CONFIG.STORAGE_KEYS.LOOP_MODE, nextMode);
    setLoop(nextMode === 'list');
    syncHighlight();
    toast.show(LOOP_MODE_LABELS[nextMode]);
  }

  function cycleTranslation(): void {
    const modes = CONFIG.TRANSLATION_MODES;
    const currentIndex = modes.indexOf(state.translationMode);
    state.translationMode = modes[(currentIndex + 1) % modes.length] as typeof state.translationMode;
    setStorage(CONFIG.STORAGE_KEYS.TRANSLATION_MODE, state.translationMode);
    applyTranslationMode(state.translationMode);
    toast.show(TRANSLATION_LABELS[state.translationMode]);
  }

  function applyTranslationMode(mode: string): void {
    const body = document.body;
    body.classList.toggle('english-translation', mode === 'english');
    body.classList.toggle('chinese-translation', mode === 'chinese');
    body.classList.toggle('blur-translation', mode === 'blur');
  }

  function restorePreferences(): void {
    const storedLoop = getStorage(CONFIG.STORAGE_KEYS.LOOP_MODE);
    if (CONFIG.LOOP_MODES.includes(storedLoop as never)) {
      state.loopMode = storedLoop as typeof state.loopMode;
    } else if (getStorage('loopPlaybackEnabled') === 'true') {
      state.loopMode = 'list';
    }

    const storedSpeed = parseFloat(getStorage(CONFIG.STORAGE_KEYS.PLAYBACK_RATE) ?? 'NaN');
    if (CONFIG.AVAILABLE_SPEEDS.includes(storedSpeed)) {
      state.playbackRate = storedSpeed;
    }

    const storedTranslation = getStorage(CONFIG.STORAGE_KEYS.TRANSLATION_MODE);
    if (CONFIG.TRANSLATION_MODES.includes(storedTranslation as never)) {
      state.translationMode = storedTranslation as typeof state.translationMode;
    }

    setLoop(state.loopMode === 'list');
    setRate(state.playbackRate);
    applyTranslationMode(state.translationMode);
  }

  function bindGlobalEvents(): void {
    window.addEventListener('hashchange', () => {
      const newKey = location.hash.slice(1).trim() || CONFIG.DEFAULT_BOOK_KEY;
      if (newKey === state.bookKey) return;
      applyBookChange(newKey)
        .then(() => loadUnitFromStorage())
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'AbortError') {
            console.error('Failed to switch book:', error);
          }
        });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveProgress();
    });

    window.addEventListener('pagehide', () => saveProgress());
  }

  // ---------- 音频事件绑定（由 App 在挂载后调用）----------
  function setAudioRef(el: HTMLAudioElement | null): void {
    audioEl.value = el;
  }

  function setProgressRef(el: HTMLElement | null): void {
    progressEl.value = el;
  }

  function bindAudio(): void {
    const audio = audioEl.value;
    const bar = progressEl.value;
    if (!audio) return;

    const tick = throttle(() => {
      currentTime.value = audio.currentTime;
      const dur = audio.duration;
      duration.value = Number.isFinite(dur) ? dur : 0;
      updateProgress();
      onAudioTick(currentTime.value, duration.value);
    }, 1000 / 30);

    audio.addEventListener('timeupdate', tick);

    audio.addEventListener('loadedmetadata', () => {
      applyPendingTime();
      setAudioDisabled(false);
      // 恢复进度后（元数据就绪、currentTime 已定位）高亮并滚动到对应句；从头播放则不额外高亮（P3b 修复）
      if (state.resumeTime > 0.05) {
        syncHighlight();
      }
      state.resumeTime = 0;
      if (!audioDisabled.value) toast.show('音频已加载', { type: 'success' });
    });

    audio.addEventListener('canplay', () => setAudioDisabled(false));
    audio.addEventListener('loadstart', () => setAudioDisabled(true));
    audio.addEventListener('play', () => {
      paused.value = false;
    });
    audio.addEventListener('pause', () => {
      paused.value = true;
      saveProgress(currentTime.value);
    });
    audio.addEventListener('ended', () => {
      onAudioEnded();
    });
    audio.addEventListener('error', () => {
      setAudioDisabled(true);
      toast.show(CONFIG.ERROR_MESSAGES.LOAD_AUDIO, { type: 'error' });
    });

    if (!bar) return;

    let dragged = false;

    const seekByClientX = (clientX: number): void => {
      if (!audio || !duration.value) return;
      const rect = bar.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      seek(percent * duration.value);
    };

    // P3a：拖拽结束后的那次浏览器补发 click 不要重复 seek（仅当真实发生了拖拽移动）
    bar.addEventListener('click', (event: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      seekByClientX(event.clientX);
    });

    bar.addEventListener('pointerdown', (event: PointerEvent) => {
      dragging = true;
      dragged = false;
      suppressClick = false;
      bar.classList.add('dragging');
      bar.setPointerCapture(event.pointerId);
      seekByClientX(event.clientX);
    });

    bar.addEventListener('pointermove', (event: PointerEvent) => {
      if (!dragging) return;
      dragged = true;
      seekByClientX(event.clientX);
    });

    const endDrag = (event: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      suppressClick = dragged; // 只有真实拖动过才抑制随后的 click
      bar.classList.remove('dragging');
      if (event?.pointerId != null) {
        try {
          bar.releasePointerCapture(event.pointerId);
        } catch {
          // already released
        }
      }
      saveProgress(currentTime.value);
    };

    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
  }

  return {
    state,
    currentTime,
    duration,
    paused,
    audioDisabled,
    progressPercent,
    // 模板 ref 绑定入口（由 PlayerControls 在挂载时回调设置）
    setAudioRef,
    setProgressRef,
    // 格式化等只读工具
    formatTime,
    loopLabel: () => LOOP_MODE_LABELS[state.loopMode] || '循环播放',
    translationText: () => {
      const map: Record<string, string> = { show: '双', blur: '糊', english: '英', chinese: '中' };
      return map[state.translationMode] || '双';
    },
    translationPressed: () => {
      const map: Record<string, boolean | 'mixed'> = {
        show: true,
        blur: 'mixed',
        english: false,
        chinese: true,
      };
      return map[state.translationMode] ?? false;
    },
    translationLabel: () => TRANSLATION_LABELS[state.translationMode],
    init,
    selectBook,
    selectUnit,
    prevUnit,
    nextUnit,
    activateLyric,
    cycleSpeed,
    cycleLoopMode,
    cycleTranslation,
    togglePlay: toggle,
    seekTo: seek,
    bindAudio,
  };
}

const engine = createEngine();

export function useReading() {
  return engine;
}
