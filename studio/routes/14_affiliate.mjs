// Affiliate (references/affiliate.md): thư viện Sản phẩm, Tự lái affiliate (qua hàng đợi nền của 15_autopilot), kết quả theo sản phẩm,
// đăng bán tự động (mở trang đăng + chép caption + hiện file), số liệu đơn hàng.
//   GET  /api/aff/meta · /api/aff/products · /api/aff/file?p=<id>&f=<rel> · /api/aff/jobs · /api/aff/stats
//   POST /api/aff/product {product} · /api/aff/product/delete {id} · /api/aff/fetch {url} · /api/aff/import?name= (body = csv/xlsx)
//   POST /api/aff/media/upload?p=&name= (body = file) · /api/aff/media/remove {id, file}
//   POST /api/aff/run {product, profile?, angles?, hooks?, platforms?, dur?, angle?, voice?, schedule?, out?, restart?}
//   POST /api/aff/open {dir} · /api/aff/reveal {path} · /api/aff/post {project, platform} · /api/aff/stats/import?name= · /api/aff/stats/set {key, …}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AVS_HOME, addItem, loadQueue } from '../../scripts/queue.mjs';
import { loadProducts, getProduct, upsertProduct, deleteProduct, addMediaStream, removeMedia, downloadMedia, fetchProductPage, importSheet, productDir, CATEGORIES, discountPct, fmtPrice } from '../../scripts/products.mjs';
import { ANGLES, HOOKS } from '../../scripts/aff_script.mjs';
import { ANGLE_BLOCK } from '../../scripts/aff_compliance.mjs';
import { VOICES } from '../../scripts/aff_video.mjs';
import { STEPS } from '../../scripts/autopilot_aff.mjs';
import { report, learnedPrefs, importStats, setStats, loadVideos } from '../../scripts/aff_stats.mjs';
import { PLATFORMS as PUB } from '../../scripts/publish.mjs';
import { openPath, revealPath, copyText } from '../../scripts/platform.mjs';

const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const JOBS = path.join(AVS_HOME, 'affiliate/jobs');
const inside = (root, f) => { const r = path.resolve(f); return r === root || r.startsWith(root + path.sep) ? r : null; };
const saveBody = (req, dst) => new Promise((ok, bad) => { const w = fs.createWriteStream(dst); req.pipe(w); w.on('finish', ok); w.on('error', bad); });

function jobs() {
  if (!fs.existsSync(JOBS)) return [];
  const q = loadQueue().items.filter(x => x.kind === 'aff');
  return fs.readdirSync(JOBS).map(n => path.join(JOBS, n)).filter(d => fs.existsSync(path.join(d, '.aff/state.json'))).map(d => {
    const st = rd(path.join(d, '.aff/state.json')), sum = rd(path.join(d, 'summary.json'));
    const qi = q.filter(x => x.project === d || (x.input === st.product && x.state === 'running')).pop();
    return {
      dir: d, product: st.product, state: st.state, error: st.error || null, started: st.started, finished: st.finished || null, opts: st.opts, warnings: st.warnings || [], learned: st.learned || [],
      steps: STEPS.map(([k, label, , req]) => ({ id: k, label, req: !!req, ...(st.steps[k] || {}) })), progress: qi?.state === 'running' ? qi.progress : null, step: qi?.state === 'running' ? qi.step : null,
      videos: (sum?.videos || st.videos || []).map(v => ({ ...v, project: v.project || v.dir, angle_name: ANGLES[v.angle]?.name || v.angle, thumb: fs.existsSync(path.join(v.project || v.dir, '.studio/thumb.jpg')) ? path.join(v.project || v.dir, '.studio/thumb.jpg') : null })),
    };
  }).sort((a, b) => String(b.started).localeCompare(String(a.started)));
}

export default ctx => async (req, res, p, u) => {
  if (!p.startsWith('/api/aff/')) return false;
  const J = (o, c) => (ctx.json(res, o, c), true);
  try {
    if (req.method === 'GET') {
      if (p === '/api/aff/meta') return J({ angles: ANGLES, hooks: HOOKS, angle_block: ANGLE_BLOCK, categories: CATEGORIES, voices: VOICES, steps: STEPS.map(([id, label]) => ({ id, label })), home: AVS_HOME });
      if (p === '/api/aff/products') return J({ products: loadProducts().products.map(x => ({ ...x, discount: discountPct(x), price_txt: fmtPrice(x.price), old_txt: fmtPrice(x.old_price) })) });
      if (p === '/api/aff/file') { // product media + job outputs (thumbs, covers, mp4) — only inside AVS_HOME
        const f = u.searchParams.get('path') ? inside(AVS_HOME, u.searchParams.get('path')) : inside(productDir(u.searchParams.get('p') || '_'), path.join(productDir(u.searchParams.get('p') || '_'), u.searchParams.get('f') || ''));
        if (!f || !fs.existsSync(f)) return J({ error: 'không thấy file' }, 404);
        ctx.sendFile(req, res, f); return true;
      }
      if (p === '/api/aff/jobs') return J({ jobs: jobs() });
      if (p === '/api/aff/stats') { const prof = u.searchParams.get('profile') || undefined; return J({ report: report({ profile: prof }), learned: learnedPrefs(prof), imports: loadVideos().imports || [], videos: loadVideos().videos.length }); }
      return false;
    }
    if (req.method !== 'POST') return false;
    if (p === '/api/aff/media/upload') {
      const id = u.searchParams.get('p'); if (!getProduct(id)) return J({ error: 'không thấy sản phẩm' }, 404);
      return J({ ok: true, product: await addMediaStream(id, u.searchParams.get('name') || 'file.jpg', req) });
    }
    if (p === '/api/aff/clip') { // a filmed clip (review/unbox) or a livestream recording for a product → queue
      const prod = getProduct(u.searchParams.get('p')); if (!prod) return J({ error: 'không thấy sản phẩm' }, 404);
      const name = path.basename(u.searchParams.get('name') || 'clip.mp4').replace(/[^\w.\-À-ỹ ()]+/g, '_');
      if (!/\.(mp4|mov|m4v|mkv|webm)$/i.test(name)) return J({ error: 'Chỉ nhận tệp video' }, 400);
      const dir = path.join(AVS_HOME, 'affiliate/inbox'); fs.mkdirSync(dir, { recursive: true });
      const dst = path.join(dir, `${Date.now().toString(36)}_${name}`); await saveBody(req, dst);
      const platform = u.searchParams.get('platform') === 'facebook' ? 'facebook' : 'tiktok', live = u.searchParams.get('mode') === 'live';
      const it = live ? addItem({ kind: 'afflive', input: dst, opts: { product: prod.id, platform, n: +(u.searchParams.get('n') || 5) }, source: 'ui' })
        : addItem({ kind: 'autopilot', input: dst, opts: { product: prod.id, platform, profile: u.searchParams.get('profile') || undefined }, source: 'ui' });
      return J({ ok: true, item: it });
    }
    if (p === '/api/aff/import' || p === '/api/aff/stats/import') {
      const name = path.basename(u.searchParams.get('name') || 'bang.csv'); if (!/\.(csv|xlsx)$/i.test(name)) return J({ error: 'Chỉ nhận file .csv hoặc .xlsx' }, 400);
      const dst = path.join(os.tmpdir(), `aff_${Date.now()}_${name.replace(/[^\w.\-]+/g, '_')}`); await saveBody(req, dst);
      try {
        if (p === '/api/aff/import') { const r = await importSheet(dst); return J({ ok: true, added: r.added.length, map: r.map }); }
        return J({ ok: true, ...importStats(dst, { platform: u.searchParams.get('platform') || undefined }) });
      } finally { fs.rmSync(dst, { force: true }); }
    }
    const b = await ctx.body(req);
    if (p === '/api/aff/product') return J({ ok: true, product: upsertProduct(b.product || {}) });
    if (p === '/api/aff/product/delete') { deleteProduct(b.id); return J({ ok: true }); }
    if (p === '/api/aff/fetch') {
      const url = String(b.url || '').trim(); if (!/^https?:\/\//.test(url)) return J({ error: 'Dán link bắt đầu bằng http(s)://' }, 400);
      const info = await fetchProductPage(url);
      const prod = upsertProduct({ ...(b.id ? { id: b.id } : {}), name: info.name || b.name || 'Sản phẩm mới', price: info.price || '', brand: info.brand || '', notes: info.notes || '', links: info.links, tiktok_product_id: info.tiktok_product_id || '' });
      let n = 0; for (const img of info.images) { try { await downloadMedia(prod.id, img); n++; } catch {} }
      return J({ ok: true, product: getProduct(prod.id), images: n, warn: info.warn || null });
    }
    if (p === '/api/aff/media/remove') return J({ ok: true, product: removeMedia(b.id, b.file) });
    if (p === '/api/aff/run') {
      const prod = getProduct(b.product); if (!prod) return J({ error: 'không thấy sản phẩm' }, 404);
      const opts = {}; for (const k of ['profile', 'angles', 'hooks', 'dur', 'voice', 'schedule', 'restart']) if (b[k] != null && b[k] !== '') opts[k] = b[k];
      if (Array.isArray(b.platforms) && b.platforms.length) opts.platforms = b.platforms.join(',');
      if (Array.isArray(b.angle) && b.angle.length) opts.angle = b.angle.join(',');
      if (b.out) opts.out = path.resolve(String(b.out).replace(/^~(?=[\\/])/, os.homedir()));
      const it = addItem({ kind: 'aff', input: prod.id, opts, source: 'ui' }); it.title = prod.name;
      return J({ ok: true, item: it });
    }
    if (p === '/api/aff/open') {
      const d = inside(AVS_HOME, b.dir || ''); if (!d || !fs.existsSync(path.join(d, 'timeline.json'))) return J({ error: 'không thấy dự án' }, 404);
      ctx.openProject(d); return J({ ok: true });
    }
    if (p === '/api/aff/reveal') { // AVS_HOME, or a delivery folder a job wrote to (--out)
      const outs = jobs().map(j => rd(path.join(j.dir, 'summary.json'))?.delivered).filter(Boolean);
      const f = inside(AVS_HOME, b.path || '') || outs.map(o => inside(o, b.path || '')).find(Boolean);
      if (!f || !fs.existsSync(f)) return J({ error: 'không thấy' }, 404); (b.open ? openPath : revealPath)(f); return J({ ok: true });
    }
    if (p === '/api/aff/post') { // semi-automatic posting: caption → clipboard, open the upload page, show the MP4 in Finder
      const d = inside(AVS_HOME, b.project || ''), pl = b.platform === 'facebook' ? 'facebook' : 'tiktok';
      const kit = d && rd(path.join(d, `publish/kit_${pl}.json`)); if (!kit) return J({ error: 'Chưa có bộ đăng cho video này' }, 404);
      const mp4 = fs.readdirSync(path.join(d, 'out')).filter(f => f.endsWith('.mp4')).map(f => path.join(d, 'out', f))[0];
      const copied = await copyText(`${kit.caption}\n\n${kit.hashtags.join(' ')}`);
      openPath(PUB[pl].url); if (mp4) revealPath(mp4);
      return J({ ok: true, copied, kit });
    }
    if (p === '/api/aff/copy') return J({ ok: await copyText(String(b.text || '')) });
    if (p === '/api/aff/stats/set') return J({ ok: true, video: setStats(b.key, b) });
  } catch (e) { return J({ error: e.message }, 500); }
  return false;
};
