// Trợ lý TRẢ LỜI BÌNH LUẬN: dán bình luận (mỗi dòng một cái) → phân loại (hỏi giá, hỏi link, hỏi cách dùng, hỏi ship/size,
// khen, chê, khác) + soạn câu trả lời theo giọng kênh, đúng dữ liệu sản phẩm (giá, voucher, câu hỏi hay gặp từ review).
// CHỈ SOẠN — bạn chép và trả lời (hoặc bấm trả lời trên Trang Facebook đã kết nối). Luật quảng cáo vẫn áp dụng cho câu trả lời.
// Spec: references/affiliate.md §Trả lời bình luận. CLI: node scripts/aff_reply.mjs <product-id> <comments.txt> [--platform facebook] [--profile id]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { callClaude, parseJson } from './ai_edit.mjs';
import { getProduct, fmtPrice, sayPrice, discountPct } from './products.mjs';
import { getProfile } from './profile.mjs';
import { checkScript } from './aff_compliance.mjs';
import { affLink } from './aff_kit.mjs';

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export const INTENTS = { gia: 'Hỏi giá', link: 'Hỏi link / mua ở đâu', 'cach-dung': 'Hỏi cách dùng', ship: 'Ship, size, màu, đổi trả', khen: 'Khen', che: 'Chê / nghi ngờ', khac: 'Khác' };
const RX = [
  ['link', /\b(link|mua o dau|mua sao|o dau ban|gio hang|dat sao|inbox|ib|xin link|cho xin)\b/],
  ['gia', /\b(gia|bao nhieu|nhieu tien|bn|bnhieu|tien|sale|giam|voucher|ma)\b/],
  ['ship', /\b(ship|giao|size|mau|con hang|doi tra|cod|freeship|bao lau toi)\b/],
  ['cach-dung', /\b(dung sao|cach dung|dung the nao|dung nhu|bao lau|may lan|co dung duoc|da nhay cam|ba bau|tre em)\b/],
  ['che', /\b(lua dao|lua|fake|gia re|khong tot|te|do|xao|quang cao|ao|chem)\b/],
  ['khen', /\b(dep|xinh|thich|hay|tot|xin|ngon|dinh|ok|tuyet|qua)\b/],
];
export const classify = c => { const f = ` ${fold(c).replace(/[^a-z0-9 ]+/g, ' ')} `; for (const [k, re] of RX) if (re.test(f)) return k; return /\?/.test(c) ? 'cach-dung' : 'khac'; };

function template(intent, p, fb) {
  const pr = p.price ? fmtPrice(p.price) : '', pct = discountPct(p), link = fb ? 'link mình để ở bình luận ghim đầu tiên nha' : 'bạn bấm giỏ hàng góc dưới bên trái là thấy nha';
  const faq = q => p.reviews?.faqs?.find(x => x.a && fold(q).split(' ').filter(w => w.length > 3).some(w => fold(x.q).includes(w)));
  return {
    gia: c => `Dạ ${pr ? `giá đang ${pr}${pct ? ` (giảm ${pct}%)` : ''}` : 'giá đang ưu đãi'}${p.voucher ? `, có thêm ${p.voucher}` : ''} ạ, ${link} 🛒`,
    link: () => `Dạ ${link} 🛒${pr ? ` Đang ${pr} ạ.` : ''}`,
    ship: () => `Dạ phần ship, size, màu và đổi trả bạn xem ngay trong trang sản phẩm giúp mình nha (${fb ? 'link ở bình luận đầu' : 'bấm giỏ hàng'}), shop ghi rõ từng mục ạ.`,
    'cach-dung': c => { const f = faq(c); return f ? `Dạ ${f.a.replace(/^dạ\s*/i, '')}` : `Dạ mình hướng dẫn trong video rồi nè, ${p.usp[0] ? `điểm hay là ${p.usp[0].toLowerCase()}` : 'dùng rất đơn giản'}. Trường hợp đặc biệt bạn đọc kỹ hướng dẫn trên bao bì giúp mình nha.`; },
    khen: () => `Cảm ơn bạn nhiều nha 🥰 ${pr ? `Đang có giá ${sayPrice(p.price)} đó, ` : ''}${fb ? 'link ở bình luận đầu' : 'bấm giỏ hàng xem thử'} nha!`,
    che: () => `Cảm ơn bạn góp ý ạ. Mình chia sẻ trải nghiệm thật, bạn xem thêm đánh giá của người mua trong trang sản phẩm để tham khảo nha.`,
    khac: () => `Cảm ơn bạn đã ghé xem nha 💛 Cần gì cứ hỏi mình ạ.`,
  }[intent];
}

export async function draftReplies(p, comments, { platform = 'tiktok', profile, offline = false, model = 'haiku', say = () => {} } = {}) {
  comments = comments.map(c => String(c).trim()).filter(Boolean).slice(0, 80);
  const fb = platform === 'facebook', prof = getProfile(profile);
  const base = comments.map(c => { const intent = classify(c); return { comment: c, intent, reply: template(intent, p, fb)(c), source: 'mau' }; });
  if (!offline && comments.length) {
    say(`Claude soạn ${comments.length} câu trả lời`);
    try {
      const facts = [`Sản phẩm: ${p.name}`, p.price && `Giá: ${fmtPrice(p.price)}${p.old_price ? ` (gốc ${fmtPrice(p.old_price)})` : ''}`, p.voucher && `Voucher: ${p.voucher}`, p.usp.length && `Điểm nổi bật: ${p.usp.join('; ')}`,
        p.reviews?.faqs?.length && `Câu hỏi hay gặp (từ đánh giá thật): ${p.reviews.faqs.map(x => `${x.q} → ${x.a || '(chưa rõ)'}`).join(' | ')}`, `Mua ở đâu: ${fb ? `link ở bình luận ghim đầu tiên${affLink(p, 'facebook') ? '' : ' (chưa có link)'}` : 'bấm giỏ hàng góc dưới bên trái video'}`].filter(Boolean).join('\n');
      const res = await callClaude(`Bạn trả lời bình luận dưới video affiliate ${fb ? 'Facebook Reels' : 'TikTok'} của kênh. Giọng kênh: ${prof.persona || prof.tone || 'thân thiện, xưng mình – bạn, dạ ạ lễ phép'}.
DỮ LIỆU (chỉ dùng đúng thông tin này, không hứa hẹn, không "tốt nhất/100%/cam kết", không nói chữa bệnh; không biết thì hướng khách xem trang sản phẩm):
${facts}
Mỗi câu trả lời ≤ 220 ký tự, tự nhiên, 0–1 emoji, hỏi giá/link thì luôn chỉ chỗ mua. Bình luận chê/nghi ngờ: lịch sự, không cãi.
Phân loại "intent" ∈ ${Object.keys(INTENTS).join(', ')}.
BÌNH LUẬN:
${comments.map((c, i) => `${i + 1}. ${c.slice(0, 300)}`).join('\n')}
Chỉ trả về JSON: {"replies":[{"i":1,"intent":"gia","reply":"…"}]}`, model);
      for (const r of parseJson(res).replies || []) { const b = base[(+r.i || 0) - 1]; if (b && String(r.reply || '').trim()) Object.assign(b, { reply: String(r.reply).trim(), intent: INTENTS[r.intent] ? r.intent : b.intent, source: 'claude' }); }
    } catch (e) { say('Claude lỗi, dùng câu trả lời mẫu: ' + e.message.slice(0, 100)); }
  }
  for (const b of base) { // ad-law check on every reply (auto-fix wording; fall back to the template if still bad)
    const r = checkScript({ angle: 'x', hooks: [], beats: [{ say: b.reply }], cta: {}, hook: {} }, p, { autofix: true });
    b.reply = r.script.beats[0].say; if (r.errors) { b.reply = template(b.intent, p, fb)(b.comment); b.fixed = true; }
  }
  return base;
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const p = getProduct(a[0]); if (!p || !a[1]) throw new Error('cách dùng: node scripts/aff_reply.mjs <product-id> <comments.txt> [--platform facebook] [--offline]');
  const r = await draftReplies(p, fs.readFileSync(path.resolve(a[1]), 'utf8').split('\n'), { platform: opt('--platform'), profile: opt('--profile'), offline: a.includes('--offline') });
  for (const x of r) console.log(`[${INTENTS[x.intent]}] ${x.comment}\n  → ${x.reply}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
