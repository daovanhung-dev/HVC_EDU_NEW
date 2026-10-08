import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
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

const mountedWrappers: Array<{ unmount: () => void }> = []

function mountSessionsPage() {
  const wrapper = mount(SessionsPage, { global: { plugins: [createPinia()] } })
  mountedWrappers.push(wrapper)
  return wrapper
}

function unmountSessionsPage(wrapper: { unmount: () => void }) {
  wrapper.unmount()
  const index = mountedWrappers.indexOf(wrapper)
  if (index >= 0) mountedWrappers.splice(index, 1)
}

function attendanceModal() {
  const element = document.body.querySelector<HTMLElement>('.staff-attendance-modal.app-modal')
  if (!element) throw new Error('Không tìm thấy popup điểm danh đã Teleport tới body.')
  return new DOMWrapper(element)
}

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
  const wrapper = mountSessionsPage()
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

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })

  it('opens the attendance popup automatically after starting a session', async () => {
    mocks.getMySessions.mockResolvedValueOnce([makeSession('SCHEDULED')]).mockResolvedValueOnce([makeSession('IN_PROGRESS')])
    const wrapper = mountSessionsPage()
    await flushPromises()

    expect(wrapper.find('.session-month__grid').exists()).toBe(true)
    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Bắt đầu buổi học'))?.trigger('click')
    await flushPromises()

    expect(mocks.startSession).toHaveBeenCalledWith('qa-teacher-session')
    expect(attendanceModal().classes()).toContain('show')
    expect(attendanceModal().text()).toContain('Điểm danh và kết quả học tập')
    unmountSessionsPage(wrapper)
  })

  it('shows a sign-in message and keeps attendance closed when starting fails', async () => {
    mocks.getMySessions.mockResolvedValueOnce([makeSession('SCHEDULED')])
    mocks.startSession.mockRejectedValueOnce({ code: 'UNAUTHENTICATED', status: 401 })
    const wrapper = mountSessionsPage()
    await flushPromises()

    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Bắt đầu buổi học'))?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    expect(wrapper.get('.teacher-session-status').text()).toBe('Sắp diễn ra')
    const modal = document.body.querySelector<HTMLElement>('.staff-attendance-modal.app-modal')
    expect(modal?.classList.contains('show')).toBe(false)
    expect(modal?.getAttribute('aria-hidden')).toBe('true')
    expect(mocks.getSessionStudents).toHaveBeenCalledTimes(1)
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()
    unmountSessionsPage(wrapper)
  })

  it('shows Vietnamese statuses and saves only changed student rows', async () => {
    const wrapper = await openAttendance()
    expect(attendanceModal().text()).toContain('Có mặt')
    expect(attendanceModal().text()).not.toContain('PRESENT')

    await attendanceModal().get('[aria-label="Điểm bài tập về nhà của QA Học sinh"]').setValue('0')
    expect(attendanceModal().text()).toContain('1 dòng chưa lưu')
    await attendanceModal().findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()

    expect(mocks.updateSessionLearning).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'qa-teacher-session',
      students: [expect.objectContaining({ student_id: 'qa-student-1', status: 'PRESENT', homework_score: 0 })],
    }))
    unmountSessionsPage(wrapper)
  })

  it('keeps completed session results read-only', async () => {
    const wrapper = await openAttendance('COMPLETED')
    expect(attendanceModal().text()).toContain('Chế độ xem kết quả')
    expect((attendanceModal().get('[aria-label="Trạng thái điểm danh của QA Học sinh"]').element as HTMLSelectElement).disabled).toBe(true)
    expect(attendanceModal().findAll('button').some((button) => button.text().includes('Tối ưu nhận xét'))).toBe(false)
    unmountSessionsPage(wrapper)
  })

  it('shows a Gemini draft and does not persist until the teacher saves', async () => {
    const wrapper = await openAttendance()
    await attendanceModal().get('[aria-label="Nhận xét dành cho phụ huynh của QA Học sinh"]').setValue('Em có tiến bộ trong buổi học.')
    await attendanceModal().findAll('button').find((button) => button.text().includes('Tối ưu nhận xét'))?.trigger('click')
    await flushPromises()

    expect(mocks.optimizeTeacherComment).toHaveBeenCalledWith('Em có tiến bộ trong buổi học.')
    expect(attendanceModal().text()).toContain('Em đã chủ động hơn và tiến bộ tốt.')
    await attendanceModal().findAll('button').find((button) => button.text().includes('Dùng nhận xét này'))?.trigger('click')
    await flushPromises()
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()

    await attendanceModal().findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()
    expect(mocks.updateSessionLearning).toHaveBeenCalledWith(expect.objectContaining({
      students: [expect.objectContaining({ comment: 'Em đã chủ động hơn và tiến bộ tốt.' })],
    }))
    unmountSessionsPage(wrapper)
  })

  it('requires attendance status on changed rows before saving', async () => {
    mocks.getSessionStudents.mockResolvedValueOnce([makeStudent(null)])
    const wrapper = await openAttendance()
    await attendanceModal().get('[aria-label="Điểm bài tập về nhà của QA Học sinh"]').setValue('8')
    await attendanceModal().findAll('button').find((button) => button.text().includes('Lưu 1 dòng đã đổi'))?.trigger('click')
    await flushPromises()

    expect(attendanceModal().text()).toContain('Chọn trạng thái điểm danh.')
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()
    unmountSessionsPage(wrapper)
  })

  it('shows an empty calendar state and reports session loading errors', async () => {
    mocks.getMySessions.mockResolvedValueOnce([])
    const empty = mountSessionsPage()
    await flushPromises()
    expect(empty.text()).toContain('Không có buổi học trong ngày này.')
    unmountSessionsPage(empty)

    mocks.getMySessions.mockRejectedValueOnce(new Error('QA teacher load failure'))
    const failed = mountSessionsPage()
    await flushPromises()
    expect(failed.find('.app-state--error').text()).toContain('Không thể tải lịch giảng dạy')
    expect(failed.find('.session-month__grid').exists()).toBe(false)
    unmountSessionsPage(failed)
  })

  it('saves a validated YouTube link with session learning content', async () => {
    const wrapper = mountSessionsPage()
    await flushPromises()
    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()
    await wrapper.get('#lesson-youtube-url').setValue('https://youtu.be/dQw4w9WgXcQ')
    await wrapper.findAll('button').find((button) => button.text().includes('Lưu nội dung'))?.trigger('click')
    await flushPromises()

    expect(mocks.updateSessionLearning).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'qa-teacher-session', lesson_youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
    }))
  })

  it('rejects a non-YouTube lesson URL before saving', async () => {
    const wrapper = mountSessionsPage()
    await flushPromises()
    await wrapper.get('.session-month__session-card').trigger('click')
    await flushPromises()
    await wrapper.get('#lesson-youtube-url').setValue('https://example.test/watch?v=bad')
    await wrapper.findAll('button').find((button) => button.text().includes('Lưu nội dung'))?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Chỉ nhập link video YouTube hợp lệ.')
    expect(mocks.updateSessionLearning).not.toHaveBeenCalled()
    unmountSessionsPage(wrapper)
  })
})
