import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ParentFeedbackPage from './ParentFeedbackPage.vue'

const mocks = vi.hoisted(() => ({ submit: vi.fn() }))

vi.mock('@/services/commands', () => ({ submitParentFeedback: mocks.submit }))

describe('ParentFeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.submit.mockResolvedValue({ accepted: true })
  })

  it('states that feedback is private but not anonymous and requires the parent name', () => {
    const wrapper = mount(ParentFeedbackPage)

    expect(wrapper.text()).toContain('Phản hồi riêng tư, kín đáo')
    expect(wrapper.text()).toContain('Biểu mẫu không ẩn danh')
    expect((wrapper.get('#parent-feedback-name').element as HTMLInputElement).required).toBe(true)
    expect((wrapper.get('#parent-feedback-content').element as HTMLTextAreaElement).required).toBe(true)
  })

  it('submits the required parent name and feedback with optional student details', async () => {
    const wrapper = mount(ParentFeedbackPage)
    await wrapper.get('#parent-feedback-name').setValue('QA Parent')
    await wrapper.get('#parent-feedback-student').setValue('QA Student')
    await wrapper.get('#parent-feedback-class').setValue('QA-Class')
    await wrapper.get('#parent-feedback-content').setValue('QA feedback about the class')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.submit).toHaveBeenCalledWith({
      parent_name: 'QA Parent',
      student_name: 'QA Student',
      class_name: 'QA-Class',
      feedback: 'QA feedback about the class',
      website: '',
    })
    expect(wrapper.text()).toContain('Trung tâm đã nhận được phản hồi')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
