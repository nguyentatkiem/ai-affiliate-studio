// Affiliate: thư viện Sản phẩm → Tự lái affiliate (nhiều góc bán × hook × nền tảng) → kết quả theo sản phẩm + Đăng; bảng Hiệu quả.
// Server: studio/routes/14_affiliate.mjs · scripts/products.mjs, autopilot_aff.mjs, aff_stats.mjs (references/affiliate.md).
(() => {
  const { $, esc, toast, modal, closeModal } = Studio;
  const S = { meta: null, products: [], jobs: [], profiles: [], defProfile: '', sig: '', open: {} };
  const css = document.createElement('style');
  css.textContent = `
  .af-add { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 6px; }
  .af-add input { height: 30px; font-size: 12px; }
  .af-tools { display: flex; gap: 6px; margin: 6px 0 4px; } .af-tools button { flex: 1; justify-content: center; font-size: 11.5px; }
  .af-p { display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 8px; padding: 8px; margin: 6px 0; background: var(--bg2); border: 1px solid var(--line); border-radius: var(--r); }
  .af-p.over { border-color: var(--acc); background: var(--acc-soft); }
  .af-p .th { width: 52px; height: 52px; border-radius: 8px; background: var(--bg4) center/cover no-repeat; display: flex; align-items: center; justify-content: center; color: var(--tx3); font-size: 20px; }
  .af-p .nm { font-weight: 650; font-size: 12.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .af-p .mt { font-size: 11px; color: var(--tx3); margin-top: 2px; } .af-p .mt b { color: var(--warn); font-weight: 700; } .af-p .mt .off { color: var(--bad); }
  .af-p .ac { grid-column: 1 / 3; display: flex; gap: 4px; } .af-p .ac .go { flex: 1; justify-content: center; } .af-p .ac .icon { width: 28px; padding: 0; justify-content: center; }
  .af-sec { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--tx3); margin: 14px 0 4px; display: flex; align-items: center; gap: 6px; }
  .af-sec .r { margin-left: auto; text-transform: none; letter-spacing: 0; }
  .af-job { background: var(--bg2); border: 1px solid var(--line); border-radius: var(--r); padding: 8px; margin: 6px 0; font-size: 11.5px; }
  .af-job h4 { margin: 0; font-size: 12px; display: flex; gap: 6px; align-items: center; } .af-job h4 .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .af-job h4 .r { margin-left: auto; color: var(--tx3); font-weight: 500; font-size: 10.5px; }
  .af-job .st { color: var(--tx3); font-size: 10.5px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .af-job .st.err { color: var(--bad); white-space: normal; }
  .af-bar { height: 4px; background: var(--bg4); border-radius: 3px; overflow: hidden; margin-top: 6px; } .af-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--acc2), var(--wave)); transition: width .4s; }
  .af-warn { color: var(--warn); font-size: 10.5px; margin-top: 4px; }
  .af-vids { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; margin-top: 8px; }
  .af-v { position: relative; border-radius: 8px; overflow: hidden; background: var(--bg4); aspect-ratio: 9/16; cursor: pointer; }
  .af-v img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .af-v .lb { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 5px 4px; font-size: 9.5px; line-height: 1.25; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,.85)); }
  .af-v .pf { position: absolute; top: 4px; left: 4px; font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,.65); color: #fff; }
  .af-v .pf.fb { background: #1877F2; }
  .af-menu { display: flex; flex-direction: column; gap: 6px; } .af-menu button { justify-content: flex-start; }
  .af-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; max-height: 62vh; overflow: auto; padding-right: 4px; }
  .af-form label { font-size: 10.5px; color: var(--tx3); display: block; margin-bottom: 2px; } .af-form .full { grid-column: 1 / 3; }
  .af-form textarea { min-height: 52px; font-size: 12px; } .af-form small { color: var(--tx3); font-size: 10.5px; }
  .af-chips { display: flex; flex-wrap: wrap; gap: 4px; } .af-chips label { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid var(--line2); border-radius: 999px; font-size: 11px; color: var(--tx2); cursor: pointer; margin: 0; }
  .af-chips input { width: auto; margin: 0; } .af-chips label:has(input:checked) { border-color: var(--acc); color: var(--tx); background: var(--acc-soft); }
  .af-media { display: flex; flex-wrap: wrap; gap: 6px; } .af-media div { position: relative; width: 64px; height: 64px; border-radius: 8px; background: var(--bg4) center/cover; }
  .af-media div button { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; padding: 0; justify-content: center; border-radius: 50%; }
  .af-media .vid::after { content: '▶'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; text-shadow: 0 1px 3px #000; }
  .af-tb { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0 8px; } .af-tb td, .af-tb th { padding: 4px 3px; border-top: 1px solid var(--line); text-align: right; } .af-tb th { color: var(--tx3); font-weight: 500; }
  .af-tb td:first-child, .af-tb th:first-child { text-align: left; } .af-tb tr.top td { color: var(--ok); }
  .af-kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; } .af-kpi div { background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
  .af-kpi b { display: block; font-size: 15px; } .af-kpi small { color: var(--tx3); font-size: 10px; }
  .af-notes { font-size: 11.5px; color: var(--tx2); padding-left: 16px; margin: 4px 0; } .af-notes li { margin: 3px 0; }`;
  document.head.appendChild(css);

  const api = (u, b) => Studio.api(u, b);
  const fileUrl = (p, f) => `/api/aff/file?p=${encodeURIComponent(p)}&f=${encodeURIComponent(f)}`;
  const pathUrl = f => `/api/aff/file?path=${encodeURIComponent(f)}`;
  const isActive = id => document.querySelector('#rail .on')?.dataset.p === id;
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const pickFile = (accept, multiple) => new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.onchange = () => ok([...i.files]); i.click(); });
  async function upload(url, file) { const r = await fetch(url, { method: 'POST', body: file }); return r.json(); }
  const VS = { done: 'Xong', running: 'Đang chạy', error: 'Lỗi' };

  async function load() {
    const [m, pr, jb, ap] = await Promise.all([S.meta ? null : api('/api/aff/meta'), api('/api/aff/products'), api('/api/aff/jobs'), api('/api/autopilot/state').catch(() => null)]);
    if (m) S.meta = m;
    S.products = pr.products || []; S.jobs = jb.jobs || [];
    if (ap?.profiles) { S.profiles = ap.profiles.list; S.defProfile = ap.profiles.default; S.queue = ap.items.filter(x => x.kind === 'aff' && ['queued', 'running'].includes(x.state)); S.clips = ap.items.filter(x => x.kind === 'afflive' || (x.kind === 'autopilot' && x.opts?.product)).slice(-12).reverse(); }
  }
  async function refresh(force) {
    await load().catch(() => {});
    const sig = JSON.stringify([S.products.map(p => [p.id, p.updated]), S.jobs.map(j => [j.dir, j.state, j.progress, j.videos.length, j.step]), S.queue?.map(q => [q.id, q.state]), S.clips?.map(q => [q.id, q.state, Math.round((q.progress || 0) * 50)])]);
    if (isActive('aff') && (force || sig !== S.sig)) render();
    S.sig = sig;
  }

  // ---------- panel: products + jobs ----------
  function render() {
    $('#libact').innerHTML = `<button class="icon" id="af-refresh" title="Tải lại"><i class="ti ti-refresh"></i></button>`;
    $('#af-refresh').onclick = () => refresh(true);
    const B = $('#libbody');
    const prodJobs = id => S.jobs.filter(j => j.product === id);
    B.innerHTML = `
      <div class="af-add"><input id="af-url" placeholder="Dán link sản phẩm TikTok Shop / Shopee…"><button class="primary" id="af-fetch"><i class="ti ti-link"></i>Thêm</button></div>
      <div class="af-tools"><button id="af-new"><i class="ti ti-plus"></i>Nhập tay</button><button id="af-csv"><i class="ti ti-table-import"></i>Nhập CSV/Excel</button></div>
      <div class="af-sec">Sản phẩm <span class="r">${S.products.length}</span></div>
      ${S.products.length ? '' : '<div class="help">Chưa có sản phẩm. Dán link, nhập tay, hoặc nhập file xuất từ trung tâm affiliate. Kéo ảnh/video sản phẩm thả vào thẻ để thêm hình.</div>'}
      ${S.products.map(p => {
        const img = p.media.find(m => m.kind === 'image'), last = prodJobs(p.id)[0];
        return `<div class="af-p" data-id="${esc(p.id)}">
          <div class="th" style="${img ? `background-image:url('${fileUrl(p.id, img.file)}')` : ''}">${img ? '' : '<i class="ti ti-package"></i>'}</div>
          <div><div class="nm">${esc(p.name)}</div>
            <div class="mt">${p.price_txt ? `<b>${esc(p.price_txt)}</b>` : 'chưa có giá'}${p.discount ? ` <span class="off">−${p.discount}%</span>` : ''} · ${p.media.length} ảnh/video${p.commission_pct ? ` · HH ${p.commission_pct}%` : ''}</div>
            <div class="mt">${esc(S.meta?.categories?.[p.category] || '')}${last ? ` · ${last.videos.length} video` : ''}</div></div>
          <div class="ac"><button class="primary go" data-run="${esc(p.id)}"><i class="ti ti-rocket"></i>Làm video</button>
            <button class="icon" title="Thêm ảnh/video" data-med="${esc(p.id)}"><i class="ti ti-photo-plus"></i></button>
            <button class="icon" title="Sửa" data-edit="${esc(p.id)}"><i class="ti ti-pencil"></i></button>
            <button class="icon" title="Xoá" data-del="${esc(p.id)}"><i class="ti ti-trash"></i></button></div></div>`;
      }).join('')}
      <div class="af-sec">Video đã làm <span class="r">${S.jobs.reduce((a, j) => a + j.videos.filter(v => v.mp4).length, 0)}</span></div>
      ${(S.queue || []).filter(q => q.state === 'queued').map(q => `<div class="af-job"><h4><i class="ti ti-clock muted"></i><span class="t">${esc(q.title || q.input)}</span><span class="r">đang chờ</span></h4></div>`).join('')}
      ${(S.clips || []).map(clipHTML).join('')}
      ${S.jobs.map(jobHTML).join('') || '<div class="help">Bấm <b>Làm video</b> trên một sản phẩm: AI viết nhiều góc bán × nhiều hook, kiểm tra chính sách, dựng và xuất MP4 kèm bộ đăng.</div>'}`;
    $('#af-fetch').onclick = addLink; $('#af-url').onkeydown = e => e.key === 'Enter' && addLink();
    $('#af-new').onclick = () => editProduct({});
    $('#af-csv').onclick = async () => { const [f] = await pickFile('.csv,.xlsx'); if (!f) return; toast('Đang nhập…'); const r = await upload(`/api/aff/import?name=${encodeURIComponent(f.name)}`, f); toast(r.error || `Đã nhập ${r.added} sản phẩm`); refresh(true); };
    B.querySelectorAll('[data-run]').forEach(b => (b.onclick = () => runDialog(S.products.find(p => p.id === b.dataset.run))));
    B.querySelectorAll('[data-edit]').forEach(b => (b.onclick = () => editProduct(S.products.find(p => p.id === b.dataset.edit))));
    B.querySelectorAll('[data-del]').forEach(b => (b.onclick = async () => { if (!confirm('Xoá sản phẩm này cùng ảnh/video của nó? (Video đã làm vẫn giữ)')) return; await api('/api/aff/product/delete', { id: b.dataset.del }); refresh(true); }));
    B.querySelectorAll('[data-med]').forEach(b => (b.onclick = async () => { const fs = await pickFile('image/*,video/*', true); await addMedia(b.dataset.med, fs); }));
    B.querySelectorAll('.af-p').forEach(c => {
      c.ondragover = e => { e.preventDefault(); c.classList.add('over'); }; c.ondragleave = () => c.classList.remove('over');
      c.ondrop = e => { e.preventDefault(); c.classList.remove('over'); addMedia(c.dataset.id, [...e.dataTransfer.files]); };
    });
    B.querySelectorAll('[data-vid]').forEach(el => (el.onclick = () => videoMenu(el.dataset.job, el.dataset.vid)));
    B.querySelectorAll('[data-crev]').forEach(b => (b.onclick = () => api('/api/autopilot/item', { id: b.dataset.crev, action: 'reveal' })));
    B.querySelectorAll('[data-copen]').forEach(b => (b.onclick = async () => { const r = await api('/api/autopilot/item', { id: b.dataset.copen, action: 'open' }); if (r.error) return toast(r.error); await openInEditor(); toast('Đã mở trong editor'); }));
    B.querySelectorAll('[data-jrev]').forEach(b => (b.onclick = () => api('/api/aff/reveal', { path: b.dataset.jrev })));
    B.querySelectorAll('[data-jfold]').forEach(b => (b.onclick = () => { S.open[b.dataset.jfold] = !S.open[b.dataset.jfold]; render(); }));
  }
  function jobHTML(j) {
    const p = S.products.find(x => x.id === j.product), run = j.state === 'running' && j.progress != null, vids = j.videos.filter(v => v.mp4 || v.built);
    const ic = j.state === 'done' ? 'ti-circle-check ap-ok' : j.state === 'error' ? 'ti-alert-triangle ap-bad' : 'ti-loader-2 spin ap-run';
    const open = S.open[j.dir] ?? (run || j.state === 'error');
    return `<div class="af-job"><h4><i class="ti ${ic}"></i><span class="t">${esc(p?.name || j.product)}</span><span class="r">${esc(VS[j.state] || j.state)} · ${vids.length} video</span>
        <button class="icon" title="Chi tiết các bước" data-jfold="${esc(j.dir)}"><i class="ti ti-list-details"></i></button><button class="icon" title="Hiện thư mục" data-jrev="${esc(j.dir)}"><i class="ti ti-folder"></i></button></h4>
      ${run ? `<div class="st">${esc(j.step || '')}</div><div class="af-bar"><i style="width:${Math.round(j.progress * 100)}%"></i></div>` : ''}
      ${j.error ? `<div class="st err">${esc(j.error)}</div>` : ''}
      ${(j.warnings || []).map(w => `<div class="af-warn">⚠ ${esc(w)}</div>`).join('')}
      ${open ? `<div class="ap-steps">${j.steps.map(s => `<div class="ap-step ${s.state || ''}"><i class="ti ${s.state === 'done' ? 'ti-check' : s.state === 'running' ? 'ti-loader-2 spin' : s.state === 'error' ? 'ti-x' : s.state === 'warn' ? 'ti-alert-circle' : s.state === 'skipped' ? 'ti-minus' : 'ti-point'}"></i>
        <span>${esc(s.label)}${s.msg || s.detail ? `<small>${esc(s.msg || s.detail)}</small>` : ''}</span><span class="s">${s.sec != null ? s.sec + 's' : ''}</span></div>`).join('')}</div>` : ''}
      ${vids.length ? `<div class="af-vids">${vids.map(v => `<div class="af-v" data-job="${esc(j.dir)}" data-vid="${esc(v.key)}" title="${esc(v.angle_name)} · hook ${v.hook}">
        ${v.thumb ? `<img src="${pathUrl(v.thumb)}" loading="lazy">` : ''}<span class="pf ${v.platform === 'facebook' ? 'fb' : ''}">${v.platform === 'facebook' ? 'FB' : 'TikTok'}</span>
        <span class="lb">${esc(v.angle_name || v.angle)}<br>hook ${esc(String(v.hook))}${v.mp4 ? '' : ' · đang xuất'}</span></div>`).join('')}</div>` : ''}</div>`;
  }
  function clipHTML(q) {
    const p = S.products.find(x => x.id === q.opts?.product), live = q.kind === 'afflive';
    const ic = q.state === 'done' ? 'ti-circle-check ap-ok' : q.state === 'error' ? 'ti-alert-triangle ap-bad' : q.state === 'running' ? 'ti-loader-2 spin ap-run' : 'ti-clock muted';
    return `<div class="af-job"><h4><i class="ti ${ic}"></i><span class="t">${live ? '📡 Livestream' : '🎬 Clip quay'} · ${esc(p?.name || q.opts?.product || '')}</span>
        ${q.project ? `<button class="icon" title="Mở trong editor" data-copen="${esc(q.id)}"><i class="ti ti-edit"></i></button>` : ''}<button class="icon" title="Hiện kết quả" data-crev="${esc(q.id)}"><i class="ti ti-folder"></i></button></h4>
      <div class="st ${q.state === 'error' ? 'err' : ''}">${esc(q.state === 'error' ? q.error || 'Lỗi' : q.step || '')}</div>
      ${q.state === 'running' ? `<div class="af-bar"><i style="width:${Math.round((q.progress || 0) * 100)}%"></i></div>` : ''}</div>`;
  }
  async function addLink() {
    const url = $('#af-url').value.trim(); if (!url) return;
    toast('Đang đọc trang sản phẩm…');
    const r = await api('/api/aff/fetch', { url });
    if (r.error) return toast(r.error);
    await refresh(true); toast(r.warn || `Đã thêm “${r.product.name}” (${r.images} ảnh)`);
    editProduct(r.product);
  }
  async function addMedia(id, files) {
    files = files.filter(f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|mp4|mov|m4v)$/i.test(f.name)); if (!files.length) return;
    for (const [i, f] of files.entries()) { toast(`Tải lên ${i + 1}/${files.length}: ${f.name}`); const r = await upload(`/api/aff/media/upload?p=${encodeURIComponent(id)}&name=${encodeURIComponent(f.name)}`, f); if (r.error) toast(r.error); }
    toast('Đã thêm ảnh/video'); refresh(true);
  }

  // ---------- product form ----------
  function editProduct(p0) {
    const p = { links: {}, usp: [], pains: [], claims_ok: [], claims_ban: [], media: [], ...p0 }, C = S.meta?.categories || {};
    const L = (k, label, v, ph = '', type = 'text') => `<div><label>${label}</label><input data-k="${k}" type="${type}" value="${esc(v ?? '')}" placeholder="${esc(ph)}"></div>`;
    const T = (k, label, v, ph = '') => `<div class="full"><label>${label}</label><textarea data-k="${k}" placeholder="${esc(ph)}">${esc((v || []).join ? v.join('\n') : v || '')}</textarea></div>`;
    modal(`<h3>${p.id ? 'Sửa sản phẩm' : 'Sản phẩm mới'}</h3>
      <div class="af-form">
        <div class="full"><label>Tên sản phẩm</label><input data-k="name" value="${esc(p.name || '')}"></div>
        <div><label>Ngành hàng <small>(quyết định luật kiểm duyệt)</small></label><select data-k="category">${Object.entries(C).map(([k, n]) => `<option value="${k}" ${p.category === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        ${L('brand', 'Thương hiệu / shop', p.brand)}
        ${L('price', 'Giá bán', p.price_txt || p.price, '199000 hoặc 199k')}${L('old_price', 'Giá gốc (gạch)', p.old_txt || p.old_price, 'để trống nếu không giảm')}
        ${L('voucher', 'Voucher / ưu đãi', p.voucher, 'vd Giảm thêm 10% khi dùng mã ABC')}${L('commission_pct', 'Hoa hồng %', p.commission_pct)}
        ${L('links.tiktok', 'Link TikTok Shop', p.links.tiktok, 'để gắn giỏ hàng')}${L('tiktok_product_id', 'ID sản phẩm TikTok', p.tiktok_product_id, 'tự lấy từ link nếu có')}
        ${L('links.shopee', 'Link affiliate Shopee / khác', p.links.shopee, 'cho bình luận Facebook')}${L('deal_until', 'Ưu đãi đến', p.deal_until, 'vd 30/11')}
        ${T('usp', 'Điểm nổi bật — mỗi dòng một ý (AI chỉ được nói những điều có ở đây)', p.usp, 'Không bết dính\nNâng tông nhẹ tự nhiên')}
        ${T('pains', 'Vấn đề khách hay gặp — mỗi dòng một ý', p.pains, 'Da dầu bóng nhờn giữa trưa')}
        <div class="full"><label>Khách hàng mục tiêu</label><input data-k="audience" value="${esc(p.audience || '')}" placeholder="vd Dân văn phòng da dầu 20–30 tuổi"></div>
        ${T('claims_ok', 'Được nói thêm (đã có số liệu thật: số đơn, số sao…)', p.claims_ok)}${T('claims_ban', 'Cấm nói (từ/cụm từ)', p.claims_ban)}
        ${T('notes', 'Mô tả của shop', p.notes)}
        ${p.id ? `<div class="full"><label>Ảnh / video (${p.media.length}) — kéo thả vào thẻ sản phẩm để thêm</label><div class="af-media">${p.media.map(m => `<div class="${m.kind === 'video' ? 'vid' : ''}" style="${m.kind === 'image' ? `background-image:url('${fileUrl(p.id, m.file)}')` : ''}"><button data-rm="${esc(m.file)}" title="Bỏ">×</button></div>`).join('')}
          <div style="display:flex;align-items:center;justify-content:center;cursor:pointer" id="af-addm"><i class="ti ti-plus"></i></div></div></div>` : ''}
      </div>
      <div class="actions"><button onclick="closeModal()">Huỷ</button><button class="primary" id="af-save"><i class="ti ti-device-floppy"></i>Lưu</button></div>`);
    const box = $('#modalbox');
    box.querySelectorAll('[data-rm]').forEach(b => (b.onclick = async () => { await api('/api/aff/media/remove', { id: p.id, file: b.dataset.rm }); b.parentElement.remove(); refresh(true); }));
    box.querySelector('#af-addm')?.addEventListener('click', async () => { const fs = await pickFile('image/*,video/*', true); await addMedia(p.id, fs); closeModal(); editProduct(S.products.find(x => x.id === p.id)); });
    $('#af-save').onclick = async () => {
      const o = { ...(p.id ? { id: p.id } : {}), links: {} };
      box.querySelectorAll('[data-k]').forEach(el => { const k = el.dataset.k, v = el.tagName === 'TEXTAREA' && !['notes'].includes(k) ? lines(el.value) : el.value.trim(); if (k.startsWith('links.')) o.links[k.slice(6)] = v; else o[k] = v; });
      if (!o.name) return toast('Cần tên sản phẩm');
      const r = await api('/api/aff/product', { product: o }); if (r.error) return toast(r.error);
      closeModal(); toast('Đã lưu sản phẩm'); refresh(true);
    };
  }

  // ---------- run dialog ----------
  function runDialog(p) {
    const A = S.meta?.angles || {}, prof = S.profiles.find(x => x.id === S.defProfile) || {};
    const plats = prof.aff_platforms || ['tiktok'];
    modal(`<h3><i class="ti ti-rocket"></i> Làm video — ${esc(p.name)}</h3>
      ${!p.media.length ? '<p class="af-warn">⚠ Sản phẩm chưa có ảnh/video: video sẽ dùng hình minh hoạ chung. Nên thêm ảnh thật trước.</p>' : ''}
      <div class="af-chips" style="margin-bottom:10px"><label><input type="radio" name="r-src" value="ai" checked>Không quay — AI dựng từ ảnh/video sản phẩm</label>
        <label><input type="radio" name="r-src" value="clip">Clip tôi quay (review, unbox)</label><label><input type="radio" name="r-src" value="live">Livestream dài → nhiều clip</label></div>
      <div id="r-clip" hidden><p class="help">Chọn file video. Tự lái sẽ nhận giọng, cắt lỗi nói, phụ đề, gắn thẻ giá khi bạn nhắc giá, nhãn giỏ hàng ở cuối, soát lời nói theo luật, xuất MP4 + bộ đăng.</p>
        <div class="af-tools"><button id="r-file"><i class="ti ti-file-upload"></i><span>Chọn video…</span></button></div></div>
      <div class="af-form" id="r-ai">
        <div><label>Số góc bán</label><select id="r-ang">${[1, 2, 3, 4, 5].map(n => `<option ${n === (prof.aff_angles || 3) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label>Hook mỗi góc (A/B test)</label><select id="r-hook">${[1, 2, 3].map(n => `<option ${n === (prof.aff_hooks || 2) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label>Độ dài</label><select id="r-dur">${[20, 30, 45, 60].map(n => `<option value="${n}" ${n === (prof.aff_dur || 30) ? 'selected' : ''}>${n} giây</option>`).join('')}</select></div>
        <div><label>Giọng đọc</label><select id="r-voice"><option value="auto">Tự chọn (Hoài My nếu có mạng)</option>${(S.meta?.voices || []).map(v => `<option value="${esc(v.id)}" ${prof.voice === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
        <div class="full"><label>Nền tảng (mỗi nền tảng một bản)</label><div class="af-chips">
          <label><input type="checkbox" value="tiktok" data-pl ${plats.includes('tiktok') ? 'checked' : ''}>TikTok — giỏ hàng</label>
          <label><input type="checkbox" value="facebook" data-pl ${plats.includes('facebook') ? 'checked' : ''}>Facebook Reels — link ở bình luận</label></div></div>
        <div class="full"><label>Góc bán <small>(để trống = AI tự chọn, ưu tiên góc ra đơn tốt)</small></label><div class="af-chips">${Object.entries(A).filter(([k]) => !(S.meta?.angle_block?.[p.category] || []).includes(k) && (k !== 'truoc-sau' || ['gia-dung', 'thoi-trang', 'khac'].includes(p.category))).map(([k, a]) => `<label title="${esc(a.how)}"><input type="checkbox" value="${k}" data-an>${esc(a.name)}</label>`).join('')}</div></div>
        <div><label>Hồ sơ kênh</label><select id="r-prof">${S.profiles.map(x => `<option value="${esc(x.id)}" ${x.id === S.defProfile ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
        <div><label>Chép kết quả vào thư mục <small>(tuỳ chọn)</small></label><input id="r-out" placeholder="~/Movies/Affiliate"></div>
        <div class="full"><label style="display:flex;gap:6px;align-items:center;color:var(--tx2);font-size:12px"><input type="checkbox" id="r-sch" style="width:auto;margin:0" ${prof.aff_autoschedule ? 'checked' : ''}>Tự rải vào Lịch đăng (nhắc đúng giờ, mở trang đăng, chép sẵn caption)</label></div>
      </div>
      <p class="help" id="r-sum"></p>
      <div class="actions"><button onclick="closeModal()">Huỷ</button><button class="primary" id="r-go"><i class="ti ti-player-play"></i>Chạy Tự lái</button></div>`);
    const box = $('#modalbox');
    let clipFile = null;
    const src = () => box.querySelector('[name=r-src]:checked').value;
    box.querySelectorAll('[name=r-src]').forEach(r => (r.onchange = () => { $('#r-clip').hidden = src() === 'ai'; box.querySelectorAll('#r-ai > div').forEach((d, i) => { if (i < 4 || i === 5 || i >= 7) d.hidden = src() !== 'ai'; }); sum(); }));
    $('#r-file').onclick = async () => { const [f] = await pickFile('video/*'); if (f) { clipFile = f; $('#r-file span').textContent = f.name; } };
    const sum = () => { if (src() !== 'ai') { $('#r-sum').textContent = src() === 'live' ? 'Claude chọn ~5 đoạn hay nhất, mỗi đoạn thành 1 clip 9:16 có gắn sản phẩm.' : 'Một video hoàn chỉnh từ clip của bạn, có gắn sản phẩm.'; return; } const n = +$('#r-ang').value * +$('#r-hook').value * Math.max(1, box.querySelectorAll('[data-pl]:checked').length); $('#r-sum').textContent = `Sẽ làm ${n} video (~${Math.max(1, Math.round(n * 1.2))} phút trên máy Mac M-series). Chạy nền, tắt Studio vẫn chạy nếu bật LaunchAgent ở tab Tự lái.`; };
    box.querySelectorAll('select,input').forEach(el => el.addEventListener('change', sum)); sum();
    $('#r-go').onclick = async () => {
      const platforms = [...box.querySelectorAll('[data-pl]:checked')].map(x => x.value);
      if (!platforms.length) return toast('Chọn ít nhất 1 nền tảng');
      if (src() !== 'ai') {
        if (!clipFile) return toast('Chọn file video trước');
        toast('Đang tải video lên…');
        const r = await upload(`/api/aff/clip?p=${encodeURIComponent(p.id)}&mode=${src()}&platform=${platforms[0]}&profile=${encodeURIComponent($('#r-prof').value)}&name=${encodeURIComponent(clipFile.name)}`, clipFile);
        if (r.error) return toast(r.error);
        closeModal(); toast('Đã đưa vào hàng đợi'); return refresh(true);
      }
      const angle = [...box.querySelectorAll('[data-an]:checked')].map(x => x.value);
      const r = await api('/api/aff/run', { product: p.id, angles: +$('#r-ang').value, hooks: +$('#r-hook').value, dur: +$('#r-dur').value, voice: $('#r-voice').value, platforms, angle, profile: $('#r-prof').value, out: $('#r-out').value.trim(), schedule: $('#r-sch').checked });
      if (r.error) return toast(r.error);
      closeModal(); toast('Đã đưa vào hàng đợi Tự lái'); refresh(true);
    };
  }

  // Studio started without a project has no preview frame yet → a full reload builds it around the opened project.
  const openInEditor = () => (Studio.win ? Studio.reload() : location.reload());

  // ---------- per-video actions ----------
  function videoMenu(dir, key) {
    const j = S.jobs.find(x => x.dir === dir), v = j?.videos.find(x => x.key === key); if (!v) return;
    const fb = v.platform === 'facebook';
    modal(`<h3>${esc(v.angle_name)} · hook ${esc(String(v.hook))} · ${fb ? 'Facebook' : 'TikTok'}</h3>
      ${v.mp4 ? `<video src="${pathUrl(v.mp4)}" controls style="width:100%;max-height:46vh;border-radius:10px;background:#000"></video>` : '<p class="help">Video chưa xuất xong.</p>'}
      <div class="af-menu" style="margin-top:10px">
        ${v.mp4 ? `<button class="primary" data-a="post"><i class="ti ti-send"></i>Đăng ${fb ? 'Facebook' : 'TikTok'}: chép caption, mở trang đăng, hiện file</button>` : ''}
        ${v.kit ? `<button data-a="kit"><i class="ti ti-file-text"></i>Xem bộ đăng (caption, gắn giỏ, bình luận đầu)</button>` : ''}
        <button data-a="edit"><i class="ti ti-edit"></i>Mở trong editor để chỉnh</button>
        ${v.mp4 ? `<button data-a="reveal"><i class="ti ti-folder"></i>Hiện file trong Finder</button>` : ''}
      </div><div class="actions"><button onclick="closeModal()">Đóng</button></div>`);
    const box = $('#modalbox');
    box.querySelectorAll('[data-a]').forEach(b => (b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'post') { const r = await api('/api/aff/post', { project: v.project, platform: v.platform }); toast(r.error || (r.copied ? 'Đã chép caption — dán vào ô mô tả. Nhớ gắn sản phẩm + bật nhãn AI.' : 'Đã mở trang đăng')); if (r.kit) showKit(r.kit); }
      if (a === 'kit') { const r = await fetch(pathUrl(v.kit)); modal(`<h3>Bộ đăng</h3><pre style="white-space:pre-wrap;max-height:60vh;overflow:auto;font-size:12px">${esc(await r.text())}</pre><div class="actions"><button onclick="closeModal()">Đóng</button></div>`); }
      if (a === 'edit') { const r = await api('/api/aff/open', { dir: v.project }); if (r.error) return toast(r.error); closeModal(); await openInEditor(); toast('Đã mở video trong editor'); }
      if (a === 'reveal') api('/api/aff/reveal', { path: v.mp4 });
    }));
  }
  function showKit(k) {
    modal(`<h3>Việc cần làm khi đăng</h3><ol class="af-notes">${k.checklist.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${k.attach?.product_id ? `<p class="help">ID sản phẩm: <b>${esc(k.attach.product_id)}</b> <button data-copy="${esc(k.attach.product_id)}">Chép</button></p>` : ''}
      ${k.first_comment ? `<p class="help">Bình luận đầu: <button data-copy="${esc(k.first_comment)}">Chép bình luận</button></p>` : ''}
      <div class="actions"><button class="primary" onclick="closeModal()">Xong</button></div>`);
    $('#modalbox').querySelectorAll('[data-copy]').forEach(b => (b.onclick = async () => { await api('/api/aff/copy', { text: b.dataset.copy }); toast('Đã chép'); }));
  }

  // ---------- panel: Hiệu quả (stats) ----------
  const AV = () => Object.fromEntries(Object.entries(S.meta?.angles || {}).map(([k, a]) => [k, a.name]));
  const HV = { 'cau-hoi': 'Câu hỏi', 'gay-soc': 'Gây bất ngờ', 'con-so': 'Con số', 'canh-bao': 'Cảnh báo', pov: 'POV', 'loi-ich': 'Lợi ích' };
  async function renderStats() {
    $('#libbody').innerHTML = '<div class="help">Đang tải…</div>';
    const r = await api('/api/aff/stats'), R = r.report, n = x => Math.round(x).toLocaleString('vi-VN');
    const tb = (rows, names) => rows.length ? `<table class="af-tb"><tr><th></th><th>video</th><th>view</th><th>đơn</th><th>đơn/1k</th><th>CTR</th></tr>${rows.map((x, i) => `<tr class="${i === 0 && x.orders ? 'top' : ''}"><td>${esc(names[x.key] || x.key)}</td><td>${x.n}</td><td>${n(x.views)}</td><td>${n(x.orders)}</td><td>${x.opk.toFixed(2)}</td><td>${(x.ctr * 100).toFixed(1)}%</td></tr>`).join('')}</table>` : '<div class="help">Chưa có.</div>';
    $('#libbody').innerHTML = `
      <div class="af-tools"><button class="primary" id="st-imp"><i class="ti ti-table-import"></i>Nhập số liệu (CSV/Excel)</button></div>
      <p class="help">Xuất file hiệu suất video từ TikTok Shop (Trung tâm affiliate → Phân tích → Video) hoặc Facebook/Shopee, rồi nhập vào đây. Mỗi dòng được khớp với video Tự lái đã làm theo caption/tiêu đề. ${r.videos} video trong sổ.</p>
      <div class="af-kpi"><div><b>${R.videos}</b><small>video có số liệu</small></div><div><b>${n(R.total.orders)}</b><small>đơn · ${n(R.total.views)} view</small></div><div><b>${R.total.opk.toFixed(2)}</b><small>đơn / 1.000 view</small></div></div>
      <div class="af-sec">Tự lái đã học</div>
      ${r.learned.notes.length ? `<ul class="af-notes">${r.learned.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="help">Cần ít nhất 5 video có số liệu để bắt đầu học (đang có ${R.videos}).</div>`}
      <div class="af-sec">Theo góc bán</div>${tb(R.angle, AV())}
      <div class="af-sec">Theo kiểu hook</div>${tb(R.hook, HV)}
      <div class="af-sec">Theo nền tảng</div>${tb(R.platform, { tiktok: 'TikTok', facebook: 'Facebook' })}
      ${r.imports.length ? `<div class="af-sec">Lần nhập gần đây</div>${r.imports.slice(-5).reverse().map(x => `<div class="help">${esc(x.file)} · ${x.matched}/${x.rows} dòng khớp · ${new Date(x.at).toLocaleString('vi-VN')}</div>`).join('')}` : ''}`;
    $('#st-imp').onclick = async () => {
      const [f] = await pickFile('.csv,.xlsx'); if (!f) return;
      const x = await upload(`/api/aff/stats/import?name=${encodeURIComponent(f.name)}`, f);
      if (x.error) return toast(x.error);
      toast(`Khớp ${x.matched}/${x.rows} dòng`); if (x.unmatched?.length) console.log('Không khớp:', x.unmatched);
      renderStats();
    };
  }

  // ---------- wire up: affiliate panels first in the rail; open "Affiliate" on start ----------
  Studio.addPanel('aff', 'ti-shopping-cart', 'Affiliate', () => { render(); refresh(true); });
  Studio.addPanel('affstats', 'ti-chart-bar', 'Hiệu quả', () => renderStats());
  try { const a = RAIL.splice(RAIL.findIndex(r => r[0] === 'aff'), 1)[0], b = RAIL.splice(RAIL.findIndex(r => r[0] === 'affstats'), 1)[0]; RAIL.unshift(a, b); renderRail(); } catch {}
  setInterval(() => { if (isActive('aff')) refresh(false); }, 2500);
  // first screen = Affiliate (also when Studio starts without a project)
  // No project yet is normal here (faceless videos need none): drop the editor's "Chưa mở dự án" dialog once it appears.
  fetch('/api/project').then(r => {
    if (r.ok) return;
    let n = 0; const t = setInterval(() => { if ($('#modalbox')?.textContent.includes('Chưa mở dự án') && !$('#modal').hidden) { closeModal(); clearInterval(t); } if (++n > 40) clearInterval(t); }, 150);
    document.querySelector('#rail [data-p="aff"]')?.click();
  }).catch(() => {});
  document.querySelector('#rail [data-p="aff"]')?.click(); // opened right away, before the user picks another panel
})();
