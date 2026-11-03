<script setup lang="ts">
import { toastState } from '../composables/useToast';
</script>

<template>
  <div
    class="toast"
    :class="{ show: toastState.visible }"
    :data-type="toastState.type"
    role="status"
    aria-live="polite"
  >
    {{ toastState.message }}
  </div>
</template>
