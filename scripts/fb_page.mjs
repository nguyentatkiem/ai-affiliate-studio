// Đăng Reels lên TRANG Facebook (Page) qua Graph API + bình luận đầu chứa link affiliate. Trang cá nhân không có API → nhắc đăng tay.
// Cần Page access token (quyền pages_manage_posts, pages_read_engagement, pages_show_list, publish_video) của app Meta do bạn tạo.
// Dữ liệu: AVS_HOME/facebook.json (quyền 600), không bao giờ in token. Spec: references/affiliate.md §Đăng Facebook.
//   node scripts/fb_page.mjs connect <page_id> <page_access_token> | status | disconnect
//   node scripts/fb_page.mjs post <video.mp4> --caption "…" [--comment "…"]
// Env kiểm thử: AVS_FB_API (máy chủ giả thay https://graph.facebook.com), AVS_FB_RUPLOAD.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HOME = () => process.env.AVS_HOME || path.join(os.homedir(), '.ai-affiliate-studio');
const F = () => path.join(HOME(), 'facebook.json');
const V = 'v21.0';
const API = () => (process.env.AVS_FB_API || 'https://graph.facebook.com').replace(/\/$/, '');
const RUP = () => (process.env.AVS_FB_RUPLOAD || 'https://rupload.facebook.com').replace(/\/$/, '');
const load = () => { try { return JSON.parse(fs.readFileSync(F(), 'utf8')); } catch { return null; } };
function savePrivate(o) { fs.mkdirSync(HOME(), { recursive: true }); fs.writeFileSync(F(), JSON.stringify(o, null, 1), { mode: 0o600 }); fs.chmodSync(F(), 0o600); }
export const fbConnected = () => !!(load()?.page_id && load()?.token);

async function graph(method, p, params = {}, token) {
  const u = new URL(`${API()}/${V}/${p}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(method === 'GET' ? `${u}?${body}` : u, method === 'GET' ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(`Facebook: ${j.error?.message || r.status}`); e.code = j.error?.code; if ([190, 102].includes(j.error?.code)) e.reconnect = true; throw e; }
  return j;
}
export async function fbConnect(pageId, token) {
  const me = await graph('GET', pageId, { fields: 'id,name' }, token);
  if (!me.id) throw new Error('Facebook không trả về thông tin Trang — kiểm tra Page ID và token');
  savePrivate({ page_id: me.id, page_name: me.name, token, connected: new Date().toISOString() });
  return { page_id: me.id, page_name: me.name };
}
export function fbStatus() { const c = load(); return c ? { connected: true, page_id: c.page_id, page_name: c.page_name, since: c.connected } : { connected: false }; }
export function fbDisconnect() { fs.rmSync(F(), { force: true }); return { connected: false }; }

// Reels publishing: start → binary upload to rupload → finish (PUBLISHED) → first comment (retried while the video processes).
export async function fbPostReel(file, { caption = '', comment = '', onProgress = () => {} } = {}) {
  const c = load(); if (!c) throw Object.assign(new Error('Chưa kết nối Trang Facebook'), { reconnect: true });
  const size = fs.statSync(file).size;
  onProgress(.05, 'khởi tạo');
  const st = await graph('POST', `${c.page_id}/video_reels`, { upload_phase: 'start' }, c.token);
  onProgress(.15, 'tải video');
  const up = await fetch(st.upload_url || `${RUP()}/video-upload/${V}/${st.video_id}`, { method: 'POST', headers: { Authorization: `OAuth ${c.token}`, offset: '0', file_size: String(size) }, body: fs.readFileSync(file) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw new Error('Facebook: tải video lỗi ' + (uj.debug_info?.message || up.status));
  onProgress(.8, 'đăng');
  await graph('POST', `${c.page_id}/video_reels`, { upload_phase: 'finish', video_id: st.video_id, video_state: 'PUBLISHED', description: caption }, c.token);
  let commented = false, cErr = null;
  if (comment) for (let i = 0; i < 6 && !commented; i++) {
    try { await graph('POST', `${st.video_id}/comments`, { message: comment }, c.token); commented = true; }
    catch (e) { cErr = e.message; await new Promise(r => setTimeout(r, process.env.AVS_FB_API ? 10 : 20000)); }
  }
  onProgress(1, 'xong');
  return { id: st.video_id, url: `https://www.facebook.com/reel/${st.video_id}`, commented, commentError: commented ? null : cErr };
}

async function main() {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a[0] === 'connect') { console.log(JSON.stringify(await fbConnect(a[1], a[2]))); return; }
  if (a[0] === 'status') { console.log(JSON.stringify(fbStatus())); return; }
  if (a[0] === 'disconnect') { console.log(JSON.stringify(fbDisconnect())); return; }
  if (a[0] === 'post') { console.log(JSON.stringify(await fbPostReel(path.resolve(a[1]), { caption: opt('--caption') || '', comment: opt('--comment') || '', onProgress: (k, s) => console.log(`@@ ${k.toFixed(2)} ${s}`) }))); return; }
  throw new Error('lệnh: connect <page_id> <token> | status | disconnect | post <mp4> --caption … [--comment …]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href) main().catch(e => { console.error('LỖI: ' + e.message); process.exit(1); });
