<script setup lang="ts">
import { computed } from 'vue'
import { toYouTubeEmbedUrl, toYouTubeWatchUrl } from '@/shared/utils/youtube'

const props = defineProps<{ url?: string | null; title?: string }>()
const embedUrl = computed(() => toYouTubeEmbedUrl(props.url))
const watchUrl = computed(() => toYouTubeWatchUrl(props.url))
</script>

<template>
  <div v-if="watchUrl" class="youtube-player">
    <div v-if="embedUrl" class="youtube-player__frame">
      <iframe :src="embedUrl" :title="title || 'Video bài học trên YouTube'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <a class="youtube-player__fallback" :href="watchUrl" target="_blank" rel="noopener noreferrer">Mở video trên YouTube ↗</a>
  </div>
</template>

<style scoped>
.youtube-player { display: grid; gap: .6rem; }
.youtube-player__frame { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: .8rem; background: #111827; }
.youtube-player__frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.youtube-player__fallback { width: fit-content; font-size: .875rem; }
</style>
