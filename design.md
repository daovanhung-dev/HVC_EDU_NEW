# HVC_EDU — UI/UX Design System

> Tài liệu này là nguồn sự thật cho giao diện HVC_EDU. Thay đổi UI phải theo các token và hành vi bên dưới; cập nhật tài liệu trước khi đổi quy ước chung.

## Triết lý và hướng hình ảnh

HVC_EDU là công cụ làm việc cho Admin, giáo viên và học sinh tại trung tâm giáo dục. Giao diện ưu tiên rõ việc cần làm, dễ quét dữ liệu và ổn định khi dùng lâu; sắc thái thân thiện đến từ màu thương hiệu teal, khoảng trắng và ngôn ngữ gần gũi, không từ minh họa hoặc trang trí SaaS đại trà.

**Luận điểm hình ảnh:** một không gian học tập ấm, gọn và đáng tin, lấy teal của logo làm điểm nhận diện trên nền sáng trung tính.

- Dùng logo hiện có tại `assets/logo.jpg`; giữ tỷ lệ ảnh, dùng `object-fit: contain`, không cắt hoặc kéo méo.
- Ưu tiên nền sáng, bề mặt trắng, chữ xanh than và đường phân cách vừa đủ. Chỉ dùng card khi cần nhóm nội dung hoặc thao tác.
- Không dùng gradient, glassmorphism, bóng đổ hoặc màu nhấn chỉ để trang trí.
- Nội dung và nhãn UI bằng tiếng Việt; giữ nguyên thuật ngữ nghiệp vụ đang dùng trong sản phẩm.

## Token màu

Các cặp chữ/nền chính phải đạt WCAG 2.2 AA. Teal `#0E6F7B` trên trắng đạt 5.87:1; chữ chính `#1D2C2F` trên nền `#F6F8F6` đạt 13.54:1; chữ phụ `#506266` trên trắng đạt 6.40:1; accent `#91601A` trên trắng đạt 5.40:1. Viền điều khiển có tương phản ít nhất 3:1; focus ring teal pha 75% trên nền trắng đạt 4.09:1. Kiểm tra lại sau khi thêm opacity, ảnh hoặc trạng thái tương tác.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--color-primary` | `#0E6F7B` | Nút chính, liên kết, điều hướng đang chọn |
| `--color-primary-hover` | `#0B5A64` | Hover của điều khiển chính |
| `--color-primary-active` | `#074952` | Trạng thái nhấn |
| `--color-primary-soft` | `#E5F1F2` | Nền chọn nhẹ, huy hiệu teal |
| `--color-secondary` | `#345B60` | Nút phụ và thao tác ít ưu tiên |
| `--color-accent` | `#91601A` | Điểm nhấn ấm và trạng thái cần chú ý |
| `--color-accent-soft` | `#FFF4DF` | Nền accent nhẹ |
| `--color-background` | `#F6F8F6` | Nền ứng dụng |
| `--color-surface` | `#FFFFFF` | Bảng, form và vùng nội dung |
| `--color-surface-raised` | `#FFFFFF` | Dialog, menu và lớp nổi |
| `--color-border` | `#D7E0DE` | Phân cách bề mặt |
| `--color-control-border` | `#81918F` | Viền input, select và checkbox |
| `--color-text` | `#1D2C2F` | Tiêu đề và nội dung chính |
| `--color-text-secondary` | `#506266` | Mô tả, nhãn phụ, dữ liệu phụ |
| `--color-text-muted` | `#5E6D70` | Chú thích và nội dung ít ưu tiên |
| `--color-success` / `--color-success-soft` | `#1F6B4D` / `#E8F3EB` | Hoàn tất, duyệt thành công |
| `--color-warning` / `--color-warning-soft` | `#805200` / `#FFF4D7` | Chờ xử lý, cần lưu ý |
| `--color-danger` / `--color-danger-soft` | `#AA3440` / `#FCEAEC` | Từ chối, lỗi và xác nhận hủy/lưu trữ |
| `--color-info` / `--color-info-soft` | `#285F78` / `#EAF2F6` | Thông tin và trợ giúp |
| `--color-focus` | `#0E6F7B` | Vòng focus nhìn thấy rõ |

Trạng thái luôn có nhãn hoặc nội dung đi kèm màu. Disabled phải thể hiện bằng cả trạng thái điều khiển và màu, không chỉ giảm opacity đến mức khó đọc.

## Typography

Dùng `Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`; không tải font từ dịch vụ bên ngoài.

| Vai trò | Cỡ / chiều cao dòng | Trọng lượng |
|---|---|---|
| Tiêu đề trang | `28 / 36px` desktop; `24 / 32px` mobile | 650–700 |
| Tiêu đề khu vực | `20 / 28px` | 600–650 |
| Tiêu đề nhóm/card | `16 / 24px` | 600 |
| Nội dung | `16 / 24px` | 400 |
| Label, nút, bảng | `14 / 20px` | 500–600 |
| Chú thích | `13 / 18px` | 400–500 |

Không dùng chữ nhỏ để nhồi thêm cột. Giữ tiêu đề ngắn và cho nội dung dài xuống dòng.

## Spacing, radius và shadow

- Thang spacing: `4, 8, 12, 16, 24, 32, 40, 48px`.
- Trang: padding `24–32px` desktop, `16px` tablet, `16px` mobile cộng khoảng an toàn cho tab bar dưới.
- Form dùng gap `16px`; nhóm nội dung cách `24–32px`; bảng dùng padding ô `12px 16px`.
- Radius: nút/field `8px`, card `12px`, dialog `16px`, menu `10px`, badge dạng viên thuốc.
- Shadow: bề mặt `0 1px 2px rgb(29 44 47 / 6%)`; menu `0 8px 24px rgb(29 44 47 / 12%)`; dialog `0 20px 60px rgb(29 44 47 / 18%)`. Không thêm shadow mặc định cho mọi card.

## Component và tương tác

### Button và icon

Button có các biến thể primary, secondary, outline, ghost, danger, success và icon-only; mỗi biến thể có hover, active, focus, loading và disabled. Mục tiêu bấm thường dùng tối thiểu `44×44px`; mọi icon-only button có accessible name. Tạo `AppIcon` bằng SVG stroke thống nhất, icon trang trí đặt `aria-hidden="true"` và thao tác vẫn có nhãn chữ khi có thể.

### Form

Mỗi input/select/textarea có label hiển thị, mô tả hoặc đơn vị khi cần, và lỗi gắn với field bằng `aria-describedby`. Required thể hiện bằng HTML semantics và chữ; placeholder chỉ là ví dụ. Giữ giá trị người dùng khi server trả lỗi, chống gửi trùng và chỉ báo thành công sau khi lệnh hoàn tất.

### Table và danh sách

Desktop dùng table HTML có `thead`, tiêu đề cột, trạng thái, hành động rõ ràng và giữ chức năng lọc/sắp xếp hiện có. Tại mobile, danh sách CRUD/chấm công chuyển sang hàng dạng thẻ có nhãn từng trường; lịch sử dài chuyển thành các mục đọc theo thứ tự. Nội dung thực sự cần đối chiếu theo cột có thể cuộn trong vùng riêng có nhãn, không làm tràn toàn trang.

### Dialog, toast và trạng thái

Dialog dùng chung shell, header/body/footer, nút đóng có nhãn, focus trap, Esc khi an toàn và trả focus về nút mở. Form bẩn hỏi trước khi bỏ; thao tác đang gửi khóa nút đóng và nút xác nhận. Form dialog thành bottom sheet trên mobile, giới hạn chiều cao theo viewport, body cuộn riêng và footer thao tác luôn tới được.

Toast dùng vùng `aria-live` phù hợp cho kết quả không cần hành động; lỗi field nằm tại field, lỗi trang giữ thông báo và nút thử lại. Loading dùng skeleton cho vùng dữ liệu và trạng thái busy cho nút; empty state giải thích tình trạng và đưa ra hành động phù hợp khi có thể.

## Shell và responsive

- Từ `1024px`: sidebar đầy đủ, điều hướng theo vai trò và vùng nội dung chính.
- `768–1023px`: rail điều hướng thu gọn có nhãn truy cập được và tooltip không phải cách duy nhất để hiểu chức năng.
- Dưới `768px`: tab bar dưới theo vai trò (Admin 5 mục chính, Giáo viên 3, Học sinh 2); thông tin tài khoản và chức năng phụ ở menu riêng. Nội dung có padding dưới theo safe-area.
- Bộ lập lịch giữ các chế độ tháng/tuần/danh sách ở màn hình rộng; mobile ưu tiên agenda, mở chi tiết bằng sheet và không ép lịch 7 cột gây tràn ngang.
- Kiểm tra tối thiểu tại `375`, `768`, `1024`, `1440px`, cả chuỗi dài và text zoom 200%.

## Motion

| Token | Thời lượng | Dùng cho |
|---|---:|---|
| `--motion-fast` | `120ms` | Focus, hover, press |
| `--motion-normal` | `200ms` | Dropdown, toast, chuyển trạng thái |
| `--motion-slow` | `320ms` | Dialog/sheet và chuyển trang nhẹ |

Dùng easing `cubic-bezier(.2, .8, .2, 1)`. Ưu tiên `transform` và `opacity`; không animate layout hoặc tự chạy hiệu ứng dài. `prefers-reduced-motion: reduce` tắt chuyển động trang trí và shimmer, giữ chuyển trạng thái cần thiết để nội dung/focus không biến mất đột ngột.

## Accessibility và nguyên tắc bảo toàn

- Mục tiêu WCAG 2.2 AA: ngữ nghĩa HTML, heading/landmark đúng, keyboard đầy đủ, focus dễ thấy, nhãn/error/status được liên kết, contrast chữ tối thiểu `4.5:1` và control/focus tối thiểu `3:1` khi áp dụng.
- Có skip link qua điều hướng lặp; không dựa vào hover, màu hoặc gesture kéo để lộ chức năng.
- Tôn trọng lịch sử học tập và quy tắc ngày giờ `Asia/Ho_Chi_Minh`. Lưu trữ, kết thúc membership, hủy buổi và duyệt chấm công vẫn dùng các lệnh hiện hành; không hard-delete.
- Không đổi API, schema, RLS hoặc luồng quyền. Fixture review chỉ dùng dữ liệu tổng hợp có tiền tố `QA-`; không dùng production hoặc dữ liệu trong `docs/accounts/` / `docs/data_seed/`.
