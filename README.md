# Hùng Cường Management / HVC_EDU

Ứng dụng quản lý trung tâm luyện thi Hùng Cường, triển khai theo kiến trúc Vue SPA trên GitHub Pages và Supabase.

## Chạy frontend

Yêu cầu Node.js 22 và npm 10+.

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
export VITE_APP_BASE_PATH="/hung-cuong-management/"
npm install
npm run dev
```

Các biến trên có thể được export trong shell local; không commit file `.env` chứa giá trị thật.

## Kiểm tra

```bash
npm run typecheck
npm run test:run
npm run build
```

## Supabase

```bash
supabase start
supabase db reset
supabase functions serve
```

Bootstrap ROOT interactively without writing credentials to disk:

```bash
bash scripts/bootstrap-root.sh
```

Trước khi chạy script, đặt `CUSTOM_BOOTSTRAP_SECRET` trong Supabase Edge Function Secrets. Giá trị này không nằm trong repository.

Deploy production cần cấu hình `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` và `SUPABASE_DB_PASSWORD` trong secret manager. Không đưa secret key hoặc database password vào frontend.

## Deploy GitHub Pages

Tạo public repository tên `hung-cuong-management`, push branch `main`, sau đó vào `Settings → Pages` chọn `GitHub Actions`. Workflow `Deploy Frontend` sẽ tự chạy sau mỗi lần push.

Tạo GitHub Actions Variables (không phải Secrets):

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_BASE_PATH=/hung-cuong-management/
```

Nếu muốn chạy workflow migration/function thủ công từ tab Actions, tạo thêm Actions Secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
```

Sau khi Pages deploy xong, đặt Supabase Auth `Site URL` và `Redirect URLs` thành:

```text
https://YOUR_GITHUB_OWNER.github.io/hung-cuong-management/
https://YOUR_GITHUB_OWNER.github.io/hung-cuong-management/**
```

Không đặt `SUPABASE_SECRET_KEYS`, database password hoặc `CUSTOM_BOOTSTRAP_SECRET` vào Variables hay source frontend. Đặt chúng ở Supabase/GitHub Secrets theo đúng workflow.

## Tài liệu

- `docs/Hung_Cuong_Business_Design_v1.0.md`
- `docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md`
- `docs/IMPLEMENTATION.md`
# HVC_EDU_NEW
