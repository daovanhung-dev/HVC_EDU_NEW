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

## Kiểm tra đích và phạm vi staging

- Supabase CLI link và `supabase/config.toml` trỏ cùng project ref; CLI ghi nhận `0001–0039` đã áp dụng và migration local `0040` còn pending từ xa tại thời điểm kiểm tra.
- Bundle GitHub Pages đang mở cũng tham chiếu cùng Supabase project đó.
- Dashboard ngày 2026-09-30 hiển thị project ở branch `main` với nhãn `PRODUCTION`, gói `FREE`, và thông báo gói này không có scheduled database backups.
- Vì project đích không được xác nhận là staging và không có backup theo Dashboard, migration 0040 chưa được áp dụng từ xa. Không đăng nhập hoặc ghi dữ liệu qua website trong lượt này.
- Do đó các luồng Chrome admin tạo/sửa nhân sự, học sinh, lớp/lịch; teacher điểm danh/chấm điểm/nhận xét/hoàn tất; student xem lịch/kết quả và kiểm tra RLS được ghi là **chưa kiểm thử lại**, không phải đạt hay lỗi mới.

## Việc cần xác minh trước E2E

Cần project Supabase staging riêng và URL website đã cấu hình trỏ tới đúng project đó. Sau khi xác minh được hai đích trùng nhau và xác nhận backup phù hợp, áp dụng riêng migration 0040, không reset database, rồi chạy lại toàn bộ ma trận vai trò bằng dữ liệu `QA-`. Không sử dụng dữ liệu định danh từ `docs/accounts/` hoặc `docs/data_seed/` trong báo cáo.
