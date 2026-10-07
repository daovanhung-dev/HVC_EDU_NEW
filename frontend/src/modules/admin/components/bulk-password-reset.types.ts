import type { AdminResetPasswordBulkResult } from '@/services/commands'

export interface BulkResetPerson {
  user_id: string
  full_name: string
  code: string | null
}

export interface BulkResetDisplayResult extends BulkResetPerson, AdminResetPasswordBulkResult {}
