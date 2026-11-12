import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentQuickEnrollmentModal from './StudentQuickEnrollmentModal.vue'

const mocks = vi.hoisted(() => ({
  adminEnrollStudents: vi.fn(),
  getStudentIntakeDuplicateIdentities: vi.fn(),
  parseStudentIntakeWorkbook: vi.fn(),
  classifyStudentIntakeRows: vi.fn(),
}))

vi.mock('@/services/commands', () => ({ adminEnrollStudents: mocks.adminEnrollStudents }))
vi.mock('@/services/data-queries', () => ({ getStudentIntakeDuplicateIdentities: mocks.getStudentIntakeDuplicateIdentities }))
vi.mock('@/modules/admin/utils/student-intake', () => ({
  MAX_STUDENT_INTAKE_ROWS: 100,
  downloadStudentIntakeTemplate: vi.fn(),
  parseStudentIntakeWorkbook: mocks.parseStudentIntakeWorkbook,
  classifyStudentIntakeRows: mocks.classifyStudentIntakeRows,
}))

function mountModal() {
  return mount(StudentQuickEnrollmentModal, {
    props: {
      modelValue: false,
      classes: [{ id: 'qa-class-1', code: 'QA-CLASS-1', name: 'QA Toán 6', status: 'ACTIVE' }],
      initialClassId: 'qa-class-1',
    },
    global: {
      stubs: {
        FormModal: {
          props: ['modelValue', 'submitDisabled', 'submitLabel', 'busy'],
          emits: ['submit'],
          template: '<div v-if="modelValue"><slot /><button type="button" data-testid="confirm" :disabled="submitDisabled || busy" @click="$emit(\'submit\')">{{ submitLabel }}</button></div>',
        },
      },
    },
  })
}

async function uploadReadyWorkbook(wrapper: ReturnType<typeof mountModal>) {
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  const input = wrapper.get('#student-intake-file').element as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['QA'], 'QA-students.xlsx')] })
  await wrapper.get('#student-intake-file').trigger('change')
  await flushPromises()
}

describe('StudentQuickEnrollmentModal month roster result', () => {
  beforeEach(() => {
    mocks.adminEnrollStudents.mockReset()
    mocks.getStudentIntakeDuplicateIdentities.mockReset().mockResolvedValue([])
    mocks.parseStudentIntakeWorkbook.mockReset().mockResolvedValue([{
      row_number: 2,
      full_name: 'QA Học sinh mới',
      student_code: 'QA-STUDENT-1',
      phone: '',
      parent_name: '',
      parent_phone: '',
    }])
    mocks.classifyStudentIntakeRows.mockReset().mockImplementation((rows) =>
      rows.map((row: Record<string, unknown>) => ({ ...row, status: 'READY', message: 'QA sẵn sàng' })))
  })

  it('shows synchronized month session counts for a successfully enrolled student', async () => {
    mocks.adminEnrollStudents.mockResolvedValue({ results: [{
      row_number: 2,
      status: 'CREATED',
      student_code: 'QA-STUDENT-1',
      username: 'qa-student-1',
      temporary_password: 'QA-temp',
      sessions_updated: 4,
      students_added: 4,
      sessions_skipped_with_attendance: 1,
    }] })
    const wrapper = mountModal()
    await uploadReadyWorkbook(wrapper)
    await wrapper.get('[data-testid="confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('đồng bộ 4 buổi còn lại trong tháng')
    expect(wrapper.text()).toContain('Giữ nguyên 1 buổi có attendance')
    expect(mocks.adminEnrollStudents).toHaveBeenCalledWith(expect.objectContaining({ class_id: 'qa-class-1' }))
    wrapper.unmount()
  })

  it('shows the conflicting session date for a rolled-back intake row', async () => {
    mocks.adminEnrollStudents.mockResolvedValue({ results: [{
      row_number: 2,
      status: 'FAILED',
      reason_code: 'MEMBERSHIP_ROSTER_SYNC_CONFLICT',
      details: { session_date: '2026-11-20', reason: 'SCHEDULE_CONFLICT' },
    }] })
    const wrapper = mountModal()
    await uploadReadyWorkbook(wrapper)
    await wrapper.get('[data-testid="confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('buổi ngày 2026-11-20')
    expect(wrapper.text()).toContain('Tài khoản và membership của dòng này đã được hoàn tác')
    wrapper.unmount()
  })
})
