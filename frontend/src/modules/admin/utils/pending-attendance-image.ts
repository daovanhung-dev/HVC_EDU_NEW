export interface PendingAttendanceImageRow {
  dateLabel: string
  className: string
  timeLabel: string
  teacherNames: string
  room: string
  missingStudentCount: number
}

export interface PendingAttendanceImageInput {
  scopeLabel: string
  exportDateLabel: string
  exportDate: string
  rows: PendingAttendanceImageRow[]
}

const imageWidth = 1440
const pagePadding = 44
const cellPaddingX = 12
const cellPaddingY = 12
const lineHeight = 22

function splitLongWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''

  for (const character of Array.from(word)) {
    const candidate = line + character
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = character
    } else {
      line = candidate
    }
  }

  if (line) lines.push(line)
  return lines
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = value.split(/\r?\n/u)

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) lines.push(line)
        const fragments = splitLongWord(ctx, word, maxWidth)
        lines.push(...fragments.slice(0, -1))
        line = fragments.at(-1) || ''
        continue
      }

      const candidate = line ? `${line} ${word}` : word
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
  }

  return lines.length ? lines : ['—']
}

function colorToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function fileDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : 'export'
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Không thể tạo ảnh PNG. Hãy thử lại.'))
    }, 'image/png')
  })
}

export async function downloadPendingAttendancePng(input: PendingAttendanceImageInput): Promise<void> {
  if (!input.rows.length) throw new Error('Không có buổi học còn thiếu điểm danh để xuất.')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo ảnh. Hãy thử tải lại trang.')

  const fontFamily = getComputedStyle(document.body).fontFamily || 'Arial, sans-serif'
  const primary = colorToken('--color-primary', '#0e6f7b')
  const text = colorToken('--color-text', '#1d2c2f')
  const secondary = colorToken('--color-text-secondary', '#506266')
  const border = colorToken('--color-border', '#d5dfdd')
  const surface = colorToken('--color-surface', '#ffffff')
  const subtle = colorToken('--color-surface-subtle', '#f8fbfa')
  const innerWidth = imageWidth - pagePadding * 2
  const columnWidths = [140, 260, 210, 315, 205, 222]
  const headers = ['Ngày', 'Lớp', 'Thời gian', 'Giáo viên', 'Phòng', 'Học sinh thiếu']
  const rowValues = input.rows.map((row) => [
    row.dateLabel,
    row.className,
    row.timeLabel,
    row.teacherNames,
    row.room,
    `${row.missingStudentCount} em`,
  ])

  ctx.font = `600 15px ${fontFamily}`
  const headerLines = headers.map((header, index) => wrapText(ctx, header, columnWidths[index] - cellPaddingX * 2))
  const headerHeight = Math.max(52, ...headerLines.map((lines) => lines.length * lineHeight + cellPaddingY * 2))

  const wrappedRows = rowValues.map((values) => {
    const lines = values.map((value, index) => {
      ctx.font = index === 1 ? `600 15px ${fontFamily}` : `400 14px ${fontFamily}`
      return wrapText(ctx, value, columnWidths[index] - cellPaddingX * 2)
    })
    return { lines, height: Math.max(54, ...lines.map((items) => items.length * lineHeight + cellPaddingY * 2)) }
  })

  const titleHeight = 128
  const footerHeight = 54
  const imageHeight = pagePadding + titleHeight + headerHeight + wrappedRows.reduce((sum, row) => sum + row.height, 0) + footerHeight
  if (imageHeight > 32767) {
    throw new Error('Danh sách quá dài để xuất thành một ảnh. Hãy lọc theo lớp rồi thử lại.')
  }

  canvas.width = imageWidth
  canvas.height = imageHeight
  ctx.fillStyle = subtle
  ctx.fillRect(0, 0, imageWidth, imageHeight)
  ctx.fillStyle = surface
  ctx.fillRect(pagePadding, pagePadding, innerWidth, imageHeight - pagePadding * 2)

  ctx.fillStyle = primary
  ctx.fillRect(pagePadding, pagePadding, 8, 78)
  ctx.fillStyle = text
  ctx.textBaseline = 'top'
  ctx.font = `700 30px ${fontFamily}`
  ctx.fillText('Buổi học chưa đủ điểm danh', pagePadding + 24, pagePadding + 3)
  ctx.font = `500 16px ${fontFamily}`
  ctx.fillStyle = secondary
  ctx.fillText(`${input.scopeLabel} · Xuất ngày ${input.exportDateLabel}`, pagePadding + 24, pagePadding + 50)
  ctx.font = `500 13px ${fontFamily}`
  ctx.fillText(`${input.rows.length} buổi học · ${input.rows.reduce((sum, row) => sum + row.missingStudentCount, 0)} học sinh còn thiếu`, pagePadding + 24, pagePadding + 80)

  let y = pagePadding + titleHeight
  ctx.fillStyle = primary
  ctx.fillRect(pagePadding, y, innerWidth, headerHeight)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  let x = pagePadding
  headers.forEach((_, index) => {
    const lines = headerLines[index]
    const totalHeight = lines.length * lineHeight
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, x + cellPaddingX, y + headerHeight / 2 - totalHeight / 2 + lineIndex * lineHeight + lineHeight / 2)
    })
    x += columnWidths[index]
  })

  y += headerHeight
  ctx.textBaseline = 'top'
  wrappedRows.forEach((row, rowIndex) => {
    ctx.fillStyle = rowIndex % 2 === 0 ? surface : subtle
    ctx.fillRect(pagePadding, y, innerWidth, row.height)
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pagePadding, y + row.height)
    ctx.lineTo(pagePadding + innerWidth, y + row.height)
    ctx.stroke()

    x = pagePadding
    row.lines.forEach((lines, columnIndex) => {
      ctx.font = columnIndex === 1 ? `600 15px ${fontFamily}` : `400 14px ${fontFamily}`
      ctx.fillStyle = text
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + cellPaddingX, y + cellPaddingY + lineIndex * lineHeight)
      })
      x += columnWidths[columnIndex]
    })
    y += row.height
  })

  const blob = await canvasBlob(canvas)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `buoi-chua-du-diem-danh-${fileDate(input.exportDate)}.png`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
