import {
  processStudentIntakeBatch,
  type StudentIntakeCandidate,
  type StudentIntakeDependencies,
  type StudentIntakeExistingStudent,
} from './student-intake-handler.ts'

const QA_CLASS_ID = '00000000-0000-4000-8000-000000000001'
const QA_ADMIN_ID = '00000000-0000-4000-8000-000000000099'
const admin = { user: { id: QA_ADMIN_ID }, profile: { role: 'ADMIN' } }

function candidate(overrides: Partial<StudentIntakeCandidate> = {}): StudentIntakeCandidate {
  return {
    row_number: 2,
    full_name: 'QA Học sinh mới',
    student_code: '',
    phone: '',
    parent_name: '',
    parent_phone: '',
    ...overrides,
  }
}

function batch(students: StudentIntakeCandidate[]) {
  return {
    operation: 'batch_student_intake',
    class_id: QA_CLASS_ID,
    start_date: '2026-10-10',
    students,
  }
}

function dependencies(overrides: Partial<StudentIntakeDependencies> = {}) {
  const calls = {
    permissions: [] as string[],
    create: [] as Array<StudentIntakeCandidate & { class_id: string; start_date: string }>,
  }
  const existing: StudentIntakeExistingStudent[] = []
  const deps: StudentIntakeDependencies = {
    todayDate: () => '2026-10-10',
    hasPermission: async (_userId, permission) => {
      calls.permissions.push(permission)
      return true
    },
    isActiveClass: async () => true,
    getExistingStudents: async () => existing,
    createStudent: async (input) => {
      calls.create.push(input)
      if (input.full_name === 'QA Học sinh lỗi') throw Object.assign(new Error('failed'), { code: 'STUDENT_CREATE_FAILED' })
      return {
        student_code: input.student_code || `QA-GENERATED-${input.row_number}`,
        username: `qa-user-${input.row_number}`,
        temporary_password: `QA-temp-${input.row_number}`,
      }
    },
    ...overrides,
  }
  return { calls, existing, deps }
}

Deno.test('checks both management permissions and assigns each new student to the selected class', async () => {
  const { calls, deps } = dependencies()
  const outcome = await processStudentIntakeBatch(admin, batch([candidate({ student_code: 'qa-001', phone: '+84 912 345 678' })]), deps)

  if (!outcome.ok) throw new Error('authorized import should be accepted')
  if (calls.permissions.join(',') !== 'STUDENTS_MANAGE,CLASS_MANAGE') throw new Error('both management permissions should be checked')
  if (calls.create.length !== 1 || calls.create[0].class_id !== QA_CLASS_ID) throw new Error('new student should receive the selected class')
  if (calls.create[0].start_date !== '2026-10-10' || calls.create[0].student_code !== 'QA-001') throw new Error('server input should use the supplied date and normalized code')
  if (outcome.results[0].status !== 'CREATED') throw new Error('new student should be created')
})

Deno.test('skips existing and repeated student codes or phones without changing existing profiles', async () => {
  const existing = [{ student_code: 'QA-OLD-1', full_name: 'QA Đã có', phone: '0912345678' }]
  const { calls, deps } = dependencies({ getExistingStudents: async () => existing })
  const outcome = await processStudentIntakeBatch(admin, batch([
    candidate({ row_number: 2, student_code: 'qa-old-1', phone: '' }),
    candidate({ row_number: 3, student_code: 'QA-NEW-2', phone: '+84 912 345 678' }),
    candidate({ row_number: 4, student_code: 'QA-NEW-3', phone: '0900000003' }),
    candidate({ row_number: 5, student_code: 'QA-NEW-4', phone: '+84 900 000 003' }),
  ]), deps)

  if (!outcome.ok) throw new Error('authorized import should be accepted')
  if (outcome.results[0].status !== 'SKIPPED' || outcome.results[0].reason_code !== 'STUDENT_CODE_ALREADY_EXISTS') throw new Error('normalized existing code should be skipped')
  if (outcome.results[1].status !== 'SKIPPED' || outcome.results[1].reason_code !== 'STUDENT_PHONE_ALREADY_EXISTS') throw new Error('normalized existing phone should be skipped')
  if (outcome.results[2].status !== 'CREATED' || outcome.results[3].status !== 'SKIPPED' || calls.create.length !== 1) {
    throw new Error('phone duplicates within the batch should be skipped after the first row')
  }
})

Deno.test('returns row-level outcomes and continues after a creation failure', async () => {
  const { calls, deps } = dependencies()
  const outcome = await processStudentIntakeBatch(admin, batch([
    candidate({ row_number: 2, full_name: 'QA Học sinh lỗi' }),
    candidate({ row_number: 3, full_name: 'QA Học sinh thành công' }),
  ]), deps)

  if (!outcome.ok) throw new Error('authorized import should be accepted')
  if (outcome.results[0].status !== 'FAILED') throw new Error('failed row should be reported')
  if (outcome.results[1].status !== 'CREATED') throw new Error('later rows should continue')
  if (calls.create.length !== 2) throw new Error('each eligible row should be attempted once')
})

Deno.test('surfaces rollback failures per row without inviting an unsafe automatic retry', async () => {
  const { deps } = dependencies({
    createStudent: async () => { throw Object.assign(new Error('cleanup failed'), { code: 'ACCOUNT_ROLLBACK_FAILED' }) },
  })
  const outcome = await processStudentIntakeBatch(admin, batch([candidate()]), deps)
  if (!outcome.ok || outcome.results[0].status !== 'FAILED' || outcome.results[0].reason_code !== 'ACCOUNT_ROLLBACK_FAILED') {
    throw new Error('rollback failure should be reported on its source row')
  }
})

Deno.test('rejects missing permissions, inactive classes, and oversized batches before creation', async () => {
  const { calls, deps } = dependencies({ hasPermission: async () => false })
  const forbidden = await processStudentIntakeBatch(admin, batch([candidate()]), deps)
  if (forbidden.ok || forbidden.status !== 403 || calls.create.length) throw new Error('missing permission should block all account creation')

  const inactive = await processStudentIntakeBatch(admin, batch([candidate()]), dependencies({ isActiveClass: async () => false }).deps)
  if (inactive.ok || inactive.code !== 'CLASS_NOT_ACTIVE') throw new Error('inactive class should be rejected')

  const tooMany = await processStudentIntakeBatch(admin, batch(Array.from({ length: 101 }, (_, index) => candidate({ row_number: index + 2 }))), dependencies().deps)
  if (tooMany.ok || tooMany.code !== 'INVALID_INPUT') throw new Error('over-limit batch should be rejected')
})

Deno.test('requires the HCMC business date as the membership start date', async () => {
  const { calls, deps } = dependencies()
  const stale = await processStudentIntakeBatch(admin, { ...batch([candidate()]), start_date: '2026-10-09' }, deps)
  if (stale.ok || stale.code !== 'START_DATE_MUST_BE_TODAY' || calls.create.length) {
    throw new Error('stale client dates should be rejected before creation')
  }
})

Deno.test('allows ROOT_ADMIN without permission lookups', async () => {
  const { calls, deps } = dependencies()
  const root = { user: { id: QA_ADMIN_ID }, profile: { role: 'ROOT_ADMIN' } }
  const outcome = await processStudentIntakeBatch(root, batch([candidate()]), deps)
  if (!outcome.ok || calls.permissions.length !== 0) throw new Error('ROOT_ADMIN should pass without extra permission lookups')
})
