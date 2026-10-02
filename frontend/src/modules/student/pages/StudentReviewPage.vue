<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getMySessions } from '@/services/data-queries'
import type { SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { isValidYouTubeUrl } from '@/shared/utils/youtube'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import YouTubePlayer from '@/app/components/YouTubePlayer.vue'

const sessions = ref<SessionRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const lessons = computed(() => sessions.value.filter((session) => session.status === 'COMPLETED' && isValidYouTubeUrl(session.lesson_youtube_url)))

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { sessions.value = await getMySessions() }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải danh sách bài học.' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <AppPageHeader title="Xem lại bài cũ" eyebrow="Video bài học" description="Xem lại video và nội dung những buổi học đã hoàn thành." />
  <AppState v-if="loading" kind="loading" title="Đang tải bài học" />
  <AppState v-else-if="errorMessage" kind="error" title="Không thể tải bài học" :message="errorMessage" @retry="load" />
  <AppState v-else-if="!lessons.length" kind="empty" title="Chưa có video bài học" message="Video sẽ xuất hiện tại đây sau khi giáo viên thêm link cho buổi học đã hoàn thành." />
  <div v-else class="student-review-list">
    <article v-for="lesson in lessons" :key="lesson.id" class="card student-review-card">
      <div class="card-body">
        <div class="student-review-card__heading">
          <div>
            <span class="app-page-header__eyebrow">{{ lesson.classes?.subjects?.name || 'Bài học' }}<span v-if="lesson.classes?.grades?.name"> · {{ lesson.classes.grades.name }}</span></span>
            <h2>{{ lesson.classes?.name || 'Lớp học' }}</h2>
            <p>{{ formatDateTime(lesson.scheduled_start_at) }}</p>
          </div>
          <span class="badge text-bg-success">Đã hoàn thành</span>
        </div>
        <p v-if="lesson.session_note" class="student-review-card__note">{{ lesson.session_note }}</p>
        <YouTubePlayer :url="lesson.lesson_youtube_url" :title="`Video bài học ${lesson.classes?.name || ''}`" />
        <RouterLink class="btn btn-primary mt-3" :to="{ path: '/student/ai', query: { session_id: lesson.id } }">Hỏi AI về bài này</RouterLink>
      </div>
    </article>
  </div>
</template>

<style scoped>
.student-review-list { display: grid; gap: 1rem; }
.student-review-card { max-width: 58rem; border: 1px solid var(--color-border); border-radius: 1rem; }
.student-review-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.student-review-card__heading h2 { margin: .3rem 0; font-size: 1.15rem; }
.student-review-card__heading p { margin: 0; color: var(--color-text-secondary); font-size: .9rem; }
.student-review-card__note { white-space: pre-wrap; }
@media (max-width: 575.98px) { .student-review-card__heading { flex-direction: column; } }
</style>
