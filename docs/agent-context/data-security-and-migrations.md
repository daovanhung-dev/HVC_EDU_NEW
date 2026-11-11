# Mô hình dữ liệu, quyền, migrations và bảo mật

## Quy tắc API hiện hành

- Supabase là backend duy nhất. Đọc/CRUD đơn giản dùng Data API dưới RLS/grants; nghiệp vụ server-side dùng Edge Function. Không tạo hoặc gọi RPC API (`supabase.rpc`/PostgREST RPC), kể cả từ Edge Function.
- Helper/trigger SQL nội bộ không được gọi như API vẫn được phép. RPC/caller hiện có trong source hoặc migration là legacy; khi phạm vi công việc chạm tới luồng đó, chuyển phần liên quan sang Edge Function.

## Mô hình dữ liệu hiện hành

- `auth.users` là danh tính đăng nhập; `profiles` nối user với role, trạng thái và cờ đổi mật khẩu. `students`/`staff` là hồ sơ domain tương ứng.
- `subjects`, `grades`, `classes` là danh mục lớp học. `class_memberships` nối học sinh-lớp theo ngày hiệu lực.
- `class_schedules` và `class_schedule_staff` mô tả lịch lặp/giáo viên theo slot. `sessions` là buổi cụ thể; `session_students` lưu roster buổi; `session_staff` lưu phân công teacher và ngoại lệ.
- `room_rentals` lưu lượt thuê cụ thể gồm giáo viên, tên phòng, thời gian và trạng thái `BOOKED`/`CANCELLED`; không có roster/attendance. Admin/ROOT_ADMIN đọc qua RLS; ghi/đổi/hủy chỉ qua Edge Function `admin-room-rentals` với transaction PostgreSQL và audit.
- `month_week_schedule_templates` và `month_week_schedule_occurrences` giữ workbook tuần theo tháng cùng liên kết đến các buổi được khớp/tạo; luồng RPC `CLASS_MANAGE` trong lịch sử/source hiện có là legacy, không thay lịch lặp `class_schedules` và không được mở rộng.
- `student_attendances` lưu trạng thái điểm danh, phút đi muộn, lý do, thang đánh giá riêng, feedback và nhận xét. `session_students.assessment_snapshot` cùng `sessions.import_metadata` giữ nguồn/import lịch sử.
- `timesheets` hiện là yêu cầu chấm công theo buổi. Audit lưu vết một số thay đổi hồ sơ, membership, lịch, buổi và học tập.
- ClassMonth, fee, payroll, accounting, notification và permission-group tables có thể còn trong database vì lịch sử/compatibility; migration 0039 khóa quyền app đối với luồng tài chính/tháng cũ. Đừng suy ra app hiện hành từ schema cũ.

## Nguồn quyền và ranh giới bảo mật

- RLS và grants giới hạn truy vấn Data API; PostgreSQL constraints/triggers và helper SQL nội bộ kiểm tra trạng thái/quan hệ; Edge Function xác thực caller/role/input và xử lý nghiệp vụ server-side.
- Route guard, client-side role, id gửi từ browser và nút ẩn chỉ là UI. Không dùng chúng để cấp quyền dữ liệu.
- Các luồng RPC session/quản trị dưới đây mô tả implementation legacy hiện có. Teacher chỉ cập nhật session khi là teacher đang hoạt động được phân công; `update_session_learning` chỉ cho session `IN_PROGRESS`; `complete_session` yêu cầu attendance record cho toàn roster. Từ migration 0056, Admin có thể hiệu chỉnh lịch và learning data cho session chưa hủy; migration 0059 chuyển việc ghi attendance sang RPC Admin cùng quyết định công cho toàn bộ teacher. Migration 0062 cho phép RPC đó kết thúc sớm `IN_PROGRESS`, nhưng vẫn chặn `SCHEDULED` trước giờ kết thúc; nó ghi `ended_at`/`ended_by`, attendance, timesheet và audit nguyên tử. RPC `admin_set_completed_session_timesheets` kiểm tra `ACADEMIC_MANAGE` + `TIMESHEET_APPROVE`, chỉ cập nhật quyết định/timesheet cho session `COMPLETED` và không ghi attendance. Roster/phân công vẫn khóa sau khi Admin chốt. `admin_preview_delete_session` và `admin_delete_session` yêu cầu `CLASS_MANAGE`; xóa buổi chưa hủy cùng roster, assignment, attendance, snapshots, replacement, timesheet và payroll item liên kết; giữ audit, payroll period và tombstone lịch lặp. Lệnh xóa bỏ qua trigger khóa roster chỉ cho đúng session đang được RPC xóa, sau khi quyền được kiểm tra. Không dùng các API này làm mẫu cho thay đổi mới.
- RPC Teacher `start_session`, `complete_session` và `update_session_learning` hiện được gọi qua Edge Function với `EXECUTE` chỉ cấp service role; handler xác thực caller trước khi dùng quyền server. RPC quản trị lịch/buổi hiện được gọi bằng authenticated client và tự kiểm tra quyền trong PostgreSQL. Đây đều là luồng legacy; khi sửa, thay RPC bằng Edge Function.
- Chấm công đọc theo RLS; submit/review có Edge Function cùng lời gọi RPC legacy hiện có. Không tạo RPC caller mới hoặc cấp ghi trực tiếp bảng timesheet cho authenticated chỉ để thuận tiện UI.
- Học sinh bị buộc đổi mật khẩu có thể đọc profile để vào form đổi nhưng không đọc learning data cho đến khi hoàn tất. Kiểm tra cả status active và quan hệ sở hữu/roster khi thay RLS.
- Với thay đổi quyền, lần theo toàn đồ thị: query embed → grants → policy → SECURITY DEFINER helper/search_path → Edge Function → frontend/test; nếu gặp RPC caller cũ, ghi nhận là legacy và chuyển phần liên quan khi phạm vi công việc chạm tới.

## Attendance/assessment và dữ liệu học tập

Schema hiện hành (bao gồm implementation RPC legacy) dùng các mức riêng: BTVN nullable 0–10, understanding nullable 1–5, attitude nullable 1–5; `late_minutes` nullable nhưng không âm; feedback count nullable và không âm. Attendance status phải có khi lưu; trạng thái `LATE` có thể kèm số phút, còn lý do vắng là text tùy chọn cho `ABSENT`/`EXCUSED` ở frontend. Không có điểm tổng trong schema/code hiện hành.

Các nguồn xác minh: `frontend/src/modules/staff/attendance.ts`, `frontend/src/modules/staff/components/StaffAttendanceModal.vue`, `frontend/src/modules/student/pages/StudentPage.vue`, migrations 0009/0034/0039/0047/0059/0060/0061/0062 và test learning liên quan. Form client không thay validation database.

Import assessment có thể giữ hàng nguồn kể cả khi chưa có attendance status trong `assessment_snapshot`; không tự chuyển mọi giá trị raw sang điểm chuẩn hóa. Migration 0035 là migration dữ liệu attendance lịch sử: không chép row-level names/comments vào tài liệu hoặc fixture, và không dùng để tạo dữ liệu QA.

## Lịch sử migration trong repo

Migration phải được đọc theo thứ tự và kiểm tra migration sau có `CREATE OR REPLACE`, revoke/grant hoặc thay đổi cùng object. Các RPC trong phần này là lịch sử schema/implementation legacy; không tạo hoặc gọi chúng cho thay đổi mới. Hiện repo có `0001–0066`:

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
- `0056`: cho phép Admin hiệu chỉnh lịch/giáo viên/roster và nội dung/điểm danh của buổi chưa hủy; giữ trạng thái, giờ thực tế và dữ liệu chấm công/tài chính, kiểm tra quyền, xung đột và audit trước/sau.
- `0057`: giữ nguyên RPC xóa tháng nhưng thêm điều kiện theo khóa chính vào lệnh dọn mẫu lịch, đáp ứng cơ chế production từ chối `DELETE` không có `WHERE`.
- `0058`: thêm mẫu lịch Excel riêng theo tháng và RPC preview/import có khóa đồng bộ, quyền `CLASS_MANAGE`, kiểm tra conflict toàn lô, audit, tạo buổi từ membership hiệu lực và giữ/hủy an toàn buổi hiện có.
- `0059`: thêm quyết định tính công theo phân công và trạng thái `REVOKED`; RPC Admin yêu cầu `ACADEMIC_MANAGE` + `TIMESHEET_APPROVE`, đủ roster/trạng thái/giáo viên và lưu completion, attendance, timesheet, audit trong một giao dịch. RPC submit giữ nguyên quyền service role nhưng chặn giáo viên có quyết định `false`; RPC sửa learning cũ chỉ còn cập nhật metadata. Roster/phân công được khóa sau lần Admin chốt.
- `0060`: thêm RPC đọc `timesheet_eligible` theo session cho người có `ACADEMIC_VIEW` hoặc teacher đang hoạt động được phân công; thu hồi quyền public/anon và chỉ cấp `EXECUTE` cho authenticated. Không cấp quyền đọc trực tiếp cột `session_staff.timesheet_eligible`.
- `0061`: cho Admin hiệu chỉnh schedule, metadata và attendance của session đã `COMPLETED`, giữ nguyên roster, phân công teacher, quyết định công và financial snapshots.
- `0062`: cho Admin kết thúc `IN_PROGRESS` sớm sau khi đủ attendance/teacher decisions; thêm RPC quyết định timesheet riêng cho completed session; preview và mở rộng xóa một session chưa hủy cùng dữ liệu phụ thuộc, giữ audit, kỳ payroll và tombstone lịch lặp.
- `0063`: cho Admin có `CLASS_MANAGE` sửa ngày bắt đầu membership và đồng bộ roster các buổi `SCHEDULED` tương lai chưa bắt đầu trong cùng lớp; giữ nguyên buổi có attendance, audit membership/roster và rollback toàn bộ khi có xung đột.
- `0064`: lịch sử thêm RPC preview/apply lịch mẫu theo tháng; chỉ cập nhật buổi trùng tương lai đủ điều kiện, bảo toàn lịch cũ và lịch sử, kiểm tra xung đột trong cùng transaction, đồng thời không đặt override toàn tháng cho lịch lặp.
- `0065`: gỡ hai RPC template và planner bền vững; luồng thêm lịch mẫu hiện dùng Edge Function `admin-month-week-template-addition` với transaction PostgreSQL trực tiếp.
- `0066`: thêm `room_rentals`, RLS đọc Admin, trigger chặn xung đột với buổi/lịch lặp/lượt thuê, và kiểm tra ngược khi ghi lịch lớp; Edge Function `admin-room-rentals` xử lý tạo đơn/mẫu tháng, đổi lịch, hủy mềm và audit trong transaction.

Không sửa, xóa hoặc đổi số migration đã có thể chạy ở môi trường khác. Thay đổi schema bằng migration tiếp theo. Migration production cần nằm trong phạm vi công việc và phải kiểm tra target/backup/migration history trực tiếp; local test không cần áp vào production.

## Edge Functions

- `supabase/functions/_shared/auth.ts`: xác thực caller/hồ sơ; `cors.ts`: preflight; `response.ts`: success/error/trace id; `password-reset.ts`: helper reset.
- Account handlers tạo/khóa/reset tài khoản hoặc bootstrap ROOT là đường đặc quyền; chỉ trả thông tin cần thiết và giữ audit.
- `session-start`, `session-complete`, `session-learning-update` hiện xác thực teacher rồi gọi RPC service-only legacy; không mở rộng cách làm này. `admin-month-week-template-addition` xác thực Admin có `CLASS_MANAGE`, dựng planner trong `pg_temp` của transaction hiện hành, rồi ghi buổi/roster/audit trực tiếp, không gọi PostgREST RPC; dùng mẫu Edge Function này cho luồng mới cần thay RPC.
- `admin-room-rentals` xác thực role Admin/ROOT_ADMIN, kiểm tra giáo viên đang hoạt động, khóa cạnh tranh lịch, ghi các lượt tháng toàn bộ hoặc từ chối toàn bộ, và giữ hủy/audit trong cùng transaction; không gọi RPC API.
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
2. Đọc policy, Edge Function và helper SQL nội bộ trong migration history; nếu luồng hiện có gọi RPC, đánh dấu là legacy và chuẩn bị chuyển phần liên quan sang Edge Function.
3. Kiểm tra caller, role, input, lock/transaction, grants, `search_path`, audit và hành vi lỗi.
4. Bảo toàn lịch sử học tập; ưu tiên archive/soft change nếu nghiệp vụ cho phép.
5. Dùng Supabase local/fixture QA- để kiểm tra. Production cần yêu cầu rõ, xác minh project đích và backup; không reset/seed/ghi/xóa/deploy để thử.
