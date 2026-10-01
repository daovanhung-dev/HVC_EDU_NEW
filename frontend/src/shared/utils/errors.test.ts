import { describe, expect, it } from 'vitest'
import { normalizeAppError } from './errors'

describe('error normalization', () => {
  it('maps a forbidden domain error to a safe Vietnamese message', () => {
    const result = normalizeAppError({ code: 'FORBIDDEN', message: 'raw database detail', trace_id: 'trace-1' }, 'fallback')

    expect(result.message).toBe('Bạn không có quyền thực hiện thao tác này.')
    expect(result.traceId).toBe('trace-1')
    expect(result.message).not.toContain('raw database detail')
  })

  it('maps session and staff domain errors', () => {
    expect(normalizeAppError(new Error('SESSION_TEACHER_REQUIRED')).message).toContain('Chỉ giáo viên')
    expect(normalizeAppError(new Error('STAFF_NOT_FOUND')).message).toContain('hồ sơ nhân sự')
  })

  it('maps rejected credentials to the credential message instead of expired session', () => {
    const result = normalizeAppError({ code: 'INVALID_CREDENTIALS', status: 401, message: 'Unauthorized' }, 'fallback')

    expect(result.message).toBe('Tài khoản hoặc mật khẩu không đúng.')
    expect(result.code).toBe('INVALID_CREDENTIALS')
  })

  it('uses the expired-session message only for unauthenticated or unclassified 401 errors', () => {
    expect(normalizeAppError({ code: 'UNAUTHENTICATED', status: 401 }, 'fallback').message)
      .toBe('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    expect(normalizeAppError({ status: 401 }, 'fallback').message)
      .toBe('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    expect(normalizeAppError({ code: 'NEW_DOMAIN_ERROR', status: 401 }, 'Không thể đăng nhập.').message)
      .toBe('Không thể đăng nhập.')
  })

  it('maps the database class teacher limit to a useful validation message', () => {
    const result = normalizeAppError({ code: 'P0001', message: 'CLASS_TEACHER_LIMIT' }, 'Không thể phân công.')
    expect(result.message).toContain('tối đa 5 giáo viên')
    expect(result.code).toBe('CLASS_TEACHER_LIMIT')
  })

  it('explains missing and occupied rooms for overlapping sessions', () => {
    expect(normalizeAppError(new Error('ROOM_REQUIRED_FOR_OVERLAP')).message).toContain('nhập phòng cho cả hai lớp')
    expect(normalizeAppError(new Error('ROOM_ALREADY_BOOKED')).message).toContain('Phòng này đã có buổi học khác')
  })

  it('uses a contextual fallback for unknown errors', () => {
    expect(normalizeAppError(new Error('secret database detail'), 'Không thể tải dữ liệu.').message).toBe('Không thể tải dữ liệu.')
  })
})
