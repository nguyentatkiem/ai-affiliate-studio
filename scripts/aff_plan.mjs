// LỊCH NỘI DUNG TỰ CHẠY: mỗi kênh (hồ sơ) đặt mục tiêu "N video/ngày" → mỗi sáng lập kế hoạch (aff_insights.todayPlan:
// nhân bản video thắng + làm mới sản phẩm điểm cao) → đưa vào hàng đợi Tự lái với "tự xếp lịch đăng" theo khung giờ của kênh.
// Bạn chỉ duyệt video và bấm đăng. Hồ sơ: aff_daily (số video/ngày), aff_auto_plan (tự chạy mỗi sáng), aff_plan_hour (giờ chạy, mặc định 7).
// Kế hoạch đã chạy: affiliate/plans/<ngày>-<kênh>.json (không chạy trùng). Thứ Hai: kèm báo cáo tuần.
// Spec: references/affiliate.md §Lịch tự chạy. CLI: node scripts/aff_plan.mjs show|run [--profile id] [--quota 6] | due
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVS_HOME, loadStore } from './profile.mjs';
import { todayPlan, weeklyReport } from './aff_insights.mjs';
import { addItem } from './queue.mjs';
import { notify } from './notify.mjs';

const DIR = path.join(AVS_HOME, 'affiliate/plans');
const vnNow = () => new Date(Date.now() + 7 * 36e5); // giờ Việt Nam (UTC+7) qua getUTC*
const today = () => vnNow().toISOString().slice(0, 10);
const planFile = (date, prof) => path.join(DIR, `${date}-${prof}.json`);
export const loadPlan = (prof, date = today()) => { try { return JSON.parse(fs.readFileSync(planFile(date, prof), 'utf8')); } catch { return null; } };
export function listPlans(limit = 14) { if (!fs.existsSync(DIR)) return []; return fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit).map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))); }

export function runPlan({ profile, quota, plan, source = 'ui' } = {}) {
  const P = plan || todayPlan({ profile, quota });
  if (loadPlan(P.profile, P.date)?.queued) throw new Error(`Kế hoạch ${P.date} của kênh "${P.profile_name}" đã chạy rồi`);
  const queued = [];
  for (const it of P.items) {
    const opts = { profile: P.profile, schedule: true };
    if (it.type === 'clone') Object.assign(opts, { clone: it.video, n: it.n });
    else Object.assign(opts, { angles: it.angles, hooks: it.hooks, platforms: (it.platforms || []).join(',') });
    const q = addItem({ kind: 'aff', input: it.product, opts, source, title: `${it.type === 'clone' ? 'Nhân bản: ' : ''}${it.name}` });
    queued.push(q.id); it.queue = q.id;
  }
  const out = { ...P, queued, ran: new Date().toISOString(), source };
  fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(planFile(P.date, P.profile), JSON.stringify(out, null, 1));
  return out;
}

// Called by the queue runner every minute: profiles with aff_auto_plan run once a day after aff_plan_hour (VN time).
export function dueAutoPlans() {
  const h = vnNow().getUTCHours(), done = [];
  for (const prof of loadStore().profiles.filter(p => p.aff_auto_plan)) {
    if (h < (prof.aff_plan_hour ?? 7) || loadPlan(prof.id)) continue;
    try {
      const r = runPlan({ profile: prof.id, source: 'auto' });
      notify('Kế hoạch affiliate hôm nay', `${prof.name}: ${r.videos} video (${r.items.length} việc) đang làm, sẽ tự xếp lịch đăng`);
      done.push(r);
    } catch (e) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(planFile(today(), prof.id), JSON.stringify({ date: today(), profile: prof.id, error: e.message, items: [] })); }
  }
  // Monday morning: weekly report once
  const rf = path.join(AVS_HOME, 'affiliate/reports', `${today()}.md`);
  if (vnNow().getUTCDay() === 1 && h >= 8 && !fs.existsSync(rf) && loadStore().profiles.some(p => p.aff_auto_plan)) {
    try { const r = weeklyReport(); notify('Báo cáo affiliate tuần', `${r.week.orders} đơn · ${Math.round(r.week.commission).toLocaleString('vi-VN')}đ hoa hồng`, { open: r.file }); } catch {}
  }
  return done;
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a[0] === 'run') { console.log(JSON.stringify(runPlan({ profile: opt('--profile'), quota: opt('--quota'), source: 'cli' }), null, 1)); return; }
  if (a[0] === 'due') { console.log(JSON.stringify(dueAutoPlans(), null, 1)); return; }
  console.log(JSON.stringify(todayPlan({ profile: opt('--profile'), quota: opt('--quota') }), null, 1));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
