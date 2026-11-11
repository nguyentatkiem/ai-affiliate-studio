// Livestream bán hàng (video dài) → nhiều clip ngắn 9:16 có gắn sản phẩm: highlights.mjs chọn đoạn hay → mỗi đoạn gắn thẻ giá +
// nhãn giỏ hàng (aff_overlay.mjs), soát lời nói, xuất MP4 + ảnh bìa + bộ đăng, ghi vào sổ video để học từ đơn hàng.
// usage: node scripts/aff_live.mjs <video> --product <id> [--n 5] [--platform tiktok] [--out <dir>] [--min 20 --max 60]
// Spec: references/affiliate.md §Livestream. Output "@@ <0..1> …", "PROJECT <dir>", "RESULT {json}".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sh, say, exportProject, slug } from './highlights.mjs';
import { AVS_HOME } from './profile.mjs';
import { getProduct } from './products.mjs';
import { applyAffOverlays } from './aff_overlay.mjs';
import { buildKit, writeKit } from './aff_kit.mjs';
import { registerVideo } from './aff_stats.mjs';
import { notify } from './notify.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

async function main() {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const src = a[0] && path.resolve(a[0]), p = getProduct(opt('--product'));
  if (!src || !fs.existsSync(src)) throw new Error('cách dùng: node scripts/aff_live.mjs <video livestream> --product <id> [--n 5] [--platform tiktok]');
  if (!p) throw new Error(`Không thấy sản phẩm "${opt('--product')}" — thêm vào thư viện trước`);
  const platform = opt('--platform', 'tiktok') === 'facebook' ? 'facebook' : 'tiktok';
  const out = path.resolve(opt('--out', path.join(AVS_HOME, 'affiliate/live', `${slug(path.basename(src, path.extname(src)))}-${p.id}`)));
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
    say(base, `Clip ${i + 1}/${list.length}: gắn sản phẩm`);
    const tl = rd(path.join(h.dir, 'timeline.json')); delete tl._starter; tl.caption_style = 'review'; tl.pack = 'affiliate';
    tl._aff = { ...(tl._aff || {}), angle: 'live', hook: { type: 'live', say: h.hook }, title: h.title, caption: `${h.hook || h.title}`, hashtags: ['livestream', 'review', platform === 'facebook' ? 'reels' : 'tiktokshop'] };
    fs.writeFileSync(path.join(h.dir, 'timeline.json'), JSON.stringify(tl, null, 1));
    const r = applyAffOverlays(h.dir, p, { platform });
    let mp4 = path.join(h.dir, 'out', `clip-${i + 1}.mp4`);
    if (!fs.existsSync(mp4)) { const o = await exportProject(h.dir, { onProgress: (k, s) => say(base + span * .9 * k, `Clip ${i + 1}/${list.length}: xuất (${s}) ${Math.round(k * 100)}%`) }); fs.renameSync(o, mp4); }
    const cover = path.join(h.dir, 'out', `clip-${i + 1}-anh-bia.jpg`);
    await sh('node', [path.join(HERE, 'render.mjs'), path.join(h.dir, 'timeline.json'), cover, '--still', '1', cover]).catch(() => {});
    const kit = buildKit(rd(path.join(h.dir, 'timeline.json')), p, platform, { aiVoice: false }); writeKit(h.dir, kit);
    registerVideo({ key: `${path.basename(out)}/clip-${i + 1}`, file: mp4, product: p.id, product_name: p.name, angle: 'live', hook_type: 'live', platform, title: h.title, caption: kit.caption });
    done.push({ title: h.title, mp4, cover: fs.existsSync(cover) ? cover : null, kit: path.join(h.dir, `publish/kit_${platform}.txt`), issues: r.issues.map(x => `${x.rule} («${x.hit}»)`) });
  }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ product: p.id, source: src, platform, clips: done }, null, 1));
  notify('Livestream → clip xong', `${p.name}: ${done.length} clip`);
  say(1, 'Xong');
  console.log('RESULT ' + JSON.stringify({ out, outputs: [out, ...done.map(d => d.mp4)], clips: done.length }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
