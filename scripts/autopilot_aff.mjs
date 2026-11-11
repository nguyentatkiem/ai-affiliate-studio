// Tự lái AFFILIATE: 1 sản phẩm → K góc bán × N hook × nền tảng = nhiều video 9:16 hoàn chỉnh + ảnh bìa + bộ đăng (+ lịch đăng).
// usage: node scripts/autopilot_aff.mjs <product-id> [--profile <id>] [--angles 3] [--hooks 2] [--platforms tiktok,facebook] [--dur 30]
//                                       [--angle noi-dau,deal] [--voice auto] [--out <thư mục giao>] [--schedule] [--offline] [--restart] [--from <bước>]
//        node scripts/autopilot_aff.mjs --steps
// Chuỗi: product → script → compliance → build → export → kit → schedule → deliver (bước * bắt buộc).
// Chạy tiếp được: trạng thái ở <job>/.aff/state.json; chạy lại cùng lệnh bỏ qua bước + video đã xong. Spec: references/affiliate.md.
// Output: "@@ <0..1> <text>", "PROJECT <job dir>", cuối cùng "RESULT {json}".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AVS_HOME, getProfile } from './profile.mjs';
import { getProduct, discountPct, fmtPrice } from './products.mjs';
import { writeScripts, hookVariants, ANGLES } from './aff_script.mjs';
import { issuesText } from './aff_compliance.mjs';
import { buildAffVideo, DEFAULT_VOICE } from './aff_video.mjs';
import { exportProject, sh } from './highlights.mjs';
import { buildKit, writeKit } from './aff_kit.mjs';
import { learnedPrefs, registerVideo, loadVideos, patchVideo, fingerprint, dupOnOtherChannel } from './aff_stats.mjs';
import { codeFor } from './aff_track.mjs';
import { check3s, complianceLog } from './aff_qc.mjs';
import { notify } from './notify.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STEPS = [
  ['product', 'Nạp sản phẩm', 2, true],
  ['script', 'AI viết kịch bản (góc bán × hook)', 10, true],
  ['compliance', 'Kiểm tra chính sách TikTok Shop / Facebook', 2, true],
  ['build', 'Dựng video (giọng đọc, hình, phụ đề, nhạc)', 38, true],
  ['qc', 'Kiểm 3 giây đầu + nhật ký tuân thủ', 2],
  ['export', 'Xuất MP4 + ảnh bìa', 40, true],
  ['kit', 'Bộ đăng (caption, gắn giỏ, link bình luận)', 3],
  ['schedule', 'Xếp lịch đăng', 2],
  ['deliver', 'Gom kết quả + thông báo', 3, true],
];
const rd = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); };
const r2 = v => Math.round(v * 100) / 100;
export const PLATFORM_NAMES = { tiktok: 'TikTok', facebook: 'Facebook' };

// Facebook copy of a TikTok-written script: CTA points to the first comment instead of the cart.
function forPlatform(sc, platform, p) {
  if (platform !== 'facebook') return sc;
  const s = JSON.parse(JSON.stringify(sc));
  s.cta = { ...s.cta, say: `Link mua mình để ở bình luận đầu tiên nha${p.price ? `, giá đang ${fmtPrice(p.price).replace(/\.000đ$/, 'k')}` : ''}.`, screen: 'LINK Ở BÌNH LUẬN', button: 'XEM LINK' };
  for (const b of s.beats) b.say = String(b.say).replace(/bấm (vào )?giỏ hàng/gi, 'xem link ở bình luận');
  return s;
}
export const jobDirFor = (p, o) => path.join(AVS_HOME, 'affiliate/jobs', `${p.id}-${o.clone ? 'nhan-' : ''}${crypto.createHash('md5').update(JSON.stringify([o.angles, o.hooks, o.platforms, o.dur, o.only || null, o.profile || null, ...(o.clone ? [o.clone, o.n] : [])])).digest('hex').slice(0, 6)}`);
const MOODS = ['hype', 'happy', 'corporate_upbeat', 'tech', 'inspire', 'lofi'];
// nhân bản video thắng: tìm video gốc trong sổ + kịch bản của nó
function cloneSource(key) {
  const v = loadVideos().videos.find(x => x.key === key); if (!v) throw new Error(`Không thấy video ${key} trong sổ`);
  const vdir = v.project || path.dirname(path.dirname(v.file)), job = path.dirname(path.dirname(vdir));
  const doc = rd(path.join(job, 'scripts.json')); if (!doc) throw new Error('Video gốc không có kịch bản (chỉ nhân bản được video Tự lái không quay)');
  const vk = key.split('/').pop(), sc = doc.scripts.find(s => s.angle === v.angle) || doc.scripts[0];
  const tl = rd(path.join(vdir, 'timeline.json'));
  return { v, sc, hook: Math.max(0, +(/-[hc](\d+)-/.exec(vk)?.[1] || 1) - 1), mood: tl?.audio?.music?.[0]?.mood, voice: tl?._aff?.voice, doc };
}

export async function autopilotAff(id, opts = {}) {
  const t00 = Date.now();
  const p0 = getProduct(id); if (!p0) throw new Error(`Không có sản phẩm "${id}" trong thư viện (node scripts/products.mjs list)`);
  const prof = getProfile(opts.profile);
  const learned = learnedPrefs(prof.id);
  const o = {
    angles: +(opts.angles || prof.aff_angles || 3), hooks: +(opts.hooks || prof.aff_hooks || 2), dur: +(opts.dur || prof.aff_dur || 30),
    platforms: (opts.platforms ? String(opts.platforms).split(',') : prof.aff_platforms?.length ? prof.aff_platforms : ['tiktok']).filter(x => PLATFORM_NAMES[x]),
    only: opts.angle ? String(opts.angle).split(',') : null, voice: opts.voice || prof.voice || DEFAULT_VOICE, persona: prof.persona || '',
    strict: prof.aff_strict !== false, schedule: opts.schedule ?? !!prof.aff_autoschedule, offline: !!opts.offline, quality: prof.quality || '1080',
    clone: opts.clone || null, n: +(opts.n || 3), profile: prof.id, broll: prof.aff_own_broll !== false,
  };
  let src = null;
  if (o.clone) { src = cloneSource(o.clone); o.platforms = [src.v.platform]; o.angles = 1; o.hooks = o.n; o.only = [src.v.angle]; if (src.voice && !opts.voice) o.voice = src.voice; }
  if (!o.platforms.length) o.platforms = ['tiktok'];
  const dir = opts.project ? path.resolve(opts.project) : jobDirFor(p0, o);
  const SF = path.join(dir, '.aff/state.json');
  if (opts.restart) fs.rmSync(path.join(dir, '.aff'), { recursive: true, force: true });
  let st = rd(SF) || { version: 1, product: p0.id, steps: {}, videos: [] };
  Object.assign(st, { opts: o, profile: prof.id, state: 'running', pid: process.pid, started: st.started || new Date().toISOString(), out: opts.out ? path.resolve(opts.out) : st.out || null, learned: learned.notes });
  if (opts.from) { let on = false; for (const [k] of STEPS) { if (k === opts.from) on = true; if (on) delete st.steps[k]; } if (['script', 'compliance', 'build'].includes(opts.from)) st.videos = []; }
  const save = () => wr(SF, st);
  fs.mkdirSync(dir, { recursive: true }); save();
  console.log('PROJECT ' + dir);
  const W = STEPS.reduce((a, s) => a + s[2], 0);
  let base = 0, cur = null;
  const say = (k, text) => {
    const pr = (base + cur[2] * Math.max(0, Math.min(1, k))) / W;
    console.log(`@@ ${pr.toFixed(3)} [${STEPS.indexOf(cur) + 1}/${STEPS.length}] ${cur[1]}${text ? ': ' + text : ''}`);
    st.steps[cur[0]] = { ...(st.steps[cur[0]] || {}), state: 'running', detail: text || '', progress: +k.toFixed(2) }; save();
  };
  let p = p0, doc = null;
  const scriptsFile = path.join(dir, 'scripts.json');

  const actions = {
    product() {
      const warn = [];
      if (!p.media.length) warn.push('chưa có ảnh/video sản phẩm — dùng hình minh hoạ chung (nên thêm ảnh thật để ra đơn tốt hơn)');
      if (!p.price) warn.push('chưa có giá — video sẽ không nói giá');
      if (!p.usp.length) warn.push('chưa có điểm nổi bật — kịch bản sẽ chung chung');
      if (o.platforms.includes('tiktok') && !p.tiktok_product_id && !p.links.tiktok) warn.push('chưa có link/ID TikTok để gắn giỏ');
      st.warnings = warn;
      return `${p.name} · ${p.media.length} media${p.price ? ' · ' + fmtPrice(p.price) : ''}${discountPct(p) ? ` (−${discountPct(p)}%)` : ''}${warn.length ? ' · ⚠ ' + warn.join('; ') : ''}`;
    },
    async script() {
      if (o.clone) {
        const sc = await hookVariants(p, src.sc, src.hook, o.n, { offline: o.offline, say: m => say(.5, m) });
        doc = { product: p.id, source: 'clone', clone: o.clone, angles: [sc.angle], dur: src.doc.dur, scripts: [sc] }; wr(scriptsFile, doc);
        return `${sc.hooks.length} hook mới cho video thắng (${ANGLES[sc.angle]?.name || sc.angle}), giữ thân bài`;
      }
      doc = await writeScripts(p, { angles: o.angles, hooks: o.hooks, dur: o.dur, platform: o.platforms[0], persona: o.persona, only: o.only, offline: o.offline,
        prefer: learned.angles, hookPrefer: learned.hooks, extra: prof.extra || '', say: m => say(.5, m) });
      wr(scriptsFile, doc);
      return `${doc.scripts.length} kịch bản × ${o.hooks} hook (${doc.source === 'claude' ? 'Claude' : 'dựng sẵn, không có Claude' + (doc.note ? ': ' + doc.note : '')})${learned.notes.length ? ' · ưu tiên theo số liệu đơn hàng' : ''}`;
    },
    compliance() {
      doc = doc || rd(scriptsFile);
      const bad = doc.scripts.filter(s => !s.compliance?.ok), fixed = doc.scripts.reduce((a, s) => a + (s.compliance?.issues || []).filter(x => x.level === 'fixed').length, 0);
      fs.writeFileSync(path.join(dir, 'compliance.txt'), doc.scripts.map(s => `## ${ANGLES[s.angle]?.name || s.angle}\n${issuesText(s.compliance || { issues: [] }) || '✓ không thấy vi phạm'}`).join('\n\n') + '\n');
      if (bad.length && o.strict) {
        doc.scripts = doc.scripts.filter(s => s.compliance?.ok); wr(scriptsFile, doc);
        if (!doc.scripts.length) throw new Error('Mọi kịch bản đều vi phạm chính sách (xem compliance.txt). Sửa thông tin sản phẩm rồi chạy lại.');
      }
      return `${fixed} chỗ tự sửa${bad.length ? `, ${o.strict ? 'bỏ' : 'giữ (chế độ không chặt)'} ${bad.length} kịch bản còn vi phạm` : ', không còn vi phạm'}`;
    },
    async build() {
      doc = doc || rd(scriptsFile);
      const jobs = [];
      for (const [si, sc] of doc.scripts.entries()) for (let h = 0; h < sc.hooks.length; h++) for (const pl of o.platforms) jobs.push({ si, h, pl, key: `${sc.angle}-${o.clone ? 'c' : 'h'}${h + 1}-${pl}` });
      for (const [i, j] of jobs.entries()) {
        const done = st.videos.find(v => v.key === j.key && v.built);
        if (done && fs.existsSync(path.join(done.dir, 'timeline.json'))) continue;
        const vdir = path.join(dir, 'videos', j.key), sc = forPlatform(doc.scripts[j.si], j.pl, p);
        say(i / jobs.length, `${i + 1}/${jobs.length} ${ANGLES[sc.angle]?.name || sc.angle} · hook ${j.h + 1} · ${PLATFORM_NAMES[j.pl]}`);
        // clone variants: other opening order, music and pace than the winner (same body + voice)
        const variant = o.clone ? { seed: j.h + 1, mood: MOODS.filter(m => m !== src.mood)[j.h % 5], rate: [195, 205, 186][j.h % 3] } : { seed: j.h };
        const r = await buildAffVideo({ product: p, script: sc, hook: j.h, platform: j.pl, dir: vdir, voice: o.voice, dur: o.dur, variant, ownBroll: o.broll, say: (k, m) => say((i + k) / jobs.length, `${i + 1}/${jobs.length} ${m}`) });
        st.videos = st.videos.filter(v => v.key !== j.key).concat({ key: j.key, angle: sc.angle, hook: j.h, hook_type: sc.hooks[j.h].type, platform: j.pl, dir: vdir, duration: r.duration, hookEnd: r.hookEnd, built: true,
          voice: r.voice, human: r.human, price_hook: r.price_hook, heroes: r.heroes, details: r.details, fp: fingerprint([sc.hooks[j.h].say, ...sc.beats.map(b => b.say)], p.media.map(m => m.file)) });
        save();
      }
      return `${jobs.length} video`;
    },
    qc() {
      const out = [];
      for (const v of st.videos.filter(v => v.built)) {
        const r = check3s(v.dir, { fix: true }); v.qc3 = r.score;
        const log = complianceLog(v.dir, p, { platform: v.platform }); v.qc_warn = log.warnings;
        out.push(r.score);
      }
      save();
      const warn = st.videos.flatMap(v => v.qc_warn || []);
      if (warn.length) st.warnings = [...new Set([...(st.warnings || []), ...warn])];
      return `3 giây đầu: ${out.length ? Math.round(out.reduce((a, b) => a + b, 0) / out.length) : '—'}/100 trung bình${warn.length ? ` · ⚠ ${[...new Set(warn)].length} cảnh báo` : ' · nhật ký tuân thủ ổn'}`;
    },
    async export() {
      const todo = st.videos.filter(v => v.built);
      for (const [i, v] of todo.entries()) {
        if (v.mp4 && fs.existsSync(v.mp4) && v.cover && fs.existsSync(v.cover)) continue;
        say(i / todo.length, `${i + 1}/${todo.length} ${v.key}`);
        const out = await exportProject(v.dir, { quality: o.quality, onProgress: (k, s) => say((i + k * .92) / todo.length, `${i + 1}/${todo.length} ${v.key} (${s}) ${Math.round(k * 100)}%`) });
        const mp4 = path.join(v.dir, 'out', `${v.key}.mp4`); fs.renameSync(out, mp4);
        const cover = path.join(v.dir, 'out', `${v.key}-anh-bia.jpg`);
        await sh('node', [path.join(SKILL, 'scripts/render.mjs'), path.join(v.dir, 'timeline.json'), cover, '--still', String(r2(Math.max(.6, (v.hookEnd || 2.5) - .5))), cover]).catch(e => console.error('ảnh bìa lỗi: ' + e.message.slice(0, 120)));
        Object.assign(v, { mp4, cover: fs.existsSync(cover) ? cover : null }); save();
      }
      return `${todo.length} MP4`;
    },
    kit() {
      for (const v of st.videos.filter(v => v.mp4)) {
        const tl = rd(path.join(v.dir, 'timeline.json'));
        v.code = codeFor(`${path.basename(dir)}/${v.key}`);
        const kit = buildKit(tl, p, v.platform, { aiVoice: true, code: v.code }); writeKit(v.dir, kit);
        v.kit = path.join(v.dir, 'publish', `kit_${v.platform}.txt`); v.caption = kit.caption; v.hashtags = kit.hashtags;
      }
      save();
      return `${st.videos.length} bộ đăng`;
    },
    async schedule() {
      if (!o.schedule) return { skip: 'không bật tự xếp lịch (hồ sơ: aff_autoschedule)' };
      const { autoSchedule } = await import('./publish.mjs');
      const added = [];
      // interleave angles so the same angle/hook does not go out twice in a row
      const vids = [...st.videos.filter(v => v.mp4 && !v.scheduled)].sort((a, b) => a.hook - b.hook || a.angle.localeCompare(b.angle));
      const skipped = [];
      for (const v of vids) {
        const key = `${path.basename(dir)}/${v.key}`;
        registerVideo({ key, file: v.mp4, product: p.id, product_name: p.name, angle: v.angle, hook_type: v.hook_type, platform: v.platform, profile: prof.id, project: v.dir, fp: v.fp });
        const dup = dupOnOtherChannel(key, prof.id); // không đăng nội dung gần như giống hệt lên 2 kênh
        if (dup) { skipped.push(`${v.key} giống ${Math.round(dup.sim * 100)}% video kênh "${dup.profile}"`); v.dup = dup; continue; }
        const r = autoSchedule([{ file: v.mp4, project: v.dir }], [v.platform], { channel: prof.id, slots: prof.aff_slots });
        v.scheduled = r.map(x => x.when); added.push(...r); patchVideo(key, { scheduled_at: r[0]?.when });
      }
      if (skipped.length) st.warnings = [...new Set([...(st.warnings || []), ...skipped.map(x => 'Không xếp lịch: ' + x)])];
      save();
      return (added.length ? `${added.length} lượt đăng, từ ${new Date(added[0].when).toLocaleString('vi-VN')}` : 'không có video mới') + (skipped.length ? ` · bỏ ${skipped.length} video trùng kênh khác` : '');
    },
    deliver() {
      const res = {
        product: { id: p.id, name: p.name, price: p.price }, job: dir, profile: prof.id, options: o, warnings: st.warnings || [], learned: learned.notes,
        videos: st.videos.map(v => ({ key: v.key, angle: v.angle, angle_name: ANGLES[v.angle]?.name, hook: v.hook + 1, hook_type: v.hook_type, platform: v.platform, duration: v.duration, mp4: v.mp4, cover: v.cover, kit: v.kit, project: v.dir, scheduled: v.scheduled || null })),
        steps: Object.fromEntries(STEPS.map(([k, label]) => [k, { label, ...(st.steps[k] || {}) }])), seconds: Math.round((Date.now() - t00) / 1000), finished: new Date().toISOString(),
      };
      for (const v of st.videos.filter(v => v.mp4)) registerVideo({ key: `${path.basename(dir)}/${v.key}`, code: v.code, file: v.mp4, project: v.dir, product: p.id, product_name: p.name, angle: v.angle, hook_type: v.hook_type, platform: v.platform,
        title: rd(path.join(v.dir, 'timeline.json'))?.title, caption: v.caption, profile: prof.id, dur: v.duration, voice: v.voice, source: 'ai', human: !!v.human, price_hook: !!v.price_hook, fp: v.fp, qc3: v.qc3,
        ...(o.clone ? { variant_of: o.clone } : {}), ...(v.scheduled?.[0] ? { scheduled_at: v.scheduled[0] } : {}) });
      if (o.clone) patchVideo(o.clone, { cloned_at: new Date().toISOString() });
      const files = [];
      if (st.out) {
        const out = path.join(st.out, p.name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)); fs.mkdirSync(out, { recursive: true });
        for (const v of st.videos.filter(v => v.mp4)) {
          const nm = `${ANGLES[v.angle]?.name || v.angle} - hook ${v.hook + 1} - ${PLATFORM_NAMES[v.platform]}`.replace(/[\\/:*?"<>|]+/g, '-');
          for (const [src, suf] of [[v.mp4, '.mp4'], [v.cover, ' - ảnh bìa.jpg'], [v.kit, ' - bộ đăng.txt']]) if (src && fs.existsSync(src)) { fs.copyFileSync(src, path.join(out, nm + suf)); files.push(path.join(out, nm + suf)); }
        }
        wr(path.join(out, 'summary.json'), res); files.push(out); res.delivered = out;
      }
      wr(path.join(dir, 'summary.json'), res);
      const nv = st.videos.filter(v => v.mp4).length;
      notify('Tự lái affiliate xong', `${p.name}: ${nv} video${st.warnings?.length ? ' · có cảnh báo' : ''}`, { open: res.delivered || dir });
      return { msg: `${nv} video${files.length ? ' → ' + (res.delivered || dir) : ''}`, res };
    },
  };

  let result = null;
  for (const S of STEPS) {
    cur = S; const [k, label, w, req] = S;
    if (st.steps[k]?.state === 'done' || st.steps[k]?.state === 'skipped') { base += w; continue; }
    const t0 = Date.now(); say(0, '');
    try {
      const r = await actions[k]();
      const sec = Math.round((Date.now() - t0) / 1000);
      if (k === 'deliver') result = r.res;
      st.steps[k] = r && r.skip ? { state: 'skipped', msg: r.skip, sec } : { state: 'done', msg: String((r && r.msg) || r || ''), sec };
      console.log(`✓ ${label} (${sec}s)${st.steps[k].msg ? ' — ' + st.steps[k].msg : ''}`);
    } catch (e) {
      const sec = Math.round((Date.now() - t0) / 1000);
      if (req) { st.steps[k] = { state: 'error', msg: e.message, sec }; st.state = 'error'; st.error = `${label}: ${e.message}`; save(); throw new Error(st.error); }
      st.steps[k] = { state: 'warn', msg: e.message, sec }; console.error(`⚠ ${label}: ${e.message}`);
    }
    save(); base += w;
  }
  st.state = 'done'; st.finished = new Date().toISOString(); save();
  result = result || rd(path.join(dir, 'summary.json'));
  const outputs = [result?.delivered || dir, ...st.videos.filter(v => v.mp4).map(v => v.mp4)];
  return { job: dir, outputs, summary: result };
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a.includes('--steps')) { for (const [k, l, , r] of STEPS) console.log(`${k.padEnd(11)} ${l}${r ? ' (bắt buộc)' : ''}`); return; }
  const id = a[0] && !a[0].startsWith('--') ? a[0] : null;
  if (!id) throw new Error('cách dùng: node scripts/autopilot_aff.mjs <product-id> [--angles 3] [--hooks 2] [--platforms tiktok,facebook] [--out dir] [--schedule]');
  const r = await autopilotAff(id, { clone: opt('--clone'), n: opt('--n'), profile: opt('--profile'), angles: opt('--angles'), hooks: opt('--hooks'), platforms: opt('--platforms'), dur: opt('--dur'), angle: opt('--angle'),
    voice: opt('--voice'), out: opt('--out'), schedule: a.includes('--schedule') ? true : undefined, offline: a.includes('--offline'), restart: a.includes('--restart'), from: opt('--from'), project: opt('--project') });
  console.log('@@ 1.000 Xong');
  console.log('RESULT ' + JSON.stringify({ job: r.job, outputs: r.outputs, videos: r.summary?.videos?.length || 0 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
