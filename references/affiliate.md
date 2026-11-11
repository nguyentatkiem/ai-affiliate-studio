# Affiliate: Sản phẩm · Tự lái affiliate · Tuân thủ · Bộ đăng · Học từ đơn hàng

Làm video affiliate gắn giỏ hàng TikTok Shop và video bán hàng Facebook Reels (link ở bình luận đầu). Đơn vị làm việc là **sản phẩm**: một sản phẩm cho ra nhiều video, gồm nhiều góc bán × nhiều hook × từng nền tảng.

| Phần | File |
|---|---|
| Thư viện sản phẩm (lưu, nhập CSV/Excel, đọc link, ảnh/video) | `scripts/products.mjs` |
| Kịch bản: góc bán × hook (Claude, có bản dựng sẵn khi không có Claude) | `scripts/aff_script.mjs` |
| Kiểm tra chính sách (luật cứng theo ngành, giá, đánh giá bịa) | `scripts/aff_compliance.mjs` |
| Dựng 1 video không quay (TTS → căn chữ → hình sản phẩm → hook → thẻ giá → giỏ hàng) | `scripts/aff_video.mjs` |
| Gói đồ hoạ `affiliate` (hook, giỏ hàng, thẻ giá, khuyến cáo, đếm ngược) | `engine/packs/affiliate.js`, doc `references/pack-affiliate.md` |
| **Tự lái affiliate** (chuỗi đầy đủ, chạy tiếp được) | `scripts/autopilot_aff.mjs` |
| Clip tự quay → gắn sản phẩm (bước `aff` trong Tự lái cũ) | `scripts/autopilot.mjs --product`, `scripts/aff_overlay.mjs` |
| Livestream dài → nhiều clip có gắn sản phẩm | `scripts/aff_live.mjs` |
| Bộ đăng (caption, gắn giỏ, bình luận đầu, nhãn AI) | `scripts/aff_kit.mjs` |
| Đăng Reels lên Trang Facebook + bình luận link | `scripts/fb_page.mjs` (gọi từ `publish.mjs run-due`) |
| Sổ video + học từ số liệu đơn hàng | `scripts/aff_stats.mjs` |
| Studio | `studio/routes/14_affiliate.mjs`, `studio/features/14_affiliate.js` (rail **Affiliate**, **Hiệu quả**) |

Dữ liệu nằm trong `~/.ai-affiliate-studio/` (đổi bằng `AVS_HOME`). Thư mục này tách riêng với `~/.ai-video-studio` của bản gốc, nên hai app chạy song song được (Studio ở cổng **5187**).
- `products.json` + `products/<id>/media/`: thông tin và ảnh/video của từng sản phẩm.
- `affiliate/jobs/<sản phẩm>-<hash>/`: mỗi lần chạy Tự lái là một thư mục, gồm `scripts.json`, `compliance.txt`, `videos/<góc>-h<n>-<nền tảng>/` (mỗi video là một dự án Studio), `summary.json` và `.aff/state.json`.
- `affiliate/videos.json`: sổ video đã giao, có kèm số liệu.
- `affiliate/live/`, `affiliate/inbox/`, `facebook.json` (quyền 600).

## 1. Sản phẩm
```bash
node scripts/products.mjs add --name "Kem chống nắng X SPF50" --price 199k --old 299000 --usp "Không bết|Nâng tông nhẹ" --pains "Da dầu bóng" --tiktok <link> --media a.jpg,b.mp4
node scripts/products.mjs import danh-sach.xlsx      # file xuất từ trung tâm affiliate hoặc bảng tự làm
node scripts/products.mjs fetch <link>               # đọc og:title / og:image / JSON-LD, được gì lấy nấy
node scripts/products.mjs list | show <id> | media <id> a.jpg | rm <id>
```
- Trường dữ liệu: `name, category, brand, price, old_price, commission_pct, links{tiktok,shopee,lazada,other}, tiktok_product_id, usp[], pains[], audience, specs[], claims_ok[], claims_ban[], voucher, deal_until, notes, media[]`.
- Giá nhận được nhiều cách viết: `199k`, `199.000đ`, `1,2tr`. `category` tự đoán từ tên sản phẩm (dùng cho luật kiểm duyệt), có thể sửa tay. `tiktok_product_id` tự lấy từ link.
- Cột của file nhập được nhận theo tên, không phân biệt dấu: Tên sản phẩm, Giá bán, Giá gốc, Tỷ lệ hoa hồng, Product ID, Link, Ảnh (nhiều URL, cách nhau bằng `|`)…
- Shopee và TikTok thường chặn đọc trang tự động. Khi đó vẫn tạo được sản phẩm từ link, rồi nhập tay tên/giá và kéo ảnh vào.

## 2. Tự lái affiliate
```bash
node scripts/autopilot_aff.mjs <product-id> [--angles 3] [--hooks 2] [--platforms tiktok,facebook] [--dur 30] [--angle noi-dau,deal]
                                            [--voice auto|edge:vi-VN-NamMinhNeural|Linh] [--profile id] [--out ~/Movies/Affiliate] [--schedule] [--offline] [--restart] [--from build]
node scripts/queue.mjs add aff <product-id>      # chạy nền qua hàng đợi (Studio: nút "Làm video")
```
| Bước | Làm gì |
|---|---|
| `product` * | Nạp sản phẩm, cảnh báo nếu thiếu ảnh, giá, điểm nổi bật hoặc link TikTok |
| `script` * | `aff_script.mjs`: Claude viết K góc × N hook, phần thân dùng chung, chỉ dựa trên thông tin trong thẻ sản phẩm. Ưu tiên các góc/hook đã ra đơn (`aff_stats.learnedPrefs`) |
| `compliance` * | Tự sửa từ nói quá. Kịch bản còn vi phạm thì Claude viết lại 1 lần, nếu vẫn vi phạm thì bỏ (`aff_strict`). Ghi `compliance.txt` |
| `build` * | `aff_video.mjs` cho từng (góc, hook, nền tảng). Bản Facebook đổi CTA thành "link ở bình luận đầu" |
| `export` * | Xuất MP4 1080×1920 (−14 LUFS) và ảnh bìa ở cuối hook |
| `kit` | `aff_kit.mjs` ghi `publish/kit_<nền tảng>.json/.txt` và `publish.json` (để Lịch đăng dùng) |
| `schedule` | `--schedule` hoặc hồ sơ `aff_autoschedule`: rải video vào khung giờ đăng (`publish.mjs autoSchedule`) |
| `deliver` * | Ghi `summary.json` và sổ video, chép sang `--out` (tên file: `<góc> - hook n - <nền tảng>.mp4`, kèm ảnh bìa và bộ đăng), gửi thông báo |

Chạy lại cùng lệnh thì bỏ qua các bước và video đã xong. `--from build` làm lại từ bước dựng.

**Góc bán** (`ANGLES`): `noi-dau`, `top-ly-do`, `deal`, `unbox`, `pov`, `review-that`, `dung-mua-neu`, `huong-dan`, `truoc-sau`. Góc `truoc-sau` bị chặn với mỹ phẩm và TPCN. Một góc chỉ được dùng khi sản phẩm có đủ dữ liệu cho góc đó.

**Kiểu hook** (`HOOKS`): `cau-hoi`, `gay-soc`, `con-so`, `canh-bao`, `pov`, `loi-ich`.

**Video không quay** (`aff_video.mjs`):
- Giọng đọc mặc định là edge-tts Hoài My. Khi mất mạng thì tự chuyển sang giọng Linh của macOS. Giọng Linh có thể tự đọc nhanh hơn để vừa thời lượng.
- Mốc từng chữ có được bằng cách cho whisper nghe lại bản đọc rồi khớp với kịch bản. Phụ đề dùng kiểu `review`.
- Ảnh sản phẩm được đặt nguyên vẹn giữa khung, nền là chính ảnh đó làm mờ. Video sản phẩm được tách khung 30 fps (tối đa 12 s). Ảnh và video dùng luân phiên, zoom chậm.
- Lớp chữ theo `visual` của từng ý:
  - `price` → `rv_product`
  - `proscons` → `rv_proscons`
  - `list` / `unbox` → `rv_unbox`
  - `number` → `kinetic_slam`
  - `versus` → `kinetic_diamonds`
  - `product` / `words` → từ khoá trên ảnh
- Phần cuối luôn có `aff_cart`. Ngành TPCN có thêm `aff_disclaimer` suốt video. SFX tiếng tiền chạy ở thẻ giá và ở nhãn giỏ hàng.
- Thời gian thực tế (Mac M-series, clip ~25 s): khoảng 25 s dựng + 35–40 s xuất cho mỗi video.

Hồ sơ kênh (`profiles.json`) có thêm: `aff_angles`, `aff_hooks`, `aff_platforms`, `aff_dur`, `aff_strict`, `aff_autoschedule`, `voice`, `persona`.

## 3. Clip tự quay và livestream
- **Clip review/unbox**: `node scripts/autopilot.mjs clip.mov --product <id> [--platform tiktok]`. Đây là chuỗi Tự lái cũ, thêm bước `aff` (`aff_overlay.mjs`):
  - Thẻ giá `aff_price` hiện khi người nói nhắc tới giá (từ "giá", "k", "nghìn"…).
  - `aff_cart` hiện ở khoảng 3,8 s cuối. Có khuyến cáo nếu ngành bắt buộc.
  - Lời nói được soát theo luật nhưng chỉ cảnh báo, vì không sửa được giọng. Nên quay lại câu bị báo.
  - Bước `publish` ghi thêm `kit_<nền tảng>`.
- **Livestream**: `node scripts/aff_live.mjs live.mp4 --product <id> [--n 5] [--platform tiktok]`:
  - `highlights.mjs` chọn các đoạn tự trọn ý.
  - Mỗi đoạn được gắn sản phẩm, xuất MP4, làm ảnh bìa và bộ đăng, rồi ghi vào sổ video.
  - Hàng đợi: loại `afflive`.

## 4. Tuân thủ (`aff_compliance.mjs`)
Đây là lưới an toàn, không thay cho việc đọc chính sách mới nhất của sàn.
- **Mọi ngành**:
  - Tự sửa: "rẻ nhất", "tốt nhất/số 1", "duy nhất", "100%", "tuyệt đối", "cam kết", "vĩnh viễn", "ngay lập tức/cấp tốc".
  - Chặn: hàng fake/nhái, số người/số đơn/số sao không có trong `claims_ok`, mượn danh bác sĩ/chuyên gia/Bộ Y tế.
- **Giá**: mọi con số giá trong lời đọc, chữ trên màn hình và caption phải khớp `price`, `old_price` hoặc voucher (sai số ±0,5%). Phần trăm giảm phải khớp mức giảm thật hoặc mức giảm của voucher.
- **Mỹ phẩm**:
  - Tự đổi "trị/đặc trị/điều trị/chữa" → "hỗ trợ cải thiện" (không đổi chữ "giá trị").
  - Không được: thải độc, trắng cấp tốc, hết mụn/nám.
- **TPCN**:
  - Chặn: chữa/phòng bệnh, thay thế thuốc, hứa số kg.
  - Tự thêm câu khuyến cáo bắt buộc. Câu này hiện trên màn hình và trong caption.
- **Mẹ & bé**: không so sánh với sữa mẹ. Sữa cho trẻ dưới 24 tháng tuổi bị chặn hoàn toàn (Nghị định 100/2014).
- `claims_ban` của từng sản phẩm được chặn thêm. Ví dụ CLI: `node scripts/aff_compliance.mjs script.json <id>` (mã thoát 3 nếu còn vi phạm).

## 5. Bộ đăng và đăng
- **TikTok**: TikTok không có API công khai để creator affiliate gắn sản phẩm vào giỏ. Vì vậy:
  - Bộ đăng ghi sẵn tên và ID sản phẩm cần gắn.
  - Nút **Đăng** trong Studio sẽ chép caption, mở TikTok Studio và hiện file. Người dùng chỉ cần chọn sản phẩm, bật "Nội dung do AI tạo" rồi bấm Đăng.
- **Facebook Trang (Page)**: `node scripts/fb_page.mjs connect <page_id> <page_token>`. Sau khi kết nối:
  - Lịch đăng (`publish.mjs run-due`) tự đăng Reels (start → rupload → finish) rồi bình luận link affiliate (`first_comment`). Nếu video chưa xử lý xong thì thử bình luận lại tối đa 6 lần.
  - Lỗi token thì dừng và báo kết nối lại.
  - Khi chưa kết nối, hoặc đăng lên trang cá nhân, thì chỉ nhắc đăng tay.
- Lịch đăng hiện thêm thông tin "Gắn giỏ: …" và nhắc bình luận link.

## 6. Học từ đơn hàng (`aff_stats.mjs`)
```bash
node scripts/aff_stats.mjs import video-performance.xlsx [--platform tiktok]
node scripts/aff_stats.mjs report
node scripts/aff_stats.mjs set <job>/<video-key> --views 1200 --orders 3
```
- **Khớp số liệu**: mỗi dòng trong file được khớp với video trong sổ theo caption/tiêu đề (tiền tố chung hoặc tỉ lệ từ trùng ≥ 0,55) hoặc theo tên file. Các cột được nhận: lượt xem, lượt nhấp sản phẩm, đơn hàng, GMV, hoa hồng.
- **Chỉ số chính**: số đơn trên 1.000 lượt xem. Dùng CTR khi chưa có đơn nào.
- **Luật học**:
  - Cần ít nhất 5 video có số liệu.
  - Một nhóm phải có ít nhất 2 video mới được tính. Góc bán và kiểu hook đạt mức trung bình trở lên được ưu tiên khi viết kịch bản.
  - Góc có ít nhất 3 video mà chưa ra đơn nào thì bị xếp xuống sau.
  - Kết quả hiện thành câu tiếng Việt trong bảng **Hiệu quả**.

## 7. Giới hạn
- Kịch bản tự nhiên cần Claude Code CLI. Không có CLI thì dùng kịch bản dựng sẵn từ dữ liệu sản phẩm.
- edge-tts cần mạng. Giọng Linh offline nghe máy hơn.
- Video không quay chỉ hay khi có ảnh/video thật của sản phẩm. Ảnh PNG nền trong suốt cho kết quả đẹp nhất.
- Khớp số liệu theo caption có thể sai nếu caption trên sàn bị sửa nhiều. Khi đó dùng `set` để nhập tay.
