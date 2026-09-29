# HVC_EDU — Mục lục context cho agent

## Tổng quan

HVC_EDU là ứng dụng quản lý trung tâm luyện thi, hiện tập trung vào lớp học và hồ sơ học tập liên tục. Frontend là Vue 3 + TypeScript + Vite; dữ liệu, xác thực và các thao tác nghiệp vụ dùng Supabase.

## Đọc theo nhiệm vụ

- Cần hiểu vai trò, lớp, lịch, buổi học hoặc điểm danh: đọc [Nghiệp vụ và luồng sử dụng](product-and-workflows.md).
- Cần tìm nơi sửa code hoặc hiểu luồng request: đọc [Kiến trúc và bản đồ mã nguồn](architecture-and-code-map.md).
- Cần sửa schema, quyền truy cập, đăng nhập hoặc dữ liệu: đọc [Dữ liệu, migrations và bảo mật](data-security-and-migrations.md).
- Cần chạy, kiểm tra hoặc phát hành: đọc [Phát triển và phát hành](development-and-release.md).

## Nguồn sự thật

1. Dùng mã nguồn hiện hành và các migration trong supabase/migrations để xác định hành vi, schema và quyền được quản lý trong repo.
2. Dùng README.md cho cấu hình/chạy dự án và docs/IMPLEMENTATION.md cho phạm vi nghiệp vụ hiện hành.
3. docs/DELIVERY_ROADMAP.md và docs/QA_TEST_REPORT_2026-09-28.md là ảnh chụp trạng thái tại thời điểm ghi. Chúng hữu ích để biết điều cần kiểm tra, nhưng không chứng minh trạng thái hiện tại.
4. docs/Hung_Cuong_Business_Design_v1.0.md và docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md được đánh dấu là tài liệu lịch sử. Một số nội dung về ClassMonth, payroll, tuition, accounting, timesheet, notification, reporting và permission group không còn thuộc ứng dụng hiện tại.
5. docs/plans/ chứa kế hoạch cho nhiệm vụ cụ thể trong quá khứ. Chỉ áp dụng khi người dùng yêu cầu đúng công việc đó và các giả định vẫn còn đúng.

Khi tài liệu và code mâu thuẫn, không tự suy diễn. Kiểm tra migration/code mới nhất, cập nhật mô tả trong context cho khớp hiện trạng và hỏi người dùng nếu còn mâu thuẫn về ý định sản phẩm.

## Phạm vi đang được mô tả

- Admin quản lý học sinh, giáo viên, lớp, thành viên lớp, lịch lặp và buổi học.
- Giáo viên xem buổi được phân công, bắt đầu/kết thúc buổi, điểm danh, nhập kết quả học tập và sửa thông tin cá nhân.
- Học sinh dùng tài khoản STUDENT riêng để xem lịch, lịch sử, giáo viên, điểm và chuyên cần của chính mình. Phụ huynh xem cùng tài khoản của học sinh.
- ROOT_ADMIN hiển thị như Admin. ASSISTANT đã được chuyển thành TEACHER trong migration 0039; PARENT đã ngừng quyền truy cập và luồng đăng nhập.
- Database vẫn lưu một số bảng và migration lịch sử về ClassMonth và tài chính; việc còn tồn tại trong database không có nghĩa là app được phép dùng lại.

## Bảo vệ dữ liệu

docs/accounts/ là thư mục local-only có thông tin truy cập; docs/data_seed/ chứa workbook nguồn. Không đưa nội dung, thông tin nhận diện, mật khẩu, username hoặc hồ sơ học sinh vào bộ context. Không stage hoặc commit các tệp local-only. Nếu cần kiểm thử luồng dữ liệu, dùng dữ liệu tổng hợp có tiền tố QA- và tuân theo quy trình được yêu cầu.

Không thực hiện thao tác production chỉ dựa vào trạng thái ghi trong tài liệu. Xác minh kết nối, target, migration hiện có và backup tại thời điểm thao tác.
