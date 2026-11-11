// Kịch bản video affiliate: 1 sản phẩm → K góc bán, mỗi góc N hook (A/B test 3 giây đầu). Claude viết (claude -p),
// chỉ dùng thông tin trong thẻ sản phẩm; luật tuân thủ (aff_compliance.mjs) soát và tự sửa, lỗi còn lại → Claude viết lại 1 lần.
// Không có Claude CLI → kịch bản dựng sẵn từ dữ liệu sản phẩm (vẫn ra video được, kém tự nhiên hơn).
// Spec: references/affiliate.md. CLI:
//   node scripts/aff_script.mjs <product-id> [--angles 3] [--hooks 2] [--dur 30] [--platform tiktok|facebook] [--persona "…"] [--angle noi-dau,unbox] [--offline]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { callClaude, parseJson } from './ai_edit.mjs';
import { getProduct, fmtPrice, sayPrice, discountPct, CATEGORIES } from './products.mjs';
import { checkScript, issuesText, ANGLE_BLOCK, DISCLAIMER } from './aff_compliance.mjs';

// Góc bán (angle): cách kể. `need` = dữ liệu sản phẩm cần có để góc đó không phải bịa.
export const ANGLES = {
  'noi-dau': { name: 'Nỗi đau → giải pháp', how: 'Mở bằng vấn đề người xem đang gặp, đưa sản phẩm ra như cách giải quyết, 2–3 lợi ích cụ thể, chốt giá.', need: ['pains|usp'] },
  'top-ly-do': { name: '3 lý do nên mua', how: 'Đánh số 1-2-3 lý do (lấy từ điểm nổi bật), mỗi lý do 1 câu ngắn + hình minh hoạ, chốt giá.', need: ['usp'] },
  'deal': { name: 'Săn deal / giá hời', how: 'Mở bằng giá (giá gạch → giá hiện tại, voucher nếu có), nói ngắn sản phẩm là gì, vì sao đáng mua ở giá này, nhắc deal có thể hết.', need: ['price'] },
  'unbox': { name: 'Mở hộp / trải nghiệm đầu', how: 'Giọng người vừa nhận hàng: đóng gói, cầm thử, chi tiết đáng chú ý, cảm nhận đầu tiên, chốt.', need: [] },
  'pov': { name: 'POV tình huống', how: 'Mở bằng "POV: …" một tình huống đời thường của khách hàng mục tiêu, sản phẩm xuất hiện giải quyết tình huống.', need: [] },
  'review-that': { name: 'Review thật (ưu/nhược)', how: 'Khách quan: 2–3 ưu điểm + 1 điểm cần lưu ý (thật, từ dữ liệu), hợp với ai, chốt giá.', need: ['usp'] },
  'dung-mua-neu': { name: 'Đừng mua nếu…', how: 'Hook phản đề "Đừng mua … nếu bạn …" rồi lật lại: ai thì rất nên mua, vì sao, chốt.', need: ['usp'] },
  'huong-dan': { name: 'Cách dùng nhanh', how: 'Hướng dẫn 3 bước dùng sản phẩm, mẹo nhỏ, kết quả mong đợi (không hứa quá), chốt.', need: [] },
  'truoc-sau': { name: 'Trước / sau', how: 'So sánh tình trạng trước và sau khi dùng — chỉ dùng cho đồ dùng/gia dụng/thời trang, không dùng cho mỹ phẩm/TPCN.', need: [] },
};
// Kiểu hook 3 giây đầu.
export const HOOKS = {
  'cau-hoi': 'Câu hỏi chạm đúng vấn đề ("Da dầu có ai như mình không?")',
  'gay-soc': 'Mâu thuẫn / bất ngờ ("Mình suýt bỏ qua món này…")',
  'con-so': 'Con số thật: giá, % giảm, thời gian dùng ("199k mà làm được vầy")',
  'canh-bao': 'Cảnh báo / phản đề ("Đừng mua nồi chiên nếu chưa xem cái này")',
  'pov': 'POV ("POV: bạn đi làm về 9h tối…")',
  'loi-ich': 'Lợi ích rõ ràng nói thẳng ("Bếp sạch trong 2 phút")',
};
const VISUALS = ['product', 'price', 'proscons', 'list', 'unbox', 'number', 'words', 'versus'];
const MOODS = ['hype', 'happy', 'corporate_upbeat', 'tech', 'inspire', 'lofi', 'acoustic_warm', 'mellow'];

const facts = p => [
  `Tên: ${p.name}`, p.brand && `Thương hiệu/shop: ${p.brand}`, `Ngành: ${CATEGORIES[p.category] || p.category}`,
  p.price && `Giá bán: ${fmtPrice(p.price)}`, p.old_price && `Giá gốc: ${fmtPrice(p.old_price)} (đang giảm ${discountPct(p)}%)`,
  p.voucher && `Voucher/ưu đãi: ${p.voucher}`, p.deal_until && `Ưu đãi đến: ${p.deal_until}`,
  p.usp.length && `Điểm nổi bật (được nói): ${p.usp.join('; ')}`, p.pains.length && `Vấn đề khách hay gặp: ${p.pains.join('; ')}`,
  p.audience && `Khách hàng mục tiêu: ${p.audience}`, p.specs.length && `Thông số: ${p.specs.join('; ')}`,
  p.claims_ok.length && `Được phép nói thêm (đã xác minh): ${p.claims_ok.join('; ')}`, p.claims_ban.length && `TUYỆT ĐỐI KHÔNG nói: ${p.claims_ban.join('; ')}`,
  p.notes && `Mô tả của shop: ${String(p.notes).slice(0, 700)}`,
  p.reviews?.quotes?.length && `LỜI KHÁCH THẬT (trích đánh giá, ${p.reviews.count || 'nhiều'} đánh giá — được dẫn lại kiểu "khách bảo…", không thêm số liệu): ${p.reviews.quotes.slice(0, 6).map(q => `"${q}"`).join('; ')}`,
  p.reviews?.objections?.length && `Khách hay lo ngại (nên trả lời thẳng trong kịch bản review): ${p.reviews.objections.map(x => x.text).join('; ')}`,
  p.reviews?.words?.length && `Cụm từ khách hay dùng (dùng cho lời thoại tự nhiên): ${p.reviews.words.join(', ')}`,
  `Ảnh/video có sẵn: ${p.media.filter(m => m.kind === 'image').length} ảnh, ${p.media.filter(m => m.kind === 'video').length} video`,
].filter(Boolean).join('\n');

export function pickAngles(p, k, { prefer = [], only } = {}) {
  const blocked = new Set(ANGLE_BLOCK[p.category] || []);
  const has = need => need.every(n => n.split('|').some(f => (Array.isArray(p[f]) ? p[f].length : !!p[f])));
  const ok = Object.keys(ANGLES).filter(a => !blocked.has(a) && has(ANGLES[a].need) && (a !== 'truoc-sau' || ['gia-dung', 'thoi-trang', 'khac'].includes(p.category)));
  if (only?.length) return only.filter(a => ANGLES[a] && !blocked.has(a)).slice(0, k);
  const base = ['noi-dau', 'deal', 'top-ly-do', 'pov', 'review-that', 'unbox', 'dung-mua-neu', 'huong-dan'];
  return [...new Set([...prefer, ...base, ...ok])].filter(a => ok.includes(a)).slice(0, k);
}

function prompt(p, { angles, hooks, dur, platform, persona, hookPrefer, extra }) {
  const words = Math.round(dur * 2.8), fb = platform === 'facebook';
  return `Bạn là biên kịch video affiliate bán hàng ngắn (TikTok Shop / Facebook Reels) tiếng Việt, rất giỏi 3 giây đầu và chốt đơn.
SẢN PHẨM (chỉ được dùng đúng thông tin này, không bịa thêm công dụng, số liệu, đánh giá, số đơn, giải thưởng):
${facts(p)}

Viết ${angles.length} kịch bản, mỗi kịch bản một GÓC BÁN:
${angles.map(a => `- "${a}": ${ANGLES[a].name} — ${ANGLES[a].how}`).join('\n')}

Mỗi kịch bản dài khoảng ${dur} giây (~${words} từ lời đọc, ±10%), đọc bằng giọng ${persona || 'người bán hàng thân thiện, tự nhiên như đang nói chuyện với bạn'}.
Hình là ảnh/video sản phẩm + chữ trên màn hình. Nền tảng: ${fb ? 'Facebook Reels — link mua nằm ở BÌNH LUẬN ĐẦU, CTA phải nói "link ở bình luận"' : 'TikTok — CTA phải nói "bấm vào giỏ hàng (giỏ vàng góc dưới bên trái)"'}.
Mỗi kịch bản có ${hooks} HOOK khác nhau (để A/B test 3 giây đầu), thân bài dùng chung. Kiểu hook nên dùng (đa dạng, ưu tiên theo thứ tự): ${hookPrefer.map(h => `${h} = ${HOOKS[h]}`).join('; ')}.
- hook: "type" (một trong ${Object.keys(HOOKS).join(', ')}), "say" (≤ 16 từ, nói trong 3 giây), "screen" (chữ to ≤ 24 ký tự, IN HOA được), "screen2" (dòng phụ ≤ 30 ký tự, có thể rỗng).
- beats: 3–5 ý, mỗi ý 1–2 câu "say" ngắn; "screen" (từ khoá ≤ 22 ký tự); "sub" (≤ 28 ký tự, có thể rỗng); "visual" ∈ ${VISUALS.join(' | ')}:
  product = cận ảnh/video sản phẩm, price = thẻ giá (chỉ khi nói giá), proscons = ưu/nhược (cần "pros": 2–3, "cons": 0–1 mục ≤ 24 ký tự),
  list = liệt kê ("items": 3 mục ≤ 22 ký tự), unbox = trong hộp có ("items": 3–4 mục ≤ 16 ký tự), number = một con số THẬT từ dữ liệu ("num", "unit"),
  words = câu chốt 2–4 từ mạnh, versus = so sánh 2 phía ("items": ["Trước/Cách cũ","Sản phẩm"] ≤ 12 ký tự). "emoji": 1 emoji hợp ý.
- cta: "say" (kêu gọi mua, có giá nếu có giá), "screen" (≤ 22 ký tự), "button" (≤ 14 ký tự).
- "title" (≤ 60 ký tự), "caption" (2–3 câu, tự nhiên, có lời kêu gọi), "hashtags" (4–6, không dấu #, có 1–2 tag ngách), "mood" ∈ ${MOODS.join(', ')}.
LUẬT (vi phạm là video bị gỡ, khoá giỏ hàng):
- Giá, % giảm, voucher phải ĐÚNG như dữ liệu; không có giá thì không nói giá. Viết giá dạng "199k" hoặc "199.000 đồng".
- Không dùng: "rẻ nhất", "tốt nhất", "số 1", "duy nhất", "100%", "cam kết", "vĩnh viễn", "ngay lập tức", "cấp tốc"; không bịa số người dùng/số đơn/số sao/đánh giá; không mượn danh bác sĩ, chuyên gia, cơ quan nhà nước.
- Mỹ phẩm: không "trị/chữa/đặc trị/điều trị", không hứa "hết mụn/hết nám/trắng bật tông". TPCN: không nói chữa/phòng bệnh, không hứa số kg.
- Không tạo khan hiếm giả ("chỉ còn 3 cái") nếu dữ liệu không có.
- Lời đọc: tiếng Việt có dấu, câu ngắn, xưng "mình"/"bạn", số viết bằng chữ số, không emoji/ký hiệu lạ trong "say".
${extra ? 'Yêu cầu thêm: ' + extra + '\n' : ''}
Chỉ trả về DUY NHẤT JSON (không markdown):
{"scripts":[{"angle":"${angles[0]}","title":"…","caption":"…","hashtags":["…"],"mood":"hype","hooks":[{"type":"cau-hoi","say":"…","screen":"…","screen2":"…"}],"beats":[{"say":"…","screen":"…","sub":"…","visual":"product","emoji":"✨"}],"cta":{"say":"…","screen":"…","button":"MUA NGAY"}}]}`;
}

// ---------- kịch bản dựng sẵn khi không có Claude ----------
const cut = (s, n) => { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n + 1), i = c.lastIndexOf(' '); return (i > n * .5 ? c.slice(0, i) : s.slice(0, n)).trim(); };
export function fallbackScripts(p, angles, hooks, platform = 'tiktok') {
  const pr = fmtPrice(p.price), old = fmtPrice(p.old_price), pct = discountPct(p), fb = platform === 'facebook';
  const short = p.name.split(/\s+/).slice(0, 4).join(' '), u = p.usp.length ? p.usp : ['Dùng tiện mỗi ngày', 'Thiết kế gọn gàng', 'Dễ dùng'];
  const pain = p.pains[0] || `Bạn đang tìm ${short.toLowerCase()} dùng ổn`;
  const ctaSay = fb ? `Link mua mình để ở bình luận đầu tiên nha${pr ? `, giá đang ${sayPrice(p.price)}` : ''}.` : `Bấm vào giỏ hàng góc dưới bên trái để xem giá ưu đãi${pr ? `, đang ${sayPrice(p.price)}` : ''} nha.`;
  const hookBank = [
    { type: 'cau-hoi', say: `${pain} đúng không?`, screen: cut(pain.toUpperCase(), 24), screen2: 'Xem cái này trước đã' },
    { type: 'con-so', say: pr ? `${sayPrice(p.price)} mà dùng được như vầy.` : `${short} này làm mình bất ngờ.`, screen: pr ? cut(`CHỈ ${pr}`, 24) : 'BẤT NGỜ THẬT', screen2: pct ? `Đang giảm ${pct}%` : '' },
    { type: 'loi-ich', say: `${u[0]}, đây là lý do mình mê ${short.toLowerCase()}.`, screen: cut(u[0].toUpperCase(), 24), screen2: short },
    { type: 'gay-soc', say: `Mình suýt bỏ qua ${short.toLowerCase()} này.`, screen: 'SUÝT BỎ QUA', screen2: short },
  ];
  return angles.map((angle, ai) => ({
    angle, title: `${short} — ${ANGLES[angle].name}`.slice(0, 60), caption: `${p.name}. ${u.slice(0, 2).join(', ')}. ${fb ? 'Link ở bình luận đầu.' : 'Bấm giỏ hàng để xem giá.'}`,
    hashtags: ['affiliate', 'review', 'muasam', fb ? 'reels' : 'tiktokshop'], mood: 'hype', _fallback: true,
    hooks: Array.from({ length: hooks }, (_, i) => hookBank[(ai + i) % hookBank.length]),
    beats: [
      { say: `Đây là ${p.name}.`, screen: cut(short.toUpperCase(), 22), sub: p.brand || '', visual: 'product', emoji: '✨' },
      { say: `Điểm mình thích nhất: ${u.slice(0, 3).join(', ')}.`, screen: 'ĐIỂM NỔI BẬT', visual: 'list', items: u.slice(0, 3).map(x => cut(x, 22)), emoji: '👍' },
      ...(pr ? [{ say: `Giá hiện tại ${sayPrice(p.price)}${old ? `, giá gốc ${sayPrice(p.old_price)}` : ''}.`, screen: pr, sub: pct ? `Giảm ${pct}%` : '', visual: 'price', emoji: '💸' }] : []),
      { say: `Hợp với ${p.audience || 'ai cần một món dùng hằng ngày, gọn và tiện'}.`, screen: 'HỢP VỚI AI?', sub: (p.audience || '').slice(0, 28), visual: 'product', emoji: '🎯' },
    ],
    cta: { say: ctaSay, screen: fb ? 'LINK Ở BÌNH LUẬN' : 'BẤM GIỎ HÀNG', button: 'MUA NGAY' },
  }));
}

function sane(sc, hooks) {
  if (!sc || !Array.isArray(sc.beats) || !sc.beats.length) return null;
  sc.hooks = (Array.isArray(sc.hooks) ? sc.hooks : sc.hook ? [sc.hook] : []).filter(h => h && String(h.say || '').trim()).slice(0, hooks);
  if (!sc.hooks.length) return null;
  sc.beats = sc.beats.filter(b => String(b.say || '').trim()).slice(0, 6).map(b => ({ ...b, visual: VISUALS.includes(b.visual) ? b.visual : 'product' }));
  sc.cta = sc.cta && String(sc.cta.say || '').trim() ? sc.cta : { say: 'Bấm giỏ hàng để xem giá ưu đãi nha.', screen: 'BẤM GIỎ HÀNG', button: 'MUA NGAY' };
  if (!MOODS.includes(sc.mood)) sc.mood = 'hype';
  return sc;
}
// One script per (angle, hook) to check: compliance runs on the shared body + each hook.
function checkAll(sc, p) {
  const all = []; let ok = true;
  sc.hooks = sc.hooks.map((h, i) => {
    const r = checkScript({ ...sc, hook: { ...h } }, p);
    if (!r.ok) ok = false;
    all.push(...r.issues.map(x => ({ ...x, hook: i })));
    Object.assign(sc, { beats: r.script.beats, cta: r.script.cta, caption: r.script.caption, title: r.script.title, disclaimer: r.script.disclaimer || sc.disclaimer });
    return r.script.hook;
  });
  // dedupe body issues reported once per hook
  const seen = new Set(), issues = all.filter(x => { const k = x.where.startsWith('hook') ? `${x.hook}|${x.where}|${x.rule}` : `${x.where}|${x.rule}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok, issues };
}

export async function writeScripts(p, { angles: k = 3, hooks = 2, dur = 30, platform = 'tiktok', persona = '', only, prefer = [], hookPrefer, extra = '', model = 'sonnet', offline = false, say = () => {} } = {}) {
  const angles = pickAngles(p, k, { prefer, only });
  if (!angles.length) throw new Error('Không có góc bán phù hợp cho sản phẩm này (thiếu điểm nổi bật / giá?)');
  hookPrefer = (hookPrefer?.length ? hookPrefer : ['cau-hoi', 'con-so', 'loi-ich', 'gay-soc', 'pov', 'canh-bao']).filter(h => HOOKS[h]);
  let scripts = null, source = 'claude', note = '';
  if (!offline) {
    let last = '';
    for (let a = 0; a < 2 && !scripts; a++) {
      const t0 = Date.now();
      say(a ? 'Claude trả lời chưa đúng JSON — hỏi lại' : `Claude viết ${angles.length} kịch bản × ${hooks} hook`);
      try {
        const q = prompt(p, { angles, hooks, dur, platform, persona, hookPrefer, extra }) + (a ? `\n\nLần trước lỗi: ${last}. Chỉ trả về JSON đúng mẫu.` : '');
        const res = await callClaude(q, model, () => { const s = Math.round((Date.now() - t0) / 1000); if (s % 10 === 0) say(`Claude đang viết… ${s}s`); });
        const j = parseJson(res); scripts = (j.scripts || []).map(sc => sane(sc, hooks)).filter(Boolean);
        if (!scripts.length) { last = 'không có kịch bản hợp lệ'; scripts = null; }
      } catch (e) { last = e.message; if (/Không tìm thấy lệnh|chưa đăng nhập|hết lượt/.test(e.message)) { note = e.message; break; } }
    }
    if (!scripts) note = note || `Claude lỗi (${last})`;
  }
  if (!scripts) { scripts = fallbackScripts(p, angles, hooks, platform); source = 'offline'; }
  // compliance: auto-fix, then one Claude rewrite for scripts that still break a rule
  for (const [i, sc] of scripts.entries()) {
    sc.angle = ANGLES[sc.angle] ? sc.angle : angles[i] || angles[0];
    let r = checkAll(sc, p);
    if (!r.ok && source === 'claude') {
      say(`Kịch bản "${ANGLES[sc.angle].name}" vi phạm luật — nhờ Claude viết lại`);
      try {
        const fix = await callClaude(`Sửa kịch bản JSON sau cho hết vi phạm, giữ cấu trúc, chỉ dùng thông tin sản phẩm.\nSẢN PHẨM:\n${facts(p)}\nVI PHẠM:\n${issuesText({ issues: r.issues.filter(x => x.level === 'error') })}\nKỊCH BẢN:\n${JSON.stringify(sc)}\nChỉ trả về JSON kịch bản đã sửa.`, model);
        const sc2 = sane(parseJson(fix), hooks);
        if (sc2) { sc2.angle = sc.angle; const r2 = checkAll(sc2, p); if (r2.ok || r2.issues.filter(x => x.level === 'error').length < r.issues.filter(x => x.level === 'error').length) { scripts[i] = sc2; r = r2; } }
      } catch (e) { say('Viết lại lỗi: ' + e.message.slice(0, 120)); }
    }
    scripts[i].compliance = { ok: r.ok, issues: r.issues };
    if (DISCLAIMER[p.category]) scripts[i].disclaimer = DISCLAIMER[p.category];
  }
  return { product: p.id, source, note, angles, platform, dur, scripts };
}

async function main() {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const p = getProduct(a[0]); if (!p) throw new Error('không thấy sản phẩm ' + a[0]);
  const r = await writeScripts(p, { angles: +opt('--angles', 3), hooks: +opt('--hooks', 2), dur: +opt('--dur', 30), platform: opt('--platform', 'tiktok'), persona: opt('--persona', ''),
    only: opt('--angle') ? opt('--angle').split(',') : null, offline: a.includes('--offline'), say: m => console.log('@@ 0.1 ' + m) });
  const out = opt('--out'); if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });

// ---------- nhân bản video thắng: giữ thân bài + góc bán, viết N hook MỚI (khác kiểu/khác câu với hook gốc) ----------
export async function hookVariants(p, sc, srcHook = 0, n = 3, { model = 'sonnet', offline = false, say = () => {} } = {}) {
  const H = sc.hooks[srcHook] || sc.hooks[0], body = sc.beats.map(b => b.say).join(' ');
  let hooks = null;
  if (!offline) {
    say(`Claude viết ${n} hook mới cho video thắng`);
    try {
      const res = await callClaude(`Video affiliate này đang RA ĐƠN TỐT. Giữ nguyên thân bài, viết ${n} HOOK 3 giây đầu MỚI để nhân bản (test tiếp), mỗi hook khác hẳn hook gốc và khác nhau, có thể khác kiểu.
SẢN PHẨM:\n${facts(p)}\nHOOK GỐC (đang thắng): ${JSON.stringify(H)}\nTHÂN BÀI: ${body}
Kiểu hook: ${Object.entries(HOOKS).map(([k, v]) => `${k} = ${v}`).join('; ')}.
Mỗi hook: "type", "say" (≤ 16 từ), "screen" (≤ 24 ký tự), "screen2" (≤ 30 ký tự, có thể rỗng). Giữ tinh thần đã thắng của hook gốc. Cùng luật: không bịa số liệu, không "nhất/100%/cam kết", giá đúng dữ liệu.
Chỉ trả về JSON: {"hooks":[{"type":"…","say":"…","screen":"…","screen2":"…"}]}`, model);
      hooks = (parseJson(res).hooks || []).filter(h => h && String(h.say || '').trim() && HOOKS[h.type]).slice(0, n);
      if (!hooks.length) hooks = null;
    } catch (e) { say('Claude lỗi, dùng hook dựng sẵn: ' + e.message.slice(0, 100)); }
  }
  if (!hooks) {
    const bank = fallbackScripts(p, [sc.angle in ANGLES ? sc.angle : 'noi-dau'], 4)[0].hooks;
    hooks = bank.filter(h => h.say !== H.say).slice(0, n);
    while (hooks.length < n) hooks.push({ ...H, screen2: ['Xem tới cuối nha', 'Nghe mình nói nè', 'Đáng tiền thật'][hooks.length % 3] });
  }
  const out = { ...JSON.parse(JSON.stringify(sc)), hooks };
  const r = checkAll(out, p); out.compliance = { ok: r.ok, issues: r.issues };
  return out;
}
