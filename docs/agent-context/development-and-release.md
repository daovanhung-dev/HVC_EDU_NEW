# Phát triển, kiểm tra và phát hành

## Toolchain và lệnh

Yêu cầu Node.js 22.x, npm 10+; frontend là npm workspace `frontend/`. Scripts root chuyển tiếp tới workspace.

```bash
npm install
npm run dev
npm run typecheck
npm run test:run
npm run build
npm run ui:review
```

`build` chạy `vue-tsc --noEmit` trước Vite. Vitest dùng jsdom; test đặt cạnh source với hậu tố `.test.ts`. `ui:review` mở các Vue page thật với auth/service mocks và fixture `QA-`; harness không tạo Supabase client và không gọi dịch vụ thật.

Với mọi tác vụ coding, test hoặc sửa lỗi, luôn dùng Chrome để mở/chạy ứng dụng; tái hiện lỗi và kiểm tra kết quả trong Chrome theo `AGENTS.md`. Dùng UI review harness khi cần xem trạng thái frontend mà không đụng dữ liệu thật. Phân biệt rõ kiểm tra source, local browser, staging, production và thiết bị thật.

## Supabase local

```bash
supabase start
supabase db reset
supabase functions serve
```

Chỉ chạy `db reset` trên môi trường local có thể bỏ dữ liệu. Kiểm thử database cần Supabase/Postgres local cô lập và fixture tổng hợp; không chạy reset/seed để kiểm chứng production. Bootstrap ROOT dùng `bash scripts/bootstrap-root.sh`, cần Supabase CLI/Python/curl phù hợp và nhập secret tương tác.

## Supabase CLI project

Project Supabase mặc định của dự án là `dtftytlyaqmxjgynicqs`. Khi cần liên kết Supabase CLI với remote project, dùng:

```bash
supabase link --project-ref dtftytlyaqmxjgynicqs
```

Trước lệnh CLI tác động remote, xác minh project đang link đúng ref này.

## Biến môi trường và secret

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_BASE_PATH`. `frontend/.env.example` là mẫu.
- Workflow Supabase: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` qua GitHub Secrets.
- Edge Function bootstrap: `CUSTOM_BOOTSTRAP_SECRET`; các API key bên ngoài chỉ ở môi trường server.
- Không đưa secret key/database password/access token/API key vào biến `VITE_`, source, log, context hoặc output. Publishable key là public; RLS/database là lớp bảo vệ.

## CI và deploy

- `.github/workflows/quality-check.yml`: Node 22, `npm ci`, typecheck, test, build và quét một số mẫu secret.
- `.github/workflows/deploy-pages.yml`: kiểm tra public config, build frontend và deploy artifact `frontend/dist` lên GitHub Pages.
- `.github/workflows/deploy-supabase.yml`: chỉ `workflow_dispatch`; link project, `db push`, deploy functions và xóa endpoint legacy được liệt kê trong workflow. Trước khi sửa bước xóa, xác minh chính xác endpoint đang dùng.
- Người dùng đã ủy quyền agent thao tác và thực thi lệnh trên production trong phạm vi công việc của dự án; không cần xin phép lại chỉ vì thao tác chạy trên production. Trước khi thao tác, xác minh project đích, migration, backup/recovery và workflow trực tiếp. Workflow tồn tại tự nó không xác định phạm vi cần làm.

## Vòng đời Edge Function

- Khi tạo Edge Function mới, hoàn tất công việc phải bao gồm deploy function lên Supabase project đích đã xác minh và smoke test endpoint; source, test local hoặc deploy frontend không thay cho deploy function.
- Deploy đúng function mới/thay đổi, xác minh trạng thái `ACTIVE` và cấu hình xác thực JWT. Chỉ tắt JWT cho endpoint công khai được thiết kế rõ như login/bootstrap.
- Nếu không thể deploy hoặc smoke test vì project, quyền, mạng hay secret cấu hình, báo rõ function và tính năng chưa hoàn tất; không ghi giá trị secret vào log hoặc context.

## Context inventory

Sau khi thêm/xóa/đổi vị trí file, cập nhật danh mục và kiểm tra lại:

```bash
npm run agent:context:update
npm run agent:context:check
```

Script lấy file Git theo dõi và file chưa bị ignore; ignored build/cache không thuộc danh mục. Inventory ghi mục đích file, không phải nội dung source. Nội dung `docs/accounts/` và `docs/data_seed/` luôn bị bảo vệ.

## Trạng thái môi trường từ xa và báo cáo kết quả

Không lưu migration production, backup, DNS, deploy, credential hay phiên đăng nhập hiện tại vào context. Roadmap/log/QA report là snapshot có thời điểm, không phải bằng chứng trực tiếp hôm nay.

Trước thao tác vận hành, xác minh project đích, migration đã áp, backup/recovery và workflow trực tiếp. Báo cáo lệnh, môi trường, kết quả và giới hạn; không dùng production như nơi thử. Giữ giờ nghiệp vụ theo `Asia/Ho_Chi_Minh`.
