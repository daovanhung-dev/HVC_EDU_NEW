# Kiến trúc và bản đồ mã nguồn

## Kiến trúc

- Frontend: Vue 3, TypeScript, Vue Router, Pinia, Bootstrap và Vite; build tĩnh lên GitHub Pages.
- Backend: Supabase PostgreSQL, Auth, Row Level Security (RLS), Edge Functions và Supabase Cron.
- Ứng dụng dùng hash routing để chạy trên GitHub Pages; Vite base path được cấu hình qua VITE_APP_BASE_PATH.
- Frontend dùng publishable key. Các Edge Function được chia sẻ helper xác thực, CORS, response/error và có thể dùng admin client với secret phía server.

## Các điểm vào chính

| Khu vực | Vai trò |
|---|---|
| frontend/src/main.ts, App.vue | Khởi tạo Vue, Pinia, Bootstrap, router và banner lỗi toàn app. |
| frontend/src/app/router/index.ts | Khai báo route, khởi tạo phiên và điều hướng theo vai trò; đây không phải ranh giới bảo mật dữ liệu. |
| frontend/src/stores/auth.store.ts | Khôi phục Supabase session, tải profile, đăng nhập qua Edge Function, đổi mật khẩu và đăng xuất. |
| frontend/src/modules/admin/pages/ | Màn hình học sinh, chi tiết học sinh, nhân sự, lớp, chi tiết lớp, buổi học và duyệt chấm công của Admin. |
| frontend/src/modules/staff/pages/ | Danh sách buổi được giao, điểm danh/kết quả, gửi chấm công và hồ sơ cá nhân của giáo viên. |
| frontend/src/modules/student/pages/ | Lịch học và kết quả học tập của tài khoản STUDENT hiện tại. |
| frontend/src/services/data-queries.ts | Truy vấn Supabase cho dữ liệu danh sách, quan hệ lớp, buổi và kết quả học tập. |
| frontend/src/services/commands.ts | Ghi dữ liệu và gọi RPC/Edge Function cho thao tác nghiệp vụ. |
| frontend/src/services/edge-functions.ts | Chuẩn hóa response, lỗi, mã lỗi và trace id từ Edge Functions. |
| frontend/src/shared/types/domain.ts | Kiểu dữ liệu frontend cho profile, lớp, lịch, buổi, điểm danh, yêu cầu chấm công và lịch sử học tập. |
| frontend/src/shared/utils/errors.ts | Chuyển lỗi kỹ thuật thành thông báo UI an toàn, có mã/trace id. |
| supabase/functions/ | Handler Deno cho đăng nhập, quản lý tài khoản và luồng buổi học; _shared/ chứa helper dùng chung. |
| supabase/migrations/ | Schema, hàm nghiệp vụ, policy RLS, seed master và thay đổi theo thứ tự migration. |
| .github/workflows/ | Quality check, deploy GitHub Pages và deploy Supabase. |

## Luồng request

- Truy vấn và CRUD được phép gọi Supabase trực tiếp từ frontend; database RLS phải giới hạn dữ liệu theo người dùng.
- Thao tác nhạy cảm hoặc nhiều bước đi qua Edge Function rồi RPC trong database. Ví dụ: admin-create-user, login-by-identifier, session-start, session-complete, session-learning-update, timesheet-submit và timesheet-review.
- Dùng services/data-queries.ts cho truy vấn, services/commands.ts cho lệnh và các adapter đã có. Tránh gọi Supabase trực tiếp rải rác trong component.
- Edge Function trả response theo dạng success/data hoặc success/error, kèm trace_id. Dùng helper trong supabase/functions/_shared/ thay vì tự tạo định dạng khác.
- Auth frontend loại PARENT và ASSISTANT lịch sử khỏi phiên hợp lệ; danh sách vai trò hoạt động hiện tại là ROOT_ADMIN, ADMIN, TEACHER và STUDENT.

## Giới hạn bảo mật và tin cậy

Frontend và route guard có thể bị bỏ qua. Chỉ policy RLS, kiểm tra quyền trong Edge Function/RPC và quyền PostgreSQL mới là căn cứ cho phép dữ liệu/thao tác.

Không đưa secret key hoặc admin client vào bundle trình duyệt. Không biến một chức năng thành quyền rộng hơn bằng cách chỉ thêm nút hoặc route; cập nhật kiểm tra server-side và RLS khi phạm vi dữ liệu thay đổi.
