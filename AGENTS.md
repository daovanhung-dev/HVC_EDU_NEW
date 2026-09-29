# Hướng dẫn agent cho HVC_EDU

Trước khi thay đổi dự án, đọc [mục lục context](docs/agent-context/README.md) và các phần liên quan đến nhiệm vụ. Bộ context mô tả phạm vi hiện hành, kiến trúc, dữ liệu, bảo mật và phát hành.

## Thứ tự tham khảo

1. Mã nguồn hiện tại và chuỗi migration trong supabase/migrations là căn cứ cho hành vi và schema đang được quản lý trong repo.
2. README.md và docs/IMPLEMENTATION.md mô tả cách chạy và phạm vi sản phẩm hiện hành.
3. Tài liệu thiết kế nghiệp vụ v1.0 và kiến trúc GitHub Pages/Supabase là tài liệu lịch sử; không khôi phục module tháng hoặc tài chính chỉ dựa trên tài liệu đó.
4. Roadmap và báo cáo QA ghi lại trạng thái tại một thời điểm. Luôn xác minh trạng thái backend, production và backup trước hành động vận hành.

## Quy tắc làm việc

- Giữ sản phẩm trong phạm vi quản lý lớp, lịch lặp, buổi học và hồ sơ học tập liên tục. Không đưa ClassMonth hoặc nghiệp vụ tài chính cũ trở lại nếu người dùng chưa yêu cầu thay đổi phạm vi.
- Bắt đầu bằng việc kiểm tra trạng thái Git; giữ nguyên thay đổi và commit local của người dùng. Không reset, clean hoặc checkout đè lên công việc sẵn có.
- Thay đổi schema bằng migration mới, nối tiếp số thứ tự hiện có. Không sửa migration lịch sử đã có thể được áp dụng ở môi trường khác.
- RLS và kiểm tra phía database/Edge Function là ranh giới bảo mật. Route guard và ẩn nút trên frontend chỉ phục vụ trải nghiệm, không thay thế phân quyền dữ liệu.
- Frontend chỉ dùng Supabase URL, publishable key và base path công khai. Không đưa service/secret key, mật khẩu database, access token, bootstrap secret hay credential vào source, log, tài liệu context hoặc output.
- Coi docs/accounts/ là dữ liệu truy cập local-only và docs/data_seed/ là dữ liệu nguồn cần bảo vệ. Không đọc, sao chép, hiển thị hoặc dùng dữ liệu thật trong context/fixture. Kiểm thử nghiệp vụ bằng dữ liệu tổng hợp có tiền tố QA-.
- Không tạo tài khoản, sửa/xóa dữ liệu production, áp migration production hoặc deploy nếu người dùng chưa yêu cầu rõ trong nhiệm vụ hiện tại. Trước thao tác được yêu cầu, xác minh đúng project, trạng thái migration, backup và quy trình workflow.
- Giữ ngày giờ nghiệp vụ theo Asia/Ho_Chi_Minh. Bảo toàn lịch sử học tập; không sửa hoặc xóa dữ liệu lịch sử để xử lý một luồng mới.
- Trả lời người dùng bằng tiếng Việt, trừ khi họ yêu cầu ngôn ngữ khác.

## Lệnh dự án

Yêu cầu Node.js 22 và npm 10 trở lên. Các lệnh chính: npm run dev, npm run typecheck, npm run test:run và npm run build.

Lệnh Supabase local và biến môi trường được ghi trong README.md và docs/agent-context/development-and-release.md.
