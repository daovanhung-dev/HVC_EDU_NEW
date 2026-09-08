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

## Deployment

1. Tạo public GitHub repository `hung-cuong-management`, push branch `main` và chọn Pages source là GitHub Actions.
2. Đặt Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_BASE_PATH`.
3. Nếu dùng workflow backend, đặt Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
4. Workflow Supabase chạy thủ công từ tab Actions để tránh yêu cầu database secret trong lần deploy Pages đầu; backend hiện đã được apply/deploy.
5. Cấu hình Auth Site URL/redirect URL tới GitHub Pages.
6. Đặt `CUSTOM_BOOTSTRAP_SECRET` ngoài source, bootstrap ROOT một lần và đổi mật khẩu ngay lần đăng nhập đầu.
