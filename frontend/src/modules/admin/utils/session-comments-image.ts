import type { AttendanceStudentRow } from '@/modules/staff/attendance'
import { attendanceStatusLabel } from '@/modules/staff/attendance'

export interface SessionCommentsImageRow {
  fullName: string
  attendance: string
  homeworkScore: string
  comment: string
}

export interface SessionCommentsImageInput {
  className: string
  dateLabel: string
  rows: SessionCommentsImageRow[]
}

const imageWidth = 1440
const pagePadding = 44
const cellPaddingX = 14
const cellPaddingY = 13
const lineHeight = 23

export function toSessionCommentsImageRows(rows: AttendanceStudentRow[]): SessionCommentsImageRow[] {
  return rows.map((row) => {
    const attendance = row.initialAttendance
    const score = attendance.homework_score

    return {
      fullName: row.students?.full_name?.trim() || '—',
      attendance: attendance.status ? attendanceStatusLabel(attendance.status) : '—',
      homeworkScore: score === null || score === undefined ? '—' : `${score}/10`,
      comment: attendance.comment.trim() || '—',
    }
  })
}

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
  const paragraphs = value.split(/\r?\n/u)
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) {
          lines.push(line)
          line = ''
        }
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

function fileSlug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'buoi-hoc'
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Không thể tạo ảnh PNG. Hãy thử lại.'))
    }, 'image/png')
  })
}

export async function downloadSessionCommentsPng(input: SessionCommentsImageInput): Promise<void> {
  if (!input.rows.length) throw new Error('Buổi học chưa có dữ liệu nhận xét để xuất.')

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
  const columnWidths = [250, 210, 150, innerWidth - 610]
  const headers = ['Họ tên', 'Điểm danh', 'Điểm BTVN', 'Nhận xét']
  const rowValues = input.rows.map((row) => [row.fullName, row.attendance, row.homeworkScore, row.comment])

  ctx.font = `600 15px ${fontFamily}`
  const headerLines = headers.map((header, index) => wrapText(ctx, header, columnWidths[index] - cellPaddingX * 2))
  const headerHeight = Math.max(52, ...headerLines.map((lines) => lines.length * lineHeight + cellPaddingY * 2))

  const wrappedRows = rowValues.map((values) => {
    const lines = values.map((value, index) => {
      ctx.font = index === 0 ? `600 16px ${fontFamily}` : `400 15px ${fontFamily}`
      return wrapText(ctx, value, columnWidths[index] - cellPaddingX * 2)
    })
    return { lines, height: Math.max(62, ...lines.map((items) => items.length * lineHeight + cellPaddingY * 2)) }
  })

  const titleHeight = 142
  const footerHeight = 62
  const imageHeight = pagePadding + titleHeight + headerHeight + wrappedRows.reduce((sum, row) => sum + row.height, 0) + footerHeight
  canvas.width = imageWidth
  canvas.height = imageHeight

  ctx.fillStyle = subtle
  ctx.fillRect(0, 0, imageWidth, imageHeight)
  ctx.fillStyle = surface
  ctx.fillRect(pagePadding, pagePadding, innerWidth, imageHeight - pagePadding * 2)

  ctx.fillStyle = primary
  ctx.fillRect(pagePadding, pagePadding, 8, 80)
  ctx.fillStyle = text
  ctx.font = `700 30px ${fontFamily}`
  ctx.textBaseline = 'top'
  ctx.fillText('Nhận xét buổi học', pagePadding + 24, pagePadding + 3)
  ctx.font = `500 17px ${fontFamily}`
  ctx.fillStyle = secondary
  ctx.fillText(`${input.className} · ${input.dateLabel}`, pagePadding + 24, pagePadding + 48)
  ctx.font = `500 13px ${fontFamily}`
  ctx.fillText(`${input.rows.length} học sinh`, pagePadding + 24, pagePadding + 83)

  let y = pagePadding + titleHeight
  ctx.fillStyle = primary
  ctx.fillRect(pagePadding, y, innerWidth, headerHeight)
  let x = pagePadding
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  headers.forEach((header, index) => {
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
      ctx.font = columnIndex === 0 ? `600 16px ${fontFamily}` : `400 15px ${fontFamily}`
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
  anchor.download = `nhan-xet-${fileSlug(input.className)}-${new Date().toISOString().slice(0, 10)}.png`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
