# Nghiệp vụ và luồng sử dụng

Đây là quy tắc ứng dụng hiện hành theo frontend và migration trong repo. Tài liệu thiết kế/QA cũ chỉ là lịch sử; nếu phát hiện bất nhất, kiểm tra code, migration mới nhất và test trước khi kết luận.

## Vai trò và dữ liệu được xem

| Role đang dùng | Luồng chính |
|---|---|
| `ROOT_ADMIN` | Dùng giao diện Admin, quản lý hoạt động và tài khoản quản trị. |
| `ADMIN` | Quản lý học sinh, giáo viên, lớp, lịch/buổi và yêu cầu chấm công. |
| `TEACHER` | Xem buổi được phân công; bắt đầu, cập nhật học tập, hoàn tất buổi; gửi chấm công; sửa thông tin liên hệ. |
| `STUDENT` | Chỉ xem lịch sử/lịch, chuyên cần, kết quả, giáo viên, video và AI trong phạm vi hồ sơ của mình. |

`ASSISTANT` và `PARENT` là role lịch sử. Migration 0039 chuyển Assistant sang Teacher; migration 0038 retire quyền Parent. Phụ huynh dùng chung tài khoản học sinh, không có role Parent đang hoạt động.

## Lớp, membership và sĩ số

- `classes` nối môn/khối và trạng thái lớp. `class_memberships` là quan hệ học sinh-lớp có ngày bắt đầu/kết thúc; kết thúc membership không xóa lịch sử.
- `capacity_policy` có `WARNING`, `BLOCK`, `UNLIMITED`; lớp cũng có `max_students`. Đây là cấu hình lớp trong UI/schema. Không coi nhãn chính sách là ranh giới quyền hoặc mặc định suy ra enforcement server-side; kiểm tra luồng thêm membership thực tế khi thay đổi sĩ số.
- Một lớp có tối đa năm teacher **duy nhất** trong lịch chưa archive và buổi chưa `COMPLETED`/`CANCELLED`. Một người gắn nhiều lịch/buổi chỉ tính một lần. Enforcement nằm ở database, không chỉ ở picker UI.
- Giáo viên và học sinh được gắn vào từng lịch/buổi qua bảng quan hệ; quyền xem chi tiết phải được giới hạn bằng RLS/RPC.

## Lịch lặp và buổi cụ thể

- `class_schedules` lưu lịch lặp theo ISO weekday (1 = Thứ Hai, 7 = Chủ Nhật); `class_schedule_staff` lưu giáo viên theo slot.
- Lịch chuyển từ dữ liệu ClassMonth cũ sang trạng thái `INACTIVE`; Admin rà membership/giáo viên rồi mới bật. Lịch `ACTIVE` tạo buổi cụ thể trong 30 ngày tới theo `Asia/Ho_Chi_Minh`; generator có khóa chống chạy đồng thời và unique key chống trùng. Buổi đã bắt đầu/hoàn tất và override không bị lịch lặp ghi đè.
- Admin có thể tạo buổi theo ngày; sửa giờ/phòng, giáo viên và roster trên buổi chưa hủy, gồm buổi điểm danh bù, buổi `SCHEDULED` đã quá hạn, `IN_PROGRESS` và `COMPLETED`. Với `IN_PROGRESS`/`COMPLETED`, lịch sửa phải vẫn ở quá khứ; buổi `SCHEDULED` quá hạn có thể dời tới tương lai mà vẫn giữ trạng thái. Ngày/giờ lưu theo `Asia/Ho_Chi_Minh`; đổi lịch giữ nguyên roster đến khi Admin chạy đồng bộ riêng theo membership hiệu lực ngày mới. Dòng attendance, assessment snapshot hoặc financial snapshot được bảo toàn. Buổi hủy không mở lại; quy tắc xóa cứng chỉ áp dụng cho buổi tương lai trống. Buổi lặp bị xóa có tombstone ngày để generator không tạo lại. Có thể dùng mẫu bảy ngày để thay lịch một tháng; kết quả là các buổi ngày cụ thể, không phải một kỳ ClassMonth vận hành. Generator bỏ qua tháng đã thay mẫu.
- Admin cũng có thể tải/nhập workbook lịch tuần cho tháng đang mở. Preview áp dụng cho toàn trung tâm; nhập thành công cập nhật riêng các buổi trong tháng, tạo buổi điểm danh bù cho các ngày đã qua và lưu mẫu theo tháng mà không sửa `class_schedules`. Nhập được kiểm tra xung đột trọn gói; buổi tương lai `SCHEDULED` bị bỏ khỏi mẫu chỉ bị hủy khi chưa có dữ liệu học tập/chấm công, còn lịch sử được giữ. RPC yêu cầu `CLASS_MANAGE`, ghi audit và đánh dấu tháng để generator không sinh lại buổi.
- Từ migration 0054, membership còn hiệu lực được đồng bộ vào roster của buổi thủ công `SCHEDULED` trong tương lai; thao tác vẫn kiểm tra conflict.
- Từ migration 0055, Admin có thể khớp roster thủ công với membership `ACTIVE` và hồ sơ học sinh `ACTIVE` có hiệu lực đúng ngày buổi học; có thể chọn danh sách thành viên cùng lớp. Dòng roster có attendance, assessment snapshot hoặc financial snapshot được giữ lại. Mọi bổ sung học sinh mới vẫn kiểm tra xung đột lịch.
- Buổi của lớp khác có thể giao giờ nếu phòng khác và không có học sinh trùng. Cùng lớp, học sinh trùng, phòng trùng hoặc thiếu phòng khi giao giờ thì bị chặn. Tên phòng so sánh không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối. Teacher có thể được phân công hai buổi giao giờ nếu các rule khác cho phép.
- Admin có thao tác xóa theo tháng có preview. Migration 0052 cho phép xóa buổi trong tháng chọn cùng dữ liệu liên kết ở mọi trạng thái và mọi lớp; đây là luồng phá hủy lịch sử cần hiểu rõ trước khi thay đổi hoặc vận hành. Không dùng nó làm cách sửa lịch thường ngày.

## Trạng thái buổi và kết quả học tập

Trạng thái: `SCHEDULED` → `IN_PROGRESS` → `COMPLETED`; buổi tương lai có thể thành `CANCELLED`. Teacher được phân công bắt đầu buổi, cập nhật nội dung/attendance trong lúc `IN_PROGRESS`, rồi hoàn tất. Sau hoàn tất, learning record và video chỉ đọc với Teacher. Admin có thể hiệu chỉnh ghi chú, video, điểm danh và đánh giá trên buổi chưa hủy đã diễn ra; `ACADEMIC_MANAGE` được kiểm tra trong RPC và mỗi hiệu chỉnh được audit. RPC Teacher tiếp tục kiểm tra người gọi là teacher đang hoạt động có assignment.

Hoàn tất yêu cầu mỗi học sinh trong roster có một bản ghi attendance với trạng thái. Không đòi mọi điểm hoặc nhận xét phải có giá trị.

### Quy tắc điểm danh và thang đánh giá

| Trường | Giá trị/range hiện hành | Ý nghĩa |
|---|---|---|
| `status` | `PRESENT`, `LATE`, `ABSENT`, `EXCUSED`; bắt buộc khi lưu | Kết quả điểm danh từng học sinh trong từng buổi. |
| `late_minutes` | nullable; nếu có phải ≥ 0 | Frontend chỉ giữ giá trị này khi trạng thái là `LATE`; không bắt buộc phải nhập số phút. |
| `absence_reason` | nullable text | Frontend chỉ giữ lý do với `ABSENT` hoặc `EXCUSED`; không có danh mục lý do đóng. |
| `homework_score` | nullable, 0–10 (cho phép thập phân) | Điểm bài tập về nhà; không cộng/gộp thành điểm tổng trong code hiện hành. |
| `homework_note` | nullable text | Ghi chú BTVN, gồm trường hợp nguồn không biểu diễn bằng số. |
| `understanding_score` | nullable, số nguyên 1–5 | Mức hiểu bài. |
| `attitude_score` | nullable, số nguyên 1–5 | Thái độ học tập. |
| `comment` | nullable text; UI giới hạn 2.000 ký tự | Nhận xét cá nhân hiển thị trong hồ sơ học tập. |
| `positive_feedback_count` | nullable, số nguyên không âm ở DB | Số feedback tích cực; học sinh có thể thấy trường này. Không phải thang điểm chung. |
| `positive_feedback_raw` | nullable text | Giữ nguyên giá trị nguồn không chuẩn hóa. |

Các điểm riêng được phép để trống; không tìm thấy công thức tính điểm tổng hay trọng số trong code/RPC hiện hành. `positive_feedback_count/raw` cùng `assessment_snapshot` lưu giá trị nhập/import lịch sử; modal giáo viên hiện không cung cấp ô nhập feedback count/raw riêng. Từ migration 0056, Admin hiệu chỉnh attendance qua `admin_correct_session_learning`; RPC ghi dữ liệu trước/sau vào audit và chỉ nhận học sinh thuộc roster của buổi.

Học sinh chỉ xem learning result của mình theo chính sách dữ liệu; giao diện hiện có bảng kết quả với chuyên cần, BTVN, hiểu bài, thái độ, feedback và nhận xét. Database/RLS quyết định session/result nào được đọc, không dựa vào việc ẩn hàng ở UI.

## Video bài học và AI

- Teacher được phân công nhập/sửa `session_note` và link YouTube khi buổi `IN_PROGRESS`; khi `COMPLETED` chúng chỉ đọc. Học sinh xem lại các buổi `COMPLETED` có video và thuộc phạm vi RLS của mình.
- Chat AI chỉ cho học sinh đang hoạt động và không bị buộc đổi mật khẩu. Server xác minh session được chọn thuộc hồ sơ học sinh. Hội thoại lưu trong trang hiện mở; request gửi câu hỏi, lịch sử gần nhất và nếu chọn bài thì tên lớp/môn, thời gian, `session_note` cho Gemini.
- Điểm, chuyên cần, nhận xét cá nhân và video không được gửi làm ngữ cảnh cho AI học tập. Nội dung ghi chú là dữ liệu tham khảo, không phải chỉ thị cho mô hình.
- Tính năng tối ưu nhận xét gửi comment giáo viên lên Gemini qua Edge Function; chỉ teacher hoạt động được gọi. Xem handler nếu sửa luồng này vì comment do người dùng cung cấp được truyền ra dịch vụ ngoài.

## Chấm công theo buổi

- Teacher được phân công gửi yêu cầu sau khi session `COMPLETED`; mỗi teacher/session có tối đa một yêu cầu chưa bị từ chối.
- Admin duyệt hoặc từ chối; từ chối phải có lý do. Teacher chỉ xem yêu cầu của mình và có thể gửi lại sau khi bị từ chối.
- Đây là workflow xác nhận công dạy theo buổi, không ghi giờ vào/ra, không tính payroll và không tạo giao dịch tài chính.

## Ngoài phạm vi

Không khôi phục ClassMonth vận hành hoặc UI/API cho học phí, payroll, accounting, báo cáo thống kê, notification, nhóm quyền động hay vai trò Parent chỉ vì bảng/migration/tài liệu lịch sử còn tồn tại. Chỉ mở rộng khi người dùng yêu cầu rõ. Trước thao tác production, xác minh target, migration, backup và workflow trực tiếp; báo cáo QA cũ không thay thế xác minh đó.
