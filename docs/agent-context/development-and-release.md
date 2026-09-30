# Phát triển, kiểm tra và phát hành

## Môi trường local

Yêu cầu Node.js 22.x, npm 10 trở lên. Frontend là npm workspace tại frontend/.

- npm install
- npm run dev
- npm run typecheck
- npm run test:run
- npm run build

Các script root chuyển tiếp đến frontend; build chạy vue-tsc trước Vite. Vitest dùng jsdom, test đặt cạnh source với hậu tố .test.ts.

Supabase local:

- supabase start
- supabase db reset
- supabase functions serve

Bootstrap ROOT dùng bash scripts/bootstrap-root.sh; cần Supabase CLI, Python 3, curl và phiên CLI phù hợp. Không truyền credential qua command argument hoặc ghi vào repo.

## Biến môi trường

Frontend: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_BASE_PATH. frontend/.env.example chỉ là mẫu.

Workflow Supabase dùng SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF và SUPABASE_DB_PASSWORD qua GitHub Secrets. Bootstrap dùng CUSTOM_BOOTSTRAP_SECRET phía Supabase. Không đặt secret vào biến VITE_ vì Vite đưa chúng vào bundle công khai.

## CI và workflow

- .github/workflows/quality-check.yml chạy Node 22, npm ci, typecheck, test:run, build và quét một số mẫu secret.
- .github/workflows/deploy-pages.yml build frontend, kiểm tra cấu hình public, rồi deploy GitHub Pages.
- .github/workflows/deploy-supabase.yml chỉ chạy thủ công (workflow_dispatch), link project, push migration, deploy functions và dọn danh sách function legacy đã khai báo. Không sửa danh sách function xóa nếu chưa xác minh endpoint đang dùng.
- Workflow có sẵn không đồng nghĩa người dùng đã yêu cầu deploy.

## Phát hành và trạng thái từ xa

Không lưu trạng thái production, migration đã áp dụng, backup, DNS hoặc credential hiện thời trong context. Báo cáo QA và roadmap là snapshot có ngày, không phải nguồn trạng thái trực tiếp.

Khi có yêu cầu vận hành rõ ràng, trước thao tác phải xác minh target từ CLI/config/dịch vụ trực tiếp; kiểm tra migration hiện có, kết nối, backup và quy trình workflow; chỉ tiếp tục trong đúng phạm vi được yêu cầu. Không reset, seed, tạo tài khoản, ghi/xóa dữ liệu, áp migration hoặc deploy production như một phép thử.

## Chọn xác minh theo phạm vi

Khi người dùng yêu cầu test/xác minh hoặc task yêu cầu bằng chứng, dùng các script frontend hiện có cho thay đổi frontend. Với migration/Edge Function, dùng Supabase local/Deno/Postgres cô lập sẵn có và fixture tổng hợp QA-. Không dùng docs/accounts/ hoặc docs/data_seed/. Báo cáo rõ lệnh, môi trường và giới hạn; kết quả QA lịch sử không chứng minh hiện trạng.
