<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useReading } from '../stores/reading';

const reading = useReading();
const { state, paused, currentTime, duration, progressPercent, audioDisabled } = reading;

const prevDisabled = computed(() => state.currentUnitIndex <= 0);
const nextDisabled = computed(() => state.currentUnitIndex >= state.units.length - 1);
const rateText = computed(() => `${state.playbackRate}x`);
const speedActive = computed(() => state.playbackRate !== 1);

function onUnitSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value !== '') reading.selectUnit(Number(value));
}

onMounted(() => {
  reading.bindAudio();
});
</script>

<template>
  <div class="control-panel">
    <div class="navigation-buttons">
      <button
        id="prevUnitBtn"
        class="nav-btn"
        type="button"
        aria-label="上一课"
        :disabled="prevDisabled"
        @click="reading.prevUnit()"
      >
        ‹
      </button>
      <div class="unit-select-wrap">
        <select
          id="unitSelect"
          class="unit-select"
          :value="state.currentUnitIndex"
          @change="onUnitSelect"
        >
          <option v-for="(unit, i) in state.units" :key="i" :value="i">{{ unit.title }}</option>
        </select>
      </div>
      <button
        id="nextUnitBtn"
        class="nav-btn"
        type="button"
        aria-label="下一课"
        :disabled="nextDisabled"
        @click="reading.nextUnit()"
      >
        ›
      </button>
    </div>

    <div class="audio-player">
      <button
        id="playPauseBtn"
        class="play-btn"
        type="button"
        :class="{ playing: !paused }"
        :disabled="audioDisabled"
        :aria-label="!paused ? '暂停' : '播放'"
        @click="reading.togglePlay()"
      >
        <svg class="play-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg class="pause-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      </button>

      <div class="progress-container">
        <span id="currentTime" class="time-display">{{ reading.formatTime(currentTime) }}</span>
        <div
          id="progressBar"
          :ref="(el) => reading.setProgressRef(el as unknown as HTMLElement | null)"
          class="progress-bar"
          :style="{ '--progress': progressPercent + '%' }"
          role="slider"
          aria-label="播放进度"
          :aria-valuemin="0"
          :aria-valuemax="Math.floor(duration)"
          :aria-valuenow="Math.floor(currentTime)"
        >
          <div class="progress-fill"></div>
          <div class="progress-handle"></div>
        </div>
        <span id="duration" class="time-display">{{ reading.formatTime(duration) }}</span>
      </div>

      <button
        id="speedBtn"
        class="speed-btn"
        type="button"
        :class="{ active: speedActive }"
        @click="reading.cycleSpeed()"
      >
        <span id="speedText">{{ rateText }}</span>
      </button>

      <button
        id="loopToggleBtn"
        class="loop-toggle-btn"
        type="button"
        :class="state.loopMode"
        :aria-pressed="state.loopMode !== 'off'"
        :title="reading.loopLabel()"
        :aria-label="reading.loopLabel()"
        @click="reading.cycleLoopMode()"
      >
        <svg class="loop-icon-off" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <svg class="loop-icon-click" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <svg class="loop-icon-one" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <svg class="loop-icon-list" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <svg class="loop-icon-book" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>

      <button
        id="toggleTranslationBtn"
        class="toggle-translation-btn"
        type="button"
        :aria-pressed="reading.translationPressed()"
        :aria-label="reading.translationLabel()"
        @click="reading.cycleTranslation()"
      >
        {{ reading.translationText() }}
      </button>
    </div>

    <audio :ref="(el) => reading.setAudioRef(el as unknown as HTMLAudioElement | null)" id="audioPlayer"></audio>
  </div>
</template>
