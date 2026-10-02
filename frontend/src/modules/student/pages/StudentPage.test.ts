import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentPage from './StudentPage.vue'

const mocks = vi.hoisted(() => ({
  getMyAttendance: vi.fn(),
  getMySessions: vi.fn(),
  moduleName: 'schedule',
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { module: mocks.moduleName } }) }))
vi.mock('@/services/data-queries', () => ({ getMyAttendance: mocks.getMyAttendance, getMySessions: mocks.getMySessions }))

describe('StudentPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T09:00:00+07:00'))
    mocks.moduleName = 'schedule'
    mocks.getMyAttendance.mockReset().mockResolvedValue([])
    mocks.getMySessions.mockReset().mockResolvedValue([{
      id: 'qa-student-session',
      class_id: 'qa-class',
      recurrence_schedule_id: null,
      recurrence_occurrence_date: null,
      scheduled_start_at: '2026-10-02T10:00:00+07:00',
      scheduled_end_at: '2026-10-02T12:00:00+07:00',
      status: 'SCHEDULED',
      session_note: 'Ôn tập chương 2',
      room: 'QA-02',
      classes: { name: 'Lớp Toán QA' },
      session_staff: [{ staff_id: 'qa-teacher', staff: { full_name: 'Giáo viên QA' } }],
    }])
  })

  afterEach(() => vi.useRealTimers())

  it('shows a monthly calendar and the selected session details for a student or parent', async () => {
    const wrapper = mount(StudentPage)
    await flushPromises()

    expect(wrapper.find('.session-month__grid').exists()).toBe(true)
    expect(wrapper.find('.student-schedule__detail').exists()).toBe(false)

    await wrapper.get('.session-month__session-card').trigger('click')
    expect(wrapper.find('.student-schedule__detail').text()).toContain('Lớp Toán QA')
    expect(wrapper.find('.student-schedule__detail').text()).toContain('Giáo viên QA')
    expect(wrapper.find('.student-schedule__detail').text()).toContain('QA-02')
    expect(wrapper.find('.student-schedule__detail').text()).toContain('Ôn tập chương 2')
    wrapper.unmount()
  })

  it('keeps the attendance history view separate from the schedule calendar', async () => {
    mocks.moduleName = 'attendance'
    const wrapper = mount(StudentPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Kết quả học tập')
    expect(wrapper.find('.session-month__grid').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an error and retry action if schedule loading fails', async () => {
    mocks.getMySessions.mockRejectedValue(new Error('QA load failure'))
    const wrapper = mount(StudentPage)
    await flushPromises()

    expect(wrapper.get('.app-state--error').text()).toContain('QA load failure')
    expect(wrapper.text()).not.toContain('Không có buổi học trong ngày này.')
    wrapper.unmount()
  })
})
