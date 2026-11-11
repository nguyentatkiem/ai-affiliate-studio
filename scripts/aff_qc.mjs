// Kiểm tra trước khi xuất video affiliate:
//   check3s(dir, {fix}):  3 giây đầu — sản phẩm xuất hiện trước giây 1, chữ hook đọc kịp, lời mở vào ngay, không bị giao diện TikTok/Reels che
//                         → điểm 0–100, tự sửa được thì sửa (đẩy hình sản phẩm lên đầu, kéo dài hook, dời chữ vào vùng an toàn).
//   complianceLog(dir,p): nhật ký tuân thủ từng video (nguồn hình, nguồn nhạc, nhãn AI, khuyến cáo, kết quả soát luật, tên hãng khác)
//                         → publish/compliance_log.json, dùng khi cần khiếu nại video bị gỡ.
// Spec: references/affiliate.md §Kiểm tra. CLI: node scripts/aff_qc.mjs <project dir> [--fix] [--product id]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getProduct } from './products.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(HERE, '..');
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const r2 = v => Math.round(v * 100) / 100;
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
// TikTok/Reels UI over a 720×1280 design frame: top bar ≤ 130, right action column ≥ 610, caption/cart area ≥ 1000
const SAFE = { top: 130, bottom: 1000, right: 610 };
const isVisual = s => (s.type === 'kinetic_broll' && (s.media || s.broll)) || s.type === 'aff_hero';
const isProduct = s => s.type === 'aff_hero' || (s.type === 'kinetic_broll' && s.media && !(typeof s.media === 'object' && /own_/.test(s.media.seq || '')));

export function check3s(dir, { fix = true } = {}) {
  const f = path.join(dir, 'timeline.json'), tl = rd(f); if (!tl) throw new Error('không thấy timeline.json');
  const vert = (tl.height || 1920) > (tl.width || 1080), issues = [], fixed = [];
  let score = 100;
  // 1. product on screen at 0.8 s
  const at = t => tl.scenes.filter(s => isVisual(s) && s.t0 <= t && s.t1 > t).pop();
  const first = at(.8);
  if (!first || !isProduct(first)) {
    score -= 30; issues.push('Sản phẩm chưa xuất hiện trong giây đầu tiên');
    const src = tl.scenes.find(s => isProduct(s));
    if (fix && src) { const end = Math.min(tl.duration, Math.max(1.6, tl.scenes.find(s => s.type === 'aff_hook')?.t1 || 2.4)); tl.scenes.unshift({ ...JSON.parse(JSON.stringify(src)), t0: 0, t1: r2(end), zoom: 1.25, _qc: true }); fixed.push('đưa hình sản phẩm lên giây 0'); score += 22; }
  }
  // 2. hook text long enough on screen to read (≈ 3,3 từ/giây + 0,4 s nhận ra)
  const hk = tl.scenes.find(s => s.type === 'aff_hook');
  if (!hk) { if (tl._aff?.angle !== 'live' && tl._aff?.angle !== 'clip') { score -= 15; issues.push('Không có chữ hook ở 3 giây đầu'); } }
  else {
    const need = r2(.4 + (words(hk.text) + words(hk.text2) * .7) / 3.3), have = hk.t1 - hk.t0;
    if (have < need) { score -= 10; issues.push(`Chữ hook hiện ${have.toFixed(1)}s, cần ~${need}s để đọc kịp`); if (fix) { hk.t1 = r2(Math.min(hk.t0 + need, 4.2, tl.duration)); fixed.push('kéo dài chữ hook'); score += 8; } }
    if ([...String(hk.text || '')].length > 28) { score -= 5; issues.push('Chữ hook dài quá 28 ký tự — khó đọc trong 3 giây'); }
    if (hk.t0 > .4) { score -= 8; issues.push('Chữ hook vào muộn'); if (fix) { hk.t0 = .05; fixed.push('cho chữ hook vào ngay'); score += 6; } }
  }
  // 3. voice starts right away
  const firstLine = tl._aff?.lines?.[0];
  if (firstLine && firstLine.s > .5) { score -= 8; issues.push(`Lời mở vào chậm (${firstLine.s}s)`); }
  // 4. safe zones (vertical only)
  if (vert) for (const s of tl.scenes) {
    if (s.type === 'aff_hook' && s.y != null && (s.y < SAFE.top + 40 || s.y > SAFE.bottom - 60)) { score -= 8; issues.push('Chữ hook nằm ngoài vùng an toàn'); if (fix) { s.y = Math.min(Math.max(s.y, SAFE.top + 60), SAFE.bottom - 120); fixed.push('dời chữ hook vào vùng an toàn'); score += 6; } }
    if (s.type === 'aff_price' && s.x != null && s.x > SAFE.right - 60) { score -= 6; issues.push('Thẻ giá sát cột nút bên phải'); if (fix) { s.x = SAFE.right - 90; fixed.push('dời thẻ giá sang trái'); score += 5; } }
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  tl._aff = { ...(tl._aff || {}), qc3: { score, issues, fixed, at: new Date().toISOString() } };
  fs.writeFileSync(f, JSON.stringify(tl, null, 1));
  return { score, issues, fixed };
}

// ---------- tên hãng khác (so sánh/nhắc đối thủ dễ bị gỡ, vi phạm quảng cáo so sánh) ----------
const CONSUMER = ['samsung', 'apple', 'iphone', 'xiaomi', 'oppo', 'vivo', 'philips', 'panasonic', 'sunhouse', 'lock&lock', 'lock lock', 'dyson', 'electrolux', 'sharp', 'toshiba', 'lg',
  "l'oreal", 'loreal', 'innisfree', 'la roche-posay', 'la roche posay', 'cocoon', 'some by mi', 'shiseido', 'nivea', 'vichy', 'hada labo', 'senka', 'cerave', 'bioderma', 'the ordinary', 'klairs',
  'omo', 'ariel', 'comfort', 'downy', 'vinamilk', 'th true milk', 'nestle', 'abbott', 'similac', 'enfa', 'uniqlo', 'zara', 'h&m', 'nike', 'adidas', 'puma', 'shopee', 'lazada', 'tiki'];
let BRANDS = null;
function brandList() {
  if (BRANDS) return BRANDS;
  BRANDS = [...CONSUMER];
  try { for (const l of rd(path.join(SKILL, 'assets/broll/logos.json'))?.logos || []) BRANDS.push(...l.names.filter(n => n.length > 3)); } catch {}
  return BRANDS = [...new Set(BRANDS.map(fold))];
}
export function brandMentions(text, p) {
  const t = ` ${fold(text).replace(/[^a-z0-9&' ]+/g, ' ')} `, own = fold(`${p?.brand || ''} ${p?.name || ''}`);
  return brandList().filter(b => t.includes(` ${b} `) && !own.includes(b) && !['tiktok', 'facebook'].includes(b));
}

export function complianceLog(dir, p, { platform } = {}) {
  const tl = rd(path.join(dir, 'timeline.json')); if (!tl) throw new Error('không thấy timeline.json');
  const A = tl._aff || {};
  const media = [], seen = new Set(), add = (kind, ref, note) => { const k = kind + ref; if (!seen.has(k)) { seen.add(k); media.push({ kind, ref, note }); } };
  for (const s of tl.scenes || []) {
    const m = s.media || s.image; if (!m && !s.broll) continue;
    const ref = typeof m === 'object' ? m.seq : m || '';
    if (s.broll) add('preset', s.broll.template || s.broll.id || '', 'hình động dựng sẵn do máy tạo, không bản quyền');
    else if (/own_/.test(ref)) add('own', ref, 'cảnh tự quay của chủ kênh');
    else if (/hero_/.test(ref)) add('product', ref, 'ảnh sản phẩm (đã tách nền) — ảnh shop/nhãn hàng cung cấp cho affiliate');
    else if (/^media\/d\d+_/.test(ref)) add('product', ref, 'cận cảnh cắt từ ảnh sản phẩm');
    else add('product', ref, 'ảnh/video sản phẩm từ thư viện sản phẩm');
  }
  for (const c of tl.clips || []) if (c.src && !/media\/bg\.jpg$/.test(c.src)) add('aroll', c.src, A.angle === 'live' ? 'video livestream của chủ kênh' : 'video do chủ kênh quay');
  const music = (tl.audio?.music || []).map(m => m.file ? { file: m.file, note: 'nhạc tự thêm — HÃY CHẮC CHẮN có quyền dùng', warn: true } : { mood: m.mood, note: 'nhạc trong thư viện của phần mềm (tự sinh, không bản quyền)' });
  const texts = [...(A.lines || []).map(l => `${l.say} ${l.screen || ''}`), ...(tl.scenes || []).flatMap(s => [s.text, s.text2, s.keyword, s.title, s.name].filter(Boolean))].join(' ');
  const brands = brandMentions(texts, p);
  const warns = [...music.filter(m => m.warn).map(m => m.note), ...(brands.length ? [`Nhắc tên hãng khác: ${brands.join(', ')} — quảng cáo so sánh/nhắc đối thủ dễ bị gỡ, nên bỏ`] : []),
    ...((A.compliance?.issues || []).filter(x => x.level === 'error').map(x => `Vi phạm còn lại: ${x.rule}${x.hit ? ` («${x.hit}»)` : ''}`))];
  const log = {
    video: path.basename(dir), product: p ? { id: p.id, name: p.name, brand: p.brand, category: p.category, price: p.price } : null, platform: platform || A.platform,
    generated_at: new Date().toISOString(), ai_content: !['live', 'clip'].includes(A.angle) || !!A.voice, ai_voice: A.voice || null, disclaimer: A.disclaimer || null,
    script_check: A.compliance ? { ok: A.compliance.ok, issues: A.compliance.issues || [] } : null, first3s: A.qc3 || null,
    media, music, brands, warnings: warns, ok: warns.length === 0,
  };
  fs.mkdirSync(path.join(dir, 'publish'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'publish/compliance_log.json'), JSON.stringify(log, null, 1));
  return log;
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const dir = a[0] && path.resolve(a[0]); if (!dir) throw new Error('cách dùng: node scripts/aff_qc.mjs <project dir> [--fix] [--product id]');
  const r = check3s(dir, { fix: a.includes('--fix') });
  const tl = rd(path.join(dir, 'timeline.json')), p = getProduct(opt('--product') || tl?._aff?.product);
  console.log(JSON.stringify({ first3s: r, log: complianceLog(dir, p) }, null, 1));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
