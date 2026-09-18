import { describe, expect, it } from 'vitest'
import { formatDateTime } from './format'

describe('formatDateTime', () => {
  it('renders business timestamps in Ho Chi Minh timezone', () => {
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).toContain('07:00')
  })
})
