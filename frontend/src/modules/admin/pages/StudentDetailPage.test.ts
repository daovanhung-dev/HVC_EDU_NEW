import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentDetailPage from './StudentDetailPage.vue'

const mocks = vi.hoisted(() => ({
  getStudent: vi.fn(),
  getStudentHistory: vi.fn(),
  getStudentCurrentClasses: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ params: { studentId: 'qa-student-1' } }),
}))

vi.mock('@/services/data-queries', () => ({
  getStudent: mocks.getStudent,
  getStudentHistory: mocks.getStudentHistory,
  getStudentCurrentClasses: mocks.getStudentCurrentClasses,
}))

const student = {
  id: 'qa-student-1', user_id: 'qa-user-1', student_code: 'QA-S-001', full_name: 'QA- Học sinh',
  phone: null, email: null, parent_name: null, parent_phone: null, address: null, status: 'LOCKED',
}
const currentClass = {
  id: 'qa-class-1', code: 'QA-MATH-07', name: 'QA- Toán 7', membership_id: 'qa-membership-1',
  start_date: '2026-10-01', status: 'ACTIVE', subject_name: 'QA- Toán', grade_name: 'QA- Khối 7',
  schedules: [{
    id: 'qa-schedule-1', class_id: 'qa-class-1', day_of_week: 2, start_time: '17:30:00', end_time: '19:00:00',
    room: 'QA-A1', status: 'ACTIVE', reviewed_at: null,
    class_schedule_staff: [{ staff_id: 'qa-teacher-1', staff: { id: 'qa-teacher-1', staff_code: 'QA-T-1', full_name: 'QA- Giáo viên' } }],
  }],
}

function mountPage() {
  return mount(StudentDetailPage, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

describe('StudentDetailPage current classes', () => {
  beforeEach(() => {
    mocks.getStudent.mockReset().mockResolvedValue(student)
    mocks.getStudentHistory.mockReset().mockResolvedValue([])
    mocks.getStudentCurrentClasses.mockReset().mockResolvedValue([currentClass])
  })

  it('shows current class details and schedule for a locked student', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const section = wrapper.get('[data-testid="student-current-classes"]')
    expect(section.text()).toContain('QA-MATH-07 · QA- Toán 7')
    expect(section.text()).toContain('QA- Toán · QA- Khối 7')
    expect(section.text()).toContain('Bắt đầu học: 1 thg 10, 2026')
    expect(section.text()).toContain('Thứ Ba · 17:30–19:00')
    expect(section.text()).toContain('Giáo viên: QA- Giáo viên')
    wrapper.unmount()
  })

  it('keeps the profile visible when current class lookup fails and supports retry', async () => {
    mocks.getStudentCurrentClasses.mockRejectedValueOnce(new Error('QA current class failure'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain(student.full_name)
    const section = wrapper.get('[data-testid="student-current-classes"]')
    expect(section.text()).toContain('QA current class failure')
    await section.get('.app-state--error button').trigger('click')
    await flushPromises()
    expect(section.text()).toContain('QA-MATH-07 · QA- Toán 7')
    wrapper.unmount()
  })

  it('shows an empty state when the student has no current class', async () => {
    mocks.getStudentCurrentClasses.mockResolvedValue([])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-testid="student-current-classes"]').text()).toContain('Chưa xếp lớp')
    wrapper.unmount()
  })
})
