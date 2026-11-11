// Pack "affiliate" — đồ hoạ cho video affiliate gắn giỏ hàng TikTok Shop / link Facebook.
// Modules aff_*: hook chữ to 3 giây đầu, nhãn "Bấm giỏ hàng" chỉ đúng góc giỏ vàng của TikTok (hoặc "link ở bình luận" cho Facebook),
// thẻ giá dán (giá + giá gạch + −%), dải khuyến cáo bắt buộc (TPCN), đồng hồ đếm ngược deal.
// Design space 720×1280 (dọc, chính) hoặc 1280×720 qua DIMS(). Vùng an toàn TikTok: y 130–1000, chừa 110 px bên phải (cột nút).
// Doc: references/pack-affiliate.md.
(() => {
  const P = 'affiliate';
  const DISP = "'Montserrat','Be Vietnam Pro',sans-serif";
  const C = (s = {}) => {
    const b = (typeof TL !== 'undefined' && TL && TL.brand) || {};
    return {
      hi: s.hl || b.accent || '#FFE14D', red: s.color || b.primary || '#FF3B30', dark: b.dark || '#111214', light: b.light || '#FFFFFF',
      disp: s.font || (b.disp && b.disp !== 'var(--disp)' ? b.disp : DISP), font: b.font && b.font !== 'var(--sans)' ? b.font : "'Be Vietnam Pro',sans-serif",
    };
  };
  const hexA = (h, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return h; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const st = (w, col = '#000') => strokeShadow(w, col);
  const fit = (text, size, maxW, em = .62) => Math.min(size, Math.floor(maxW / (Math.max(1, [...String(text)].length) * em)));
  const pop = (t, t0, d = .32, s = 2.2) => clamp(E.outBack(prog(t, t0, d), s), 0, 1.25);
  const outOp = s => (t => fadeIO(t, s.t0, s.keep ? null : s.t1, .1, .2));
  const CART = (col, sz) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="M3 4h2.2l2.3 10.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.5-1.1L21 8H6.3" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19.5" r="1.6" fill="${col}"/><circle cx="17" cy="19.5" r="1.6" fill="${col}"/></svg>`;

  Object.assign(MODULES, {
    // Hook 0–3 s: 1–2 dòng chữ rất to, dòng chính trong ô vàng nghiêng, đập vào + rung nhẹ.  { text, text2, y, box:true }
    aff_hook(s, t, lt) {
      const [W, H] = DIMS(), c = C(s), o = outOp(s)(t), y = s.y ?? Math.round(H * (VERT() ? .25 : .3));
      const k = pop(t, s.t0, .3, 2.6), shake = lt > .3 && lt < .55 ? Math.sin(lt * 90) * 4 * (1 - (lt - .3) / .25) : 0;
      const t1 = String(s.text || 'HOOK 3 GIÂY').toUpperCase(), t2 = String(s.text2 || '');
      const main = `<div style="display:inline-block;padding:8px 22px 10px;background:${s.box === false ? 'transparent' : c.hi};color:${s.box === false ? c.hi : '#111'};transform:rotate(-2.5deg);
        border-radius:10px;font-family:${c.disp};font-weight:900;font-size:${fit(t1, s.size || 74, W - 130, .74)}px;line-height:1.18;white-space:nowrap;
        ${s.box === false ? `text-shadow:${st(5)},0 8px 0 #000` : 'box-shadow:0 10px 0 rgba(0,0,0,.45),0 18px 40px rgba(0,0,0,.4)'}">${esc(t1)}</div>`;
      const k2 = E.outCubic(prog(t, s.t0 + (s.text2_t ?? .45), .25));
      const sub = t2 ? `<div style="margin-top:18px;font-family:${c.disp};font-weight:800;font-size:${fit(t2, 44, W - 100, .58)}px;line-height:1.25;color:#fff;white-space:nowrap;
        text-shadow:${st(4)};opacity:${k2.toFixed(3)};transform:translateY(${((1 - k2) * 16).toFixed(1)}px)">${esc(t2)}</div>` : '';
      return { front: `<div class="abs"${cidOf(s)} style="left:0;right:0;top:${y}px;text-align:center;opacity:${o.toFixed(3)};transform:translate(${shake.toFixed(1)}px,-50%) scale(${(.6 + .4 * k).toFixed(3)})">${main}${sub}</div>` };
    },

    // Nhãn chốt đơn chỉ vào giỏ hàng. TikTok: giỏ vàng nằm góc dưới trái, ngay trên tên kênh → mũi tên ↙ nhún nhảy.
    // Facebook: link nằm ở bình luận đầu → mũi tên ↓ về giữa.  { text, sub, platform:'tiktok'|'facebook', price, old_price }
    aff_cart(s, t, lt) {
      const [W, H] = DIMS(), c = C(s), o = outOp(s)(t), fb = s.platform === 'facebook';
      const k = pop(t, s.t0, .35, 2), bob = Math.sin(lt * 7) * 10;
      const text = String(s.text || (fb ? 'LINK Ở BÌNH LUẬN ĐẦU' : 'BẤM GIỎ HÀNG')).toUpperCase();
      const y = s.y ?? Math.round(H * (VERT() ? .7 : .62)), x = s.x ?? (fb ? W / 2 : Math.round(W * .44));
      const price = s.price ? `<div style="margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px">
          <span style="font-family:${c.disp};font-weight:900;font-size:46px;line-height:1.2;color:${c.hi};text-shadow:${st(4)}">${esc(s.price)}</span>
          ${s.old_price ? `<span style="font-family:${c.disp};font-weight:700;font-size:26px;color:#ddd;text-decoration:line-through;text-decoration-color:${c.red};text-decoration-thickness:3px;text-shadow:${st(2)}">${esc(s.old_price)}</span>` : ''}</div>` : '';
      const pill = `<div style="display:inline-flex;align-items:center;gap:14px;padding:16px 30px;border-radius:999px;background:${fb ? '#1877F2' : c.hi};color:${fb ? '#fff' : '#111'};
        box-shadow:0 10px 0 rgba(0,0,0,.45),0 0 0 4px #fff,0 0 40px ${hexA(fb ? '#1877F2' : c.hi, .6)};transform:scale(${(k * (1 + .03 * Math.sin(lt * 9))).toFixed(3)})">
        ${CART(fb ? '#fff' : '#111', 46)}<span style="font-family:${c.disp};font-weight:900;font-size:${fit(text, 40, W - 220)}px;line-height:1.2;white-space:nowrap">${esc(text)}</span></div>`;
      const sub = s.sub ? `<div style="margin-top:12px;font-family:${c.disp};font-weight:800;font-size:28px;color:#fff;text-shadow:${st(3)};white-space:nowrap">${esc(s.sub)}</div>` : '';
      // arrow toward the platform button
      const ka = clamp(prog(t, s.t0 + .35, .3));
      const arrow = fb
        ? `<div class="abs" style="left:${W / 2 - 40}px;top:${y + 150 + bob}px;width:80px;height:110px;opacity:${ka.toFixed(3)}"><svg viewBox="0 0 80 110" width="80" height="110"><path d="M40 6v80M14 62l26 30 26-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 4px 0 #000)"/></svg></div>`
        : `<div class="abs" style="left:${40 - bob * .6}px;top:${Math.round(H * (VERT() ? .79 : .74)) + bob}px;width:140px;height:140px;opacity:${ka.toFixed(3)}"><svg viewBox="0 0 140 140" width="140" height="140"><path d="M120 20L30 110M30 52v58h58" fill="none" stroke="${c.hi}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 5px 0 #000)"/></svg></div>`;
      return { front: `<div class="abs"${cidOf(s)} style="left:${x}px;top:${y}px;transform:translate(-50%,-50%);text-align:center;opacity:${o.toFixed(3)}">${pill}${price}${sub}</div>${arrow}`, hideCaptions: s.hideCaptions ?? true };
    },

    // Thẻ giá dán (sticker) — giá, giá gạch, huy hiệu −%.  { price, old_price, pct, label, x, y, size, rotate }
    aff_price(s, t, lt) {
      const [W, H] = DIMS(), c = C(s), o = outOp(s)(t), k = pop(t, s.t0, .3, 2.4);
      const x = s.x ?? Math.round(W * .72), y = s.y ?? Math.round(H * (VERT() ? .2 : .25)), sz = (s.size ?? 100) / 100;
      const pct = s.pct ? `<div style="position:absolute;right:-26px;top:-34px;width:86px;height:86px;border-radius:50%;background:${c.red};color:#fff;display:flex;align-items:center;justify-content:center;
        font-family:${c.disp};font-weight:900;font-size:28px;transform:rotate(12deg) scale(${pop(t, s.t0 + .25, .3, 3).toFixed(3)});box-shadow:0 6px 0 rgba(0,0,0,.4)">-${esc(String(s.pct).replace(/[-%]/g, ''))}%</div>` : '';
      const body = `<div style="position:relative;padding:14px 26px 16px;border-radius:18px;background:#fff;border:4px solid #111;box-shadow:0 10px 0 rgba(0,0,0,.45);text-align:center">
        ${s.label ? `<div style="font-family:${c.disp};font-weight:800;font-size:20px;letter-spacing:.08em;color:${c.red};white-space:nowrap">${esc(String(s.label).toUpperCase())}</div>` : ''}
        <div style="font-family:${c.disp};font-weight:900;font-size:${fit(s.price || '', 48, 300)}px;line-height:1.15;color:#111;white-space:nowrap">${esc(s.price || '')}</div>
        ${s.old_price ? `<div style="font-family:${c.disp};font-weight:700;font-size:22px;color:#777;text-decoration:line-through;text-decoration-color:${c.red};text-decoration-thickness:3px;white-space:nowrap">${esc(s.old_price)}</div>` : ''}${pct}</div>`;
      return { front: `<div class="abs"${cidOf(s)} style="left:${x}px;top:${y}px;opacity:${o.toFixed(3)};transform:translate(-50%,-50%) rotate(${s.rotate ?? -6}deg) scale(${(sz * k).toFixed(3)})">${body}</div>` };
    },

    // Dải khuyến cáo bắt buộc (vd TPCN), chữ nhỏ rõ, nằm suốt video.  { text, y }
    aff_disclaimer(s, t) {
      const [W, H] = DIMS(), y = s.y ?? Math.round(H * (VERT() ? .105 : .08));
      return { front: `<div class="abs"${cidOf(s)} style="left:${(W - Math.min(W - 40, 640)) / 2}px;width:${Math.min(W - 40, 640)}px;top:${y}px;padding:8px 14px;border-radius:10px;background:rgba(0,0,0,.62);
        font-family:'Be Vietnam Pro',sans-serif;font-weight:600;font-size:${s.size || 19}px;line-height:1.35;color:#fff;text-align:center;opacity:${fadeIO(t, s.t0, s.t1, .2, .2).toFixed(3)}">${esc(s.text || '')}</div>` };
    },

    // Đồng hồ đếm ngược deal (chỉ dùng khi deal có hạn thật).  { label, secs, y }
    aff_countdown(s, t, lt) {
      const [W, H] = DIMS(), c = C(s), o = outOp(s)(t), k = pop(t, s.t0, .3, 2);
      const left = Math.max(0, Math.round((s.secs ?? 3600) - lt)), hh = Math.floor(left / 3600), mm = Math.floor(left / 60) % 60, ss = left % 60;
      const cell = v => `<span style="display:inline-block;min-width:78px;padding:6px 8px;border-radius:12px;background:#111;color:${c.hi};border:3px solid ${c.hi};box-shadow:0 6px 0 rgba(0,0,0,.45)">${String(v).padStart(2, '0')}</span>`;
      const y = s.y ?? Math.round(H * (VERT() ? .36 : .4));
      return { front: `<div class="abs"${cidOf(s)} style="left:0;right:0;top:${y}px;text-align:center;opacity:${o.toFixed(3)};transform:translateY(-50%) scale(${k.toFixed(3)})">
        <div style="font-family:${c.disp};font-weight:900;font-size:30px;color:#fff;text-shadow:${st(3)};margin-bottom:12px">${esc(String(s.label || 'DEAL KẾT THÚC SAU').toUpperCase())}</div>
        <div style="font-family:${c.disp};font-weight:900;font-size:56px;line-height:1.1;display:inline-flex;gap:10px;align-items:center;color:#fff">${cell(hh)}:${cell(mm)}:${cell(ss)}</div></div>` };
    },

    // Ảnh sản phẩm ĐÃ TÁCH NỀN đặt trên nền màu thương hiệu: quầng sáng, bóng đổ dưới chân, xoay nhẹ, lơ lửng.  { image (PNG trong suốt), bg1, bg2, tilt, y, size, sparkle }
    aff_hero(s, t, lt) {
      const [W, H] = DIMS(), c = C(s), o = fadeIO(t, s.t0, s.t1, .12, .15), k = clamp(E.outBack(prog(t, s.t0, .5), 1.6), 0, 1.15);
      const b1 = s.bg1 || c.red, b2 = s.bg2 || '#0d0d10', tilt = (s.tilt ?? -6) * (1 - .35 * Math.sin(lt * 1.3)), fl = Math.sin(lt * 2.2) * 10;
      const size = (s.size ?? (VERT() ? .78 : .5)) * W, cy = s.y ?? Math.round(H * (VERT() ? .46 : .5)), zoom = 1 + .05 * clamp(lt / Math.max(1, s.t1 - s.t0));
      const sp = s.sparkle === false ? '' : [0, 1, 2, 3, 4].map(i => { const a = i * 1.26 + lt * .9, r = size * (.48 + .06 * Math.sin(lt * 3 + i)), tw = .5 + .5 * Math.sin(lt * 5 + i * 2);
        return `<div class="abs" style="left:${(W / 2 + Math.cos(a) * r).toFixed(0)}px;top:${(cy + Math.sin(a) * r * .8).toFixed(0)}px;font-size:${18 + i * 4}px;color:${c.hi};opacity:${(tw * k).toFixed(2)};transform:translate(-50%,-50%) rotate(${(lt * 60 + i * 30).toFixed(0)}deg)">✦</div>`; }).join('');
      return { front: `<div class="abs"${cidOf(s)} style="inset:0;opacity:${o.toFixed(3)};overflow:hidden;background:radial-gradient(120% 80% at 50% 38%, ${hexA(b1, .95) || b1} 0%, ${b2} 72%)">
        <div class="abs" style="left:50%;top:${cy}px;width:${(size * 1.15).toFixed(0)}px;height:${(size * 1.15).toFixed(0)}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(closest-side, ${hexA(c.hi, .45)}, transparent)"></div>
        <div class="abs" style="left:50%;top:${(cy + size * .52).toFixed(0)}px;width:${(size * .8).toFixed(0)}px;height:${(size * .1).toFixed(0)}px;transform:translate(-50%,-50%) scale(${(1 - fl / 120).toFixed(3)});border-radius:50%;background:radial-gradient(closest-side, rgba(0,0,0,.55), transparent)"></div>
        <img src="${media(s.image, t)}" style="position:absolute;left:50%;top:${(cy + fl).toFixed(1)}px;max-width:${size.toFixed(0)}px;max-height:${(size * 1.1).toFixed(0)}px;transform:translate(-50%,-50%) rotate(${tilt.toFixed(2)}deg) scale(${(k * zoom).toFixed(3)});filter:drop-shadow(0 26px 30px rgba(0,0,0,.5))">
        ${sp}${s.keyword ? `<div class="abs" style="left:0;right:0;top:${s.kw_y ?? Math.round(H * .2)}px;text-align:center;transform:translateY(-50%)">
          ${s.sub ? `<div style="font-family:${c.disp};font-weight:800;font-size:30px;color:#fff;text-shadow:${st(3)};margin-bottom:10px;opacity:${clamp(prog(t, s.t0 + .25, .2)).toFixed(3)}">${esc(s.sub)}</div>` : ''}
          <div style="display:inline-block;font-family:${c.disp};font-weight:900;font-size:${fit(String(s.keyword).toUpperCase(), 76, W - 110, .7)}px;line-height:1.1;color:${c.hi};white-space:nowrap;text-shadow:${st(5)},0 8px 0 #000;transform:rotate(-2deg) scale(${pop(t, s.t0 + .1, .3, 2).toFixed(3)})">${esc(String(s.keyword).toUpperCase())}</div></div>` : ''}</div>`, hideCaptions: s.hideCaptions ?? false };
    },
  });

  const at = (y, size = 100) => ({ x: DIMS()[0] / 2, y: VERT() ? y : Math.round(y * 720 / 1280 + 40), size });
  PACKS.push({
    id: P, name: 'Affiliate giỏ hàng', icon: '🛒',
    desc: 'Hook chữ to 3 giây đầu, nhãn Bấm giỏ hàng chỉ đúng góc giỏ TikTok (hoặc link ở bình luận Facebook), thẻ giá dán, sản phẩm tách nền trên nền thương hiệu, khuyến cáo bắt buộc, đếm ngược deal',
    caption: 'review',
    items: [
      { type: 'aff_hook', label: 'Hook 3 giây', make: T => ({ type: 'aff_hook', t0: T, t1: T + 2.6, text: 'DA DẦU XEM NGAY', text2: 'Mình đã tìm ra món này' }) },
      { type: 'aff_cart', label: 'Bấm giỏ hàng (TikTok)', make: T => ({ type: 'aff_cart', t0: T, t1: T + 3.5, platform: 'tiktok', text: 'Bấm giỏ hàng', price: '199.000đ', old_price: '299.000đ' }) },
      { type: 'aff_cart', label: 'Link ở bình luận (Facebook)', make: T => ({ type: 'aff_cart', t0: T, t1: T + 3.5, platform: 'facebook', text: 'Link ở bình luận đầu', price: '199.000đ' }) },
      { type: 'aff_price', label: 'Thẻ giá dán', make: T => ({ type: 'aff_price', t0: T, t1: T + 3, label: 'Giá hôm nay', price: '199.000đ', old_price: '299.000đ', pct: 33 }) },
      { type: 'aff_disclaimer', label: 'Dải khuyến cáo', make: T => ({ type: 'aff_disclaimer', t0: T, t1: T + 10, text: 'Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.' }) },
      { type: 'aff_hero', label: 'Sản phẩm tách nền', make: T => ({ type: 'aff_hero', t0: T, t1: T + 3, image: '' }) },
      { type: 'aff_countdown', label: 'Đếm ngược deal', make: T => ({ type: 'aff_countdown', t0: T, t1: T + 3, ...at(460), label: 'Deal kết thúc sau', secs: 7200 }) },
    ],
  });
})();
