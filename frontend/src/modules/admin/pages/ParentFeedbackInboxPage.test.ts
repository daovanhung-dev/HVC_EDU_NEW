import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ParentFeedbackInboxPage from './ParentFeedbackInboxPage.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))

vi.mock('@/services/data-queries', () => ({
  getParentFeedbackList: mocks.list,
  getParentFeedbackDetail: mocks.detail,
}))

const row = {
  id: 'qa-feedback-1',
  parent_name: 'QA Parent',
  student_name: 'QA Student',
  class_name: 'QA-Class',
  created_at: '2026-11-19T03:00:00.000Z',
}

describe('ParentFeedbackInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([row])
    mocks.detail.mockResolvedValue({ ...row, feedback: 'QA feedback text' })
  })

  it('shows the named sender and fetches feedback text only when selected', async () => {
    const wrapper = mount(ParentFeedbackInboxPage)
    await flushPromises()

    expect(wrapper.text()).toContain('không ẩn danh')
    expect(wrapper.text()).toContain('QA Parent')
    expect(mocks.detail).not.toHaveBeenCalled()

    await wrapper.get('.parent-feedback-inbox__item').trigger('click')
    await flushPromises()

    expect(mocks.detail).toHaveBeenCalledWith('qa-feedback-1')
    expect(wrapper.text()).toContain('QA feedback text')
  })
})
