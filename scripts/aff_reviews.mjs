// Đào REVIEW thật của khách: dán đánh giá/bình luận (hoặc file CSV/Excel xuất từ shop) → Claude rút ra
// nỗi đau thật, lời khen thật, câu hỏi hay gặp, lo ngại trước khi mua — kèm TRÍCH NGUYÊN VĂN làm nguồn.
// Ghi vào sản phẩm: pains/usp (thêm, không xoá cái cũ) + reviews {quotes, faqs, objections, words, mined_at}.
// Kịch bản (aff_script.mjs facts) dùng lời khách thật; trợ lý trả lời bình luận (aff_reply.mjs) dùng câu hỏi hay gặp.
// Không có Claude → lọc câu theo từ khoá khen/chê (thô hơn). Spec: references/affiliate.md §Đào review.
//   node scripts/aff_reviews.mjs <product-id> <file.txt|.csv|.xlsx> [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { callClaude, parseJson } from './ai_edit.mjs';
import { getProduct, upsertProduct } from './products.mjs';
import { parseSheet } from './batch.mjs';
import { checkScript } from './aff_compliance.mjs';

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

export function readReviews(fileOrText) {
  if (fs.existsSync(String(fileOrText)) && /\.(csv|xlsx)$/i.test(fileOrText)) {
    const { columns, rows } = parseSheet(fileOrText);
    const col = columns.find(c => /noi dung|danh gia|binh luan|review|comment|content|nhan xet/.test(fold(c))) || columns.sort((a, b) => rows.reduce((x, r) => x + String(r[b] || '').length, 0) - rows.reduce((x, r) => x + String(r[a] || '').length, 0))[0];
    return rows.map(r => clean(r[col])).filter(x => x.length > 3);
  }
  const text = fs.existsSync(String(fileOrText)) ? fs.readFileSync(fileOrText, 'utf8') : String(fileOrText);
  return text.split(/\n+/).map(clean).filter(x => x.length > 3);
}

const POS = ['thich', 'ung', 'tot', 'dep', 'thom', 'em', 'muot', 'nhanh', 'chac', 'xin', 'dang tien', 'hai long', 'ok', 'tuyet', 'mua lai', 'xai ngon', 'ngon', 'mem', 'nhe', 'tien'];
const NEG = ['khong', 'chua', 'te', 'xau', 'cham', 'loi', 'hong', 'kem', 'bi', 'that vong', 'mui hac', 'dinh', 'bet', 'kho'];
function offline(lines) {
  const sc = l => { const f = ` ${fold(l)} `; return POS.filter(w => f.includes(` ${w} `)).length - NEG.filter(w => f.includes(` ${w} `)).length; };
  const qs = lines.filter(l => /\?|co .* khong|bao lau|nhu the nao|dung sao|ship|size/.test(fold(l)));
  const good = lines.filter(l => sc(l) > 0 && !qs.includes(l)).sort((a, b) => sc(b) - sc(a));
  const bad = lines.filter(l => sc(l) < 0 && !qs.includes(l));
  return {
    praises: good.slice(0, 5).map(q => ({ text: q.slice(0, 80), quote: q })), pains: [], objections: bad.slice(0, 4).map(q => ({ text: q.slice(0, 80), quote: q })),
    faqs: qs.slice(0, 6).map(q => ({ q, a: '' })), words: [], source: 'offline',
  };
}

export async function mineReviews(p, lines, { model = 'sonnet', offline: off = false, say = () => {} } = {}) {
  lines = [...new Set(lines)].slice(0, 400);
  if (!lines.length) throw new Error('Không có đánh giá nào để đọc');
  if (off) return offline(lines);
  say(`Claude đọc ${lines.length} đánh giá`);
  try {
    const res = await callClaude(`Đây là ĐÁNH GIÁ/BÌNH LUẬN THẬT của khách về sản phẩm "${p.name}"${p.brand ? ` (${p.brand})` : ''}. Rút ra để viết kịch bản video affiliate bán hàng.
Chỉ dùng điều có trong đánh giá. Mỗi ý kèm "quote" = TRÍCH NGUYÊN VĂN ngắn (≤ 120 ký tự) từ một đánh giá làm bằng chứng.
- "pains": vấn đề khách gặp TRƯỚC khi mua (lý do họ tìm sản phẩm) — 0–5 ý
- "praises": điều khách khen nhiều nhất, cụ thể (không chung chung kiểu "tốt") — 3–6 ý, xếp theo số người nhắc
- "objections": lo ngại / chê / điểm cần lưu ý — 0–4 ý (để kịch bản trả lời thẳng, review khách quan)
- "faqs": câu hỏi khách hay hỏi, "a" = câu trả lời CHỈ khi đánh giá có thông tin, không thì rỗng — 0–6 câu
- "words": 5–10 cụm từ khách hay dùng (giọng tự nhiên để đưa vào lời thoại)
Mỗi "text" ≤ 60 ký tự, tiếng Việt tự nhiên. Không nêu tên người, không số điện thoại.
ĐÁNH GIÁ (mỗi dòng một cái):
${lines.map(l => '- ' + l.slice(0, 300)).join('\n')}
Chỉ trả về JSON: {"pains":[{"text":"…","quote":"…","n":2}],"praises":[…],"objections":[…],"faqs":[{"q":"…","a":"…"}],"words":["…"]}`, model);
    const j = parseJson(res);
    const arr = k => (Array.isArray(j[k]) ? j[k] : []).filter(x => x && clean(x.text)).map(x => ({ text: clean(x.text).slice(0, 80), quote: clean(x.quote).slice(0, 160), n: +x.n || 1 }));
    return { pains: arr('pains'), praises: arr('praises'), objections: arr('objections'), faqs: (j.faqs || []).filter(x => x?.q).map(x => ({ q: clean(x.q), a: clean(x.a) })).slice(0, 8), words: (j.words || []).map(clean).filter(Boolean).slice(0, 12), source: 'claude' };
  } catch (e) { say('Claude lỗi, lọc thô theo từ khoá: ' + e.message.slice(0, 100)); return offline(lines); }
}

// Merge into the product. Praises → usp only when they pass the ad-law check (no "trị mụn", "nhất"…).
export function applyMined(p, m, { count = 0 } = {}) {
  const has = (list, t) => list.some(x => fold(x).includes(fold(t).slice(0, 24)) || fold(t).includes(fold(x).slice(0, 24)));
  const safe = t => checkScript({ angle: 'x', hooks: [], beats: [{ say: t }], cta: {}, hook: {} }, p, { autofix: false }).errors === 0;
  const usp = [...p.usp], pains = [...p.pains];
  if (m.source === 'claude') for (const x of m.praises) if (!has(usp, x.text) && safe(x.text)) usp.push(x.text); // offline: raw sentences stay as quotes only
  for (const x of m.pains) if (!has(pains, x.text)) pains.push(x.text);
  const reviews = { quotes: [...m.praises, ...m.pains].filter(x => x.quote).slice(0, 10).map(x => x.quote), praises: m.praises, objections: m.objections, faqs: m.faqs, words: m.words, count, source: m.source, mined_at: new Date().toISOString() };
  return upsertProduct({ ...p, usp: usp.slice(0, 10), pains: pains.slice(0, 8), reviews });
}

async function main() {
  const a = process.argv.slice(2);
  const p = getProduct(a[0]); if (!p || !a[1]) throw new Error('cách dùng: node scripts/aff_reviews.mjs <product-id> <file.txt|.csv|.xlsx> [--dry] [--offline]');
  const lines = readReviews(path.resolve(a[1]));
  const m = await mineReviews(p, lines, { offline: a.includes('--offline'), say: s => console.log('@@ 0.5 ' + s) });
  if (!a.includes('--dry')) applyMined(p, m, { count: lines.length });
  console.log(JSON.stringify(m, null, 1));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
