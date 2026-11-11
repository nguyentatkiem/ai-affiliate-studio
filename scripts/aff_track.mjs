// Mã theo dõi RIÊNG cho từng video affiliate: khớp số liệu đơn hàng chính xác thay vì đoán theo caption.
// - code: 6 ký tự cố định theo khoá video (vd "v3k9xa"), in ở cuối caption "[v3k9xa]" và gắn vào link (sub_id) ở bình luận Facebook.
// - Link affiliate Shopee/Lazada/khác: thêm tham số sub_id theo mẫu ở affiliate/track.json (sửa được, mặc định bên dưới).
// - Đăng xong dán link video (TikTok/Facebook) → lưu ID video; file xuất có cột link/ID video sẽ khớp đúng 100%.
// aff_stats.mjs dùng: findCode(), videoIdOf(). Spec: references/affiliate.md §Mã theo dõi.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AVS_HOME } from './profile.mjs';

const FILE = path.join(AVS_HOME, 'affiliate/track.json');
// tham số gắn mã theo tên miền (đổi trong affiliate/track.json nếu trung tâm affiliate của bạn dùng tên khác)
export const DEFAULT_TRACK = { params: { shopee: 'sub_id', 'shp.ee': 'sub_id', lazada: 'sub_aff_id', 'lzd.co': 'sub_aff_id', tiki: 'utm_content', default: 'utm_content' }, caption_code: true };
export function trackSettings() { try { const s = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...DEFAULT_TRACK, ...s, params: { ...DEFAULT_TRACK.params, ...(s.params || {}) } }; } catch { return DEFAULT_TRACK; } }
export function saveTrackSettings(o) { const s = { ...trackSettings(), ...o }; fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); return s; }

// "v" + 5 base36 chars, stable for a video key
export const codeFor = key => 'v' + BigInt('0x' + crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12)).toString(36).slice(-5).padStart(5, '0');
const CODE_RE = /(?:^|[^a-z0-9])(v[0-9a-z]{5})(?![0-9a-z])/gi;
export function findCode(text, known) { for (const m of String(text || '').matchAll(CODE_RE)) { const c = m[1].toLowerCase(); if (!known || known.has(c)) return c; } return null; }

export function trackedLink(url, code) {
  if (!url || !code) return url || '';
  let u; try { u = new URL(url); } catch { return url; }
  const P = trackSettings().params, host = u.hostname.toLowerCase();
  const k = Object.keys(P).find(d => d !== 'default' && host.includes(d)) || 'default';
  if (!P[k]) return url;
  u.searchParams.set(P[k], code);
  return u.toString();
}

// TikTok: …/video/7412345678901234567 · Facebook: /reel/123…, /videos/123…, ?v=123… · or a bare long number
export function videoIdOf(s) {
  s = String(s || '').trim();
  const m = /\/(?:video|reel|videos|watch\/?\?v=|shorts)\/?(\d{9,25})/i.exec(s) || /[?&]v=(\d{9,25})/.exec(s) || /^(\d{12,25})$/.exec(s);
  return m ? m[1] : null;
}
