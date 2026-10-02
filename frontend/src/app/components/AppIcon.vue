<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })

const paths: Record<string, string[]> = {
students: ['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M20 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
staff: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
classes: ['M3 5h18v14H3z', 'M3 10h18', 'M8 5v14', 'M13 5v14'],
sessions: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z', 'm9 16 2 2 4-4'],
timesheets: ['M9 12l2 2 4-4', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
schedule: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z'],
results: ['M4 19V5', 'M4 19h16', 'm7 15 3-4 3 2 5-7'],
profile: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10'],
more: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6'],
password: ['M12 15v2', 'M6 10V7a6 6 0 0 1 12 0v3', 'M5 10h14v11H5z'],
search: ['m21 21-4.34-4.34', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z'],
plus: ['M12 5v14', 'M5 12h14'],
edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z'],
archive: ['M3 4h18v4H3z', 'M5 8v12h14V8', 'M10 12h4'],
refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9A7 7 0 0 1 18 6l2 6', 'M6 12l-2 5a7 7 0 0 0 12.4 3'],
close: ['M18 6 6 18', 'm6 6 12 12'],
chevron: ['m9 18 6-6-6-6'],
menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
check: ['m5 12 4 4L19 6'],
alert: ['M12 9v4', 'M12 17h.01', 'm10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z'],
info: ['M12 16v-4', 'M12 8h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
}

const iconPaths = computed(() => paths[props.name] || paths.info)
</script>

<template>
  <svg class="app-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(path, index) in iconPaths" :key="index" :d="path" />
  </svg>
</template>
