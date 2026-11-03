<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useReading } from '../stores/reading';

const reading = useReading();
const lyrics = computed(() => reading.state.currentLyrics);
const activeIndex = computed(() => reading.state.currentLyricIndex);
const emptyMessage = computed(() => reading.state.emptyMessage);

function activate(index: number, time: number): void {
  reading.activateLyric(index, time);
}

function onKey(event: KeyboardEvent, index: number, time: number): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate(index, time);
  }
}

// 高亮行变化时滚动到可视区域（P3b：刷新恢复进度后也要滚到对应句）
const SCROLL_THRESHOLD = 0.1;
watch(activeIndex, async (index) => {
  if (index < 0) return;
  await nextTick();
  const line = document.querySelector<HTMLElement>(`.lyric-line[data-index="${index}"]`);
  const container = document.querySelector<HTMLElement>('.lyrics-container');
  if (!line || !container) return;
  const containerRect = container.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  const pad = containerRect.height * SCROLL_THRESHOLD;
  if (lineRect.top < containerRect.top + pad || lineRect.bottom > containerRect.bottom - pad) {
    line.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
</script>

<template>
  <div class="lyrics-container">
    <div id="lyricsDisplay" class="lyrics-display">
      <p v-if="!lyrics.length" class="placeholder">{{ emptyMessage || '没有歌词数据' }}</p>
      <template v-else>
        <div
          v-for="(line, i) in lyrics"
          :key="i"
          class="lyric-line"
          :class="{ active: i === activeIndex }"
          :data-index="i"
          :data-time="line.time"
          tabindex="0"
          role="button"
          :aria-label="`播放第 ${i + 1} 句`"
          @click="activate(i, line.time)"
          @keydown="onKey($event, i, line.time)"
        >
          <div class="lyric-text">{{ line.english }}</div>
          <div v-if="line.chinese" class="lyric-translation">{{ line.chinese }}</div>
        </div>
      </template>
    </div>
  </div>
</template>
