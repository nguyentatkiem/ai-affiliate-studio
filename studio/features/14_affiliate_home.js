// Màn hình MỞ ĐẦU cho người làm affiliate (thay vì mở thẳng trình dựng): dán link sản phẩm → làm video,
// số liệu hoa hồng/đơn, "Hôm nay làm gì" (kế hoạch tự chạy), video thắng → nhân bản, sản phẩm điểm cao, video mới, sắp đăng,
// việc cần thiết lập, kênh (nhiều tài khoản), kho b-roll của tôi. Nút "Trang chủ" trên thanh trên cùng mở lại; "Mở trình dựng" đóng.
// Server: studio/routes/14_affiliate.mjs (/api/aff/home …). Dùng lại hộp thoại của 14_affiliate.js qua Studio.aff.
(() => {
  const { $, esc, toast, modal, closeModal } = Studio;
  const A = () => Studio.aff;
  const H = { data: null, profile: '', sig: '', timer: null };
  const css = document.createElement('style');
  css.textContent = `
  #afhome { position: fixed; top: 50px; left: 0; right: 0; bottom: 0; z-index: 40; overflow-y: auto; background:
    radial-gradient(900px 420px at 12% -8%, rgba(255,193,7,.10), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(139,123,255,.12), transparent 60%), var(--bg0); }
  #afhome[hidden] { display: none; }
  #afhome .wrap { max-width: 1240px; margin: 0 auto; padding: 22px 24px 40px; }
  .ah-hero { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: end; margin-bottom: 18px; }
  .ah-hero h1 { margin: 0; font-size: 24px; letter-spacing: -.02em; } .ah-hero h1 span { color: #FFC107; }
  .ah-hero p { margin: 4px 0 0; color: var(--tx3); font-size: 13px; }
  .ah-ch { display: flex; gap: 8px; align-items: center; } .ah-ch select { height: 34px; min-width: 180px; }
  .ah-go { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; padding: 10px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,193,7,.16), rgba(255,87,34,.10)); border: 1px solid rgba(255,193,7,.35); }
  .ah-go input { height: 44px; font-size: 14px; border-radius: 10px; background: var(--bg1); }
  .ah-go button { height: 44px; padding: 0 20px; font-size: 14px; font-weight: 700; border-radius: 10px; background: #FFC107; color: #111; border: 0; }
  .ah-go button:hover { filter: brightness(1.06); }
  .ah-quick { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 18px; } .ah-quick button { font-size: 12px; padding: 7px 12px; border-radius: 999px; }
  .ah-kpi { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
  .ah-kpi > div { background: var(--bg1); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .ah-kpi small { color: var(--tx3); font-size: 11px; display: block; } .ah-kpi b { display: block; font-size: 22px; margin: 4px 0 2px; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .ah-kpi em { font-style: normal; font-size: 11px; color: var(--ok); } .ah-kpi em.z { color: var(--tx3); }
  .ah-kpi .money b { color: #FFC107; }
  .ah-grid { display: grid; grid-template-columns: minmax(0,1.75fr) minmax(300px,1fr); gap: 16px; align-items: start; }
  .ah-card { background: var(--bg1); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; }
  .ah-card h3 { margin: 0 0 10px; font-size: 14px; display: flex; align-items: center; gap: 8px; } .ah-card h3 .r { margin-left: auto; font-weight: 500; font-size: 11.5px; color: var(--tx3); display: flex; gap: 6px; align-items: center; }
  .ah-card h3 i { color: var(--tx2); }
  .ah-plan { display: flex; flex-direction: column; gap: 6px; }
  .ah-pi { display: grid; grid-template-columns: 30px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px; background: var(--bg2); border: 1px solid var(--line); }
  .ah-pi .ic { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--acc-soft); color: var(--acc); }
  .ah-pi .ic.cl { background: rgba(52,211,153,.14); color: var(--ok); }
  .ah-pi b { font-size: 12.5px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ah-pi small { color: var(--tx3); font-size: 11px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ah-pi .n { font-size: 12px; color: var(--tx2); white-space: nowrap; }
  .ah-planbar { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; } .ah-planbar .grow { flex: 1; }
  .ah-planbar label { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--tx2); }
  .ah-planbar input[type=checkbox] { width: auto; margin: 0; }
  .ah-vids { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 8px; }
  .ah-prods { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
  .ah-p { display: grid; grid-template-columns: 56px minmax(0,1fr); gap: 10px; padding: 10px; border-radius: 12px; background: var(--bg2); border: 1px solid var(--line); }
  .ah-p .th { width: 56px; height: 56px; border-radius: 10px; background: var(--bg4) center/cover no-repeat; display: flex; align-items: center; justify-content: center; color: var(--tx3); font-size: 22px; }
  .ah-p b { font-size: 12.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .ah-p small { display: block; color: var(--tx3); font-size: 11px; margin-top: 2px; } .ah-p small .pr { color: var(--warn); font-weight: 700; }
  .ah-p .sc { display: inline-block; margin-top: 4px; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: rgba(255,193,7,.14); color: #FFC107; }
  .ah-p .ac { grid-column: 1 / 3; display: flex; gap: 4px; } .ah-p .ac .go { flex: 1; justify-content: center; }
  .ah-w { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); } .ah-w:first-of-type { border-top: 0; }
  .ah-w b { font-size: 12.5px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ah-w small { color: var(--tx3); font-size: 11px; } .ah-w small .up { color: var(--ok); font-weight: 600; }
  .ah-list { font-size: 12px; color: var(--tx2); } .ah-list > div { padding: 6px 0; border-top: 1px solid var(--line); display: flex; gap: 8px; align-items: center; } .ah-list > div:first-child { border-top: 0; }
  .ah-list .t { color: var(--tx3); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; } .ah-list .x { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .ah-setup > div { display: flex; gap: 8px; align-items: center; padding: 5px 0; font-size: 12px; color: var(--tx2); } .ah-setup .ok { color: var(--ok); } .ah-setup .ok + span { color: var(--tx3); text-decoration: line-through; }
  .ah-run { padding: 6px 0; border-top: 1px solid var(--line); font-size: 12px; } .ah-run:first-child { border-top: 0; } .ah-run small { color: var(--tx3); display: block; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ah-empty { color: var(--tx3); font-size: 12px; padding: 6px 0; line-height: 1.5; }
  .ah-foot { margin-top: 10px; text-align: center; color: var(--tx3); font-size: 11.5px; } .ah-foot a { color: var(--tx2); }
  .ah-pf { font-size: 9.5px; padding: 1px 6px; border-radius: 4px; background: #000; color: #fff; } .ah-pf.fb { background: #1877F2; }
  .ah-home-btn.on { color: #FFC107; border-color: rgba(255,193,7,.45); }
  @media (max-width: 1100px) { .ah-grid { grid-template-columns: 1fr; } .ah-kpi { grid-template-columns: repeat(3, 1fr); } .ah-vids { grid-template-columns: repeat(4, 1fr); } .ah-prods { grid-template-columns: repeat(2, 1fr); } }`;
  document.head.appendChild(css);

  const vnd = x => (x >= 1e6 ? `${(x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace('.', ',')} triệu` : `${Math.round(x || 0).toLocaleString('vi-VN')}đ`);
  const num = x => Math.round(x || 0).toLocaleString('vi-VN');
  const when = iso => { const d = new Date(iso); return `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const greet = () => { const h = new Date().getHours(); return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'; };

  const root = document.createElement('div'); root.id = 'afhome'; document.body.appendChild(root);
  const btn = Studio.addTopButton('<button class="ghost ah-home-btn on" title="Trang chủ affiliate"><i class="ti ti-home"></i> Trang chủ</button>', () => (root.hidden ? show() : hide()));
  function show() { root.hidden = false; btn.classList.add('on'); load(true); clearInterval(H.timer); H.timer = setInterval(() => !root.hidden && !document.hidden && load(false), 4000); }
  function hide() { root.hidden = true; btn.classList.remove('on'); clearInterval(H.timer); }

  async function load(force) {
    try {
      if (!A().S.meta) await A().load();
      const d = await Studio.api('/api/aff/home' + (H.profile ? `?profile=${encodeURIComponent(H.profile)}` : ''));
      if (d.error) throw new Error(d.error);
      H.profile = d.profile;
      const sig = JSON.stringify([d.kpi, d.running, d.recent.map(v => v.key + v.mp4), d.ran?.ran, d.winners.length, d.scores.map(s => s.score), d.schedule.length, d.setup.map(s => s.done), d.profiles]);
      if (!force && sig === H.sig) return; H.sig = sig; H.data = d; render();
    } catch (e) { if (force) root.innerHTML = `<div class="wrap"><p class="ah-empty">Không tải được trang chủ: ${esc(e.message)}</p></div>`; }
  }

  function render() {
    const d = H.data, k = d.kpi, prods = A().S.products, P = id => prods.find(x => x.id === id);
    const thumb = p => { const img = p?.media?.find(m => m.kind === 'image'); return img ? `background-image:url('${A().fileUrl(p.id, img.file)}')` : ''; };
    const wk = k.week || { orders: 0, commission: 0, views: 0 };
    const allSet = d.setup.every(s => s.done);
    root.innerHTML = `<div class="wrap">
      <div class="ah-hero"><div><h1>${greet()} 👋 <span>Hôm nay ra đơn nào?</span></h1>
        <p>Dán link sản phẩm → AI viết nhiều góc bán, dựng video gắn giỏ hàng, soát luật, xếp lịch. Bạn chỉ duyệt và bấm đăng.</p></div>
        <div class="ah-ch"><i class="ti ti-user-circle muted"></i><select id="ah-prof" title="Kênh">${d.profiles.map(p => `<option value="${esc(p.id)}" ${p.id === d.profile ? 'selected' : ''}>${esc(p.name)}${p.handle ? ` · ${esc(p.handle)}` : ''}</option>`).join('')}</select>
          <button class="icon" id="ah-chs" title="Quản lý kênh"><i class="ti ti-settings"></i></button></div></div>
      <div class="ah-go"><input id="ah-url" placeholder="Dán link sản phẩm TikTok Shop / Shopee / Lazada…  (Enter)"><button id="ah-add"><i class="ti ti-rocket"></i> Thêm & làm video</button></div>
      <div class="ah-quick">
        <button id="q-new"><i class="ti ti-plus"></i>Nhập sản phẩm tay</button><button id="q-csv"><i class="ti ti-table-import"></i>Nhập danh sách CSV/Excel</button>
        <button id="q-live"><i class="ti ti-broadcast"></i>Livestream → clip</button><button id="q-stats"><i class="ti ti-chart-arrows-vertical"></i>Nhập số liệu đơn</button>
        <button id="q-reply"><i class="ti ti-messages"></i>Trả lời bình luận</button><button id="q-broll"><i class="ti ti-movie"></i>Kho b-roll của tôi</button>
        <button id="q-rep"><i class="ti ti-report"></i>Báo cáo tuần</button><button id="q-edit"><i class="ti ti-layout-dashboard"></i>Mở trình dựng</button></div>
      <div class="ah-kpi">
        <div class="money"><small>Hoa hồng ước tính</small><b>${vnd(k.commission)}</b><em class="${wk.commission ? '' : 'z'}">${wk.commission ? '+' + vnd(wk.commission) + ' tuần này' : 'nhập số liệu để tính'}</em></div>
        <div><small>Đơn hàng</small><b>${num(k.orders)}</b><em class="${wk.orders ? '' : 'z'}">${wk.orders ? `+${num(wk.orders)} tuần này` : `${num(k.views)} lượt xem`}</em></div>
        <div><small>Đơn / 1.000 view</small><b>${k.opk ? k.opk.toFixed(2).replace('.', ',') : '—'}</b><em class="z">${k.with_stats} video có số liệu</em></div>
        <div><small>Video đã làm</small><b>${num(k.videos)}</b><em class="${k.made_week ? '' : 'z'}">${k.made_week ? `+${k.made_week} tuần này` : 'chưa có tuần này'}</em></div>
        <div><small>Sản phẩm</small><b>${num(k.products)}</b><em class="z">${d.running.length ? `${d.running.length} việc đang chạy` : 'hàng đợi trống'}</em></div></div>
      <div class="ah-grid"><div>
        ${planCard(d)}
        <div class="ah-card"><h3><i class="ti ti-movie"></i>Video mới làm<span class="r">${d.recent.length ? 'bấm để xem, đăng, nhân bản' : ''}</span></h3>
          ${d.recent.length ? `<div class="ah-vids">${d.recent.map(v => `<div class="af-v" data-hjob="${esc(v.job)}" data-hvid="${esc(v.key)}" title="${esc((P(v.product)?.name || '') + ' · ' + (v.angle_name || ''))}">${v.thumb ? `<img src="${A().pathUrl(v.thumb)}" loading="lazy">` : ''}<span class="pf ${v.platform === 'facebook' ? 'fb' : ''}">${v.platform === 'facebook' ? 'FB' : 'TikTok'}</span><span class="lb">${esc(v.angle_name || v.angle)}<br>hook ${esc(String(v.hook))}</span></div>`).join('')}</div>`
            : '<div class="ah-empty">Chưa có video. Dán link sản phẩm ở trên rồi bấm <b>Thêm & làm video</b> — khoảng 1 phút/video trên Mac M-series.</div>'}</div>
        <div class="ah-card"><h3><i class="ti ti-package"></i>Sản phẩm nên làm<span class="r">xếp theo hoa hồng kỳ vọng / 1.000 view · ${prods.length} sản phẩm</span></h3>
          ${d.scores.length ? `<div class="ah-prods">${d.scores.map(s => { const p = P(s.id); return `<div class="ah-p"><div class="th" style="${thumb(p)}">${thumb(p) ? '' : '<i class="ti ti-package"></i>'}</div>
            <div><b>${esc(s.name)}</b><small>${p?.price_txt ? `<span class="pr">${esc(p.price_txt)}</span> · ` : ''}HH ${s.commission_pct}% · ${s.videos} video</small><span class="sc" title="${esc(s.why.join(' · '))}">~${vnd(s.value)}/1k view</span></div>
            <div class="ac"><button class="primary go" data-hrun="${esc(s.id)}"><i class="ti ti-rocket"></i>Làm video</button><button class="icon" data-htools="${esc(s.id)}" title="Đào review, tách nền, trả lời bình luận"><i class="ti ti-dots"></i></button><button class="icon" data-hedit="${esc(s.id)}" title="Sửa"><i class="ti ti-pencil"></i></button></div></div>`; }).join('')}</div>`
            : '<div class="ah-empty">Thêm sản phẩm để được gợi ý.</div>'}</div>
      </div><div>
        ${d.running.length ? `<div class="ah-card"><h3><i class="ti ti-loader-2 spin"></i>Đang chạy</h3>${d.running.map(r => `<div class="ah-run">${esc(r.title || r.kind)}<small>${esc(r.state === 'queued' ? 'đang chờ' : r.step || '')}</small>${r.state === 'running' ? `<div class="af-bar"><i style="width:${Math.round((r.progress || 0) * 100)}%"></i></div>` : ''}</div>`).join('')}</div>` : ''}
        ${allSet ? '' : `<div class="ah-card"><h3><i class="ti ti-list-check"></i>Bắt đầu</h3><div class="ah-setup">${d.setup.map(s => `<div><i class="ti ${s.done ? 'ti-circle-check ok' : 'ti-circle'}"></i><span>${esc(s.label)}</span></div>`).join('')}</div></div>`}
        <div class="ah-card"><h3><i class="ti ti-trophy"></i>Video thắng<span class="r">nhân bản → 3 biến thể</span></h3>
          ${d.winners.length ? d.winners.map(w => `<div class="ah-w"><div><b>${esc(w.product_name)}</b><small>${esc(A().S.meta?.angles?.[w.angle]?.name || w.angle)} · ${w.platform === 'facebook' ? 'FB' : 'TikTok'} · <span class="up">${w.opk.toFixed(1)} đơn/1k</span> (gấp ${w.lift.toFixed(1)}×)${w.cloned ? ' · đã nhân' : ''}</small></div>${w.source === 'ai' && w.project ? `<button data-hclone="${esc(w.key)}"><i class="ti ti-copy-plus"></i>Nhân bản</button>` : '<small class="muted">video quay</small>'}</div>`).join('')
            : '<div class="ah-empty">Video ra đơn vượt mức chung (đủ chắc chắn) sẽ hiện ở đây để nhân bản. Cần nhập số liệu đơn hàng.</div>'}</div>
        <div class="ah-card"><h3><i class="ti ti-bulb"></i>Tự lái đã học</h3>${d.notes.length ? `<ul class="af-notes">${d.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<div class="ah-empty">Chưa đủ số liệu. Nhập file hiệu suất video từ TikTok Shop / Shopee mỗi tuần — mã theo dõi trong caption giúp khớp đúng từng video.</div>'}</div>
        <div class="ah-card"><h3><i class="ti ti-calendar-event"></i>Sắp đăng</h3>${d.schedule.length ? `<div class="ah-list">${d.schedule.map(x => `<div><span class="t">${when(x.when)}</span><span class="ah-pf ${x.platform === 'facebook' ? 'fb' : ''}">${x.platform === 'facebook' ? 'FB' : 'TT'}</span><span class="x">${esc(x.title || '')}</span></div>`).join('')}</div>` : '<div class="ah-empty">Chưa có lịch. Bật <b>Tự xếp lịch</b> khi chạy, hoặc chạy kế hoạch hôm nay.</div>'}</div>
        ${d.voices.length ? `<div class="ah-card"><h3><i class="ti ti-microphone"></i>Giọng nhân bản</h3><div class="ah-empty">${d.voices.map(esc).join('<br>')}<br>Chọn ở mục Giọng đọc khi làm video. Bộ đăng luôn nhắc bật nhãn “Nội dung do AI tạo”.</div></div>` : ''}
      </div></div>
      <div class="ah-foot">AI Affiliate Studio — dựa trên <a href="https://github.com/nguyentatkiem/ai-video-studio" target="_blank" rel="noopener">AI Video Studio</a> của <b>Nguyễn Tất Kiểm</b> · <a href="https://nguyentatkiem.com.vn/aiplusntk/" target="_blank" rel="noopener">Tặng khoá học AI miễn phí</a></div>
    </div>`;
    wire();
  }

  function planCard(d) {
    const P = d.plan, ran = d.ran, prof = d.profiles.find(p => p.id === d.profile) || {};
    const items = (ran?.items?.length ? ran.items : P.items);
    return `<div class="ah-card"><h3><i class="ti ti-sun"></i>Hôm nay làm gì<span class="r">${ran?.queued ? `<span style="color:var(--ok)">✓ đã chạy ${ran.source === 'auto' ? 'tự động ' : ''}lúc ${new Date(ran.ran).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>` : `${P.videos}/${P.quota} video · kênh ${esc(P.profile_name)}`}</span></h3>
      ${items.length ? `<div class="ah-plan">${items.map(it => `<div class="ah-pi"><div class="ic ${it.type === 'clone' ? 'cl' : ''}"><i class="ti ${it.type === 'clone' ? 'ti-copy-plus' : 'ti-rocket'}"></i></div>
        <div><b>${it.type === 'clone' ? 'Nhân bản video thắng: ' : 'Làm mới: '}${esc(it.name)}</b><small>${esc(it.why || '')}</small></div><span class="n">${it.n} video</span></div>`).join('')}</div>`
        : '<div class="ah-empty">Chưa có gì để làm: thêm sản phẩm có ảnh, giá và link affiliate.</div>'}
      <div class="ah-planbar">
        <label>Mục tiêu <select id="ah-quota" style="height:28px;width:auto">${[2, 4, 6, 8, 10, 15, 20].map(n => `<option ${n === (prof.aff_daily || 6) ? 'selected' : ''}>${n}</option>`).join('')}</select> video/ngày</label>
        <label title="Mỗi sáng (7h) tự lập kế hoạch và đưa vào hàng đợi, video tự xếp lịch đăng theo khung giờ của kênh"><input type="checkbox" id="ah-auto" ${prof.aff_auto_plan ? 'checked' : ''}>Tự chạy mỗi sáng</label>
        <div class="grow"></div>
        ${ran?.queued ? '' : `<button class="primary" id="ah-runplan" ${items.length ? '' : 'disabled'}><i class="ti ti-player-play"></i>Chạy kế hoạch (${P.videos} video)</button>`}</div></div>`;
  }

  function wire() {
    const d = H.data, S = A().S;
    $('#ah-prof').onchange = e => { H.profile = e.target.value; load(true); };
    $('#ah-chs').onclick = channels;
    const add = async () => {
      const url = $('#ah-url').value.trim(); if (!url) return $('#ah-url').focus();
      toast('Đang đọc trang sản phẩm…'); const r = await Studio.api('/api/aff/fetch', { url }); if (r.error) return toast(r.error);
      await A().load(); toast(r.warn || `Đã thêm “${r.product.name}” (${r.images} ảnh) — kiểm tra lại thông tin rồi chạy`);
      H.afterSave = r.product.id; // after saving the product the run dialog opens (see patched editProduct below)
      A().editProduct(S.products.find(p => p.id === r.product.id) || r.product); $('#ah-url').value = ''; load(true);
    };
    $('#ah-add').onclick = add; $('#ah-url').onkeydown = e => e.key === 'Enter' && add();
    $('#q-new').onclick = () => A().editProduct({});
    $('#q-csv').onclick = async () => { const [f] = await A().pickFile('.csv,.xlsx'); if (!f) return; toast('Đang nhập…'); const r = await A().upload(`/api/aff/import?name=${encodeURIComponent(f.name)}`, f); toast(r.error || `Đã nhập ${r.added} sản phẩm`); await A().load(); load(true); };
    $('#q-stats').onclick = async () => { const [f] = await A().pickFile('.csv,.xlsx'); if (!f) return; const x = await A().upload(`/api/aff/stats/import?name=${encodeURIComponent(f.name)}`, f); toast(x.error || `Khớp ${x.matched}/${x.rows} dòng${x.exact ? ` (${x.exact} chính xác theo mã)` : ''}`); load(true); };
    $('#q-live').onclick = () => { if (!S.products.length) return toast('Thêm ít nhất 1 sản phẩm trước'); A().runDialog(S.products[0]); setTimeout(() => { const r = $('#modalbox').querySelector('[name=r-src][value=live]'); if (r) { r.checked = true; r.dispatchEvent(new Event('change')); const m = $('#r-multi'); if (m && S.products.length > 1) m.checked = true; } }, 30); };
    $('#q-reply').onclick = () => pickProduct('Trả lời bình luận cho sản phẩm nào?', p => A().replyDialog(p));
    $('#q-broll').onclick = brollDialog;
    $('#q-rep').onclick = async () => { const r = await Studio.api('/api/aff/report'); modal(`<h3><i class="ti ti-report"></i> Báo cáo tuần</h3><pre style="max-height:60vh;white-space:pre-wrap;font-size:12px">${esc(r.md)}</pre><div class="actions"><button id="rp-save"><i class="ti ti-device-floppy"></i>Lưu file .md</button><button class="primary" onclick="closeModal()">Đóng</button></div>`); $('#rp-save').onclick = async () => { await Studio.api('/api/aff/report/save', {}); toast('Đã lưu báo cáo'); }; };
    $('#q-edit').onclick = hide;
    root.querySelectorAll('[data-hrun]').forEach(b => (b.onclick = () => A().runDialog(S.products.find(p => p.id === b.dataset.hrun))));
    root.querySelectorAll('[data-hedit]').forEach(b => (b.onclick = () => A().editProduct(S.products.find(p => p.id === b.dataset.hedit))));
    root.querySelectorAll('[data-htools]').forEach(b => (b.onclick = () => A().productTools(S.products.find(p => p.id === b.dataset.htools))));
    root.querySelectorAll('[data-hvid]').forEach(el => (el.onclick = async () => { if (!S.jobs.some(j => j.dir === el.dataset.hjob)) await A().load(); A().videoMenu(el.dataset.hjob, el.dataset.hvid); }));
    root.querySelectorAll('[data-hclone]').forEach(b => (b.onclick = async () => { const r = await Studio.api('/api/aff/clone', { key: b.dataset.hclone, n: 3 }); toast(r.error || 'Đã đưa vào hàng đợi: 3 biến thể của video thắng'); load(true); }));
    const saveProf = async patch => { const p = (await Studio.api('/api/autopilot/state')).profiles.list.find(x => x.id === d.profile); if (!p) return; await Studio.api('/api/autopilot/profile', { action: 'save', profile: { ...p, ...patch } }); };
    $('#ah-quota').onchange = async e => { await saveProf({ aff_daily: +e.target.value }); load(true); };
    $('#ah-auto').onchange = async e => { await saveProf({ aff_auto_plan: e.target.checked }); toast(e.target.checked ? 'Mỗi sáng 7h tự lập kế hoạch và làm video (cần Studio hoặc chạy nền đang bật)' : 'Đã tắt tự chạy'); load(true); };
    $('#ah-runplan')?.addEventListener('click', async () => { const r = await Studio.api('/api/aff/plan/run', { profile: d.profile, quota: +$('#ah-quota').value }); toast(r.error || `Đã đưa ${r.plan.items.length} việc (${r.plan.videos} video) vào hàng đợi, tự xếp lịch đăng`); load(true); });
  }

  function pickProduct(title, fn) {
    const S = A().S; if (!S.products.length) return toast('Chưa có sản phẩm');
    if (S.products.length === 1) return fn(S.products[0]);
    modal(`<h3>${esc(title)}</h3><div class="af-menu">${S.products.map(p => `<button data-pp="${esc(p.id)}"><i class="ti ti-package"></i>${esc(p.name)}</button>`).join('')}</div><div class="actions"><button onclick="closeModal()">Huỷ</button></div>`);
    $('#modalbox').querySelectorAll('[data-pp]').forEach(b => (b.onclick = () => fn(S.products.find(p => p.id === b.dataset.pp))));
  }

  // ---------- kho b-roll của tôi ----------
  async function brollDialog() {
    const r = await Studio.api('/api/aff/broll');
    modal(`<h3><i class="ti ti-movie"></i> Kho b-roll của tôi</h3>
      <p class="help">Quay một lần vài cảnh dùng chung (mỗi cảnh 3–6 giây, dọc 9:16): Tự lái chèn xen vào video không quay — video có người thật mà không phải quay lại mỗi lần. Bản này sẽ được học xem có người có ra đơn tốt hơn không.</p>
      <div class="af-menu">${Object.entries(r.tags).map(([t, name]) => `<div class="af-job" style="margin:0"><h4><span class="t">${esc(name)}</span><span class="r">${r.broll[t].length} cảnh</span><button class="icon" data-bup="${t}" title="Thêm cảnh"><i class="ti ti-upload"></i></button></h4>
        ${r.broll[t].length ? `<div class="st" style="white-space:normal">${r.broll[t].map(c => `${esc(c.file.replace(/^[a-z0-9]+_/, ''))} <a href="#" data-brm="${t}|${esc(c.file)}" title="Xoá">×</a>`).join(' · ')}</div>` : ''}</div>`).join('')}</div>
      <div class="actions"><button class="primary" onclick="closeModal()">Xong</button></div>`);
    const box = $('#modalbox');
    box.querySelectorAll('[data-bup]').forEach(b => (b.onclick = async () => { const fs = await A().pickFile('video/*', true); for (const f of fs) { toast('Tải lên ' + f.name); const x = await A().upload(`/api/aff/broll/upload?tag=${b.dataset.bup}&name=${encodeURIComponent(f.name)}`, f); if (x.error) toast(x.error); } brollDialog(); load(true); }));
    box.querySelectorAll('[data-brm]').forEach(a => (a.onclick = async e => { e.preventDefault(); const [tag, file] = a.dataset.brm.split('|'); await Studio.api('/api/aff/broll/remove', { tag, file }); brollDialog(); }));
  }

  // ---------- kênh (nhiều tài khoản) ----------
  async function channels() {
    const st = await Studio.api('/api/autopilot/state'), list = st.profiles.list, C = A().S.meta?.categories || {}, V = A().S.meta?.voices || [];
    modal(`<h3><i class="ti ti-users"></i> Kênh</h3>
      <p class="help">Mỗi kênh (tài khoản TikTok/Facebook) có giọng, persona, ngành hàng, khung giờ đăng và mục tiêu riêng. Tự lái không xếp lịch một video lên kênh này nếu kênh khác đã đăng bản gần giống (≥ 80%) trong 30 ngày.</p>
      <div class="af-menu">${list.map(p => `<button data-chp="${esc(p.id)}"><i class="ti ti-user-circle"></i>${esc(p.name)}${p.handle ? ` <small class="muted">${esc(p.handle)}</small>` : ''}${p.id === st.profiles.default ? ' <small class="muted">· mặc định</small>' : ''}</button>`).join('')}
        <button data-chp=""><i class="ti ti-plus"></i>Thêm kênh</button></div>
      <div class="actions"><button onclick="closeModal()">Đóng</button></div>`);
    $('#modalbox').querySelectorAll('[data-chp]').forEach(b => (b.onclick = () => editChannel(list.find(p => p.id === b.dataset.chp) || { name: '' }, C, V)));
  }
  function editChannel(p, C, V) {
    const cats = new Set(p.aff_categories || []);
    modal(`<h3><i class="ti ti-user-circle"></i> ${p.id ? 'Sửa kênh' : 'Kênh mới'}</h3><div class="af-form">
      <div><label>Tên kênh</label><input id="ch-name" value="${esc(p.name || '')}" placeholder="Kênh review gia dụng"></div>
      <div><label>Tài khoản</label><input id="ch-handle" value="${esc(p.handle || '')}" placeholder="@chimeoreview"></div>
      <div class="full"><label>Persona (giọng kênh)</label><input id="ch-persona" value="${esc(p.persona || '')}" placeholder="chị bán hàng vui vẻ, nói nhanh, hay khen thật"></div>
      <div><label>Giọng đọc</label><select id="ch-voice"><option value="auto">Tự chọn</option>${V.map(v => `<option value="${esc(v.id)}" ${p.voice === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
      <div><label>Khung giờ đăng riêng</label><input id="ch-slots" value="${esc((p.aff_slots || []).join(', '))}" placeholder="11:30, 20:00 (trống = khung chung)"></div>
      <div><label>Mục tiêu video/ngày</label><input id="ch-daily" type="number" min="1" max="50" value="${p.aff_daily ?? 6}"></div>
      <div><label>Nền tảng</label><div class="af-chips"><label><input type="checkbox" data-chpl value="tiktok" ${(p.aff_platforms || ['tiktok']).includes('tiktok') ? 'checked' : ''}>TikTok</label><label><input type="checkbox" data-chpl value="facebook" ${(p.aff_platforms || []).includes('facebook') ? 'checked' : ''}>Facebook</label></div></div>
      <div class="full"><label>Ngành hàng của kênh <small>(trống = mọi ngành)</small></label><div class="af-chips">${Object.entries(C).map(([k, n]) => `<label><input type="checkbox" data-chc value="${k}" ${cats.has(k) ? 'checked' : ''}>${esc(n)}</label>`).join('')}</div></div>
      <div class="full"><label style="display:flex;gap:6px;align-items:center;color:var(--tx2);font-size:12px"><input type="checkbox" id="ch-auto" style="width:auto;margin:0" ${p.aff_auto_plan ? 'checked' : ''}>Tự chạy kế hoạch mỗi sáng lúc <input id="ch-hour" type="number" min="0" max="23" value="${p.aff_plan_hour ?? 7}" style="width:56px;height:26px"> giờ</label></div>
      <div class="full"><label style="display:flex;gap:6px;align-items:center;color:var(--tx2);font-size:12px"><input type="checkbox" id="ch-broll" style="width:auto;margin:0" ${p.aff_own_broll !== false ? 'checked' : ''}>Chèn cảnh tự quay từ Kho b-roll của tôi</label></div>
      </div><div class="actions"><button onclick="closeModal()">Huỷ</button><button class="primary" id="ch-ok">Lưu</button></div>`);
    const box = $('#modalbox');
    $('#ch-ok').onclick = async () => {
      const name = $('#ch-name').value.trim(); if (!name) return toast('Cần tên kênh');
      const pl = [...box.querySelectorAll('[data-chpl]:checked')].map(x => x.value);
      const prof = { ...p, name, handle: $('#ch-handle').value.trim(), persona: $('#ch-persona').value.trim(), voice: $('#ch-voice').value, aff_slots: $('#ch-slots').value.split(/[,\s]+/).filter(x => /^\d{1,2}:\d{2}$/.test(x)),
        aff_daily: +$('#ch-daily').value || 6, aff_platforms: pl.length ? pl : ['tiktok'], aff_categories: [...box.querySelectorAll('[data-chc]:checked')].map(x => x.value), aff_auto_plan: $('#ch-auto').checked, aff_plan_hour: +$('#ch-hour').value || 7, aff_own_broll: $('#ch-broll').checked };
      const r = await Studio.api('/api/autopilot/profile', { action: 'save', profile: prof }); if (r.error) return toast(r.error);
      closeModal(); toast('Đã lưu kênh'); H.profile = r.profile?.id || H.profile; await A().load(); load(true);
    };
  }

  // open the run dialog right after the user saves a product added from the home link box
  const _edit = A().editProduct;
  Studio.aff.editProduct = p => { _edit(p); const id = H.afterSave; if (!id) return; H.afterSave = null; const b = $('#af-save'); if (!b) return; const orig = b.onclick; b.onclick = async e => { await orig(e); if ($('#modal').hidden) { await A().load(); const pr = A().S.products.find(x => x.id === id); if (pr) A().runDialog(pr); } }; };

  // first screen = this home; editor stays one click away. Opening a video in the editor reloads the page once → skip home that time.
  let skip = false; try { skip = sessionStorage.getItem('afhome-skip') === '1'; sessionStorage.removeItem('afhome-skip'); } catch {}
  if (skip) hide(); else show();
  Studio.aff.hideHome = hide;
})();
