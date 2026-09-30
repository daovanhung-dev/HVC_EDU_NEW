# Nghiệp vụ và luồng sử dụng

## Vai trò

| Vai trò | Quyền và luồng chính |
|---|---|
| ROOT_ADMIN | Dùng giao diện Admin; quản lý hoạt động của trung tâm và tài khoản quản trị. |
| ADMIN | Quản lý học sinh, giáo viên, lớp, lịch lặp và buổi học. |
| TEACHER | Xem các buổi được phân công, bắt đầu buổi, ghi nhận việc học, hoàn thành buổi, gửi chấm công cho buổi đã hoàn tất và sửa thông tin liên hệ cá nhân. |
| STUDENT | Xem lịch và hồ sơ học tập thuộc tài khoản học sinh của mình. Phụ huynh dùng chung thông tin đăng nhập với học sinh. |

ASSISTANT là vai trò lịch sử; migration 0039 đổi hồ sơ và phân công hiện có sang TEACHER, giữ nguyên user id và lịch sử. PARENT là vai trò lịch sử; migration 0038 chặn quyền xem dữ liệu học sinh, còn các profile/link lịch sử được giữ lại.

## Lớp và thành viên lớp

- classes lưu thông tin lớp, môn, khối và chính sách sĩ số.
- class_memberships xác định học sinh thuộc lớp trong khoảng ngày bắt đầu/kết thúc. Kết thúc xếp lớp không xóa lịch sử.
- Admin tạo hoặc cập nhật hồ sơ, lưu trữ hồ sơ thay vì xóa lịch sử, và quản lý danh sách thành viên lớp.
- Thành viên lớp hiện hành được dùng để dựng roster cho các buổi sắp tới.

## Lịch lớp và sinh buổi

- class_schedules lưu thứ trong tuần, giờ bắt đầu/kết thúc, phòng và trạng thái của từng lịch lặp. class_schedule_staff gắn giáo viên với từng lịch.
- Admin quản lý lịch ở trang **Buổi học**. Chi tiết lớp tập trung vào roster và có liên kết sang trang Buổi học đã lọc theo lớp.
- Trang Buổi học có chế độ tháng, tuần, danh sách và bộ lọc lớp. Admin có thể tạo buổi cụ thể, đổi giờ/giáo viên, hoặc hủy buổi bằng trạng thái; cột thời gian hiển thị giờ bắt đầu–kết thúc.
- Admin có thể chọn các buổi SCHEDULED trong tuần đang xem làm mẫu rồi áp dụng cho tháng đang chọn. Hệ thống giữ thứ, giờ, thời lượng, lớp và giáo viên; bỏ qua ngày đã qua/ngày mẫu và từ chối toàn bộ đợt nếu có xung đột. Các bản sao là buổi theo ngày cụ thể, không lặp sang tháng tiếp theo.
- class_schedule_staff là phân công cố định theo khung thứ/giờ. Buổi kế thừa giáo viên của khung phù hợp; Admin có thể ghi đè phân công riêng cho một buổi mà không đổi các buổi cùng lịch.
- Mỗi lớp được phân công tối đa 5 giáo viên duy nhất, gộp các lịch chưa lưu trữ và buổi SCHEDULED/IN_PROGRESS. Một giáo viên được dùng ở nhiều khung/buổi vẫn chỉ chiếm một vị trí. Lịch ARCHIVED và buổi COMPLETED/CANCELLED không tính; database kiểm tra để mọi đường ghi cùng tuân thủ.
- Lịch chuyển đổi từ ClassMonth được tạo ở trạng thái INACTIVE. Admin cần kiểm tra roster và giáo viên trước khi bật lịch.
- Lịch ACTIVE sinh buổi SCHEDULED cho 30 ngày tới theo Asia/Ho_Chi_Minh. docs/IMPLEMENTATION.md ghi job Supabase Cron chạy hằng ngày lúc 17:00 UTC; xác minh migration/cấu hình backend hiện hành trước khi dựa vào lịch chạy này.
- Hàm sinh buổi có cơ chế chống chạy đồng thời và ràng buộc duy nhất cho một lần xuất hiện của lịch. Nó cập nhật roster và giáo viên cho buổi chưa bắt đầu, đồng thời giữ nguyên buổi đã bắt đầu hoặc hoàn thành. Buổi tạo thủ công được đánh dấu để generator không nhận nhầm hoặc ghi đè.
- Admin có thể hủy hoặc đổi giờ buổi SCHEDULED trong tương lai. Thao tác riêng được đánh dấu bằng schedule_override để việc sinh lịch không ghi đè quyết định đó.
- Lưu trữ khung lịch chuyển trạng thái sang ARCHIVED và hủy buổi tương lai còn SCHEDULED; buổi đã bắt đầu/hoàn tất và dữ liệu học tập vẫn được giữ.

Các ngày trong tuần lưu theo ISO: 1 là Thứ Hai, 7 là Chủ Nhật.

## Luồng buổi học

Trạng thái buổi: SCHEDULED → IN_PROGRESS → COMPLETED; buổi trong tương lai có thể chuyển CANCELLED. Teacher được phân công bắt đầu buổi và nhập nội dung, điểm danh, đánh giá, ghi chú BTVN và nhận xét. Hoàn thành buổi yêu cầu mọi học sinh trong roster đã có trạng thái điểm danh; việc kiểm tra nằm trong RPC ở database.

Trạng thái điểm danh: PRESENT, LATE, ABSENT, EXCUSED. Các đánh giá hiện có gồm homework_score 0–10, understanding_score 1–5, attitude_score 1–5, positive_feedback_count và trường ghi chú/văn bản. Một số trường có thể để trống.

Học sinh xem lịch và lịch sử của mình; kết quả học tập chỉ được đọc sau khi buổi hoàn tất theo chính sách dữ liệu. Không dùng route hay bộ lọc giao diện làm căn cứ bảo mật.

## Chấm công theo buổi

- Chỉ giáo viên được phân công cho buổi COMPLETED mới gửi yêu cầu chấm công; mỗi giáo viên/buổi chỉ có một yêu cầu đang chờ hoặc đã duyệt.
- Giáo viên chỉ xem yêu cầu gắn với hồ sơ nhân sự của mình. Admin xem danh sách yêu cầu và duyệt hoặc từ chối; từ chối phải có lý do.
- Giáo viên có thể gửi lại yêu cầu sau khi bị từ chối; yêu cầu đã duyệt không thể gửi lại.
- Đây là xác nhận công dạy theo buổi, không ghi giờ vào/ra, không tính payroll và không khôi phục nghiệp vụ tài chính cũ.

## Ngoài phạm vi ứng dụng hiện hành

Không tạo tháng vận hành mới và không đưa UI/API cho học phí, payroll, accounting, báo cáo/xuất file, dashboard thống kê, notification hoặc permission group động vào app chỉ vì chúng còn trong tài liệu/database lịch sử. Chỉ luồng chấm công theo buổi mô tả ở trên thuộc phạm vi hiện hành.
