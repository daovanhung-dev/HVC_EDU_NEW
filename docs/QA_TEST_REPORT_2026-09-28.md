# Báo cáo kiểm thử HVC EDU — 2026-09-28

## Kết quả kiểm tra production

- Đã mở `https://daovanhung-dev.github.io/HVC_EDU_NEW/#/` bằng Chrome thật. Trang và bundle frontend tải được; giao diện đăng nhập được dựng.
- Khởi tạo phiên và đăng nhập ROOT_ADMIN đều không kết nối được Supabase. Chrome báo `net::ERR_NAME_NOT_RESOLVED` cho `dtftytlyaqmxjgynicqs.supabase.co/functions/v1/login-by-identifier`; máy local cũng không phân giải được hostname này. Cloudflare DNS và Google DNS cùng trả `NXDOMAIN` cho host đó.
- Đây là lỗi kết nối/DNS tới backend, chưa có bằng chứng tài khoản hay mật khẩu sai. Không tạo, sửa hoặc xóa dữ liệu nghiệp vụ trong production.
- Không tạo seed QA vì backend không truy cập được. Hồ sơ trong `docs/accounts/student-accounts.md` là roster học sinh thật, không được dùng để tạo attendance giả.

## Kế hoạch sửa và thay đổi đã làm local

1. Chặn profile PARENT cũ khỏi login và các Edge Functions; router không coi profile đó là phiên đã đăng nhập.
2. Gỡ luồng tạo tài khoản phụ huynh và màn hình chọn con. Học sinh và phụ huynh dùng login STUDENT của học sinh.
3. Thêm migration `0038_retire_parent_role.sql` để thu hồi quyền RLS của PARENT. Bảng `parent_students`, profile/link cũ và enum lịch sử vẫn được giữ.
4. Gỡ hai accounting Edge Functions khỏi source và thêm bước xóa đúng hai endpoint production khi chạy workflow backend. Bảng, migration và lịch sử kế toán không bị xóa. Payroll và xác nhận tài chính tiếp tục tắt.

## Kiểm tra local

- `npm run typecheck`: đạt.
- `npm run test:run`: đạt, 21/21 tests.
- `npm run build`: đạt; Vite còn cảnh báo bundle JavaScript lớn hơn 500 kB.
- `deno check` cho hai Edge Functions đã sửa cùng module dùng chung: đạt.
- Workspace hiện có Node 24.21.0; dự án khai báo yêu cầu Node 22. Kiểm tra local đã chạy nhưng cần xác nhận lại bằng Node 22 trong CI.

## Ma trận kiểm thử production

| Nhóm | Trạng thái |
|---|---|
| ROOT_ADMIN | Đã thử đăng nhập; bị chặn bởi DNS Supabase |
| TEACHER / ASSISTANT | Chưa thể đăng nhập khi backend chưa reachable |
| STUDENT và 47 tài khoản trong roster | Chưa thể chạy kiểm tra chỉ đọc |
| PARENT | Mã local đã retire; cần áp migration và deploy Edge Functions |
| Các luồng lớp/tháng/lịch/điểm danh/chấm công/báo cáo/notifications/audit | Chưa chạy E2E production do không có phiên Supabase |
| Payroll/kế toán | Loại khỏi phạm vi; payroll và API tài chính đang tắt |

## Seed QA và dọn dữ liệu

Khi backend hoạt động, dùng một lớp và một học sinh synthetic có mã/tên bắt đầu bằng `QA-`, không dùng hồ sơ roster thật. Tạo ClassMonth và lịch riêng, gán giáo viên hiện có, activate tháng, điểm danh bằng tài khoản giáo viên, rồi xác minh kết quả bằng login STUDENT. Sau test sẽ xóa các dòng nghiệp vụ chỉ thuộc lớp QA, bao gồm session, attendance, tuition snapshot và timesheet nếu có; xóa Auth identity synthetic sau khi phụ thuộc được dọn. Giữ audit logs vì đây là nhật ký bất biến của hệ thống.

Trước khi tạo Auth identity trong production và trước khi xóa identity vĩnh viễn, cần xác nhận tại đúng thời điểm thao tác. Việc deploy Pages và migration/Edge Functions cũng đang chờ duyệt như đã thống nhất.
