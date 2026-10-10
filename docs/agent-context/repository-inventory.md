# Danh mục cấu trúc repository

> Tự sinh từ Git: file được theo dõi và file mới chưa bị ignore. Mục đích được mô tả ngắn theo vai trò trong hệ thống; không chép nội dung source vào inventory.

> Nội dung docs/accounts/ và docs/data_seed/ bị bảo vệ, không được đọc hoặc đưa vào context. Với data_seed chỉ hiển thị metadata đường dẫn. File ignored như node_modules/build/cache không thuộc inventory.

| Đường dẫn | Subsystem | Loại file | Mục đích và cách dùng |
|---|---|---|---|
| .github/workflows/deploy-pages.yml | CI và phát hành | YAML workflow | Build và phát hành SPA tĩnh lên GitHub Pages. |
| .github/workflows/deploy-supabase.yml | CI và phát hành | YAML workflow | Workflow dispatch để áp migration/deploy Edge Functions và dọn endpoint đã retire. |
| .github/workflows/quality-check.yml | CI và phát hành | YAML workflow | CI cho typecheck, test, build frontend và quét một số mẫu secret. |
| .gitignore | Cấu hình ở repo root | Git ignore rules | Quy định file local, credential, cache và artifact không đưa vào Git. |
| AGENTS.md | Chỉ dẫn agent | Markdown | Chỉ dẫn gốc về phạm vi sản phẩm, bảo mật, quy trình sửa và nguồn sự thật. |
| assets/logo.jpg | Tài nguyên tĩnh | Ảnh | Logo/tài nguyên nhận diện tĩnh của trung tâm. |
| deno.lock | Cấu hình ở repo root | Deno lockfile | Khóa phụ thuộc Deno cho Edge Functions và kiểm tra liên quan. |
| design.md | Cấu hình ở repo root | Markdown | Ghi chú thiết kế giao diện/visual direction; kiểm tra với UI và token hiện hành trước khi áp dụng. |
| docs/agent-context/architecture-and-code-map.md | Agent context | Markdown | Kiến trúc, công nghệ, request flow, entrypoint và vị trí logic/test. |
| docs/agent-context/data-security-and-migrations.md | Agent context | Markdown | Mô hình dữ liệu, quy tắc RLS/RPC/Edge Function, lịch sử migration và an toàn dữ liệu. |
| docs/agent-context/development-and-release.md | Agent context | Markdown | Toolchain, lệnh phát triển/kiểm tra, CI và ranh giới vận hành. |
| docs/agent-context/product-and-workflows.md | Agent context | Markdown | Vai trò, luồng nghiệp vụ và quy tắc lớp/lịch/buổi/điểm danh/đánh giá/chấm công. |
| docs/agent-context/README.md | Agent context | Markdown | Điểm vào và bộ định tuyến tới các tài liệu context theo loại nhiệm vụ. |
| docs/agent-context/repository-inventory.md | Agent context | Markdown | Danh mục tự sinh, có subsystem, loại file và mục đích của từng đường dẫn. |
| docs/bug_deploy/logs_100134867151.zip | Tài liệu sản phẩm / lịch sử | ZIP | Gói artifact/log chẩn đoán của lần CI lịch sử; không đại diện trạng thái hiện tại. |
| docs/bug_deploy/logs_100134867151/0_secret-scan.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (job tổng); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/1_frontend.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (job tổng); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/1_Set up job.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/13_Post Run actions_setup-node@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/14_Post Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/15_Complete job.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/2_Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/3_Run actions_setup-node@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/4_Run npm ci.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/5_Run npm run typecheck.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/6_Run npm run testrun.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/7_Run npm run build.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/frontend/system.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (frontend); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/runner-diagnostic-logs/110716738996-frontend.zip | Tài liệu sản phẩm / lịch sử | ZIP | Gói artifact/log chẩn đoán của lần CI lịch sử; không đại diện trạng thái hiện tại. |
| docs/bug_deploy/logs_100134867151/runner-diagnostic-logs/110716739187-secret-scan.zip | Tài liệu sản phẩm / lịch sử | ZIP | Gói artifact/log chẩn đoán của lần CI lịch sử; không đại diện trạng thái hiện tại. |
| docs/bug_deploy/logs_100134867151/secret-scan/1_Set up job.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/secret-scan/2_Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/secret-scan/3_Check for common secret patterns.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/secret-scan/6_Post Run actions_checkout@v4.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/secret-scan/7_Complete job.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/bug_deploy/logs_100134867151/secret-scan/system.txt | Tài liệu sản phẩm / lịch sử | TXT | Log CI lịch sử (secret scan); chỉ dùng để tra sự cố cũ. |
| docs/data_seed/t9/Diem_danh_6.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn | Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung. |
| docs/data_seed/t9/Diem_danh_7.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn | Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung. |
| docs/data_seed/t9/Diem_danh_8.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn | Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung. |
| docs/data_seed/t9/Diem_danh_9.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn | Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung. |
| docs/data_seed/t9/diemdang.xlsm | Dữ liệu nguồn được bảo vệ | Workbook nguồn; chỉ lập chỉ mục đường dẫn | Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung. |
| docs/DELIVERY_ROADMAP.md | Tài liệu sản phẩm / lịch sử | Markdown | Roadmap/snapshot lịch sử; không chứng minh trạng thái hiện tại. |
| docs/Hung_Cuong_Business_Design_v1.0.md | Tài liệu sản phẩm / lịch sử | Markdown | Thiết kế nghiệp vụ phiên bản lịch sử; không ghi đè phạm vi hiện hành. |
| docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md | Tài liệu sản phẩm / lịch sử | Markdown | Thiết kế kiến trúc phiên bản lịch sử; đối chiếu với kiến trúc đang chạy. |
| docs/IMPLEMENTATION.md | Tài liệu sản phẩm / lịch sử | Markdown | Mô tả phạm vi sản phẩm và hành vi hiện hành; đối chiếu với code/migration. |
| docs/plans/HVC_EDU_NEW_LUNA_INSERT_STAFF_SCHEDULE_PLAN.md | Kế hoạch lịch sử theo nhiệm vụ | Markdown | Kế hoạch vận hành lịch sử có dữ liệu định danh/chi tiết nhạy cảm; không dùng làm quy trình hiện tại hoặc sao chép vào context. |
| docs/QA_STAGING_TEST_REPORT_2026-09-29.md | Tài liệu sản phẩm / lịch sử | Markdown | Báo cáo staging lịch sử; không đại diện trạng thái backend hiện tại. |
| docs/QA_STAGING_TEST_REPORT_2026-09-30.md | Tài liệu sản phẩm / lịch sử | Markdown | Báo cáo staging lịch sử; không đại diện trạng thái backend hiện tại. |
| docs/QA_TEST_REPORT_2026-09-28.md | Tài liệu sản phẩm / lịch sử | Markdown | Báo cáo QA lịch sử; chỉ là bằng chứng tại ngày ghi trong tên file. |
| frontend/.env.example | Frontend / cấu hình và public | Mẫu biến môi trường | Tên biến public cần cho frontend; giá trị trong file chỉ là mẫu. |
| frontend/AGENTS.md | Chỉ dẫn agent | Markdown | Quy tắc agent riêng cho UI, nghiệp vụ frontend và dùng service/RLS. |
| frontend/index.html | Frontend / cấu hình và public | HTML | HTML entrypoint cho bản frontend production. |
| frontend/package.json | Frontend / cấu hình và public | JSON/config | Phụ thuộc và scripts frontend Vue/Vite/Vitest. |
| frontend/public/404.html | Frontend / cấu hình và public | HTML | Fallback GitHub Pages để SPA tiếp nhận đường dẫn khi tải lại. |
| frontend/review/index.html | Frontend / cấu hình và public | HTML | HTML entrypoint riêng cho UI review harness. |
| frontend/review/main.ts | Frontend / cấu hình và public | TypeScript | Khởi động các màn hình thật trong UI review harness. |
| frontend/review/README.md | Frontend / cấu hình và public | Markdown | Hướng dẫn mở UI review cô lập với service mocks và fixture QA-. |
| frontend/src/App.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Shell component gốc chứa router view và thành phần toàn app. |
| frontend/src/app/components/AppButton.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Button. |
| frontend/src/app/components/AppErrorBanner.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho App Error Banner trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/app/components/AppErrorBanner.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Error Banner. |
| frontend/src/app/components/AppField.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Field. |
| frontend/src/app/components/AppIcon.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Icon. |
| frontend/src/app/components/AppPageHeader.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Page Header. |
| frontend/src/app/components/AppState.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App State. |
| frontend/src/app/components/AppToastHost.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: App Toast Host. |
| frontend/src/app/components/BaseModal.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho Base Modal trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/app/components/BaseModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: Base Modal. |
| frontend/src/app/components/ConfirmModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: Confirm Modal. |
| frontend/src/app/components/DetailModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: Detail Modal. |
| frontend/src/app/components/FormModal.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: Form Modal. |
| frontend/src/app/components/SessionMonthCalendar.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho Session Month Calendar trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/app/components/SessionMonthCalendar.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: Session Month Calendar. |
| frontend/src/app/components/YouTubePlayer.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Component UI dùng chung: You Tube Player. |
| frontend/src/app/layouts/AppLayout.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho App Layout trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/app/layouts/AppLayout.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Layout ứng dụng: App Layout. |
| frontend/src/app/layouts/AuthLayout.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Layout ứng dụng: Auth Layout. |
| frontend/src/app/router/index.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho index trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/app/router/index.ts | Frontend / nền tảng và dịch vụ | TypeScript | Khai báo route hash, layout, điều hướng theo role và bắt buộc đổi mật khẩu. |
| frontend/src/devtools/ui-review/mock-auth.store.ts | Frontend / nền tảng và dịch vụ | TypeScript | Mock auth store dùng riêng cho review UI. |
| frontend/src/devtools/ui-review/mock-services.ts | Frontend / nền tảng và dịch vụ | TypeScript | Mock service và fixture synthetic QA- dùng trong review UI. |
| frontend/src/devtools/ui-review/mock-supabase.ts | Frontend / nền tảng và dịch vụ | TypeScript | Mock Supabase client để review UI không kết nối backend. |
| frontend/src/devtools/ui-review/review-state.ts | Frontend / nền tảng và dịch vụ | TypeScript | Điều khiển trạng thái loading/error/empty/slow trong UI review. |
| frontend/src/devtools/ui-review/ReviewApp.vue | Frontend / nền tảng và dịch vụ | Vue SFC | Shell chọn màn hình/trạng thái trong UI review harness. |
| frontend/src/env.d.ts | Frontend / nền tảng và dịch vụ | TypeScript | File TypeScript thuộc Frontend / nền tảng và dịch vụ: env d. |
| frontend/src/main.ts | Frontend / nền tảng và dịch vụ | TypeScript | Bootstrap Vue, Pinia, router, Bootstrap và style gốc. |
| frontend/src/modules/admin/components/bulk-password-reset.types.ts | Frontend / Admin | TypeScript | Kiểu input/kết quả cho luồng reset mật khẩu hàng loạt. |
| frontend/src/modules/admin/components/BulkPasswordResetModal.vue | Frontend / Admin | Vue SFC | Giao diện xác nhận và thu thập lựa chọn reset mật khẩu hàng loạt. |
| frontend/src/modules/admin/components/StudentQuickEnrollmentModal.vue | Frontend / Admin | Vue SFC | Component luồng Admin: Student Quick Enrollment Modal. |
| frontend/src/modules/admin/components/TeacherPicker.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Teacher Picker trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/components/TeacherPicker.vue | Frontend / Admin | Vue SFC | Chọn hoặc chỉnh danh sách teacher được giao cho lịch/buổi. |
| frontend/src/modules/admin/pages/AdminSessionsPage.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Admin Sessions Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/pages/AdminSessionsPage.vue | Frontend / Admin | Vue SFC | Màn hình Admin lập/sửa buổi kể cả buổi đã qua, quản lý roster, attendance/đánh giá, hủy/xóa buổi tương lai và mẫu lịch theo tháng. |
| frontend/src/modules/admin/pages/AdminTimesheetsPage.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Admin Timesheets Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/pages/AdminTimesheetsPage.vue | Frontend / Admin | Vue SFC | Màn hình Admin duyệt hoặc từ chối yêu cầu chấm công theo buổi. |
| frontend/src/modules/admin/pages/ClassDetailPage.vue | Frontend / Admin | Vue SFC | Chi tiết lớp, membership, lịch lặp và giáo viên theo lịch. |
| frontend/src/modules/admin/pages/ClassesPage.vue | Frontend / Admin | Vue SFC | Danh sách/quản lý lớp và cấu hình chính sách sĩ số. |
| frontend/src/modules/admin/pages/StaffPage.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Staff Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/pages/StaffPage.vue | Frontend / Admin | Vue SFC | Quản lý hồ sơ và tài khoản giáo viên từ giao diện Admin. |
| frontend/src/modules/admin/pages/StudentDetailPage.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Student Detail Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/pages/StudentDetailPage.vue | Frontend / Admin | Vue SFC | Hồ sơ Admin của học sinh, lịch sử học và quan hệ lớp. |
| frontend/src/modules/admin/pages/StudentsPage.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho Students Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/pages/StudentsPage.vue | Frontend / Admin | Vue SFC | Danh sách/quản lý học sinh và trạng thái tài khoản. |
| frontend/src/modules/admin/utils/month-week-schedule-import.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho month week schedule import trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/utils/month-week-schedule-import.ts | Frontend / Admin | TypeScript | Tiện ích nghiệp vụ Admin: month week schedule import. |
| frontend/src/modules/admin/utils/student-account-export.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho student account export trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/utils/student-account-export.ts | Frontend / Admin | TypeScript | Định dạng dữ liệu export tài khoản học sinh; rà quyền và dữ liệu nhạy cảm trước khi thay đổi. |
| frontend/src/modules/admin/utils/student-class-roster-export.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho student class roster export trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/utils/student-class-roster-export.ts | Frontend / Admin | TypeScript | Định dạng roster lớp cho luồng export hiện có. |
| frontend/src/modules/admin/utils/student-intake.test.ts | Frontend / Admin | TypeScript | Test hồi quy cho student intake trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/admin/utils/student-intake.ts | Frontend / Admin | TypeScript | Tiện ích nghiệp vụ Admin: student intake. |
| frontend/src/modules/auth/pages/ChangePasswordPage.test.ts | Frontend / Đăng nhập | TypeScript | Test hồi quy cho Change Password Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/auth/pages/ChangePasswordPage.vue | Frontend / Đăng nhập | Vue SFC | Form hoàn tất đổi mật khẩu bắt buộc. |
| frontend/src/modules/auth/pages/LoginPage.test.ts | Frontend / Đăng nhập | TypeScript | Test hồi quy cho Login Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/auth/pages/LoginPage.vue | Frontend / Đăng nhập | Vue SFC | Form đăng nhập bằng định danh tài khoản. |
| frontend/src/modules/staff/attendance.test.ts | Frontend / Giáo viên | TypeScript | Test hồi quy cho attendance trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/staff/attendance.ts | Frontend / Giáo viên | TypeScript | Chuẩn hóa, validate và chuyển attendance thành payload lưu. |
| frontend/src/modules/staff/components/StaffAttendanceModal.vue | Frontend / Giáo viên | Vue SFC | Form giáo viên sửa điểm danh, điểm và nhận xét theo học sinh. |
| frontend/src/modules/staff/pages/SessionsPage.test.ts | Frontend / Giáo viên | TypeScript | Test hồi quy cho Sessions Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/staff/pages/SessionsPage.vue | Frontend / Giáo viên | Vue SFC | Màn hình giáo viên xem buổi được giao, cập nhật nội dung/đánh giá và hoàn tất buổi. |
| frontend/src/modules/staff/pages/StaffProfilePage.vue | Frontend / Giáo viên | Vue SFC | Màn hình giáo viên xem/sửa thông tin liên hệ cá nhân. |
| frontend/src/modules/staff/pages/StaffTimesheetsPage.test.ts | Frontend / Giáo viên | TypeScript | Test hồi quy cho Staff Timesheets Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/staff/pages/StaffTimesheetsPage.vue | Frontend / Giáo viên | Vue SFC | Màn hình giáo viên gửi/xem yêu cầu chấm công theo buổi. |
| frontend/src/modules/student/pages/StudentAiChatPage.test.ts | Frontend / Học sinh | TypeScript | Test hồi quy cho Student Ai Chat Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/student/pages/StudentAiChatPage.vue | Frontend / Học sinh | Vue SFC | Chat AI tiếng Việt, tùy chọn ngữ cảnh bài học của học sinh. |
| frontend/src/modules/student/pages/StudentPage.test.ts | Frontend / Học sinh | TypeScript | Test hồi quy cho Student Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/student/pages/StudentPage.vue | Frontend / Học sinh | Vue SFC | Lịch học và kết quả học tập của chính học sinh đang đăng nhập. |
| frontend/src/modules/student/pages/StudentReviewPage.test.ts | Frontend / Học sinh | TypeScript | Test hồi quy cho Student Review Page trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/modules/student/pages/StudentReviewPage.vue | Frontend / Học sinh | Vue SFC | Danh sách video buổi đã hoàn thành mà học sinh được phép xem lại. |
| frontend/src/services/commands.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho commands trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/services/commands.ts | Frontend / nền tảng và dịch vụ | TypeScript | Adapter lệnh ghi: CRUD RLS-safe, RPC và Edge Function. |
| frontend/src/services/data-queries.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho data queries trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/services/data-queries.ts | Frontend / nền tảng và dịch vụ | TypeScript | Adapter truy vấn/đọc dữ liệu Supabase cho các màn hình. |
| frontend/src/services/edge-functions.ts | Frontend / nền tảng và dịch vụ | TypeScript | Chuẩn hóa gọi Edge Function, lỗi, mã lỗi và trace id. |
| frontend/src/services/supabase.ts | Frontend / nền tảng và dịch vụ | TypeScript | Tạo Supabase client từ biến môi trường public. |
| frontend/src/shared/constants/roles.ts | Frontend / nền tảng và dịch vụ | TypeScript | Danh sách role hoạt động, role retire và nhãn hiển thị. |
| frontend/src/shared/types/domain.ts | Frontend / nền tảng và dịch vụ | TypeScript | Kiểu dữ liệu frontend cho profile, lớp, buổi, attendance và timesheet. |
| frontend/src/shared/utils/class-teacher-limit.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho class teacher limit trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/shared/utils/class-teacher-limit.ts | Frontend / nền tảng và dịch vụ | TypeScript | Tính/kiểm tra giới hạn teacher duy nhất trên lớp ở phía client. |
| frontend/src/shared/utils/errors.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho errors trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/shared/utils/errors.ts | Frontend / nền tảng và dịch vụ | TypeScript | Chuyển lỗi Supabase/RPC thành thông báo thân thiện cho UI. |
| frontend/src/shared/utils/format.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho format trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/shared/utils/format.ts | Frontend / nền tảng và dịch vụ | TypeScript | Định dạng ngày giờ và giá trị hiển thị theo locale ứng dụng. |
| frontend/src/shared/utils/session-calendar.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho session calendar trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/shared/utils/session-calendar.ts | Frontend / nền tảng và dịch vụ | TypeScript | Tính cấu trúc lịch tháng cho các buổi học. |
| frontend/src/shared/utils/youtube.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho youtube trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/shared/utils/youtube.ts | Frontend / nền tảng và dịch vụ | TypeScript | Kiểm tra và chuẩn hóa URL YouTube của bài học. |
| frontend/src/stores/app-error.store.ts | Frontend / nền tảng và dịch vụ | TypeScript | Lưu/trình bày lỗi cấp ứng dụng. |
| frontend/src/stores/auth.store.test.ts | Frontend / nền tảng và dịch vụ | TypeScript | Test hồi quy cho auth store trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác. |
| frontend/src/stores/auth.store.ts | Frontend / nền tảng và dịch vụ | TypeScript | Khởi tạo phiên Supabase, hồ sơ/role và trạng thái xác thực. |
| frontend/src/stores/toast.store.ts | Frontend / nền tảng và dịch vụ | TypeScript | Điều phối thông báo toast ngắn hạn. |
| frontend/src/styles.css | Frontend / nền tảng và dịch vụ | CSS | Token màu/kiểu chữ và style toàn ứng dụng. |
| frontend/tsconfig.app.json | Frontend / cấu hình và public | JSON/config | Cấu hình TypeScript cho mã ứng dụng Vue. |
| frontend/tsconfig.json | Frontend / cấu hình và public | JSON/config | Cấu hình gốc TypeScript cho workspace frontend. |
| frontend/tsconfig.node.json | Frontend / cấu hình và public | JSON/config | Cấu hình TypeScript cho file công cụ/config chạy trên Node. |
| frontend/vite.config.ts | Frontend / cấu hình và public | TypeScript | Cấu hình Vite production/dev, alias, base path và build frontend. |
| frontend/vite.review.config.ts | Frontend / cấu hình và public | TypeScript | Cấu hình server UI review với mock service/auth, không gọi Supabase thật. |
| package-lock.json | Cấu hình ở repo root | npm lockfile | Khóa cây phụ thuộc npm của workspace. |
| package.json | Cấu hình ở repo root | JSON/config | Workspace root và các lệnh dev/build/check/test/context. |
| README.md | Cấu hình ở repo root | Markdown | Giới thiệu sản phẩm hiện hành, lệnh local, cấu hình public và phát hành. |
| scripts/agent-context-inventory.mjs | Công cụ dự án | MJS | Sinh và kiểm tra danh mục Git cùng mô tả mục đích file. |
| scripts/bootstrap-root.sh | Công cụ dự án | Shell | Bootstrap ROOT tương tác, tránh ghi credential vào repository. |
| supabase/AGENTS.md | Chỉ dẫn agent | Markdown | Quy tắc agent riêng cho migration, RLS, RPC, Edge Function và dữ liệu thật. |
| supabase/config.toml | Supabase / cấu hình và seed | TOML/config | Cấu hình Supabase local, Auth và Edge Functions. |
| supabase/functions/_shared/auth.ts | Supabase / Edge Functions | TypeScript | Helper Edge Function: xác thực caller và kiểm tra hồ sơ/quyền dùng chung. |
| supabase/functions/_shared/cors.ts | Supabase / Edge Functions | TypeScript | Helper Edge Function: xử lý CORS và preflight dùng chung. |
| supabase/functions/_shared/password-reset.ts | Supabase / Edge Functions | TypeScript | Helper Edge Function: tiện ích chung cho reset mật khẩu. |
| supabase/functions/_shared/response.ts | Supabase / Edge Functions | TypeScript | Helper Edge Function: chuẩn hóa response thành công/lỗi và trace id. |
| supabase/functions/admin-account-status/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: đổi trạng thái tài khoản theo quyền Admin. |
| supabase/functions/admin-create-user/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: tạo tài khoản và hồ sơ theo role được phép. |
| supabase/functions/admin-create-user/student-intake-handler.test.ts | Supabase / Edge Functions | TypeScript | Test hồi quy cho student intake handler. |
| supabase/functions/admin-create-user/student-intake-handler.ts | Supabase / Edge Functions | TypeScript | File TypeScript thuộc Supabase / Edge Functions: student intake handler. |
| supabase/functions/admin-export-student-logins/config.toml | Supabase / Edge Functions | TOML/config | Cấu hình JWT/deploy riêng cho route admin-export-student-logins. |
| supabase/functions/admin-export-student-logins/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route admin-export-student-logins với phụ thuộc giả lập. |
| supabase/functions/admin-export-student-logins/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: tạo export thông tin đăng nhập học sinh; xử lý dữ liệu nhạy cảm. |
| supabase/functions/admin-export-student-logins/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: tạo export thông tin đăng nhập học sinh; xử lý dữ liệu nhạy cảm. |
| supabase/functions/admin-reset-password-bulk/config.toml | Supabase / Edge Functions | TOML/config | Cấu hình JWT/deploy riêng cho route admin-reset-password-bulk. |
| supabase/functions/admin-reset-password-bulk/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route admin-reset-password-bulk với phụ thuộc giả lập. |
| supabase/functions/admin-reset-password-bulk/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: reset mật khẩu theo lô và ghi kết quả/audit. |
| supabase/functions/admin-reset-password-bulk/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: reset mật khẩu theo lô và ghi kết quả/audit. |
| supabase/functions/admin-reset-password/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route admin-reset-password với phụ thuộc giả lập. |
| supabase/functions/admin-reset-password/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: reset mật khẩu một tài khoản theo quyền Admin. |
| supabase/functions/admin-reset-password/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: reset mật khẩu một tài khoản theo quyền Admin. |
| supabase/functions/bootstrap-root/config.toml | Supabase / Edge Functions | TOML/config | Cấu hình JWT/deploy riêng cho route bootstrap-root. |
| supabase/functions/bootstrap-root/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: bootstrap tài khoản ROOT trong luồng được bảo vệ. |
| supabase/functions/login-by-identifier/config.toml | Supabase / Edge Functions | TOML/config | Cấu hình JWT/deploy riêng cho route login-by-identifier. |
| supabase/functions/login-by-identifier/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: đăng nhập bằng username/định danh qua server. |
| supabase/functions/session-complete/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: xác nhận hoàn tất buổi qua RPC có kiểm tra server. |
| supabase/functions/session-learning-update/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: lưu điểm danh/kết quả/nội dung buổi qua RPC. |
| supabase/functions/session-learning-update/youtube.test.ts | Supabase / Edge Functions | TypeScript | Test hồi quy cho youtube. |
| supabase/functions/session-learning-update/youtube.ts | Supabase / Edge Functions | TypeScript | File TypeScript thuộc Supabase / Edge Functions: youtube. |
| supabase/functions/session-start/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: bắt đầu buổi học qua RPC có kiểm tra phân công. |
| supabase/functions/student-ai-tutor/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route student-ai-tutor với phụ thuộc giả lập. |
| supabase/functions/student-ai-tutor/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: AI học tập cho học sinh, kiểm tra quyền và giới hạn ngữ cảnh gửi đi. |
| supabase/functions/student-ai-tutor/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: AI học tập cho học sinh, kiểm tra quyền và giới hạn ngữ cảnh gửi đi. |
| supabase/functions/student-required-password-change/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route student-required-password-change với phụ thuộc giả lập. |
| supabase/functions/student-required-password-change/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: hoàn tất đổi mật khẩu bắt buộc cho học sinh. |
| supabase/functions/student-required-password-change/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: hoàn tất đổi mật khẩu bắt buộc cho học sinh. |
| supabase/functions/teacher-comment-optimize/handler.test.ts | Supabase / Edge Functions | TypeScript | Kiểm thử handler của route teacher-comment-optimize với phụ thuộc giả lập. |
| supabase/functions/teacher-comment-optimize/handler.ts | Supabase / Edge Functions | TypeScript | Logic có thể kiểm thử tách biệt cho route: gợi ý viết lại nhận xét giáo viên qua Gemini. |
| supabase/functions/teacher-comment-optimize/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: gợi ý viết lại nhận xét giáo viên qua Gemini. |
| supabase/functions/timesheet-review/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: Admin duyệt/từ chối yêu cầu chấm công qua server. |
| supabase/functions/timesheet-submit/index.ts | Supabase / Edge Functions | TypeScript | HTTP entrypoint cho route: giáo viên gửi yêu cầu chấm công cho buổi đã hoàn tất. |
| supabase/migrations/0001_extensions.sql | Supabase / migrations | SQL | Bật các PostgreSQL extension nền tảng được schema sử dụng. |
| supabase/migrations/0002_enums.sql | Supabase / migrations | SQL | Khai báo enum trạng thái, vai trò và chính sách nghiệp vụ ban đầu. |
| supabase/migrations/0003_auth_profiles.sql | Supabase / migrations | SQL | Nối danh tính Supabase Auth với hồ sơ và trạng thái người dùng. |
| supabase/migrations/0004_rbac.sql | Supabase / migrations | SQL | Tạo quyền và các hàm kiểm tra quyền phiên bản đầu. |
| supabase/migrations/0005_students_staff.sql | Supabase / migrations | SQL | Tạo hồ sơ học sinh, nhân sự và quan hệ với tài khoản. |
| supabase/migrations/0006_academic_master.sql | Supabase / migrations | SQL | Tạo môn, khối, lớp và chính sách sĩ số. |
| supabase/migrations/0007_class_month.sql | Supabase / migrations | SQL | Tạo mô hình ClassMonth lịch sử và lịch theo tháng. |
| supabase/migrations/0008_sessions.sql | Supabase / migrations | SQL | Tạo buổi học và các quan hệ lớp/buổi phiên bản đầu. |
| supabase/migrations/0009_attendance.sql | Supabase / migrations | SQL | Tạo điểm danh theo buổi, phút đi muộn, lý do vắng và điểm BTVN 0–10. |
| supabase/migrations/0010_timesheets.sql | Supabase / migrations | SQL | Tạo mô hình chấm công lịch sử ban đầu. |
| supabase/migrations/0011_tuition.sql | Supabase / migrations | SQL | Tạo các bảng học phí lịch sử; không đồng nghĩa app hiện hành đang vận hành học phí. |
| supabase/migrations/0012_payroll.sql | Supabase / migrations | SQL | Tạo các bảng payroll lịch sử; không đồng nghĩa app hiện hành đang tính lương. |
| supabase/migrations/0013_accounting.sql | Supabase / migrations | SQL | Tạo các bảng kế toán lịch sử; không đồng nghĩa app hiện hành đang vận hành kế toán. |
| supabase/migrations/0014_notifications.sql | Supabase / migrations | SQL | Tạo cấu trúc thông báo lịch sử. |
| supabase/migrations/0015_audit.sql | Supabase / migrations | SQL | Tạo nhật ký audit và cấu trúc ghi nhận thay đổi. |
| supabase/migrations/0016_functions.sql | Supabase / migrations | SQL | Tạo các hàm nghiệp vụ PostgreSQL ban đầu. |
| supabase/migrations/0017_rls.sql | Supabase / migrations | SQL | Bật và định nghĩa các chính sách RLS ban đầu. |
| supabase/migrations/0018_indexes.sql | Supabase / migrations | SQL | Bổ sung index cho các truy vấn và quan hệ schema ban đầu. |
| supabase/migrations/0019_seed_master.sql | Supabase / migrations | SQL | Nạp dữ liệu danh mục ban đầu cho môi trường database. |
| supabase/migrations/0020_cleanup_function_warnings.sql | Supabase / migrations | SQL | Điều chỉnh các hàm database để dọn cảnh báo và cấu hình thực thi. |
| supabase/migrations/0021_core_commands.sql | Supabase / migrations | SQL | Thêm các RPC/lệnh database cốt lõi có kiểm tra nghiệp vụ. |
| supabase/migrations/0022_attendance_snapshot_fk.sql | Supabase / migrations | SQL | Bổ sung quan hệ khóa ngoại cho snapshot học tập/điểm danh. |
| supabase/migrations/0023_student_schedule_policy.sql | Supabase / migrations | SQL | Điều chỉnh policy dữ liệu lịch của học sinh. |
| supabase/migrations/0024_completion_commands.sql | Supabase / migrations | SQL | Thêm hoặc siết các lệnh bắt đầu/hoàn tất buổi học. |
| supabase/migrations/0025_business_hardening.sql | Supabase / migrations | SQL | Gia cố ràng buộc và kiểm tra nghiệp vụ trong database. |
| supabase/migrations/0026_admin_permissions.sql | Supabase / migrations | SQL | Điều chỉnh quyền Admin ở database; đọc cùng các migration sau thay đổi RBAC. |
| supabase/migrations/0027_expand_subjects_grades.sql | Supabase / migrations | SQL | Mở rộng danh mục môn/khối học mà vẫn giữ mã danh mục đã có. |
| supabase/migrations/0028_fix_staff_rls_recursion.sql | Supabase / migrations | SQL | Sửa vòng lặp RLS khi xác định quyền đọc hồ sơ nhân sự. |
| supabase/migrations/0029_session_fee_snapshots.sql | Supabase / migrations | SQL | Bổ sung snapshot phí ở buổi học thuộc schema tài chính lịch sử. |
| supabase/migrations/0030_fix_student_rls_recursion.sql | Supabase / migrations | SQL | Sửa vòng lặp RLS khi xác định quyền đọc học sinh. |
| supabase/migrations/0031_schedule_rooms.sql | Supabase / migrations | SQL | Bổ sung phòng vào mô hình lịch/buổi. |
| supabase/migrations/0032_fix_session_rls_recursion.sql | Supabase / migrations | SQL | Sửa vòng lặp RLS giữa buổi học và roster buổi. |
| supabase/migrations/0033_class_month_schedule_staff.sql | Supabase / migrations | SQL | Gắn giáo viên với từng khung lịch tháng trong mô hình cũ. |
| supabase/migrations/0034_attendance_assessment_fields.sql | Supabase / migrations | SQL | Bổ sung trường đánh giá, ghi chú buổi và snapshot nguồn; không định nghĩa điểm tổng. |
| supabase/migrations/0035_seed_t9_attendance.sql | Supabase / migrations | SQL | Migration import snapshot điểm danh lịch sử; không trích hoặc sao chép dữ liệu từng người vào context. |
| supabase/migrations/0036_parent_role.sql | Supabase / migrations | SQL | Thêm vai trò PARENT lịch sử; vai trò này được retire ở migration sau. |
| supabase/migrations/0037_learning_scope.sql | Supabase / migrations | SQL | Điều chỉnh phạm vi đọc/ghi hồ sơ học tập liên tục. |
| supabase/migrations/0038_retire_parent_role.sql | Supabase / migrations | SQL | Thu hồi luồng và quyền dữ liệu của PARENT nhưng giữ liên kết lịch sử. |
| supabase/migrations/0039_continuous_learning.sql | Supabase / migrations | SQL | Chuyển sang membership liên tục, lịch lặp và buổi theo ngày; khóa app khỏi ClassMonth/tài chính cũ. |
| supabase/migrations/0040_fix_continuous_learning_rls_recursion.sql | Supabase / migrations | SQL | Sửa vòng lặp RLS cho mô hình học tập liên tục bằng helper an toàn. |
| supabase/migrations/0041_admin_monthly_session_planning.sql | Supabase / migrations | SQL | Thêm RPC để Admin lập buổi cụ thể và áp mẫu tuần vào tháng. |
| supabase/migrations/0042_restore_session_timesheets.sql | Supabase / migrations | SQL | Mở lại chấm công theo buổi đã hoàn thành, không mở payroll. |
| supabase/migrations/0043_limit_class_teachers.sql | Supabase / migrations | SQL | Giới hạn tối đa năm giáo viên duy nhất đang được phân công cho một lớp. |
| supabase/migrations/0044_allow_parallel_sessions_by_room.sql | Supabase / migrations | SQL | Áp quy tắc xung đột buổi theo lớp, roster và phòng tại từng buổi. |
| supabase/migrations/0045_backdated_attendance_sessions.sql | Supabase / migrations | SQL | Cho Admin lập buổi điểm danh bù trong quá khứ với kiểm tra quyền/xung đột. |
| supabase/migrations/0046_allow_secret_key_session_rpcs.sql | Supabase / migrations | SQL | Cho Edge Function gọi RPC buổi học bằng service role; RPC vẫn xác minh người thực hiện. |
| supabase/migrations/0047_lesson_videos_and_ai_tutor.sql | Supabase / migrations | SQL | Thêm video bài học và nền tảng quyền cho gia sư AI của học sinh. |
| supabase/migrations/0048_force_student_password_change.sql | Supabase / migrations | SQL | Giới hạn dữ liệu học tập của học sinh cho đến khi hoàn tất đổi mật khẩu bắt buộc. |
| supabase/migrations/0049_force_teacher_password_change.sql | Supabase / migrations | SQL | Giới hạn dữ liệu giảng dạy/chấm công của giáo viên khi buộc đổi mật khẩu. |
| supabase/migrations/0050_reset_all_schedules.sql | Supabase / migrations | SQL | Thêm thao tác reset lịch đời đầu; RPC này bị migration sau thu hồi/thay thế. |
| supabase/migrations/0051_delete_schedules_for_month.sql | Supabase / migrations | SQL | Thêm preview/xóa lịch theo tháng; hành vi này tiếp tục bị migration 0052 thay thế. |
| supabase/migrations/0052_delete_all_sessions_in_month.sql | Supabase / migrations | SQL | Thay RPC xóa tháng bằng thao tác xóa buổi trong tháng có preview và audit. |
| supabase/migrations/0053_month_week_template_replacement.sql | Supabase / migrations | SQL | Thay lịch của một tháng bằng mẫu tuần tạo các buổi cụ thể. |
| supabase/migrations/0054_sync_manual_session_student_rosters.sql | Supabase / migrations | SQL | Đồng bộ membership hiệu lực vào roster các buổi thủ công SCHEDULED trong tương lai. |
| supabase/migrations/0055_session_management_and_rosters.sql | Supabase / migrations | SQL | Cho Admin sửa roster buổi tương lai theo membership hiệu lực, bảo toàn dữ liệu học tập/tài chính, xóa buổi trống và chặn tái sinh buổi lặp đã xóa. |
| supabase/migrations/0056_historical_session_edits.sql | Supabase / migrations | SQL | Cho Admin hiệu chỉnh buổi chưa hủy: lịch, giáo viên, roster, nội dung và attendance; kiểm tra quyền/xung đột, ghi audit và giữ nguyên giờ thực tế cùng snapshot tài chính. |
| supabase/migrations/0057_delete_month_where_guard.sql | Supabase / migrations | SQL | Sửa RPC xóa tháng để các lệnh xóa mẫu lịch có điều kiện khóa chính, tương thích với cơ chế production chặn DELETE không có WHERE. |
| supabase/migrations/0058_month_week_schedule_excel_import.sql | Supabase / migrations | SQL | Migration schema; đọc toàn bộ thay đổi và migration sau này có thể thay thế object. |
| supabase/seed.sql | Supabase / cấu hình và seed | SQL | Seed cho database local; không dùng làm căn cứ dữ liệu production. |
| supabase/tests/admin_monthly_session_planning.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra admin monthly session planning bằng fixture database cô lập. |
| supabase/tests/backdated_session_creation.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra backdated session creation bằng fixture database cô lập. |
| supabase/tests/class_teacher_limit.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra class teacher limit bằng fixture database cô lập. |
| supabase/tests/continuous_learning_rls.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra continuous learning rls bằng fixture database cô lập. |
| supabase/tests/historical_session_edits.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra historical session edits bằng fixture database cô lập. |
| supabase/tests/month_week_schedule_excel_import.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra month week schedule excel import bằng fixture database cô lập. |
| supabase/tests/month_week_template_replacement.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra month week template replacement bằng fixture database cô lập. |
| supabase/tests/parallel_session_rooms.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra parallel session rooms bằng fixture database cô lập. |
| supabase/tests/schedule_reset.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra schedule reset bằng fixture database cô lập. |
| supabase/tests/session_learning_commands.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra session learning commands bằng fixture database cô lập. |
| supabase/tests/student_future_session_roster_sync.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra student future session roster sync bằng fixture database cô lập. |
| supabase/tests/timesheet_workflow.test.sql | Supabase / kiểm thử SQL | SQL | SQL/pgTAP kiểm tra timesheet workflow bằng fixture database cô lập. |

Tổng: 274 đường dẫn có trong inventory.
