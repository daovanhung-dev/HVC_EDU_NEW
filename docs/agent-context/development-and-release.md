# Phát triển, kiểm tra và phát hành

## Môi trường phát triển

Dự án yêu cầu Node.js 22.x và npm 10 trở lên. Repo dùng npm workspaces; frontend nằm ở frontend/.

- npm install
- npm run dev
- npm run typecheck
- npm run test:run
- npm run build

Các script root chuyển tiếp sang frontend. Build frontend chạy vue-tsc trước Vite. Test hiện dùng Vitest trong jsdom; test nằm cạnh source với hậu tố .test.ts.

Supabase local:

- supabase start
- supabase db reset
- supabase functions serve

Bootstrap ROOT tương tác qua bash scripts/bootstrap-root.sh. Script cần Supabase CLI, Python 3, curl và phiên CLI có quyền trên project; không truyền credential qua tham số command hoặc ghi vào repo.

## Biến môi trường

Frontend:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_APP_BASE_PATH

Tạo giá trị từ môi trường phù hợp. frontend/.env.example là mẫu; không commit file .env hoặc giá trị production.

Workflow Supabase dùng secrets SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF và SUPABASE_DB_PASSWORD. Bootstrap dùng CUSTOM_BOOTSTRAP_SECRET phía Supabase. Không đặt những secret này trong biến VITE_ vì Vite đưa biến đó vào bundle công khai.

## CI và deploy

- Quality Check chạy khi pull request và khi push lên main. CI cài Node 22, chạy npm ci, typecheck, test:run và build; có bước quét một số mẫu secret.
- Deploy Frontend build static app, kiểm tra URL/key công khai, đóng gói frontend/dist và deploy GitHub Pages.
- Deploy Supabase là workflow_dispatch. Workflow link project, chạy supabase db push, deploy Edge Functions, xóa tên các function legacy được liệt kê trong workflow rồi deploy các function cần bỏ qua xác minh JWT.
- Việc workflow có sẵn không đồng nghĩa người dùng đã yêu cầu deploy. Chỉ chạy thao tác production theo yêu cầu hiện tại, sau khi xác minh target, trạng thái migration, kết nối và backup.

## Trạng thái đã ghi nhận (ảnh chụp, không phải trạng thái trực tiếp)

- docs/DELIVERY_ROADMAP.md ghi migration 0039 chưa áp dụng production và còn các gate QA dữ liệu/RLS/scheduler, backup và backend.
- docs/QA_TEST_REPORT_2026-09-28.md ghi lần kiểm tra ngày 2026-09-28: frontend tải được nhưng backend Supabase không phân giải DNS; QA migration/RLS/scheduler và luồng vai trò chưa hoàn tất. Báo cáo cũng ghi kiểm tra frontend từng chạy trên Node 24, trong khi yêu cầu repo và CI là Node 22.
- docs/IMPLEMENTATION.md vẫn yêu cầu không áp migration production cho đến khi kết nối backend hoạt động và backup được xác nhận.

Các thông tin trên chỉ là mốc theo tài liệu tại ngày ghi. Trước khi chẩn đoán hoặc thay đổi production, kiểm tra lại DNS/kết nối, Secrets, migration đã áp dụng, backup và sự cho phép hiện hành. Không coi lỗi DNS trong báo cáo cũ là nguyên nhân hiện tại nếu chưa xác minh.

## Cách xác minh thay đổi

Với thay đổi frontend, dùng các script hiện có khi phạm vi yêu cầu bao gồm kiểm thử: typecheck, test:run và build. Với migration hoặc Edge Function, kiểm tra local Supabase/Deno theo môi trường sẵn có; kiểm thử quyền bằng dữ liệu synthetic QA-.

Không dùng hồ sơ trong docs/accounts/ hoặc workbook trong docs/data_seed/ làm dữ liệu test. Không áp migration production như một phép xác minh. Báo cáo rõ lệnh đã chạy, kết quả và môi trường Node/CLI thực tế.
