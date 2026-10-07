# Kiến trúc và bản đồ mã nguồn

## Kiến trúc

- Frontend: Vue 3, TypeScript, Vue Router, Pinia, Bootstrap và Vite; build tĩnh lên GitHub Pages, dùng hash routing.
- Backend: Supabase PostgreSQL/Auth, RLS, Edge Functions chạy Deno và Supabase Cron.
- Cấu hình frontend công khai: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_BASE_PATH.
- Tài liệu này hướng tới entrypoint và luồng phụ thuộc. Danh mục đầy đủ đường dẫn/loại file ở repository-inventory.md.

## Frontend

| Khu vực | Trách nhiệm và nơi lần theo |
|---|---|
| frontend/src/main.ts, App.vue | Khởi tạo app, Pinia, router, Bootstrap và banner lỗi. |
| frontend/src/app/ | Router, layout và component dùng toàn app; route guard chỉ hỗ trợ điều hướng. |
| frontend/src/stores/ | Auth/session và trạng thái lỗi dùng chung. |
| frontend/src/modules/auth/pages/ | Đăng nhập và đổi mật khẩu. |
| frontend/src/modules/admin/pages/ | Học sinh, hồ sơ học sinh, nhân sự, lớp/chi tiết lớp, buổi học và duyệt chấm công. |
| frontend/src/modules/staff/pages/ | Buổi được giao, kết quả học tập, chấm công và hồ sơ giáo viên. |
| frontend/src/modules/student/pages/ | Lịch, kết quả, xem lại video buổi đã hoàn tất và chat AI của học sinh đang đăng nhập. |
| frontend/src/services/data-queries.ts | Truy vấn Supabase và chuẩn hóa các quan hệ đọc. |
| frontend/src/services/commands.ts | Lệnh ghi trực tiếp được RLS cho phép, RPC và Edge Function. |
| frontend/src/services/edge-functions.ts | Chuẩn hóa response, lỗi, mã lỗi và trace id. |
| frontend/src/shared/ | Role, kiểu domain, định dạng lỗi, ngày giờ và tiện ích nghiệp vụ. |

## Luồng request

- Truy vấn và CRUD đơn giản có thể gọi Supabase từ frontend; RLS phải giới hạn dữ liệu.
- Thao tác cần kiểm tra server hoặc transaction nghiệp vụ đi qua Edge Function/RPC. Các handler hiện có: admin-account-status, admin-create-user, admin-export-student-logins, admin-reset-password, admin-reset-password-bulk, bootstrap-root, login-by-identifier, session-start, session-complete, session-learning-update, student-ai-tutor, timesheet-submit, timesheet-review.
- Dùng services hiện hành thay vì rải lệnh Supabase trong component khi đã có adapter phù hợp.
- Edge Function dùng helper trong supabase/functions/_shared/; response theo dạng success/data hoặc success/error và trace_id.
- UI/route không phải ranh giới bảo mật; quyền cuối cùng phải được kiểm tra ở database/server.

## Supabase và kiểm thử

- supabase/functions/ chứa handler theo chức năng; _shared/ chứa auth, CORS và response/error.
- supabase/migrations/ chứa schema, hàm, RLS, grant, seed danh mục và các lần hardening; migration hiện có mới nhất là 0049. Đọc migration cụ thể cùng migration thay thế nó trước khi sửa hành vi.
- supabase/tests/ có fixture SQL tổng hợp cho RLS học tập, video buổi học, lập buổi theo tuần/tháng, giới hạn giáo viên, xung đột phòng và chấm công theo buổi.
- frontend tests đặt cạnh source với hậu tố .test.ts. Các script root chuyển tiếp đến workspace frontend.
- .github/workflows/ chứa Quality Check, deploy GitHub Pages và workflow_dispatch deploy Supabase. Có workflow không đồng nghĩa đã được yêu cầu vận hành.
