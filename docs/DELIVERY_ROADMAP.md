# HVC_EDU Delivery Roadmap

Các mốc dưới đây là gate triển khai, không phải phần trăm code tuyệt đối.

| Mốc | Gate | Trạng thái |
|---|---|---|
| M0 | Vue shell, router, Pinia, Bootstrap, CI, base path | Hoàn thành |
| M1 | Schema, enums, RBAC seed, helper functions, RLS | Hoàn thành |
| M1.1 | Auth identifier, bootstrap script, account create/reset | Hoàn thành; cần đặt `CUSTOM_BOOTSTRAP_SECRET` |
| M2 | Student/staff/class master data UI | Hoàn thành bản vận hành |
| M3 | ClassMonth draft/copy/activate, schedule, tuition snapshot | Hoàn thành bản vận hành |
| M4 | Session, attendance, homework, comments, replacement | Hoàn thành bản vận hành |
| M5 | Timesheet, approval, payroll calculate/confirm/pay | Hoàn thành bản vận hành |
| M6 | Tuition confirmation, ledger, manual/adjustment accounting | Hoàn thành bản vận hành |
| M7 | Dashboard dữ liệu thật, notifications, audit viewer, Excel/PDF | Hoàn thành bản vận hành |
| M8 | Unit/RLS/E2E/UAT, security review | Frontend/backend checks pass; UAT cần ROOT |
| M9 | GitHub Pages production, secrets, root bootstrap, release V1 | Sẵn sàng; chờ repo/Variables/bootstrap |

## Quy tắc chuyển gate

Mỗi gate chỉ được đánh dấu hoàn thành khi có:

1. Migration/function đã deploy hoặc UI đã nối dữ liệu thật.
2. Typecheck, unit test và build pass.
3. Có negative test cho quyền truy cập.
4. Không có secret trong source/build/log.
5. Có smoke test cho role bị ảnh hưởng.
