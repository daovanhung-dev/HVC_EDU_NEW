# Dữ liệu, migrations và bảo mật

## Mô hình dữ liệu đang dùng

- profiles nối auth user với vai trò và trạng thái tài khoản.
- students và staff lưu hồ sơ học sinh/giáo viên.
- subjects, grades và classes lưu danh mục học thuật và lớp.
- class_memberships lưu quan hệ học sinh-lớp theo ngày.
- class_schedules và class_schedule_staff lưu lịch lặp và giáo viên theo lịch.
- sessions lưu buổi gắn trực tiếp với class_id; session_students giữ roster/snapshot của buổi; session_staff giữ giáo viên được phân công.
- student_attendances lưu điểm danh, điểm và nhận xét theo học sinh/buổi.
- audit logs lưu dấu vết các thay đổi học tập và hồ sơ được cấu hình để audit.

Database cũng còn nhiều bảng ClassMonth và bảng tài chính/chấm công từ thiết kế trước. Migration 0039 chuyển luồng hiện hành sang lịch và thành viên liên tục, đồng thời thu hồi quyền app với các bảng cũ. Không coi bảng còn tồn tại là bằng chứng chức năng đó vẫn được hỗ trợ.

## Chuỗi migration

Migration theo thứ tự số trong supabase/migrations. Các thay đổi lớn cuối chuỗi:

- 0036 thêm role PARENT và quan hệ phụ huynh-học sinh.
- 0037 xác định phạm vi quyền học tập mới.
- 0038 retire PARENT khỏi đăng nhập/quyền truy cập nhưng giữ profile/link lịch sử.
- 0039 tạo lịch lặp, mapping giáo viên theo lịch, gắn session với lớp, chuyển ASSISTANT sang TEACHER, siết quyền database và thêm hàm vận hành liên tục.
- 0040 thay các policy đọc chéo bảng bằng helper `SECURITY DEFINER` có `search_path` cố định để tránh vòng lặp RLS; kiểm thử vai trò nằm trong `supabase/tests/continuous_learning_rls.test.sql`.
- 0041 bổ sung cờ nhận diện buổi tạo thủ công và ngoại lệ phân công giáo viên; thêm các RPC Admin để tạo buổi, áp dụng tuần mẫu vào tháng và đổi giáo viên cho một buổi. RPC kiểm tra quyền, roster theo ngày, xung đột lịch và ghi audit. Generator giữ nguyên buổi thủ công/ngoại lệ giáo viên; lưu trữ lịch lặp hủy buổi tương lai còn SCHEDULED mà không xóa lịch sử. Fixture kiểm thử tổng hợp nằm ở `supabase/tests/admin_monthly_session_planning.test.sql`.
- 0042 mở lại riêng chấm công theo buổi đã hoàn tất: giáo viên được phân công gửi yêu cầu, Admin duyệt/từ chối kèm lý do, giáo viên chỉ đọc yêu cầu của mình và có thể gửi lại sau khi bị từ chối. RPC chỉ cho service role gọi; Edge Function xác thực vai trò trước khi gọi. Fixture tổng hợp nằm ở `supabase/tests/timesheet_workflow.test.sql`. Migration này không mở payroll, học phí hoặc kế toán.

Các migration cũ hơn tạo schema nền, enums, auth/profile, RBAC, hồ sơ, lớp/tháng, buổi, điểm danh, tài chính, hàm, RLS, index và các lần hardening. Đọc migration cụ thể trước khi sửa để hiểu dữ liệu lịch sử và ràng buộc tương thích.

Khi đổi schema, thêm migration mới kế tiếp số hiện có. Không sửa file migration đã tồn tại chỉ để làm cho schema local đẹp hơn: môi trường khác có thể đã áp dụng migration đó. Migration production phải được đánh giá theo lịch sử áp dụng thực tế.

## Phân quyền và dữ liệu

- RLS là lớp bắt buộc cho bảng được truy cập từ frontend. Quyền Admin, giáo viên được phân công và học sinh chủ sở hữu được đánh giá trong PostgreSQL.
- Các RPC lịch của migration 0041 là đường ghi cho thao tác tạo/copy buổi và đổi giáo viên; không cấp quyền ghi trực tiếp mới vào bảng sessions/session_staff cho frontend. Phân công giáo viên của từng buổi tiếp tục là căn cứ database cho quyền thao tác học tập.
- Bảng `timesheets` chỉ đọc qua RLS: Admin xem hàng đợi, giáo viên chỉ xem yêu cầu thuộc hồ sơ của mình. Không cấp INSERT/UPDATE/DELETE trực tiếp cho authenticated; Edge Function kiểm tra TEACHER được phân công hoặc ADMIN trước khi gọi RPC service-only.
- Giáo viên chỉ truy cập những buổi/lớp được phân công và được phép chỉnh sửa dữ liệu học tập trong luồng được giao.
- Học sinh chỉ đọc hồ sơ, lịch và kết quả của mình; kết quả bị giới hạn theo trạng thái hoàn tất của buổi.
- Các Edge Function xác thực JWT/profile đang hoạt động qua helper requireCaller. Tác vụ cần đặc quyền dùng server-side secret và phải xác nhận vai trò/quyền ở server hoặc RPC.
- ADMIN và ROOT_ADMIN dùng luồng Admin; nhóm permission động là dữ liệu legacy và không còn là cơ chế mở rộng quyền của UI hiện hành.

Không dựa vào điều kiện route, id được truyền từ trình duyệt, hoặc kiểm tra client-side để bảo vệ dữ liệu. Khi thay đổi quan hệ bảng hoặc policy, rà lại cả đường đọc, ghi, RPC/SECURITY DEFINER và các vai trò bị ảnh hưởng.

## Dữ liệu nhạy cảm và secrets

- docs/accounts/ bị loại khỏi Git bằng cấu hình local trong .git/info/exclude và chứa thông tin tài khoản nhạy cảm. Không mở hoặc đưa nội dung vào output/context nếu nhiệm vụ không bắt buộc; tuyệt đối không stage/commit các tệp này.
- docs/data_seed/ chứa workbook nguồn và được theo dõi trong repo. Xem đây là dữ liệu học sinh thật; không trích xuất tên, điểm, mã học sinh hoặc tạo dữ liệu kiểm thử từ workbook.
- Dữ liệu QA phải tổng hợp, có prefix QA- và được tạo trong môi trường đúng. Không dùng tài khoản học sinh/giáo viên thật để dựng fixture.
- Frontend chỉ nhận VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY và VITE_APP_BASE_PATH. Secret key, database password, access token và CUSTOM_BOOTSTRAP_SECRET chỉ lưu trong Supabase/GitHub Secrets.
- Không ghi credential hoặc token vào log, test snapshot, issue, context, commit hay phản hồi. Khi bootstrap, dùng scripts/bootstrap-root.sh để nhập tương tác thay vì lưu mật khẩu vào file.

## Thay đổi quyền cần rà soát

Trước khi thêm hoặc sửa bảng/cột/API:

1. Xác định vai trò nào cần đọc/ghi và mốc trạng thái nghiệp vụ nào cho phép.
2. Kiểm tra policy RLS hiện tại và các helper được gọi từ policy.
3. Kiểm tra Edge Function/RPC có xác thực người gọi, kiểm tra quyền và giới hạn input.
4. Bảo toàn audit và lịch sử học tập; ưu tiên trạng thái lưu trữ thay cho xóa vật lý.
5. Chỉ xác minh bằng dữ liệu tổng hợp. Không áp migration production như một bước kiểm thử.
