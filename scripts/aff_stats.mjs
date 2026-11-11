// Học từ ĐƠN HÀNG: sổ video Tự lái affiliate đã giao + số liệu nhập từ file xuất (TikTok Shop affiliate / Facebook / Shopee)
// → góc bán và kiểu hook nào ra đơn tốt → Tự lái ưu tiên (aff_script.mjs: prefer / hookPrefer).
// Dữ liệu: ~/.ai-affiliate-studio/affiliate/videos.json. Spec: references/affiliate.md §Học từ đơn hàng. CLI:
//   node scripts/aff_stats.mjs import <file.csv|.xlsx> [--platform tiktok]   (khớp từng dòng với video theo caption/tiêu đề/tên file)
//   node scripts/aff_stats.mjs report [--json] [--profile id]
//   node scripts/aff_stats.mjs set <video-key> --views 1200 --orders 3 [--clicks 40] [--gmv 597000]   (nhập tay)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVS_HOME } from './profile.mjs';
import { parseSheet } from './batch.mjs';

const FILE = path.join(AVS_HOME, 'affiliate/videos.json');
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const norm = s => fold(s).replace(/#\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const num = v => { const s = String(v ?? '').replace(/[^\d.,kKmM]/g, ''); if (!s) return 0; const m = /([\d.,]+)([kKmM])?/.exec(s); let n = +m[1].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'); if (m[2]) n *= /k/i.test(m[2]) ? 1e3 : 1e6; return isFinite(n) ? n : 0; };
function writeAtomic(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); }
export function loadVideos() { try { const s = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(s.videos)) return s; } catch {} return { version: 1, videos: [], imports: [] }; }
const saveVideos = s => writeAtomic(FILE, s);

export function registerVideo(v) {
  const s = loadVideos(), old = s.videos.find(x => x.key === v.key);
  if (old) Object.assign(old, { ...v, stats: old.stats, created: old.created });
  else s.videos.push({ ...v, created: new Date().toISOString(), stats: null });
  saveVideos(s);
}

const COLS = { // most specific first: "lượt nhấp sản phẩm" is clicks, not the product name
  text: ['tieu de video', 'video title', 'mo ta video', 'mo ta', 'description', 'caption', 'noi dung', 'ten video', 'title', 'video'],
  file: ['ten tep', 'file', 'file name'],
  views: ['luot xem', 'video views', 'views', 'luot phat', 'plays', 'impressions'],
  clicks: ['luot nhap san pham', 'product clicks', 'luot nhap', 'clicks', 'link clicks'],
  orders: ['don hang', 'so don', 'orders', 'sku orders', 'items sold', 'so luong ban'],
  gmv: ['gmv', 'doanh thu', 'revenue', 'gia tri don hang'],
  commission: ['hoa hong uoc tinh', 'hoa hong', 'est commission', 'estimated commission', 'commission'],
  product: ['ten san pham', 'product name', 'san pham', 'product'],
};
function mapCols(columns) {
  const f = columns.map(c => norm(c)), m = {};
  for (const [k, names] of Object.entries(COLS)) for (const n of names) { const i = f.findIndex((c, j) => (c === n || c.includes(n)) && !Object.values(m).includes(columns[j])); if (i >= 0) { m[k] = columns[i]; break; } }
  return m;
}
// Similarity of a posted caption/title (from the export) to what Tự lái wrote: shared-prefix + token overlap.
function sim(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0;
  let k = 0; while (k < Math.min(a.length, b.length, 80) && a[k] === b[k]) k++;
  const A = new Set(a.split(' ').filter(w => w.length > 1)), B = new Set(b.split(' ').filter(w => w.length > 1));
  const inter = [...A].filter(w => B.has(w)).length, jac = inter / Math.max(1, Math.min(A.size, B.size));
  return Math.max(k >= 30 ? 1 : k / 40, jac);
}
export function importStats(file, { platform } = {}) {
  const { columns, rows } = parseSheet(file), m = mapCols(columns), s = loadVideos();
  if (!m.views && !m.orders) throw new Error(`Không thấy cột lượt xem / đơn hàng. Các cột có: ${columns.join(', ')}`);
  let matched = 0; const unmatched = [], taken = new Set();
  for (const r of rows) {
    const text = [m.text && r[m.text], m.file && r[m.file]].filter(Boolean).join(' '), prod = m.product ? norm(r[m.product]) : '';
    let best = null, bs = 0;
    for (const v of s.videos) {
      if ((platform && v.platform !== platform) || taken.has(v.key)) continue; // one row per video in a file
      let sc = Math.max(sim(text, v.caption), sim(text, v.title), m.file && r[m.file] && path.basename(v.file) === path.basename(r[m.file]) ? 1 : 0);
      if (prod && v.product_name && sim(prod, v.product_name) < .4) sc *= .5;
      if (sc > bs) { bs = sc; best = v; }
    }
    if (!best || bs < .55) { unmatched.push(text.slice(0, 80) || JSON.stringify(r).slice(0, 80)); continue; }
    taken.add(best.key);
    best.stats = { views: num(r[m.views]), clicks: num(r[m.clicks]), orders: num(r[m.orders]), gmv: num(r[m.gmv]), commission: num(r[m.commission]), updated: new Date().toISOString(), from: path.basename(file) };
    matched++;
  }
  s.imports = [...(s.imports || []), { file: path.basename(file), at: new Date().toISOString(), rows: rows.length, matched, map: m }].slice(-30);
  saveVideos(s);
  return { rows: rows.length, matched, unmatched: unmatched.slice(0, 20), map: m };
}
export function setStats(key, st) {
  const s = loadVideos(), v = s.videos.find(x => x.key === key); if (!v) throw new Error('không thấy video ' + key);
  v.stats = { ...(v.stats || {}), ...Object.fromEntries(Object.entries(st).map(([k, x]) => [k, num(x)])), updated: new Date().toISOString(), from: 'tay' };
  saveVideos(s); return v;
}

// Groups by angle / hook type / platform: orders per 1,000 views (main), CTR to product, GMV per 1,000 views.
export function report({ profile } = {}) {
  const vids = loadVideos().videos.filter(v => v.stats && v.stats.views > 0 && (!profile || v.profile === profile));
  const group = key => {
    const g = {};
    for (const v of vids) { const k = v[key] || '?'; const x = g[k] || (g[k] = { key: k, n: 0, views: 0, clicks: 0, orders: 0, gmv: 0 }); x.n++; for (const f of ['views', 'clicks', 'orders', 'gmv']) x[f] += v.stats[f] || 0; }
    return Object.values(g).map(x => ({ ...x, opk: x.orders / x.views * 1000, ctr: x.clicks / x.views, gpk: x.gmv / x.views * 1000 })).sort((a, b) => b.opk - a.opk || b.ctr - a.ctr);
  };
  const tot = vids.reduce((a, v) => ({ views: a.views + v.stats.views, orders: a.orders + (v.stats.orders || 0), clicks: a.clicks + (v.stats.clicks || 0), gmv: a.gmv + (v.stats.gmv || 0) }), { views: 0, orders: 0, clicks: 0, gmv: 0 });
  return { videos: vids.length, total: { ...tot, opk: tot.views ? tot.orders / tot.views * 1000 : 0 }, angle: group('angle'), hook: group('hook_type'), platform: group('platform'), product: group('product') };
}

const ANGLE_VI = { 'noi-dau': 'Nỗi đau → giải pháp', 'top-ly-do': '3 lý do', deal: 'Săn deal', unbox: 'Mở hộp', pov: 'POV', 'review-that': 'Review thật', 'dung-mua-neu': 'Đừng mua nếu…', 'huong-dan': 'Cách dùng', 'truoc-sau': 'Trước/sau' };
const HOOK_VI = { 'cau-hoi': 'câu hỏi', 'gay-soc': 'gây bất ngờ', 'con-so': 'con số', 'canh-bao': 'cảnh báo', pov: 'POV', 'loi-ich': 'lợi ích' };
// Rules (simple, explainable): need ≥ 5 videos with stats; a group counts with ≥ 2 videos; groups at or above the overall rate go first.
export function learnedPrefs(profile) {
  const r = report({ profile }), out = { angles: [], hooks: [], notes: [], n: r.videos };
  if (r.videos < 5) return out;
  const avg = r.total.opk, pick = (g, names) => g.filter(x => x.n >= 2 && x.key !== '?').filter(x => avg === 0 ? x.ctr > 0 : x.opk >= avg);
  out.angles = pick(r.angle).map(x => x.key); out.hooks = pick(r.hook).map(x => x.key);
  const f = x => (x.opk ? `${x.opk.toFixed(1)} đơn/1.000 view` : `CTR ${(x.ctr * 100).toFixed(1)}%`);
  if (out.angles.length) out.notes.push(`Góc bán ra đơn tốt: ${pick(r.angle).slice(0, 3).map(x => `${ANGLE_VI[x.key] || x.key} (${f(x)})`).join(', ')} → ưu tiên viết trước.`);
  if (out.hooks.length) out.notes.push(`Hook hiệu quả: ${pick(r.hook).slice(0, 3).map(x => `${HOOK_VI[x.key] || x.key} (${f(x)})`).join(', ')}.`);
  const weak = r.angle.filter(x => x.n >= 3 && x.orders === 0);
  if (weak.length) out.notes.push(`Chưa ra đơn sau ≥ 3 video: ${weak.map(x => ANGLE_VI[x.key] || x.key).join(', ')} → xếp sau.`);
  return out;
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a[0] === 'import') { const r = importStats(path.resolve(a[1]), { platform: opt('--platform') }); console.log(JSON.stringify(r, null, 1)); return; }
  if (a[0] === 'set') { const v = setStats(a[1], { views: opt('--views'), orders: opt('--orders'), clicks: opt('--clicks'), gmv: opt('--gmv') }); console.log(JSON.stringify(v.stats)); return; }
  if (a[0] === 'report' || !a[0]) {
    const r = report({ profile: opt('--profile') });
    if (a.includes('--json')) { console.log(JSON.stringify({ ...r, learned: learnedPrefs(opt('--profile')) }, null, 1)); return; }
    console.log(`${r.videos} video có số liệu · ${r.total.views} view · ${r.total.orders} đơn · ${r.total.opk.toFixed(2)} đơn/1.000 view`);
    for (const k of ['angle', 'hook', 'platform']) { console.log(`\n${k}:`); for (const x of r[k]) console.log(`  ${String(x.key).padEnd(14)} ${String(x.n).padStart(3)} video  ${x.opk.toFixed(2).padStart(6)} đơn/1k  CTR ${(x.ctr * 100).toFixed(1)}%`); }
    console.log('\n' + (learnedPrefs(opt('--profile')).notes.join('\n') || '(cần ≥ 5 video có số liệu để học)'));
    return;
  }
  throw new Error('lệnh: import <file> [--platform] | report [--json] | set <video-key> --views … --orders …');
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
