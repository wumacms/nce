<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useReading } from '../stores/reading';

const reading = useReading();
const units = computed(() => reading.state.units);
const activeIndex = computed(() => reading.state.currentUnitIndex);

function pick(index: number): void {
  reading.selectUnit(index);
}

function onKey(event: KeyboardEvent, index: number): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pick(index);
  }
}

// 单元切换后把当前项滚动到可视区域（与歌词恢复滚动解耦，仅作用于课程列表）
watch(activeIndex, async (index) => {
  if (index < 0) return;
  await nextTick();
  const el = document.querySelector<HTMLElement>(`.unit-item[data-unit-index="${index}"]`);
  el?.scrollIntoView({ block: 'center', inline: 'nearest' });
});
</script>

<template>
  <aside class="unit-list">
    <h2>课程</h2>
    <div id="unitListContainer">
      <div
        v-for="(unit, i) in units"
        :key="i"
        class="unit-item"
        :class="{ active: i === activeIndex }"
        :data-unit-index="i"
        tabindex="0"
        role="button"
        :aria-label="`打开 ${unit.title}`"
        @click="pick(i)"
        @keydown="onKey($event, i)"
      >
        <h3>{{ unit.title }}</h3>
      </div>
    </div>
  </aside>
</template>
