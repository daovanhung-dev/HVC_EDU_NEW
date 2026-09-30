# Báo cáo kiểm thử HVC_EDU staging — 2026-09-29

> Đây là ảnh chụp trạng thái kiểm thử ngày 2026-09-29 theo múi giờ `Asia/Ho_Chi_Minh`, không phải trạng thái trực tiếp. Cần xác minh lại trước mọi thao tác vận hành.

## Phạm vi

- Website: GitHub Pages staging HVC_EDU.
- Backend: project Supabase staging đã được đối chiếu với cấu hình CLI và URL website trước khi thao tác.
- Không reset database lần thứ hai trong lượt kiểm thử này. Không sửa mã ứng dụng, API, kiểu dữ liệu hoặc schema.
- Tài khoản nguồn được nhập cục bộ: 6 nhân sự và 47 học sinh; tổng hợp vai trò sau nhập là 1 ROOT_ADMIN, 6 TEACHER và 47 STUDENT.
- Tạo 1 tài khoản QA giáo viên và 2 tài khoản QA học sinh trên giao diện. Đây là dữ liệu tổng hợp; thông tin đăng nhập không được ghi trong báo cáo.

## Trạng thái backend tại thời điểm kiểm tra

- Migration `0001–0039`: đều được ghi nhận đã áp dụng; không còn migration đang chờ.
- Migration `0035` đã nạp 92 bản ghi attendance lịch sử cho 8 buổi học; dữ liệu nguồn và thông tin nhận diện không được sao chép vào báo cáo.
- Tám Edge Functions hiện hành đã được triển khai; 16 function legacy đã được dọn theo workflow của repo.
- ROOT đăng nhập thành công sau khi tải lại trang. Thông báo phiên hết hạn ban đầu là banner phiên cũ còn trên giao diện; sau reload banner biến mất và đăng nhập hoàn tất.
- Các lệnh `npm run typecheck`, `npm run test:run` (17/17) và `npm run build` đều đạt trên Node.js 22.23.3.

## Kết quả theo luồng

| Vai trò / luồng | Kết quả | Ghi chú |
|---|---|---|
| ROOT đăng nhập | Đạt | Dashboard quản trị mở được. |
| Admin tạo giáo viên QA | Đạt một phần | Tạo tài khoản thành công; danh sách nhân sự sau đó báo không tải được. |
| Admin tạo học sinh QA | Đạt | Tạo được hai tài khoản QA; danh sách học sinh tải được. |
| Admin xem/tạo lớp | Lỗi P1 | Danh sách lớp báo không tải được. Khi mở form, các lựa chọn môn/khối không được nạp nên không thể lưu lớp qua UI. Tải lại trang không khắc phục. |
| Admin tạo/sửa lịch và kiểm tra sinh buổi 30 ngày theo `Asia/Ho_Chi_Minh` | Bị chặn | Không thể tạo lớp QA để tiếp tục luồng lịch. |
| Giáo viên QA đăng nhập | Đạt | Đăng nhập được và vào đúng khu vực giáo viên. |
| Giáo viên xem buổi được phân công / hồ sơ cá nhân | Lỗi | Hai trang hiển thị lỗi tải dữ liệu; không có buổi QA để thử điểm danh, chấm điểm, nhận xét hoặc hoàn tất. |
| Học sinh QA đăng nhập | Đạt | Đăng nhập được và vào trang học sinh. |
| Học sinh xem lịch và kết quả học tập trên UI | Lỗi | Cả trang lịch và trang kết quả hiển thị lỗi tải dữ liệu. Chưa có lớp/buổi QA để kiểm tra nội dung học tập. |
| RLS cô lập hồ sơ học sinh | Đạt ở mức hồ sơ | Mô phỏng truy vấn dưới role `authenticated`: mỗi tài khoản QA chỉ đọc được 1 trong 2 hồ sơ QA. Chưa kiểm tra được cô lập điểm/nhận xét qua UI vì chưa tạo được lớp và buổi QA. |
| Đăng nhập phụ huynh riêng | Không áp dụng | Ứng dụng hiện dùng tài khoản STUDENT của học sinh; PARENT không còn luồng đăng nhập. |
| Admin xác nhận điểm danh riêng | Không áp dụng | Luồng hiện hành để giáo viên nhập và hoàn tất kết quả; không có bước admin xác nhận riêng. |
| Chấm công giáo viên | Không áp dụng | Không thuộc luồng ứng dụng hiện hành. |

## Lỗi cần sửa

### BUG-01 — Vòng lặp RLS chặn truy vấn nhân sự, lớp và dữ liệu buổi học

- **Mức độ:** P1 — chặn các luồng quản trị lớp/lịch và luồng giáo viên/học sinh.
- **Tái hiện:** đăng nhập ROOT, mở Nhân sự rồi Lớp học; cả hai trang báo lỗi tải. Đăng nhập QA teacher/student rồi mở các trang buổi học, hồ sơ, lịch hoặc kết quả; các trang cũng báo lỗi tải.
- **Kỳ vọng:** ROOT/Admin đọc được nhân sự và lớp; giáo viên đọc được buổi được phân công; học sinh đọc được lịch và kết quả của chính mình.
- **Thực tế:** truy vấn nhân sự dưới role `authenticated` trả lỗi PostgreSQL `42P17` — `infinite recursion detected in policy for relation "staff"`. Truy vấn lớp và truy vấn join buổi với `session_staff`/`staff` trả lỗi đệ quy trên `session_staff`. Các trang phụ thuộc những quan hệ này không nạp được. Môn và khối vẫn đọc được ở role này (25 và 12 dòng tương ứng), nên lỗi form lớp phát sinh khi truy vấn lớp thất bại chứ không phải do thiếu danh mục nền.
- **Khu vực liên quan:** chính sách trong `supabase/migrations/0039_continuous_learning.sql`, đặc biệt `staff_select`, `classes_select`, `session_staff_select` và các policy lịch liên quan. `frontend/src/modules/admin/pages/ClassesPage.vue` dùng `Promise.all` cho lớp/môn/khối; lỗi đọc lớp làm toàn bộ danh mục form không được gán.
- **Bằng chứng đã giảm thiểu dữ liệu:** chỉ dùng số lượng/role QA và truy vấn tổng hợp; không trích xuất hồ sơ cá nhân hoặc kết quả học tập.

## Kế hoạch sửa đề xuất

1. **Sửa chu trình policy bằng migration mới `0040`**, không sửa các migration đã áp dụng. Rà toàn bộ đồ thị RLS giữa `staff`, `session_staff`, `session_students`, `classes`, `class_schedules` và `class_schedule_staff`. Dùng helper `SECURITY DEFINER` có `search_path` cố định cho các phép kiểm tra quan hệ cần vượt qua RLS; thu hồi execute khỏi `public`/`anon` và chỉ cấp cho role cần thiết. Giữ nguyên nguyên tắc: teacher chỉ thấy lớp/buổi được phân công, student chỉ thấy dữ liệu của mình.
2. **Thêm kiểm thử RLS hồi quy** với ROOT_ADMIN, ADMIN, TEACHER được phân công/không được phân công, STUDENT sở hữu/không sở hữu; kiểm tra cả truy vấn đơn bảng lẫn quan hệ embed mà frontend dùng. Xác nhận truy vấn không còn lỗi `42P17` và không mở rộng dữ liệu giữa hai học sinh.
3. **Kiểm tra migration cục bộ**, chạy typecheck, unit tests và build theo workflow dự án; rà SQL policy/helper và grants trước khi triển khai staging. Không áp dụng migration production trong bước sửa này.
4. **Sau khi migration được duyệt và áp dụng staging**, chạy lại E2E bằng một lớp QA mới: thêm giáo viên/học sinh, lịch lặp, sửa lịch, sinh buổi 30 ngày theo giờ Việt Nam, điểm danh/điểm/nhận xét/hoàn tất, rồi xác minh admin và hai tài khoản STUDENT.
5. **Cải thiện thông báo lỗi UI ở một thay đổi riêng nếu cần:** hiển thị thông báo tải thất bại rõ ràng hơn và giữ phần danh mục môn/khối độc lập với lỗi tải lớp để người dùng nhận biết chính xác bước bị lỗi. Việc này không thay thế sửa RLS.

## Dữ liệu QA còn lại

Ba tài khoản QA (1 giáo viên, 2 học sinh) được giữ trên staging để phục vụ lần kiểm thử lại sau khi sửa RLS. Báo cáo không lưu username, mật khẩu tạm thời, tên, mã học sinh hoặc thông tin liên hệ.
