# Implementation Notes

## Configuration policy

Frontend chỉ đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` và `VITE_APP_BASE_PATH`. Hai giá trị đầu tiên được inject lúc build; publishable key không phải secret nhưng vẫn không commit giá trị thật.

Secret key, database password, access token và bootstrap secret chỉ được đặt trong Supabase/GitHub secret manager. Không in chúng ra log.

## Current delivery

- M0–M1: frontend shell, routing, stores, schema, RBAC helpers, RLS, seed master data và CI.
- M2–M6: master data, ClassMonth/session, attendance, timesheet/payroll, tuition và accounting đã có UI/command tương ứng.
- M7: dashboard, in-app notification + Realtime/fallback, audit viewer và report export XLSX/PDF.
- M8: unit test business calculations, typecheck, Deno check, schema lint và smoke checks; RLS/UAT production cần chạy sau khi có ROOT test account.
- M9: workflow GitHub Pages/Supabase đã sẵn sàng; bước cuối cần tạo repository, khai báo Variables/Secrets, cấu hình Auth URL và bootstrap ROOT one-time.

## Student roster import

`scripts/import-student-roster.ts` imports the current 47-student Math roster through the existing authenticated Edge Functions and RLS-protected tables. It is intentionally idempotent by student code and class code: matching records are reused, conflicting records stop the import, and existing passwords are never reset.

Run it from the repository root with a ROOT account session supplied through environment variables:

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export ROOT_IDENTIFIER="ADMIN"
export ROOT_PASSWORD="..."
npm run import:student-roster
```

The script writes the generated credentials to `docs/accounts/student-accounts.md` and never prints passwords. The account document is confidential and should be removed or the passwords rotated after handoff.

Class fees are stored separately as `default_session_fee`; `default_monthly_fee` remains zero until monthly tuition is configured. A future ClassMonth can snapshot `session_fee_snapshot` and use it as the session revenue unit while preserving the existing monthly-fee fallback.

## September 2026 schedule import

`scripts/import-class-schedules.ts` creates or reuses the four September 2026 `ClassMonth` records in `DRAFT`, snapshots the 47 existing memberships, and imports the eight weekly schedules from the center timetable. It stores rooms in `class_month_schedules.room` and is idempotent; mismatched existing data stops the import without overwriting it.

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export ROOT_IDENTIFIER="ADMIN"
export ROOT_PASSWORD="..."
npm run import:class-schedules
```

The schedule importer deliberately does not activate the ClassMonths, generate sessions, or create tuition records. Review the draft schedule in the admin ClassMonth screen before activation.

## Student password rotation

`scripts/rotate-student-passwords.ts` rotates the 47 existing student accounts to a normalized full-name prefix plus a unique three-digit random suffix. It preserves student codes, usernames, names, classes and memberships, sets `force_password_change` to `false`, and verifies login through both username and student code.

The root-only `admin-set-password` Edge Function performs the Auth password update and writes an audit entry without recording the password. The script uses an ignored, mode `600` checkpoint under `docs/accounts` and updates `docs/accounts/student-accounts.md` only after all 47 accounts pass verification. Passwords are never printed to logs.

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export ROOT_IDENTIFIER="ADMIN"
export ROOT_PASSWORD="..."
npm run rotate:student-passwords
```

## Staff and per-slot schedule import

`supabase/migrations/0033_class_month_schedule_staff.sql` adds per-slot staff mapping. When a ClassMonth is activated in the future, mapped schedules populate `session_staff` from `class_month_schedule_staff`; older ClassMonths without mappings keep the `class_month_staff` fallback.

`scripts/import-staff-schedule.ts` reuses the existing Nguyễn Mạnh Cường account, creates or reuses the remaining Hùng Cường staff accounts through `admin-create-user`, assigns the 9 class-month staff records, replaces the Toán 6 Saturday draft slot with Sunday, and creates the 16 per-slot mappings for September 2026. It stops on identity/data conflicts and never resets an existing password.

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export ROOT_IDENTIFIER="ADMIN"
export ROOT_PASSWORD="..."
npm run import:staff-schedule
```

The importer requires the four September 2026 ClassMonths to remain `DRAFT`; it does not generate sessions, tuition, or alter completed history. Generated staff credentials are written only to the local-only `docs/accounts/staff_accounts_2026-09.md` file, which is ignored by Git and should be removed or rotated after handoff.

## Deployment

1. Tạo public GitHub repository `hung-cuong-management`, push branch `main` và chọn Pages source là GitHub Actions.
2. Đặt Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_BASE_PATH`.
3. Nếu dùng workflow backend, đặt Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
4. Workflow Supabase chạy thủ công từ tab Actions để tránh yêu cầu database secret trong lần deploy Pages đầu; backend hiện đã được apply/deploy.
5. Cấu hình Auth Site URL/redirect URL tới GitHub Pages.
6. Chạy `scripts/bootstrap-root.sh`; script tự sinh/set `CUSTOM_BOOTSTRAP_SECRET` nếu chưa có, bootstrap ROOT một lần và đổi mật khẩu ngay lần đăng nhập đầu.
