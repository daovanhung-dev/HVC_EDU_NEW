# Hướng dẫn agent: Supabase

Đọc [hướng dẫn gốc](../AGENTS.md). Trước thay đổi database hoặc Edge Function, đọc [context dữ liệu/bảo mật](../docs/agent-context/data-security-and-migrations.md); đọc [luồng nghiệp vụ](../docs/agent-context/product-and-workflows.md) khi quy tắc nghiệp vụ bị tác động và [phát triển/phát hành](../docs/agent-context/development-and-release.md) khi cần lệnh hoặc workflow.

## Database và quyền

- Migration hiện có chạy đến 0052 trong repo. Thêm migration mới với số tiếp theo; tuyệt đối không sửa, xóa hoặc đổi số migration lịch sử.
- Rà quyền đọc/ghi, RLS policy, helper, RPC/SECURITY DEFINER, search_path, grants và vai trò bị ảnh hưởng cho mọi thay đổi schema hoặc API.
- Không dùng client-side role, route, id từ trình duyệt hay hidden button làm căn cứ cấp quyền.
- Bảo toàn audit và lịch sử học tập; dùng fixture tổng hợp QA- cho kiểm thử.

## Edge Functions

- Dùng helper trong supabase/functions/_shared/ cho xác thực caller, CORS và response/error. Xác thực người gọi và quyền trên server trước thao tác đặc quyền.
- Secret chỉ ở môi trường server/secret manager; không in hoặc ghi credential/token vào log, test hay context.

## Phát hành và dữ liệu thật

- Không áp migration, chạy seed, tạo tài khoản, thay đổi dữ liệu production hoặc deploy nếu người dùng chưa yêu cầu rõ trong nhiệm vụ hiện tại.
- Trước thao tác được yêu cầu, xác minh project đích, lịch sử migration, backup và workflow đang dùng. Báo cáo QA cũ chỉ là snapshot.
- Giữ giờ nghiệp vụ theo Asia/Ho_Chi_Minh. Không xóa hoặc sửa lịch sử để phục vụ luồng mới.
