# Báo cáo sửa lỗi RLS và kiểm thử HVC_EDU — 2026-09-30

> Ảnh chụp công việc ngày 2026-09-30 theo múi giờ `Asia/Ho_Chi_Minh`. Đây không phải trạng thái trực tiếp của Supabase; xác minh lại project và migration trước thao tác vận hành.

## Kết quả

- Đã thêm migration `0040_fix_continuous_learning_rls_recursion.sql` để thay các policy đọc chéo bảng bằng helper `SECURITY DEFINER` với `search_path` cố định. Quyền helper bị thu hồi khỏi `PUBLIC`/`anon` và chỉ cấp cho `authenticated`/`service_role`.
- Quy tắc truy cập được giữ nguyên: admin đọc dữ liệu quản trị; giáo viên chỉ đọc các quan hệ theo phân công hiện hành; học sinh chỉ đọc hồ sơ/kết quả của mình và chỉ đọc attendance khi buổi đã hoàn tất.
- Đã thêm 41 assertion hồi quy cho ROOT_ADMIN, ADMIN, giáo viên được/không được phân công, hai học sinh, quan hệ lồng nhau, kết quả chưa hoàn tất, cô lập học sinh và quyền gọi helper.
- Cập nhật context bảo mật/migration để ghi nhận migration 0040.

## Kiểm tra local

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` trên Node.js 22.23.3 | Đạt |
| `npm run test:run` | Đạt, 17/17 test |
| `npm run build` | Đạt |
| Migration 0040 và 41 assertion trên PostgreSQL 17 cô lập với fixture tổng hợp | Đạt |
| `supabase test db --local` | Không chạy được: kết nối local `127.0.0.1:54322` bị từ chối; môi trường không có Docker để khởi động Supabase local stack |

Bài kiểm tra PostgreSQL cô lập dùng schema-shaped fixture và assertion shim tương thích với các assertion trong tệp pgTAP. Đây không thay thế kiểm thử trên Supabase local thật.

## Xác minh đích và triển khai production

- Ngày 2026-09-30 (`Asia/Ho_Chi_Minh`), xác minh Supabase CLI, `supabase/config.toml` và bundle GitHub Pages cùng trỏ project ref `dtftytlyaqmxjgynicqs`. Trước khi ghi, remote đã có `0001–0039`; chỉ `0040` còn pending.
- Dashboard được kiểm tra cùng ngày hiển thị branch `main` với nhãn `PRODUCTION`, gói `FREE`, không có scheduled database backups. Theo chỉ đạo hiện hành của người dùng, chấp nhận không tạo backup và rủi ro triển khai production.
- Chạy `supabase db push --linked`; CLI xác nhận chỉ áp dụng `0040_fix_continuous_learning_rls_recursion.sql`, không reset database, không chạy seed hay migration khác. Kiểm tra sau đó cho thấy remote migration history đồng bộ `0001–0040`.
- Truy vấn metadata sau triển khai xác nhận bảy helper mới đều có `EXECUTE` cho `authenticated`, không có cho `anon`; bảy policy SELECT tương ứng dùng helper mới.

## Kiểm tra Chrome ngày 2026-09-30

- Website mở đúng project đã đối chiếu. Đăng nhập ROOT thành công; ban đầu trang hiện thông báo phiên cũ hết hạn, nhưng sau đăng nhập ứng dụng tải được khu vực quản trị.
- Trang nhân sự tải được 8 dòng, trang lớp học tải được 3 dòng; trang buổi học tải thành công nhưng hiện không có dòng nào. Không đưa thông tin hồ sơ hiển thị trên trang vào báo cáo.
- Form tạo giáo viên chỉ được mở và chuẩn bị bằng dữ liệu tổng hợp `QA-`; chưa gửi form hoặc tạo tài khoản. Cần xác nhận tại thời điểm gửi theo quy tắc an toàn trình duyệt khi đang thao tác trên production.
- Vì chưa gửi tạo tài khoản QA, các luồng ghi admin, tạo lịch/buổi, teacher điểm danh/chấm điểm/nhận xét/hoàn tất, student xem kết quả và kiểm tra cô lập giữa hai học sinh vẫn là **chưa kiểm thử lại**. Chưa có bằng chứng mới để phân loại các luồng đó là đạt hoặc lỗi.
- Đăng nhập phụ huynh riêng, admin xác nhận điểm danh và chấm công giáo viên vẫn **không áp dụng** theo luồng hiện hành.

## Việc cần xác minh trước E2E

Để hoàn tất kiểm thử ghi trên project production, cần xác nhận gửi riêng từng form tạo tài khoản QA ngay trước khi gửi. Sau khi các tài khoản tổng hợp được tạo, tiếp tục ma trận admin/teacher/student bằng dữ liệu `QA-`; không reset database, không xóa dữ liệu học tập đã ghi. Không sử dụng dữ liệu định danh từ `docs/accounts/` hoặc `docs/data_seed/` trong báo cáo.

## Cập nhật bổ sung — 2026-09-30 16:57 ICT

- Đọc hai tài liệu tài khoản local-only theo yêu cầu; nội dung, thông tin đăng nhập và hồ sơ không được sao chép vào báo cáo. Chưa dùng chúng để đăng nhập vai trò khác.
- Chrome xác nhận trước đó request buổi học lỗi với PostgreSQL `42703`, thiếu `sessions.manual_schedule`. Sau khi áp dụng migration và tải lại trang, thông báo lỗi tải buổi học không còn xuất hiện. Không tạo hay sửa bản ghi nghiệp vụ trong lần kiểm tra này.
- Trước khi ghi, CLI xác nhận project `dtftytlyaqmxjgynicqs` đang hoạt động; migration list ghi nhận `0001–0040` đã áp dụng. Dry-run chỉ liệt kê `0041_admin_monthly_session_planning.sql` và `0042_restore_session_timesheets.sql`.
- `supabase db push --linked --yes` đã áp dụng đúng `0041–0042`, không reset và không chạy seed. Migration list sau đó xác nhận `0001–0042` đã áp dụng.
- Đã triển khai riêng Edge Functions `timesheet-submit` và `timesheet-review`; danh sách function sau triển khai hiển thị cả hai ACTIVE với xác minh JWT bật. Workflow Supabase cũng được cập nhật để không xóa endpoint `timesheet-submit` đã phục hồi.
- Đã sửa ở source việc làm mới ngày mặc định khi mở form buổi; chọn ngày cụ thể trên lịch vẫn được giữ. Thêm hai màn hình chấm công, RLS/RPC giới hạn giáo viên theo buổi được phân công và Admin theo vai trò, cùng kiểm thử hồi quy.

| Kiểm tra local | Kết quả |
|---|---|
| Node.js 22.23.3 — `npm run typecheck` | Đạt |
| `npm run test:run` | Đạt, 39/39 test |
| `npm run build` | Đạt; Vite có cảnh báo bundle chính lớn hơn 500 kB |
| `deno check` cho hai Edge Function mới | Đạt |
| pgTAP trên Supabase local | Chưa chạy: Docker không có và tài khoản PostgreSQL local hiện tại không kết nối được; không chạy pgTAP trên production |

### Phát hành frontend và kiểm thử vai trò

- Thay đổi đã commit cục bộ ở `3a61d31`; push lên GitHub thất bại do terminal không có credential và không có SSH identity. GitHub connector có quyền đọc nhưng thao tác tạo nhánh trả 403. Vì thế GitHub Pages chưa nhận frontend mới; nút điều hướng và màn hình chấm công mới chưa có trên website trực tiếp.
- Chưa tạo người dùng hoặc dữ liệu QA trên production; chưa đăng nhập Teacher/Student, chưa chấm công/duyệt công và chưa nhập kết quả học tập. Các luồng đó vẫn **chưa kiểm thử**.
- Chưa tạo backup và không xóa dữ liệu, theo phạm vi người dùng đã chấp nhận. Cần có quyền GitHub ghi để phát hành commit local rồi tiếp tục E2E qua Chrome bằng tài khoản QA và dữ liệu tổng hợp.
