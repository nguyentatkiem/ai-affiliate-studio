// Giọng đọc cho video affiliate: edge-tts (cần mạng), giọng Mac (offline) và GIỌNG NHÂN BẢN của chính bạn
// (repo kiểu NGUYEN-TAT-KIEM-VOICE: model chạy trên máy, nạp một lần cho cả video qua scripts/voice_clone.py).
// Đăng ký giọng nhân bản: tự nhận ~/Projects/NGUYEN-TAT-KIEM-VOICE hoặc thêm vào AVS_HOME/voices.json:
//   {"voices":[{"id":"clone:kiem","name":"Giọng tôi","repo":"~/Projects/NGUYEN-TAT-KIEM-VOICE"}]}
// Giọng nhân bản là giọng người thật → bộ đăng luôn nhắc bật nhãn "Nội dung do AI tạo". Spec: references/affiliate.md §Giọng.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVS_HOME } from './profile.mjs';
import { sh, probe } from './highlights.mjs';
import { tts } from './topic_video.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const home = s => String(s || '').replace(/^~(?=[\\/]|$)/, os.homedir());
export const BASE_VOICES = [
  { id: 'edge:vi-VN-HoaiMyNeural', name: 'Hoài My (nữ, edge-tts, miễn phí, cần mạng)' },
  { id: 'edge:vi-VN-NamMinhNeural', name: 'Nam Minh (nam, edge-tts, miễn phí, cần mạng)' },
  { id: 'Linh', name: 'Linh (nữ, macOS, offline)' },
];
const okRepo = r => r && fs.existsSync(path.join(r, 'giong.py')) && fs.existsSync(path.join(r, '.venv/bin/python')) && fs.readdirSync(path.join(r, 'models')).length > 0;
export function cloneVoices() {
  const out = [];
  let cfg = []; try { cfg = JSON.parse(fs.readFileSync(path.join(AVS_HOME, 'voices.json'), 'utf8')).voices || []; } catch {}
  for (const v of cfg) { const repo = path.resolve(home(v.repo)); if (okRepo(repo)) out.push({ id: v.id.startsWith('clone:') ? v.id : 'clone:' + v.id, name: v.name || v.id, repo }); }
  for (const d of [path.join(os.homedir(), 'Projects/NGUYEN-TAT-KIEM-VOICE'), path.join(os.homedir(), 'NGUYEN-TAT-KIEM-VOICE')]) {
    try { if (okRepo(d) && !out.some(v => v.repo === d)) out.push({ id: 'clone:nguyen-tat-kiem', name: 'Giọng Nguyễn Tất Kiểm (nhân bản, offline)', repo: d }); } catch {}
  }
  return out;
}
export const allVoices = () => [...cloneVoices().map(v => ({ id: v.id, name: v.name, clone: true })), ...BASE_VOICES];

// ---------- số → chữ (giọng nhân bản đọc "199k" không chuẩn) ----------
const D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function ba(n, full) { // 0..999
  const t = Math.floor(n / 100), c = Math.floor(n % 100 / 10), d = n % 10, o = [];
  if (t || full) o.push(D[t], 'trăm');
  if (c > 1) { o.push(D[c], 'mươi'); if (d === 1) o.push('mốt'); else if (d === 5) o.push('lăm'); else if (d === 4) o.push('tư'); else if (d) o.push(D[d]); }
  else if (c === 1) { o.push('mười'); if (d === 5) o.push('lăm'); else if (d) o.push(D[d]); }
  else if (d) { if (t || full) o.push('lẻ'); o.push(D[d]); }
  return o.join(' ');
}
export function soThanhChu(n) {
  n = Math.round(+n); if (!isFinite(n)) return String(n); if (n === 0) return 'không'; if (n < 0) return 'âm ' + soThanhChu(-n);
  const U = ['', 'nghìn', 'triệu', 'tỷ'], parts = []; let i = 0, x = n;
  while (x > 0) { parts.unshift([x % 1000, i]); x = Math.floor(x / 1000); i++; }
  return parts.map(([v, u], k) => (v ? `${ba(v, k > 0)} ${U[u]}`.trim() : '')).filter(Boolean).join(' ').replace(/\s+/g, ' ');
}
export function spellNumbers(t) {
  return String(t)
    .replace(/(\d+(?:[.,]\d+)?)\s*(triệu|tr)\b/gi, (_, a) => { const v = +a.replace(',', '.'); return Number.isInteger(v) ? `${soThanhChu(v)} triệu` : `${soThanhChu(Math.floor(v))} triệu ${soThanhChu(Math.round((v % 1) * 1000))} nghìn`; })
    .replace(/(\d+)\s*k\b/gi, (_, a) => `${soThanhChu(+a)} nghìn`)
    .replace(/(\d{1,3}(?:[.,]\d{3})+)\s*(đ|đồng|vnd)?/gi, (_, a, u) => `${soThanhChu(+a.replace(/[.,]/g, ''))}${u ? ' đồng' : ''}`)
    .replace(/(\d+)\s*%/g, (_, a) => `${soThanhChu(+a)} phần trăm`)
    .replace(/\d+/g, a => soThanhChu(+a));
}

// Đọc tất cả câu một lượt. lines: [{say, file}] → mỗi file .wav 48 kHz stereo đã cắt lặng; trả về [độ dài].
export async function speakAll(lines, voice, rate, { say = () => {} } = {}) {
  if (!String(voice).startsWith('clone:')) { const ds = []; for (const [i, L] of lines.entries()) { say(i / lines.length, `Đọc lời ${i + 1}/${lines.length}`); ds.push(await tts(L.say, voice, rate, L.file)); } return ds; }
  const v = cloneVoices().find(x => x.id === voice) || cloneVoices()[0];
  if (!v) throw new Error('Không thấy giọng nhân bản trên máy (cần repo giọng có .venv và models)');
  const jobs = lines.map(L => ({ text: spellNumbers(L.say), out: L.file.replace(/\.wav$/, '.raw.wav') }));
  const jf = path.join(path.dirname(lines[0].file), 'clone_jobs.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
  await sh(path.join(v.repo, '.venv/bin/python'), [path.join(HERE, 'voice_clone.py'), v.repo, jf], { onLine: l => { const m = /^@@ ([\d.]+) (.*)$/.exec(l); if (m) say(+m[1], `Giọng nhân bản: ${m[2]}`); } });
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse';
  const tempo = rate > 205 ? `,atempo=${Math.min(1.25, rate / 195).toFixed(3)}` : '';
  const ds = [];
  for (const [i, L] of lines.entries()) { await sh('ffmpeg', ['-v', 'error', '-y', '-i', jobs[i].out, '-af', trim + tempo, '-ar', '48000', '-ac', '2', L.file]); fs.rmSync(jobs[i].out, { force: true }); ds.push(probe(L.file).dur); }
  return ds;
}
