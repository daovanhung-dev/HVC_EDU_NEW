# Hướng dẫn agent cho HVC_EDU

## Quy trình trước khi sửa

1. Kiểm tra git status và giữ nguyên mọi thay đổi/commit có sẵn. Không reset, clean hoặc checkout đè công việc.
2. Phân loại yêu cầu: giao diện/nghiệp vụ, frontend, dữ liệu/RLS, Edge Function, phát hành/vận hành hay chưa rõ subsystem.
3. Mở [mục lục context](docs/agent-context/README.md), chỉ đọc gói tài liệu tối thiểu theo nhiệm vụ; sau đó lần theo code và migration thực tế.
4. Xác định phạm vi và lớp kiểm soát bị ảnh hưởng trước khi sửa. Nếu ý định sản phẩm còn mơ hồ sau khi đã kiểm tra nguồn trong repo, hỏi người dùng trước phần phụ thuộc vào ý định đó.

## Nguồn sự thật và phạm vi

- Code hiện hành và thứ tự migration trong supabase/migrations là căn cứ về hành vi, schema, quyền và trạng thái được quản lý trong repo.
- README.md và docs/IMPLEMENTATION.md mô tả cách chạy và phạm vi sản phẩm hiện hành.
- Tài liệu thiết kế v1, roadmap và báo cáo QA là tư liệu lịch sử/ảnh chụp; không chứng minh trạng thái production hiện tại và không tự mở lại module cũ.
- Giữ sản phẩm trong phạm vi lớp, thành viên lớp, lịch lặp, buổi học, hồ sơ học tập liên tục và chấm công theo buổi. Không khôi phục ClassMonth vận hành, học phí, payroll, accounting hay module legacy nếu người dùng chưa yêu cầu đổi phạm vi.

## Bảo mật và dữ liệu

- RLS, kiểm tra quyền trong PostgreSQL/RPC và Edge Function là ranh giới bảo mật. Route guard và ẩn nút chỉ phục vụ trải nghiệm.
- Frontend chỉ nhận Supabase URL, publishable key và base path công khai. Không đưa secret, mật khẩu, token hay credential vào source, log, tài liệu, fixture hoặc output.
- Không đọc, sao chép, hiển thị hay dùng nội dung docs/accounts/ và docs/data_seed/. Không stage hoặc commit dữ liệu local-only. Fixture nghiệp vụ dùng dữ liệu tổng hợp có tiền tố QA-.
- Bảo toàn lịch sử học tập; giữ ngày giờ nghiệp vụ theo Asia/Ho_Chi_Minh.

## Vận hành và phát triển

- Không tạo tài khoản, sửa/xóa dữ liệu production, áp migration production hoặc deploy nếu người dùng chưa yêu cầu rõ trong nhiệm vụ hiện tại. Khi được yêu cầu, xác minh project đích, migration, backup và workflow trực tiếp.
- Thay đổi schema bằng migration mới nối tiếp số hiện có; không sửa migration lịch sử đã có thể được áp dụng ở môi trường khác.
- Yêu cầu Node.js 22 và npm 10+. Lệnh chính: npm run dev, npm run typecheck, npm run test:run, npm run build.
- Hướng dẫn theo subsystem nằm trong frontend/AGENTS.md và supabase/AGENTS.md. Danh mục repo được sinh/kiểm tra bằng npm run agent:context:update và npm run agent:context:check.
- Trả lời bằng tiếng Việt, trừ khi người dùng yêu cầu ngôn ngữ khác.
