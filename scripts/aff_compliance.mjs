// Kiểm tra chính sách cho kịch bản affiliate (TikTok Shop / Facebook) trước khi dựng: luật cứng theo ngành + giá phải khớp
// sản phẩm + không bịa đánh giá/số đơn; tự sửa từ "nói quá" khi sửa được, còn lại báo lỗi để dừng hoặc viết lại.
// Spec: references/affiliate.md §Tuân thủ. Đây là lưới an toàn, không thay cho việc đọc chính sách mới nhất của sàn.
//   node scripts/aff_compliance.mjs <script.json> <product-id> [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getProduct, priceNum, fmtPrice, discountPct } from './products.mjs';

// Phrase rules: re (matched on the original text, Vietnamese letters as word chars), fix ('' = drop the phrase, null = cannot auto-fix).
const W = '\\p{L}\\p{N}';
const rx = s => new RegExp(`(^|[^${W}])(${s})(?=$|[^${W}])`, 'giu');
const RULES_ALL = [
  { re: rx('rẻ nhất|giá rẻ nhất'), fix: 'giá tốt', why: 'Khẳng định "nhất" không chứng minh được' },
  { re: rx('tốt nhất|số 1|số một|đỉnh nhất|xịn nhất'), fix: 'rất đáng thử', why: 'Khẳng định "nhất/số 1" không chứng minh được' },
  { re: rx('duy nhất'), fix: 'nổi bật', why: 'Khẳng định "duy nhất" không chứng minh được' },
  { re: rx('100 ?%|một trăm phần trăm|tuyệt đối'), fix: '', why: 'Cam kết tuyệt đối' },
  { re: rx('cam kết'), fix: '', why: 'Cam kết hiệu quả' },
  { re: rx('vĩnh viễn|mãi mãi|trọn đời'), fix: 'lâu dài', why: 'Cam kết hiệu quả vĩnh viễn' },
  { re: rx('ngay lập tức|cấp tốc|sau một đêm|sau 1 đêm|chỉ sau \\d+ ngày'), fix: 'dần dần', why: 'Hứa kết quả tức thì' },
  { re: rx('hàng fake|hàng giả|hàng nhái|super fake|rep 1:1|replica'), fix: null, why: 'Hàng giả/nhái bị cấm' },
  { re: rx('bán chạy nhất|hot nhất'), fix: 'đang được nhiều người hỏi', why: 'Khẳng định "nhất" về doanh số' },
  { re: rx('(hàng )?(nghìn|ngàn|triệu|vạn) (người|khách|đơn)( hàng)?'), fix: null, why: 'Số khách/số đơn phải có dữ liệu thật', social: true },
  { re: rx('\\d[\\d.,]* ?(k|nghìn|ngàn)? ?(đơn|lượt bán|khách hàng|người dùng|người mua|đánh giá)'), fix: null, why: 'Số đơn/đánh giá phải có dữ liệu thật', social: true },
  { re: rx('5 sao|năm sao|4[.,]9 sao'), fix: null, why: 'Điểm đánh giá phải có dữ liệu thật', social: true },
  { re: rx('bác sĩ khuyên dùng|chuyên gia khuyên dùng|được bộ y tế|bộ y tế chứng nhận'), fix: null, why: 'Mượn danh chuyên gia/cơ quan nhà nước' },
];
const RULES_CAT = {
  'my-pham': [
    { re: rx('đặc trị|điều trị|chữa|trị dứt điểm|(?<!giá )trị'), fix: 'hỗ trợ cải thiện', why: 'Mỹ phẩm không được quảng cáo như thuốc (trị/chữa)' },
    { re: rx('thải độc|detox da|tái tạo tế bào gốc'), fix: 'chăm sóc', why: 'Công dụng y học không được phép với mỹ phẩm' },
    { re: rx('trắng bật tông|trắng cấp tốc|hết mụn|hết nám|xoá nám|xóa nám|sạch mụn'), fix: 'da trông sáng và đều màu hơn', why: 'Hứa kết quả điều trị' },
  ],
  tpcn: [
    { re: rx('chữa|điều trị|đặc trị|trị bệnh|khỏi bệnh|thay thế thuốc|thần dược|phòng bệnh|ngừa ung thư'), fix: null, why: 'Thực phẩm chức năng không được quảng cáo có tác dụng chữa/phòng bệnh' },
    { re: rx('giảm cân cấp tốc|giảm \\d+ ?kg|tăng \\d+ ?cm'), fix: null, why: 'Hứa con số giảm cân/tăng chiều cao' },
  ],
  'me-be': [
    { re: rx('thay sữa mẹ|tốt hơn sữa mẹ|như sữa mẹ'), fix: null, why: 'Cấm so sánh/thay thế sữa mẹ' },
  ],
  'the-thao': [{ re: rx('giảm \\d+ ?kg|giảm mỡ cấp tốc'), fix: null, why: 'Hứa con số giảm cân' }],
  'thuc-pham': [{ re: rx('chữa|điều trị|trị bệnh|khỏi bệnh'), fix: null, why: 'Thực phẩm không được quảng cáo có tác dụng chữa bệnh' }],
};
// Bắt buộc theo ngành (Nghị định 15/2018 + Luật Quảng cáo): TPCN phải có câu khuyến cáo khi quảng cáo.
export const DISCLAIMER = { tpcn: 'Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.' };
// Góc bán không dùng cho ngành (ảnh trước/sau mỹ phẩm, TPCN dễ bị coi là cam kết hiệu quả).
export const ANGLE_BLOCK = { 'my-pham': ['truoc-sau'], tpcn: ['truoc-sau'], 'me-be': [] };
// Sữa công thức cho trẻ dưới 24 tháng: cấm quảng cáo (Nghị định 100/2014).
const INFANT_MILK = /(sữa|sua).{0,30}(dưới|duoi|0 ?-|0 đến|từ 0).{0,12}(24|12|6) ?tháng|sữa công thức|sữa bột cho bé|sữa cho trẻ sơ sinh/i;

// Every price-looking token in the text: "199k", "199.000đ", "1,29 triệu", "199 nghìn"
const PRICE_RE = /(\d[\d.,]*)\s?(k|nghìn|ngàn|đ|đồng|vnđ|vnd|tr|triệu)(?![\p{L}])/giu;
const PCT_RE = /(\d{1,2})\s?(%|phần trăm)/giu;
const priceOf = (n, u) => priceNum(`${n}${/^(k|nghìn|ngàn)$/i.test(u) ? 'k' : /^(tr|triệu)$/i.test(u) ? 'tr' : ''}`);

// Texts of a script (from aff_script.mjs): every spoken line + every on-screen line, with a path for the report.
export function textsOf(sc) {
  const out = [], add = (where, t) => { if (t != null && String(t).trim()) out.push({ where, text: String(t) }); };
  add('hook.say', sc.hook?.say); add('hook.screen', sc.hook?.screen); add('hook.screen2', sc.hook?.screen2);
  (sc.beats || []).forEach((b, i) => { add(`beats[${i}].say`, b.say); add(`beats[${i}].screen`, b.screen); add(`beats[${i}].sub`, b.sub); (b.items || []).forEach((x, j) => add(`beats[${i}].items[${j}]`, x)); });
  add('cta.say', sc.cta?.say); add('cta.screen', sc.cta?.screen); add('caption', sc.caption); add('title', sc.title);
  return out;
}
const setAt = (sc, where, val) => { const ks = where.replace(/\[(\d+)\]/g, '.$1').split('.'); let o = sc; for (const k of ks.slice(0, -1)) o = o[k]; o[ks[ks.length - 1]] = val; };

export function checkScript(sc, product, { autofix = true, strict = true } = {}) {
  const issues = [], cat = product.category || 'khac';
  const allowed = new Set([product.price, product.old_price].map(priceNum).filter(Boolean));
  const vNum = priceNum(String(product.voucher || '').match(/\d[\d.,]*\s?(k|tr|đ)?/i)?.[0] || ''); if (vNum) allowed.add(vNum);
  const pct = discountPct(product), vPct = +(/(\d{1,2})\s?%/.exec(product.voucher || '')?.[1] || 0);
  const okClaims = (product.claims_ok || []).map(s => s.toLowerCase());
  const rules = [...RULES_ALL, ...(RULES_CAT[cat] || [])];
  const banned = (product.claims_ban || []).filter(Boolean).map(s => ({ re: rx(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), fix: null, why: 'Nằm trong danh sách "không được nói" của sản phẩm' }));
  for (const T of textsOf(sc)) {
    let text = T.text;
    for (const r of [...rules, ...banned]) {
      r.re.lastIndex = 0;
      if (!r.re.test(text)) continue;
      r.re.lastIndex = 0;
      const hit = text.match(r.re).map(s => s.trim()).join(', ');
      if (r.social && okClaims.some(c => text.toLowerCase().includes(c))) continue; // user stated this social proof as true
      if (autofix && r.fix != null) {
        r.re.lastIndex = 0;
        text = text.replace(r.re, (m, pre, w) => pre + (w === w.toUpperCase() && w !== w.toLowerCase() ? r.fix.toUpperCase() : r.fix)).replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
        issues.push({ level: 'fixed', where: T.where, rule: r.why, hit, text });
      } else issues.push({ level: 'error', where: T.where, rule: r.why, hit });
    }
    // prices must be the product's own (price, old price, voucher)
    for (const m of text.matchAll(PRICE_RE)) {
      const n = priceOf(m[1], m[2]);
      if (n && n >= 1000 && ![...allowed].some(a => Math.abs(a - n) <= Math.max(1000, a * .005))) issues.push({ level: 'error', where: T.where, rule: `Giá ${m[0].trim()} không khớp giá sản phẩm (${[...allowed].map(x => fmtPrice(x)).join(' / ') || 'chưa nhập giá'})`, hit: m[0].trim() });
    }
    for (const m of text.matchAll(PCT_RE)) {
      const n = +m[1];
      if (n > 0 && (!pct || Math.abs(n - pct) > 1) && n !== vPct && !/SPF|PA|%\s?(cotton|da|polyester|nước|cồn)/i.test(text)) issues.push({ level: 'error', where: T.where, rule: `Mức giảm ${n}% không khớp (giá đang giảm ${pct || 0}%${vPct ? `, voucher ${vPct}%` : ''})`, hit: m[0] });
    }
    if (text !== T.text) setAt(sc, T.where, text);
  }
  if (INFANT_MILK.test(`${product.name} ${product.notes}`)) issues.push({ level: 'error', where: 'product', rule: 'Sữa cho trẻ dưới 24 tháng tuổi bị cấm quảng cáo (Nghị định 100/2014)', hit: product.name });
  if ((ANGLE_BLOCK[cat] || []).includes(sc.angle)) issues.push({ level: 'error', where: 'angle', rule: `Góc "${sc.angle}" dễ vi phạm với ngành này (ảnh trước/sau = cam kết hiệu quả)`, hit: sc.angle });
  if (DISCLAIMER[cat]) {
    const has = textsOf(sc).some(t => t.text.includes('không phải là thuốc'));
    if (!has) { if (autofix) { sc.disclaimer = DISCLAIMER[cat]; issues.push({ level: 'fixed', where: 'disclaimer', rule: 'Thêm câu khuyến cáo bắt buộc của TPCN (chữ trên màn hình suốt video)', hit: '' }); } else issues.push({ level: 'error', where: 'disclaimer', rule: 'Thiếu câu khuyến cáo TPCN', hit: '' }); }
  }
  const errors = issues.filter(x => x.level === 'error');
  return { ok: strict ? !errors.length : true, errors: errors.length, fixed: issues.filter(x => x.level === 'fixed').length, issues, script: sc };
}
export const issuesText = r => r.issues.map(x => `${x.level === 'error' ? '✗' : '✓ sửa'} ${x.where}: ${x.rule}${x.hit ? ` («${x.hit}»)` : ''}`).join('\n');

async function main() {
  const [f, id] = process.argv.slice(2);
  if (!f || !id) throw new Error('cách dùng: node scripts/aff_compliance.mjs <script.json> <product-id>');
  const p = getProduct(id); if (!p) throw new Error('không thấy sản phẩm ' + id);
  const r = checkScript(JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')), p);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1)); else console.log(issuesText(r) || '✓ không thấy vi phạm');
  process.exit(r.ok ? 0 : 3);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
