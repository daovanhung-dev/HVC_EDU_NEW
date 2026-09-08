import { describe, expect, it } from 'vitest'
import { formatDateTime, formatVnd } from './format'

describe('formatVnd', () => {
  it('formats integer VND without decimals', () => {
    expect(formatVnd(400000)).toContain('400.000')
    expect(formatVnd(400000)).toContain('₫')
  })

  it('returns a placeholder for missing values', () => {
    expect(formatVnd(null)).toBe('—')
  })

  it('renders business timestamps in Ho Chi Minh timezone', () => {
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).toContain('07:00')
  })
})
