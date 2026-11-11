# Gói `affiliate` — video gắn giỏ hàng 🛒

File: `engine/packs/affiliate.js`. Phụ đề dùng kiểu `review`. Gói này được `scripts/aff_video.mjs` và `scripts/aff_overlay.mjs` dùng, và cũng có trong mục **Hiệu ứng** của Studio.

**Khung thiết kế**: dọc 720×1280 (ngang 1280×720 thì qua `DIMS()`).

**Vùng an toàn TikTok**:
- Theo chiều dọc: y từ 130 đến 1000.
- Chừa khoảng 110 px bên phải cho cột nút.
- Góc dưới bên trái, khoảng y 1000–1080, là chỗ giỏ vàng và tên kênh hiện ra.

**Màu**: lấy từ brand kit (`TL.brand`).
- `accent` (vàng): hook, giỏ hàng.
- `primary` (đỏ): huy hiệu −%.
- Font: `disp`.

| type | Dùng khi | Tham số |
|---|---|---|
| `aff_hook` | 0–3 s đầu | `text` (in hoa, trong ô vàng nghiêng; tự thu nhỏ cho vừa khung), `text2` (dòng phụ), `text2_t`, `box:false` (chữ viền thay vì ô), `y`, `size` |
| `aff_cart` | 3–4 s cuối, chốt đơn | `platform:'tiktok'` (mũi tên ↙ chỉ vào giỏ) \| `'facebook'` (nút xanh + mũi tên ↓ "link ở bình luận"), `text`, `price`, `old_price`, `sub` (voucher), `x`, `y`, `hideCaptions` (mặc định true), `keep` |
| `aff_price` | khi nói giá, hook kiểu con số | `price`, `old_price`, `pct` (huy hiệu −%), `label`, `x`, `y`, `size`, `rotate` |
| `aff_disclaimer` | khuyến cáo bắt buộc (TPCN) | `text`, `y`, `size` |
| `aff_countdown` | chỉ khi deal có hạn thật | `label`, `secs` (thời gian còn lại lúc cảnh bắt đầu), `y` |

Gói `affiliate` dùng chung với gói `review`:
- `rv_product`: thẻ sản phẩm có giá.
- `rv_proscons`, `rv_unbox`.

Và với gói `kinetic`:
- `kinetic_broll` có `media`: ảnh hoặc chuỗi khung video sản phẩm, zoom chậm, từ khoá ở `kw_y` 300.
