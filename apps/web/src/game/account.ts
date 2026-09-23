// ───────── 계정 영역: 구글 로그인 · 프로필 · 연동 해제 · 로그아웃 · 탈퇴 ─────────
// 풀타임 원본에는 없던 새 UI. 게임 데이터는 전부 localStorage에 남고, 여기서 다루는 건 로그인
// 상태뿐이다. 오프라인/서버 오류에도 게임 자체는 그대로 플레이할 수 있어야 하므로, 실패 시 조용히
// "로그아웃 상태" 취급하고 게임 화면을 막지 않는다.
import { getProfile, unlinkGoogle, logout, startProfileDeletion, confirmProfileDeletion, googleStartUrl, type Profile } from '../api/client.js';

const esc = (t: unknown): string => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let cached: Profile | null | 'error' = null;

function render(el: HTMLElement, profile: Profile | null | 'error') {
  if (profile === 'error') {
    el.innerHTML = `<div class="account"><div class="eyebrow">Account</div>
      <p class="muted" style="font-size:13px">서버에 연결할 수 없어 로그인 상태를 확인하지 못했습니다. 게임은 계속 즐길 수 있어요 — 저장은 이 기기에만 남습니다.</p>
      <div class="account-actions"><button class="btn" id="acct-retry">다시 시도</button></div></div>`;
    el.querySelector('#acct-retry')?.addEventListener('click', () => void load(el));
    return;
  }
  if (!profile || !profile.linked.google) {
    el.innerHTML = `<div class="account"><div class="eyebrow">Account</div>
      <p class="muted" style="font-size:13px">구글 계정을 연결하면 다른 기기에서도 로그인할 수 있어요. (게임 진행은 이 기기에만 저장됩니다.)</p>
      <div class="account-actions"><a class="btn btn-primary g-btn" href="${googleStartUrl()}">구글로 로그인</a></div></div>`;
    return;
  }
  el.innerHTML = `<div class="account"><div class="eyebrow">Account</div>
    <div class="account-row"><div class="who"><b>${esc(profile.googleEmailMasked ?? '구글 계정')}</b><span class="muted" style="font-size:12px">연결됨</span></div></div>
    <div class="account-actions">
      <button class="btn" id="acct-unlink">연동 해제</button>
      <button class="btn" id="acct-logout">로그아웃</button>
      <button class="btn" id="acct-delete" style="color:var(--bad)">계정 삭제</button>
    </div></div>`;
  el.querySelector('#acct-unlink')?.addEventListener('click', () => void doUnlink(el));
  el.querySelector('#acct-logout')?.addEventListener('click', () => void doLogout(el));
  el.querySelector('#acct-delete')?.addEventListener('click', () => void doDeleteFlow(el));
}

async function load(el: HTMLElement) {
  el.innerHTML = `<div class="account"><div class="eyebrow">Account</div><p class="muted" style="font-size:13px">확인 중…</p></div>`;
  const r = await getProfile();
  cached = r.ok ? r.data : 'error';
  render(el, cached);
}

async function doUnlink(el: HTMLElement) {
  const r = await unlinkGoogle();
  if (r.ok) await load(el);
  else render(el, 'error');
}
async function doLogout(el: HTMLElement) {
  await logout();
  cached = null;
  render(el, null);
}
async function doDeleteFlow(el: HTMLElement) {
  if (!window.confirm('정말 계정을 삭제할까요? 이 기기의 게임 저장 데이터는 남지만, 계정 연동은 완전히 사라집니다.')) return;
  const start = await startProfileDeletion();
  if (!start.ok) return render(el, 'error');
  const confirmResult = await confirmProfileDeletion(start.data.confirmToken);
  if (confirmResult.ok) {
    cached = null;
    render(el, null);
  } else render(el, 'error');
}

export function mountAccount(el: HTMLElement) {
  void load(el);
}
