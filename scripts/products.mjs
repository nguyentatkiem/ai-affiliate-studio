// Thư viện SẢN PHẨM cho video affiliate: ~/.ai-affiliate-studio/products.json + media mỗi sản phẩm ở products/<id>/.
// Spec: references/affiliate.md. CLI:
//   node scripts/products.mjs list [--json] | show <id> | rm <id>
//   node scripts/products.mjs add --name "…" [--price 199000] [--old 299000] [--tiktok <link|id>] [--shopee <link>] [--usp "a|b"] [--pains "a|b"]
//                                 [--category my-pham] [--commission 12] [--media a.jpg,b.mp4]
//   node scripts/products.mjs import <file.csv|.xlsx>          (file xuất từ trung tâm affiliate hoặc bảng tự làm)
//   node scripts/products.mjs fetch <url>                      (đọc tên/ảnh/giá công khai của trang sản phẩm, được gì lấy nấy)
//   node scripts/products.mjs media <id> <file…>               (thêm ảnh/video cho sản phẩm)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AVS_HOME } from './profile.mjs';
import { parseSheet } from './batch.mjs';

const FILE = path.join(AVS_HOME, 'products.json');
export const PRODUCTS_DIR = path.join(AVS_HOME, 'products');
export const IMG = /\.(jpe?g|png|webp)$/i, VID = /\.(mp4|mov|m4v|webm|mkv)$/i;
export const CATEGORIES = {
  'my-pham': 'Mỹ phẩm, chăm sóc da', 'thuc-pham': 'Thực phẩm, đồ uống', 'tpcn': 'Thực phẩm chức năng', 'gia-dung': 'Gia dụng, nhà bếp',
  'thoi-trang': 'Thời trang, phụ kiện', 'dien-tu': 'Điện tử, công nghệ', 'me-be': 'Mẹ và bé', 'the-thao': 'Thể thao, sức khoẻ', 'khac': 'Khác',
};

export const EMPTY = {
  id: '', name: '', category: 'khac', brand: '',
  price: '', old_price: '', commission_pct: '', currency: 'đ',
  links: { tiktok: '', shopee: '', lazada: '', other: '' }, tiktok_product_id: '',
  usp: [], pains: [], audience: '', specs: [],
  claims_ok: [], claims_ban: [],  // điều được phép nói / cấm nói thêm (ngoài luật chung theo ngành)
  voucher: '', deal_until: '', notes: '', media: [], created: '', updated: '',
  reviews: null, // aff_reviews.mjs: {quotes, praises, objections, faqs, words, count, mined_at} — lời khách thật
};

const slug = s => String(s || 'san-pham').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'san-pham';
const list = v => (Array.isArray(v) ? v : String(v ?? '').split(/\s*[|;\n]\s*/)).map(x => String(x).trim()).filter(Boolean);
function writeAtomic(f, obj) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(obj, null, 1)); fs.renameSync(t, f); }

// "199.000đ", "199k", "1,2tr", 199000 → 199000 (number) · '' when unknown
export function priceNum(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return v;
  const s = String(v).toLowerCase().replace(/\s/g, '');
  const m = /([\d.,]+)(k|tr|triệu|m)?/.exec(s); if (!m) return '';
  let n = m[1];
  if (m[2]) n = +n.replace(',', '.') * (m[2] === 'k' ? 1e3 : 1e6);
  else n = +n.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  return isFinite(n) && n > 0 ? Math.round(n) : '';
}
// 199000 → "199.000đ"
export const fmtPrice = (n, cur = 'đ') => (n === '' || n == null ? '' : `${Math.round(+n).toLocaleString('vi-VN').replace(/,/g, '.')}${cur}`);
// 199000 → "199k", 1290000 → "1,29 triệu" (cách đọc tự nhiên cho lời thoại)
export const sayPrice = n => { n = priceNum(n); if (!n) return ''; return n < 1e6 ? `${Math.round(n / 1000)}k` : `${(Math.round(n / 1e4) / 100).toString().replace('.', ',')} triệu`; };
export const discountPct = p => { const a = priceNum(p.price), b = priceNum(p.old_price); return a && b && b > a ? Math.round((1 - a / b) * 100) : 0; };

export function loadProducts() {
  let s; try { s = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { s = null; }
  if (!s || !Array.isArray(s.products)) s = { version: 1, products: [] };
  s.products = s.products.map(p => normalize(p));
  return s;
}
const saveProducts = s => writeAtomic(FILE, s);
export function normalize(p) {
  const o = { ...EMPTY, ...p, links: { ...EMPTY.links, ...(p.links || {}) } };
  for (const k of ['usp', 'pains', 'specs', 'claims_ok', 'claims_ban']) o[k] = list(o[k]);
  o.price = priceNum(o.price); o.old_price = priceNum(o.old_price);
  o.commission_pct = o.commission_pct === '' || o.commission_pct == null ? '' : +String(o.commission_pct).replace(/[^\d.,]/g, '').replace(',', '.') || '';
  if (!CATEGORIES[o.category]) o.category = guessCategory(`${o.category} ${o.name}`);
  if (!o.tiktok_product_id) o.tiktok_product_id = tiktokId(o.links.tiktok);
  o.media = (o.media || []).filter(m => m && m.file);
  return o;
}
export const productDir = id => path.join(PRODUCTS_DIR, id);
export function getProduct(idOrName) {
  const s = loadProducts(), q = String(idOrName || '');
  return s.products.find(p => p.id === q) || s.products.find(p => slug(p.name) === slug(q)) || null;
}
export function upsertProduct(src) {
  const s = loadProducts(), now = new Date().toISOString();
  if (!src.name && !src.id) throw new Error('Sản phẩm cần có tên');
  let p = src.id && s.products.find(x => x.id === src.id);
  if (p) Object.assign(p, normalize({ ...p, ...src, links: { ...p.links, ...(src.links || {}) } }), { updated: now });
  else {
    let id = src.id || slug(src.name); for (let n = 2; s.products.some(x => x.id === id); n++) id = `${slug(src.name)}-${n}`;
    p = normalize({ ...src, id, created: now, updated: now }); s.products.unshift(p);
  }
  saveProducts(s); fs.mkdirSync(path.join(productDir(p.id), 'media'), { recursive: true });
  return p;
}
export function deleteProduct(id) {
  const s = loadProducts(), n = s.products.length;
  s.products = s.products.filter(p => p.id !== id);
  if (s.products.length === n) throw new Error('không thấy sản phẩm ' + id);
  saveProducts(s); fs.rmSync(productDir(id), { recursive: true, force: true });
}

// ---------- media ----------
function probeDur(f) { try { return +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()).toFixed(2); } catch { return null; } }
function registerMedia(id, file, from = '') {
  const s = loadProducts(), p = s.products.find(x => x.id === id); if (!p) throw new Error('không thấy sản phẩm ' + id);
  const rel = path.relative(productDir(id), file);
  if (!p.media.some(m => m.file === rel)) p.media.push({ file: rel, kind: VID.test(file) ? 'video' : 'image', ...(VID.test(file) ? { dur: probeDur(file) } : {}), ...(from ? { from } : {}) });
  p.updated = new Date().toISOString(); saveProducts(s); return p;
}
const safeName = n => path.basename(n).replace(/[^\w.\-À-ỹ ]+/g, '_').replace(/\s+/g, '_');
function freeName(dir, name) { let f = path.join(dir, name); for (let n = 2; fs.existsSync(f); n++) f = path.join(dir, name.replace(/(\.\w+)$/, `-${n}$1`)); return f; }
export function addMediaFile(id, src) {
  if (!IMG.test(src) && !VID.test(src)) throw new Error('Chỉ nhận ảnh (jpg, png, webp) hoặc video (mp4, mov…): ' + src);
  const dir = path.join(productDir(id), 'media'); fs.mkdirSync(dir, { recursive: true });
  const dst = freeName(dir, safeName(src)); fs.copyFileSync(src, dst);
  return registerMedia(id, dst);
}
// Body of an upload request → media of the product.
export function addMediaStream(id, name, stream) {
  const dir = path.join(productDir(id), 'media'); fs.mkdirSync(dir, { recursive: true });
  if (!IMG.test(name) && !VID.test(name)) return Promise.reject(new Error('Chỉ nhận ảnh hoặc video'));
  const dst = freeName(dir, safeName(name));
  return new Promise((ok, bad) => { const w = fs.createWriteStream(dst); stream.pipe(w); w.on('finish', () => ok(registerMedia(id, dst))); w.on('error', bad); });
}
export function removeMedia(id, rel) {
  const s = loadProducts(), p = s.products.find(x => x.id === id); if (!p) throw new Error('không thấy sản phẩm ' + id);
  p.media = p.media.filter(m => m.file !== rel); saveProducts(s);
  const f = path.resolve(productDir(id), rel); if (f.startsWith(productDir(id) + path.sep)) fs.rmSync(f, { force: true });
  return p;
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export async function downloadMedia(id, url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`tải ảnh lỗi ${r.status}`);
  const type = r.headers.get('content-type') || '';
  const ext = /png/.test(type) ? '.png' : /webp/.test(type) ? '.webp' : /mp4/.test(type) ? '.mp4' : '.jpg';
  const dir = path.join(productDir(id), 'media'); fs.mkdirSync(dir, { recursive: true });
  const dst = freeName(dir, `tai-ve-${crypto.createHash('md5').update(url).digest('hex').slice(0, 6)}${ext}`);
  fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
  if (ext === '.webp') { // engine + ffmpeg đọc được webp, nhưng ảnh bìa / Finder hiển thị jpg chắc chắn hơn
    try { const j = dst.replace(/\.webp$/, '.jpg'); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', dst, j]); fs.rmSync(dst); return registerMedia(id, j, url); } catch {}
  }
  return registerMedia(id, dst, url);
}
export const mediaAbs = (p, m) => path.join(productDir(p.id), m.file);

// ---------- helpers: category, TikTok product id ----------
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export function guessCategory(text) {
  const t = fold(text);
  const R = [
    ['tpcn', /thuc pham chuc nang|vien uong|collagen|vitamin|giam can|tang can|bo gan|men vi sinh|tpcn|supplement/],
    ['my-pham', /kem |serum|son |toner|sua rua mat|tay trang|chong nang|duong da|mat na|my pham|skincare|makeup|nuoc hoa|dau goi|cosmetic/],
    ['me-be', /bim|ta dan|sua bot|me va be|em be|tre so sinh|binh sua/],
    ['thuc-pham', /banh|keo|tra |ca phe|do an|snack|hat |nuoc mam|gia vi|thuc pham|do uong/],
    ['gia-dung', /noi |chao|may xay|noi chien|hut bui|lau nha|nha bep|binh giu nhiet|gia dung|ke |hop dung|den /],
    ['thoi-trang', /ao |quan |vay|giay|dep|tui |vi |that lung|mu |kinh mat|dong ho|trang suc|thoi trang/],
    ['dien-tu', /tai nghe|sac |cap |loa|dien thoai|op lung|chuot|ban phim|camera|smartwatch|pin du phong|dien tu/],
    ['the-thao', /the thao|tap gym|yoga|ta tay|day khang luc|xe dap|chay bo/],
  ];
  return (R.find(([, re]) => re.test(t + ' ')) || ['khac'])[0];
}
export function tiktokId(link) {
  const s = String(link || '');
  if (/^\d{15,22}$/.test(s.trim())) return s.trim();
  const m = /(?:product\/|product_id=|\/pdp\/[^/]*\/)(\d{15,22})/.exec(s) || /(\d{17,22})/.exec(s);
  return m ? m[1] : '';
}

// ---------- đọc trang sản phẩm (dữ liệu công khai: og:*, JSON-LD Product) ----------
export async function fetchProductPage(url) {
  const out = { links: {}, images: [] };
  if (/tiktok\.com|vt\.tiktok/.test(url)) { out.links.tiktok = url; out.tiktok_product_id = tiktokId(url); }
  else if (/shopee\.|shp\.ee/.test(url)) out.links.shopee = url;
  else if (/lazada\./.test(url)) out.links.lazada = url;
  else out.links.other = url;
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'vi-VN,vi;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    html = await r.text();
    if (r.url && r.url !== url) { out.final_url = r.url; if (!out.tiktok_product_id) out.tiktok_product_id = tiktokId(r.url); }
  } catch (e) { out.warn = `Không mở được trang (${e.message}). Nhập tay tên, giá và kéo ảnh vào.`; return out; }
  const meta = k => { const m = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["']`, 'i').exec(html) || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${k}["']`, 'i').exec(html); return m ? decode(m[1]) : ''; };
  out.name = meta('og:title') || (/<title>([^<]+)<\/title>/i.exec(html)?.[1] || '').trim();
  out.notes = meta('og:description') || meta('description');
  const pr = meta('product:price:amount') || meta('og:price:amount'); if (pr) out.price = priceNum(pr);
  const og = meta('og:image'); if (og) out.images.push(og);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const arr = [].concat(JSON.parse(m[1])).flatMap(x => x['@graph'] || [x]);
      const p = arr.find(x => /Product/i.test(x['@type']));
      if (!p) continue;
      out.name = p.name || out.name; out.brand = p.brand?.name || p.brand || out.brand;
      out.images.push(...[].concat(p.image || []).map(x => (typeof x === 'string' ? x : x.url)).filter(Boolean));
      const of = [].concat(p.offers || [])[0]; if (of?.price) out.price = priceNum(of.price);
      if (p.description) out.notes = String(p.description).slice(0, 600);
    } catch {}
  }
  out.images = [...new Set(out.images)].slice(0, 8);
  if (!out.name) out.warn = 'Trang không cho đọc thông tin (thường gặp với Shopee/TikTok). Nhập tay tên, giá và kéo ảnh vào.';
  return out;
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ---------- nhập bảng tính ----------
// Cột được nhận theo tên (không phân biệt dấu/hoa thường), đủ cho file xuất của TikTok Shop affiliate lẫn bảng tự làm.
const COLS = {
  name: ['ten san pham', 'san pham', 'product name', 'product', 'name', 'ten'],
  price: ['gia ban', 'gia khuyen mai', 'gia', 'price', 'sale price'],
  old_price: ['gia goc', 'gia niem yet', 'original price', 'old price'],
  commission_pct: ['hoa hong', 'ty le hoa hong', 'commission rate', 'commission'],
  tiktok: ['link tiktok', 'tiktok', 'product link', 'link san pham', 'link'],
  shopee: ['link shopee', 'shopee', 'link affiliate shopee'],
  tiktok_product_id: ['product id', 'id san pham', 'ma san pham', 'product_id'],
  category: ['nganh hang', 'danh muc', 'category'],
  brand: ['thuong hieu', 'brand', 'shop'],
  usp: ['diem noi bat', 'usp', 'loi ich', 'cong dung'],
  pains: ['noi dau', 'van de', 'pain'],
  audience: ['doi tuong', 'khach hang', 'audience'],
  voucher: ['voucher', 'ma giam gia', 'coupon'],
  images: ['anh', 'hinh anh', 'image', 'images', 'link anh', 'image url'],
  notes: ['mo ta', 'ghi chu', 'description', 'notes'],
};
export function mapColumns(columns) {
  const m = {}, f = columns.map(c => fold(c).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  for (const [k, names] of Object.entries(COLS)) {
    for (const n of names) { const i = f.findIndex((c, j) => (c === n || c.startsWith(n + ' ') || c.endsWith(' ' + n)) && !Object.values(m).includes(columns[j])); if (i >= 0) { m[k] = columns[i]; break; } }
  }
  return m;
}
export async function importSheet(file, { download = true, log = () => {} } = {}) {
  const { columns, rows } = parseSheet(file), map = mapColumns(columns);
  if (!map.name) throw new Error(`Không thấy cột tên sản phẩm. Các cột có: ${columns.join(', ')}`);
  const added = [];
  for (const [i, r] of rows.entries()) {
    const g = k => (map[k] ? r[map[k]] : '');
    if (!g('name')) continue;
    const p = upsertProduct({ ...(getProduct(g('name')) ? { id: getProduct(g('name')).id } : {}), name: g('name'), price: g('price'), old_price: g('old_price'), commission_pct: g('commission_pct'),
      links: { tiktok: g('tiktok'), shopee: g('shopee') }, tiktok_product_id: g('tiktok_product_id'), category: g('category'), brand: g('brand'),
      usp: g('usp'), pains: g('pains'), audience: g('audience'), voucher: g('voucher'), notes: g('notes') });
    log(`${i + 1}/${rows.length} ${p.name}`);
    if (download) for (const u of list(g('images')).filter(x => /^https?:/.test(x)).slice(0, 6)) { try { await downloadMedia(p.id, u); } catch (e) { log(`  ảnh lỗi: ${e.message}`); } }
    added.push(getProduct(p.id));
  }
  return { map, added };
}

// ---------- CLI ----------
async function main() {
  const a = process.argv.slice(2), cmd = a[0], opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const show = p => console.log(`${p.id.padEnd(28)} ${fmtPrice(p.price).padStart(12)}  ${String(p.media.length).padStart(2)} media  ${p.name}`);
  if (cmd === 'list' || !cmd) { const s = loadProducts(); if (a.includes('--json')) console.log(JSON.stringify(s.products, null, 1)); else s.products.forEach(show); return; }
  if (cmd === 'show') { const p = getProduct(a[1]); if (!p) throw new Error('không thấy ' + a[1]); console.log(JSON.stringify(p, null, 1)); return; }
  if (cmd === 'rm') { deleteProduct(a[1]); console.log('đã xoá', a[1]); return; }
  if (cmd === 'add') {
    const p = upsertProduct({ name: opt('--name'), price: opt('--price'), old_price: opt('--old'), category: opt('--category'), commission_pct: opt('--commission'),
      links: { tiktok: opt('--tiktok') || '', shopee: opt('--shopee') || '' }, usp: opt('--usp') || [], pains: opt('--pains') || [], audience: opt('--audience') || '', voucher: opt('--voucher') || '' });
    for (const f of (opt('--media') || '').split(',').filter(Boolean)) addMediaFile(p.id, path.resolve(f));
    show(getProduct(p.id)); console.log('RESULT ' + JSON.stringify({ id: p.id })); return;
  }
  if (cmd === 'import') { const r = await importSheet(path.resolve(a[1]), { log: m => console.log(m) }); console.log('cột:', JSON.stringify(r.map)); r.added.forEach(show); return; }
  if (cmd === 'fetch') { const r = await fetchProductPage(a[1]); console.log(JSON.stringify(r, null, 1)); return; }
  if (cmd === 'media') { const id = a[1]; for (const f of a.slice(2)) addMediaFile(id, path.resolve(f)); show(getProduct(id)); return; }
  throw new Error('lệnh: list | show <id> | add --name … | import <file> | fetch <url> | media <id> <file…> | rm <id>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
