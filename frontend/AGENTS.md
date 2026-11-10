# Hướng dẫn agent: frontend

Đọc [hướng dẫn gốc](../AGENTS.md). Với thay đổi UI/nghiệp vụ, đọc thêm [mục lục context](../docs/agent-context/README.md), [bản đồ mã nguồn](../docs/agent-context/architecture-and-code-map.md) và phần sản phẩm liên quan trong [luồng nghiệp vụ](../docs/agent-context/product-and-workflows.md).

## Bản đồ nhanh

- Khởi tạo app, layout, router, auth store: frontend/src/main.ts, frontend/src/App.vue, frontend/src/app/, frontend/src/stores/auth.store.ts.
- Màn hình theo vai trò: frontend/src/modules/admin/pages/, frontend/src/modules/staff/pages/, frontend/src/modules/student/pages/ và frontend/src/modules/auth/pages/.
- Truy vấn/lệnh Supabase: frontend/src/services/data-queries.ts và frontend/src/services/commands.ts.
- Kiểu dùng chung, role, lỗi và tiện ích: frontend/src/shared/ và frontend/src/stores/.
- Test frontend nằm cạnh mã nguồn với hậu tố .test.ts; cấu hình Vitest ở frontend/vite.config.ts.

## Quy tắc triển khai

- Dùng Vue 3, TypeScript, Composition API và alias @ theo cấu trúc đang có. Tái sử dụng component/layout/service hiện hành trước khi thêm pattern mới.
- Gom truy vấn vào `data-queries` và thao tác vào `commands`/`edge-functions` theo cấu trúc hiện hành. Đọc và CRUD đơn giản được phép gọi Supabase Data API trực tiếp khi RLS/grants là lớp bảo vệ dữ liệu.
- Không tạo hoặc gọi RPC API (`supabase.rpc`/PostgREST RPC). Nghiệp vụ server-side, thao tác đặc quyền hoặc cần transaction phải gọi Supabase Edge Function; không thêm backend riêng ngoài Supabase.
- RPC caller hiện có là legacy; khi phạm vi công việc chạm tới luồng đó, thay phần liên quan bằng Edge Function thay vì mở rộng RPC.
- Router guard chỉ kiểm soát điều hướng; mọi thay đổi quyền hoặc phạm vi dữ liệu phải được kiểm tra ở database/Edge Function.
- Không đưa secret vào biến VITE_ hoặc bundle. Chỉ dùng VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY và VITE_APP_BASE_PATH ở frontend.
- Không khôi phục module legacy chỉ vì còn bảng hoặc migration cũ. Luồng chấm công hiện hành là yêu cầu theo buổi đã hoàn tất.
- Với mọi tác vụ coding, test hoặc sửa lỗi, dùng Chrome để chạy ứng dụng, tái hiện lỗi và kiểm tra kết quả theo `AGENTS.md`. Chọn lệnh phù hợp với phạm vi; không chạy thao tác ghi lên production chỉ để kiểm chứng.
