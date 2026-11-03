/**
 * 全局常量与初始状态
 * @module config
 */

export const CONFIG = {
  DEFAULT_BOOK_KEY: 'NCE1',

  STORAGE_KEYS: {
    BOOK_SELECTION: 'selectedBookKey',
    LOOP_MODE: 'loopMode',
    PLAYBACK_RATE: 'playbackRate',
    TRANSLATION_MODE: 'translationMode',
    THEME: 'theme',
  },

  AVAILABLE_SPEEDS: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as number[],
  TRANSLATION_MODES: ['show', 'english', 'chinese', 'blur'],
  LOOP_MODES: ['off', 'click', 'one', 'list', 'book'],

  PLAYER: {
    MAX_AUDIO_CACHE: 3,
    MAX_LRC_CACHE: 3,
    TIME_OFFSET: 0.3,
  },

  UI: {
    LYRIC_SCROLL_THRESHOLD: 0.1,
    THEME_ANIMATION_DURATION: 300,
    MODAL_ANIMATION_DURATION: 200,
  },

  ERROR_MESSAGES: {
    LOAD_BOOKS: '加载课本数据失败',
    LOAD_CONFIG: '课件配置加载失败',
    LOAD_LYRIC: '加载歌词失败',
    LOAD_AUDIO: '音频加载失败，请检查网络后重试',
    NO_DATA: '未找到可用课本数据',
    LOAD_FAILED: '加载失败',
  },
} as const;

export interface ReadingState {
  books: Array<{ key: string; title: string; path: string }>;
  units: Array<{ id: number; title: string; filename: string; audio: string; lrc: string }>;
  bookPath: string;
  bookKey: string;
  bookName: string;
  bookLevel: string;
  coverUrl: string;
  emptyMessage: string;
  currentLyrics: Array<{ time: number; english: string; chinese: string; fullText: string }>;
  currentLyricIndex: number;
  currentUnitIndex: number;
  loopMode: 'off' | 'click' | 'one' | 'list' | 'book';
  playbackRate: number;
  translationMode: 'show' | 'english' | 'chinese' | 'blur';
  sentenceLoopIndex: number;
  resumeTime: number;
}

export function createInitialState(): ReadingState {
  return {
    books: [],
    units: [],
    bookPath: '',
    bookKey: '',
    bookName: '选择课本',
    bookLevel: '',
    coverUrl: '',
    emptyMessage: '',
    currentLyrics: [],
    currentLyricIndex: -1,
    currentUnitIndex: -1,
    loopMode: 'off',
    playbackRate: 1.0,
    translationMode: 'show',
    sentenceLoopIndex: -1,
    resumeTime: 0,
  };
}
