// Hình cho video affiliate, ngoài ảnh shop:
//   deriveProduct(p): ảnh sản phẩm → PNG tách nền (cảnh aff_hero trên nền màu thương hiệu) + ảnh cận cảnh chi tiết (nhãn, kết cấu…)
//                     lưu ở products/<id>/derived/, chỉ làm lại khi ảnh gốc đổi. Python: scripts/product_media.py.
//   Kho b-roll CỦA TÔI: quay một lần các cảnh dùng chung (mở hộp, cầm lên, phản ứng…) → affiliate/broll/<nhãn>/,
//                     Tự lái chèn xen vào video không quay để có người thật.
// Spec: references/affiliate.md §Hình. CLI: node scripts/aff_media.mjs derive <product-id> | broll [list]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AVS_HOME } from './profile.mjs';
import { sh, PY } from './highlights.mjs';
import { getProduct, mediaAbs, productDir } from './products.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VID = /\.(mp4|mov|m4v|webm|mkv)$/i;

export async function deriveProduct(p, { details = 2, say = () => {} } = {}) {
  const dd = path.join(productDir(p.id), 'derived'); fs.mkdirSync(dd, { recursive: true });
  const out = { cutouts: [], details: [] }, imgs = p.media.filter(m => m.kind === 'image');
  for (const [i, m] of imgs.entries()) {
    const src = mediaAbs(p, m); if (!fs.existsSync(src)) continue;
    const base = path.join(dd, path.basename(m.file).replace(/\.\w+$/, '')), mt = fs.statSync(src).mtimeMs;
    const meta = base + '.json'; let j = null; try { j = JSON.parse(fs.readFileSync(meta, 'utf8')); } catch {}
    if (!j || j.mtime !== mt) {
      say(i / imgs.length, `Tách nền + tìm cận cảnh ảnh ${i + 1}/${imgs.length}`);
      j = { mtime: mt, cut: null, details: [] };
      try { const r = JSON.parse((await sh(PY, ['-I', path.join(HERE, 'product_media.py'), 'cutout', src, base + '.cut.png'])).trim().split('\n').pop()); if (r.ok) j.cut = { file: path.basename(base) + '.cut.png', method: r.method }; } catch (e) { j.cutErr = e.message.slice(0, 160); }
      if (i < 2 && details) { // the first two photos are usually the hero + label shots
        try { const r = JSON.parse((await sh(PY, ['-I', path.join(HERE, 'product_media.py'), 'details', src, base + '.det', '--n', String(details)])).trim().split('\n').pop()); j.details = r.crops.map((c, k) => ({ file: `${path.basename(base)}.det-${k + 1}.jpg`, box: c })); } catch {}
      }
      fs.writeFileSync(meta, JSON.stringify(j));
    }
    if (j.cut && fs.existsSync(path.join(dd, j.cut.file))) out.cutouts.push(path.join(dd, j.cut.file));
    for (const d of j.details || []) if (fs.existsSync(path.join(dd, d.file))) out.details.push(path.join(dd, d.file));
  }
  return out;
}

// ---------- kho b-roll của tôi ----------
export const BROLL_DIR = path.join(AVS_HOME, 'affiliate/broll');
export const BROLL_TAGS = {
  'mo-hop': 'Mở hộp, bóc hàng', 'cam-len': 'Cầm sản phẩm lên, xoay', 'phan-ung': 'Phản ứng: gật đầu, ngạc nhiên, cười',
  'chi-tay': 'Chỉ tay xuống (giỏ hàng)', 'go-dien-thoai': 'Gõ điện thoại, đặt hàng', 'dung-thu': 'Dùng thử, thoa, bật máy', khac: 'Khác',
};
export function listBroll() {
  const out = {};
  for (const t of Object.keys(BROLL_TAGS)) { const d = path.join(BROLL_DIR, t); out[t] = fs.existsSync(d) ? fs.readdirSync(d).filter(f => VID.test(f)).map(f => ({ tag: t, file: f, path: path.join(d, f) })) : []; }
  return out;
}
export const brollCount = () => Object.values(listBroll()).reduce((a, l) => a + l.length, 0);
export async function addBroll(tag, name, stream) {
  if (!BROLL_TAGS[tag]) throw new Error('nhãn b-roll lạ: ' + tag);
  name = path.basename(String(name || 'clip.mp4')).replace(/[^\w.\-À-ỹ ()]+/g, '_'); if (!VID.test(name)) throw new Error('Chỉ nhận tệp video');
  const d = path.join(BROLL_DIR, tag); fs.mkdirSync(d, { recursive: true });
  const dst = path.join(d, `${Date.now().toString(36)}_${name}`);
  await new Promise((ok, bad) => { const w = fs.createWriteStream(dst); stream.pipe(w); w.on('finish', ok); w.on('error', bad); });
  return { tag, file: path.basename(dst), path: dst };
}
export function removeBroll(tag, file) { const f = path.join(BROLL_DIR, tag, path.basename(file)); if (fs.existsSync(f)) fs.rmSync(f); return true; }
// deterministic pick so re-running a job gives the same video; seed varies per video
export function pickBroll(tag, seed = 0) { const l = listBroll()[tag] || []; return l.length ? l[Math.abs(seed) % l.length] : null; }

async function main() {
  const a = process.argv.slice(2);
  if (a[0] === 'derive') { const p = getProduct(a[1]); if (!p) throw new Error('không thấy sản phẩm'); console.log(JSON.stringify(await deriveProduct(p, { say: (k, m) => console.log(`@@ ${k.toFixed(2)} ${m}`) }), null, 1)); return; }
  if (a[0] === 'broll') { console.log(JSON.stringify(listBroll(), null, 1)); return; }
  throw new Error('lệnh: derive <product-id> | broll');
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
