// Bộ não affiliate: từ sổ video (aff_stats.mjs) + thư viện sản phẩm →
//   scoreProducts(): điểm mỗi sản phẩm = hoa hồng × giá × tỉ lệ ra đơn đã học − bão hoà (làm nhiều/mới đăng) → "Hôm nay làm gì"
//   winners():       video thắng (cận dưới Wilson của đơn/view vượt mức chung) → nhân bản thành biến thể
//   insights():      học sâu theo độ dài, giờ đăng, giọng, có người/không, giá trong hook, kênh… chỉ kết luận khi đủ ý nghĩa thống kê
//   weeklyReport():  báo cáo tuần (hoa hồng, đơn, video thắng, gợi ý) → affiliate/reports/<ngày>.md + thông báo
// Spec: references/affiliate.md §Bộ não. CLI:
//   node scripts/aff_insights.mjs score | winners | insights | weekly [--notify] | plan [--profile id] [--quota 6]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVS_HOME, getProfile } from './profile.mjs';
import { loadVideos, ANGLE_VI, HOOK_VI } from './aff_stats.mjs';
import { loadProducts, priceNum, fmtPrice, CATEGORIES } from './products.mjs';

const DAY = 864e5;
const PRIOR = { rate: .0015, k: 4000 }; // ~1,5 đơn / 1.000 view khi chưa có dữ liệu (mức thường gặp của video affiliate)
const n0 = x => +x || 0;
const withStats = () => loadVideos().videos.filter(v => v.stats && v.stats.views > 0);
const vnd = x => Math.round(x).toLocaleString('vi-VN') + 'đ';
const ago = iso => (Date.now() - new Date(iso || 0).getTime()) / DAY;

// Wilson score interval for orders/views (z = 1.28 ≈ 80 %, 1.64 ≈ 90 %)
export function wilson(k, n, z = 1.28) {
  if (!n) return { lo: 0, hi: 1, p: 0 };
  const p = Math.min(1, k / n), d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d), p };
}
// Two-rate comparison (Poisson approx.): z of group vs rest
function zRates(o1, v1, o2, v2) { if (!v1 || !v2) return 0; const p = (o1 + o2) / (v1 + v2); if (!p) return 0; return (o1 / v1 - o2 / v2) / Math.sqrt(p * (1 / v1 + 1 / v2)); }
const sure = z => (Math.abs(z) >= 1.96 ? { level: 'chac', label: 'chắc chắn (95%)' } : Math.abs(z) >= 1.28 ? { level: 'kha', label: 'khá chắc (80%)' } : { level: 'chua', label: 'chưa đủ dữ liệu' });

export function globalRate() {
  const vs = withStats(), v = vs.reduce((a, x) => a + x.stats.views, 0), o = vs.reduce((a, x) => a + n0(x.stats.orders), 0);
  return v >= 2000 ? { rate: (o + PRIOR.rate * PRIOR.k) / (v + PRIOR.k), views: v, orders: o } : { rate: PRIOR.rate, views: v, orders: o };
}

// ---------- 3. chấm điểm sản phẩm ----------
export function scoreProducts({ profile } = {}) {
  const prof = profile ? getProfile(profile) : null, cats = prof?.aff_categories?.length ? new Set(prof.aff_categories) : null;
  const all = loadVideos().videos, G = globalRate(), prods = loadProducts().products;
  const byCat = {}; for (const v of all.filter(v => v.stats?.views)) { const p = prods.find(x => x.id === v.product); const c = p?.category || '?'; const x = byCat[c] || (byCat[c] = { v: 0, o: 0 }); x.v += v.stats.views; x.o += n0(v.stats.orders); }
  const win = winners();
  return prods.filter(p => !cats || cats.has(p.category)).map(p => {
    const why = [], mine = all.filter(v => v.product === p.id), st = mine.filter(v => v.stats?.views);
    const views = st.reduce((a, v) => a + v.stats.views, 0), orders = st.reduce((a, v) => a + n0(v.stats.orders), 0);
    const c = byCat[p.category], prior = c && c.v >= 3000 ? { rate: (c.o + 1) / (c.v + 600), k: 3000 } : { rate: G.rate, k: PRIOR.k };
    const conv = (orders + prior.rate * prior.k) / (views + prior.k);
    const price = priceNum(p.price) || 0, pct = p.commission_pct === '' ? 10 : +p.commission_pct;
    if (p.commission_pct === '') why.push('chưa có % hoa hồng (tạm tính 10%)');
    const perOrder = price * pct / 100, value = conv * 1000 * perOrder; // đ hoa hồng kỳ vọng / 1.000 view
    let ready = 1;
    if (!p.media.length) { ready *= .6; why.push('chưa có ảnh/video'); }
    if (!p.usp.length) { ready *= .8; why.push('chưa có điểm nổi bật'); }
    if (!price) { ready *= .7; why.push('chưa có giá'); }
    if (!p.links.tiktok && !p.tiktok_product_id && !p.links.shopee) { ready *= .5; why.push('chưa có link affiliate'); }
    const recent = mine.filter(v => ago(v.created) < 7).length, last = mine.map(v => v.created).sort().pop();
    const sat = 1 / (1 + recent / 6), fresh = mine.length ? 1 : 1.15; // thử sản phẩm mới một chút
    if (recent >= 6) why.push(`đã làm ${recent} video tuần này`);
    if (!mine.length) why.push('chưa làm video nào — đáng thử');
    if (views >= 1000) why.push(`${(orders / views * 1000).toFixed(1)} đơn/1.000 view thực tế`);
    const pw = win.filter(w => w.product === p.id);
    if (pw.length) why.unshift(`có ${pw.length} video thắng → nhân bản`);
    const score = value * ready * sat * fresh * (pw.length ? 1.25 : 1);
    return { id: p.id, name: p.name, category: p.category, price, commission_pct: pct, per_order: Math.round(perOrder), conv, value: Math.round(value), score: Math.round(score), ready: +ready.toFixed(2),
      videos: mine.length, recent, last, views, orders, winners: pw.map(w => w.key), why };
  }).sort((a, b) => b.score - a.score);
}

// ---------- 1. video thắng ----------
export function winners({ minViews = 300, minOrders = 2 } = {}) {
  const G = globalRate(), vs = withStats();
  return vs.filter(v => v.stats.views >= minViews && n0(v.stats.orders) >= minOrders).map(v => {
    const w = wilson(n0(v.stats.orders), v.stats.views);
    return { key: v.key, product: v.product, product_name: v.product_name, angle: v.angle, hook_type: v.hook_type, platform: v.platform, profile: v.profile, project: v.project,
      source: v.source || 'ai', views: v.stats.views, orders: n0(v.stats.orders), opk: n0(v.stats.orders) / v.stats.views * 1000, lo: w.lo * 1000, lift: w.p / G.rate, cloned: v.cloned_at || null, variant_of: v.variant_of || null };
  }).filter(x => x.lo * 1 > G.rate * 1000).sort((a, b) => b.lo - a.lo);
}

// ---------- 14. học sâu ----------
const DIMS = {
  dur: { name: 'Độ dài', of: v => (v.dur ? (v.dur <= 22 ? '≤ 20 giây' : v.dur <= 35 ? '~30 giây' : v.dur <= 50 ? '~45 giây' : '≥ 60 giây') : null) },
  hour: { name: 'Giờ đăng', of: v => { const t = v.posted?.at || v.scheduled_at; if (!t) return null; const h = (new Date(t).getUTCHours() + 7) % 24; return h < 10 ? 'sáng (6–10h)' : h < 14 ? 'trưa (10–14h)' : h < 18 ? 'chiều (14–18h)' : h < 22 ? 'tối (18–22h)' : 'khuya (22–6h)'; } },
  voice: { name: 'Giọng', of: v => (v.source === 'clip' || v.source === 'live' ? 'giọng thật' : !v.voice ? null : v.voice.startsWith('clone:') ? 'giọng nhân bản' : v.voice.startsWith('edge:') ? 'giọng AI (edge)' : 'giọng máy Mac') },
  human: { name: 'Có người thật', of: v => (v.human == null ? null : v.human ? 'có người' : 'không người') },
  price_hook: { name: 'Giá trong 3 giây đầu', of: v => (v.price_hook == null ? null : v.price_hook ? 'có giá ở hook' : 'không') },
  angle: { name: 'Góc bán', of: v => (v.angle ? ANGLE_VI[v.angle] || (v.angle === 'live' ? 'cắt từ livestream' : v.angle) : null) },
  hook_type: { name: 'Kiểu hook', of: v => (v.hook_type ? HOOK_VI[v.hook_type] || v.hook_type : null) },
  platform: { name: 'Nền tảng', of: v => v.platform || null },
  profile: { name: 'Kênh', of: v => v.profile || null },
  variant: { name: 'Bản nhân', of: v => (v.variant_of ? 'bản nhân từ video thắng' : 'bản gốc') },
};
export function insights({ profile, minViews = 1000 } = {}) {
  const vs = withStats().filter(v => !profile || v.profile === profile), out = [];
  const tv = vs.reduce((a, v) => a + v.stats.views, 0), to = vs.reduce((a, v) => a + n0(v.stats.orders), 0);
  for (const [dim, D] of Object.entries(DIMS)) {
    const g = {}; for (const v of vs) { const k = D.of(v); if (!k) continue; const x = g[k] || (g[k] = { v: 0, o: 0, n: 0 }); x.v += v.stats.views; x.o += n0(v.stats.orders); x.n++; }
    const rows = Object.entries(g).map(([k, x]) => { const z = zRates(x.o, x.v, to - x.o, tv - x.v); return { key: k, n: x.n, views: x.v, orders: x.o, opk: x.v ? x.o / x.v * 1000 : 0, lift: tv && to ? (x.o / x.v) / (to / tv) : 0, z: +z.toFixed(2), ...sure(z) }; }).sort((a, b) => b.opk - a.opk);
    if (rows.length < 2) continue;
    const good = rows.filter(r => r.views >= minViews);
    out.push({ dim, name: D.name, rows });
    const best = good.find(r => r.level !== 'chua' && r.z > 0), worst = [...good].reverse().find(r => r.level !== 'chua' && r.z < 0);
    if (best) out[out.length - 1].note = `${D.name}: "${best.key}" ra đơn gấp ${best.lift.toFixed(1).replace('.', ',')} lần mức chung — ${best.label}.`;
    else if (worst) out[out.length - 1].note = `${D.name}: "${worst.key}" kém ${((1 - worst.lift) * 100).toFixed(0)}% so với mức chung — ${worst.label}.`;
  }
  return { videos: vs.length, views: tv, orders: to, dims: out, notes: out.map(d => d.note).filter(Boolean) };
}

// ---------- 14. báo cáo tuần ----------
function weekDelta(v, days = 7) {
  const h = v.history || []; if (!h.length) return { views: 0, orders: 0, commission: 0, gmv: 0 };
  const last = h[h.length - 1], since = Date.now() - days * DAY;
  const base = [...h].reverse().find(x => new Date(x.at).getTime() <= since) || (ago(v.created) <= days ? { views: 0, orders: 0, commission: 0, gmv: 0 } : h[0] === last ? last : h[0]);
  return { views: last.views - base.views, orders: last.orders - base.orders, commission: last.commission - base.commission, gmv: last.gmv - base.gmv };
}
export function weeklyReport({ save = true } = {}) {
  const all = loadVideos().videos, prods = loadProducts().products;
  const commissionOf = v => n0(v.stats?.commission) || (() => { const p = prods.find(x => x.id === v.product); return p ? n0(v.stats?.orders) * (priceNum(p.price) || 0) * (p.commission_pct === '' ? 0 : +p.commission_pct) / 100 : 0; })();
  const rows = all.filter(v => v.stats).map(v => ({ v, d: weekDelta(v), c: commissionOf(v) }));
  const wk = rows.reduce((a, r) => ({ views: a.views + r.d.views, orders: a.orders + r.d.orders, commission: a.commission + (r.d.commission || (r.v.stats.orders ? r.d.orders / r.v.stats.orders * r.c : 0)) }), { views: 0, orders: 0, commission: 0 });
  const tot = rows.reduce((a, r) => ({ views: a.views + r.v.stats.views, orders: a.orders + n0(r.v.stats.orders), commission: a.commission + r.c }), { views: 0, orders: 0, commission: 0 });
  const made = all.filter(v => ago(v.created) < 7).length;
  const top = rows.filter(r => r.d.orders > 0 || r.v.stats.orders > 0).sort((a, b) => b.d.orders - a.d.orders || n0(b.v.stats.orders) - n0(a.v.stats.orders)).slice(0, 5);
  const win = winners().slice(0, 5), ins = insights(), sc = scoreProducts().slice(0, 3);
  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `# Báo cáo affiliate tuần — ${new Date().toLocaleDateString('vi-VN')}`,
    `\n## 7 ngày qua\n- Video mới làm: **${made}**\n- Lượt xem tăng: **${Math.round(wk.views).toLocaleString('vi-VN')}**\n- Đơn mới: **${Math.round(wk.orders)}**\n- Hoa hồng ước tính: **${vnd(wk.commission)}**`,
    `\n## Từ đầu đến nay\n- ${rows.length} video có số liệu · ${tot.views.toLocaleString('vi-VN')} view · ${tot.orders} đơn · ${vnd(tot.commission)} hoa hồng${tot.views ? ` · ${(tot.orders / tot.views * 1000).toFixed(2)} đơn/1.000 view` : ''}`,
    `\n## Video ra đơn nhiều nhất tuần\n${top.length ? top.map((r, i) => `${i + 1}. ${r.v.product_name} — ${ANGLE_VI[r.v.angle] || r.v.angle || ''} · ${r.v.platform}: +${r.d.orders} đơn (tổng ${r.v.stats.orders}), ${r.v.stats.views.toLocaleString('vi-VN')} view`).join('\n') : '_Chưa có — nhập số liệu ở tab Hiệu quả._'}`,
    `\n## Video thắng nên nhân bản\n${win.length ? win.map(w => `- ${w.product_name} · ${ANGLE_VI[w.angle] || w.angle} · hook ${HOOK_VI[w.hook_type] || w.hook_type}: ${w.opk.toFixed(1)} đơn/1.000 view (gấp ${w.lift.toFixed(1).replace('.', ',')} lần)${w.cloned ? ' — đã nhân bản' : ''}`).join('\n') : '_Chưa có video vượt trội đủ chắc chắn._'}`,
    `\n## Điều đã học\n${ins.notes.length ? ins.notes.map(x => '- ' + x).join('\n') : '_Cần thêm số liệu (mỗi nhóm ≥ 1.000 view) để kết luận._'}`,
    `\n## Tuần tới nên làm\n${sc.map(s => `- **${s.name}** — ~${vnd(s.value)} hoa hồng/1.000 view${s.why.length ? ` (${s.why.slice(0, 2).join('; ')})` : ''}`).join('\n') || '_Thêm sản phẩm vào thư viện._'}`,
  ].join('\n');
  let file = null;
  if (save) { file = path.join(AVS_HOME, 'affiliate/reports', `${date}.md`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, md + '\n'); }
  return { date, week: wk, total: tot, made, top: top.map(r => ({ key: r.v.key, name: r.v.product_name, orders: r.d.orders })), winners: win, notes: ins.notes, next: sc, md, file };
}

// ---------- 11. kế hoạch hôm nay ----------
// quota video/ngày cho 1 kênh: ưu tiên nhân bản video thắng (≤ 1/3), còn lại làm mới theo điểm sản phẩm.
export function todayPlan({ profile, quota } = {}) {
  const prof = getProfile(profile), Q = +(quota || prof.aff_daily || 6), plats = prof.aff_platforms?.length ? prof.aff_platforms : ['tiktok'];
  const items = []; let left = Q;
  const win = winners().filter(w => (!w.profile || w.profile === prof.id) && (!w.cloned || ago(w.cloned) > 7) && !w.variant_of && w.source === 'ai' && w.project);
  for (const w of win) { if (left <= Q * 2 / 3 - .01 || left < 2) break; const n = Math.min(3, left); items.push({ type: 'clone', video: w.key, product: w.product, name: w.product_name, n, why: `video thắng: ${w.opk.toFixed(1)} đơn/1.000 view, gấp ${w.lift.toFixed(1)} lần mức chung` }); left -= n; }
  for (const s of scoreProducts({ profile: prof.id })) {
    if (left <= 0) break; if (s.ready < .5) continue;
    const hooks = 2, angles = Math.max(1, Math.min(2, Math.floor(left / (hooks * plats.length)))), n = angles * hooks * plats.length;
    items.push({ type: 'make', product: s.id, name: s.name, angles, hooks, platforms: plats, n, why: `~${vnd(s.value)} hoa hồng/1.000 view${s.why.length ? ' · ' + s.why.slice(0, 2).join('; ') : ''}` });
    left -= n;
  }
  return { date: new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), profile: prof.id, profile_name: prof.name, quota: Q, videos: Q - Math.max(0, left), items };
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const cmd = a[0] || 'score';
  if (cmd === 'score') { for (const s of scoreProducts({ profile: opt('--profile') })) console.log(`${String(s.score).padStart(8)}  ${s.name.slice(0, 40).padEnd(40)} ${vnd(s.value)}/1k view · ${s.why.join('; ')}`); return; }
  if (cmd === 'winners') { console.log(JSON.stringify(winners(), null, 1)); return; }
  if (cmd === 'insights') { const r = insights({ profile: opt('--profile') }); console.log(r.notes.join('\n') || '(chưa đủ dữ liệu)'); if (a.includes('--json')) console.log(JSON.stringify(r, null, 1)); return; }
  if (cmd === 'weekly') { const r = weeklyReport(); console.log(r.md); if (a.includes('--notify')) { const { notify } = await import('./notify.mjs'); notify('Báo cáo affiliate tuần', `${r.week.orders} đơn · ${vnd(r.week.commission)} hoa hồng`, { open: r.file }); } return; }
  if (cmd === 'plan') { console.log(JSON.stringify(todayPlan({ profile: opt('--profile'), quota: opt('--quota') }), null, 1)); return; }
  throw new Error('lệnh: score | winners | insights | weekly [--notify] | plan [--profile id] [--quota 6]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
export { CATEGORIES, fmtPrice };
