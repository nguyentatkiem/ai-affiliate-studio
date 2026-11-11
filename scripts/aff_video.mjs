// Dựng 1 video affiliate (không cần quay) từ: sản phẩm + kịch bản (aff_script.mjs) + chỉ số hook + nền tảng.
// Giọng đọc TTS (edge-tts nếu có, không thì giọng macOS) → căn từng chữ (nhận giọng lại bản đọc) → phụ đề →
// hình: ảnh/video sản phẩm toàn khung (zoom chậm) theo từng ý, hook chữ to 3 giây đầu, thẻ giá / ưu nhược / danh sách,
// kết bằng nhãn "Bấm giỏ hàng" (TikTok) hoặc "Link ở bình luận" (Facebook) → nhạc + SFX. Ra một thư mục dự án mở được trong Studio.
// Spec: references/affiliate.md. CLI (thường do autopilot_aff.mjs gọi):
//   node scripts/aff_video.mjs <product-id> <scripts.json> <out_dir> [--script 0] [--hook 0] [--platform tiktok] [--voice edge:vi-VN-HoaiMyNeural] [--export]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tts, hasEdge, alignLine, captionsFrom, brollSearch } from './topic_video.mjs';
import { sh, say as say0, probe, exportProject, PY } from './highlights.mjs';
import { getProduct, mediaAbs, fmtPrice, discountPct } from './products.mjs';
import { speakAll, BASE_VOICES } from './aff_voice.mjs';
import { deriveProduct, pickBroll } from './aff_media.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = f => path.join(HERE, f);
const r2 = v => Math.round(v * 100) / 100;
const MOODS = ['hype', 'happy', 'corporate_upbeat', 'tech', 'inspire', 'lofi', 'acoustic_warm', 'mellow'];
export const DEFAULT_VOICE = 'auto'; // edge-tts Hoài My khi có (tự nhiên hơn nhiều), không thì giọng Linh của macOS
export const VOICES = BASE_VOICES; // + giọng nhân bản: aff_voice.mjs allVoices()
const cut = (s, n) => { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n + 1), i = c.lastIndexOf(' '); return (i > n * .5 ? c.slice(0, i) : s.slice(0, n)).trim(); };

// product shots are rarely 9:16: whole product centred on a blurred, darkened copy of itself (no cropping)
async function fitImage(src, dir, base, extra = {}) {
  fs.copyFileSync(src, path.join(dir, 'media', base));
  const fit = `media/${base.replace(/\.\w+$/, '')}_fit.jpg`;
  try {
    await sh('ffmpeg', ['-v', 'error', '-y', '-i', src, '-filter_complex',
      'color=c=0x141416:s=720x1280:d=1[c];[0:v]format=rgba,split[a][b];[a]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=30:2,eq=brightness=-0.28:saturation=1.15[bi];[c][bi]overlay[bg];' +
      '[b]scale=660:900:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-40,format=yuvj420p', '-frames:v', '1', '-q:v', '3', path.join(dir, fit)]);
    return { kind: 'image', path: fit, orig: `media/${base}`, ...extra };
  } catch { return { kind: 'image', path: `media/${base}`, orig: `media/${base}`, ...extra }; }
}
// video → 30 fps JPEG sequence (≤ maxSec, 720 px) the engine can seek
async function seqOf(src, dir, base, maxSec = 12, extra = {}) {
  const fr = `media/${base.replace(/\.\w+$/, '')}_frames`;
  if (fs.existsSync(path.join(dir, fr, '00001.jpg'))) { const count = fs.readdirSync(path.join(dir, fr)).filter(f => f.endsWith('.jpg')).length; return { kind: 'video', seq: `${fr}/%05d.jpg`, fps: 30, count, thumb: `${fr}/00001.jpg`, ...extra }; }
  fs.mkdirSync(path.join(dir, fr), { recursive: true });
  try {
    await sh('ffmpeg', ['-v', 'error', '-y', '-t', String(maxSec), '-i', src, '-vf', 'fps=30,scale=w=720:h=1280:force_original_aspect_ratio=increase,crop=720:1280', '-q:v', '4', path.join(dir, fr, '%05d.jpg')]);
    const count = fs.readdirSync(path.join(dir, fr)).filter(f => f.endsWith('.jpg')).length;
    return count > 5 ? { kind: 'video', seq: `${fr}/%05d.jpg`, fps: 30, count, thumb: `${fr}/00001.jpg`, ...extra } : null;
  } catch (e) { console.error(`tách khung video ${path.basename(src)} lỗi (bỏ qua): ${e.message.slice(0, 120)}`); return null; }
}
// Copy product media into the project (+ close-up crops of label/texture details from aff_media.deriveProduct).
async function prepMedia(p, dir, derived = { details: [] }) {
  const out = [];
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  for (const [i, m] of p.media.entries()) {
    const src = mediaAbs(p, m); if (!fs.existsSync(src)) continue;
    const base = `${String(i + 1).padStart(2, '0')}_${path.basename(m.file).replace(/[^\w.\-]+/g, '_')}`;
    if (m.kind === 'image') { out.push(await fitImage(src, dir, base)); continue; }
    const v = await seqOf(src, dir, base); if (v) out.push(v);
  }
  for (const [i, d] of derived.details.entries()) out.push(await fitImage(d, dir, `d${i + 1}_${path.basename(d)}`, { detail: true }));
  return out;
}
// Blurred, darkened copy of the first picture as the main-track still (shows behind cards); gradient when there is none.
async function makeBg(dir, media) {
  const bg = path.join(dir, 'media/bg.jpg'), first = media.find(m => m.kind === 'image')?.path || media.find(m => m.kind === 'video')?.thumb;
  try {
    if (!first) throw new Error('no media');
    await sh('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, first), '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=28:2,eq=brightness=-0.22:saturation=1.2', '-frames:v', '1', bg]);
  } catch {
    await sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'gradients=s=720x1280:c0=0x2a1510:c1=0x0a0a0a:x0=360:y0=500:x1=0:y1=0:type=radial', '-frames:v', '1', bg]);
  }
  return 'media/bg.jpg';
}

// variant (nhân bản video thắng / A-B): { seed (đổi thứ tự hình + b-roll), mood (nhạc), rate (nhịp đọc) }
export async function buildAffVideo({ product: p, script: sc, hook = 0, platform = 'tiktok', dir, voice = DEFAULT_VOICE, rate = 195, dur = 30, captionStyle = 'review', brand = null, variant = {}, ownBroll = true, say = say0 }) {
  if (variant.rate) rate = variant.rate;
  dir = path.resolve(dir);
  fs.rmSync(path.join(dir, 'work'), { recursive: true, force: true });
  for (const d of ['work/tts', 'media', '.studio', 'out']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  if (!voice || voice === 'auto') voice = hasEdge() ? 'edge:vi-VN-HoaiMyNeural' : 'Linh';
  if (voice.startsWith('edge:') && !hasEdge()) { console.error('chưa cài edge-tts → dùng giọng Linh (offline)'); voice = 'Linh'; }
  if (voice.startsWith('clone:') && !(await import('./aff_voice.mjs')).cloneVoices().length) { console.error('không thấy giọng nhân bản → dùng giọng mặc định'); voice = hasEdge() ? 'edge:vi-VN-HoaiMyNeural' : 'Linh'; }
  const H = sc.hooks[Math.min(hook, sc.hooks.length - 1)], fb = platform === 'facebook';
  const lines = [{ kind: 'hook', ...H }, ...sc.beats.map((b, i) => ({ kind: 'beat', i, ...b })), { kind: 'cta', ...sc.cta }].filter(L => String(L.say || '').trim());

  // 1. TTS per line, measured; read faster once when over budget (macOS say only)
  const GAP = .22;
  const speak = async (r, pass) => {
    let t = .12;
    for (const [i, L] of lines.entries()) { L.say = String(L.say).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\s+/g, ' ').trim(); L.file = path.join(dir, `work/tts/${String(i).padStart(2, '0')}.wav`); }
    const ds = await speakAll(lines, voice, r, { say: (k, m) => say(.05 + .25 * k, m + (pass ? ' (nhanh hơn)' : '')) });
    for (const [i, L] of lines.entries()) { L.d = ds[i]; L.s = r2(t); L.e = r2(t + L.d); t = L.e + (i === 0 ? GAP * 1.4 : GAP); }
    return t;
  };
  let end, rateUsed = rate;
  try { end = await speak(rate, 0); }
  catch (e) { // edge-tts needs the network: fall back to the offline macOS voice for the whole video
    if (!voice.startsWith('edge:') || process.platform !== 'darwin') throw e;
    console.error('edge-tts lỗi, đọc bằng giọng Linh (offline): ' + e.message.slice(0, 120)); voice = 'Linh'; end = await speak(rate, 0);
  }
  if (!voice.startsWith('edge:') && !voice.startsWith('clone:') && end > dur * 1.12) {
    const speech = lines.reduce((a, L) => a + L.d, 0), room = Math.max(6, dur - (end - speech));
    rateUsed = Math.min(235, Math.round(rate * speech / room));
    if (rateUsed > rate + 5) end = await speak(rateUsed, 1);
  }
  const total = r2(lines[lines.length - 1].e + 1.4);
  say(.33, 'Ghép giọng đọc');
  const fc = lines.map((L, i) => `[${i}:a]adelay=${Math.round(L.s * 1000)}|${Math.round(L.s * 1000)}[a${i}]`).join(';') + ';' + lines.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0:dropout_transition=0,apad=whole_dur=${total}[o]`;
  await sh('ffmpeg', ['-v', 'error', '-y', ...lines.flatMap(L => ['-i', L.file]), '-filter_complex', fc, '-map', '[o]', '-t', String(total), '-ar', '48000', '-ac', '2', path.join(dir, 'work/voice.wav')]);

  // 2. word timings: transcribe the TTS audio and align it to the script words (fallback: spread by characters)
  say(.36, 'Căn thời gian từng chữ');
  let heard = [];
  try { await sh(PY, ['-I', '-X', 'utf8', S('transcribe.py'), path.join(dir, 'work/voice.wav'), path.join(dir, 'work/words_tts.json'), '--model', process.env.AFF_WHISPER || 'large-v3-turbo']); heard = JSON.parse(fs.readFileSync(path.join(dir, 'work/words_tts.json'), 'utf8')); }
  catch (e) { console.error('nhận giọng bản đọc lỗi, chia thời gian theo số ký tự: ' + e.message.slice(0, 160)); }
  for (const L of lines) L.words = alignLine(L.say, L.s, L.e, heard);
  const caps = captionsFrom(lines);
  fs.writeFileSync(path.join(dir, 'work/captions.json'), JSON.stringify(caps, null, 1));

  // 3. visuals
  say(.5, 'Dựng hình: sản phẩm, hook, thẻ giá, giỏ hàng');
  const derived = await deriveProduct(p, { say: (k, m) => say(.5, m) }).catch(e => (console.error('tách nền/cận cảnh lỗi (bỏ qua): ' + e.message.slice(0, 160)), { cutouts: [], details: [] }));
  const media = await prepMedia(p, dir, derived), bg = await makeBg(dir, media.filter(m => !m.detail));
  const vids = media.filter(m => m.kind === 'video'), imgs = media.filter(m => m.kind === 'image' && !m.detail), dets = media.filter(m => m.detail);
  const order = []; for (let i = 0; i < Math.max(vids.length, imgs.length); i++) { if (vids[i]) order.push(vids[i]); if (imgs[i]) order.push(imgs[i]); if (dets[i]) order.push(dets[i]); }
  for (const d of dets.slice(Math.max(vids.length, imgs.length))) order.push(d);
  const seed = Math.abs(+(variant.seed ?? 0)) | 0;
  if (seed && order.length > 1) order.push(...order.splice(0, seed % order.length)); // other opening order per variant
  // cut-out product (aff_hero on brand colours) for product beats
  const heroes = derived.cutouts.map((c, i) => { const rel = `media/hero_${i + 1}.png`; fs.copyFileSync(c, path.join(dir, rel)); return rel; });
  let hi = seed, mi = 0;
  const hero = (t0, t1, extra = {}) => ({ type: 'aff_hero', t0, t1, image: heroes[hi++ % heroes.length], tilt: (hi % 2 ? -6 : 5), ...extra });
  // own b-roll (person on camera): unbox beat → "mo-hop", one mid beat → "cam-len"/"dung-thu", CTA → "chi-tay"
  const own = {}, usedOwn = [];
  const ownClip = async tag => { if (!ownBroll) return null; if (own[tag] !== undefined) return own[tag]; const b = pickBroll(tag, seed + hook); own[tag] = b ? await seqOf(b.path, dir, `own_${tag}_${path.basename(b.file)}`, 6, { own: tag }) : null; if (own[tag]) usedOwn.push(tag); return own[tag]; };
  const nextMedia = () => (order.length ? order[mi++ % order.length] : null);
  const heroImg = imgs[0]?.orig || vids[0]?.thumb || '';
  const mediaRef = (m, t0) => (m.kind === 'video' ? { seq: m.seq, fps: m.fps, count: m.count, t0 } : m.path);
  const shot = (t0, t1, extra = {}) => {
    const m = extra.media === undefined ? nextMedia() : extra.media; delete extra.media;
    if (m) return { type: 'kinetic_broll', t0, t1, layout: 'full', media: mediaRef(m, t0), zoom: 1.16, hideCaptions: false, ...extra };
    const e = brollSearch(extra.keyword || p.name) || { template: 'blobs', pal: 'ember' };
    return { type: 'kinetic_broll', t0, t1, layout: 'full', broll: { template: e.template, pal: 'ember', text: '', seed: 5 }, fit: 'blend', hideCaptions: false, ...extra };
  };
  const price = fmtPrice(p.price), old = fmtPrice(p.old_price), pct = discountPct(p);
  const scenes = [], hookL = lines[0], cta = lines[lines.length - 1];
  const hookEnd = r2(Math.max(2.2, Math.min(hookL.e + GAP / 2, 4)));
  // opening shot: first product video/photo; a variant opens on another product shot (rotated order) — still the product within 1 s
  const opener = seed && order.length > 1 ? order[0] : vids[0] || imgs[0] || null;
  scenes.push(shot(0, hookEnd, { media: opener, zoom: 1.3 }));
  mi = opener ? 1 : 0;
  scenes.push({ type: 'aff_hook', t0: .05, t1: hookEnd, text: cut(H.screen || sc.title || p.name, 26), ...(H.screen2 ? { text2: cut(H.screen2, 32) } : {}) });
  if (H.type === 'con-so' && price) scenes.push({ type: 'aff_price', t0: .5, t1: hookEnd, price, ...(old ? { old_price: old } : {}), ...(pct ? { pct } : {}), label: 'Giá hôm nay', x: 520, y: 700 });
  const beats = lines.filter(L => L.kind === 'beat');
  const kw = (L, t0) => (L.screen ? { keyword: cut(L.screen, 24), kw_t: r2(t0 + .2), kw_y: 300, size: 84, ...(L.sub ? { sub: cut(L.sub, 30), sub_size: 30 } : {}) } : {});
  let ownMid = false;
  for (const [k, L] of beats.entries()) {
    const b0 = k ? r2(L.s - GAP / 2) : hookEnd, b1 = beats[k + 1] ? r2(beats[k + 1].s - GAP / 2) : r2(cta.s - GAP / 2);
    if (b1 - b0 < .4) continue;
    const v = L.visual, card = { t0: r2(b0 + .1), t1: b1 };
    if (v === 'price' && price) {
      scenes.push(shot(b0, b1, { media: imgs.length ? null : undefined }));
      scenes.push({ type: 'rv_product', ...card, x: 360, y: 520, size: 100, image: heroImg, name: cut(p.name, 22), brand: p.brand || '', price, ...(old ? { old_price: old } : {}), ...(pct ? { badge: `-${pct}%` } : {}), backdrop: 'dim' });
    } else if (v === 'proscons' && (L.pros || []).length) {
      scenes.push(shot(b0, b1));
      scenes.push({ type: 'rv_proscons', ...card, x: 360, y: 470, size: 100, title: cut(L.screen || '', 22), pros: L.pros.slice(0, 3).map(x => cut(x, 24)), cons: (L.cons || []).slice(0, 1).map(x => cut(x, 24)), pros_title: 'ĐIỂM CỘNG', cons_title: 'LƯU Ý' });
    } else if ((v === 'list' || v === 'unbox') && (L.items || []).length) {
      const oc = v === 'unbox' ? await ownClip('mo-hop') : null;
      scenes.push(shot(b0, b1, oc ? { media: oc } : {}));
      scenes.push({ type: 'rv_unbox', ...card, x: 360, y: 470, size: 100, title: cut(L.screen || (v === 'unbox' ? 'TRONG HỘP CÓ' : 'ĐIỂM NỔI BẬT'), 22), icon: v === 'unbox' ? '📦' : (L.emoji || '✨'),
        items: L.items.slice(0, 4).map(x => ({ icon: v === 'unbox' ? '📦' : '✅', text: cut(x, 22) })) });
    } else if (v === 'number' && L.num != null && isFinite(+L.num)) {
      scenes.push(shot(b0, b1));
      scenes.push({ type: 'kinetic_slam', ...card, count: { to: +L.num, suffix: L.unit ? (String(L.unit).length <= 2 ? L.unit : ' ' + L.unit) : '', dur: .8 }, top: cut(L.sub || '', 28), bottom: cut(L.screen || '', 22) });
    } else if (v === 'versus' && (L.items || []).length >= 2) {
      scenes.push(shot(b0, b1));
      scenes.push({ type: 'kinetic_diamonds', ...card, title: cut(L.screen || '', 22), items: L.items.slice(0, 2).map((x, i) => ({ text: cut(x, 12), icon: i ? '✅' : '😩', t: r2(b0 + .2 + i * .6) })) });
    } else if (v === 'words') {
      scenes.push(shot(b0, b1, kw(L, b0)));
    } else {
      // product close-up (or the cut-out hero on brand colours); a long beat gets a second shot (attention reset) — once a real person (own b-roll)
      const m = b1 - b0 > 4.2 ? r2(b0 + (b1 - b0) * .55) : b1;
      if (heroes.length && (k + seed) % 2 === 0) scenes.push(hero(b0, m, L.screen ? { keyword: cut(L.screen, 22), ...(L.sub ? { sub: cut(L.sub, 30) } : {}), y: 640 } : {}));
      else scenes.push(shot(b0, m, kw(L, b0)));
      if (m < b1) { const oc = !ownMid ? (await ownClip('cam-len')) || (await ownClip('dung-thu')) : null; if (oc) ownMid = true; scenes.push(shot(m, b1, oc ? { media: oc } : {})); }
    }
  }
  const ctaS = r2(cta.s - GAP / 2);
  const point = await ownClip('chi-tay');
  if (point) scenes.push(shot(ctaS, total, { media: point, zoom: 1.0 }));
  else if (heroes.length) scenes.push(hero(ctaS, total, { y: 430, size: .62 }));
  else scenes.push(shot(ctaS, total, { media: imgs[0] || vids[0] || null, zoom: 1.08 }));
  scenes.push({ type: 'aff_cart', t0: r2(ctaS + .05), t1: total, platform: fb ? 'facebook' : 'tiktok', text: cut(cta.screen || (fb ? 'LINK Ở BÌNH LUẬN' : 'BẤM GIỎ HÀNG'), 22), ...(price ? { price } : {}), ...(old ? { old_price: old } : {}), ...(p.voucher ? { sub: cut(p.voucher, 34) } : {}), keep: true });
  if (sc.disclaimer) scenes.push({ type: 'aff_disclaimer', t0: 0, t1: total, text: sc.disclaimer });
  const fx = scenes.filter(s => s.type === 'kinetic_broll' && s.t0 > .1).map(s => ({ t: s.t0, type: 'flash' })).filter((f, i, a) => !i || f.t - a[i - 1].t > .5);
  fx.unshift({ t: r2(hookEnd), type: 'punch' });

  const clips = [{ src: bg, in: 0, out: total, fit: 'cover', zoom: 1.0, audio: 'work/voice.wav' }];
  const tl = {
    width: 1080, height: 1920, fps: 30, duration: total, pack: 'affiliate', title: sc.title || p.name,
    clips, face: { x: 360, y: 520 }, caption_style: captionStyle, captions: 'work/captions.json', scenes, fx,
    ...(brand ? { brand } : {}),
    audio: { mix: 'work/mix.wav', music: [{ t0: 0, t1: total, mood: MOODS.includes(variant.mood) ? variant.mood : MOODS.includes(sc.mood) ? sc.mood : 'hype', gain: -22 }], sfx: [], duck: { on: true, amount_db: -10, attack: 60, release: 400, hold: 250 } },
    _aff: { product: p.id, product_name: p.name, angle: sc.angle, hook: { i: hook, type: H.type, say: H.say, screen: H.screen }, platform, voice, rate: rateUsed,
      title: sc.title, caption: sc.caption, hashtags: sc.hashtags, compliance: sc.compliance, disclaimer: sc.disclaimer || null, aligned: heard.length,
      human: usedOwn.length > 0, own_broll: usedOwn, heroes: heroes.length, details: dets.length, variant, price_hook: H.type === 'con-so' || /\d+\s*k\b|\d{2,3}[.,]\d{3}|giá/i.test(`${H.say} ${H.screen || ''}`),
      lines: lines.map(L => ({ kind: L.kind, say: L.say, s: L.s, e: L.e, screen: L.screen, visual: L.visual })) },
  };
  const tlFile = path.join(dir, 'timeline.json');
  fs.writeFileSync(tlFile, JSON.stringify(tl, null, 1));

  // 4. music + SFX (auto_sfx), music kept under the TTS voice; ka-ching on the price / cart moments
  say(.6, 'Nhạc nền + SFX');
  try { await sh(PY, ['-I', '-X', 'utf8', S('auto_sfx.py'), tlFile, '--level', 'vua', '--music', 'keep']); }
  catch (e) { console.error('auto_sfx lỗi (giữ nhạc mặc định): ' + e.message.slice(0, 200)); }
  const tl2 = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
  for (const m of tl2.audio?.music || []) m.gain = Math.min(m.gain ?? -22, -20);
  const lib = fs.readdirSync(path.join(HERE, '../assets/sfx')).filter(f => /\.(flac|wav|mp3)$/.test(f));
  const pick = re => lib.find(f => re.test(f));
  const ching = pick(/cash|ching|coin|register/i) || pick(/shimmer|notification/i), pop = pick(/^pop/i);
  tl2.audio.sfx = tl2.audio.sfx || [];
  for (const s of tl2.scenes.filter(s => ['rv_product', 'aff_price', 'aff_cart'].includes(s.type))) if (ching) tl2.audio.sfx.push({ t: r2(s.t0 + .3), name: ching.replace(/\.\w+$/, ''), gain: -6, _auto: true });
  if (pop) tl2.audio.sfx.push({ t: .1, name: pop.replace(/\.\w+$/, ''), gain: -4, _auto: true });
  fs.writeFileSync(tlFile, JSON.stringify(tl2, null, 1));

  // cover thumb for Studio panels
  await sh('node', [S('render.mjs'), tlFile, path.join(dir, '.studio/thumb_big.jpg'), '--still', String(r2(Math.min(total - .5, hookEnd - .5))), path.join(dir, '.studio/thumb_big.jpg')]).catch(() => {});
  if (fs.existsSync(path.join(dir, '.studio/thumb_big.jpg'))) { await sh('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, '.studio/thumb_big.jpg'), '-vf', 'scale=360:-2', '-q:v', '4', path.join(dir, '.studio/thumb.jpg')]).catch(() => {}); fs.rmSync(path.join(dir, '.studio/thumb_big.jpg'), { force: true }); }
  return { dir, duration: total, hookEnd, lines: lines.length, scenes: scenes.length, aligned: heard.length, media: media.length, voice, human: usedOwn.length > 0, price_hook: tl._aff.price_hook, heroes: heroes.length, details: dets.length };
}

async function main() {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const [id, sf, out] = a;
  if (!id || !sf || !out) throw new Error('cách dùng: node scripts/aff_video.mjs <product-id> <scripts.json> <out_dir> [--script 0] [--hook 0] [--platform tiktok] [--voice …] [--export]');
  const p = getProduct(id); if (!p) throw new Error('không thấy sản phẩm ' + id);
  const doc = JSON.parse(fs.readFileSync(path.resolve(sf), 'utf8')), sc = (doc.scripts || [doc])[+opt('--script', 0)];
  const r = await buildAffVideo({ product: p, script: sc, hook: +opt('--hook', 0), platform: opt('--platform', 'tiktok'), dir: out, voice: opt('--voice', DEFAULT_VOICE), dur: +opt('--dur', doc.dur || 30) });
  let mp4 = null;
  if (a.includes('--export')) mp4 = await exportProject(r.dir, { quality: opt('--quality', '1080'), onProgress: (k, s) => say0(.7 + .3 * k, `Xuất video (${s}) ${Math.round(k * 100)}%`) });
  say0(1, 'Xong');
  console.log('RESULT ' + JSON.stringify({ ...r, mp4, outputs: [r.dir, ...(mp4 ? [mp4] : [])], probe: mp4 ? probe(mp4) : null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
