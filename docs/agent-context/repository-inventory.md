# Danh mục cấu trúc repository

> Tự sinh từ Git: file được theo dõi và file mới chưa bị ignore. Chỉ ghi đường dẫn, subsystem và loại file; không đọc hoặc chép nội dung.

> Các mục thuộc docs/data_seed/ chỉ được liệt kê đường dẫn, subsystem và loại file. docs/accounts/ và node_modules/build/cache/ bị loại theo quy tắc ignore/local-only.

| Đường dẫn | Subsystem | Loại file |
|---|---|---|
| .github/workflows/deploy-pages.yml | CI và phát hành | YAML workflow |
| .github/workflows/deploy-supabase.yml | CI và phát hành | YAML workflow |
| .github/workflows/quality-check.yml | CI và phát hành | YAML workflow |
| .gitignore | Cấu hình ở repo root | Git ignore rules |
| AGENTS.md | Chỉ dẫn agent | Markdown |
| assets/logo.jpg | Tài nguyên tĩnh | Ảnh |
| deno.lock | Cấu hình ở repo root | Deno lockfile |
| design.md | Cấu hình ở repo root | Markdown |
| docs/agent-context/architecture-and-code-map.md | Agent context | Markdown |
| docs/agent-context/data-security-and-migrations.md | Agent context | Markdown |
| docs/agent-context/development-and-release.md | Agent context | Markdown |
| docs/agent-context/product-and-workflows.md | Agent context | Markdown |
| docs/agent-context/README.md | Agent context | Markdown |
| docs/agent-context/repository-inventory.md | Agent context | Markdown |
| docs/bug_deploy/logs_100134867151.zip | Tài liệu sản phẩm / lịch sử | ZIP |
| docs/bug_deploy/logs_100134867151/0_secret-scan.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/1_frontend.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/1_Set up job.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/13_Post Run actions_setup-node@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/14_Post Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/15_Complete job.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/2_Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/3_Run actions_setup-node@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/4_Run npm ci.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/5_Run npm run typecheck.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/6_Run npm run testrun.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/7_Run npm run build.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/frontend/system.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/runner-diagnostic-logs/110716738996-frontend.zip | Tài liệu sản phẩm / lịch sử | ZIP |
| docs/bug_deploy/logs_100134867151/runner-diagnostic-logs/110716739187-secret-scan.zip | Tài liệu sản phẩm / lịch sử | ZIP |
| docs/bug_deploy/logs_100134867151/secret-scan/1_Set up job.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/secret-scan/2_Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/secret-scan/3_Check for common secret patterns.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/secret-scan/6_Post Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/secret-scan/7_Complete job.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/bug_deploy/logs_100134867151/secret-scan/system.txt | Tài liệu sản phẩm / lịch sử | TXT |
| docs/data_seed/t9/Diem_danh_6.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn |
| docs/data_seed/t9/Diem_danh_7.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn |
| docs/data_seed/t9/Diem_danh_8.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn |
| docs/data_seed/t9/Diem_danh_9.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn |
| docs/data_seed/t9/diemdang.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn |
| docs/DELIVERY_ROADMAP.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/Hung_Cuong_Business_Design_v1.0.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/IMPLEMENTATION.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/plans/HVC_EDU_NEW_LUNA_INSERT_STAFF_SCHEDULE_PLAN.md | Kế hoạch lịch sử theo nhiệm vụ | Markdown |
| docs/QA_STAGING_TEST_REPORT_2026-09-29.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/QA_STAGING_TEST_REPORT_2026-09-30.md | Tài liệu sản phẩm / lịch sử | Markdown |
| docs/QA_TEST_REPORT_2026-09-28.md | Tài liệu sản phẩm / lịch sử | Markdown |
| frontend/.env.example | Frontend / cấu hình và public | Mẫu biến môi trường |
| frontend/AGENTS.md | Chỉ dẫn agent | Markdown |
| frontend/index.html | Frontend / cấu hình và public | HTML |
| frontend/package.json | Frontend / cấu hình và public | JSON/config |
| frontend/public/404.html | Frontend / cấu hình và public | HTML |
| frontend/review/index.html | Frontend / cấu hình và public | HTML |
| frontend/review/main.ts | Frontend / cấu hình và public | TypeScript |
| frontend/review/README.md | Frontend / cấu hình và public | Markdown |
| frontend/src/App.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppButton.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppErrorBanner.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/app/components/AppErrorBanner.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppField.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppIcon.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppPageHeader.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppState.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/AppToastHost.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/BaseModal.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/app/components/BaseModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/ConfirmModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/DetailModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/FormModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/SessionMonthCalendar.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/app/components/SessionMonthCalendar.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/components/YouTubePlayer.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/layouts/AppLayout.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/app/layouts/AppLayout.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/layouts/AuthLayout.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/app/router/index.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/app/router/index.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/devtools/ui-review/mock-auth.store.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/devtools/ui-review/mock-services.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/devtools/ui-review/mock-supabase.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/devtools/ui-review/review-state.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/devtools/ui-review/ReviewApp.vue | Frontend / nền tảng và dịch vụ | Vue SFC |
| frontend/src/env.d.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/main.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/modules/admin/components/bulk-password-reset.types.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/components/BulkPasswordResetModal.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/components/TeacherPicker.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/components/TeacherPicker.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/AdminSessionsPage.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/pages/AdminSessionsPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/AdminTimesheetsPage.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/pages/AdminTimesheetsPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/ClassDetailPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/ClassesPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/StaffPage.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/pages/StaffPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/StudentDetailPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/pages/StudentsPage.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/pages/StudentsPage.vue | Frontend / Admin | Vue SFC |
| frontend/src/modules/admin/utils/student-account-export.test.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/admin/utils/student-account-export.ts | Frontend / Admin | TypeScript |
| frontend/src/modules/auth/pages/ChangePasswordPage.test.ts | Frontend / Đăng nhập | TypeScript |
| frontend/src/modules/auth/pages/ChangePasswordPage.vue | Frontend / Đăng nhập | Vue SFC |
| frontend/src/modules/auth/pages/LoginPage.test.ts | Frontend / Đăng nhập | TypeScript |
| frontend/src/modules/auth/pages/LoginPage.vue | Frontend / Đăng nhập | Vue SFC |
| frontend/src/modules/staff/attendance.test.ts | Frontend / Giáo viên | TypeScript |
| frontend/src/modules/staff/attendance.ts | Frontend / Giáo viên | TypeScript |
| frontend/src/modules/staff/components/StaffAttendanceModal.vue | Frontend / Giáo viên | Vue SFC |
| frontend/src/modules/staff/pages/SessionsPage.test.ts | Frontend / Giáo viên | TypeScript |
| frontend/src/modules/staff/pages/SessionsPage.vue | Frontend / Giáo viên | Vue SFC |
| frontend/src/modules/staff/pages/StaffProfilePage.vue | Frontend / Giáo viên | Vue SFC |
| frontend/src/modules/staff/pages/StaffTimesheetsPage.test.ts | Frontend / Giáo viên | TypeScript |
| frontend/src/modules/staff/pages/StaffTimesheetsPage.vue | Frontend / Giáo viên | Vue SFC |
| frontend/src/modules/student/pages/StudentAiChatPage.test.ts | Frontend / Học sinh | TypeScript |
| frontend/src/modules/student/pages/StudentAiChatPage.vue | Frontend / Học sinh | Vue SFC |
| frontend/src/modules/student/pages/StudentPage.test.ts | Frontend / Học sinh | TypeScript |
| frontend/src/modules/student/pages/StudentPage.vue | Frontend / Học sinh | Vue SFC |
| frontend/src/modules/student/pages/StudentReviewPage.test.ts | Frontend / Học sinh | TypeScript |
| frontend/src/modules/student/pages/StudentReviewPage.vue | Frontend / Học sinh | Vue SFC |
| frontend/src/services/commands.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/services/commands.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/services/data-queries.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/services/data-queries.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/services/edge-functions.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/services/supabase.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/constants/roles.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/types/domain.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/class-teacher-limit.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/class-teacher-limit.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/errors.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/errors.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/format.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/format.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/session-calendar.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/session-calendar.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/youtube.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/shared/utils/youtube.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/stores/app-error.store.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/stores/auth.store.test.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/stores/auth.store.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/stores/toast.store.ts | Frontend / nền tảng và dịch vụ | TypeScript |
| frontend/src/styles.css | Frontend / nền tảng và dịch vụ | CSS |
| frontend/tsconfig.app.json | Frontend / cấu hình và public | JSON/config |
| frontend/tsconfig.json | Frontend / cấu hình và public | JSON/config |
| frontend/tsconfig.node.json | Frontend / cấu hình và public | JSON/config |
| frontend/vite.config.ts | Frontend / cấu hình và public | TypeScript |
| frontend/vite.review.config.ts | Frontend / cấu hình và public | TypeScript |
| package-lock.json | Cấu hình ở repo root | npm lockfile |
| package.json | Cấu hình ở repo root | JSON/config |
| README.md | Cấu hình ở repo root | Markdown |
| scripts/agent-context-inventory.mjs | Công cụ dự án | MJS |
| scripts/bootstrap-root.sh | Công cụ dự án | Shell |
| supabase/AGENTS.md | Chỉ dẫn agent | Markdown |
| supabase/config.toml | Supabase / cấu hình và seed | TOML/config |
| supabase/functions/_shared/auth.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/_shared/cors.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/_shared/password-reset.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/_shared/response.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-account-status/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-create-user/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-export-student-logins/config.toml | Supabase / Edge Functions | TOML/config |
| supabase/functions/admin-export-student-logins/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-export-student-logins/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-export-student-logins/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password-bulk/config.toml | Supabase / Edge Functions | TOML/config |
| supabase/functions/admin-reset-password-bulk/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password-bulk/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password-bulk/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/admin-reset-password/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/bootstrap-root/config.toml | Supabase / Edge Functions | TOML/config |
| supabase/functions/bootstrap-root/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/login-by-identifier/config.toml | Supabase / Edge Functions | TOML/config |
| supabase/functions/login-by-identifier/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/session-complete/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/session-learning-update/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/session-learning-update/youtube.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/session-learning-update/youtube.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/session-start/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-ai-tutor/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-ai-tutor/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-ai-tutor/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-required-password-change/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-required-password-change/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/student-required-password-change/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/teacher-comment-optimize/handler.test.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/teacher-comment-optimize/handler.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/teacher-comment-optimize/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/timesheet-review/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/functions/timesheet-submit/index.ts | Supabase / Edge Functions | TypeScript |
| supabase/migrations/0001_extensions.sql | Supabase / migrations | SQL |
| supabase/migrations/0002_enums.sql | Supabase / migrations | SQL |
| supabase/migrations/0003_auth_profiles.sql | Supabase / migrations | SQL |
| supabase/migrations/0004_rbac.sql | Supabase / migrations | SQL |
| supabase/migrations/0005_students_staff.sql | Supabase / migrations | SQL |
| supabase/migrations/0006_academic_master.sql | Supabase / migrations | SQL |
| supabase/migrations/0007_class_month.sql | Supabase / migrations | SQL |
| supabase/migrations/0008_sessions.sql | Supabase / migrations | SQL |
| supabase/migrations/0009_attendance.sql | Supabase / migrations | SQL |
| supabase/migrations/0010_timesheets.sql | Supabase / migrations | SQL |
| supabase/migrations/0011_tuition.sql | Supabase / migrations | SQL |
| supabase/migrations/0012_payroll.sql | Supabase / migrations | SQL |
| supabase/migrations/0013_accounting.sql | Supabase / migrations | SQL |
| supabase/migrations/0014_notifications.sql | Supabase / migrations | SQL |
| supabase/migrations/0015_audit.sql | Supabase / migrations | SQL |
| supabase/migrations/0016_functions.sql | Supabase / migrations | SQL |
| supabase/migrations/0017_rls.sql | Supabase / migrations | SQL |
| supabase/migrations/0018_indexes.sql | Supabase / migrations | SQL |
| supabase/migrations/0019_seed_master.sql | Supabase / migrations | SQL |
| supabase/migrations/0020_cleanup_function_warnings.sql | Supabase / migrations | SQL |
| supabase/migrations/0021_core_commands.sql | Supabase / migrations | SQL |
| supabase/migrations/0022_attendance_snapshot_fk.sql | Supabase / migrations | SQL |
| supabase/migrations/0023_student_schedule_policy.sql | Supabase / migrations | SQL |
| supabase/migrations/0024_completion_commands.sql | Supabase / migrations | SQL |
| supabase/migrations/0025_business_hardening.sql | Supabase / migrations | SQL |
| supabase/migrations/0026_admin_permissions.sql | Supabase / migrations | SQL |
| supabase/migrations/0027_expand_subjects_grades.sql | Supabase / migrations | SQL |
| supabase/migrations/0028_fix_staff_rls_recursion.sql | Supabase / migrations | SQL |
| supabase/migrations/0029_session_fee_snapshots.sql | Supabase / migrations | SQL |
| supabase/migrations/0030_fix_student_rls_recursion.sql | Supabase / migrations | SQL |
| supabase/migrations/0031_schedule_rooms.sql | Supabase / migrations | SQL |
| supabase/migrations/0032_fix_session_rls_recursion.sql | Supabase / migrations | SQL |
| supabase/migrations/0033_class_month_schedule_staff.sql | Supabase / migrations | SQL |
| supabase/migrations/0034_attendance_assessment_fields.sql | Supabase / migrations | SQL |
| supabase/migrations/0035_seed_t9_attendance.sql | Supabase / migrations | SQL |
| supabase/migrations/0036_parent_role.sql | Supabase / migrations | SQL |
| supabase/migrations/0037_learning_scope.sql | Supabase / migrations | SQL |
| supabase/migrations/0038_retire_parent_role.sql | Supabase / migrations | SQL |
| supabase/migrations/0039_continuous_learning.sql | Supabase / migrations | SQL |
| supabase/migrations/0040_fix_continuous_learning_rls_recursion.sql | Supabase / migrations | SQL |
| supabase/migrations/0041_admin_monthly_session_planning.sql | Supabase / migrations | SQL |
| supabase/migrations/0042_restore_session_timesheets.sql | Supabase / migrations | SQL |
| supabase/migrations/0043_limit_class_teachers.sql | Supabase / migrations | SQL |
| supabase/migrations/0044_allow_parallel_sessions_by_room.sql | Supabase / migrations | SQL |
| supabase/migrations/0045_backdated_attendance_sessions.sql | Supabase / migrations | SQL |
| supabase/migrations/0046_allow_secret_key_session_rpcs.sql | Supabase / migrations | SQL |
| supabase/migrations/0047_lesson_videos_and_ai_tutor.sql | Supabase / migrations | SQL |
| supabase/migrations/0048_force_student_password_change.sql | Supabase / migrations | SQL |
| supabase/migrations/0049_force_teacher_password_change.sql | Supabase / migrations | SQL |
| supabase/migrations/0050_reset_all_schedules.sql | Supabase / migrations | SQL |
| supabase/seed.sql | Supabase / cấu hình và seed | SQL |
| supabase/tests/admin_monthly_session_planning.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/backdated_session_creation.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/class_teacher_limit.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/continuous_learning_rls.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/parallel_session_rooms.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/schedule_reset.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/session_learning_commands.test.sql | Supabase / kiểm thử SQL | SQL |
| supabase/tests/timesheet_workflow.test.sql | Supabase / kiểm thử SQL | SQL |

Tổng: 252 đường dẫn có trong inventory.
