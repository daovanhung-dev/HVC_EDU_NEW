# Nghiệp vụ và luồng sử dụng

Đây là quy tắc ứng dụng hiện hành theo frontend và migration trong repo. Tài liệu thiết kế/QA cũ chỉ là lịch sử; nếu phát hiện bất nhất, kiểm tra code, migration mới nhất và test trước khi kết luận.

**Quy tắc API:** RPC được nhắc dưới đây chỉ mô tả implementation legacy còn trong source/migration. Không tạo hoặc gọi RPC API; khi thay đổi chạm tới luồng đó, triển khai nghiệp vụ server-side qua Edge Function. Đọc/CRUD đơn giản vẫn có thể dùng Data API dưới RLS.

## Vai trò và dữ liệu được xem

| Role đang dùng | Luồng chính |
|---|---|
| `ROOT_ADMIN` | Dùng giao diện Admin, quản lý hoạt động và tài khoản quản trị. |
| `ADMIN` | Quản lý học sinh, giáo viên, lớp, lịch/buổi và yêu cầu chấm công. |
| `TEACHER` | Xem buổi được phân công; bắt đầu, cập nhật học tập, hoàn tất buổi; gửi chấm công; sửa thông tin liên hệ. Sau khi đăng nhập và hoàn thành đổi mật khẩu bắt buộc (nếu có), giáo viên phải có họ tên và số điện thoại mới được mở các màn hình khác; email và địa chỉ vẫn tùy chọn. |
| `STUDENT` | Chỉ xem lịch sử/lịch, chuyên cần, kết quả, giáo viên, video và AI trong phạm vi hồ sơ của mình. |

`ASSISTANT` và `PARENT` là role lịch sử. Migration 0039 chuyển Assistant sang Teacher; migration 0038 retire quyền Parent. Phụ huynh dùng chung tài khoản học sinh, không có role Parent đang hoạt động.

## Lớp, membership và sĩ số

- `classes` nối môn/khối và trạng thái lớp. `class_memberships` là quan hệ học sinh-lớp có ngày bắt đầu/kết thúc; kết thúc membership không xóa lịch sử.
- Admin có thể sửa ngày bắt đầu của membership đang hiệu lực tại chi tiết lớp. Thao tác đồng bộ roster của mọi buổi `SCHEDULED` chưa bắt đầu trong lớp đó trong cùng giao dịch; buổi có attendance được giữ nguyên, dòng roster có snapshot/lịch sử không bị xóa, và xung đột lịch/phòng làm hoàn tác toàn bộ.
- `capacity_policy` có `WARNING`, `BLOCK`, `UNLIMITED`; lớp cũng có `max_students`. Đây là cấu hình lớp trong UI/schema. Không coi nhãn chính sách là ranh giới quyền hoặc mặc định suy ra enforcement server-side; kiểm tra luồng thêm membership thực tế khi thay đổi sĩ số.
- Một lớp có tối đa năm teacher **duy nhất** trong lịch chưa archive và buổi chưa `COMPLETED`/`CANCELLED`. Một người gắn nhiều lịch/buổi chỉ tính một lần. Enforcement nằm ở database, không chỉ ở picker UI.
- Giáo viên và học sinh được gắn vào từng lịch/buổi qua bảng quan hệ; quyền xem chi tiết phải được giới hạn bằng RLS và kiểm tra phía server qua Edge Function khi cần.

## Lịch lặp và buổi cụ thể

- `class_schedules` lưu lịch lặp theo ISO weekday (1 = Thứ Hai, 7 = Chủ Nhật); `class_schedule_staff` lưu giáo viên theo slot.
- Lịch chuyển từ dữ liệu ClassMonth cũ sang trạng thái `INACTIVE`; Admin rà membership/giáo viên rồi mới bật. Lịch `ACTIVE` tạo buổi cụ thể trong 30 ngày tới theo `Asia/Ho_Chi_Minh`; generator có khóa chống chạy đồng thời và unique key chống trùng. Buổi đã bắt đầu/hoàn tất và override không bị lịch lặp ghi đè.
- Admin có thể tạo buổi theo ngày; sửa giờ/phòng, giáo viên và roster trên buổi chưa hủy, gồm buổi điểm danh bù, buổi `SCHEDULED` đã quá hạn, `IN_PROGRESS` và `COMPLETED`. Sau khi Admin chốt điểm danh, roster và phân công teacher bị khóa; các hiệu chỉnh lịch và learning data vẫn theo quyền hiện hành. Với `IN_PROGRESS`/`COMPLETED`, lịch sửa phải vẫn ở quá khứ; buổi `SCHEDULED` quá hạn có thể dời tới tương lai mà vẫn giữ trạng thái. Ngày/giờ lưu theo `Asia/Ho_Chi_Minh`; đổi lịch giữ nguyên roster đến khi Admin chạy đồng bộ riêng theo membership hiệu lực ngày mới. Dòng attendance, assessment snapshot hoặc financial snapshot được bảo toàn khi sửa. Admin có thể xóa buổi chưa hủy sau khi xem preview và xác nhận; thao tác xóa dữ liệu theo buổi, gồm snapshot học tập/tài chính và payroll item, đồng thời giữ kỳ payroll, audit và tombstone lịch lặp. Buổi `CANCELLED` nằm ngoài luồng xóa mới. Có thể dùng mẫu bảy ngày để thay lịch một tháng; kết quả là các buổi ngày cụ thể, không phải một kỳ ClassMonth vận hành. Generator bỏ qua tháng đã thay mẫu.
- Admin có thể **Thêm lịch mẫu** vào tháng đang xem qua Edge Function mà không xóa/hủy buổi cũ hoặc khóa sinh lịch lặp cho toàn tháng. Mẫu dùng cùng trình nhập 7 ngày; Admin chọn cả tháng (gồm ngày đã qua) hoặc các buổi còn lại có giờ bắt đầu trong tương lai. Buổi trùng chính xác theo lớp/ngày/giờ có lựa chọn cập nhật an toàn hoặc bỏ qua; chỉ buổi tương lai `SCHEDULED` không có lịch sử mới được cập nhật, các buổi khác được giữ nguyên. Xung đột lịch/phòng làm transaction bị từ chối toàn bộ.
- Admin/ROOT_ADMIN có thể tạo lượt thuê phòng cho giáo viên đang hoạt động, một ngày cụ thể hoặc nhiều ngày theo các thứ/khung giờ trong một tháng; lịch thuê hiện trên tháng/tuần/danh sách cùng buổi học và có bộ lọc riêng. Với mẫu tháng, Admin chọn cả tháng (gồm ngày đã qua) hoặc các lượt chưa bắt đầu còn lại trong tháng. Lượt thuê chỉ lưu giáo viên, phòng và thời gian; không có attendance/nhận xét. Xung đột được liệt kê theo ngày, giờ, phòng và lịch liên quan; xác nhận chỉ cập nhật tại chỗ lịch thuê ghép một-một hoặc cho phép trùng buổi/lịch lớp khi chính giáo viên thuê được phân công cho lớp đó. Các xung đột khác chặn toàn bộ batch. Có thể đổi hoặc hủy riêng từng lượt tương lai; lượt hủy được giữ trong lịch sử/audit. Admin/ROOT_ADMIN cũng có thể xóa vĩnh viễn từng lượt `BOOKED` hoặc `CANCELLED` ở mọi thời điểm từ lịch, kể cả trong phần lịch sử; thao tác ghi audit trước/sau và không xóa các lượt khác. Quy tắc phòng so sánh sau khi bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường, đồng bộ với buổi và lịch lớp lặp chưa sinh thành buổi.
- Admin cũng có thể tải/nhập workbook lịch tuần cho tháng đang mở. Preview áp dụng cho toàn trung tâm; nhập thành công cập nhật riêng các buổi trong tháng, tạo buổi điểm danh bù cho các ngày đã qua và lưu mẫu theo tháng mà không sửa `class_schedules`. Nhập được kiểm tra xung đột trọn gói; buổi tương lai `SCHEDULED` bị bỏ khỏi mẫu chỉ bị hủy khi chưa có dữ liệu học tập/chấm công, còn lịch sử được giữ. Implementation RPC yêu cầu `CLASS_MANAGE`, ghi audit và đánh dấu tháng để generator không sinh lại buổi; đây là luồng legacy và thay đổi mới phải dùng Edge Function.
- Từ migration 0054, membership còn hiệu lực được đồng bộ vào roster của buổi thủ công `SCHEDULED` trong tương lai; thao tác vẫn kiểm tra conflict.
- Từ migration 0055, Admin có thể khớp roster thủ công với membership `ACTIVE` và hồ sơ học sinh `ACTIVE` có hiệu lực đúng ngày buổi học; có thể chọn danh sách thành viên cùng lớp. Dòng roster có attendance, assessment snapshot hoặc financial snapshot được giữ lại. Mọi bổ sung học sinh mới vẫn kiểm tra xung đột lịch.
- Buổi của lớp khác có thể giao giờ nếu phòng khác và không có học sinh trùng. Cùng lớp, học sinh trùng, phòng trùng hoặc thiếu phòng khi giao giờ thì bị chặn. Tên phòng so sánh không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối. Teacher có thể được phân công hai buổi giao giờ nếu các rule khác cho phép.
- Admin có thao tác xóa theo tháng có preview. Migration 0052 cho phép xóa buổi trong tháng chọn cùng dữ liệu liên kết ở mọi trạng thái và mọi lớp; đây là luồng phá hủy lịch sử cần hiểu rõ trước khi thay đổi hoặc vận hành. Không dùng nó làm cách sửa lịch thường ngày.

## Trạng thái buổi và kết quả học tập

Trạng thái: `SCHEDULED` → `IN_PROGRESS` → `COMPLETED`; buổi tương lai có thể thành `CANCELLED`. Teacher được phân công bắt đầu buổi, cập nhật nội dung/attendance trong lúc `IN_PROGRESS`, rồi hoàn tất. Sau hoàn tất, learning record và video chỉ đọc với Teacher. Admin có thể hiệu chỉnh dữ liệu buổi đã bắt đầu. Admin có thể kết thúc `IN_PROGRESS` bất kỳ lúc nào, kể cả sớm; `SCHEDULED` chưa bắt đầu phải chờ hết giờ theo lịch. Implementation RPC legacy kiểm tra đủ roster, trạng thái attendance từng học sinh và quyết định Tính công/Không tính công cho từng teacher, rồi lưu attendance, hoàn tất buổi, `ended_at`/`ended_by`, timesheet và audit nguyên tử. `ACADEMIC_MANAGE` cùng `TIMESHEET_APPROVE` được kiểm tra ở database. Với buổi `COMPLETED`, Admin hiện đổi quyết định công bằng RPC riêng không ghi lại attendance. Khi đã chốt, roster và phân công teacher bị khóa để bảo toàn dữ liệu học tập đã xác nhận; Admin vẫn sửa được lựa chọn công và các lần đổi có audit. Không mở rộng các RPC này; thay đổi mới dùng Edge Function.

Hoàn tất yêu cầu mỗi học sinh trong roster có một bản ghi attendance với trạng thái. Không đòi mọi điểm hoặc nhận xét phải có giá trị.

Trong luồng Admin **Các buổi học đã điểm danh**, buổi `COMPLETED` có đủ attendance mở ở trang chi tiết theo query `session_id`; quay lại lịch giữ nguyên lịch và bộ lọc trong component. Trang hiển thị từng học sinh thành thẻ, gồm mã/họ tên, toàn bộ trường attendance và đánh giá, ghi chú và nhận xét; giá trị dài tự xuống dòng, trường trống hiện `—`. Admin vẫn dùng thao tác hiệu chỉnh hiện hành. Nút **Xuất nhận xét** tạo một PNG phía trình duyệt cho cả roster với lớp/ngày và các cột họ tên, điểm danh, điểm BTVN, nhận xét; ảnh dùng dữ liệu đã lưu và nút bị khóa khi còn thay đổi chưa lưu hoặc đang lưu.

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

Các điểm riêng được phép để trống; không tìm thấy công thức tính điểm tổng hay trọng số trong code hiện hành. `positive_feedback_count/raw` cùng `assessment_snapshot` lưu giá trị nhập/import. Từ migration 0056, Admin hiệu chỉnh attendance qua `admin_correct_session_learning`; implementation RPC legacy ghi dữ liệu trước/sau vào audit và chỉ nhận học sinh thuộc roster của buổi.

### Nhập điểm danh và kết quả bằng Excel

- Từ chi tiết buổi, Admin và giáo viên được mở hộp thoại **Điểm danh bằng Excel** theo quyền hiện hành. Tệp `.xlsx` có trang thông tin lớp/buổi/ngày/giờ/phòng/giáo viên và trang điểm danh với đầy đủ học sinh, mã học sinh, trạng thái, phút muộn, lý do vắng, điểm/ghi chú BTVN, hiểu bài, thái độ, điểm cộng và nhận xét. Mã nội bộ được ẩn và chỉ dùng ghép đúng học sinh.
- Mẫu gắn với session, lớp, ngày nghiệp vụ `Asia/Ho_Chi_Minh` và fingerprint roster. Khi nhập, ứng dụng kiểm tra mẫu/trang tính/tiêu đề cột, đúng buổi-ngày-roster, học sinh trùng/lạ/thiếu, trạng thái, số và giới hạn/range theo biểu mẫu hiện hành. Nếu roster thay đổi, cần tải mẫu mới.
- Ô kết quả để trống giữ giá trị đang có. Tệp hợp lệ chỉ nạp các trường khác biệt vào biểu mẫu có thể sửa; người dùng rà lại và xác nhận theo luồng lưu hiện hành. Upload không ghi dữ liệu. Giáo viên chỉ nhập/lưu khi buổi `IN_PROGRESS`; buổi `COMPLETED` chỉ xem. Admin kết thúc `IN_PROGRESS` kể cả trước giờ dự kiến sau khi nhập đủ attendance và quyết định công; buổi `SCHEDULED` chỉ chốt sau giờ kết thúc. Với buổi `COMPLETED`, có thể đổi quyết định công riêng mà không ghi attendance.
- Xử lý Excel chạy phía frontend bằng thư viện `xlsx`; không thêm RPC, Edge Function hay migration.

Học sinh chỉ xem learning result của mình theo chính sách dữ liệu; giao diện hiện có bảng kết quả với chuyên cần, BTVN, hiểu bài, thái độ, feedback và nhận xét. Database/RLS quyết định session/result nào được đọc, không dựa vào việc ẩn hàng ở UI.

## Video bài học và AI

- Teacher được phân công nhập/sửa `session_note` và link YouTube khi buổi `IN_PROGRESS`; khi `COMPLETED` chúng chỉ đọc. Học sinh xem lại các buổi `COMPLETED` có video và thuộc phạm vi RLS của mình.
- Chat AI chỉ cho học sinh đang hoạt động và không bị buộc đổi mật khẩu. Server xác minh session được chọn thuộc hồ sơ học sinh. Hội thoại lưu trong trang hiện mở; request gửi câu hỏi, lịch sử gần nhất và nếu chọn bài thì tên lớp/môn, thời gian, `session_note` cho Gemini.
- Điểm, chuyên cần, nhận xét cá nhân và video không được gửi làm ngữ cảnh cho AI học tập. Nội dung ghi chú là dữ liệu tham khảo, không phải chỉ thị cho mô hình.
- Tính năng tối ưu nhận xét gửi comment giáo viên lên Gemini qua Edge Function; chỉ teacher hoạt động được gọi. Xem handler nếu sửa luồng này vì comment do người dùng cung cấp được truyền ra dịch vụ ngoài.

## Chấm công theo buổi

- Teacher được phân công gửi yêu cầu sau khi session `COMPLETED`; mỗi teacher/session có tối đa một yêu cầu chưa bị từ chối.
- `session_staff.timesheet_eligible = NULL` giữ luồng gửi/duyệt hiện tại; `false` chặn gửi yêu cầu.
- Admin duyệt hoặc từ chối; từ chối phải có lý do. Teacher chỉ xem yêu cầu của mình và có thể gửi lại sau khi bị từ chối.
- Admin kết thúc buổi đang `IN_PROGRESS` hoặc chốt buổi `SCHEDULED` đủ điều kiện cùng attendance và quyết định công theo từng teacher: `true` tạo/đưa timesheet sang `APPROVED`; `false` không tạo công và nếu đã `APPROVED` thì chuyển sang `REVOKED` kèm lý do/người/thời điểm. Với buổi `COMPLETED`, RPC legacy `admin_set_completed_session_timesheets` chỉ cập nhật lựa chọn công và timesheet, không ghi lại attendance. Admin có thể đổi lại quyết định; event audit giữ lịch sử dù metadata thu hồi hiện tại được xóa khi công được khôi phục. Không thêm caller mới; thay bằng Edge Function khi luồng này được sửa.
- Đây là workflow xác nhận công dạy theo buổi, không ghi giờ vào/ra, không tính payroll và không tạo giao dịch tài chính.

## Ngoài phạm vi

Không khôi phục ClassMonth vận hành hoặc UI/API cho học phí, payroll, accounting, báo cáo thống kê, notification, nhóm quyền động hay vai trò Parent chỉ vì bảng/migration/tài liệu lịch sử còn tồn tại. Chỉ mở rộng khi người dùng yêu cầu rõ. Trước thao tác production, xác minh target, migration, backup và workflow trực tiếp; báo cáo QA cũ không thay thế xác minh đó.
