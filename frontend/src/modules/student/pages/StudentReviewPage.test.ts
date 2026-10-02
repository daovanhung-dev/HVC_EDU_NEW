import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentReviewPage from './StudentReviewPage.vue'

const mocks = vi.hoisted(() => ({ getMySessions: vi.fn() }))
vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions }))

function makeSession(id: string, status: string, url: string | null) {
  return {
    id, class_id: 'qa-class', scheduled_start_at: '2026-10-01T10:00:00+07:00', scheduled_end_at: '2026-10-01T12:00:00+07:00',
    status, session_note: 'QA- Nội dung buổi học', lesson_youtube_url: url,
    classes: { name: 'QA- Toán 8', subjects: { name: 'QA- Toán' }, grades: { name: 'QA- Lớp 8' } },
  }
}

describe('StudentReviewPage', () => {
  beforeEach(() => mocks.getMySessions.mockReset().mockResolvedValue([
    makeSession('qa-completed-video', 'COMPLETED', 'https://youtu.be/dQw4w9WgXcQ'),
    makeSession('qa-completed-no-video', 'COMPLETED', null),
    makeSession('qa-progress-video', 'IN_PROGRESS', 'https://youtu.be/dQw4w9WgXcQ'),
  ]))

  it('lists only completed sessions with a safe YouTube video and links to lesson chat', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/student/review', component: StudentReviewPage },
      { path: '/student/ai', component: { template: '<div />' } },
    ] })
    await router.push('/student/review')
    const wrapper = mount(StudentReviewPage, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.findAll('.student-review-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('QA- Toán 8')
    expect(wrapper.get('iframe').attributes('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(wrapper.get('a.btn-primary').attributes('href')).toContain('/student/ai?session_id=qa-completed-video')
  })
})
