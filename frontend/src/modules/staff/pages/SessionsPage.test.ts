import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionsPage from './SessionsPage.vue'

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() {
      this.element.style.display = 'block'
      this.element.classList.add('show')
      this.element.setAttribute('aria-hidden', 'false')
      this.element.dispatchEvent(new Event('shown.bs.modal'))
    }
    hide() {
      const event = new Event('hide.bs.modal', { cancelable: true })
      this.element.dispatchEvent(event)
      if (event.defaultPrevented) return
      this.element.style.display = 'none'
      this.element.classList.remove('show')
      this.element.setAttribute('aria-hidden', 'true')
      this.element.dispatchEvent(new Event('hidden.bs.modal'))
    }
    dispose() {}
  },
}))

const mocks = vi.hoisted(() => ({
  completeSession: vi.fn(),
  getMySessions: vi.fn(),
  getSessionStudents: vi.fn(),
  optimizeTeacherComment: vi.fn(),
  startSession: vi.fn(),
  updateSessionLearning: vi.fn(),
}))

vi.mock('@/services/commands', () => ({
  completeSession: mocks.completeSession,
  optimizeTeacherComment: mocks.optimizeTeacherComment,
  startSession: mocks.startSession,
  updateSessionLearning: mocks.updateSessionLearning,
}))
vi.mock('@/services/data-queries', () => ({ getMySessions: mocks.getMySessions, getSessionStudents: mocks.getSessionStudents }))

function makeSession(status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS') {
  return {
    id: 'qa-teacher-session',
    class_id: 'qa-class',
    recurrence_schedule_id: null,
    recurrence_occurrence_date: null,
    scheduled_start_at: '2026-10-02T10:00:00+07:00',
    scheduled_end_at: '2026-10-02T12:00:00+07:00',
    status,
    session_note: null,
    room: 'QA-02',
    classes: { name: 'Lớp Toán QA' },
    session_staff: [],
  }
}

function makeStudent(status: 'PRESENT' | null = 'PRESENT') {
  return {
    student_id: 'qa-student-1',
    students: { full_name: 'QA Học sinh', student_code: 'QA-001' },
    student_attendances: status ? [{
      status,
      late_minutes: null,
      absence_reason: null,
      homework_score: null,
      homework_note: null,
      understanding_score: null,
      attitude_score: null,
      positive_feedback_count: null,
      positive_feedback_raw: null,
      comment: 'Em có tiến bộ trong buổi học.',
    }] : [],
    assessment_snapshot: null,
  }
}

async function openAttendance(status: 'IN_PROGRESS' | 'COMPLETED' = 'IN_PROGRESS') {
  mocks.getMySessions.mockResolvedValue([makeSession(status)])
  const wrapper = mount(SessionsPage, { global: { plugins: [createPinia()] } })
  await flushPromises()
  await wrapper.get('.session-month__session-card').trigger('click')
  await flushPromises()
  const triggerLabel = status === 'COMPLETED' ? 'Xem kết quả' : 'Điểm danh'
  await wrapper.findAll('button').find((button) => button.text().includes(triggerLabel))?.trigger('click')
  await flushPromises()
  return wrapper
}

describe('Staff SessionsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T09:00:00+07:00'))
    mocks.completeSession.mockReset().mockResolvedValue(undefined)
    mocks.getMySessions.mockReset().mockResolvedValue([makeSession()])
    mocks.getSessionStudents.mockReset().mockResolvedValue([makeStudent()])
    mocks.optimizeTeacherComment.mockReset().mockResolvedValue({ optimized_comment: 'Em đã chủ động hơn và tiến bộ tốt.' })
    mocks.startSession.mockReset().mockResolvedValue(undefined)
    mocks.updateSessionLearning.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => vi.useRealTimers())

  it('opens the attendance popup automatically after starting a session', async () => {
    mocks.getMySessions.mockResolvedValueOnce([makeSession('SCHEDULED')]).mockResolvedValueOnce([makeSession('IN_PROGRESS')])
    const wrapper = mount(SessionsPage, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.find('.session-month__grid').exists()).toBe(true)
    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Bắt đầu buổi học'))?.trigger('click')
    await flushPromises()

    expect(mocks.startSession).toHaveBeenCalledWith('qa-teacher-session')
    expect(wrapper.find('.app-modal.show').exists()).toBe(true)
    expect(wrapper.text()).toContain('Điểm danh và kết quả học tập')
    wrapper.unmount()
  })

  it('shows Vietnamese statuses and saves only changed student rows', async () => {
    const wrapper = await openAttendance()
    expect(wrapper.text()).toContain('Có mặt')
    expect(wrapper.text()).not.toContain('PRESENT')

    await wrapper.get('[aria-label="Điểm bài tập về nhà của QA Học sinh"]').setValue('0')
    expect(wrapper.text()).toContain('1 dòng chưa lưu')
    await wrapper.findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()

    expect(mocks.updateSessionLearning).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'qa-teacher-session',
      students: [expect.objectContaining({ student_id: 'qa-student-1', status: 'PRESENT', homework_score: 0 })],
    }))
    wrapper.unmount()
  })

  it('keeps completed session results read-only', async () => {
    const wrapper = await openAttendance('COMPLETED')
    expect(wrapper.text()).toContain('Chế độ xem kết quả')
    expect((wrapper.get('[aria-label="Trạng thái điểm danh của QA Học sinh"]').element as HTMLSelectElement).disabled).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text().includes('Tối ưu nhận xét'))).toBe(false)
    wrapper.unmount()
  })

  it('shows a Gemini draft and does not persist until the teacher saves', async () => {
    const wrapper = await openAttendance()
    await wrapper.get('[aria-label="Nhận xét dành cho phụ huynh của QA Học sinh"]').setValue('Em có tiến bộ trong buổi học.')
    await wrapper.findAll('button').find((button) => button.text().includes('Tối ưu nhận xét'))?.trigger('click')
    await flushPromises()

    expect(mocks.optimizeTeacherComment).toHaveBeenCalledWith('Em có tiến bộ trong buổi học.')
    expect(wrapper.text()).toContain('Em đã chủ động hơn và tiến bộ tốt.')
    await wrapper.findAll('button').find((button) => button.text().includes('Dùng nhận xét này'))?.trigger('click')
    await flushPromises()
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()

    await wrapper.findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()
    expect(mocks.updateSessionLearning).toHaveBeenCalledWith(expect.objectContaining({
      students: [expect.objectContaining({ comment: 'Em đã chủ động hơn và tiến bộ tốt.' })],
    }))
    wrapper.unmount()
  })

  it('requires attendance status on changed rows before saving', async () => {
    mocks.getSessionStudents.mockResolvedValueOnce([makeStudent(null)])
    const wrapper = await openAttendance()
    await wrapper.get('[aria-label="Điểm bài tập về nhà của QA Học sinh"]').setValue('8')
    await wrapper.findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Chọn trạng thái điểm danh.')
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()
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
