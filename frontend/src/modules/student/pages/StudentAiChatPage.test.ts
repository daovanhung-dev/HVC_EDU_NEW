import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentAiChatPage from './StudentAiChatPage.vue'

const mocks = vi.hoisted(() => ({ askStudentAI: vi.fn(), getMySessions: vi.fn() }))
vi.mock('@/services/commands', () => ({ askStudentAI: mocks.askStudentAI }))
vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions }))

const lesson = {
  id: 'qa-lesson', class_id: 'qa-class', scheduled_start_at: '2026-10-01T10:00:00+07:00', scheduled_end_at: '2026-10-01T12:00:00+07:00',
  status: 'COMPLETED', session_note: 'QA- Phương trình bậc nhất', lesson_youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
  classes: { name: 'QA- Toán 8', subjects: { name: 'QA- Toán' } },
}

async function mountPage(path = '/student/ai') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/student/ai', component: StudentAiChatPage }] })
  await router.push(path)
  const wrapper = mount(StudentAiChatPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('StudentAiChatPage', () => {
  beforeEach(() => {
    mocks.getMySessions.mockReset().mockResolvedValue([lesson])
    mocks.askStudentAI.mockReset().mockResolvedValue({ answer: 'QA- Hãy cô lập x trước.' })
  })

  it('uses a selected lesson, sends conversation history, and shows the answer', async () => {
    const wrapper = await mountPage('/student/ai?session_id=qa-lesson')
    await wrapper.get('#ai-question').setValue('QA- Vì sao đổi dấu?')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.askStudentAI).toHaveBeenCalledWith({ question: 'QA- Vì sao đổi dấu?', history: [], session_id: 'qa-lesson' })
    expect(wrapper.text()).toContain('QA- Hãy cô lập x trước.')

    await wrapper.get('#ai-question').setValue('QA- Câu tiếp theo')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.askStudentAI).toHaveBeenLastCalledWith(expect.objectContaining({
      history: [{ role: 'user', text: 'QA- Vì sao đổi dấu?' }, { role: 'model', text: 'QA- Hãy cô lập x trước.' }],
    }))
  })

  it('preserves a failed question for retry and clears page-local history when lesson changes', async () => {
    mocks.askStudentAI.mockRejectedValueOnce(new Error('QA Gemini unavailable')).mockResolvedValueOnce({ answer: 'QA- Trả lời sau khi thử lại.' })
    const wrapper = await mountPage()
    const input = wrapper.get('#ai-question')
    await input.setValue('QA- Câu hỏi cần thử lại')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((input.element as HTMLTextAreaElement).value).toBe('QA- Câu hỏi cần thử lại')
    expect(wrapper.text()).toContain('Thử lại')
    await wrapper.findAll('button').find((button) => button.text() === 'Thử lại')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('QA- Trả lời sau khi thử lại.')

    await wrapper.get('#ai-lesson-context').setValue('qa-lesson')
    await flushPromises()
    expect(wrapper.text()).not.toContain('QA- Trả lời sau khi thử lại.')
  })
})
