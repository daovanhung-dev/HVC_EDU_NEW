# HVC_EDU Implementation

## Sản phẩm hiện tại

HVC_EDU quản lý lớp học và hồ sơ học tập liên tục, không tạo tháng vận hành hay kỳ kế toán.

- **Admin:** nhân sự, học sinh, hồ sơ theo dòng thời gian, lớp, lịch lặp và buổi học; xem video bài học trong chi tiết buổi.
- **Giáo viên:** buổi được phân công, bắt đầu/kết thúc buổi, điểm danh, điểm và nhận xét; nhập nội dung cùng link YouTube khi buổi đang diễn ra; xem video trong chi tiết buổi; gửi chấm công cho buổi đã hoàn tất; tự sửa thông tin liên hệ.
- **Admin:** duyệt hoặc từ chối yêu cầu chấm công theo từng buổi; từ chối phải ghi lý do.
- **Học sinh:** xem lịch, lịch sử, giáo viên, điểm và chuyên cần của chính mình; xem lại video buổi đã hoàn thành trong “Xem lại bài cũ”; hỏi AI bằng tiếng Việt và có thể chọn nội dung một bài học làm ngữ cảnh.
- ROOT_ADMIN tiếp tục vào giao diện Admin. Tài khoản ASSISTANT hiện có được đổi thành TEACHER trong migration, giữ user id và lịch sử.

## Lớp, lịch và buổi học

`class_memberships` là danh sách xếp lớp hiện hành, có ngày bắt đầu và ngày kết thúc. `class_schedules` lưu lịch lặp theo thứ trong tuần; `class_schedule_staff` lưu giáo viên phụ trách từng lịch. Mỗi lớp có tối đa 5 giáo viên duy nhất đang được phân công, tính gộp lịch chưa lưu trữ và buổi chưa hoàn tất/chưa hủy; cùng một giáo viên ở nhiều lịch hoặc buổi chỉ tính một lần. Lịch ARCHIVED và buổi COMPLETED/CANCELLED không chiếm giới hạn. `sessions.class_id` gắn buổi học trực tiếp với lớp; `sessions.room` giữ phòng tại từng buổi; `sessions.lesson_youtube_url` lưu link video tùy chọn.

Video chỉ được nhập/sửa bởi giáo viên được phân công khi buổi IN_PROGRESS; khi hoàn tất, link và nội dung chỉ đọc. “Xem lại bài cũ” chỉ liệt kê buổi COMPLETED có video trong dữ liệu buổi mà RLS cho phép học sinh đọc. Chat AI giữ hội thoại trong trang đang mở; Gemini nhận câu hỏi, các lượt gần nhất và thông tin lớp/môn, ngày, nội dung buổi được chọn. Điểm, chuyên cần, nhận xét cá nhân và video không được gửi cho AI.

Migration `0039_continuous_learning.sql` sao chép lịch gần nhất từ ClassMonth sang cấu hình lịch mới ở trạng thái INACTIVE. Admin kiểm tra sĩ số và giáo viên trên trang lớp rồi bật lịch. Lịch được bật sinh các buổi chưa bắt đầu trong 30 ngày tới theo `Asia/Ho_Chi_Minh`; job Supabase Cron chạy lúc 17:00 UTC mỗi ngày. Hàm sinh lịch có khóa chống chạy đồng thời, khóa duy nhất chống trùng buổi, cập nhật roster/giáo viên cho buổi chưa bắt đầu và giữ nguyên buổi đã bắt đầu hoặc hoàn tất.

Supabase Cron lưu kết quả từng lần chạy trong `cron.job_run_details`, có thể theo dõi trong Dashboard Cron hoặc truy vấn trực tiếp. Supabase mô tả Cron là bộ lập lịch Postgres dựa trên `pg_cron` và lưu chi tiết trạng thái các lần chạy trong bảng này ([tài liệu Cron](https://supabase.com/docs/guides/cron)).

Admin có thể hủy hoặc đổi giờ một buổi SCHEDULED trong tương lai. Thao tác riêng của buổi được đánh dấu để job lịch không ghi đè. Các buổi, điểm danh, điểm, nhận xét và phân công lịch sử được giữ nguyên.

Các lớp khác nhau có thể xếp buổi trùng giờ nếu dùng phòng khác nhau; giáo viên cũng có thể được phân công cho cả hai buổi. Cùng lớp hoặc có học sinh chung vẫn là xung đột. Nếu giờ giao nhau mà một buổi chưa có phòng, thao tác bị chặn với thông báo cần nhập phòng. So sánh tên phòng không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối.

## Chấm công theo buổi

Giáo viên được phân công gửi một yêu cầu chấm công sau khi buổi COMPLETED. Admin duyệt hoặc từ chối yêu cầu; từ chối yêu cầu lý do, và giáo viên có thể gửi lại sau khi bị từ chối. Đây là theo dõi yêu cầu theo buổi, không ghi giờ vào/ra và không khôi phục payroll, lương hay kế toán.

## Quyền và dữ liệu lưu trữ

RLS giới hạn Admin vào dữ liệu trung tâm, giáo viên vào lớp/buổi được phân công và học sinh vào hồ sơ, lịch, kết quả và video của chính mình. Học sinh chỉ đọc kết quả của buổi đã hoàn thành. Edge Function AI kiểm tra hồ sơ học sinh đang hoạt động và xác minh buổi được chọn thuộc học sinh đó. Các cột phí trong lớp/buổi và bản ghi ClassMonth, học phí, payroll, kế toán, thông báo, nhóm quyền và audit cũ vẫn được giữ trong database nhưng bị thu hồi quyền app. Màn hình audit cũng đã gỡ; audit kỹ thuật vẫn ghi cập nhật hồ sơ, xếp lớp, lịch, chấm công theo buổi và kết quả học tập.

Các Edge Function legacy của lớp tháng, payroll, học phí, kế toán, export, phân quyền nhóm và điều chỉnh buổi cũ đã gỡ khỏi source. Luồng chấm công hiện dùng `timesheet-submit` và `timesheet-review`; endpoint `timesheet-submit` không còn nằm trong danh sách function cần xóa. Chấm công không tạo payroll hoặc giao dịch tài chính.

## Cấu hình và chạy

Frontend chỉ đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` và `VITE_APP_BASE_PATH`. Secret key, database password, access token và bootstrap secret chỉ đặt trong Supabase/GitHub Secrets.

```bash
npm install
npm run dev
npm run typecheck
npm run test:run
npm run build
```

Các lệnh Supabase local:

```bash
supabase start
supabase db reset
supabase functions serve
```

QA gần nhất ghi nhận DNS của backend chưa phân giải được tại thời điểm kiểm tra cũ; trạng thái này không đại diện cho kết nối hiện tại. Trước thao tác production, kiểm tra project đích, migration history và lỗi backend trực tiếp. Không reset hoặc xóa dữ liệu học tập.
