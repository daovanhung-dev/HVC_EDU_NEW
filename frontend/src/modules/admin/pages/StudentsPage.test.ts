import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { useToastStore } from '@/stores/toast.store'
import StudentsPage from './StudentsPage.vue'

const mocks = vi.hoisted(() => ({
  getStudents: vi.fn(),
  getStudentIntakeDuplicateIdentities: vi.fn(),
  getClasses: vi.fn(),
  getClassRosterForExport: vi.fn(),
  getStudentsCurrentClassSummaries: vi.fn(),
  adminCreateUser: vi.fn(),
  adminEnrollStudents: vi.fn(),
  adminExportStudentLogins: vi.fn(),
  adminResetPassword: vi.fn(),
  adminResetPasswordBulk: vi.fn(),
  archiveStudent: vi.fn(),
  setAccountStatus: vi.fn(),
  updateStudent: vi.fn(),
}))

vi.mock('bootstrap', () => ({
  Modal: class MockModal {
    constructor(private readonly element: HTMLElement) {}
    show() { this.element.classList.add('show'); this.element.setAttribute('aria-hidden', 'false') }
    hide() { const event = new Event('hide.bs.modal', { cancelable: true }); this.element.dispatchEvent(event); if (event.defaultPrevented) return; this.element.classList.remove('show'); this.element.setAttribute('aria-hidden', 'true'); this.element.dispatchEvent(new Event('hidden.bs.modal')) }
    dispose() {}
  },
}))
vi.mock('@/services/data-queries', () => ({
  getStudents: mocks.getStudents,
  getStudentIntakeDuplicateIdentities: mocks.getStudentIntakeDuplicateIdentities,
  getClasses: mocks.getClasses,
  getClassRosterForExport: mocks.getClassRosterForExport,
  getStudentsCurrentClassSummaries: mocks.getStudentsCurrentClassSummaries,
}))
vi.mock('@/services/commands', () => ({
  adminCreateUser: mocks.adminCreateUser,
  adminEnrollStudents: mocks.adminEnrollStudents,
  adminExportStudentLogins: mocks.adminExportStudentLogins,
  adminResetPassword: mocks.adminResetPassword,
  adminResetPasswordBulk: mocks.adminResetPasswordBulk,
  archiveStudent: mocks.archiveStudent,
  setAccountStatus: mocks.setAccountStatus,
  updateStudent: mocks.updateStudent,
}))
vi.mock('@/modules/admin/utils/student-account-export', () => ({ downloadStudentLoginExport: vi.fn() }))
vi.mock('@/modules/admin/utils/student-class-roster-export', () => ({ downloadStudentClassRosterExport: vi.fn() }))

import { downloadStudentLoginExport } from '@/modules/admin/utils/student-account-export'
import { downloadStudentClassRosterExport } from '@/modules/admin/utils/student-class-roster-export'

const student = { id: 'qa-student-1', user_id: 'qa-user-1', student_code: 'QA-S-1', full_name: 'Học sinh QA', phone: null, parent_name: null, parent_phone: null, status: 'ACTIVE', created_at: '2026-09-30T08:00:00Z' }
const secondActiveStudent = { id: 'qa-student-3', user_id: 'qa-user-3', student_code: 'QA-S-3', full_name: 'Học sinh QA hai', phone: null, parent_name: null, parent_phone: null, status: 'ACTIVE', created_at: '2026-09-30T08:00:00Z' }
const inactiveStudent = { id: 'qa-student-2', user_id: 'qa-user-2', student_code: 'QA-S-2', full_name: 'Học sinh QA nghỉ', phone: null, parent_name: null, parent_phone: null, status: 'INACTIVE', created_at: '2026-09-30T08:00:00Z' }
const lockedStudent = { ...inactiveStudent, id: 'qa-student-locked', user_id: 'qa-user-locked', student_code: 'QA-S-LOCKED', full_name: 'Học sinh QA khóa', status: 'LOCKED' }
const qaClass = { id: 'qa-class-1', code: 'QA-CLASS-1', name: 'Lớp QA', status: 'ACTIVE' }
const qaSecondClass = { id: 'qa-class-2', code: 'QA-CLASS-2', name: 'Lớp QA hai', status: 'ACTIVE' }
const qaClassStudent = { id: student.id, student_code: student.student_code, full_name: student.full_name, phone: student.phone, parent_name: student.parent_name, status: student.status, created_at: student.created_at }

const mountedWrappers: Array<{ unmount: () => void }> = []

function track<T extends { unmount: () => void }>(wrapper: T) {
  mountedWrappers.push(wrapper)
  return wrapper
}

function mountPage() {
  return track(mount(StudentsPage, { global: { plugins: [createPinia()], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
}

function getPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  return wrapper.find(selector).exists() ? wrapper.get(selector) : new DOMWrapper(document.body).get(selector)
}

function findAllPageOrBody(wrapper: ReturnType<typeof mount>, selector: string) {
  const pageMatches = wrapper.findAll(selector)
  return pageMatches.length ? pageMatches : new DOMWrapper(document.body).findAll(selector)
}

function qaIntakeWorkbook(rows: string[][]): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Họ tên *', 'Mã học sinh', 'SĐT học sinh', 'Tên phụ huynh', 'SĐT phụ huynh'],
    ...rows,
  ]), 'Nhập học')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const file = new File([buffer], 'QA-nhap-hoc.xlsx')
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer })
  return file
}

function allButtons(wrapper: ReturnType<typeof mount>) {
  return [...wrapper.findAll('button'), ...new DOMWrapper(document.body).findAll('button')]
}

describe('StudentsPage dialogs', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove())
    document.body.classList.remove('modal-open')
  })

  beforeEach(() => {
    mocks.getStudents.mockReset().mockResolvedValue([student])
    mocks.getStudentIntakeDuplicateIdentities.mockReset().mockResolvedValue([student])
    mocks.getClasses.mockReset().mockResolvedValue([qaClass])
    mocks.getClassRosterForExport.mockReset().mockResolvedValue([qaClassStudent])
    mocks.getStudentsCurrentClassSummaries.mockReset().mockResolvedValue({
      [student.id]: [{ id: qaClass.id, code: qaClass.code, name: qaClass.name }],
    })
    mocks.adminCreateUser.mockReset().mockResolvedValue({ temporary_password: 'QA-temp-pass-42' })
    mocks.adminEnrollStudents.mockReset().mockResolvedValue({ results: [] })
    mocks.adminExportStudentLogins.mockReset().mockResolvedValue({
      rows: [{ student_code: student.student_code, full_name: student.full_name, login_email: 'qa-login@hvc-edu.local' }],
      missing_email_count: 0,
      skipped_count: 0,
    })
    mocks.adminResetPassword.mockReset().mockResolvedValue({ temporary_password: '12345678' })
    mocks.adminResetPasswordBulk.mockReset().mockResolvedValue({ temporary_password: null, results: [] })
    mocks.archiveStudent.mockReset().mockResolvedValue(undefined)
    mocks.setAccountStatus.mockReset().mockResolvedValue(undefined)
    mocks.updateStudent.mockReset().mockResolvedValue(undefined)
    vi.mocked(downloadStudentLoginExport).mockReset().mockResolvedValue(undefined)
    vi.mocked(downloadStudentClassRosterExport).mockReset().mockResolvedValue(undefined)
  })

  it('shows a retryable load error instead of a misleading empty list', async () => {
    mocks.getStudents.mockRejectedValueOnce(new Error('QA roster failure'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.app-state--error').text()).toContain('QA roster failure')
    expect(wrapper.text()).not.toContain('Chưa có học sinh phù hợp')
    await wrapper.find('.app-state--error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(student.full_name)
    wrapper.unmount()
  })

  it('shows every current class, including for a locked student, in the class column', async () => {
    mocks.getStudents.mockResolvedValue([student, lockedStudent])
    mocks.getStudentsCurrentClassSummaries.mockResolvedValue({
      [student.id]: [
        { id: qaClass.id, code: qaClass.code, name: qaClass.name },
        { id: qaSecondClass.id, code: qaSecondClass.code, name: qaSecondClass.name },
      ],
      [lockedStudent.id]: [{ id: qaSecondClass.id, code: qaSecondClass.code, name: qaSecondClass.name }],
    })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.findAll('th').map((cell) => cell.text())).toContain('Lớp đang học')
    expect(wrapper.text()).toContain(`${qaClass.code} · ${qaClass.name}`)
    expect(wrapper.text()).toContain(`${qaSecondClass.code} · ${qaSecondClass.name}`)
    expect(wrapper.text()).toContain(lockedStudent.full_name)
    expect(wrapper.find('[data-testid="student-classes-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps student rows visible when current class lookup fails and retries that lookup', async () => {
    mocks.getStudentsCurrentClassSummaries.mockRejectedValueOnce(new Error('QA class lookup failed'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain(student.full_name)
    expect(wrapper.text()).toContain('Chưa tải được')
    expect(wrapper.text()).not.toContain('Chưa xếp lớp')
    expect(wrapper.find('[data-testid="student-classes-error"]').text()).toContain('QA class lookup failed')

    await wrapper.find('[data-testid="student-classes-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(`${qaClass.code} · ${qaClass.name}`)
    expect(wrapper.find('[data-testid="student-classes-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the temporary password only in its result dialog after account creation succeeds', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh')
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'STUDENT', display_name: 'QA Học sinh' }))
    const passwordDialog = findAllPageOrBody(wrapper, '.app-modal').find((modal) => modal.text().includes('Mật khẩu tạm thời'))
    expect(passwordDialog).toBeTruthy()
    expect(findAllPageOrBody(wrapper, '.app-modal[aria-hidden="false"]')).toHaveLength(1)
    expect((passwordDialog!.get('#temporary-password').element as HTMLInputElement).value).toBe('QA-temp-pass-42')
    expect(useToastStore(pinia).items.some((item) => item.message.includes('QA-temp-pass-42'))).toBe(false)
  })

  it('selects only active filtered students and cancels bulk reset without calling the endpoint', async () => {
    mocks.getStudents.mockResolvedValue([student, inactiveStudent])
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="select-all-active-students"]').setValue(true)
    expect(getPageOrBody(wrapper, '[data-testid="select-all-active-students"]').element).toHaveProperty('checked', true)
    expect(getPageOrBody(wrapper, '[aria-label="Chọn Học sinh QA nghỉ"]').element).toHaveProperty('disabled', true)
    expect(wrapper.text()).toContain('1/100 đã chọn')

    await getPageOrBody(wrapper, '[data-testid="bulk-reset-students"]').trigger('click')
    expect(new DOMWrapper(document.body).text()).toContain('1 tài khoản đang hoạt động được chọn')
    expect(new DOMWrapper(document.body).text()).toContain('Học sinh QA')
    expect(new DOMWrapper(document.body).text()).not.toContain('Học sinh QA nghỉ')
    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')
    await flushPromises()

    expect(mocks.adminResetPasswordBulk).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('calls bulk reset once and shows per-student outcomes and the shared password', async () => {
    mocks.getStudents.mockResolvedValue([student, secondActiveStudent, inactiveStudent])
    mocks.adminResetPasswordBulk.mockResolvedValue({
      temporary_password: '12345678',
      results: [
        { user_id: student.user_id, status: 'SUCCESS', password_reset: true, reason_codes: [] },
        { user_id: secondActiveStudent.user_id, status: 'SKIPPED', password_reset: false, reason_codes: ['ACCOUNT_INACTIVE'] },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()
    await getPageOrBody(wrapper, '[data-testid="select-all-active-students"]').setValue(true)
    await getPageOrBody(wrapper, '[data-testid="bulk-reset-students"]').trigger('click')
    await getPageOrBody(wrapper, '[data-testid="confirm-bulk-reset"]').trigger('click')
    await flushPromises()

    expect(mocks.adminResetPasswordBulk).toHaveBeenCalledTimes(1)
    expect(mocks.adminResetPasswordBulk).toHaveBeenCalledWith([student.user_id, secondActiveStudent.user_id])
    const resultDialog = new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"]').find((modal) => modal.text().includes('Kết quả đặt lại mật khẩu'))
    expect(resultDialog).toBeTruthy()
    expect(resultDialog!.text()).toContain('Thành công: 1')
    expect(resultDialog!.text()).toContain('Đã bỏ qua: 1')
    expect(resultDialog!.text()).toContain('Học sinh QA hai')
    expect((resultDialog!.get('#bulk-reset-temporary-password').element as HTMLInputElement).value).toBe('12345678')
    expect(resultDialog!.text()).not.toContain('Học sinh QA nghỉ')
    wrapper.unmount()
  })

  it('clears student selection as soon as the search filter changes', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await getPageOrBody(wrapper, '[aria-label="Chọn Học sinh QA"]').setValue(true)
    expect(wrapper.text()).toContain('1/100 đã chọn')

    await getPageOrBody(wrapper, '#student-search').setValue('QA-S-2')
    await flushPromises()
    expect(wrapper.text()).toContain('0/100 đã chọn')
    expect(getPageOrBody(wrapper, '[data-testid="bulk-reset-students"]').element).toHaveProperty('disabled', true)
    wrapper.unmount()
  })

  it('exports all active rows in the displayed result independently of checkbox selection', async () => {
    const exportedRows = [
      { student_code: student.student_code, full_name: student.full_name, login_email: 'qa-login-1@hvc-edu.local' },
      { student_code: secondActiveStudent.student_code, full_name: secondActiveStudent.full_name, login_email: 'qa-login-2@gmail.test' },
    ]
    mocks.getStudents.mockResolvedValue([student, secondActiveStudent, inactiveStudent])
    mocks.adminExportStudentLogins.mockResolvedValue({ rows: exportedRows, missing_email_count: 0, skipped_count: 0 })
    const pinia = createPinia()
    const wrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()

    await getPageOrBody(wrapper, '[aria-label="Chọn Học sinh QA"]').setValue(true)
    await getPageOrBody(wrapper, '[data-testid="export-student-logins"]').trigger('click')
    await flushPromises()

    expect(mocks.adminExportStudentLogins).toHaveBeenCalledTimes(1)
    expect(mocks.adminExportStudentLogins).toHaveBeenCalledWith([student.user_id, secondActiveStudent.user_id])
    expect(downloadStudentLoginExport).toHaveBeenCalledWith(exportedRows)
    expect(mocks.adminResetPasswordBulk).not.toHaveBeenCalled()
    expect(mocks.adminResetPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('1/100 đã chọn')
    expect(useToastStore(pinia).items.at(-1)?.message).toContain('Đã xuất 2 tài khoản học sinh')
    wrapper.unmount()
  })

  it('exports the complete selected class roster independently of the student search and login export', async () => {
    const pinia = createPinia()
    const wrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()

    expect(getPageOrBody(wrapper, '[data-testid="export-student-class-roster"]').element).toHaveProperty('disabled', true)
    expect(mocks.getClassRosterForExport).not.toHaveBeenCalled()

    await getPageOrBody(wrapper, '#student-search').setValue('không khớp roster')
    await getPageOrBody(wrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    await getPageOrBody(wrapper, '[data-testid="export-student-class-roster"]').trigger('click')
    await flushPromises()

    expect(mocks.getClassRosterForExport).toHaveBeenCalledWith(qaClass.id)
    expect(downloadStudentClassRosterExport).toHaveBeenCalledWith(qaClass.code, [qaClassStudent])
    expect(mocks.adminExportStudentLogins).not.toHaveBeenCalled()
    expect(useToastStore(pinia).items.at(-1)?.message).toContain(`Đã xuất 1 học sinh lớp ${qaClass.name}`)
    wrapper.unmount()
  })

  it('filters the student table by current class membership and combines it with search results', async () => {
    mocks.getStudents.mockImplementation((query = '') => Promise.resolve(query ? [inactiveStudent] : [student, secondActiveStudent, inactiveStudent]))
    mocks.getClassRosterForExport.mockResolvedValue([qaClassStudent, {
      ...qaClassStudent,
      id: inactiveStudent.id,
      student_code: inactiveStudent.student_code,
      full_name: inactiveStudent.full_name,
      status: inactiveStudent.status,
    }])
    const wrapper = mountPage()
    await flushPromises()

    await getPageOrBody(wrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    await flushPromises()
    expect(wrapper.text()).toContain(student.full_name)
    expect(wrapper.text()).toContain(inactiveStudent.full_name)
    expect(wrapper.text()).not.toContain(secondActiveStudent.full_name)
    expect(wrapper.text()).toContain('trong Lớp QA')

    await getPageOrBody(wrapper, '#student-search').setValue('QA-S-2')
    await getPageOrBody(wrapper, 'form[role="search"]').trigger('submit')
    await flushPromises()
    const filteredRows = wrapper.findAll('tbody tr').map((row) => row.text())
    expect(filteredRows).toHaveLength(1)
    expect(filteredRows[0]).toContain(inactiveStudent.student_code)
    expect(filteredRows[0]).not.toContain(student.student_code)
    wrapper.unmount()
  })

  it('previews an XLSX import, keeps name review explicit, retries row failures, and preserves one-time credentials', async () => {
    const file = qaIntakeWorkbook([
      ['QA- Học sinh mới', 'QA-INTAKE-001', '0909990001', 'QA- Phụ huynh', '0909990011'],
      ['QA- Trùng mã', student.student_code, '0909990002', '', ''],
      [student.full_name, 'QA-INTAKE-003', '0909990003', '', ''],
      ['', 'QA-INTAKE-004', '0909990004', '', ''],
    ])
    mocks.adminEnrollStudents
      .mockResolvedValueOnce({ results: [
        { row_number: 2, status: 'CREATED', student_code: 'QA-INTAKE-001', username: 'qa-intake-1', temporary_password: 'QA-one-time-secret-1' },
        { row_number: 4, status: 'FAILED', reason_code: 'STUDENT_CREATE_FAILED' },
      ] })
      .mockResolvedValueOnce({ results: [
        { row_number: 4, status: 'CREATED', student_code: 'QA-INTAKE-003', username: 'qa-intake-2', temporary_password: 'QA-one-time-secret-2' },
      ] })

    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Nhập học nhanh')?.trigger('click')
    await getPageOrBody(wrapper, '#intake-class').setValue(qaClass.id)
    const fileInput = getPageOrBody(wrapper, '#student-intake-file')
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [file] })
    await fileInput.trigger('change')
    await flushPromises()

    expect(new DOMWrapper(document.body).text()).toContain('1 sẽ nhập')
    expect(new DOMWrapper(document.body).text()).toContain('1 trùng, bỏ qua')
    expect(new DOMWrapper(document.body).text()).toContain('1 cần rà soát tên')
    expect(new DOMWrapper(document.body).text()).toContain('1 dòng lỗi')
    const sameNameChoice = new DOMWrapper(document.body).find('.student-intake-preview input[type="checkbox"]')
    await sameNameChoice.setValue(true)
    expect(new DOMWrapper(document.body).text()).toContain('2 sẽ nhập')
    await allButtons(wrapper).find((button) => button.text() === 'Xác nhận nhập 2 học sinh')?.trigger('click')
    await flushPromises()

    expect(mocks.adminEnrollStudents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      class_id: qaClass.id,
      start_date: '2026-10-10',
      students: expect.arrayContaining([
        expect.objectContaining({ row_number: 2, student_code: 'QA-INTAKE-001' }),
        expect.objectContaining({ row_number: 4, student_code: 'QA-INTAKE-003' }),
      ]),
    }))
    expect(new DOMWrapper(document.body).text()).toContain('QA-one-time-secret-1')
    await allButtons(wrapper).find((button) => button.text() === 'Thử lại 1 dòng lỗi')?.trigger('click')
    await flushPromises()

    expect(mocks.adminEnrollStudents).toHaveBeenNthCalledWith(2, expect.objectContaining({
      students: [expect.objectContaining({ row_number: 4, student_code: 'QA-INTAKE-003' })],
    }))
    expect(new DOMWrapper(document.body).text()).toContain('QA-one-time-secret-1')
    expect(new DOMWrapper(document.body).text()).toContain('QA-one-time-secret-2')
    expect(new DOMWrapper(document.body).text()).toContain('QA- Trùng mã')

    await allButtons(wrapper).find((button) => button.text() === 'Đóng')?.trigger('click')
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).not.toContain('QA-one-time-secret-1')
    expect(new DOMWrapper(document.body).text()).not.toContain('QA-one-time-secret-2')
    wrapper.unmount()
  })

  it('shows the correct empty and error states while filtering a class roster', async () => {
    const emptyWrapper = mountPage()
    await flushPromises()
    mocks.getClassRosterForExport.mockResolvedValueOnce([])
    await getPageOrBody(emptyWrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    await flushPromises()
    expect(emptyWrapper.text()).toContain('Chưa có học sinh phù hợp trong lớp')
    expect(emptyWrapper.text()).not.toContain(student.full_name)
    emptyWrapper.unmount()

    const errorWrapper = mountPage()
    await flushPromises()
    mocks.getClassRosterForExport.mockRejectedValueOnce(new Error('QA class filter failure'))
    await getPageOrBody(errorWrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    await flushPromises()
    expect(errorWrapper.text()).toContain('Không thể tải danh sách lớp')
    expect(errorWrapper.text()).toContain('QA class filter failure')
    errorWrapper.unmount()
  })

  it('does not create a workbook for an empty roster and reports roster query errors', async () => {
    const pinia = createPinia()
    const emptyWrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await getPageOrBody(emptyWrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    mocks.getClassRosterForExport.mockResolvedValueOnce([])
    await getPageOrBody(emptyWrapper, '[data-testid="export-student-class-roster"]').trigger('click')
    await flushPromises()
    expect(downloadStudentClassRosterExport).not.toHaveBeenCalled()
    expect(useToastStore(pinia).items.at(-1)?.message).toContain('Chưa tạo tệp Excel')
    emptyWrapper.unmount()

    const errorPinia = createPinia()
    const errorWrapper = track(mount(StudentsPage, { global: { plugins: [errorPinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await getPageOrBody(errorWrapper, '[data-testid="student-export-class"]').setValue(qaClass.id)
    mocks.getClassRosterForExport.mockRejectedValueOnce(new Error('QA class roster failure'))
    await getPageOrBody(errorWrapper, '[data-testid="export-student-class-roster"]').trigger('click')
    await flushPromises()
    expect(downloadStudentClassRosterExport).not.toHaveBeenCalled()
    expect(useToastStore(errorPinia).items.at(-1)?.message).toContain('QA class roster failure')
    errorWrapper.unmount()
  })

  it('keeps a blank email and warns when an email is missing or a row became inactive', async () => {
    mocks.adminExportStudentLogins.mockResolvedValue({
      rows: [{ student_code: student.student_code, full_name: student.full_name, login_email: null }],
      missing_email_count: 1,
      skipped_count: 1,
    })
    const pinia = createPinia()
    const wrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await getPageOrBody(wrapper, '[data-testid="export-student-logins"]').trigger('click')
    await flushPromises()

    expect(downloadStudentLoginExport).toHaveBeenCalledWith([
      { student_code: student.student_code, full_name: student.full_name, login_email: null },
    ])
    const warning = useToastStore(pinia).items.at(-1)?.message || ''
    expect(warning).toContain('1 hồ sơ không còn ACTIVE đã được bỏ qua')
    expect(warning).toContain('1 tài khoản thiếu email Auth, ô email được để trống')
    wrapper.unmount()
  })

  it('disables export when there are no active results and reports endpoint failures', async () => {
    mocks.getStudents.mockResolvedValue([inactiveStudent])
    const wrapper = mountPage()
    await flushPromises()
    expect(getPageOrBody(wrapper, '[data-testid="export-student-logins"]').element).toHaveProperty('disabled', true)
    expect(mocks.adminExportStudentLogins).not.toHaveBeenCalled()
    wrapper.unmount()

    const pinia = createPinia()
    mocks.getStudents.mockResolvedValue([student])
    mocks.adminExportStudentLogins.mockRejectedValueOnce(new Error('QA export failure'))
    const errorWrapper = track(mount(StudentsPage, { global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } } }))
    await flushPromises()
    await getPageOrBody(errorWrapper, '[data-testid="export-student-logins"]').trigger('click')
    await flushPromises()
    expect(useToastStore(pinia).items.at(-1)?.message).toContain('QA export failure')
    expect(downloadStudentLoginExport).not.toHaveBeenCalled()
    errorWrapper.unmount()
  })

  it('sends an optional initial password without showing it as a generated password', async () => {
    const suppliedPassword = `QA-${crypto.randomUUID()}`
    mocks.adminCreateUser.mockResolvedValue({ temporary_password: suppliedPassword })
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh mới')
    await getPageOrBody(wrapper, '#student-password').setValue(suppliedPassword)
    expect((getPageOrBody(wrapper, '#student-password').element as HTMLInputElement).type).toBe('password')
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect(mocks.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'STUDENT', password: suppliedPassword }))
    expect(findAllPageOrBody(wrapper, '.app-modal[aria-hidden="false"]')).toHaveLength(0)
  })

  it('clears the initial password after a failed create and leaves existing profile updates separate', async () => {
    const suppliedPassword = `QA-${crypto.randomUUID()}`
    mocks.adminCreateUser.mockRejectedValueOnce(new Error('QA simulated create failure'))
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Thêm học sinh')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name').setValue('QA Học sinh mới')
    await getPageOrBody(wrapper, '#student-password').setValue(suppliedPassword)
    await allButtons(wrapper).find((button) => button.text() === 'Tạo tài khoản')?.trigger('click')
    await flushPromises()

    expect((getPageOrBody(wrapper, '#student-password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('QA simulated create failure')
    expect(wrapper.text()).not.toContain(suppliedPassword)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await allButtons(wrapper).find((button) => button.text() === 'Hủy')?.trigger('click')
    confirmSpy.mockRestore()
    await wrapper.findAll('button').find((button) => button.text() === 'Sửa')?.trigger('click')
    await getPageOrBody(wrapper, '#student-name-edit').setValue('QA Học sinh đã cập nhật')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu thay đổi')?.trigger('click')
    await flushPromises()
    expect(mocks.updateStudent).toHaveBeenCalledWith('qa-student-1', expect.objectContaining({ full_name: 'QA Học sinh đã cập nhật' }))
    expect(mocks.adminCreateUser).toHaveBeenCalledTimes(1)
  })

  it('confirms archive with the affected student before sending the archive command', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await allButtons(wrapper).find((button) => button.text() === 'Lưu trữ')?.trigger('click')
    expect(mocks.archiveStudent).not.toHaveBeenCalled()
    expect(`${wrapper.text()} ${document.body.textContent || ''}`).toContain('Học sinh QA · QA-S-1')
    await allButtons(wrapper).find((button) => button.text() === 'Lưu trữ học sinh')?.trigger('click')
    await flushPromises()
    expect(mocks.archiveStudent).toHaveBeenCalledWith('qa-student-1')
  })

  it('shows the fixed password after resetting a student account', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const resetButton = allButtons(wrapper).find((button) => button.text() === 'Đặt lại mật khẩu')
    await resetButton?.trigger('click')
    expect(new DOMWrapper(document.body).text()).toContain('Mật khẩu sẽ được đặt lại thành 12345678')
    expect(new DOMWrapper(document.body).text()).toContain('cần đổi mật khẩu này trước khi sử dụng cổng học tập')
    const confirmButton = new DOMWrapper(document.body).findAll('.app-modal[aria-hidden="false"] button').find((button) => button.text() === 'Đặt lại mật khẩu')
    await confirmButton?.trigger('click')
    await flushPromises()

    expect(mocks.adminResetPassword).toHaveBeenCalledWith('qa-user-1')
    expect((new DOMWrapper(document.body).get('#temporary-password').element as HTMLInputElement).value).toBe('12345678')
    expect(new DOMWrapper(document.body).text()).toContain('sẽ cần đổi mật khẩu ở lần đăng nhập kế tiếp')
  })
})
