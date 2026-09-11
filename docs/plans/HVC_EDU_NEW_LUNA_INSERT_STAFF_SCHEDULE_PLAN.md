# HVC_EDU_NEW — Kế hoạch cho GPT Luna: tạo tài khoản nhân sự + lịch học + gán lớp trên Supabase

## 1. Mục tiêu

Thực hiện trực tiếp trên project `daovanhung-dev/HVC_EDU_NEW`, Supabase project ref hiện tại:

```text
dtftytlyaqmxjgynicqs
```

Mục tiêu cuối:

- Tạo/hoàn thiện 6 nhân sự trong Supabase.
- Tạo tài khoản đăng nhập cho từng nhân sự.
- Username theo quy tắc: họ tên không dấu, chữ thường, viết liền, `đ -> d`.
- Password theo quy tắc: `<username><3 chữ số ngẫu nhiên>`.
- Gán đúng role `TEACHER` / `ASSISTANT`.
- Gán nhân sự vào đúng lớp Toán 6, 7, 8, 9.
- Insert lịch học tuần theo ảnh được cung cấp.
- Không tạo dữ liệu trùng khi chạy lại.
- Xuất **chỉ các credential thực sự đã tạo thành công** vào file local:
  `docs/accounts/staff_accounts_2026-09.md`
- Tuyệt đối không push file chứa mật khẩu lên GitHub.

> Không chỉnh sửa dữ liệu lịch sử đã hoàn thành. Không tự đoán dữ liệu còn thiếu.

---

## 2. Dữ liệu nhân sự chuẩn hóa

| # | Họ tên | Role | Username bắt buộc | Email | SĐT |
|---|---|---|---|---|---|
| 1 | Nguyễn Hà Anh | ASSISTANT | `nguyenhaanh` | `nguynhanh0709@gmail.com` | `0967743683` |
| 2 | Nguyễn Thanh Tâm | ASSISTANT | `nguyenthanhtam` | `tamthanh20239@gmail.com` | NULL / điền sau |
| 3 | Nguyễn Mạnh Cường | TEACHER | `nguyenmanhcuong` | `manhcuongit2@gmail.com` | `0393355821` |
| 4 | Đào Phương Anh | TEACHER | `daophuonganh` | `phuonganhx632@gmail.com` | NULL / điền sau |
| 5 | Đào Quang Duy | ASSISTANT | `daoquangduy` | `duyq0402@gmail.com` | NULL / điền sau |
| 6 | Trần Mạnh Tiền | ASSISTANT | `tranmanhtien` | NULL / điền sau | NULL / điền sau |

### Quy tắc credential

Mỗi password phải sinh **tại thời điểm thực thi**, ví dụ logic:

```text
password = username + random_integer(100..999)
```

Không hard-code trước password vào source, migration, GitHub Actions, commit message hoặc log CI.

Với `Trần Mạnh Tiền`, vì chưa có email thật, `admin-create-user` hiện sẽ dùng synthetic auth email:

```text
tranmanhtien@hvc-edu.local
```

Sau này khi có email thật cần cập nhật đồng bộ Auth + `profiles` + `staff`; không coi synthetic email là email liên hệ thật.

---

## 3. Lịch học được trích từ ảnh

Hệ thống dùng ISO day-of-week:

```text
1 = Thứ 2
2 = Thứ 3
3 = Thứ 4
4 = Thứ 5
5 = Thứ 6
6 = Thứ 7
7 = Chủ Nhật
```

Lịch cần insert:

| Lớp | day_of_week | Ngày | Bắt đầu | Giáo viên | Trợ giảng |
|---|---:|---|---|---|---|
| Toán 9 | 1 | Thứ 2 | 17:30 | Nguyễn Mạnh Cường | Trần Mạnh Tiền |
| Toán 8 | 2 | Thứ 3 | 17:30 | Nguyễn Mạnh Cường | Không có |
| Toán 6 | 4 | Thứ 5 | 17:30 | Đào Phương Anh | Đào Quang Duy, Nguyễn Thanh Tâm |
| Toán 9 | 4 | Thứ 5 | 17:30 | Nguyễn Mạnh Cường | Trần Mạnh Tiền |
| Toán 7 | 5 | Thứ 6 | 17:30 | Nguyễn Mạnh Cường | Nguyễn Hà Anh |
| Toán 8 | 7 | Chủ Nhật | 08:00 | Đào Phương Anh | Không có |
| Toán 7 | 7 | Chủ Nhật | 08:00 | Nguyễn Mạnh Cường | Nguyễn Hà Anh |
| Toán 6 | 7 | Chủ Nhật | 17:30 | Đào Phương Anh | Đào Quang Duy, Nguyễn Thanh Tâm |

### Blocker bắt buộc phải xử lý trước khi insert schedule

Ảnh chỉ có **giờ bắt đầu**, trong khi bảng `class_month_schedules` bắt buộc có `end_time` và constraint `end_time > start_time`.

Luna phải:

1. Kiểm tra schedule hiện có của đúng các lớp để lấy thời lượng chuẩn nếu đã tồn tại.
2. Nếu project có business rule/default duration rõ ràng thì reuse đúng rule đó.
3. Nếu không tìm được giờ kết thúc đáng tin cậy, **dừng phần insert lịch** và báo lại thiếu `end_time`.
4. Tuyệt đối không tự đoán 19:30, 20:00, v.v.

Phần tạo tài khoản và tạo/gán staff có thể vẫn hoàn thành độc lập nếu schedule bị block vì thiếu `end_time`.

---

## 4. Mapping nhân sự ↔ lớp

### Toán 6

```text
TEACHER:
- Đào Phương Anh

ASSISTANT:
- Đào Quang Duy
- Nguyễn Thanh Tâm
```

### Toán 7

```text
TEACHER:
- Nguyễn Mạnh Cường

ASSISTANT:
- Nguyễn Hà Anh
```

### Toán 8

```text
TEACHER:
- Nguyễn Mạnh Cường     (Thứ 3 17:30)
- Đào Phương Anh        (Chủ Nhật 08:00)

ASSISTANT:
- Không có
```

### Toán 9

```text
TEACHER:
- Nguyễn Mạnh Cường

ASSISTANT:
- Trần Mạnh Tiền
```

---

## 5. Lưu ý kiến trúc quan trọng: Toán 8 có giáo viên theo từng lịch

Schema hiện tại có:

```text
class_month_staff
class_month_schedules
session_staff
```

Nhưng `class_month_schedules` **không có staff**.

Khi activate ClassMonth, implementation hiện tại copy toàn bộ `class_month_staff` sang **mọi session** của lớp.

Vì vậy nếu chỉ insert cả `Nguyễn Mạnh Cường` và `Đào Phương Anh` vào `class_month_staff` của Toán 8 thì hệ thống có thể hiểu sai rằng **cả hai cùng dạy mọi buổi Toán 8**.

Dữ liệu ảnh yêu cầu:

```text
Thứ 3 17:30  -> Nguyễn Mạnh Cường
Chủ Nhật 08:00 -> Đào Phương Anh
```

### Cách xử lý khuyến nghị

Luna phải giữ hai lớp dữ liệu:

```text
class_month_staff
    = danh sách nhân sự có tham gia lớp trong tháng

schedule/session staffing
    = ai thực sự dạy từng slot
```

Nếu hệ thống hiện chưa có mapping schedule → staff thì trước khi coi task hoàn tất, Luna phải chọn phương án sạch:

```text
class_month_schedule_staff
(schedule_id, staff_id, assignment_role)
```

và cập nhật logic generate `session_staff` để ưu tiên mapping theo schedule.

Không dùng `session-replace-staff` để giả lập lịch cố định của Toán 8, vì đó là nghiệp vụ "dạy thay", không phải giáo viên lịch gốc.

Nếu scope hiện tại chỉ cho phép insert data, chưa cho phép schema migration, phải:
- vẫn gán cả Cường và Phương Anh vào roster `class_month_staff` của Toán 8;
- ghi rõ limitation trong báo cáo;
- không tuyên bố staffing từng session đã chính xác.

---

# 6. Plan thực thi cho Luna

## Phase A — Preflight, tuyệt đối chưa ghi dữ liệu

1. Mở repo local `HVC_EDU_NEW`.
2. Chạy `git status`.
3. Không reset, checkout, clean hoặc xóa thay đổi local của user.
4. Confirm Supabase project đang link đúng `dtftytlyaqmxjgynicqs`.
5. Confirm migrations production ít nhất đã tới `0027_expand_subjects_grades.sql`.
6. Confirm Edge Function `admin-create-user` production đang deploy.
7. Query các bảng:
   - `profiles`
   - `staff`
   - `subjects`
   - `grades`
   - `classes`
   - `class_months`
   - `class_month_staff`
   - `class_month_schedules`
   - `sessions`
   - `session_staff`
8. Xác định class thật bằng relation:
   - subject = `MATH`
   - grade = `GRADE_6`, `GRADE_7`, `GRADE_8`, `GRADE_9`
9. Không đoán UUID.
10. Nếu mỗi grade có đúng 1 lớp Toán active → dùng lớp đó.
11. Nếu grade nào có `0` hoặc `>1` lớp Toán phù hợp → stop mutation cho grade đó và báo ambiguity.

## Phase B — Xác định ClassMonth đích

Target mặc định cho lần vận hành này là **09/2026**, nhưng phải kiểm tra dữ liệu production trước.

Với mỗi lớp Toán 6–9:

- Nếu đã có `class_months(year=2026, month=9)` → dùng record đó.
- Nếu chưa có → tạo `DRAFT`, không tạo trùng.
- Nếu record đang `DRAFT` → có thể upsert roster và schedule.
- Nếu record đang `ACTIVE`:
  - không giả định sửa `class_month_schedules` sẽ tự sửa `sessions`;
  - không sửa `COMPLETED`/`IN_PROGRESS` sessions;
  - inspect các `SCHEDULED` session tương lai trước khi chỉnh;
  - nếu lịch mới khác lịch đã generate, lập reconciliation cho các session tương lai và báo rõ.
- Không auto-activate ClassMonth chỉ để hoàn thành task nếu chưa đủ học sinh/prerequisite.

## Phase C — Bảo vệ file credential local

Tạo:

```bash
mkdir -p docs/accounts
```

Để tránh commit nhầm nhưng không sửa `.gitignore` của repo, thêm local-only rule vào:

```text
.git/info/exclude
```

Rule:

```text
/docs/accounts/
```

Sau khi tạo file credential phải:

```bash
chmod 600 docs/accounts/staff_accounts_2026-09.md
git check-ignore -v docs/accounts/staff_accounts_2026-09.md
```

Nếu file chưa được ignore → **không được tiếp tục bước commit/push nào**.

## Phase D — Tạo tài khoản nhân sự

Không insert trực tiếp vào `auth.users`.

Dùng Edge Function `admin-create-user`, vì function hiện chịu trách nhiệm:

```text
Auth user
→ profiles
→ staff
→ duplicate validation
→ rollback khi lỗi
→ audit log
```

Lưu ý: wrapper `frontend/src/services/commands.ts` hiện không expose field `password`, trong khi Edge Function có hỗ trợ `password`.

Vì requirement bắt buộc password dạng `<username><số>`, tạo **one-off local script** gọi trực tiếp Edge Function với body chứa `password`.

Không cần thay đổi hành vi UI production chỉ để seed 6 tài khoản.

Input logic cho từng người:

```json
{
  "role": "TEACHER hoặc ASSISTANT",
  "username": "<username chuẩn hóa ở bảng trên>",
  "password": "<username><3 số ngẫu nhiên>",
  "email": "<email hoặc omit>",
  "phone": "<phone hoặc omit>",
  "display_name": "<họ tên>",
  "staff": {
    "full_name": "<họ tên>"
  }
}
```

`staff_code` để NULL nếu production chưa có convention code rõ ràng; không tự phát minh mã nhân sự.

### Idempotency account

Trước mỗi account:

- tìm `profiles.username` case-insensitive;
- tìm email nếu có;
- tìm phone nếu có;
- đối chiếu `staff.user_id/full_name`.

Nếu account đã tồn tại:
- không tạo bản ghi thứ hai;
- không tự reset/đổi password của account cũ;
- ghi status `EXISTING` trong report;
- chỉ ghi password vào `docs/accounts/...` nếu chính lần chạy này Luna thực sự tạo/đặt được password đó.

Nếu username/email/phone conflict với người khác → stop người đó và báo rõ conflict.

## Phase E — Gán nhân sự vào ClassMonth

Sau khi đã có `staff.id`, upsert `class_month_staff`.

Dùng unique key logic tương đương:

```text
(class_month_id, staff_id)
```

Expected roster:

```text
Toán 6:
  Phương Anh       TEACHER
  Quang Duy        ASSISTANT
  Thanh Tâm        ASSISTANT

Toán 7:
  Mạnh Cường       TEACHER
  Hà Anh           ASSISTANT

Toán 8:
  Mạnh Cường       TEACHER
  Phương Anh       TEACHER

Toán 9:
  Mạnh Cường       TEACHER
  Mạnh Tiền        ASSISTANT
```

Không tạo duplicate khi script chạy lại.

## Phase F — Insert schedule

Chỉ thực hiện sau khi đã resolve được `end_time`.

Upsert lịch theo:

```text
Toán 9: day 1, 17:30
Toán 8: day 2, 17:30
Toán 6: day 4, 17:30
Toán 9: day 4, 17:30
Toán 7: day 5, 17:30
Toán 8: day 7, 08:00
Toán 7: day 7, 08:00
Toán 6: day 7, 17:30
```

Idempotency key logic nên là:

```text
(class_month_id, day_of_week, start_time, end_time)
```

Schema hiện không có unique constraint cho tuple này, vì vậy Luna phải kiểm tra tồn tại trước khi insert hoặc bổ sung migration unique constraint nếu phù hợp với nghiệp vụ.

## Phase G — Staffing theo từng slot

Với Toán 6, 7, 9:
- roster cấp ClassMonth và staffing trong ảnh không mâu thuẫn.

Với Toán 8:
- Thứ 3 phải là Cường.
- Chủ Nhật phải là Phương Anh.

Nếu triển khai `class_month_schedule_staff`, insert mapping đúng theo từng schedule rồi cập nhật generator để `session_staff` sinh đúng.

Nếu không triển khai schema mới, báo limitation và không được ghi "Toán 8 session staffing exact = DONE".

## Phase H — Verification sau insert

Query lại và kiểm tra:

```text
profiles: 6 nhân sự đúng role/username/contact
staff: 6 nhân sự đúng staff_type
class_month_staff: đúng roster 4 lớp
class_month_schedules: đúng 8 weekly slots
sessions: không bị duplicate
session_staff: đúng người theo buổi nếu đã generate
audit_logs: account create có audit
```

Kiểm tra conflict thời gian:
- Thứ 5 17:30 có Toán 6 + Toán 9 song song nhưng khác staff.
- Chủ Nhật 08:00 có Toán 7 + Toán 8 song song nhưng khác teacher.
- Không được có một staff bị gán đồng thời vào hai session overlap.

## Phase I — Xuất credential local

Chỉ sau khi account create thành công, ghi:

```text
docs/accounts/staff_accounts_2026-09.md
```

Template:

```markdown
# HVC EDU — Staff Accounts

> LOCAL ONLY — DO NOT COMMIT / DO NOT PUSH

| Họ tên | Role | Username | Password | Email thực | Auth email | SĐT | Trạng thái |
|---|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... | CREATED |
```

Password trong file phải đúng password đã thực sự gửi thành công vào `admin-create-user`.

Không lưu password của record `FAILED`.

Với record `EXISTING` mà Luna không biết password hiện tại:
- để password là `UNKNOWN/EXISTING`;
- không tự reset password.

Sau khi ghi:

```bash
chmod 600 docs/accounts/staff_accounts_2026-09.md
git check-ignore -v docs/accounts/staff_accounts_2026-09.md
git status --short
```

Credential file không được xuất hiện như file có thể commit.

---

# 7. Không được làm

- Không commit/push `docs/accounts/**`.
- Không đưa password vào migration SQL.
- Không đưa ROOT password, service-role/secret key vào source.
- Không insert thủ công trực tiếp `auth.users`.
- Không tạo duplicate class/staff/profile/class_month.
- Không tự đoán UUID lớp.
- Không tự đoán `end_time`.
- Không sửa session đã `COMPLETED`.
- Không dùng `session-replace-staff` để giả lập lịch cố định của Toán 8.
- Không chạy destructive command như `supabase db reset` trên production.
- Không chạy `git clean -fd`, `git reset --hard` hoặc xóa thay đổi local của user.

---

# 8. Acceptance Criteria

Task chỉ được báo `DONE` khi đạt:

```text
[ ] 6 nhân sự được tạo hoặc đối chiếu không trùng.
[ ] Role đúng: 2 TEACHER + 4 ASSISTANT.
[ ] Username đúng chuẩn hóa.
[ ] Password của account mới đúng <username><3 số>.
[ ] Contact info đúng dữ liệu đã cung cấp; field thiếu để NULL/placeholder hợp lệ.
[ ] 4 lớp Toán được resolve đúng từ DB, không hard-code UUID.
[ ] class_month_staff đúng mapping.
[ ] 8 weekly schedule slot đúng ảnh.
[ ] end_time lấy từ nguồn đáng tin cậy, không đoán.
[ ] Toán 8 không bị hiểu sai thành 2 giáo viên cùng dạy mọi buổi nếu exact staffing được đánh dấu DONE.
[ ] Không duplicate dữ liệu khi chạy lại.
[ ] Không sửa dữ liệu session lịch sử đã hoàn thành.
[ ] Credential file nằm local tại docs/accounts/.
[ ] Credential file có chmod 600 và được local-ignore.
[ ] Không có secret/password bị staged hoặc push lên GitHub.
[ ] Luna in ra report cuối: CREATED / EXISTING / FAILED / BLOCKED cho từng nhân sự và từng lớp.
```

---

# 9. Báo cáo cuối Luna phải trả cho Hùng

Trả về ngắn gọn theo form:

```text
STAFF
- Nguyễn Hà Anh: CREATED / EXISTING / FAILED
- Nguyễn Thanh Tâm: ...
- Nguyễn Mạnh Cường: ...
- Đào Phương Anh: ...
- Đào Quang Duy: ...
- Trần Mạnh Tiền: ...

CLASS ASSIGNMENT
- Toán 6: ...
- Toán 7: ...
- Toán 8: ...
- Toán 9: ...

SCHEDULE
- 8 expected
- X inserted
- Y already existed
- Z blocked

CREDENTIAL FILE
- docs/accounts/staff_accounts_2026-09.md
- ignored: YES/NO
- permission: 600/OTHER

BLOCKERS
- ...
```

Nếu thiếu `end_time`, task phải báo:

```text
PARTIAL DONE:
- accounts + staff + class assignment completed
- schedule insert BLOCKED because end_time is missing
```

Không được tự bịa giờ kết thúc để biến trạng thái thành DONE.
