# Dữ liệu, migrations và bảo mật

## Mô hình đang dùng

- profiles nối auth user với role/trạng thái; students và staff lưu hồ sơ học sinh/giáo viên.
- subjects, grades, classes, class_memberships, class_schedules và class_schedule_staff mô tả lớp, thành viên có hiệu lực theo ngày và lịch lặp.
- sessions gắn trực tiếp class_id, snapshot phòng; session_students giữ roster của buổi; session_staff giữ giáo viên được phân công.
- student_attendances lưu chuyên cần, điểm và nhận xét; audit logs lưu dấu vết thay đổi được cấu hình.
- timesheets hiện chỉ hỗ trợ yêu cầu chấm công theo buổi đã hoàn tất. Database còn các bảng/migration lịch sử ClassMonth, học phí, payroll, accounting và module legacy khác; việc tồn tại không có nghĩa app được dùng lại.

## Chuỗi migration

Migration được đánh số trong supabase/migrations; repo hiện có đến 0051. Luôn đọc file liên quan và phần migration sau đó đã thay đổi cùng object.

- 0036–0038 thêm rồi retire vai trò PARENT; hồ sơ/liên kết lịch sử còn được giữ.
- 0039 chuyển ứng dụng sang lịch lặp, membership liên tục, gắn session với class và chuyển ASSISTANT thành TEACHER.
- 0040 sửa vòng lặp policy RLS bằng helper SECURITY DEFINER với search_path cố định.
- 0041 thêm RPC lập buổi cụ thể, áp mẫu tuần vào tháng, đổi giáo viên và giữ ngoại lệ/lịch sử.
- 0042 mở lại riêng luồng chấm công cho buổi COMPLETED; giáo viên gửi, Admin duyệt/từ chối có lý do, giáo viên có thể gửi lại sau từ chối. Không mở payroll/tài chính.
- 0043 giới hạn tối đa 5 giáo viên duy nhất trên một lớp theo các lịch/buổi còn hiệu lực.
- 0044 lưu phòng trên từng buổi và kiểm tra xung đột xuyên suốt tạo, sao chép và sinh buổi. Lớp khác nhau có thể trùng giờ nếu khác phòng; cùng lớp/học sinh/phòng hoặc thiếu phòng khi giao giờ thì bị chặn.
- 0045 cho phép Admin tạo buổi điểm danh bù trong quá khứ, vẫn giữ kiểm tra quyền, roster, giới hạn giáo viên và xung đột lịch.
- 0046 cho phép Edge Function gọi các RPC bắt đầu, hoàn thành và cập nhật kết quả buổi bằng Supabase secret key không có JWT role claim. Quyền EXECUTE vẫn chỉ cấp cho service_role; RPC vẫn xác minh giáo viên đang hoạt động được phân công.
- 0047 thêm link YouTube tùy chọn cho buổi học và mở rộng RPC học tập mà vẫn giữ EXECUTE chỉ cho service_role; audit lưu link cũ/mới. `student-ai-tutor` chỉ phục vụ học sinh đang hoạt động, kiểm tra quyền sở hữu buổi được chọn và gửi cho Gemini câu hỏi, lịch sử chat cùng tên lớp/môn, ngày và nội dung buổi học; không gửi điểm, chuyên cần, nhận xét cá nhân hoặc video.
- 0048 giới hạn học sinh đang bị buộc đổi mật khẩu khỏi dữ liệu học tập cho đến khi đổi xong; chỉ luồng Edge Function service-role được xóa cờ.
- 0049 mở rộng yêu cầu đổi mật khẩu và chặn RLS của dữ liệu giảng dạy/chấm công cho giáo viên bị reset; hồ sơ vẫn đọc được để hoàn tất đổi mật khẩu.
- 0050 ban đầu thêm RPC đặt lại lịch toàn trung tâm theo kiểu lưu trữ khung lặp và hủy buổi SCHEDULED.
- 0051 thay thao tác reset bằng xóa có preview theo tháng Việt Nam: yêu cầu CLASS_MANAGE, đồng bộ với bộ sinh lịch, xóa khung lặp toàn trung tâm cùng buổi SCHEDULED do lịch lặp sinh ở mọi ngày và buổi tạo riêng trong tháng chọn. Buổi đã hủy/đang diễn ra/hoàn tất và lịch sử liên quan được giữ; snapshot khung lặp được lưu trên buổi còn lại trước khi xóa mẫu. Điểm danh, snapshot kết quả, nội dung buổi, chấm công hoặc payroll liên kết với buổi cần xóa sẽ chặn toàn bộ thao tác. RPC reset cũ bị thu hồi quyền EXECUTE.

Các migration cũ hơn tạo schema nền, role, RBAC, lớp tháng, buổi, điểm danh, tài chính, function, RLS và index. Không suy ra phạm vi sản phẩm hiện tại từ migration cũ.

Khi đổi schema, thêm migration kế tiếp số hiện có; không sửa/xóa/đổi số migration đã có thể được áp dụng. Không áp migration production làm bước kiểm thử.

## Phân quyền

- RLS là lớp bắt buộc cho bảng frontend truy cập. Database/RPC kiểm tra vai trò và quan hệ Admin, teacher được phân công, student sở hữu.
- Các lệnh lập buổi/đổi giáo viên dùng RPC có kiểm tra quyền; không cấp thêm quyền ghi trực tiếp sessions/session_staff cho authenticated để tiện UI.
- timesheets chỉ đọc qua RLS. Gửi/duyệt đi qua Edge Function kiểm tra caller/quyền và RPC service-only; không cấp INSERT/UPDATE/DELETE trực tiếp cho authenticated.
- Edge Functions dùng requireCaller hoặc helper phù hợp; tác vụ đặc quyền phải xác thực caller, kiểm tra role/quyền và giới hạn input ở server.
- Khi thay đổi quan hệ/policy, rà đồ thị đọc/ghi, embed query, helper SECURITY DEFINER, grants và tất cả vai trò bị ảnh hưởng.

Không dựa vào route guard, hidden button, id từ browser hoặc kiểm tra client để bảo vệ dữ liệu.

## Dữ liệu nhạy cảm và secret

- docs/accounts/ là local-only và chứa thông tin truy cập; không mở hoặc đưa nội dung vào output/context, tuyệt đối không stage/commit.
- docs/data_seed/ là workbook nguồn chứa dữ liệu thật; không đọc/trích xuất tên, mã, điểm hoặc tạo fixture từ workbook.
- Fixture nghiệp vụ dùng dữ liệu tổng hợp tiền tố QA-, trong môi trường đúng.
- Secret key, database password, access token và CUSTOM_BOOTSTRAP_SECRET chỉ lưu server/secret manager. Không đặt secret trong VITE_, log, test, context hay phản hồi.
- Bootstrap ROOT dùng scripts/bootstrap-root.sh để nhập tương tác, không lưu credential vào repo.

## Trước khi đổi quyền hoặc dữ liệu

1. Xác định vai trò, dữ liệu và trạng thái nghiệp vụ cần cho phép.
2. Đọc policy RLS/helper hiện hành và tất cả đường đọc/ghi.
3. Xác minh Edge Function/RPC kiểm tra caller, role, input và search_path/grants đúng.
4. Bảo toàn audit/lịch sử; ưu tiên lưu trữ thay cho xóa vật lý.
5. Chỉ dùng dữ liệu tổng hợp; không áp migration production để xác minh.
