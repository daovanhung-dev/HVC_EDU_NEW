# HVC_EDU — Mục lục context cho agent

## Dùng context nhanh

Không cần đọc toàn bộ tài liệu cho mọi nhiệm vụ. Đi theo chuỗi này:

1. Kiểm tra git status; xác định đầu ra người dùng muốn và phạm vi subsystem.
2. Chọn đúng một hoặc vài gói đọc bên dưới. Nếu task chạm nhiều lớp, đọc phần giao nhau.
3. Dùng bản đồ mã nguồn để tìm entrypoint, service, function, migration và test cụ thể; xác minh mô tả bằng code hiện hành.
4. Trước thay đổi quyền/dữ liệu/phát hành, kiểm tra lớp bảo vệ và rủi ro vận hành tương ứng.

Với mọi tác vụ coding, test hoặc fix bug, luôn dùng [@Chrome](plugin://chrome@openai-bundled) trong quá trình thực hiện để mở/chạy ứng dụng, tái hiện tình huống hoặc kiểm tra kết quả liên quan.

| Loại nhiệm vụ | Gói context nên đọc trước | Sau đó lần theo |
|---|---|---|
| Phạm vi sản phẩm, vai trò, lịch/buổi, kết quả học tập | [Nghiệp vụ và luồng sử dụng](product-and-workflows.md) | Màn hình và lệnh đang thực thi luồng đó |
| Tìm cấu trúc hoặc sửa frontend | [Kiến trúc và bản đồ mã nguồn](architecture-and-code-map.md) | Router/page → store/service → test |
| Đăng nhập, schema, quyền, RLS, RPC hoặc migration | [Dữ liệu, migrations và bảo mật](data-security-and-migrations.md) | Migration mới nhất liên quan, policy/helper, Edge Function/RPC, test DB |
| Edge Function | [Kiến trúc](architecture-and-code-map.md) và [Dữ liệu/bảo mật](data-security-and-migrations.md) | Handler, helper dùng chung, RPC được gọi |
| Cài đặt, chạy local, CI hoặc phát hành | [Phát triển và phát hành](development-and-release.md) | package scripts, config và workflow hiện hành |
| Subsystem chưa quen hoặc đổi cấu trúc repo rộng | [Danh mục repo](repository-inventory.md) | Mở các file cần thiết; không đọc toàn bộ mã theo mặc định |

## Nguồn sự thật

1. Code hiện hành và supabase/migrations xác định hành vi, schema, quyền và các thay đổi được quản lý trong repo.
2. README.md và docs/IMPLEMENTATION.md mô tả cách chạy và phạm vi ứng dụng hiện hành.
3. Tài liệu trong docs/agent-context là bản đồ hướng dẫn đọc code, không thay code/migration làm căn cứ.
4. docs/DELIVERY_ROADMAP.md và các docs/QA_* là snapshot tại thời điểm ghi; chỉ dùng để biết lịch sử và điều cần kiểm tra, không suy ra production đang ở trạng thái đó.
5. docs/Hung_Cuong_Business_Design_v1.0.md và docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md là tài liệu lịch sử. docs/plans/ chỉ áp dụng khi người dùng yêu cầu đúng nhiệm vụ đó và giả định còn đúng.

Nếu context, README hoặc báo cáo cũ khác code/migration, xác minh nguồn mới nhất trong repo, sửa context cho khớp và hỏi người dùng khi còn mơ hồ về ý định sản phẩm. Trạng thái production luôn cần kiểm tra trực tiếp.

## Phạm vi hiện hành

Ứng dụng quản lý học sinh/giáo viên, lớp và thành viên, lịch lặp, buổi học, kết quả học tập liên tục, hồ sơ cá nhân và chấm công theo buổi. Admin có thể lập buổi theo tuần/tháng dưới dạng các buổi ngày cụ thể; đây không phải khôi phục kỳ ClassMonth. Giáo viên gửi chấm công sau khi buổi hoàn tất; Admin duyệt hoặc từ chối theo từng buổi.

ROOT_ADMIN dùng giao diện Admin. Vai trò hoạt động là ROOT_ADMIN, ADMIN, TEACHER và STUDENT; ASSISTANT/PARENT là vai trò lịch sử. Các bảng và migration ClassMonth/tài chính còn trong database không tự mở lại UI, API hay quyền ứng dụng cho module cũ.

## Bảo vệ dữ liệu

Không đọc, sao chép, hiển thị hoặc dùng nội dung docs/accounts/ và docs/data_seed/. Không đưa nhận diện học sinh/nhân sự, credential hay dữ liệu nguồn vào context/fixture. Không stage/commit dữ liệu local-only. Kiểm thử nghiệp vụ dùng dữ liệu tổng hợp tiền tố QA-.

Không thực hiện thao tác production nếu chưa được yêu cầu rõ. Khi được yêu cầu, xác minh project, migration, backup và workflow hiện hành; không dựa vào trạng thái ghi trong báo cáo lịch sử.

## Danh mục và bảo trì context

[Danh mục repo](repository-inventory.md) liệt kê đường dẫn Git theo dõi cùng subsystem/loại file, không lưu nội dung file. Đọc danh mục khi cần khám phá repo rộng hoặc khi không biết file thuộc đâu; với task thường ngày, dùng bảng định tuyến ở trên.

Sau khi thêm/xóa/đổi vị trí file được theo dõi hoặc file mới chưa bị ignore, chạy npm run agent:context:update để sinh lại danh mục và npm run agent:context:check để kiểm tra. File mới trong subsystem cần được phản ánh ở bảng định tuyến nếu làm thay đổi cách agent tìm entrypoint.
