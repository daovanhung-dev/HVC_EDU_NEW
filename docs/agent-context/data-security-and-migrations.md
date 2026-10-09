# Mô hình dữ liệu, quyền, migrations và bảo mật

## Mô hình dữ liệu hiện hành

- `auth.users` là danh tính đăng nhập; `profiles` nối user với role, trạng thái và cờ đổi mật khẩu. `students`/`staff` là hồ sơ domain tương ứng.
- `subjects`, `grades`, `classes` là danh mục lớp học. `class_memberships` nối học sinh-lớp theo ngày hiệu lực.
- `class_schedules` và `class_schedule_staff` mô tả lịch lặp/giáo viên theo slot. `sessions` là buổi cụ thể; `session_students` lưu roster buổi; `session_staff` lưu phân công teacher và ngoại lệ.
- `student_attendances` lưu trạng thái điểm danh, phút đi muộn, lý do, thang đánh giá riêng, feedback và nhận xét. `session_students.assessment_snapshot` cùng `sessions.import_metadata` giữ nguồn/import lịch sử.
- `timesheets` hiện là yêu cầu chấm công theo buổi. Audit lưu vết một số thay đổi hồ sơ, membership, lịch, buổi và học tập.
- ClassMonth, fee, payroll, accounting, notification và permission-group tables có thể còn trong database vì lịch sử/compatibility; migration 0039 khóa quyền app đối với luồng tài chính/tháng cũ. Đừng suy ra app hiện hành từ schema cũ.

## Nguồn quyền và ranh giới bảo mật

- RLS và grants giới hạn truy vấn Data API; PostgreSQL constraints/triggers/RPC kiểm tra trạng thái và quan hệ; Edge Function xác thực caller/role/input trước thao tác server-side.
- Route guard, client-side role, id gửi từ browser và nút ẩn chỉ là UI. Không dùng chúng để cấp quyền dữ liệu.
- Teacher chỉ cập nhật session khi là teacher đang hoạt động được phân công; `update_session_learning` chỉ cho session `IN_PROGRESS`. `complete_session` yêu cầu attendance record cho toàn roster. RPC Admin ở migration 0055 sửa roster chỉ cho buổi `SCHEDULED` trong tương lai, kiểm tra `CLASS_MANAGE`, membership hiệu lực và xung đột; dòng đã có attendance/assessment/financial snapshot được bảo toàn.
- Các RPC cập nhật session được gọi qua Edge Function và quyền `EXECUTE` chỉ cấp service role. Handler phải xác thực người dùng rồi mới dùng quyền server.
- Chấm công đọc theo RLS; submit/review qua Edge Function/RPC. Không cấp ghi trực tiếp bảng timesheet cho authenticated chỉ để thuận tiện UI.
- Học sinh bị buộc đổi mật khẩu có thể đọc profile để vào form đổi nhưng không đọc learning data cho đến khi hoàn tất. Kiểm tra cả status active và quan hệ sở hữu/roster khi thay RLS.
- Với thay đổi quyền, lần theo toàn đồ thị: query embed → grants → policy → SECURITY DEFINER helper/search_path → RPC → Edge Function → frontend/test.

## Attendance/assessment và dữ liệu học tập

Schema và RPC dùng các mức riêng: BTVN nullable 0–10, understanding nullable 1–5, attitude nullable 1–5; `late_minutes` nullable nhưng không âm; feedback count nullable và không âm. Attendance status phải có khi lưu; trạng thái `LATE` có thể kèm số phút, còn lý do vắng là text tùy chọn cho `ABSENT`/`EXCUSED` ở frontend. Không có điểm tổng trong schema/code hiện hành.

Các nguồn xác minh: `frontend/src/modules/staff/attendance.ts`, `frontend/src/modules/staff/components/StaffAttendanceModal.vue`, `frontend/src/modules/student/pages/StudentPage.vue`, migrations 0009/0034/0039/0047 và test learning liên quan. Form client không thay validation database.

Import assessment có thể giữ hàng nguồn kể cả khi chưa có attendance status trong `assessment_snapshot`; không tự chuyển mọi giá trị raw sang điểm chuẩn hóa. Migration 0035 là migration dữ liệu attendance lịch sử: không chép row-level names/comments vào tài liệu hoặc fixture, và không dùng để tạo dữ liệu QA.

## Lịch sử migration trong repo

Migration phải được đọc theo thứ tự và kiểm tra migration sau có `CREATE OR REPLACE`, revoke/grant hoặc thay đổi cùng object. Hiện repo có `0001–0055`:

- `0001–0006`: extension, enum, Auth/profile, RBAC, hồ sơ student/staff và danh mục học thuật/lớp.
- `0007–0019`: mô hình ClassMonth/session/attendance/timesheet và các bảng tài chính/notification/audit/function/RLS/index/seed của giai đoạn đầu. Phần tháng và tài chính hiện là lịch sử hoặc bị khóa khỏi app.
- `0020–0035`: sửa/hardening function, RPC cốt lõi, lịch/hoàn tất, quyền Admin, khối/môn, RLS recursion, snapshot phí/phòng/giáo viên theo lịch tháng và các trường assessment/import. Đọc [inventory](repository-inventory.md) để biết vai trò từng migration.
- `0036–0038`: thêm rồi retire Parent, giữ quan hệ lịch sử.
- `0039`: kiến trúc hiện hành chuyển sang membership liên tục, lịch lặp và session theo ngày; Assistant chuyển thành Teacher; app quyền với ClassMonth/tài chính cũ bị gỡ.
- `0040`: tránh RLS recursion cho mô hình liên tục bằng helper SECURITY DEFINER với search path cố định.
- `0041–0042`: lập session cụ thể/mẫu tuần theo tháng; phục hồi riêng chấm công cho session hoàn tất.
- `0043–0046`: giới hạn 5 teacher duy nhất/lớp, xung đột theo phòng, buổi điểm danh bù và RPC session chỉ dành service role.
- `0047–0049`: video YouTube, AI học tập, ép học sinh/giáo viên đổi mật khẩu và chặn learning data trong lúc cờ reset còn bật.
- `0050–0052`: các RPC quản lý/xóa lịch tháng nối tiếp nhau; 0050/0051 bị thu hồi/thay thế. 0052 là xóa buổi trong tháng đã chọn cùng dữ liệu liên kết, có preview, khóa và audit. Đây là thao tác phá hủy, không phải quy trình chỉnh lịch thông thường.
- `0053–0054`: thay lịch tháng bằng buổi từ mẫu tuần, rồi đồng bộ membership có hiệu lực vào roster session thủ công tương lai.
- `0055`: sửa roster buổi theo membership hiệu lực/ngày buổi, bảo toàn dòng có lịch sử, xóa cứng buổi tương lai trống có quyền Admin và ghi tombstone cho ngày của buổi lặp.

Không sửa, xóa hoặc đổi số migration đã có thể chạy ở môi trường khác. Thay đổi schema bằng migration tiếp theo. Migration production cần yêu cầu rõ và kiểm tra target/backup/migration history trực tiếp; local test không cần áp vào production.

## Edge Functions

- `supabase/functions/_shared/auth.ts`: xác thực caller/hồ sơ; `cors.ts`: preflight; `response.ts`: success/error/trace id; `password-reset.ts`: helper reset.
- Account handlers tạo/khóa/reset tài khoản hoặc bootstrap ROOT là đường đặc quyền; chỉ trả thông tin cần thiết và giữ audit.
- `session-start`, `session-complete`, `session-learning-update` xác thực teacher và gọi RPC service-only.
- `timesheet-submit` và `timesheet-review` thực thi submit/review theo role và trạng thái.
- `student-ai-tutor` kiểm tra học sinh/session; chỉ gửi prompt và ngữ cảnh học được cho phép. `teacher-comment-optimize` gửi comment giáo viên tới Gemini; coi đây là dữ liệu truyền cho dịch vụ bên ngoài.
- Đọc handler/index/config cụ thể trước khi sửa. Không dùng danh sách function trong báo cáo cũ để kết luận endpoint production hiện còn deploy hay không.

## Dữ liệu nhạy cảm và secret

- Không đọc, sao chép, hiển thị hoặc dùng nội dung `docs/accounts/` và `docs/data_seed/`. Workbook nguồn là dữ liệu bảo vệ; không trích danh tính/điểm để tạo context hoặc fixture.
- Không đưa secret key, database password, access token, `CUSTOM_BOOTSTRAP_SECRET` hoặc thông tin đăng nhập vào `VITE_`, source, log, test, context hay output. Frontend chỉ nhận URL Supabase, publishable key và base path.
- `docs/plans/` và báo cáo QA có thể lưu chi tiết định danh/hoạt động cũ; chỉ dùng để hiểu vai trò lịch sử, không sao chép nội dung vào context.
- Dùng dữ liệu synthetic có tiền tố `QA-`. Không stage/commit file local-only.
- Bootstrap ROOT dùng `scripts/bootstrap-root.sh` với nhập tương tác; không ghi credential ra file.

## Trước khi thay quyền hoặc dữ liệu

1. Xác định actor/role, trạng thái, hàng dữ liệu và luồng đọc/ghi cần thiết.
2. Đọc policy/RPC/function đang hiệu lực trong migration history của repo; tìm mọi migration sau đó chạm cùng object.
3. Kiểm tra caller, role, input, lock/transaction, grants, `search_path`, audit và hành vi lỗi.
4. Bảo toàn lịch sử học tập; ưu tiên archive/soft change nếu nghiệp vụ cho phép.
5. Dùng Supabase local/fixture QA- để kiểm tra. Production cần yêu cầu rõ, xác minh project đích và backup; không reset/seed/ghi/xóa/deploy để thử.
