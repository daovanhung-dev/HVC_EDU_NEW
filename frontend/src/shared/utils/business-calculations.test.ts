import { describe, expect, it } from 'vitest'
import { payrollBaseSalary, prorateFee, sessionRevenue, sessionUnitValue } from './business-calculations'

describe('business calculations', () => {
  it('prorates tuition by eligible sessions', () => expect(prorateFee(400000, 8, 4)).toBe(200000))
  it('rounds VND session unit values to integers', () => expect(sessionUnitValue(300000, 8)).toBe(37500))
  it('counts only PRESENT and LATE as session revenue', () => expect(sessionRevenue([
    { sessionUnitValue: 50000, attendance: 'PRESENT' },
    { sessionUnitValue: 40000, attendance: 'LATE' },
    { sessionUnitValue: 30000, attendance: 'ABSENT' },
    { sessionUnitValue: 20000, attendance: 'EXCUSED' },
  ])).toBe(90000))
  it('supports percentage and fixed payroll', () => {
    expect(payrollBaseSalary('PERCENTAGE', 1000000, 25)).toBe(250000)
    expect(payrollBaseSalary('FIXED', 1000000, undefined, 300000)).toBe(300000)
  })
})
