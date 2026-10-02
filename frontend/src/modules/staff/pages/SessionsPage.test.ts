import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionsPage from './SessionsPage.vue'

const mocks = vi.hoisted(() => ({
  completeSession: vi.fn(),
  getMySessions: vi.fn(),
  getSessionStudents: vi.fn(),
  startSession: vi.fn(),
  updateSessionLearning: vi.fn(),
}))

vi.mock('@/services/commands', () => ({
  completeSession: mocks.completeSession,
  startSession: mocks.startSession,
  updateSessionLearning: mocks.updateSessionLearning,
}))
vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions, getSessionStudents: mocks.getSessionStudents }))

describe('Staff SessionsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T09:00:00+07:00'))
    mocks.completeSession.mockReset().mockResolvedValue(undefined)
    mocks.getMySessions.mockReset().mockResolvedValue([{
      id: 'qa-teacher-session',
      class_id: 'qa-class',
      recurrence_schedule_id: null,
      recurrence_occurrence_date: null,
      scheduled_start_at: '2026-10-02T10:00:00+07:00',
      scheduled_end_at: '2026-10-02T12:00:00+07:00',
      status: 'SCHEDULED',
      session_note: null,
      room: 'QA-02',
      classes: { name: 'Lớp Toán QA' },
      session_staff: [],
    }])
    mocks.getSessionStudents.mockReset().mockResolvedValue([])
    mocks.startSession.mockReset().mockResolvedValue(undefined)
    mocks.updateSessionLearning.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => vi.useRealTimers())

  it('opens the existing teacher workflow from a calendar session', async () => {
    const wrapper = mount(SessionsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.find('.session-month__grid').exists()).toBe(true)
    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()

    expect(mocks.getSessionStudents).toHaveBeenCalledWith('qa-teacher-session')
    expect(wrapper.text()).toContain('Điểm danh và nhận xét')
    await wrapper.findAll('button').find((button) => button.text() === 'Bắt đầu')?.trigger('click')
    await flushPromises()
    expect(mocks.startSession).toHaveBeenCalledWith('qa-teacher-session')
    wrapper.unmount()
  })

  it('shows an empty calendar state and reports session loading errors', async () => {
    mocks.getMySessions.mockResolvedValueOnce([])
    const empty = mount(SessionsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(empty.text()).toContain('Không có buổi học trong ngày này.')
    empty.unmount()

    mocks.getMySessions.mockRejectedValueOnce(new Error('QA teacher load failure'))
    const failed = mount(SessionsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(failed.find('.app-state--error').text()).toContain('Không thể tải lịch giảng dạy')
    expect(failed.find('.session-month__grid').exists()).toBe(false)
    failed.unmount()
  })
})
