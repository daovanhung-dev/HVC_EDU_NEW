import type { AttendanceStatus } from '@/shared/types/domain'

export function prorateFee(monthlyFee: number, totalSessions: number, eligibleSessions: number): number {
  if (monthlyFee < 0 || totalSessions <= 0 || eligibleSessions < 0) throw new Error('INVALID_PRORATION_INPUT')
  return Math.round((monthlyFee * Math.min(eligibleSessions, totalSessions)) / totalSessions)
}

export function sessionUnitValue(monthlyFee: number, scheduledSessionCount: number): number {
  if (monthlyFee < 0 || scheduledSessionCount <= 0) throw new Error('INVALID_SESSION_UNIT_INPUT')
  return Math.round(monthlyFee / scheduledSessionCount)
}

export function sessionRevenue(lines: Array<{ sessionUnitValue: number; attendance: AttendanceStatus }>): number {
  return lines.reduce((sum, line) => sum + (line.attendance === 'PRESENT' || line.attendance === 'LATE' ? line.sessionUnitValue : 0), 0)
}

export function payrollBaseSalary(method: 'PERCENTAGE' | 'FIXED', revenue: number, percentage?: number, fixedAmount?: number): number {
  if (method === 'PERCENTAGE') {
    if (percentage === undefined || percentage < 0 || percentage > 100) throw new Error('INVALID_SALARY_PERCENTAGE')
    return Math.round((revenue * percentage) / 100)
  }
  if (fixedAmount === undefined || fixedAmount < 0) throw new Error('INVALID_FIXED_SALARY')
  return Math.trunc(fixedAmount)
}
