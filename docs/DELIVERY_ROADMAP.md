# HVC_EDU Delivery Roadmap

## Scope

| Vai trò | Chức năng |
|---|---|
| Admin | Quản lý giáo viên, học sinh, lớp, lịch; xem buổi học và lịch sử từng học sinh |
| Giáo viên | Xem buổi được giao; điểm danh, nhập điểm và nhận xét; sửa thông tin cá nhân |
| Học sinh/phụ huynh | Một tài khoản học sinh cho mỗi em; xem lịch, giáo viên, điểm và chuyên cần của em đó |

Không còn tạo tháng vận hành/kỳ kế toán, payroll, học phí, kế toán, timesheet, báo cáo/xuất file, dashboard thống kê, thông báo hay giao diện nhóm quyền. ROOT_ADMIN hiển thị như Admin; tài khoản Trợ giảng được nâng thành Giáo viên.

## Trạng thái triển khai

| Gate | Trạng thái |
|---|---|
| Frontend cốt lõi, vai trò cố định và hồ sơ học tập liên tục | Đã triển khai trong workspace |
| Chuyển đổi dữ liệu ClassMonth, lịch lặp, lịch sử buổi và vai trò trợ giảng | Migration `0039_continuous_learning.sql` đã tạo; chưa áp dụng production |
| Sinh buổi tự động 30 ngày, múi giờ Việt Nam, hủy/đổi lịch | Đã triển khai trong migration và màn hình lớp/buổi |
| RLS, thu hồi app access khỏi tài chính và API cũ | Đã triển khai trong migration và workflow |
| Frontend typecheck, unit tests, build và Deno checks | Đã đạt trong workspace |
| Migration, RLS và scheduler data QA | Chưa chạy được: `supabase db reset` không khởi tạo được local service |
| Production | Chưa triển khai; chờ backend phân giải DNS và xác nhận bản sao lưu |

## Gate phát hành

Trước khi áp dụng migration production: kết nối được Supabase, sao lưu và kiểm tra phục hồi, xác nhận lịch/roster sau backfill, chạy QA bằng dữ liệu tổng hợp `QA-`, kiểm tra truy cập RLS cho Admin/Giáo viên/Học sinh. Không dùng roster học sinh thật để dựng dữ liệu kiểm thử. Chỉ deploy khi các bước trên đạt.
