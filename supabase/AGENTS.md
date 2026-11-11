# Hướng dẫn agent: Supabase

Đọc [hướng dẫn gốc](../AGENTS.md). Trước thay đổi database hoặc Edge Function, đọc [context dữ liệu/bảo mật](../docs/agent-context/data-security-and-migrations.md); đọc [luồng nghiệp vụ](../docs/agent-context/product-and-workflows.md) khi quy tắc nghiệp vụ bị tác động và [phát triển/phát hành](../docs/agent-context/development-and-release.md) khi cần lệnh hoặc workflow.

## Database và quyền

- Migration hiện có chạy đến 0066 trong worktree này. Thêm migration mới với số tiếp theo; tuyệt đối không sửa, xóa hoặc đổi số migration lịch sử.
- Rà quyền đọc/ghi, RLS policy, helper SQL nội bộ, SECURITY DEFINER, search_path, grants và vai trò bị ảnh hưởng cho mọi thay đổi schema hoặc API.
- Không tạo hoặc gọi RPC API (`supabase.rpc`/PostgREST RPC), kể cả bên trong Edge Function. Các RPC/caller đã có chỉ là legacy; khi sửa luồng liên quan, chuyển phần nghiệp vụ đó sang Edge Function. Helper/trigger SQL nội bộ không được gọi như API vẫn được phép.
- Không dùng client-side role, route, id từ trình duyệt hay hidden button làm căn cứ cấp quyền.
- Bảo toàn audit và lịch sử học tập; dùng fixture tổng hợp QA- cho kiểm thử.

## Edge Functions

- Dùng helper trong supabase/functions/_shared/ cho xác thực caller, CORS và response/error. Xác thực người gọi và quyền trên server trước thao tác đặc quyền.
- Luồng thêm lịch mẫu chạy qua `admin-month-week-template-addition`; Edge Function dùng transaction PostgreSQL trực tiếp và không gọi các RPC template đã bị migration 0065 gỡ bỏ.
- Thuê phòng dùng bảng `room_rentals` và Edge Function `admin-room-rentals`; lượt hủy được giữ làm lịch sử, thao tác dùng transaction/audit và không gắn attendance hay dữ liệu lớp vào lượt thuê.
- Secret chỉ ở môi trường server/secret manager; không in hoặc ghi credential/token vào log, test hay context.
- Ngay sau khi tạo Edge Function mới, deploy đúng function đó lên Supabase project đích đã xác minh rồi chạy smoke test an toàn, có phạm vi trong cùng tác vụ; không coi source/test local là hoàn tất. Dùng dữ liệu QA tổng hợp, không dùng production làm môi trường thử nghiệm, và giữ cấu hình JWT theo thiết kế.
- Nếu bị chặn bởi project, quyền, mạng hoặc cấu hình secret, nêu rõ bước deploy/xác minh còn thiếu và không báo tính năng đã hoàn tất.

## Phát hành và dữ liệu thật

- Project Supabase mặc định là `dtftytlyaqmxjgynicqs`; khi liên kết Supabase CLI với remote, dùng `supabase link --project-ref dtftytlyaqmxjgynicqs` và xác minh ref trước lệnh tác động remote.
- Người dùng đã ủy quyền agent thao tác và thực thi lệnh trên production trong phạm vi công việc của dự án; không cần xin phép lại chỉ vì thao tác chạy trên production. Trước khi thao tác, xác minh project đích, lịch sử migration, backup/recovery và workflow đang dùng. Không dùng production làm nơi thử. Báo cáo QA cũ chỉ là snapshot.
- Giữ giờ nghiệp vụ theo Asia/Ho_Chi_Minh. Không xóa hoặc sửa lịch sử để phục vụ luồng mới.
