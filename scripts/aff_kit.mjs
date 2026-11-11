// Bộ đăng cho 1 video affiliate: caption + hashtag theo nền tảng, sản phẩm cần gắn giỏ (TikTok), link ở bình luận đầu (Facebook),
// nhắc bật nhãn "Nội dung do AI tạo". Không gọi AI: dùng caption/hashtag Claude đã viết cùng kịch bản (aff_script.mjs).
// Ghi <dự án>/publish/kit_<platform>.json + .txt. Spec: references/affiliate.md §Bộ đăng.
import fs from 'node:fs';
import path from 'node:path';
import { fmtPrice } from './products.mjs';
import { trackedLink, trackSettings } from './aff_track.mjs';

export const LIMITS = { tiktok: { caption: 2200, tags: [3, 6] }, facebook: { caption: 2200, tags: [2, 5] } };
const tagify = h => (Array.isArray(h) ? h : String(h || '').split(/[\s,]+/)).map(t => String(t).trim().replace(/^#+/, '').replace(/\s+/g, '')).filter(Boolean).map(t => '#' + t);

export function affLink(p, platform) {
  if (platform === 'tiktok') return p.links.tiktok || '';
  return p.links.shopee || p.links.tiktok || p.links.lazada || p.links.other || '';
}
export function buildKit(tl, p, platform, { aiVoice = true, code = '' } = {}) {
  const A = tl._aff || {}, fb = platform === 'facebook', L = LIMITS[platform] || LIMITS.tiktok;
  const other = fb ? /^#(tiktok\w*|fyp|foryou\w*|xuhuong\w*)$/i : /^#(reels?|facebook\w*|fb\w*)$/i; // tags of the other platform
  const tags = [...new Set(tagify(A.hashtags))].filter(t => !other.test(t)).slice(0, L.tags[1]);
  if (tags.length < L.tags[0]) for (const t of fb ? ['#reels', '#review', '#muasam'] : ['#tiktokshop', '#review', '#muasam']) if (!tags.includes(t) && tags.length < L.tags[0]) tags.push(t);
  let caption = String(A.caption || A.title || p.name).trim();
  // first line = this video's own hook (differs per angle × hook): stronger opener, and lets aff_stats tell the videos apart
  const hookLine = String(A.hook?.say || '').trim();
  if (hookLine && !caption.toLowerCase().startsWith(hookLine.toLowerCase().slice(0, 20))) caption = `${hookLine}\n${caption}`;
  const link = trackedLink(affLink(p, platform), code); // mã theo dõi riêng từng video (sub_id)
  if (fb) caption = caption.replace(/bấm (vào )?giỏ hàng[^.!]*[.!]?/gi, '').trim() + (link ? '\n👇 Link mua ở bình luận đầu tiên' : '');
  else { caption = caption.replace(/link (mua )?(ở|trong) bình luận[^.!]*[.!]?/gi, '').trim(); if (!/giỏ hàng/i.test(caption)) caption += '\n🛒 Bấm giỏ hàng để xem giá'; }
  if (A.disclaimer) caption += `\n${A.disclaimer}`;
  const tail = code && trackSettings().caption_code ? ` [${code}]` : ''; // file xuất số liệu có cột mô tả → khớp đúng video
  caption = caption.slice(0, L.caption - tags.join(' ').length - 2 - tail.length) + tail;
  const kit = {
    platform, product: p.id, product_name: p.name, code: code || null, title: String(A.title || p.name).slice(0, 100), caption, hashtags: tags,
    attach: fb ? null : { name: p.name, product_id: p.tiktok_product_id || '', link: p.links.tiktok || '', how: 'TikTok Studio / app: Thêm liên kết → Sản phẩm → tìm theo tên hoặc ID trong Showcase → chọn → đặt tên hiển thị ≤ 30 ký tự' },
    first_comment: fb && link ? `🛒 Link mua ${p.name}${p.price ? ` (đang ${fmtPrice(p.price)})` : ''}: ${link}` : '',
    ai_label: aiVoice || /^clone:/.test(A.voice || ''), // giọng đọc/hình do AI tạo → bật "Nội dung do AI tạo" (TikTok) / "Thông tin AI" (Facebook)
    checklist: [
      fb ? 'Đăng lên Trang (Page) dạng Reels, dán caption' : 'Mở TikTok Studio → Tải lên video, dán caption',
      fb ? (link ? 'Đăng xong: bình luận đầu = link mua (đã chép sẵn), ghim bình luận' : 'Chưa có link affiliate Facebook/Shopee cho sản phẩm này — thêm trong thẻ sản phẩm') : `Gắn sản phẩm: ${p.name}${p.tiktok_product_id ? ` (ID ${p.tiktok_product_id})` : ''}`,
      aiVoice ? (fb ? 'Bật nhãn "Thông tin AI" (giọng đọc do AI tạo)' : 'Bật "Nội dung do AI tạo" trong Cài đặt khác') : null,
      'Chọn ảnh bìa: file ảnh bìa đi kèm',
    ].filter(Boolean),
  };
  kit.text = [
    `# ${fb ? 'Facebook Reels' : 'TikTok'} — ${p.name}`, `\n## Caption\n${kit.caption}`, `\n## Hashtag\n${kit.hashtags.join(' ')}`,
    kit.attach ? `\n## Gắn giỏ hàng\n${kit.attach.name}${kit.attach.product_id ? `\nID sản phẩm: ${kit.attach.product_id}` : ''}${kit.attach.link ? `\nLink: ${kit.attach.link}` : ''}\n${kit.attach.how}` : '',
    kit.first_comment ? `\n## Bình luận đầu (ghim)\n${kit.first_comment}` : '',
    `\n## Việc cần làm khi đăng\n${kit.checklist.map(x => '- ' + x).join('\n')}`,
  ].filter(Boolean).join('\n');
  return kit;
}
export function writeKit(dir, kit) {
  fs.mkdirSync(path.join(dir, 'publish'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'publish', `kit_${kit.platform}.json`), JSON.stringify(kit, null, 1));
  fs.writeFileSync(path.join(dir, 'publish', `kit_${kit.platform}.txt`), kit.text + '\n');
  // the generic publish.json lets Lịch đăng (publish.mjs captionsFor) pick up the same caption
  const pf = path.join(dir, 'publish/publish.json'); let pj = {}; try { pj = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch {}
  pj.platforms = { ...(pj.platforms || {}), [kit.platform]: { title: kit.title, caption: kit.caption, hashtags: kit.hashtags, first_comment: kit.first_comment, attach: kit.attach } };
  fs.writeFileSync(pf, JSON.stringify(pj, null, 1));
}
