# Nghiệp vụ và luồng sử dụng

## Vai trò

| Vai trò | Luồng hiện hành |
|---|---|
| ROOT_ADMIN | Dùng giao diện Admin; quản lý hoạt động trung tâm và tài khoản quản trị. |
| ADMIN | Quản lý học sinh, giáo viên, lớp, lịch lặp, buổi học và yêu cầu chấm công theo buổi. |
| TEACHER | Xem buổi được phân công, bắt đầu/kết thúc, điểm danh, nhập kết quả, gửi chấm công cho buổi hoàn tất và sửa thông tin liên hệ. |
| STUDENT | Xem lịch, lịch sử, giáo viên, điểm và chuyên cần của chính mình. Phụ huynh dùng chung tài khoản học sinh. |

ASSISTANT là role lịch sử; migration 0039 chuyển sang TEACHER. PARENT là role lịch sử, không có luồng đăng nhập/quyền xem hiện hành.

## Lớp, thành viên và lịch

- classes lưu lớp, môn, khối và chính sách sĩ số; class_memberships lưu quan hệ theo khoảng ngày, kết thúc membership không xóa lịch sử.
- class_schedules lưu lịch lặp theo ngày/giờ/phòng; class_schedule_staff gắn teacher với lịch. Buổi kế thừa roster/giáo viên phù hợp, có thể giữ ngoại lệ ở cấp buổi.
- Lịch mới chuyển từ dữ liệu cũ ở trạng thái INACTIVE để Admin rà roster/giáo viên trước khi bật.
- Lịch ACTIVE sinh buổi 30 ngày tới theo Asia/Ho_Chi_Minh; generator giữ nguyên buổi đã bắt đầu/hoàn tất và các override được đánh dấu. Xác minh migration/config backend hiện hành trước khi dựa vào lịch chạy.
- Admin có thể lập buổi cụ thể và áp buổi trong một tuần làm mẫu cho tháng được chọn. Kết quả là các session theo ngày cụ thể, không tạo kỳ vận hành ClassMonth.
- Buổi lớp khác nhau có thể trùng giờ nếu phòng khác và roster không giao nhau. Cùng lớp, học sinh chung, phòng trùng hoặc thiếu phòng khi giao giờ bị chặn. Tối đa 5 teacher duy nhất được tính trên assignment đang hoạt động của lớp.
- Hủy hoặc đổi giờ buổi tương lai không xóa buổi/hồ sơ học tập lịch sử. Tác vụ xóa hàng loạt dành riêng cho Admin là ngoại lệ: xóa hẳn các buổi và dữ liệu liên kết của tháng đã chọn, đồng thời giữ audit và các buổi ngoài tháng. Các ngày trong tuần lưu theo ISO: 1 là Thứ Hai, 7 là Chủ Nhật.

## Buổi học và kết quả

Trạng thái buổi: SCHEDULED → IN_PROGRESS → COMPLETED; buổi tương lai có thể CANCELLED. Teacher được phân công cập nhật nội dung, điểm danh, điểm/đánh giá, ghi chú và nhận xét. Hoàn tất yêu cầu roster đã có trạng thái điểm danh; kiểm tra nằm ở database/RPC.

Điểm danh: PRESENT, LATE, ABSENT, EXCUSED. Học sinh chỉ đọc lịch sử/kết quả của mình; kết quả bị giới hạn theo trạng thái buổi hoàn tất. Không dùng lọc giao diện làm ranh giới dữ liệu.

## Chấm công theo buổi

- Teacher được phân công gửi một yêu cầu cho session COMPLETED. Mỗi teacher/session có tối đa một yêu cầu chưa bị từ chối; có thể gửi lại sau từ chối.
- Admin duyệt hoặc từ chối; từ chối phải có lý do. Teacher chỉ xem yêu cầu của mình.
- Đây là xác nhận công dạy theo buổi, không ghi giờ vào/ra, không tính payroll và không mở nghiệp vụ tài chính.

## Ngoài phạm vi

Không tạo kỳ ClassMonth hoặc UI/API cho học phí, payroll, accounting, báo cáo/xuất file, dashboard thống kê, notification hay permission group động chỉ vì chúng còn trong tài liệu/database lịch sử. Chỉ mở rộng phạm vi khi người dùng yêu cầu rõ.
