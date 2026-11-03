<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '../composables/useTheme';

const theme = useTheme();
const isDark = computed(() => theme.theme.value === 'dark');
</script>

<template>
  <button
    id="themeToggle"
    class="theme-toggle"
    type="button"
    :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
  >
    <svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>
