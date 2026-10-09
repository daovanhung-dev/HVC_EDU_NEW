# HVC_EDU — Mục lục context cho agent

## Nạp context

1. Kiểm tra `git status` và đọc `AGENTS.md`; giữ nguyên mọi thay đổi sẵn có.
2. Xác định subsystem và đầu ra người dùng muốn.
3. Chọn gói context trong bảng dưới, rồi mở đúng entrypoint và lần theo code/migration/test hiện hành.
4. Nếu cần hiểu toàn dự án, đọc theo thứ tự: kiến trúc → nghiệp vụ → dữ liệu/bảo mật → phát triển/phát hành → danh mục file.

| Nhiệm vụ | Context nên đọc | Sau đó lần theo |
|---|---|---|
| Hiểu tổng thể hoặc tìm entrypoint | [Kiến trúc và bản đồ mã nguồn](architecture-and-code-map.md) | Route/page → service/command → RPC/Edge Function → migration/RLS → test |
| Phạm vi, vai trò, lịch, buổi, điểm danh/đánh giá, AI | [Nghiệp vụ và luồng sử dụng](product-and-workflows.md) | Màn hình và rule kiểm tra phía database/server |
| Login, schema, quyền, RLS, RPC, migration | [Dữ liệu, migrations và bảo mật](data-security-and-migrations.md) | Migration liên quan mới nhất, helper/policy/grant và test SQL |
| Cài đặt, kiểm tra, CI hoặc phát hành | [Phát triển và phát hành](development-and-release.md) | Manifest, config và workflow hiện hành |
| Không biết file thuộc đâu hoặc đổi cấu trúc repo | [Danh mục repository](repository-inventory.md) | Mục đích của từng file, rồi mở file source tương ứng |

Với mọi tác vụ coding, test hoặc sửa lỗi, dùng Chrome để mở/chạy ứng dụng hoặc kiểm tra kết quả liên quan. UI review harness dùng mock và fixture `QA-`, không kết nối Supabase thật.

## Nguồn sự thật

1. Code chạy hiện hành và thứ tự migration quyết định hành vi, schema và quyền.
2. `README.md` và `docs/IMPLEMENTATION.md` mô tả cách chạy và phạm vi sản phẩm; vẫn cần đối chiếu code khi có khác biệt.
3. Bộ context này là bản đồ tìm hiểu, không thay code hoặc migration.
4. Thiết kế v1, roadmap, kế hoạch theo nhiệm vụ và báo cáo QA là tài liệu lịch sử. Chúng không chứng minh trạng thái production hiện tại và không tự mở lại module cũ.
5. Không ghi trạng thái production, migration đã áp dụng, backup, DNS hoặc credential thành sự thật hiện tại nếu chưa xác minh trực tiếp.

## Phạm vi sản phẩm hiện hành

HVC_EDU quản lý hồ sơ học sinh/giáo viên, lớp và membership theo ngày, lịch lặp, buổi học theo ngày, kết quả học tập liên tục, video bài học và yêu cầu chấm công theo buổi. Vai trò hoạt động là `ROOT_ADMIN`, `ADMIN`, `TEACHER`, `STUDENT`; `ASSISTANT` và `PARENT` là vai trò lịch sử.

ClassMonth, học phí, payroll, kế toán và một số module cũ vẫn có thể tồn tại trong migration/database hoặc tài liệu lịch sử. Việc tồn tại không có nghĩa app hiện hành có UI/API/quyền cho chúng. Xem [phạm vi và luồng nghiệp vụ](product-and-workflows.md) trước khi thêm tính năng thuộc nhóm này.

## Dữ liệu và an toàn

- RLS, kiểm tra quyền PostgreSQL/RPC và Edge Function là ranh giới bảo mật. Route guard/ẩn nút chỉ hỗ trợ trải nghiệm.
- Không đọc, sao chép, hiển thị hoặc dùng nội dung `docs/accounts/` và `docs/data_seed/`; inventory chỉ được ghi metadata đường dẫn/loại file an toàn.
- Không đưa secret, mật khẩu, token, credential hoặc dữ liệu nhận diện vào code, log, fixture, context hay phản hồi. Kiểm thử nghiệp vụ dùng dữ liệu tổng hợp tiền tố `QA-`.
- Bảo toàn lịch sử học tập và giữ thời gian nghiệp vụ theo `Asia/Ho_Chi_Minh`.

## Danh mục và cập nhật context

[Danh mục repository](repository-inventory.md) được sinh từ file Git theo dõi và file mới không bị ignore. Mỗi dòng ghi đường dẫn, subsystem, loại file và mục đích sử dụng. File ignored/build/cache không thuộc inventory; nội dung thư mục dữ liệu được bảo vệ không được đọc.

Sau khi thêm, xóa hoặc đổi vị trí file, chạy `npm run agent:context:update` rồi `npm run agent:context:check`. Khi thay đổi hành vi sản phẩm, cập nhật mô tả context từ code/migration hiện hành và giữ riêng các ghi chú lịch sử.
