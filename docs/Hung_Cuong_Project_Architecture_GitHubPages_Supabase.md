# PROJECT ARCHITECTURE — HÙNG CƯỜNG MANAGEMENT SYSTEM

**Version:** 2.0  
**Business baseline:** BD v1.0  
**Deployment target:** GitHub Pages + Supabase  
**Frontend:** Vue 3 + TypeScript + Vite  
**Backend platform:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime + Storage)  
**Architecture style:** Serverless Modular Monolith / Feature-first  
**Timezone:** `Asia/Ho_Chi_Minh`  
**Currency:** `VND`

---

# 1. Quyết định kiến trúc

Hệ thống **không sử dụng FastAPI/Nginx/backend server riêng trong V1**.

Kiến trúc triển khai:

```text
GitHub Repository
        │
        ├── Vue 3 + TypeScript source
        │
        ├── Supabase migrations
        │
        ├── Supabase Edge Functions
        │
        └── GitHub Actions
                │
                ├── Build Vue/Vite
                │       ↓
                │   GitHub Pages
                │
                └── Deploy Supabase
                        ↓
                 Supabase Project
```

Runtime:

```text
┌──────────────────────────────────────────────┐
│                 USER BROWSER                 │
│                                              │
│ Vue 3 + TypeScript + Pinia + Vue Router      │
└───────────────────────┬──────────────────────┘
                        │ HTTPS
          ┌─────────────┴──────────────┐
          │                            │
          ▼                            ▼
┌───────────────────┐       ┌──────────────────────────┐
│  GitHub Pages     │       │        Supabase          │
│                   │       │                          │
│ Static HTML/CSS/JS│       │ Auth                     │
└───────────────────┘       │ PostgreSQL               │
                            │ Row Level Security        │
                            │ Edge Functions            │
                            │ Realtime                  │
                            │ Storage                   │
                            └────────────┬─────────────┘
                                         │
                                         ▼
                                  Business Data
```

---

# 2. Nguyên tắc quan trọng

## 2.1 Frontend không phải backend

Mọi source chạy trên GitHub Pages đều được xem là **public client code**.

Không được đặt trong frontend:

```text
SUPABASE_SECRET_KEY
legacy service_role key
database password
JWT signing secret
admin-only secrets
```

Frontend chỉ sử dụng:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Publishable key có thể xuất hiện trong browser; dữ liệu phải được bảo vệ bằng **RLS + database grants**.

---

# 3. Phân chia trách nhiệm

## GitHub Pages

Chỉ chịu trách nhiệm:

- Host Vue SPA.
- HTML.
- CSS.
- JavaScript.
- Static assets.

Không chịu trách nhiệm:

- Database.
- Business transaction.
- Secret.
- Admin authentication logic.
- Payroll transaction.
- Accounting transaction.

---

## Supabase Auth

Chịu trách nhiệm:

- Authentication.
- User session.
- JWT.
- Password.
- Refresh session.
- Change password.
- Account identity.

---

## Supabase PostgreSQL

Chịu trách nhiệm:

- Business data.
- Foreign key.
- Unique constraint.
- Check constraint.
- Transaction.
- RLS.
- Database functions.
- Snapshot history.
- Audit persistence.

---

## Supabase Edge Functions

Chịu trách nhiệm cho các nghiệp vụ cần quyền server hoặc transaction đặc biệt.

Ví dụ:

```text
admin-create-user
admin-reset-password
login-by-identifier
bootstrap-root
class-month-activate
session-complete
session-reopen
session-replace-staff
timesheet-approve
payroll-calculate
payroll-confirm
payroll-pay
tuition-confirm-paid
accounting-adjustment
report-export
```

---

# 4. Luồng request

Có hai kiểu request.

## 4.1 Client → Supabase trực tiếp

Dùng cho nghiệp vụ an toàn và được RLS bảo vệ.

Ví dụ:

```text
Học sinh:
- xem profile
- xem lớp
- xem lịch học
- xem attendance
- xem BTVN
- xem nhận xét
- xem học phí

Giáo viên:
- xem lớp được phân công
- xem session
- xem lịch dạy

Admin:
- đọc danh mục
- search/filter dữ liệu được cấp quyền
```

Flow:

```text
Vue
 ↓
supabase-js
 ↓
Supabase Data API
 ↓
PostgreSQL Grants
 ↓
RLS
 ↓
Data
```

---

## 4.2 Client → Edge Function → Database

Dùng cho nghiệp vụ nhạy cảm.

Ví dụ:

```text
Tạo tài khoản
Reset password
Hoàn thành session
Mở lại session
Dạy thay
Duyệt công
Tính/chốt/trả lương
Xác nhận học phí
Accounting AUTO transaction
```

Flow:

```text
Vue
 ↓
JWT
 ↓
Edge Function
 ↓
Authenticate caller
 ↓
Check role/permission
 ↓
Validate business rule
 ↓
Database transaction
 ↓
Audit Log
 ↓
Notification
 ↓
Response
```

---

# 5. Repository Structure

```text
hung-cuong-management/
│
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml
│       ├── deploy-supabase.yml
│       └── quality-check.yml
│
├── frontend/
│   ├── public/
│   │   ├── favicon.ico
│   │   └── 404.html
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.vue
│   │   │   ├── router/
│   │   │   ├── guards/
│   │   │   └── layouts/
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── staff/
│   │   │   ├── subjects/
│   │   │   ├── grades/
│   │   │   ├── classes/
│   │   │   ├── class-months/
│   │   │   ├── schedules/
│   │   │   ├── sessions/
│   │   │   ├── attendance/
│   │   │   ├── timesheets/
│   │   │   ├── payroll/
│   │   │   ├── tuition/
│   │   │   ├── accounting/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   └── audit/
│   │   │
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── constants/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   └── validators/
│   │   │
│   │   ├── stores/
│   │   │   ├── auth.store.ts
│   │   │   ├── permission.store.ts
│   │   │   └── notification.store.ts
│   │   │
│   │   ├── services/
│   │   │   ├── supabase.ts
│   │   │   ├── edge-functions.ts
│   │   │   └── realtime.ts
│   │   │
│   │   ├── assets/
│   │   └── main.ts
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── supabase/
│   ├── config.toml
│   │
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_enums.sql
│   │   ├── 0003_auth_profiles.sql
│   │   ├── 0004_rbac.sql
│   │   ├── 0005_students_staff.sql
│   │   ├── 0006_academic_master.sql
│   │   ├── 0007_class_month.sql
│   │   ├── 0008_sessions.sql
│   │   ├── 0009_attendance.sql
│   │   ├── 0010_timesheets.sql
│   │   ├── 0011_tuition.sql
│   │   ├── 0012_payroll.sql
│   │   ├── 0013_accounting.sql
│   │   ├── 0014_notifications.sql
│   │   ├── 0015_audit.sql
│   │   ├── 0016_functions.sql
│   │   ├── 0017_rls.sql
│   │   ├── 0018_indexes.sql
│   │   └── 0019_seed_master.sql
│   │
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── auth.ts
│   │   │   ├── permissions.ts
│   │   │   ├── response.ts
│   │   │   ├── validation.ts
│   │   │   ├── audit.ts
│   │   │   └── cors.ts
│   │   │
│   │   ├── login-by-identifier/
│   │   ├── bootstrap-root/
│   │   ├── admin-create-user/
│   │   ├── admin-reset-password/
│   │   ├── class-month-activate/
│   │   ├── session-complete/
│   │   ├── session-reopen/
│   │   ├── session-replace-staff/
│   │   ├── timesheet-submit/
│   │   ├── timesheet-approve/
│   │   ├── payroll-calculate/
│   │   ├── payroll-confirm/
│   │   ├── payroll-pay/
│   │   ├── tuition-confirm-paid/
│   │   └── accounting-adjustment/
│   │
│   └── seed.sql
│
├── docs/
│   ├── BUSINESS_DESIGN.md
│   ├── PROJECT_ARCHITECTURE.md
│   ├── DATABASE_DESIGN.md
│   ├── API_DESIGN.md
│   └── DEPLOYMENT.md
│
├── scripts/
│   ├── setup-local.sh
│   ├── deploy.sh
│   └── reset-local-db.sh
│
├── .gitignore
├── README.md
└── package.json
```

---

# 6. Frontend Architecture

Frontend dùng:

```text
Vue 3
TypeScript
Vite
Vue Router
Pinia
Supabase JS
Bootstrap 5
```

Cấu trúc theo feature.

Ví dụ:

```text
modules/students/
├── pages/
│   ├── StudentListPage.vue
│   ├── StudentDetailPage.vue
│   └── StudentFormPage.vue
│
├── components/
├── services/
│   └── student.service.ts
│
├── composables/
├── types/
├── validators/
└── routes.ts
```

Không gom toàn bộ application thành:

```text
pages/
components/
services/
```

global khổng lồ.

---

# 7. Router

Route được chia theo Role.

Ví dụ:

```text
/login

/admin/*
/teacher/*
/assistant/*
/student/*
```

Guard:

```text
requireAuth
requireRole
requirePermission
forcePasswordChange
```

Lưu ý:

Frontend guard chỉ phục vụ UX.

**Security thật nằm ở RLS + Edge Functions.**

---

# 8. GitHub Pages Routing

GitHub Pages là static hosting.

Với Vue Router nên ưu tiên:

```text
createWebHashHistory()
```

Ví dụ URL:

```text
https://daovanhung-dev.github.io/hung-cuong-management/#/login
```

Ưu điểm:

- Không lỗi refresh route.
- Không cần server rewrite.
- Triển khai GitHub Pages đơn giản.

Nếu bắt buộc URL không có `#`, sử dụng `createWebHistory()` + SPA `404.html` fallback, nhưng Hash History là phương án V1 ổn định hơn.

---

# 9. Vite Base Path

Nếu repository:

```text
hung-cuong-management
```

và deploy dạng GitHub project pages:

```text
https://<username>.github.io/hung-cuong-management/
```

thì Vite phải build với base:

```text
/hung-cuong-management/
```

Có thể lấy từ environment để không hard-code.

---

# 10. Supabase Client

Frontend chỉ tạo một client duy nhất:

```text
src/services/supabase.ts
```

Sử dụng:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Không tạo nhiều client tùy tiện trong từng component.

---

# 11. Authentication Architecture

Supabase Auth quản lý password và session.

Business profile nằm trong:

```text
public.profiles
```

Liên kết:

```text
auth.users.id
      │
      └── profiles.user_id
```

---

# 12. Role

Role chính:

```text
ROOT_ADMIN
ADMIN
TEACHER
ASSISTANT
STUDENT
```

Một account chỉ có một Role.

---

# 13. Login Identifier

Business requirement cho phép:

```text
username
student_code
phone
email
```

Supabase Auth password login native sử dụng:

```text
email + password
hoặc
phone + password
```

Do đó `username` và `student_code` được xử lý thông qua:

```text
login-by-identifier Edge Function
```

Flow:

```text
identifier + password
        ↓
Edge Function
        ↓
Resolve identifier
        ↓
Email hoặc phone của auth identity
        ↓
Supabase Auth signInWithPassword
        ↓
Session
```

Không expose secret key ra browser.

---

# 14. Root Account

Business yêu cầu:

```text
Username: ADMIN
Initial password: hungcuong123
```

Không insert password trực tiếp vào database business table.

Root được bootstrap thông qua server-side process:

```text
bootstrap-root Edge Function
```

hoặc deployment/bootstrap script.

Sau khi bootstrap thành công:

```text
role = ROOT_ADMIN
username = ADMIN
force_password_change = false hoặc theo policy dự án
```

Khuyến nghị production đổi password ngay sau bootstrap dù business seed vẫn giữ giá trị yêu cầu.

---

# 15. Admin Create User

Không dùng `supabase.auth.admin.*` trực tiếp trong browser.

Flow:

```text
R1/R2
 ↓
admin-create-user
 ↓
Check Permission
 ↓
Supabase Secret Key
 ↓
Create Auth User
 ↓
Create Profile
 ↓
Create Student/Staff
 ↓
Audit
```

---

# 16. Database Schemas

Khuyến nghị:

```text
auth
```

do Supabase quản lý.

Business tables có thể để trong:

```text
public
```

nhưng phải:

```text
ENABLE RLS
REVOKE unnecessary grants
GRANT only required operations
CREATE explicit policies
```

---

# 17. Core Tables

## Identity / RBAC

```text
profiles
permission_groups
permissions
permission_group_permissions
admin_permission_groups
```

---

## Student / Staff

```text
students
staff
```

---

## Academic master

```text
subjects
grades
classes
```

---

## Class Month

```text
class_months
class_month_students
class_month_staff
class_month_schedules
```

---

## Session

```text
sessions
session_students
session_staff
staff_replacements
student_attendances
```

---

## Human Resource

```text
timesheets
```

---

## Finance

```text
tuition_records
payroll_periods
payroll_items
salary_adjustments
accounting_categories
accounting_transactions
```

---

## System

```text
notifications
audit_logs
```

---

# 18. Snapshot Strategy

Không dựa vào dữ liệu hiện tại để dựng lịch sử.

Khi tạo ClassMonth phải snapshot:

```text
Students
Staff
Tuition
Schedule
```

Khi sinh Session phải snapshot:

```text
session_students
session_staff
```

Khi Session hoàn thành phải snapshot:

```text
attendance
monthly_fee_snapshot
session_unit_value
revenue_snapshot
```

Khi tính payroll phải snapshot:

```text
revenue_snapshot
percentage
base_salary
bonus
penalty
net_salary
```

Mục tiêu:

> Dữ liệu tháng 10 thay đổi không làm sai lịch sử tháng 9.

---

# 19. Session State

```text
SCHEDULED
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

Nhánh khác:

```text
SCHEDULED
    ↓
CANCELLED
```

Lưu:

```text
scheduled_start_at
scheduled_end_at
started_at
started_by
ended_at
ended_by
```

R3/R4 được start.

Chỉ R3 được complete.

---

# 20. Session Complete Transaction

Không để frontend update:

```text
sessions.status = COMPLETED
```

trực tiếp.

Dùng:

```text
session-complete
```

Nghiệp vụ:

```text
1. Verify JWT
2. Verify R3
3. Verify teacher belongs to session
4. Check session = IN_PROGRESS
5. Check all session students have attendance
6. Validate homework score
7. Set ended_at
8. Set ended_by
9. Set COMPLETED
10. Calculate revenue snapshot
11. Lock academic data
12. Write audit
13. Create notifications
14. Commit
```

---

# 21. Attendance

Một record:

```text
UNIQUE(session_id, student_id)
```

Status:

```text
PRESENT
LATE
ABSENT
EXCUSED
```

Fields:

```text
late_minutes nullable
absence_reason nullable
homework_score nullable
comment
updated_by
updated_at
```

Constraint:

```text
homework_score IS NULL
OR homework_score BETWEEN 0 AND 10
```

---

# 22. Revenue Calculation

Revenue tính lương:

```text
PRESENT + LATE
```

Không tính:

```text
ABSENT + EXCUSED
```

Công thức mỗi HS:

```text
session_unit_value
=
monthly_fee_snapshot
/
scheduled_session_count
```

Session Revenue:

```text
SUM(session_unit_value)
```

của học sinh PRESENT/LATE.

Lưu:

```text
sessions.revenue_snapshot
```

---

# 23. Timesheet

Một nhân sự/session:

```text
UNIQUE(session_id, staff_id)
```

Status:

```text
PENDING
APPROVED
REJECTED
```

Chỉ được submit sau:

```text
session.status = COMPLETED
```

---

# 24. Payroll

```text
payroll_periods
├── DRAFT
├── CONFIRMED
└── PAID
```

Payroll item có:

```text
PERCENTAGE
FIXED
```

Base salary:

```text
percentage * revenue
```

hoặc:

```text
fixed_amount
```

Constraint business:

```text
total_base_salary_of_session
<=
session.revenue_snapshot
```

Bonus/Penalty có thể làm thực nhận vượt Revenue.

---

# 25. Tuition

Mỗi:

```text
class_month + student
```

có một record.

Status:

```text
UNPAID
PAID
```

Không partial payment V1.

Fields:

```text
monthly_fee_snapshot
amount_due
amount_paid
paid_at
confirmed_by
payment_method
```

---

# 26. Tuition Proration

Học sinh vào giữa tháng:

```text
amount_due
=
monthly_fee
/
total_sessions
*
eligible_sessions
```

Học sinh nghỉ từng buổi:

```text
không giảm học phí
```

Học sinh rời lớp giữa tháng:

```text
tính theo số session thuộc membership period
```

---

# 27. Accounting Ledger

Không tính kế toán chỉ bằng query ghép nhiều bảng.

Dùng ledger:

```text
accounting_transactions
```

Type:

```text
AUTO
MANUAL
ADJUSTMENT
```

Direction:

```text
INCOME
EXPENSE
```

---

# 28. Tuition Paid Transaction

Flow:

```text
tuition-confirm-paid
        ↓
Verify permission
        ↓
Set Tuition = PAID
        ↓
Create AUTO INCOME
        ↓
Audit
        ↓
Notify student
        ↓
Commit
```

---

# 29. Payroll Paid Transaction

```text
payroll-pay
        ↓
Verify permission
        ↓
Set Payroll = PAID
        ↓
Create AUTO EXPENSE
        ↓
Audit
        ↓
Notify staff
        ↓
Commit
```

AUTO transaction không được sửa trực tiếp từ frontend.

---

# 30. RLS Strategy

Mọi table expose tới `authenticated` phải có RLS.

Không sử dụng một policy `FOR ALL` khổng lồ.

Tách:

```text
SELECT
INSERT
UPDATE
DELETE
```

theo từng nghiệp vụ.

---

# 31. RLS — Student

Student chỉ xem:

```text
profiles.user_id = auth.uid()
```

và các business row thuộc student profile của chính mình.

Ví dụ:

```text
student classes
student attendance
student homework
student comments
student tuition
student notifications
```

---

# 32. RLS — Teacher / Assistant

Chỉ được đọc academic data khi:

```text
auth.uid()
→ staff
→ class_month_staff/session_staff
→ target class/session
```

Không được đọc lương nhân sự khác.

---

# 33. RLS — Admin

ADMIN không mặc định full quyền.

Access dựa trên:

```text
admin_permission_groups
```

ROOT được full business permission.

Các thao tác đặc quyền vẫn ưu tiên Edge Function thay vì chỉ dựa vào client-side RLS.

---

# 34. Permission Helpers

Tạo database helper functions:

```text
current_profile_id()
current_role()
is_root()
has_permission(permission_code)
is_session_staff(session_id)
is_session_teacher(session_id)
is_student_owner(student_id)
```

RLS sử dụng helper để policy dễ đọc.

---

# 35. Audit

Không cho client tự insert audit tùy ý.

Audit được tạo từ:

```text
Edge Functions
Database functions/triggers
```

Fields:

```text
actor_user_id
actor_role
action
entity_type
entity_id
old_data jsonb
new_data jsonb
reason
ip
created_at
```

Audit không xóa từ UI.

---

# 36. Notifications

V1:

```text
IN_APP
```

Không SMS/email/Zalo.

Frontend có thể dùng:

```text
Supabase Realtime
```

để nhận notification mới.

Nếu không cần realtime ngay:

```text
poll/refetch
```

vẫn hoạt động.

---

# 37. Security

## Browser

Chỉ giữ:

```text
SUPABASE_URL
PUBLISHABLE_KEY
user session
```

## Edge Functions

Giữ secrets:

```text
Supabase secret key
server-only keys
bootstrap token nếu cần
```

Không commit `.env`.

---

# 38. Key Policy

Ưu tiên key mới:

```text
sb_publishable_...
sb_secret_...
```

Không thiết kế mới phụ thuộc vào legacy:

```text
anon
service_role
```

Browser:

```text
publishable key
```

Server/Edge Function:

```text
secret key
```

Secret key bypass RLS nên chỉ được sử dụng sau khi Edge Function tự kiểm tra authorization.

---

# 39. GitHub Actions — Frontend

Workflow:

```text
push main
   ↓
checkout
   ↓
setup node
   ↓
npm ci
   ↓
npm run typecheck
   ↓
npm run test
   ↓
npm run build
   ↓
upload-pages-artifact
   ↓
deploy-pages
```

GitHub Pages Source:

```text
GitHub Actions
```

---

# 40. GitHub Actions — Supabase

Backend deploy workflow:

```text
push main
   ↓
Supabase CLI
   ↓
Link project
   ↓
Apply migrations
   ↓
Deploy Edge Functions
```

Secrets trong GitHub Actions:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
```

Không đưa secret backend vào Vite build variables.

---

# 41. Deploy Environments

Khuyến nghị:

```text
Local
Staging
Production
```

Nếu muốn V1 cực gọn:

```text
Local
Production
```

Tuy nhiên database tài chính nên có Staging trước khi production.

---

# 42. Local Development

Sử dụng:

```bash
supabase start
npm run dev
```

Local services:

```text
Vue:        localhost:5173
Supabase:   local stack
Postgres:   Supabase local
Functions:  Supabase local Edge Runtime
```

---

# 43. Deployment URLs

Frontend:

```text
https://<github-user>.github.io/<repo>/
```

Supabase:

```text
https://<project-ref>.supabase.co
```

Edge Function:

```text
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

---

# 44. Frontend Environment

`.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_APP_BASE_PATH=/hung-cuong-management/
```

Không có secret key.

---

# 45. Supabase Secrets

Server-only:

```text
SUPABASE_SECRET_KEYS
CUSTOM_BOOTSTRAP_SECRET
other future third-party secrets
```

Đọc bằng:

```text
Deno.env.get(...)
```

---

# 46. API Strategy

Không cần dựng REST API CRUD thủ công cho mọi table.

Phân loại:

## Query/simple CRUD

```text
supabase-js
+
RLS
```

## Complex commands

```text
Edge Function
```

Ví dụ:

```text
Query:
getStudents()
getClassMonths()
getMySchedule()
getMyTuition()

Command:
completeSession()
approveTimesheet()
payPayroll()
confirmTuitionPaid()
createUser()
```

Đây là mô hình:

```text
Query → Data API
Command → Edge Functions
```

---

# 47. Frontend Service Pattern

Không gọi Supabase trực tiếp từ `.vue` component.

Ví dụ:

```text
StudentListPage.vue
      ↓
student.service.ts
      ↓
supabase.ts
```

Complex command:

```text
SessionPage.vue
      ↓
session.service.ts
      ↓
edge-functions.ts
      ↓
session-complete
```

---

# 48. Error Model

Chuẩn hóa Edge Function response:

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_COMPLETEABLE",
    "message": "Chưa điểm danh đầy đủ học sinh"
  },
  "trace_id": "..."
}
```

Success:

```json
{
  "success": true,
  "data": {},
  "trace_id": "..."
}
```

---

# 49. Business Transactions

Các nghiệp vụ sau bắt buộc atomic:

```text
Create account + profile
Activate ClassMonth + generate sessions
Complete Session + revenue snapshot
Approve Timesheet
Confirm Payroll
Pay Payroll + accounting expense
Confirm Tuition Paid + accounting income
Reopen locked data + audit
```

Ưu tiên triển khai bằng:

```text
Postgres RPC / SQL function
```

cho phần database transaction phức tạp, Edge Function đóng vai trò:

```text
Auth
Permission
Validation
Call RPC
Response
```

---

# 50. Database Function Strategy

Ví dụ:

```text
activate_class_month(...)
complete_session(...)
approve_timesheet(...)
confirm_tuition_paid(...)
pay_payroll(...)
```

Các RPC nhạy cảm:

```text
REVOKE EXECUTE FROM anon/authenticated
```

và chỉ Edge Function/server execution được gọi nếu phù hợp.

---

# 51. Index Strategy

Tối thiểu index:

```text
profiles(user_id)
profiles(username)
profiles(phone)
profiles(email)

students(student_code)

class_months(class_id, year, month)

class_month_students(class_month_id, student_id)
class_month_staff(class_month_id, staff_id)

sessions(class_month_id, scheduled_start_at)
sessions(status)

student_attendances(session_id, student_id)

timesheets(session_id, staff_id)
timesheets(status)

tuition_records(class_month_id, student_id)
tuition_records(status)

payroll_items(staff_id)
payroll_periods(year, month)

accounting_transactions(transaction_date)
accounting_transactions(direction)

notifications(user_id, read_at)

audit_logs(entity_type, entity_id)
audit_logs(created_at)
```

---

# 52. Unique Constraints

```text
profiles.username UNIQUE

students.student_code UNIQUE

class_months:
UNIQUE(class_id, year, month)

class_month_students:
UNIQUE(class_month_id, student_id)

class_month_staff:
UNIQUE(class_month_id, staff_id)

student_attendances:
UNIQUE(session_id, student_id)

timesheets:
UNIQUE(session_id, staff_id)

tuition_records:
UNIQUE(class_month_id, student_id)
```

---

# 53. Money Type

Tiền lưu:

```text
BIGINT
```

VND integer.

Ví dụ:

```text
400000
```

Không dùng:

```text
float
double
```

---

# 54. Date / Time

PostgreSQL:

```text
timestamptz
```

Store UTC internally.

Frontend display:

```text
Asia/Ho_Chi_Minh
```

Business month lưu:

```text
year smallint
month smallint
```

---

# 55. Soft Delete

Dùng:

```text
status
deleted_at
```

Không physical delete nếu đã phát sinh:

```text
attendance
tuition
timesheet
payroll
accounting
audit
```

---

# 56. Module Dependency

```text
Auth
 ↓
Profiles/RBAC
 ↓
Students / Staff
 ↓
Classes
 ↓
ClassMonth
 ↓
Sessions
 ├── Attendance
 └── Timesheet
        ↓
      Payroll
        ↓
     Accounting

ClassMonth
   ↓
 Tuition
   ↓
Accounting
```

Không để:

```text
Accounting
→ tự sửa Tuition

Payroll
→ tự sửa Session
```

Module downstream chỉ tham chiếu snapshot/source.

---

# 57. Deployment Architecture

```text
Developer
   │
git push main
   │
   ├─────────────────────────────────┐
   │                                 │
   ▼                                 ▼
GitHub Action                     GitHub Action
Frontend                          Supabase
   │                                 │
npm build                         migrations
   │                              functions deploy
   ▼                                 │
GitHub Pages                         ▼
                              Supabase Production
   │                                 │
   └──────────── User Runtime ───────┘
```

---

# 58. GitHub Pages Workflow Skeleton

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci
      - run: npm run typecheck
      - run: npm run build

      - uses: actions/upload-pages-artifact@v4
        with:
          path: frontend/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

# 59. Supabase Deploy Workflow Skeleton

```yaml
name: Deploy Supabase

on:
  push:
    branches: [main]
    paths:
      - "supabase/**"

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: supabase link --project-ref "$SUPABASE_PROJECT_REF"

      - run: supabase db push

      - run: supabase functions deploy

    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

Production có thể thêm manual approval trước `db push`.

---

# 60. V1 Architecture Summary

```text
┌──────────────────────────────────────────────────────┐
│                  GitHub Pages                        │
│                                                      │
│ Vue 3 + TS + Vite + Router + Pinia + Bootstrap       │
└────────────────────────┬─────────────────────────────┘
                         │
                         │ Supabase JS / HTTPS
                         ▼
┌──────────────────────────────────────────────────────┐
│                    Supabase                          │
│                                                      │
│ ┌─────────┐ ┌────────────┐ ┌──────────────────────┐ │
│ │  Auth   │ │ PostgreSQL │ │    Edge Functions    │ │
│ └────┬────┘ └──────┬─────┘ └───────────┬──────────┘ │
│      │             │                   │            │
│      │         RLS + Grants             │            │
│      │             │              Secret key        │
│      └─────────────┼───────────────────┘            │
│                    │                                │
│       ┌────────────┼─────────────┐                  │
│       ▼            ▼             ▼                  │
│   Academic       Finance       System               │
│                                                      │
│ ClassMonth       Tuition       Notification          │
│ Session          Payroll       Audit                 │
│ Attendance       Accounting    Reports               │
└──────────────────────────────────────────────────────┘
```

---

# 61. Nguyên tắc triển khai cuối cùng

1. GitHub Pages chỉ chứa frontend static.
2. Không có backend secret trong frontend.
3. Browser dùng Supabase publishable key.
4. Tất cả exposed table phải có RLS.
5. RLS là lớp bảo vệ bắt buộc, không chỉ dùng router guard.
6. Business command nhạy cảm đi qua Edge Functions.
7. Edge Function phải xác minh JWT + Role + Permission trước khi dùng secret key.
8. AUTO accounting transaction không sửa trực tiếp.
9. Session/tuition/payroll lưu snapshot để lịch sử không thay đổi.
10. Audit Log không xóa từ UI.
11. Tiền dùng `BIGINT` VND.
12. Time dùng `timestamptz`, hiển thị `Asia/Ho_Chi_Minh`.
13. Deployment frontend bằng GitHub Actions → GitHub Pages.
14. Migration và Edge Function deploy bằng Supabase CLI.
15. Tạo tài khoản người dùng thực hiện server-side qua Edge Function.
16. Username/student code login được resolve server-side.
17. Không dùng microservice trong V1.
18. Không cần FastAPI/Nginx trong V1.
19. Code tổ chức Feature-first.
20. Khi nghiệp vụ lớn hơn mới cân nhắc backend service riêng.

---

# 62. Công nghệ cuối cùng

| Layer | Technology |
|---|---|
| Frontend | Vue 3 |
| Language | TypeScript |
| Build | Vite |
| State | Pinia |
| Router | Vue Router |
| UI | Bootstrap 5 |
| Hosting | GitHub Pages |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Authorization | PostgreSQL RLS + Permission Groups |
| Backend Logic | Supabase Edge Functions |
| Complex DB Transaction | PostgreSQL Functions / RPC |
| Realtime | Supabase Realtime |
| File Storage | Supabase Storage |
| Migration | Supabase CLI |
| CI/CD Frontend | GitHub Actions |
| CI/CD Backend | GitHub Actions + Supabase CLI |
| Testing | Vitest + DB/RLS tests |
| Currency | VND |
| Timezone | Asia/Ho_Chi_Minh |

---

# 63. Kết luận

Kiến trúc V1 chính thức:

```text
Vue SPA
   ↓
GitHub Pages
   ↓
Supabase Auth
   ↓
RLS / PostgreSQL
   ↕
Edge Functions
   ↓
Business Transactions
```

Mô hình này phù hợp cho Hùng Cường vì:

- Không phải vận hành VPS/backend server.
- GitHub Pages deploy frontend miễn phí và đơn giản.
- Supabase xử lý Auth + DB + API + Function.
- RLS bảo vệ dữ liệu ngay tại database.
- Edge Functions xử lý các nghiệp vụ Admin cần secret.
- Dễ CI/CD.
- Dễ backup/migration.
- Dễ mở rộng.
- Không over-engineering cho V1.
- Vẫn giữ được ranh giới module rõ để sau này tách backend riêng nếu cần.
