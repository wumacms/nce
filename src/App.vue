<script setup lang="ts">
import { onMounted } from 'vue';
import { useReading } from './stores/reading';
import { useTheme } from './composables/useTheme';
import UnitList from './components/UnitList.vue';
import LyricsPanel from './components/LyricsPanel.vue';
import PlayerControls from './components/PlayerControls.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import Toast from './components/Toast.vue';

const reading = useReading();
const theme = useTheme();
const logoUrl = import.meta.env.BASE_URL + 'favicon.ico';

function onBookChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value) reading.selectBook(value);
}

onMounted(() => {
  theme.init();
  void reading.init();
});
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-content">
        <img class="header-logo" :src="logoUrl" alt="logo" />
        <div class="header-title-group">
          <h1>新概念英语</h1>
          <span class="subtitle">NEW CONCEPT ENGLISH</span>
        </div>
      </div>
      <div class="header-actions">
        <div class="book-select-wrap">
          <span class="select-label">课本</span>
          <select class="book-select" :value="reading.state.bookKey" @change="onBookChange">
            <option v-for="book in reading.state.books" :key="book.key" :value="book.key">
              {{ book.title }}
            </option>
          </select>
        </div>
        <ThemeToggle />
        <a
          class="github-link"
          href="https://github.com/wumacms/nce"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub 仓库"
          title="GitHub 仓库"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
        </a>
      </div>
    </header>

    <div class="app-container">
      <UnitList />
      <div class="player-column">
        <section class="player-section">
          <div class="book-info">
            <div class="book-cover-wrap">
              <img id="bookCover" class="book-cover" :src="reading.state.coverUrl || undefined" alt="封面" />
            </div>
            <div class="book-meta">
              <div id="bookTitle" class="book-name">{{ reading.state.bookName }}</div>
              <div id="bookHint" class="book-hint">{{ reading.state.bookLevel }}</div>
            </div>
          </div>
          <PlayerControls />
          <LyricsPanel />
        </section>
      </div>
    </div>

    <Toast />
  </div>
</template>
