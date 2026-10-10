export const MAX_MONTH_WEEK_SCHEDULE_SLOTS = 100

export const MONTH_WEEK_SCHEDULE_HEADERS = [
  'Mã mẫu (giữ nguyên)',
  'Thứ',
  'Mã lớp',
  'Giờ bắt đầu',
  'Giờ kết thúc',
  'Phòng',
  'Mã giáo viên (;)',
] as const

export const MONTH_WEEKDAY_LABELS = [
  'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật',
] as const

export interface MonthWeekScheduleSlot {
  source_row_number?: number
  slot_id: string
  day_of_week: number
  class_id: string
  start_time: string
  end_time: string
  room: string
  staff_ids: string[]
  source_schedule_id?: string | null
}

export interface MonthWeekScheduleExportSlot extends MonthWeekScheduleSlot {
  class_code: string
  teacher_codes: string[]
}

export interface MonthWeekScheduleParseIssue {
  row_number: number
  message: string
}

export interface MonthWeekScheduleParseResult {
  month_start: string
  slots: MonthWeekScheduleSlot[]
  issues: MonthWeekScheduleParseIssue[]
}

export interface MonthWeekScheduleLookup {
  classes: Array<{ id: string; code: string; status: string }>
  teachers: Array<{ id: string; staff_code: string | null; status: string; staff_type?: string }>
}

function cellText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim()
  return ''
}

function normalizedCode(value: string): string {
  return value.trim().toLocaleUpperCase('vi-VN')
}

function createStableSlotId(seed: string): string {
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index)
    for (let position = 0; position < hashes.length; position += 1) {
      hashes[position] = Math.imul(hashes[position] ^ (code + position * 31), 0x01000193 + position * 2) >>> 0
    }
  }
  const hex = hashes.map((value) => value.toString(16).padStart(8, '0')).join('').split('')
  hex[12] = '5'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function normalizeTime(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60) % (24 * 60)
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
  }
  const text = cellText(value)
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/u)
  if (!match) return ''
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseWeekday(value: unknown): number | null {
  const text = cellText(value).toLocaleLowerCase('vi-VN').replace(/\s+/gu, ' ')
  const labelIndex = MONTH_WEEKDAY_LABELS.findIndex((label) => label.toLocaleLowerCase('vi-VN') === text)
  if (labelIndex >= 0) return labelIndex + 1
  if (/^[1-7]$/u.test(text)) return Number(text)
  const aliases: Record<string, number> = {
    't2': 1, 'thứ 2': 1, 't3': 2, 'thứ 3': 2, 't4': 3, 'thứ 4': 3,
    't5': 4, 'thứ 5': 4, 't6': 5, 'thứ 6': 5, 't7': 6, 'thứ 7': 6,
    'cn': 7, 'chủ nhật': 7,
  }
  return aliases[text] || null
}

export async function parseMonthWeekScheduleWorkbook(
  file: File,
  expectedMonthStart: string,
  lookup: MonthWeekScheduleLookup,
): Promise<MonthWeekScheduleParseResult> {
  if (!/\.xlsx$/iu.test(file.name)) throw new Error('Chỉ nhận biểu mẫu Excel .xlsx.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Tệp vượt quá giới hạn 10 MB.')

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  if (!workbook.SheetNames.includes('Mẫu tuần') || !workbook.SheetNames.includes('Hướng dẫn')) {
    throw new Error('Tệp cần có hai trang tính “Mẫu tuần” và “Hướng dẫn”. Hãy tải mẫu mới nhất rồi nhập lại.')
  }
  const instructions = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Hướng dẫn'], { header: 1, defval: '', raw: false })
  const fileMonth = cellText(instructions[0]?.[1])
  const expectedMonth = expectedMonthStart.slice(0, 7)
  if (!/^\d{4}-\d{2}$/u.test(fileMonth)) throw new Error('Không đọc được tháng áp dụng trong trang “Hướng dẫn”.')
  if (fileMonth !== expectedMonth) throw new Error(`Mẫu áp dụng cho ${fileMonth}, còn trang đang mở là ${expectedMonth}. Hãy tải lại mẫu cho đúng tháng.`)

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Mẫu tuần'], { header: 1, defval: '', raw: true })
  const headers = (matrix[0] || []).map(cellText)
  const headerIndexes = MONTH_WEEK_SCHEDULE_HEADERS.map((header) => headers.indexOf(header))
  if (headerIndexes.some((index) => index < 0)) {
    throw new Error('Không nhận diện được tiêu đề cột. Hãy giữ nguyên hàng tiêu đề của mẫu lịch tháng.')
  }

  const rawRows = matrix.slice(1).flatMap((cells, index) => {
    const values = headerIndexes.map((columnIndex) => cells[columnIndex])
    if (values.slice(1).every((value) => !cellText(value))) return []
    return [{ row_number: index + 2, values }]
  })
  if (rawRows.length > MAX_MONTH_WEEK_SCHEDULE_SLOTS) {
    throw new Error(`Mỗi lần chỉ nhập tối đa ${MAX_MONTH_WEEK_SCHEDULE_SLOTS} dòng lịch tuần.`)
  }
  if (!rawRows.length) throw new Error('Biểu mẫu chưa có dòng lịch tuần nào.')

  const classByCode = new Map(lookup.classes.filter((row) => row.status === 'ACTIVE').map((row) => [normalizedCode(row.code), row]))
  const teacherByCode = new Map(lookup.teachers
    .filter((row) => row.status === 'ACTIVE' && (!row.staff_type || row.staff_type === 'TEACHER') && row.staff_code)
    .map((row) => [normalizedCode(row.staff_code || ''), row]))
  const slots: MonthWeekScheduleSlot[] = []
  const issues: MonthWeekScheduleParseIssue[] = []
  const seenSlotIds = new Set<string>()

  for (const { row_number, values } of rawRows) {
    const [slotValue, weekdayValue, classCodeValue, startValue, endValue, roomValue, teachersValue] = values
    const errors: string[] = []
    const slotIdText = cellText(slotValue)
    const slotId = slotIdText || createStableSlotId(`${expectedMonthStart}:${row_number}`)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(slotId)) {
      errors.push('Mã mẫu phải là UUID hợp lệ; không sửa mã của dòng đã có.')
    } else if (seenSlotIds.has(slotId.toLowerCase())) {
      errors.push('Mã mẫu bị lặp trong tệp.')
    }
    seenSlotIds.add(slotId.toLowerCase())

    const day = parseWeekday(weekdayValue)
    if (!day) errors.push('Thứ phải từ Thứ Hai đến Chủ nhật.')
    const classCode = normalizedCode(cellText(classCodeValue))
    const classRow = classByCode.get(classCode)
    if (!classCode) errors.push('Thiếu mã lớp.')
    else if (!classRow) errors.push(`Không tìm thấy lớp đang hoạt động có mã “${cellText(classCodeValue)}”.`)
    const startTime = normalizeTime(startValue)
    const endTime = normalizeTime(endValue)
    if (!startTime) errors.push('Giờ bắt đầu không hợp lệ; dùng HH:mm.')
    if (!endTime) errors.push('Giờ kết thúc không hợp lệ; dùng HH:mm.')
    if (startTime && endTime && endTime <= startTime) errors.push('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.')

    const teacherCodes = [...new Set(cellText(teachersValue).split(';').map((code) => normalizedCode(code)).filter(Boolean))]
    if (!teacherCodes.length) errors.push('Cần ít nhất một mã giáo viên.')
    if (teacherCodes.length > 5) errors.push('Mỗi buổi tối đa 5 giáo viên.')
    const teacherRows = teacherCodes.map((code) => teacherByCode.get(code))
    const missingTeachers = teacherCodes.filter((_, index) => !teacherRows[index])
    if (missingTeachers.length) errors.push(`Không tìm thấy giáo viên đang hoạt động: ${missingTeachers.join(', ')}.`)

    if (errors.length) {
      issues.push({ row_number, message: errors.join(' ') })
      continue
    }
    slots.push({
      source_row_number: row_number,
      slot_id: slotId,
      day_of_week: day as number,
      class_id: classRow!.id,
      start_time: startTime,
      end_time: endTime,
      room: cellText(roomValue),
      staff_ids: teacherRows.map((row) => row!.id),
      source_schedule_id: slotId,
    })
  }
  return { month_start: expectedMonthStart, slots, issues }
}

export async function downloadMonthWeekScheduleTemplate(monthStart: string, slots: MonthWeekScheduleExportSlot[]) {
  if (slots.length > MAX_MONTH_WEEK_SCHEDULE_SLOTS) {
    throw new Error(`Mẫu lịch vượt quá giới hạn ${MAX_MONTH_WEEK_SCHEDULE_SLOTS} dòng.`)
  }
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const rows: unknown[][] = [
    [...MONTH_WEEK_SCHEDULE_HEADERS],
    ...slots.map((slot) => [
      slot.slot_id,
      MONTH_WEEKDAY_LABELS[slot.day_of_week - 1] || '',
      slot.class_code,
      slot.start_time.slice(0, 5),
      slot.end_time.slice(0, 5),
      slot.room,
      slot.teacher_codes.join('; '),
    ]),
  ]
  for (let index = slots.length; index < MAX_MONTH_WEEK_SCHEDULE_SLOTS; index += 1) {
    rows.push([createStableSlotId(`${monthStart}:${index + 2}`), '', '', '', '', '', ''])
  }
  const scheduleSheet = XLSX.utils.aoa_to_sheet(rows)
  scheduleSheet['!cols'] = [{ wch: 38 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 42 }]
  scheduleSheet['!autofilter'] = { ref: `A1:G${MAX_MONTH_WEEK_SCHEDULE_SLOTS + 1}` }
  XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Mẫu tuần')

  const instructionSheet = XLSX.utils.aoa_to_sheet([
    ['Tháng áp dụng', monthStart.slice(0, 7)],
    ['Mục', 'Hướng dẫn'],
    ['Cách dùng', 'Mỗi dòng là một buổi trong tuần; lịch áp dụng cho mọi ngày cùng thứ trong tháng ghi ở trên.'],
    ['Thứ', 'Dùng Thứ Hai, Thứ Ba, Thứ Tư, Thứ Năm, Thứ Sáu, Thứ Bảy hoặc Chủ nhật.'],
    ['Mã lớp', 'Nhập mã lớp đang hoạt động. Không nhập tên lớp.'],
    ['Giờ', 'Dùng HH:mm theo giờ Việt Nam; giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.'],
    ['Mã giáo viên', 'Nhập mã giáo viên đang hoạt động; nếu nhiều người, phân cách bằng dấu chấm phẩy (;).'],
    ['Mã mẫu', 'Giữ nguyên UUID ở các dòng có sẵn. Để trống mã mẫu ở dòng mới để hệ thống tự tạo.'],
    ['Áp dụng', 'Nhập sẽ tạo buổi điểm danh bù ở ngày đã qua trong tháng. Không thay lịch lặp cho tháng sau.'],
    ['An toàn', 'Trước khi lưu, hệ thống kiểm tra toàn bộ tháng. Nếu có lỗi hoặc xung đột thì không dòng nào được áp dụng.'],
    ['Số dòng', `Tối đa ${MAX_MONTH_WEEK_SCHEDULE_SLOTS} dòng lịch tuần.`],
  ])
  instructionSheet['!cols'] = [{ wch: 24 }, { wch: 105 }]
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Hướng dẫn')
  XLSX.writeFileXLSX(workbook, `mau-lich-tuan-${monthStart.slice(0, 7)}.xlsx`)
}
