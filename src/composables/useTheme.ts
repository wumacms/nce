/**
 * 明暗主题（全局单例）
 * 仍沿用 body.dark-theme 触发组件 CSS 的暗色变量；并同步 address bar 的 theme-color。
 * @module composables/useTheme
 */

import { ref } from 'vue';
import { CONFIG } from '../config';
import { getStorage, setStorage } from '../utils/storage';

const THEME_COLORS = {
  light: '#f7f3ee',
  dark: '#0f1317',
};

const theme = ref<'light' | 'dark'>('light');
let toggleBtn: HTMLElement | null = null;
let animationDuration: number = CONFIG.UI.THEME_ANIMATION_DURATION;
let initialized = false;

function detectTheme(): 'light' | 'dark' {
  const saved = getStorage(CONFIG.STORAGE_KEYS.THEME);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(next: 'light' | 'dark'): void {
  const isDark = next === 'dark';
  document.body.classList.toggle('dark-theme', isDark);
  theme.value = next;
  updateMetaThemeColor(isDark);
}

function updateMetaThemeColor(isDark: boolean): void {
  const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  // 仅选取无 media 的 theme-color（index.html 中已声明一个作默认），避免重复创建；
  // 新建时追加到 head 末尾，绝不要插到 <meta charset> 之前
  let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function playToggleAnimation(): void {
  const btn = toggleBtn;
  if (!btn) return;
  btn.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    btn.style.transform = '';
  }, animationDuration);
}

export function useTheme() {
  return {
    theme,
    init(options: { toggleBtn?: HTMLElement | null; animationDuration?: number } = {}): void {
      if (initialized) return;
      toggleBtn = options.toggleBtn ?? document.getElementById('themeToggle');
      animationDuration = options.animationDuration ?? CONFIG.UI.THEME_ANIMATION_DURATION;

      applyTheme(detectTheme());
      toggleBtn?.addEventListener('click', () => this.toggle());
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (getStorage(CONFIG.STORAGE_KEYS.THEME)) return;
        applyTheme(event.matches ? 'dark' : 'light');
      });
      initialized = true;
    },
    toggle(): void {
      const next = theme.value === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      setStorage(CONFIG.STORAGE_KEYS.THEME, next);
      playToggleAnimation();
    },
    getTheme(): 'light' | 'dark' {
      return theme.value;
    },
  };
}
