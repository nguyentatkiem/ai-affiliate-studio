// Gắn sản phẩm affiliate vào một dự án CÓ QUAY (clip review/unbox, đoạn cắt từ livestream): thẻ giá khi người nói nhắc giá,
// nhãn "Bấm giỏ hàng"/"Link ở bình luận" ở cuối, dải khuyến cáo (TPCN), soát lời nói theo luật (không sửa được giọng → chỉ cảnh báo).
// Dùng bởi scripts/autopilot.mjs (bước "aff" khi có --product) và scripts/aff_live.mjs. Chạy lại thì thay, không chồng.
import fs from 'node:fs';
import path from 'node:path';
import { fmtPrice, discountPct } from './products.mjs';
import { checkScript, DISCLAIMER } from './aff_compliance.mjs';

const r2 = v => Math.round(v * 100) / 100;
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const PRICE_WORDS = ['gia', 'k', 'nghin', 'ngan', 'trieu', 'dong', 'sale', 'giam', 'voucher', 'ma giam'];

export function applyAffOverlays(dir, p, { platform = 'tiktok' } = {}) {
  const tlFile = path.join(dir, 'timeline.json'), tl = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
  const capFile = typeof tl.captions === 'string' ? path.join(dir, tl.captions) : null;
  const caps = capFile && fs.existsSync(capFile) ? JSON.parse(fs.readFileSync(capFile, 'utf8')) : Array.isArray(tl.captions) ? tl.captions : [];
  const dur = tl.duration || 0, fb = platform === 'facebook';
  tl.scenes = (tl.scenes || []).filter(s => !s._affov);
  const add = s => tl.scenes.push({ ...s, _affov: true });
  const price = fmtPrice(p.price), old = fmtPrice(p.old_price), pct = discountPct(p);
  const vert = (tl.height || 1920) > (tl.width || 1080);
  // price sticker when the speaker talks about price (first time after 2 s), else early in the video
  const words = caps.flatMap(c => (c.words || []).map(w => ({ ...w, f: fold(w.w).replace(/[^a-z0-9]/g, '') })));
  const hit = words.find(w => w.s > 2 && w.s < dur - 6 && (PRICE_WORDS.includes(w.f) || /^\d+k$/.test(w.f)));
  if (price) {
    const t0 = r2(hit ? Math.max(.3, hit.s - .2) : Math.min(2.5, dur * .15));
    add({ type: 'aff_price', t0, t1: r2(Math.min(dur - 4, t0 + 3.2)), price, ...(old ? { old_price: old } : {}), ...(pct ? { pct } : {}), label: 'Giá hôm nay', x: vert ? 520 : 1060, y: vert ? 300 : 170, size: vert ? 92 : 80 });
  }
  const c0 = r2(Math.max(dur * .7, dur - 3.8));
  // the cart call-to-action replaces any end card / CTA a template or recipe put at the end (they would overlap it)
  tl.scenes = tl.scenes.filter(s => !(s.t1 > c0 + .3 && /cta|outro|end|title_card|follow|subscribe/i.test(s.type)));
  add({ type: 'aff_cart', t0: c0, t1: dur, platform: fb ? 'facebook' : 'tiktok', text: fb ? 'LINK Ở BÌNH LUẬN' : 'BẤM GIỎ HÀNG', ...(price ? { price } : {}), ...(old ? { old_price: old } : {}), hideCaptions: false, y: vert ? 640 : 330, keep: true });
  if (DISCLAIMER[p.category]) add({ type: 'aff_disclaimer', t0: 0, t1: dur, text: DISCLAIMER[p.category] });
  // spoken words vs the rules: report only (the voice cannot be rewritten); fix what is only on screen (captions)
  const said = caps.filter(c => !c.hidden).map(c => c.words.map(w => w.w).join(' ')).join(' ');
  const chk = checkScript({ angle: 'clip', hooks: [], beats: [{ say: said }], cta: {}, hook: {} }, p, { autofix: false });
  tl._aff = { ...(tl._aff || {}), product: p.id, product_name: p.name, angle: tl._aff?.angle || 'clip', hook: tl._aff?.hook || { type: 'clip' }, platform,
    title: tl._aff?.title || tl.title || p.name, caption: tl._aff?.caption || '', hashtags: tl._aff?.hashtags || [], disclaimer: DISCLAIMER[p.category] || null,
    compliance: { ok: chk.errors === 0, spoken: true, issues: chk.issues } };
  fs.writeFileSync(tlFile, JSON.stringify(tl, null, 1));
  return { price: !!price, priceAt: hit ? r2(hit.s) : null, cart: c0, issues: chk.issues.filter(x => x.level === 'error') };
}
