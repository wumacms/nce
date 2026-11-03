/**
 * 轻量 toast 提示（全局单例）
 * @module composables/useToast
 */

import { reactive } from 'vue';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

const HIDE_DELAY = 300; // 与 CSS 隐藏过渡时长一致，用于过渡结束后清理

export const toastState = reactive({
  visible: false,
  message: '',
  type: 'info' as ToastType,
});

let timer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
  return {
    show(message: string, options: { type?: ToastType; duration?: number } = {}): void {
      const type: ToastType = (['info', 'success', 'warning', 'error'] as const).includes(
        options.type as ToastType,
      )
        ? (options.type as ToastType)
        : 'info';
      const duration = options.duration ?? 2000;

      toastState.message = message;
      toastState.type = type;
      toastState.visible = true;

      if (timer) clearTimeout(timer);
      if (hideTimer) clearTimeout(hideTimer);
      timer = setTimeout(() => {
        toastState.visible = false;
        hideTimer = setTimeout(() => {
          if (!toastState.visible) toastState.message = '';
        }, HIDE_DELAY);
      }, duration);
    },
  };
}
