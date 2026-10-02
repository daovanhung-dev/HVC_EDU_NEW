<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { askStudentAI } from '@/services/commands'
import { getMySessions } from '@/services/data-queries'
import type { SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

interface ChatMessage { role: 'user' | 'model'; text: string }
const route = useRoute()
const sessions = ref<SessionRow[]>([])
const loading = ref(false)
const loadError = ref('')
const sessionId = ref('')
const question = ref('')
const messages = ref<ChatMessage[]>([])
const sending = ref(false)
const sendError = ref('')
const questionInput = ref<HTMLTextAreaElement | null>(null)
const availableLessons = computed(() => sessions.value.filter((session) => session.status === 'COMPLETED'))
const selectedLesson = computed(() => availableLessons.value.find((session) => session.id === sessionId.value) || null)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    sessions.value = await getMySessions()
    applyRouteLesson()
  } catch (error) { loadError.value = userErrorMessage(error, 'Không thể tải danh sách bài học.') }
  finally { loading.value = false }
}

function applyRouteLesson() {
  const requested = typeof route.query.session_id === 'string' ? route.query.session_id : ''
  if (requested && availableLessons.value.some((session) => session.id === requested)) sessionId.value = requested
}

watch(() => route.query.session_id, () => applyRouteLesson())
watch(sessionId, () => {
  messages.value = []
  sendError.value = ''
})

async function send() {
  const currentQuestion = question.value.trim()
  if (!currentQuestion || sending.value || currentQuestion.length > 2000) return
  sending.value = true
  sendError.value = ''
  try {
    const result = await askStudentAI({
      question: currentQuestion,
      history: messages.value.slice(-20).map(({ role, text }) => ({ role, text })),
      ...(sessionId.value ? { session_id: sessionId.value } : {}),
    })
    messages.value.push({ role: 'user', text: currentQuestion }, { role: 'model', text: result.answer })
    question.value = ''
    await nextTick()
    questionInput.value?.focus()
  } catch (error) {
    sendError.value = userErrorMessage(error, 'Chưa gửi được câu hỏi. Câu hỏi vẫn được giữ lại để thử lại.')
  } finally { sending.value = false }
}

onMounted(load)
</script>

<template>
  <AppPageHeader title="Hỏi AI" eyebrow="Trợ giảng học tập" description="Đặt câu hỏi và nhận hướng dẫn từng bước bằng tiếng Việt.">
    <template #actions>
      <label class="visually-hidden" for="ai-lesson-context">Chọn bài học làm ngữ cảnh</label>
      <select id="ai-lesson-context" v-model="sessionId" class="form-select ai-lesson-select" :disabled="loading || sending">
        <option value="">Hỏi không kèm bài học</option>
        <option v-for="lesson in availableLessons" :key="lesson.id" :value="lesson.id">{{ lesson.classes?.name || 'Lớp học' }} · {{ formatDateTime(lesson.scheduled_start_at) }}</option>
      </select>
    </template>
  </AppPageHeader>

  <AppState v-if="loading" kind="loading" title="Đang tải bài học" />
  <AppState v-else-if="loadError" kind="error" title="Không thể tải bài học" :message="loadError" @retry="load" />
  <section v-else class="ai-chat" aria-label="Trò chuyện với trợ giảng AI">
    <div v-if="selectedLesson" class="ai-chat__context">
      <strong>{{ selectedLesson.classes?.name || 'Bài học đã chọn' }}</strong>
      <span>{{ selectedLesson.classes?.subjects?.name || 'Môn học' }} · {{ formatDateTime(selectedLesson.scheduled_start_at) }}</span>
      <p v-if="selectedLesson.session_note">{{ selectedLesson.session_note }}</p>
    </div>
    <div v-else class="ai-chat__intro"><div class="ai-chat__spark" aria-hidden="true">✳</div><h2>Bạn đang học phần nào?</h2><p>Chọn một bài học phía trên để hỏi theo nội dung buổi học, hoặc bắt đầu một câu hỏi mới.</p></div>

    <div v-if="messages.length" class="ai-chat__messages" aria-live="polite" aria-label="Lịch sử hội thoại">
      <article v-for="(message, index) in messages" :key="index" class="ai-chat__message" :class="`ai-chat__message--${message.role}`">
        <span class="ai-chat__message-label">{{ message.role === 'user' ? 'Bạn' : 'Trợ giảng AI' }}</span>
        <p>{{ message.text }}</p>
      </article>
    </div>
    <div v-if="sending" class="ai-chat__pending" role="status"><span class="app-state__spinner" aria-hidden="true"></span>AI đang suy nghĩ…</div>
    <div v-if="sendError" class="alert alert-danger ai-chat__error" role="alert">
      <span>{{ sendError }}</span>
      <button class="btn btn-sm btn-outline-danger" type="button" :disabled="sending || !question.trim()" @click="send">Thử lại</button>
    </div>

    <form class="ai-chat__composer" @submit.prevent="send">
      <label class="visually-hidden" for="ai-question">Câu hỏi của bạn</label>
      <textarea id="ai-question" ref="questionInput" v-model="question" class="form-control" rows="3" maxlength="2000" placeholder="Ví dụ: Vì sao ở bước này mình chuyển vế đổi dấu?" :disabled="sending" @input="sendError = ''"></textarea>
      <div class="ai-chat__composer-footer">
        <small>{{ question.length }}/2.000 · Hội thoại chỉ được giữ khi trang này đang mở.</small>
        <button class="btn btn-primary" type="submit" :disabled="sending || !question.trim() || question.length > 2000">{{ sending ? 'Đang gửi…' : 'Gửi câu hỏi' }}</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.ai-lesson-select { min-width: min(100%, 20rem); max-width: 27rem; }
.ai-chat { display: grid; gap: 1rem; max-width: 54rem; min-height: 26rem; margin: 0 auto; padding: 1.2rem; border: 1px solid var(--color-border); border-radius: 1rem; background: var(--color-surface); box-shadow: 0 12px 36px rgb(23 42 71 / 6%); }
.ai-chat__intro { max-width: 34rem; margin: auto; text-align: center; }
.ai-chat__spark { display: grid; place-items: center; width: 3rem; height: 3rem; margin: 0 auto 1rem; border-radius: 1rem; background: #edf3ff; color: var(--color-primary); font-size: 1.5rem; }
.ai-chat__intro h2 { font-size: 1.2rem; }
.ai-chat__intro p, .ai-chat__context span { color: var(--color-text-secondary); }
.ai-chat__context { display: grid; gap: .2rem; padding: .85rem 1rem; border-radius: .75rem; background: #f5f8fd; }
.ai-chat__context p { margin: .45rem 0 0; white-space: pre-wrap; }
.ai-chat__messages { display: grid; gap: .8rem; }
.ai-chat__message { max-width: 88%; padding: .75rem .9rem; border-radius: .9rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.ai-chat__message--user { justify-self: end; background: var(--color-primary); color: #fff; border-bottom-right-radius: .2rem; }
.ai-chat__message--model { justify-self: start; background: #f0f3f8; border-bottom-left-radius: .2rem; }
.ai-chat__message-label { display: block; margin-bottom: .3rem; font-size: .72rem; font-weight: 700; opacity: .78; }
.ai-chat__message p { margin: 0; }
.ai-chat__pending { display: flex; align-items: center; gap: .6rem; color: var(--color-text-secondary); }
.ai-chat__error { display: flex; justify-content: space-between; align-items: center; gap: .75rem; margin: 0; }
.ai-chat__composer { display: grid; gap: .55rem; align-self: end; }
.ai-chat__composer textarea { resize: vertical; }
.ai-chat__composer-footer { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.ai-chat__composer-footer small { color: var(--color-text-secondary); }
@media (max-width: 767.98px) { .ai-chat { min-height: 23rem; padding: .85rem; } .ai-lesson-select { min-width: 0; width: 100%; max-width: 100%; } }
@media (max-width: 575.98px) { .ai-chat__message { max-width: 96%; } .ai-chat__composer-footer { align-items: flex-start; flex-direction: column; } .ai-chat__error { align-items: flex-start; flex-direction: column; } }
</style>
