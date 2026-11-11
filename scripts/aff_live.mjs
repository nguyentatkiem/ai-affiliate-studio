// Livestream bán hàng (video dài) → nhiều clip ngắn 9:16 có gắn sản phẩm: highlights.mjs chọn đoạn hay → mỗi đoạn gắn thẻ giá +
// nhãn giỏ hàng (aff_overlay.mjs), soát lời nói, xuất MP4 + ảnh bìa + bộ đăng, ghi vào sổ video để học từ đơn hàng.
// usage: node scripts/aff_live.mjs <video> --product <id> [--n 5] [--platform tiktok] [--out <dir>] [--min 20 --max 60]
//        node scripts/aff_live.mjs <video> --products a,b,c|all [--n 8]   (live bán NHIỀU sản phẩm: mỗi clip tự nhận đang nói về sản phẩm nào)
// Spec: references/affiliate.md §Livestream. Output "@@ <0..1> …", "PROJECT <dir>", "RESULT {json}".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sh, say, exportProject, slug } from './highlights.mjs';
import { AVS_HOME } from './profile.mjs';
import { getProduct, loadProducts } from './products.mjs';
import { applyAffOverlays } from './aff_overlay.mjs';
import { buildKit, writeKit } from './aff_kit.mjs';
import { registerVideo, fingerprint } from './aff_stats.mjs';
import { codeFor } from './aff_track.mjs';
import { complianceLog } from './aff_qc.mjs';
import { notify } from './notify.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ');
const GENERIC = new Set(['san', 'pham', 'cho', 'va', 'cua', 'the', 'loai', 'chinh', 'hang', 'ban', 'moi', 'set', 'combo', 'hop', 'chai', 'goi', 'tui', 'size', 'mau', 'ml', 'gr', 'kg', 'cai', 'bo']);
// which product is this clip talking about? name/brand words (×3), selling points (×1) found in the spoken text
export function matchProduct(text, prods) {
  const t = ` ${fold(text)} `;
  const scored = prods.map(p => {
    const name = fold(`${p.name} ${p.brand}`).split(/\s+/).filter(w => w.length > 2 && !GENERIC.has(w)), usp = fold(p.usp.join(' ')).split(/\s+/).filter(w => w.length > 3 && !GENERIC.has(w));
    const hit = ws => [...new Set(ws)].filter(w => t.includes(` ${w} `)).length;
    return { p, s: hit(name) * 3 + hit(usp) };
  }).sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s >= 3 && (!scored[1] || scored[0].s > scored[1].s) ? scored[0] : null;
}

async function main() {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const src = a[0] && path.resolve(a[0]);
  const ids = opt('--products'), multi = ids ? (ids === 'all' ? loadProducts().products : ids.split(',').map(getProduct).filter(Boolean)) : null;
  const p = multi ? multi[0] : getProduct(opt('--product'));
  if (!src || !fs.existsSync(src)) throw new Error('cách dùng: node scripts/aff_live.mjs <video livestream> --product <id> | --products a,b,c|all [--n 5] [--platform tiktok]');
  if (!p) throw new Error(`Không thấy sản phẩm "${opt('--product') || ids}" — thêm vào thư viện trước`);
  const platform = opt('--platform', 'tiktok') === 'facebook' ? 'facebook' : 'tiktok';
  const out = path.resolve(opt('--out', path.join(AVS_HOME, 'affiliate/live', `${slug(path.basename(src, path.extname(src)))}-${multi ? 'nhieu-sp' : p.id}`)));
  fs.mkdirSync(out, { recursive: true }); console.log('PROJECT ' + out);
  // 1. pick moments (resumable: highlights.json already there → reuse)
  let list = rd(path.join(out, 'highlights.json'));
  if (!list?.length) {
    await sh('node', [path.join(HERE, 'highlights.mjs'), src, '--out', out, '--n', String(opt('--n', 5)), '--min', String(opt('--min', 20)), '--max', String(opt('--max', 60)), '--orient', 'vertical'],
      { onLine: l => { const m = /^@@ ([\d.]+) (.*)$/.exec(l); if (m) say(+m[1] * .45, 'Chọn đoạn: ' + m[2]); } });
    list = rd(path.join(out, 'highlights.json')) || [];
  }
  if (!list.length) throw new Error('Không tìm được đoạn nào đủ hay trong video');
  // 2. each clip: affiliate overlays → export → cover → kit
  const done = [];
  for (const [i, h] of list.entries()) {
    const base = .45 + .55 * i / list.length, span = .55 / list.length;
    const tl = rd(path.join(h.dir, 'timeline.json'));
    let cp = p, why = '';
    if (multi) { // spoken text of this clip → the product it is about (no clear match → skip: a wrong cart loses trust)
      const cf = typeof tl.captions === 'string' ? path.join(h.dir, tl.captions) : null, caps = (cf && rd(cf)) || (Array.isArray(tl.captions) ? tl.captions : []);
      const m = matchProduct(`${h.title || ''} ${h.hook || ''} ${caps.map(c => (c.words || []).map(w => w.w).join(' ')).join(' ')}`, multi);
      if (!m) { done.push({ title: h.title, skipped: 'không nhận ra sản phẩm nào trong đoạn này' }); continue; }
      cp = m.p; why = ` (nhận ra: ${cp.name.slice(0, 30)})`;
    }
    say(base, `Clip ${i + 1}/${list.length}: gắn sản phẩm${why}`); delete tl._starter; tl.caption_style = 'review'; tl.pack = 'affiliate';
    tl._aff = { ...(tl._aff || {}), angle: 'live', hook: { type: 'live', say: h.hook }, title: h.title, caption: `${h.hook || h.title}`, hashtags: ['livestream', 'review', platform === 'facebook' ? 'reels' : 'tiktokshop'] };
    fs.writeFileSync(path.join(h.dir, 'timeline.json'), JSON.stringify(tl, null, 1));
    const r = applyAffOverlays(h.dir, cp, { platform });
    let mp4 = path.join(h.dir, 'out', `clip-${i + 1}.mp4`);
    if (!fs.existsSync(mp4)) { const o = await exportProject(h.dir, { onProgress: (k, s) => say(base + span * .9 * k, `Clip ${i + 1}/${list.length}: xuất (${s}) ${Math.round(k * 100)}%`) }); fs.renameSync(o, mp4); }
    const cover = path.join(h.dir, 'out', `clip-${i + 1}-anh-bia.jpg`);
    await sh('node', [path.join(HERE, 'render.mjs'), path.join(h.dir, 'timeline.json'), cover, '--still', '1', cover]).catch(() => {});
    const key = `${path.basename(out)}/clip-${i + 1}`, code = codeFor(key), tl2 = rd(path.join(h.dir, 'timeline.json'));
    const kit = buildKit(tl2, cp, platform, { aiVoice: false, code }); writeKit(h.dir, kit); complianceLog(h.dir, cp, { platform });
    registerVideo({ key, code, file: mp4, project: h.dir, product: cp.id, product_name: cp.name, angle: 'live', hook_type: 'live', platform, title: h.title, caption: kit.caption, source: 'live', human: true, dur: tl2.duration,
      fp: fingerprint([h.hook || '', h.title || ''], [path.basename(src) + '#' + i]) });
    done.push({ product: cp.id, product_name: cp.name, title: h.title, mp4, cover: fs.existsSync(cover) ? cover : null, kit: path.join(h.dir, `publish/kit_${platform}.txt`), issues: r.issues.map(x => `${x.rule} («${x.hit}»)`) });
  }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ product: multi ? multi.map(x => x.id) : p.id, source: src, platform, clips: done }, null, 1));
  const made = done.filter(d => d.mp4);
  notify('Livestream → clip xong', `${multi ? `${new Set(made.map(d => d.product)).size} sản phẩm` : p.name}: ${made.length} clip${done.length > made.length ? `, bỏ ${done.length - made.length} đoạn không rõ sản phẩm` : ''}`);
  say(1, 'Xong');
  console.log('RESULT ' + JSON.stringify({ out, outputs: [out, ...made.map(d => d.mp4)], clips: made.length }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
