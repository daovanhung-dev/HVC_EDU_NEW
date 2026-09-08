# BUSINESS DESIGN
## HỆ THỐNG QUẢN LÝ TRUNG TÂM LUYỆN THI HÙNG CƯỜNG

**Version:** 1.0  
**Phạm vi:** Business Design  
**Đối tượng:** Trung tâm luyện thi Hùng Cường

---

# 1. Tổng quan hệ thống

Hệ thống được xây dựng nhằm quản lý toàn bộ hoạt động vận hành của Trung tâm luyện thi Hùng Cường, bao gồm:

- Quản lý tài khoản và phân quyền.
- Quản lý học sinh.
- Quản lý nhân sự.
- Quản lý lớp học.
- Quản lý lịch học theo tháng.
- Tự động tạo buổi học.
- Điểm danh học sinh.
- Chấm điểm BTVN.
- Nhận xét học sinh.
- Chấm công giáo viên/trợ giảng.
- Tính và quản lý lương.
- Quản lý học phí.
- Quản lý thu/chi.
- Kế toán và lợi nhuận.
- Thông báo.
- Báo cáo.
- Audit Log.

Hệ thống được tổ chức chủ yếu theo:

**Lớp học → Tháng vận hành → Buổi học**

---

# 2. Role hệ thống

Hệ thống có 5 Role.

## R1 – ADMIN ROOT

Có toàn bộ quyền trong hệ thống.

Chức năng:

- Tạo Admin R2.
- Phân nhóm quyền cho R2.
- Quản lý toàn bộ tài khoản.
- Quản lý học sinh.
- Quản lý nhân sự.
- Quản lý lớp.
- Quản lý lịch học.
- Quản lý điểm danh.
- Quản lý chấm công.
- Quản lý lương.
- Quản lý học phí.
- Quản lý kế toán.
- Xem báo cáo.
- Xem Audit Log.
- Thực hiện các thao tác override đặc biệt.

Tài khoản ROOT ban đầu:

```text
Username: ADMIN
Password ban đầu: hungcuong123
```

Password phải được hash khi lưu vào database.

ROOT là tài khoản hệ thống đặc biệt, không được xóa trực tiếp.

---

# 3. R2 – ADMIN

ADMIN được sử dụng các chức năng tùy theo **nhóm quyền** mà ROOT cấp.

Một ADMIN có thể được cấp nhiều nhóm quyền.

Các nhóm quyền mặc định:

1. Quản trị học sinh.
2. Quản trị lớp học.
3. Quản trị nhân sự.
4. Quản trị học tập.
5. Quản trị chấm công.
6. Quản trị lương.
7. Kế toán.
8. Báo cáo.
9. Thông báo.

V1 không cần cho phép tạo custom permission group.

R1 quyết định ADMIN nào có nhóm quyền nào.

---

# 4. R3 – Giáo viên

Giáo viên được:

- Đăng nhập.
- Xem và sửa thông tin cá nhân.
- Đổi mật khẩu.
- Xem lớp được phân công.
- Xem lịch dạy.
- Bắt đầu buổi học.
- Điểm danh học sinh.
- Nhập điểm BTVN.
- Nhận xét học sinh.
- Xem điểm học sinh thuộc lớp được phân công.
- Xác nhận hoàn thành buổi học.
- Gửi yêu cầu chấm công.
- Xem trạng thái chấm công.
- Xem lương cá nhân.
- Xem thông báo.

Giáo viên không được xem:

- Lương nhân sự khác.
- Lớp không được phân công.
- Kế toán nếu không phải R2.

---

# 5. R4 – Trợ giảng

Trợ giảng được:

- Đăng nhập.
- Xem và sửa thông tin cá nhân.
- Đổi mật khẩu.
- Xem lớp được phân công.
- Xem lịch dạy.
- Bắt đầu buổi học.
- Điểm danh học sinh.
- Nhập điểm BTVN.
- Nhận xét học sinh.
- Xem điểm học sinh của lớp được phân công.
- Gửi yêu cầu chấm công.
- Xem trạng thái chấm công.
- Xem lương cá nhân.
- Xem thông báo.

Trợ giảng **không có quyền xác nhận hoàn thành buổi học**.

---

# 6. R5 – Học sinh

Học sinh có tài khoản riêng.

Học sinh được:

- Đăng nhập.
- Xem thông tin cá nhân.
- Đổi mật khẩu.
- Xem các lớp đang học.
- Xem lịch học.
- Xem lịch sử điểm danh.
- Xem điểm BTVN.
- Xem nhận xét của GV/TA.
- Xem học phí tháng.
- Xem trạng thái đóng học phí.
- Xem thông báo.

Học sinh không được:

- Sửa điểm.
- Sửa điểm danh.
- Sửa nhận xét.
- Xem dữ liệu học sinh khác.
- Xem dữ liệu nhân sự.
- Xem lương.
- Xem kế toán.

Phụ huynh không có tài khoản riêng trong V1.

---

# 7. Nguyên tắc tài khoản

Mỗi tài khoản chỉ có **một Role chính**.

Không hỗ trợ một tài khoản vừa là R2 vừa R3 trong V1.

---

# 8. Tài khoản học sinh

Khi Admin tạo học sinh:

```text
Admin nhập hồ sơ
        ↓
Hệ thống sinh mã học sinh
        ↓
Hệ thống sinh username
        ↓
Hệ thống sinh password mặc định
        ↓
Tạo account R5
```

Học sinh có thể đăng nhập bằng:

- Username.
- Mã học sinh.
- Số điện thoại.
- Email nếu có.

Username được tự sinh theo dạng:

```text
tên + số
```

Ví dụ:

```text
Nguyễn Văn Nam
HS000127

username:
nguyenvannam127
```

Email là trường không bắt buộc.

Lần đăng nhập đầu tiên bắt buộc đổi mật khẩu.

Admin có quyền:

- Reset password.
- Khóa account.
- Mở khóa account.
- Sửa thông tin đăng nhập hợp lệ.

---

# 9. Tài khoản R2/R3/R4

Khi tạo nhân sự:

```text
Admin nhập nhân sự
        ↓
Hệ thống tạo account
        ↓
Hệ thống cấp Role tương ứng
        ↓
Sinh mật khẩu mặc định
```

Lần đăng nhập đầu tiên bắt buộc đổi mật khẩu.

Quên mật khẩu trong V1:

```text
Người dùng
→ liên hệ Admin
→ Admin Reset Password
```

Không cần SMS OTP/email OTP trong V1.

---

# 10. Quản lý học sinh

Thông tin học sinh:

- Mã học sinh.
- Họ tên.
- Ngày sinh.
- Giới tính.
- Số điện thoại.
- Email – optional.
- Địa chỉ.
- Trường đang học.
- Khối/lớp hiện tại.
- Tên phụ huynh.
- SĐT phụ huynh.
- Ghi chú.
- Trạng thái.

Một học sinh có thể tham gia nhiều lớp.

Ví dụ:

```text
Nguyễn Văn A
├── Toán 7
├── Văn 7
└── Toán nâng cao 7
```

Học sinh cũng được phép cùng lúc học hai lớp cùng môn/khối.

Hệ thống chỉ cảnh báo khi xảy ra trùng lịch.

---

# 11. Trạng thái học sinh

Không xóa vật lý học sinh đã phát sinh dữ liệu.

Có thể sử dụng:

```text
ACTIVE
INACTIVE
```

Nếu học sinh chưa phát sinh bất kỳ dữ liệu liên quan nào, hệ thống có thể cho phép xóa.

Nếu đã có:

- Điểm danh.
- BTVN.
- Học phí.
- Nhận xét.
- Lịch sử lớp.

thì chỉ chuyển trạng thái.

---

# 12. Học sinh chuyển lớp

Khi chuyển lớp:

```text
Membership lớp cũ
→ lưu ngày kết thúc

Membership lớp mới
→ tạo mới
```

Không xóa lịch sử lớp cũ.

---

# 13. Quản lý lớp

Một lớp có:

- Mã lớp.
- Tên lớp.
- Môn học.
- Khối.
- Học phí mặc định.
- Quy định sĩ số.
- Trạng thái.
- Ghi chú.

Môn học, khối và lớp được tách logic riêng.

Ví dụ:

```text
Subject: Toán
Grade: 7
Class: Toán 7A
```

---

# 14. Quan hệ lớp – học sinh

Quan hệ:

```text
STUDENT N --- N CLASS
```

Không lưu trực tiếp `class_id` duy nhất trong Student.

Một lớp có nhiều học sinh.

Một học sinh có nhiều lớp.

---

# 15. Quan hệ lớp – nhân sự

Một lớp có thể có:

```text
N Giáo viên
N Trợ giảng
```

Nhân sự của lớp được xác định theo từng tháng vận hành.

---

# 16. Sĩ số lớp

Admin được quyền cấu hình:

```text
max_students
```

hoặc:

```text
Không giới hạn
```

Nếu có giới hạn, Admin có thể lựa chọn:

```text
WARNING
```

hoặc:

```text
BLOCK
```

### WARNING

Vượt sĩ số chỉ hiển thị cảnh báo.

Admin vẫn được thêm học sinh.

### BLOCK

Không cho thêm học sinh nếu vượt giới hạn.

---

# 17. Không dùng ngày bắt đầu/kết thúc trực tiếp cho lớp

Vòng đời thực tế của lớp được quản lý qua:

```text
CLASS_MONTH
```

Lớp có thể được:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Không cần bắt buộc `start_date/end_date` tại Class.

---

# 18. Tháng vận hành – ClassMonth

Đây là đối tượng nghiệp vụ trung tâm của hệ thống.

Ví dụ:

```text
Toán 7A
↓
ClassMonth 09/2026
↓
ClassMonth 10/2026
↓
ClassMonth 11/2026
```

Mỗi ClassMonth chứa snapshot của tháng đó.

---

# 19. ClassMonth lưu

- Lớp.
- Tháng/năm.
- Danh sách học sinh.
- Học phí từng học sinh.
- Giáo viên.
- Trợ giảng.
- Lịch học.
- Các cấu hình cần thiết.
- Các session của tháng.

---

# 20. Tạo tháng mới

Workflow:

```text
Admin chọn Tạo tháng mới
        ↓
DRAFT
        ↓
Có thể chọn:
Copy tháng trước
hoặc
Tạo mới hoàn toàn
        ↓
Admin chỉnh dữ liệu
        ↓
Confirm
        ↓
ACTIVE
        ↓
Hệ thống sinh Session
```

Không sinh session ngay khi ClassMonth còn DRAFT.

---

# 21. Copy tháng trước

Nếu Admin chọn copy, hệ thống copy:

- Danh sách học sinh.
- Học phí mặc định.
- Học phí riêng.
- Giáo viên.
- Trợ giảng.
- Lịch học.
- Các cấu hình cần tham khảo.

Không copy:

- Điểm danh.
- Điểm BTVN.
- Nhận xét.
- Chấm công.
- Lương.
- Học phí đã đóng.
- Thu chi.
- Session cũ.

Admin được tùy chỉnh trước khi xác nhận tháng mới.

---

# 22. Nhiều tháng có thể tồn tại đồng thời

Ví dụ:

```text
Tháng 09/2026 → ACTIVE
Tháng 10/2026 → DRAFT
```

Điều này cho phép chuẩn bị tháng sau trong khi tháng hiện tại vẫn hoạt động.

---

# 23. Nhân sự của tháng

Khi tạo tháng mới, Admin chốt:

- Giáo viên.
- Trợ giảng.

Danh sách này mặc định áp dụng cho các buổi học trong tháng.

Không lựa chọn lại từ đầu cho từng session.

---

# 24. Dạy thay

Admin được quyền thay nhân sự ở một session cụ thể.

Ví dụ:

```text
GV dự kiến:
Nguyễn Văn A

GV thực tế:
Nguyễn Văn B
```

Hệ thống phải lưu:

- Nhân sự ban đầu.
- Nhân sự thay thế.
- Người thực hiện thay đổi.
- Thời gian.
- Lý do.

Người thay thế bắt buộc là nhân sự `ACTIVE`.

Người bị thay không được chấm công cho session đó.

Người dạy thay được:

- Điểm danh.
- BTVN.
- Nhận xét.
- Chấm công.
- Thực hiện quyền session tương ứng Role.

---

# 25. Lịch học

Một lớp có thể có nhiều lịch trong tuần.

Ví dụ:

```text
Thứ 3:
17:30–19:00

Thứ 7:
08:00–10:00
```

---

# 26. Sinh buổi học

Sau khi ClassMonth ACTIVE:

```text
Schedule
↓
Session Generator
↓
Study Sessions
```

Ví dụ:

```text
Thứ 3 + Thứ 7
↓
05/09
08/09
12/09
15/09
...
```

---

# 27. Thay đổi lịch giữa tháng

Các session đã hoàn thành:

```text
không tự động thay đổi
```

Các session tương lai:

Admin có thể thay đổi.

Ví dụ:

```text
18/09 17:30
→
19/09 18:00
```

Hệ thống phải:

- Cập nhật session tương lai.
- Audit thay đổi.
- Thông báo GV/TA.
- Thông báo học sinh.

---

# 28. Kiểm tra trùng lịch

Hệ thống kiểm tra:

- Trùng lịch Giáo viên.
- Trùng lịch Trợ giảng.
- Trùng lịch học sinh.

Nếu trùng:

```text
WARNING
```

Admin có quyền override.

Không tự động chặn tuyệt đối.

---

# 29. Trạng thái Session

Session có thể có:

```text
SCHEDULED
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# 30. Thời gian Session

Lưu:

```text
scheduled_start_at
scheduled_end_at

started_at
ended_at
```

Trong đó:

- `scheduled_*`: lịch dự kiến.
- `started_at`: lúc bắt đầu thực tế.
- `ended_at`: lúc kết thúc thực tế.

---

# 31. Bắt đầu buổi học

R3 hoặc R4 được bấm:

```text
BẮT ĐẦU BUỔI HỌC
```

Sau đó:

```text
started_at = current_time
status = IN_PROGRESS
```

---

# 32. Kết thúc buổi học

Chỉ R3 – Giáo viên thuộc session được xác nhận:

```text
HOÀN THÀNH BUỔI HỌC
```

Khi xác nhận:

```text
status = COMPLETED
ended_at = current_time
ended_by = teacher
```

`ended_at` là thời gian thực tế hệ thống ghi nhận.

---

# 33. Điều kiện hoàn thành Session

Không cho hoàn thành nếu còn học sinh chưa được điểm danh.

Tất cả học sinh thuộc session phải có attendance status.

---

# 34. Khóa Session

Sau khi COMPLETED:

R3/R4 không được sửa:

- Điểm danh.
- BTVN.
- Nhận xét.

R1 hoặc R2 có quyền phù hợp được phép mở lại.

Khi mở lại phải:

- Nhập lý do.
- Audit Log.

---

# 35. Hủy Session

Nếu trung tâm hủy buổi:

```text
status = CANCELLED
```

Session CANCELLED:

- Không điểm danh.
- Không chấm công.
- Không phát sinh lương.

Admin có thể tạo buổi học bù.

Buổi học bù được liên kết với session bị hủy.

---

# 36. Điểm danh học sinh

Mỗi Student + Session có một attendance record.

Status:

```text
PRESENT
LATE
ABSENT
EXCUSED
```

Ý nghĩa:

```text
PRESENT
Có mặt

LATE
Đi muộn

ABSENT
Nghỉ không phép

EXCUSED
Nghỉ có phép
```

---

# 37. Đi muộn

`late_minutes` là optional.

Ví dụ:

```text
status = LATE
late_minutes = 15
```

Không bắt buộc nhập phút.

---

# 38. Lý do nghỉ

Có:

```text
absence_reason
```

optional.

---

# 39. Attendance và doanh thu quy đổi

Được tính là có mặt:

```text
PRESENT
LATE
```

Không tính:

```text
ABSENT
EXCUSED
```

Điều này chỉ ảnh hưởng **doanh thu quy đổi để tính lương**.

Không ảnh hưởng trực tiếp học phí tháng.

---

# 40. Điểm BTVN

Mỗi học sinh mỗi session chỉ có **một điểm BTVN**.

Điểm:

```text
0 → 10
```

hoặc:

```text
NULL
```

`NULL` nghĩa là không chấm hoặc không có BTVN.

---

# 41. Nhận xét học sinh

Nhận xét được lưu:

```text
theo từng học sinh
+
theo từng session
```

Nội dung ưu tiên:

- Kiến thức còn yếu.
- Dạng bài chưa làm tốt.
- Vấn đề trong quá trình học.
- Gợi ý cải thiện.

Ví dụ:

```text
HS Nguyễn Văn A

"Chưa nắm chắc quy tắc chuyển vế,
còn nhầm dấu khi giải phương trình."
```

---

# 42. Nội dung buổi học

Session có thể lưu:

```text
lesson_content
```

Ví dụ:

```text
Ôn phương trình bậc nhất.
Luyện bài dạng chuyển vế.
```

Không bắt buộc.

---

# 43. Học sinh xem dữ liệu buổi học

R5 chỉ được xem:

- Attendance.
- BTVN.
- Nhận xét.

sau khi Session đã `COMPLETED`.

---

# 44. Chấm công

Sau khi Session COMPLETED:

```text
R3/R4
↓
Gửi yêu cầu chấm công
```

Một session:

```text
1 nhân sự = tối đa 1 công
```

Một buổi được tính là một công.

Không tính công theo số giờ.

---

# 45. Nhân sự tự chấm công

R3/R4 phải tự gửi yêu cầu chấm công.

Admin không tự tạo chấm công hộ trong nghiệp vụ thông thường.

---

# 46. Trạng thái yêu cầu chấm công

```text
PENDING
APPROVED
REJECTED
```

Nếu REJECTED:

```text
Nhân sự
↓
sửa thông tin/ghi chú
↓
RESUBMIT
```

---

# 47. Duyệt chấm công

R1 hoặc R2 có quyền quản trị chấm công được:

```text
APPROVE
REJECT
```

Lưu:

- Người duyệt.
- Thời gian.
- Ghi chú.
- Lý do từ chối nếu có.

---

# 48. Điều kiện tính lương

Chỉ công:

```text
APPROVED
```

mới được tính vào lương.

---

# 49. Học phí lớp

Mỗi lớp có:

```text
default_monthly_fee
```

Ví dụ:

```text
400.000đ/tháng
```

---

# 50. Học phí riêng từng học sinh

Một học sinh có thể có mức phí riêng.

Ví dụ:

| Học sinh | Học phí |
|---|---:|
| A | 400.000 |
| B | 300.000 |
| C | 200.000 |
| D | 0 |

Nếu không cấu hình riêng thì dùng mức mặc định của lớp.

---

# 51. Thu học phí

Học phí được thu theo **tháng cố định**.

Không tính tiền trực tiếp theo số buổi có mặt.

Học sinh nghỉ học một buổi:

```text
không được giảm học phí
```

---

# 52. Học sinh vào giữa tháng

Nếu vào giữa tháng:

```text
Học phí tháng
=
Học phí chuẩn
÷
Tổng số buổi dự kiến tháng
×
Số buổi thuộc thời gian học sinh tham gia
```

Ví dụ:

```text
Học phí chuẩn: 400.000
Tháng: 8 buổi

HS bắt đầu khi còn 4 buổi

Học phí:
400.000 / 8 × 4
= 200.000
```

Các lần nghỉ sau khi đã tham gia không tiếp tục làm giảm học phí.

---

# 53. Học sinh nghỉ hẳn giữa tháng

Nếu học sinh nghỉ hẳn:

Học phí được tính theo số session thuộc thời gian học sinh còn là thành viên của lớp.

Ví dụ học 3/8 buổi rồi thôi:

```text
400.000 / 8 × 3
= 150.000
```

Không dùng attendance PRESENT để tính khoản này.

---

# 54. Trạng thái đóng học phí

Chỉ gồm:

```text
UNPAID
PAID
```

Không hỗ trợ đóng một phần trong V1.

---

# 55. Xác nhận học phí

Chỉ:

- R1.
- R2 có nhóm quyền Kế toán.

được đánh dấu học phí `PAID`.

Lưu:

```text
amount_due
amount_paid
paid_at
confirmed_by
```

Dù UI chỉ có `Đã đóng/Chưa đóng`, hệ thống vẫn lưu số tiền.

---

# 56. Sửa học phí sau khi tháng ACTIVE

Admin có quyền chỉnh học phí học sinh.

Nếu thay đổi:

- Bắt buộc nhập lý do.
- Audit Log.
- Nếu đã PAID phải hiển thị cảnh báo.

---

# 57. Doanh thu quy đổi buổi học

Do học phí thu theo tháng nhưng lương tính theo session, hệ thống phải quy đổi.

Mỗi học sinh:

```text
Session Unit Value
=
Monthly Fee
÷
Total Scheduled Sessions In Month
```

---

# 58. Revenue của Session

Chỉ cộng học sinh:

```text
PRESENT
LATE
```

Công thức:

```text
Session Revenue
=
Σ (
Monthly Fee của HS
÷
Số Session tháng
)
```

với các học sinh có mặt.

Ví dụ:

```text
Tháng: 8 buổi

HS A:
400k / 8 = 50k

HS B:
300k / 8 = 37.5k

HS C:
200k / 8 = 25k
```

Nếu A và C có mặt:

```text
Revenue
=
50k + 25k
=
75k
```

Đây là:

**Doanh thu quy đổi phục vụ gợi ý/tính lương**

không phải doanh thu kế toán thực thu.

---

# 59. Tính lương

Sau khi công được duyệt, Admin tự quyết định cách tính lương.

Hỗ trợ:

```text
PERCENTAGE
FIXED
```

---

# 60. Tính theo %

Admin nhập:

```text
salary_percentage
```

Ví dụ:

```text
Revenue = 1.000.000

GV A = 25%
→ 250.000

TA B = 8%
→ 80.000
```

Admin tự chia tỷ lệ cho từng người.

Hệ thống không tự chia quỹ giáo viên/trợ giảng.

---

# 61. Tính lương cố định

Admin có thể nhập trực tiếp:

```text
base_salary = 300.000
```

---

# 62. Giới hạn lương cơ bản

Tổng lương cơ bản của Session không được vượt doanh thu quy đổi.

Percentage:

```text
Total Percentage <= 100%
```

Fixed:

```text
Total Base Salary <= Session Revenue
```

---

# 63. Thưởng/phạt

Lương hỗ trợ:

```text
BONUS
PENALTY
```

Mỗi khoản lưu:

- Số tiền.
- Loại.
- Lý do.
- Người tạo.
- Thời gian.

Ví dụ:

```text
Base Salary: 900k
Bonus:       150k

Net Salary: 1.050k
```

Tổng thực nhận sau thưởng/phạt **có thể vượt doanh thu quy đổi**.

---

# 64. Công thức thực nhận

```text
Net Salary
=
Base Salary
+
Bonus
-
Penalty
```

---

# 65. Điều chỉnh lương

Nếu Admin thay đổi số tiền khác với số hệ thống tính từ tỷ lệ:

- Bắt buộc nhập lý do.
- Audit Log.

---

# 66. Bảng lương tháng

Lương từng session được tổng hợp thành bảng lương tháng.

Ví dụ:

```text
GV Nguyễn Văn A
Tháng 09/2026

05/09   300k
08/09   300k
12/09   350k
...
```

---

# 67. Trạng thái bảng lương

```text
DRAFT
CONFIRMED
PAID
```

---

# 68. Chốt bảng lương

Khi:

```text
CONFIRMED
```

dữ liệu bảng lương được khóa.

Muốn sửa:

```text
Admin mở lại
↓
nhập lý do
↓
Audit
```

---

# 69. Thanh toán lương

Khi Admin bấm:

```text
PAID
```

lưu:

```text
paid_at
paid_by
```

Việc revert cần quyền phù hợp và lý do.

---

# 70. R3/R4 xem lương

R3/R4 chỉ xem:

```text
lương của chính mình
```

Không xem lương nhân sự khác.

---

# 71. Accounting

Kế toán quản lý:

- Học phí.
- Lương.
- Thu khác.
- Chi khác.
- Công nợ.
- Lợi nhuận.

---

# 72. Transaction

Có hai loại:

```text
AUTO
MANUAL
```

---

# 73. AUTO Transaction

Sinh tự động từ nghiệp vụ.

Ví dụ:

```text
Tuition PAID
→ Income

Payroll PAID
→ Expense
```

AUTO Transaction không sửa số tiền trực tiếp.

Muốn sửa phải sửa nghiệp vụ nguồn.

---

# 74. MANUAL Transaction

Dùng cho:

- Tiền thuê.
- Điện.
- Nước.
- Internet.
- Thiết bị.
- Marketing.
- Thu khác.
- Chi khác.

Admin được tạo/sửa/xóa hoặc archive theo quyền.

Mọi thay đổi quan trọng phải Audit.

---

# 75. Adjustment Transaction

Nếu cần điều chỉnh độc lập với transaction tự sinh:

```text
ADJUSTMENT
```

Ví dụ:

```text
Income tuition: +400k
Adjustment:      -50k
```

---

# 76. Category Thu/Chi

Admin được tạo Category.

Ví dụ:

### Income

```text
Học phí
Thu khác
```

### Expense

```text
Lương
Thuê nhà
Điện
Nước
Internet
Thiết bị
Marketing
Văn phòng phẩm
Khác
```

---

# 77. Phương thức thanh toán

Optional:

```text
CASH
BANK_TRANSFER
OTHER
```

---

# 78. Kế toán phải phân biệt phải thu và đã thu

Dashboard hiển thị:

```text
Học phí phải thu
Học phí đã thu
Công nợ
```

---

# 79. Lợi nhuận thực tế

Công thức chính:

```text
Lợi nhuận thực tế
=
Tiền thực thu
+
Thu khác thực tế
-
Lương đã trả
-
Chi phí đã chi
```

Không dùng toàn bộ khoản phải thu làm tiền thực tế.

---

# 80. Notification

V1 chỉ dùng:

```text
IN-APP NOTIFICATION
```

Không cần SMS, Zalo, Email notification.

---

# 81. Notification cho GV/TA

Bao gồm:

- Có lịch dạy mới.
- Lịch thay đổi.
- Được chỉ định dạy thay.
- Chấm công được duyệt.
- Chấm công bị từ chối.
- Bảng lương được chốt.
- Lương được thanh toán.

---

# 82. Notification cho học sinh

Bao gồm:

- Lịch học thay đổi.
- Buổi học bị hủy.
- Có điểm BTVN mới.
- Có nhận xét mới.
- Có học phí tháng mới.
- Học phí được xác nhận đã đóng.

---

# 83. Notification cho Admin

Bao gồm tối thiểu:

- Yêu cầu chấm công mới.
- Các sự kiện cần duyệt.

---

# 84. Audit Log

Audit bắt buộc đối với:

- Phân quyền.
- Tạo/sửa/khóa account.
- Reset password bởi Admin.
- Sửa điểm danh sau khóa.
- Mở lại session.
- Thay đổi học phí.
- Thay đổi lịch.
- Thay nhân sự.
- Dạy thay.
- Duyệt/từ chối chấm công.
- Thay đổi lương.
- Thưởng/phạt.
- Mở lại bảng lương.
- Xác nhận học phí.
- Sửa/xóa transaction.
- Override trùng lịch.
- Các nghiệp vụ tài chính quan trọng.

Không audit thao tác View thông thường.

---

# 85. Không xóa Audit Log

Không cho phép xóa Audit Log từ UI, kể cả ROOT.

---

# 86. Nguyên tắc Soft Delete

Các dữ liệu đã phát sinh lịch sử không được xóa vật lý.

Áp dụng:

- Học sinh.
- Nhân sự.
- Lớp.
- Tài khoản.
- Các đối tượng nghiệp vụ có lịch sử liên quan.

Ưu tiên:

```text
ACTIVE
INACTIVE
ARCHIVED
```

hoặc `deleted_at`.

---

# 87. Dashboard Admin

Dashboard tháng hiện tại hiển thị:

- Tổng học sinh.
- Tổng lớp.
- Tổng nhân sự.
- Số buổi đã học.
- Số buổi sắp tới.
- Session bị hủy.
- Học phí phải thu.
- Học phí đã thu.
- Công nợ.
- Lương dự kiến.
- Lương đã trả.
- Thu khác.
- Chi khác.
- Lợi nhuận.
- Chấm công chờ duyệt.

R2 chỉ xem phần phù hợp nhóm quyền.

---

# 88. Báo cáo

Hệ thống hỗ trợ báo cáo theo:

- Tháng.
- Lớp.
- Học sinh.
- Nhân sự.

---

# 89. Export

Hỗ trợ:

```text
Excel
PDF
```

Cho ít nhất:

- Danh sách học sinh.
- Điểm danh.
- Điểm BTVN.
- Học phí.
- Bảng lương.
- Thu/chi.
- Báo cáo tháng.

---

# 90. Timezone

Timezone nghiệp vụ:

```text
Asia/Ho_Chi_Minh
```

---

# 91. Tiền tệ

Chỉ dùng:

```text
VND
```

Tiền trong database lưu dưới dạng integer.

Ví dụ:

```text
400000
```

Không dùng floating point để lưu tiền.

---

# 92. Quy tắc quyền dữ liệu

R3/R4 chỉ truy cập lớp được phân công trong ClassMonth hiện tại hoặc lịch sử mà họ từng tham gia.

R5 chỉ truy cập dữ liệu của chính mình.

R2 chỉ truy cập module thuộc nhóm quyền được cấp.

R1 toàn quyền.

---

# 93. Business Flow tổng thể

```text
ROOT / ADMIN
      ↓
Tạo lớp
      ↓
Thêm học sinh
      ↓
Thêm GV/TA
      ↓
Tạo tháng
      ↓
DRAFT
      ↓
Copy tháng cũ nếu muốn
      ↓
Tùy chỉnh
      ↓
ACTIVE
      ↓
Sinh lịch / Session
      ↓
R3 hoặc R4 bắt đầu Session
      ↓
started_at
      ↓
Điểm danh
+
BTVN
+
Nhận xét
      ↓
R3 xác nhận hoàn thành
      ↓
ended_at
      ↓
COMPLETED
      ↓
Khóa dữ liệu học tập
      ↓
R3/R4 gửi chấm công
      ↓
Admin duyệt
      ↓
Admin xác định % / tiền lương
      ↓
Thưởng / phạt
      ↓
Tổng hợp bảng lương tháng
      ↓
CONFIRMED
      ↓
PAID
      ↓
Accounting Expense
```

Song song:

```text
ClassMonth
      ↓
Sinh học phí tháng
      ↓
UNPAID
      ↓
Admin xác nhận
      ↓
PAID
      ↓
Accounting Income
```

---

# 94. Module hệ thống

Hệ thống cuối cùng được chia thành các module:

```text
01. Authentication
02. Account Management
03. RBAC / Permission Groups
04. Student Management
05. Staff Management
06. Subject & Grade Management
07. Class Management
08. Class Membership
09. ClassMonth Management
10. Schedule Management
11. Session Management
12. Staff Replacement
13. Student Attendance
14. Homework Score
15. Student Comment
16. Staff Timesheet
17. Timesheet Approval
18. Payroll
19. Salary Adjustment
20. Tuition
21. Accounting
22. Income / Expense Category
23. Notification
24. Dashboard
25. Reports
26. Export
27. Audit Log
```

---

# 95. Business Entity tổng quát

```text
USER
│
├── ADMIN
├── STAFF
│   ├── TEACHER
│   └── ASSISTANT
│
└── STUDENT

STUDENT
    │
    └── CLASS MEMBERSHIP
            │
            ↓
          CLASS
            │
            ↓
       CLASS MONTH
        /   |    \
       /    |     \
 Student   Staff   Schedule
 Snapshot Snapshot     |
                       ↓
                    SESSION
                   /   |    \
                  /    |     \
        Attendance   Staff   Lesson
             |         |
          BTVN     Timesheet
          Comment      |
                       ↓
                    Payroll

STUDENT
   |
 Tuition
   |
 Payment
   |
 Accounting

Payroll
   |
 Accounting
```

---

# 96. Các Business Rule quan trọng nhất

**BR-01**  
Một account chỉ thuộc một Role chính.

**BR-02**  
Một học sinh có thể học nhiều lớp.

**BR-03**  
Một lớp có nhiều giáo viên và nhiều trợ giảng.

**BR-04**  
Nhân sự của lớp được snapshot theo tháng.

**BR-05**  
Session được tự sinh từ lịch ClassMonth.

**BR-06**  
R3/R4 được bắt đầu Session.

**BR-07**  
Chỉ R3 được hoàn thành Session.

**BR-08**  
Hoàn thành Session phải lưu `ended_at`.

**BR-09**  
Không hoàn thành Session nếu chưa điểm danh toàn bộ học sinh.

**BR-10**  
Session COMPLETED khóa dữ liệu học tập.

**BR-11**  
PRESENT/LATE được tính revenue; ABSENT/EXCUSED không tính.

**BR-12**  
Học sinh nghỉ buổi học không được trừ học phí tháng.

**BR-13**  
Học sinh vào/rời lớp giữa tháng được prorate theo số session thuộc thời gian tham gia.

**BR-14**  
Mỗi học sinh/session chỉ có một điểm BTVN.

**BR-15**  
Chỉ được gửi chấm công sau khi Session COMPLETED.

**BR-16**  
Mỗi nhân sự/session chỉ có một công hợp lệ.

**BR-17**  
Chỉ APPROVED timesheet được tính lương.

**BR-18**  
Admin tự quyết định tỷ lệ hoặc tiền lương.

**BR-19**  
Tổng base salary session không vượt revenue quy đổi.

**BR-20**  
Bonus/Penalty được phép làm Net Salary vượt revenue.

**BR-21**  
Bảng lương CONFIRMED muốn sửa phải mở lại và có lý do.

**BR-22**  
Học phí chỉ có UNPAID/PAID.

**BR-23**  
Không hỗ trợ partial payment V1.

**BR-24**  
Tuition PAID tự sinh Income transaction.

**BR-25**  
Payroll PAID tự sinh Expense transaction.

**BR-26**  
AUTO transaction không sửa trực tiếp.

**BR-27**  
Dữ liệu lịch sử ưu tiên Soft Delete.

**BR-28**  
Audit Log không được xóa từ UI.

**BR-29**  
Các thay đổi tiền, quyền và dữ liệu khóa phải audit.

**BR-30**  
Tất cả tiền sử dụng VND integer.

---

# 97. Phạm vi V1

V1 cần hoàn thành đầy đủ:

### Core

- Auth.
- RBAC.
- R1–R5.
- Account.
- Student.
- Staff.
- Class.
- ClassMonth.
- Schedule.
- Session.

### Academic

- Attendance.
- BTVN.
- Nhận xét.

### Human Resource

- Staff assignment.
- Replacement.
- Timesheet.
- Approval.

### Finance

- Tuition.
- Payroll.
- Bonus/Penalty.
- Income/Expense.
- Accounting.

### System

- Notification.
- Audit.
- Dashboard.
- Excel/PDF Export.

---

# 98. Ngoài phạm vi V1

Chưa cần triển khai:

- Tài khoản phụ huynh.
- SMS.
- Zalo.
- Email notification.
- OTP.
- Thanh toán online.
- Cổng thanh toán.
- Học phí trả góp/partial payment.
- Nhiều tiền tệ.
- Custom permission group động.
- Một account nhiều Role.
- Module điểm kiểm tra khác ngoài BTVN.

---

# 99. Kết luận

Thiết kế nghiệp vụ của hệ thống Hùng Cường được tổ chức theo nguyên tắc:

```text
CLASS
  ↓
CLASS MONTH
  ↓
SESSION
```

và hai luồng tài chính chính:

```text
STUDENT
→ TUITION
→ PAYMENT
→ ACCOUNTING
```

```text
SESSION
→ TIMESHEET
→ PAYROLL
→ ACCOUNTING
```

Hai luồng trên được liên kết thông qua:

```text
Attendance
→ Session Revenue
→ Salary Calculation
```

Kiến trúc nghiệp vụ này đảm bảo:

- Dữ liệu lịch sử không bị mất khi đổi tháng.
- Nhân sự có thể thay đổi theo tháng.
- Có thể xử lý giáo viên dạy thay.
- Điểm danh liên kết trực tiếp với tính lương.
- Học phí và doanh thu tính lương không bị nhầm lẫn.
- Lương có cơ chế duyệt/chốt.
- Kế toán tránh nhập trùng.
- Các nghiệp vụ tài chính có Audit.
- Phân quyền rõ giữa R1–R5.
- Có thể mở rộng sang phụ huynh, thanh toán online hoặc nhiều trung tâm sau này.
