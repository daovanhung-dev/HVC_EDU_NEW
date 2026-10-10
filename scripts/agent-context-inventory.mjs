#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const unknownArgs = args.filter((arg) => arg !== '--check')
if (unknownArgs.length) {
  process.stderr.write('Usage: node scripts/agent-context-inventory.mjs [--check]\n')
  process.exit(2)
}

const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean)

const inventoryRelativePath = 'docs/agent-context/repository-inventory.md'
const entries = [...new Set([...tracked, ...untracked, inventoryRelativePath])]
  .sort((a, b) => a.localeCompare(b, 'en'))

function subsystem(file) {
  if (file === 'AGENTS.md' || file.endsWith('/AGENTS.md')) return 'Chỉ dẫn agent'
  if (file.startsWith('frontend/src/modules/admin/')) return 'Frontend / Admin'
  if (file.startsWith('frontend/src/modules/staff/')) return 'Frontend / Giáo viên'
  if (file.startsWith('frontend/src/modules/student/')) return 'Frontend / Học sinh'
  if (file.startsWith('frontend/src/modules/auth/')) return 'Frontend / Đăng nhập'
  if (file.startsWith('frontend/src/')) return 'Frontend / nền tảng và dịch vụ'
  if (file.startsWith('frontend/')) return 'Frontend / cấu hình và public'
  if (file.startsWith('supabase/migrations/')) return 'Supabase / migrations'
  if (file.startsWith('supabase/functions/')) return 'Supabase / Edge Functions'
  if (file.startsWith('supabase/tests/')) return 'Supabase / kiểm thử SQL'
  if (file.startsWith('supabase/')) return 'Supabase / cấu hình và seed'
  if (file.startsWith('docs/agent-context/')) return 'Agent context'
  if (file.startsWith('docs/data_seed/')) return 'Dữ liệu nguồn được bảo vệ'
  if (file.startsWith('docs/accounts/')) return 'Local-only được bảo vệ'
  if (file.startsWith('docs/plans/')) return 'Kế hoạch lịch sử theo nhiệm vụ'
  if (file.startsWith('docs/')) return 'Tài liệu sản phẩm / lịch sử'
  if (file.startsWith('.github/workflows/')) return 'CI và phát hành'
  if (file.startsWith('scripts/')) return 'Công cụ dự án'
  if (file.startsWith('assets/')) return 'Tài nguyên tĩnh'
  return 'Cấu hình ở repo root'
}

function fileType(file) {
  const name = path.basename(file).toLowerCase()
  if (name === 'package-lock.json') return 'npm lockfile'
  if (name === 'deno.lock') return 'Deno lockfile'
  if (name === '.gitignore') return 'Git ignore rules'
  if (name.endsWith('.env.example')) return 'Mẫu biến môi trường'
  const extension = path.extname(name).slice(1)
  const types = {
    md: 'Markdown',
    ts: 'TypeScript',
    vue: 'Vue SFC',
    sql: 'SQL',
    json: 'JSON/config',
    toml: 'TOML/config',
    yml: 'YAML workflow',
    yaml: 'YAML',
    sh: 'Shell',
    css: 'CSS',
    html: 'HTML',
    xlsm: 'Workbook nguồn; chỉ lập chỉ mục đường dẫn',
    jpg: 'Ảnh',
    png: 'Ảnh',
    svg: 'SVG',
  }
  return types[extension] || (extension ? extension.toUpperCase() : 'Không có extension')
}

const migrationPurposes = {
  '0001_extensions.sql': 'Bật các PostgreSQL extension nền tảng được schema sử dụng.',
  '0002_enums.sql': 'Khai báo enum trạng thái, vai trò và chính sách nghiệp vụ ban đầu.',
  '0003_auth_profiles.sql': 'Nối danh tính Supabase Auth với hồ sơ và trạng thái người dùng.',
  '0004_rbac.sql': 'Tạo quyền và các hàm kiểm tra quyền phiên bản đầu.',
  '0005_students_staff.sql': 'Tạo hồ sơ học sinh, nhân sự và quan hệ với tài khoản.',
  '0006_academic_master.sql': 'Tạo môn, khối, lớp và chính sách sĩ số.',
  '0007_class_month.sql': 'Tạo mô hình ClassMonth lịch sử và lịch theo tháng.',
  '0008_sessions.sql': 'Tạo buổi học và các quan hệ lớp/buổi phiên bản đầu.',
  '0009_attendance.sql': 'Tạo điểm danh theo buổi, phút đi muộn, lý do vắng và điểm BTVN 0–10.',
  '0010_timesheets.sql': 'Tạo mô hình chấm công lịch sử ban đầu.',
  '0011_tuition.sql': 'Tạo các bảng học phí lịch sử; không đồng nghĩa app hiện hành đang vận hành học phí.',
  '0012_payroll.sql': 'Tạo các bảng payroll lịch sử; không đồng nghĩa app hiện hành đang tính lương.',
  '0013_accounting.sql': 'Tạo các bảng kế toán lịch sử; không đồng nghĩa app hiện hành đang vận hành kế toán.',
  '0014_notifications.sql': 'Tạo cấu trúc thông báo lịch sử.',
  '0015_audit.sql': 'Tạo nhật ký audit và cấu trúc ghi nhận thay đổi.',
  '0016_functions.sql': 'Tạo các hàm nghiệp vụ PostgreSQL ban đầu.',
  '0017_rls.sql': 'Bật và định nghĩa các chính sách RLS ban đầu.',
  '0018_indexes.sql': 'Bổ sung index cho các truy vấn và quan hệ schema ban đầu.',
  '0019_seed_master.sql': 'Nạp dữ liệu danh mục ban đầu cho môi trường database.',
  '0020_cleanup_function_warnings.sql': 'Điều chỉnh các hàm database để dọn cảnh báo và cấu hình thực thi.',
  '0021_core_commands.sql': 'Thêm các RPC/lệnh database cốt lõi có kiểm tra nghiệp vụ.',
  '0022_attendance_snapshot_fk.sql': 'Bổ sung quan hệ khóa ngoại cho snapshot học tập/điểm danh.',
  '0023_student_schedule_policy.sql': 'Điều chỉnh policy dữ liệu lịch của học sinh.',
  '0024_completion_commands.sql': 'Thêm hoặc siết các lệnh bắt đầu/hoàn tất buổi học.',
  '0025_business_hardening.sql': 'Gia cố ràng buộc và kiểm tra nghiệp vụ trong database.',
  '0026_admin_permissions.sql': 'Điều chỉnh quyền Admin ở database; đọc cùng các migration sau thay đổi RBAC.',
  '0027_expand_subjects_grades.sql': 'Mở rộng danh mục môn/khối học mà vẫn giữ mã danh mục đã có.',
  '0028_fix_staff_rls_recursion.sql': 'Sửa vòng lặp RLS khi xác định quyền đọc hồ sơ nhân sự.',
  '0029_session_fee_snapshots.sql': 'Bổ sung snapshot phí ở buổi học thuộc schema tài chính lịch sử.',
  '0030_fix_student_rls_recursion.sql': 'Sửa vòng lặp RLS khi xác định quyền đọc học sinh.',
  '0031_schedule_rooms.sql': 'Bổ sung phòng vào mô hình lịch/buổi.',
  '0032_fix_session_rls_recursion.sql': 'Sửa vòng lặp RLS giữa buổi học và roster buổi.',
  '0033_class_month_schedule_staff.sql': 'Gắn giáo viên với từng khung lịch tháng trong mô hình cũ.',
  '0034_attendance_assessment_fields.sql': 'Bổ sung trường đánh giá, ghi chú buổi và snapshot nguồn; không định nghĩa điểm tổng.',
  '0035_seed_t9_attendance.sql': 'Migration import snapshot điểm danh lịch sử; không trích hoặc sao chép dữ liệu từng người vào context.',
  '0036_parent_role.sql': 'Thêm vai trò PARENT lịch sử; vai trò này được retire ở migration sau.',
  '0037_learning_scope.sql': 'Điều chỉnh phạm vi đọc/ghi hồ sơ học tập liên tục.',
  '0038_retire_parent_role.sql': 'Thu hồi luồng và quyền dữ liệu của PARENT nhưng giữ liên kết lịch sử.',
  '0039_continuous_learning.sql': 'Chuyển sang membership liên tục, lịch lặp và buổi theo ngày; khóa app khỏi ClassMonth/tài chính cũ.',
  '0040_fix_continuous_learning_rls_recursion.sql': 'Sửa vòng lặp RLS cho mô hình học tập liên tục bằng helper an toàn.',
  '0041_admin_monthly_session_planning.sql': 'Thêm RPC để Admin lập buổi cụ thể và áp mẫu tuần vào tháng.',
  '0042_restore_session_timesheets.sql': 'Mở lại chấm công theo buổi đã hoàn thành, không mở payroll.',
  '0043_limit_class_teachers.sql': 'Giới hạn tối đa năm giáo viên duy nhất đang được phân công cho một lớp.',
  '0044_allow_parallel_sessions_by_room.sql': 'Áp quy tắc xung đột buổi theo lớp, roster và phòng tại từng buổi.',
  '0045_backdated_attendance_sessions.sql': 'Cho Admin lập buổi điểm danh bù trong quá khứ với kiểm tra quyền/xung đột.',
  '0046_allow_secret_key_session_rpcs.sql': 'Cho Edge Function gọi RPC buổi học bằng service role; RPC vẫn xác minh người thực hiện.',
  '0047_lesson_videos_and_ai_tutor.sql': 'Thêm video bài học và nền tảng quyền cho gia sư AI của học sinh.',
  '0048_force_student_password_change.sql': 'Giới hạn dữ liệu học tập của học sinh cho đến khi hoàn tất đổi mật khẩu bắt buộc.',
  '0049_force_teacher_password_change.sql': 'Giới hạn dữ liệu giảng dạy/chấm công của giáo viên khi buộc đổi mật khẩu.',
  '0050_reset_all_schedules.sql': 'Thêm thao tác reset lịch đời đầu; RPC này bị migration sau thu hồi/thay thế.',
  '0051_delete_schedules_for_month.sql': 'Thêm preview/xóa lịch theo tháng; hành vi này tiếp tục bị migration 0052 thay thế.',
  '0052_delete_all_sessions_in_month.sql': 'Thay RPC xóa tháng bằng thao tác xóa buổi trong tháng có preview và audit.',
  '0053_month_week_template_replacement.sql': 'Thay lịch của một tháng bằng mẫu tuần tạo các buổi cụ thể.',
  '0054_sync_manual_session_student_rosters.sql': 'Đồng bộ membership hiệu lực vào roster các buổi thủ công SCHEDULED trong tương lai.',
  '0055_session_management_and_rosters.sql': 'Cho Admin sửa roster buổi tương lai theo membership hiệu lực, bảo toàn dữ liệu học tập/tài chính, xóa buổi trống và chặn tái sinh buổi lặp đã xóa.',
  '0056_historical_session_edits.sql': 'Cho Admin hiệu chỉnh buổi chưa hủy: lịch, giáo viên, roster, nội dung và attendance; kiểm tra quyền/xung đột, ghi audit và giữ nguyên giờ thực tế cùng snapshot tài chính.',
  '0057_delete_month_where_guard.sql': 'Sửa RPC xóa tháng để các lệnh xóa mẫu lịch có điều kiện khóa chính, tương thích với cơ chế production chặn DELETE không có WHERE.',
  '0059_admin_session_attendance_timesheets.sql': 'Cho Admin chốt điểm danh sau giờ kết thúc và quyết định công theo từng giáo viên trong một giao dịch; giữ luồng gửi công của giáo viên và ghi audit khi duyệt/thu hồi.',
}

const filePurposes = {
  'AGENTS.md': 'Chỉ dẫn gốc về phạm vi sản phẩm, bảo mật, quy trình sửa và nguồn sự thật.',
  'README.md': 'Giới thiệu sản phẩm hiện hành, lệnh local, cấu hình public và phát hành.',
  'package.json': 'Workspace root và các lệnh dev/build/check/test/context.',
  'package-lock.json': 'Khóa cây phụ thuộc npm của workspace.',
  'deno.lock': 'Khóa phụ thuộc Deno cho Edge Functions và kiểm tra liên quan.',
  '.gitignore': 'Quy định file local, credential, cache và artifact không đưa vào Git.',
  'design.md': 'Ghi chú thiết kế giao diện/visual direction; kiểm tra với UI và token hiện hành trước khi áp dụng.',
  'assets/logo.jpg': 'Logo/tài nguyên nhận diện tĩnh của trung tâm.',
  '.github/workflows/quality-check.yml': 'CI cho typecheck, test, build frontend và quét một số mẫu secret.',
  '.github/workflows/deploy-pages.yml': 'Build và phát hành SPA tĩnh lên GitHub Pages.',
  '.github/workflows/deploy-supabase.yml': 'Workflow dispatch để áp migration/deploy Edge Functions và dọn endpoint đã retire.',
  'docs/IMPLEMENTATION.md': 'Mô tả phạm vi sản phẩm và hành vi hiện hành; đối chiếu với code/migration.',
  'docs/DELIVERY_ROADMAP.md': 'Roadmap/snapshot lịch sử; không chứng minh trạng thái hiện tại.',
  'docs/Hung_Cuong_Business_Design_v1.0.md': 'Thiết kế nghiệp vụ phiên bản lịch sử; không ghi đè phạm vi hiện hành.',
  'docs/Hung_Cuong_Project_Architecture_GitHubPages_Supabase.md': 'Thiết kế kiến trúc phiên bản lịch sử; đối chiếu với kiến trúc đang chạy.',
  'docs/QA_TEST_REPORT_2026-09-28.md': 'Báo cáo QA lịch sử; chỉ là bằng chứng tại ngày ghi trong tên file.',
  'docs/QA_STAGING_TEST_REPORT_2026-09-29.md': 'Báo cáo staging lịch sử; không đại diện trạng thái backend hiện tại.',
  'docs/QA_STAGING_TEST_REPORT_2026-09-30.md': 'Báo cáo staging lịch sử; không đại diện trạng thái backend hiện tại.',
  'docs/plans/HVC_EDU_NEW_LUNA_INSERT_STAFF_SCHEDULE_PLAN.md': 'Kế hoạch vận hành lịch sử có dữ liệu định danh/chi tiết nhạy cảm; không dùng làm quy trình hiện tại hoặc sao chép vào context.',
  'docs/agent-context/README.md': 'Điểm vào và bộ định tuyến tới các tài liệu context theo loại nhiệm vụ.',
  'docs/agent-context/architecture-and-code-map.md': 'Kiến trúc, công nghệ, request flow, entrypoint và vị trí logic/test.',
  'docs/agent-context/data-security-and-migrations.md': 'Mô hình dữ liệu, quy tắc RLS/RPC/Edge Function, lịch sử migration và an toàn dữ liệu.',
  'docs/agent-context/development-and-release.md': 'Toolchain, lệnh phát triển/kiểm tra, CI và ranh giới vận hành.',
  'docs/agent-context/product-and-workflows.md': 'Vai trò, luồng nghiệp vụ và quy tắc lớp/lịch/buổi/điểm danh/đánh giá/chấm công.',
  'docs/agent-context/repository-inventory.md': 'Danh mục tự sinh, có subsystem, loại file và mục đích của từng đường dẫn.',
  'frontend/AGENTS.md': 'Quy tắc agent riêng cho UI, nghiệp vụ frontend và dùng service/RLS.',
  'supabase/AGENTS.md': 'Quy tắc agent riêng cho migration, RLS, RPC, Edge Function và dữ liệu thật.',
  'frontend/package.json': 'Phụ thuộc và scripts frontend Vue/Vite/Vitest.',
  'frontend/.env.example': 'Tên biến public cần cho frontend; giá trị trong file chỉ là mẫu.',
  'frontend/index.html': 'HTML entrypoint cho bản frontend production.',
  'frontend/public/404.html': 'Fallback GitHub Pages để SPA tiếp nhận đường dẫn khi tải lại.',
  'frontend/review/README.md': 'Hướng dẫn mở UI review cô lập với service mocks và fixture QA-.',
  'frontend/review/index.html': 'HTML entrypoint riêng cho UI review harness.',
  'frontend/review/main.ts': 'Khởi động các màn hình thật trong UI review harness.',
  'frontend/vite.config.ts': 'Cấu hình Vite production/dev, alias, base path và build frontend.',
  'frontend/vite.review.config.ts': 'Cấu hình server UI review với mock service/auth, không gọi Supabase thật.',
  'frontend/tsconfig.json': 'Cấu hình gốc TypeScript cho workspace frontend.',
  'frontend/tsconfig.app.json': 'Cấu hình TypeScript cho mã ứng dụng Vue.',
  'frontend/tsconfig.node.json': 'Cấu hình TypeScript cho file công cụ/config chạy trên Node.',
  'frontend/src/main.ts': 'Bootstrap Vue, Pinia, router, Bootstrap và style gốc.',
  'frontend/src/App.vue': 'Shell component gốc chứa router view và thành phần toàn app.',
  'frontend/src/app/router/index.ts': 'Khai báo route hash, layout, điều hướng theo role và bắt buộc đổi mật khẩu.',
  'frontend/src/stores/auth.store.ts': 'Khởi tạo phiên Supabase, hồ sơ/role và trạng thái xác thực.',
  'frontend/src/stores/app-error.store.ts': 'Lưu/trình bày lỗi cấp ứng dụng.',
  'frontend/src/stores/toast.store.ts': 'Điều phối thông báo toast ngắn hạn.',
  'frontend/src/services/supabase.ts': 'Tạo Supabase client từ biến môi trường public.',
  'frontend/src/services/data-queries.ts': 'Adapter truy vấn/đọc dữ liệu Supabase cho các màn hình.',
  'frontend/src/services/commands.ts': 'Adapter lệnh ghi: CRUD RLS-safe, RPC và Edge Function.',
  'frontend/src/services/edge-functions.ts': 'Chuẩn hóa gọi Edge Function, lỗi, mã lỗi và trace id.',
  'frontend/src/shared/constants/roles.ts': 'Danh sách role hoạt động, role retire và nhãn hiển thị.',
  'frontend/src/shared/types/domain.ts': 'Kiểu dữ liệu frontend cho profile, lớp, buổi, attendance và timesheet.',
  'frontend/src/shared/utils/class-teacher-limit.ts': 'Tính/kiểm tra giới hạn teacher duy nhất trên lớp ở phía client.',
  'frontend/src/shared/utils/errors.ts': 'Chuyển lỗi Supabase/RPC thành thông báo thân thiện cho UI.',
  'frontend/src/shared/utils/format.ts': 'Định dạng ngày giờ và giá trị hiển thị theo locale ứng dụng.',
  'frontend/src/shared/utils/session-calendar.ts': 'Tính cấu trúc lịch tháng cho các buổi học.',
  'frontend/src/shared/utils/youtube.ts': 'Kiểm tra và chuẩn hóa URL YouTube của bài học.',
  'frontend/src/modules/staff/attendance.ts': 'Chuẩn hóa, validate và chuyển attendance thành payload lưu.',
  'frontend/src/modules/staff/components/StaffAttendanceModal.vue': 'Form giáo viên sửa điểm danh, điểm và nhận xét theo học sinh.',
  'frontend/src/modules/staff/pages/SessionsPage.vue': 'Màn hình giáo viên xem buổi được giao, cập nhật nội dung/đánh giá và hoàn tất buổi.',
  'frontend/src/modules/staff/pages/StaffTimesheetsPage.vue': 'Màn hình giáo viên gửi/xem yêu cầu chấm công theo buổi.',
  'frontend/src/modules/staff/pages/StaffProfilePage.vue': 'Màn hình giáo viên xem/sửa thông tin liên hệ cá nhân.',
  'frontend/src/modules/admin/pages/AdminSessionsPage.vue': 'Màn hình Admin lập/sửa buổi kể cả buổi đã qua, quản lý roster, attendance/đánh giá, hủy/xóa buổi tương lai và mẫu lịch theo tháng.',
  'frontend/src/modules/admin/pages/AdminTimesheetsPage.vue': 'Màn hình Admin duyệt hoặc từ chối yêu cầu chấm công theo buổi.',
  'frontend/src/modules/admin/pages/ClassesPage.vue': 'Danh sách/quản lý lớp và cấu hình chính sách sĩ số.',
  'frontend/src/modules/admin/pages/ClassDetailPage.vue': 'Chi tiết lớp, membership, lịch lặp và giáo viên theo lịch.',
  'frontend/src/modules/admin/pages/StaffPage.vue': 'Quản lý hồ sơ và tài khoản giáo viên từ giao diện Admin.',
  'frontend/src/modules/admin/pages/StudentsPage.vue': 'Danh sách/quản lý học sinh và trạng thái tài khoản.',
  'frontend/src/modules/admin/pages/StudentDetailPage.vue': 'Hồ sơ Admin của học sinh, lịch sử học và quan hệ lớp.',
  'frontend/src/modules/admin/components/TeacherPicker.vue': 'Chọn hoặc chỉnh danh sách teacher được giao cho lịch/buổi.',
  'frontend/src/modules/admin/components/BulkPasswordResetModal.vue': 'Giao diện xác nhận và thu thập lựa chọn reset mật khẩu hàng loạt.',
  'frontend/src/modules/admin/components/bulk-password-reset.types.ts': 'Kiểu input/kết quả cho luồng reset mật khẩu hàng loạt.',
  'frontend/src/modules/auth/pages/LoginPage.vue': 'Form đăng nhập bằng định danh tài khoản.',
  'frontend/src/modules/auth/pages/ChangePasswordPage.vue': 'Form hoàn tất đổi mật khẩu bắt buộc.',
  'frontend/src/modules/student/pages/StudentPage.vue': 'Lịch học và kết quả học tập của chính học sinh đang đăng nhập.',
  'frontend/src/modules/student/pages/StudentReviewPage.vue': 'Danh sách video buổi đã hoàn thành mà học sinh được phép xem lại.',
  'frontend/src/modules/student/pages/StudentAiChatPage.vue': 'Chat AI tiếng Việt, tùy chọn ngữ cảnh bài học của học sinh.',
  'frontend/src/modules/admin/utils/student-account-export.ts': 'Định dạng dữ liệu export tài khoản học sinh; rà quyền và dữ liệu nhạy cảm trước khi thay đổi.',
  'frontend/src/modules/admin/utils/student-class-roster-export.ts': 'Định dạng roster lớp cho luồng export hiện có.',
  'frontend/src/devtools/ui-review/ReviewApp.vue': 'Shell chọn màn hình/trạng thái trong UI review harness.',
  'frontend/src/devtools/ui-review/mock-auth.store.ts': 'Mock auth store dùng riêng cho review UI.',
  'frontend/src/devtools/ui-review/mock-services.ts': 'Mock service và fixture synthetic QA- dùng trong review UI.',
  'frontend/src/devtools/ui-review/mock-supabase.ts': 'Mock Supabase client để review UI không kết nối backend.',
  'frontend/src/devtools/ui-review/review-state.ts': 'Điều khiển trạng thái loading/error/empty/slow trong UI review.',
  'frontend/src/styles.css': 'Token màu/kiểu chữ và style toàn ứng dụng.',
  'supabase/config.toml': 'Cấu hình Supabase local, Auth và Edge Functions.',
  'supabase/seed.sql': 'Seed cho database local; không dùng làm căn cứ dữ liệu production.',
  'scripts/agent-context-inventory.mjs': 'Sinh và kiểm tra danh mục Git cùng mô tả mục đích file.',
  'scripts/bootstrap-root.sh': 'Bootstrap ROOT tương tác, tránh ghi credential vào repository.',
}

function humanize(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function purpose(file) {
  if (filePurposes[file]) return filePurposes[file]

  if (file.startsWith('supabase/migrations/')) {
    return migrationPurposes[path.basename(file)] || 'Migration schema; đọc toàn bộ thay đổi và migration sau này có thể thay thế object.'
  }
  if (file.startsWith('supabase/tests/')) {
    return 'SQL/pgTAP kiểm tra ' + humanize(path.basename(file, '.test.sql')) + ' bằng fixture database cô lập.'
  }
  if (file.startsWith('supabase/functions/_shared/')) {
    const name = path.basename(file, '.ts')
    const sharedPurposes = {
      auth: 'xác thực caller và kiểm tra hồ sơ/quyền dùng chung',
      cors: 'xử lý CORS và preflight dùng chung',
      'password-reset': 'tiện ích chung cho reset mật khẩu',
      response: 'chuẩn hóa response thành công/lỗi và trace id',
    }
    return 'Helper Edge Function: ' + (sharedPurposes[name] || humanize(name)) + '.'
  }
  if (file.startsWith('supabase/functions/')) {
    const [, , functionName, fileName] = file.split('/')
    const routePurposes = {
      'admin-account-status': 'đổi trạng thái tài khoản theo quyền Admin',
      'admin-create-user': 'tạo tài khoản và hồ sơ theo role được phép',
      'admin-export-student-logins': 'tạo export thông tin đăng nhập học sinh; xử lý dữ liệu nhạy cảm',
      'admin-reset-password': 'reset mật khẩu một tài khoản theo quyền Admin',
      'admin-reset-password-bulk': 'reset mật khẩu theo lô và ghi kết quả/audit',
      'bootstrap-root': 'bootstrap tài khoản ROOT trong luồng được bảo vệ',
      'login-by-identifier': 'đăng nhập bằng username/định danh qua server',
      'session-complete': 'xác nhận hoàn tất buổi qua RPC có kiểm tra server',
      'session-learning-update': 'lưu điểm danh/kết quả/nội dung buổi qua RPC',
      'session-start': 'bắt đầu buổi học qua RPC có kiểm tra phân công',
      'student-ai-tutor': 'AI học tập cho học sinh, kiểm tra quyền và giới hạn ngữ cảnh gửi đi',
      'student-required-password-change': 'hoàn tất đổi mật khẩu bắt buộc cho học sinh',
      'teacher-comment-optimize': 'gợi ý viết lại nhận xét giáo viên qua Gemini',
      'timesheet-review': 'Admin duyệt/từ chối yêu cầu chấm công qua server',
      'timesheet-submit': 'giáo viên gửi yêu cầu chấm công cho buổi đã hoàn tất',
    }
    const action = routePurposes[functionName] || 'Edge Function ' + humanize(functionName)
    if (fileName === 'config.toml') return 'Cấu hình JWT/deploy riêng cho route ' + functionName + '.'
    if (fileName === 'handler.test.ts') return 'Kiểm thử handler của route ' + functionName + ' với phụ thuộc giả lập.'
    if (fileName === 'handler.ts') return 'Logic có thể kiểm thử tách biệt cho route: ' + action + '.'
    if (fileName === 'index.ts') return 'HTTP entrypoint cho route: ' + action + '.'
  }
  if (file.startsWith('frontend/src/')) {
    const base = path.basename(file)
    if (base.endsWith('.test.ts')) {
      const subject = humanize(base.replace(/\.test\.ts$/, ''))
      return 'Test hồi quy cho ' + subject + ' trong cùng thư mục; xem file source cạnh bên để biết phạm vi chính xác.'
    }
    if (file.startsWith('frontend/src/app/components/')) return 'Component UI dùng chung: ' + humanize(path.basename(file, '.vue')) + '.'
    if (file.startsWith('frontend/src/app/layouts/')) return 'Layout ứng dụng: ' + humanize(path.basename(file, '.vue')) + '.'
    if (file.startsWith('frontend/src/app/router/')) return 'Khai báo và kiểm thử điều hướng theo role của SPA.'
    if (file.startsWith('frontend/src/modules/')) {
      const area = file.includes('/admin/') ? 'Admin' : file.includes('/staff/') ? 'giáo viên' : file.includes('/student/') ? 'học sinh' : 'đăng nhập'
      if (file.includes('/pages/')) return 'Màn hình ' + area + ': ' + humanize(path.basename(file, path.extname(file))) + '.'
      if (file.includes('/components/')) return 'Component luồng ' + area + ': ' + humanize(path.basename(file, path.extname(file))) + '.'
      if (file.includes('/utils/')) return 'Tiện ích nghiệp vụ ' + area + ': ' + humanize(path.basename(file, path.extname(file))) + '.'
      return 'Logic nghiệp vụ ' + area + ': ' + humanize(path.basename(file, path.extname(file))) + '.'
    }
    if (file.startsWith('frontend/src/devtools/ui-review/')) return 'Hạ tầng mock/review UI cô lập: ' + humanize(path.basename(file, path.extname(file))) + '.'
    if (file.startsWith('frontend/src/shared/utils/')) return 'Hàm dùng chung: ' + humanize(path.basename(file, path.extname(file))) + '.'
    if (file.startsWith('frontend/src/shared/')) return 'Kiểu/hằng dùng chung của frontend: ' + humanize(path.basename(file, path.extname(file))) + '.'
    if (file.startsWith('frontend/src/stores/')) return 'Store trạng thái dùng chung: ' + humanize(path.basename(file, path.extname(file))) + '.'
    if (file.endsWith('.css')) return 'Style dùng chung của frontend.'
  }
  if (file.startsWith('docs/data_seed/')) return 'Đường dẫn workbook nguồn được bảo vệ; chỉ lập chỉ mục metadata, tuyệt đối không đọc nội dung.'
  if (file.startsWith('docs/accounts/')) return 'Đường dẫn local-only được bảo vệ; không đọc, dùng hay sao chép nội dung.'
  if (file.startsWith('docs/bug_deploy/')) {
    if (file.endsWith('.zip')) return 'Gói artifact/log chẩn đoán của lần CI lịch sử; không đại diện trạng thái hiện tại.'
    return 'Log CI lịch sử (' + (file.includes('/frontend/') ? 'frontend' : file.includes('/secret-scan/') ? 'secret scan' : 'job tổng') + '); chỉ dùng để tra sự cố cũ.'
  }
  if (file.endsWith('.test.ts')) return 'Test hồi quy cho ' + humanize(path.basename(file, '.test.ts')) + '.'
  if (file.endsWith('.sql')) return 'SQL source/config; xem migration/schema liên quan trước khi thay đổi.'
  if (file.endsWith('.zip')) return 'Artifact nén lịch sử; chỉ mục không trích xuất nội dung.'
  if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.svg')) return 'Tài nguyên hình ảnh tĩnh: ' + humanize(path.basename(file, path.extname(file))) + '.'
  if (file.endsWith('.md')) return 'Tài liệu ' + humanize(path.basename(file, '.md')) + '; xác minh thời điểm và nguồn trước khi dùng như hành vi hiện hành.'
  if (file.endsWith('.toml') || file.endsWith('.json') || file.endsWith('.yml') || file.endsWith('.yaml')) return 'Cấu hình ' + humanize(path.basename(file, path.extname(file))) + '.'
  if (file.endsWith('.txt')) return 'Log/text artifact lịch sử; không dùng làm nguồn trạng thái hiện tại.'
  return 'File ' + fileType(file) + ' thuộc ' + subsystem(file) + ': ' + humanize(path.basename(file, path.extname(file))) + '.'
}

const lines = [
  '# Danh mục cấu trúc repository',
  '',
  '> Tự sinh từ Git: file được theo dõi và file mới chưa bị ignore. Mục đích được mô tả ngắn theo vai trò trong hệ thống; không chép nội dung source vào inventory.',
  '',
  '> Nội dung docs/accounts/ và docs/data_seed/ bị bảo vệ, không được đọc hoặc đưa vào context. Với data_seed chỉ hiển thị metadata đường dẫn. File ignored như node_modules/build/cache không thuộc inventory.',
  '',
  '| Đường dẫn | Subsystem | Loại file | Mục đích và cách dùng |',
  '|---|---|---|---|',
]

for (const file of entries) {
  const safePath = file.replaceAll('|', '\\|')
  lines.push('| ' + safePath + ' | ' + subsystem(file) + ' | ' + fileType(file) + ' | ' + purpose(file).replaceAll('|', '\\|') + ' |')
}
lines.push('', 'Tổng: ' + entries.length + ' đường dẫn có trong inventory.', '')

const expected = lines.join('\n')
const overridePath = process.env.AGENT_CONTEXT_INVENTORY_PATH
const inventoryPath = overridePath
  ? path.resolve(process.cwd(), overridePath)
  : path.join(repoRoot, inventoryRelativePath)

if (checkOnly) {
  let actual
  try {
    actual = readFileSync(inventoryPath, 'utf8')
  } catch {
    process.stderr.write('Thiếu ' + path.relative(repoRoot, inventoryPath) + '; chạy npm run agent:context:update.\n')
    process.exit(1)
  }
  if (actual !== expected) {
    process.stderr.write('Danh mục context chưa khớp với file Git hiện tại: ' + path.relative(repoRoot, inventoryPath) + '\n')
    process.stderr.write('Chạy npm run agent:context:update rồi rà lại thay đổi.\n')
    process.exit(1)
  }
  process.stdout.write('Agent context inventory khớp: ' + entries.length + ' đường dẫn.\n')
} else {
  writeFileSync(inventoryPath, expected, 'utf8')
  process.stdout.write('Đã cập nhật ' + path.relative(repoRoot, inventoryPath) + ' (' + entries.length + ' đường dẫn).\n')
}
