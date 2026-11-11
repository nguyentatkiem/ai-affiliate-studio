# Phương án cải tạo: AI Video Studio → AI Affiliate Studio

> Dựa trên AI Video Studio của Nguyễn Tất Kiểm — https://github.com/nguyentatkiem/ai-video-studio
> Mục tiêu: chuyên làm video affiliate gắn giỏ hàng TikTok Shop và video bán hàng Facebook (Reels + link affiliate), với **Tự lái** là trung tâm.

---

## 1. Hiện trạng bộ code (những gì đã có)

| Khối | File chính | Dùng lại cho affiliate? |
|---|---|---|
| Engine HTML→MP4 (Chrome headless + ffmpeg), 28 gói style, ~200 khối HyperFrames | `engine/`, `engine/packs/*.js`, `engine/hf/` | **Giữ nguyên** — đây là lõi giá trị nhất |
| Tạo dự án từ clip (whisper, cắt lặng, khung hình, mặt, phụ đề) | `scripts/new_project.mjs`, `transcribe.py`, `cut.py`, `face_track.py` | Giữ — dùng cho video có quay |
| **Tự lái** 12 bước, chạy tiếp được, hồ sơ kênh, học từ chỉnh sửa | `scripts/autopilot.mjs`, `profile.mjs` | **Viết lại chuỗi bước**, giữ khung (state, resume, backup, progress) |
| Hàng đợi nền + thư mục tự động + LaunchAgent | `scripts/queue.mjs` | Giữ, thêm `kind` mới |
| Chủ đề → video không cần quay (Claude viết kịch bản + TTS + b-roll) | `scripts/topic_video.mjs` | **Nền cho "Link sản phẩm → video"** |
| Làm hàng loạt từ Excel/CSV | `scripts/batch.mjs` | Giữ — nhập danh sách sản phẩm |
| Biến thể (variants) | `scripts/variants.mjs` | Đổi thành **biến thể hook A/B** |
| Cắt highlight từ video dài | `scripts/highlights.mjs` | Dùng cho **cắt clip từ livestream bán hàng** |
| Gói đăng (Claude viết caption/hashtag theo nền tảng) | `scripts/publish_texts.mjs`, `studio/routes/52_publish.mjs` | Viết lại prompt cho affiliate |
| Lịch đăng + tự tải YouTube | `scripts/publish.mjs` | Thêm "bộ đăng" TikTok/Facebook (bán tự động) |
| 11 template bán hàng `bh-*`, gói `review`, `beatslide`, `kinetic`, `transform` (trước/sau), `split`, `greenscreen` | `templates/`, `engine/packs/` | Giữ, làm thêm template affiliate |
| B-roll mục tiêu `banhang` | `assets/broll/goals.json` | Giữ |

**Không cần cho affiliate** (ẩn khỏi giao diện, không xoá code engine để còn kéo bản cập nhật từ repo gốc): BĐS, khoá học, podcast, bản tin, multicam, longform, keynote doanh nghiệp, tuyển dụng.

---

## 2. Khác biệt cốt lõi của video affiliate so với video hiện tại

1. **Đơn vị làm việc là SẢN PHẨM, không phải clip.** Một sản phẩm → nhiều video (nhiều góc bán, nhiều hook). Hiện tại Tự lái nhận 1 clip → 1 video.
2. **Phần lớn video affiliate không quay mặt** (faceless): ảnh/video sản phẩm + giọng đọc + chữ động. Hiện tại Tự lái bắt buộc có clip quay.
3. **3 giây đầu quyết định tất cả** → cần thư viện hook + tạo nhiều biến thể hook để test.
4. **CTA phải trỏ đúng chỗ giỏ hàng**: TikTok giỏ vàng nằm góc dưới trái phía trên caption; Facebook: link ở bình luận ghim / mô tả. Cần **vùng an toàn (safe zone)** để chữ không bị UI nền tảng che.
5. **Tuân thủ chính sách TikTok Shop / Facebook** là sống còn (bị khoá giỏ, bóp tương tác):
   - Giá, khuyến mãi trên video phải đúng thực tế; không "rẻ nhất", "cam kết 100%", không tuyên bố y tế/chữa bệnh, không trước–sau với mỹ phẩm/thực phẩm chức năng nếu sai quy định.
   - Không bịa đánh giá / số khách ("12.000+ khách hàng" trong template `bh-khach-hang-noi-gi` phải lấy từ dữ liệu thật hoặc tắt).
   - Nội dung phải **có tính nguyên bản** (TikTok bóp video reup/ghép ảnh tĩnh đơn điệu) → mỗi video phải có biến đổi thật: giọng, bố cục, chữ, nhịp.
   - Gắn nhãn **nội dung do AI tạo** khi dùng giọng AI / hình AI.
6. **Đo bằng đơn hàng, không phải lượt xem**: vòng học phải học từ click/đơn/GMV, không chỉ từ chỉnh sửa tay.

### Giới hạn cần nói rõ
- **Gắn sản phẩm vào giỏ hàng TikTok không làm tự động hoàn toàn được** qua API công khai cho creator affiliate: bước "Thêm liên kết sản phẩm" vẫn phải bấm trong TikTok Studio/app. Phương án: Tự lái chuẩn bị **bộ đăng** (video, caption, hashtag, mã/tên sản phẩm cần gắn, nhãn AI, giờ đăng) và mở sẵn trang upload; người dùng chỉ còn chọn sản phẩm + bấm Đăng (~20 giây/video).
- Facebook: Reels đăng được qua Graph API cho **Page** (không phải trang cá nhân); link affiliate để ở bình luận đầu — có thể tự động cho Page sau khi xin quyền app.
- Lấy dữ liệu sản phẩm từ link Shopee/TikTok Shop: trang hay chặn bot → làm 3 đường: dán link (thử đọc tiêu đề/ảnh công khai), **nhập file xuất từ trung tâm affiliate (CSV)**, hoặc nhập tay + kéo thả ảnh/video do shop cung cấp.

---

## 3. Kiến trúc mới

```
                ┌──────────── Thư viện SẢN PHẨM (products.json + media) ────────────┐
 Dán link / CSV │ tên, giá, giá KM, hoa hồng, link TikTok Shop / Shopee aff, USP,    │
 / ảnh, video ─►│ nỗi đau, đối tượng, ảnh/video, điều ĐƯỢC & KHÔNG được nói, ngành   │
                └───────────────────────────────┬──────────────────────────────────┘
                                                │ 1 sản phẩm × Hồ sơ kênh
                                                ▼
                         ┌──────── TỰ LÁI AFFILIATE (autopilot_aff.mjs) ────────┐
  Thư mục tự động /      │ product → angles → script → voice/footage → assemble │
  hàng đợi / lịch ──────►│ → compliance → hooks(A/B) → sound → export → kit     │
                         │ → schedule → deliver                                  │
                         └──────────────────────┬────────────────────────────────┘
                                                ▼
              N video 9:16 + ảnh bìa + bộ đăng TikTok/FB + lịch + summary.json
                                                ▼
                     Nhập số liệu (CSV affiliate) → HỌC: góc bán / hook / template nào ra đơn
```

### 3.1 Dữ liệu mới (`~/.ai-affiliate-studio/`, tách khỏi `~/.ai-video-studio`)
- `products.json` — `{id, name, category, links:{tiktok, shopee, lazada, other}, tiktok_product_id, price, sale_price, commission_pct, usp[], pains[], audience, claims_ok[], claims_ban[], media:{images[], videos[]}, notes, created}`
- `profiles.json` (mở rộng hồ sơ kênh hiện có) — thêm: `persona` (giọng kênh: chị bán hàng thân thiện / review khách quan / Gen Z…), `voice` (TTS nào), `formats_mix` (tỉ lệ dạng video), `hooks_per_product`, `platforms` (tiktok, facebook_page, facebook_profile), `link_place` (giỏ / bình luận / bio), `ai_label`, `compliance` (chặt / vừa), `slots[]`, `safe_zone`.
- `hooks.json` — thư viện hook theo ngành + điểm hiệu quả học được.
- `stats/` — số liệu nhập từ CSV, gắn về `video_id → product_id, angle, hook, template`.

### 3.2 Chuỗi Tự lái mới (giữ khung resume/backup/progress của `autopilot.mjs`)

| Bước | Làm gì | Dựa trên |
|---|---|---|
| `product` * | Nạp sản phẩm; nếu đầu vào là clip quay → tạo dự án như cũ (`new`) | `new_project.mjs` |
| `angles` | Claude chọn K góc bán phù hợp sản phẩm + hồ sơ: nỗi đau→giải pháp, unbox, so sánh giá, POV, top 3 lý do, trước/sau, "đừng mua nếu…", deal giờ vàng | mới, dùng `callClaude` của `ai_edit.mjs` |
| `script` | Mỗi góc: hook 0–3 s, thân 3–5 nhịp, CTA trỏ giỏ hàng; độ dài 15–35 s; chữ trên màn hình + ý hình ảnh từng nhịp; **chỉ dùng thông tin trong products.json** | `topic_video.mjs` (scriptPrompt) |
| `voice` | Faceless: TTS (edge-tts / giọng nhân bản) đo độ dài thật, căn từng từ. Có quay: dùng giọng gốc + cắt lỗi nói | `topic_video.mjs`, `fillers.py`, `voice_clean.py` |
| `assemble` | Đặt ảnh/video sản phẩm theo nhịp (Ken Burns, zoom vào chi tiết), thẻ giá gạch, badge KM, chữ động, phụ đề karaoke, **mũi tên/nhãn "Bấm giỏ hàng ↙"**, tránh safe zone | template `bh-*`, gói `review/kinetic/beatslide/transform` |
| `compliance` * | Claude + luật cứng soát: giá khớp products.json, từ cấm theo ngành, claim không có trong `claims_ok`, đánh giá/số liệu bịa → sửa hoặc dừng | mới (kiểu `ai_qc.mjs`) |
| `hooks` | Nhân N biến thể chỉ khác 3 giây đầu (chữ hook, cảnh mở, nhạc đầu) | `variants.mjs` |
| `sound` | Nhạc theo mood ngành + SFX ting/cash register ở giá/CTA, −14 LUFS | `auto_sfx.py`, `mix_audio.py` |
| `export` * | Render 9:16 1080p, tất cả biến thể song song | `render.mjs` |
| `kit` | Bộ đăng mỗi video: caption ≤ giới hạn, hashtag, **tên/ID sản phẩm cần gắn giỏ**, link aff (FB bình luận đầu), nhãn AI, ảnh bìa | `publish_texts.mjs` (prompt mới) |
| `schedule` | Rải vào khung giờ vàng, không đăng 2 video cùng sản phẩm liền nhau | `publish.mjs schedule-auto` |
| `deliver` * | Thư mục giao `<sản phẩm>/<góc>-<hook>.mp4` + `summary.json` + thông báo | như cũ |

`*` = bắt buộc. Giữ cơ chế: chạy lại cùng lệnh thì tiếp từ bước dừng, `--from <bước>`, `--restart`.

### 3.3 Bốn chế độ đầu vào của Tự lái
1. **Link/sản phẩm → video (không quay)** — giá trị lớn nhất, làm trước.
2. **Clip quay review/unbox → video** — chuỗi cũ + `assemble` overlay sản phẩm + `compliance` + `hooks`.
3. **Livestream dài → nhiều clip ngắn** — `highlights.mjs` chọn đoạn có giới thiệu sản phẩm, gắn đúng sản phẩm.
4. **CSV nhiều sản phẩm → hàng loạt** — `batch.mjs` + hàng đợi, mỗi sản phẩm N video.

Thư mục tự động: thả **video/ảnh vào thư mục mang tên sản phẩm** → tự nhận là media của sản phẩm đó và chạy.

### 3.4 Template affiliate cần làm thêm (trên engine sẵn có)
- `aff-gio-vang-pov` — POV cầm sản phẩm + nhãn giỏ vàng góc dưới trái.
- `aff-noi-dau-giai-phap` — hook nỗi đau chữ to, cắt sang sản phẩm, 3 lợi ích, thẻ giá.
- `aff-unbox-nhanh` — cắt nhanh theo nhịp, zoom chi tiết, âm thanh ASMR.
- `aff-so-sanh-2-sp` — chia đôi (gói `split`), bảng so sánh, kết luận.
- `aff-top-3-ly-do` — gói `topn`.
- `aff-deal-dem-nguoc` — đồng hồ đếm ngược, giá gạch, mã giảm (từ `bh-flash-sale-coupon`).
- `aff-truoc-sau` — gói `transform`, tự tắt với ngành bị hạn chế.
- Lớp phủ **safe zone** TikTok/Facebook bật trong editor để canh chữ.

### 3.5 Vòng học ra đơn (thay "học từ chỉnh sửa")
- Nhập CSV hiệu suất video từ trung tâm affiliate TikTok Shop / báo cáo Shopee affiliate → khớp video theo tên file/ID.
- Tính theo **đơn/1000 view, CTR giỏ, GMV** cho từng: góc bán, hook, template, độ dài, giọng, khung giờ.
- Luật đơn giản trước (≥ 5 video mỗi nhóm): tăng tỉ lệ góc/hook thắng, bỏ dần cái thua; hiển thị bằng câu tiếng Việt trong thẻ hồ sơ như hiện nay.
- Vẫn giữ "học từ chỉnh sửa" cũ cho phần dựng.

---

## 4. Giao diện (Studio)
- Rail mới **Sản phẩm** (lưới thẻ sản phẩm, dán link, kéo thả ảnh/video, nhập CSV).
- Rail **Tự lái** đổi trang đầu: chọn sản phẩm (hoặc thả clip) → chọn số góc × số hook → Chạy. Bảng kết quả dạng lưới video theo sản phẩm, nút "Mở TikTok Studio + chép caption" từng video.
- Rail **Lịch đăng** hiện theo sản phẩm, cảnh báo đăng trùng.
- Rail **Hiệu quả** (mới): nhập CSV, bảng góc/hook thắng.
- Ẩn rail/nhóm template không dùng bằng cờ trong `studio/features/` (không xoá file).
- Giữ màn giới thiệu tác giả `studio/features/00_author.js` (bắt buộc theo AGENTS.md).

---

## 5. Lộ trình đề xuất

| Giai đoạn | Nội dung | Kết quả kiểm được |
|---|---|---|
| **P0 – Tách dự án** (½–1 ngày) | Đổi tên app, `AVS_HOME` → `~/.ai-affiliate-studio`, cổng 5187 (chạy song song bản gốc), ẩn rail không dùng, README ghi công | Mở Studio mới không đụng dữ liệu bản cũ |
| **P1 – Sản phẩm** (1–2 ngày) | `products.json`, route + rail Sản phẩm, nhập link/ảnh/CSV | Tạo 10 sản phẩm từ CSV |
| **P2 – Tự lái faceless** (3–4 ngày) | `autopilot_aff.mjs` các bước product→deliver cho chế độ 1, 3 template affiliate đầu tiên, compliance cơ bản | 1 sản phẩm → 3 góc × 2 hook = 6 MP4 + bộ đăng trong ~5 phút |
| **P3 – Clip quay + livestream** (2–3 ngày) | Chế độ 2, 3 | Thả clip unbox → video có thẻ giá + giỏ vàng |
| **P4 – Đăng & lịch** (2 ngày) | Bộ đăng TikTok (bán tự động), Facebook Page API + bình luận link, rải lịch | Lịch tuần cho 20 video |
| **P5 – Học ra đơn** (2–3 ngày) | Nhập CSV hiệu suất, luật học, rail Hiệu quả | Hồ sơ tự ưu tiên hook thắng |

---

## 6. Các quyết định cần anh chốt
1. **Chế độ ưu tiên số 1**: faceless từ sản phẩm (đề xuất) hay clip quay review?
2. **Giọng đọc**: edge-tts miễn phí (vi-VN HoaiMy/NamMinh) / giọng nhân bản của anh (FPT.AI, ElevenLabs — có phí) / chỉ dùng giọng thật?
3. **Ngành hàng chính** (mỹ phẩm, gia dụng, thời trang, thực phẩm…) — quyết định bộ luật compliance và template làm trước.
4. **Facebook**: đăng lên Page (tự động được) hay trang cá nhân (chỉ bán tự động)?
5. Tạo **repo GitHub mới** (ví dụ `ai-affiliate-studio`) cho dự án này? Hiện remote gốc đã đổi tên thành `upstream` để vẫn kéo được cập nhật engine.

---

## 7. Trạng thái (11/11/2026, nhánh `feat/affiliate-autopilot`)

Đã làm hết P0–P5. Mặc định chọn sẵn như sau:
- Ưu tiên chế độ không quay.
- Giọng đọc: edge-tts Hoài My, mất mạng thì dùng giọng Linh offline.
- Luật kiểm duyệt riêng cho các ngành mỹ phẩm, TPCN, mẹ & bé, thực phẩm, thể thao.
- Facebook: Trang dùng API; trang cá nhân nhắc đăng tay.

| Giai đoạn | File chính | Đã kiểm tra |
|---|---|---|
| P0 tách dự án | `~/.ai-affiliate-studio`, cổng 5187, app "AI Affiliate Studio", LaunchAgent `com.aiaffiliatestudio.watch` | Studio chạy, ghi công tác giả giữ nguyên |
| P1 sản phẩm | `scripts/products.mjs`, rail **Affiliate** | thêm tay, nhập CSV, tự nhận ngành + ID TikTok |
| P2 Tự lái không quay | `aff_script.mjs`, `aff_compliance.mjs`, `aff_video.mjs`, `autopilot_aff.mjs`, `engine/packs/affiliate.js` | Claude viết 2 góc × 2 hook trong 20 s. Một sản phẩm → 8 MP4 + ảnh bìa + bộ đăng trong 8,5 phút. Self-test engine 627 khối, 0 lỗi |
| P3 clip quay + livestream | bước `aff` trong `autopilot.mjs`, `aff_overlay.mjs`, `aff_live.mjs` | clip 30 s → 1 video trong 3 phút (thẻ giá đúng lúc nói giá, giỏ hàng ở cuối). Livestream 2 phút → clip có gắn sản phẩm. Nhãn giỏ hàng thay thẻ kết cũ |
| P4 đăng + lịch | `aff_kit.mjs`, `fb_page.mjs`, `publish.mjs` (gắn giỏ trong nhắc lịch, tự đăng Trang FB) | Facebook đã thử với máy chủ giả (start → upload → finish → comment), chưa thử với Trang thật |
| P5 học từ đơn | `aff_stats.mjs`, rail **Hiệu quả** | file 8 dòng khớp đúng 8/8, học ra góc bán và hook thắng |
