<script lang="ts">
  import { untrack } from 'svelte';
  // ───────── 계정 영역: 구글 로그인 · 프로필 · 연동 해제 · 로그아웃 · 탈퇴 (account.ts 포트) ─────────
  // 게임 데이터는 전부 localStorage에 남고, 여기서 다루는 건 로그인 상태뿐이다. 오프라인/서버
  // 오류에도 게임 자체는 그대로 플레이할 수 있어야 하므로, 실패 시 조용히 "로그아웃 상태" 취급하고
  // 게임 화면을 막지 않는다.
  import {
    getProfile, unlinkGoogle, logout, startProfileDeletion, confirmProfileDeletion, googleStartUrl,
    type Profile,
  } from '../api/client.js';
  import { accountCache } from './account-state.svelte.js';
  import { closeSheet, showSheet } from './sheetState.svelte.js';

  // `undefined`는 "아직 한 번도 불러오지 않음"을, `null`은 "확인 결과 로그인 안 됨"을 뜻한다. 설정 화면은
  // 벗어났다 돌아오면 이 컴포넌트가 다시 마운트되므로, 모듈 스코프에 캐시를 둬 재검증
  // 간격이 지나기 전까지는 "확인 중…" 이 다시 보이지 않게 한다(원본 account.ts와 동일한 캐시 정책).
  // 로그인 상태는 OAuth 복귀(전체 새로고침)나 이 패널의 버튼으로만 바뀐다 — 설정을 오갈 때마다 다시 묻지 않는다.
  const REVALIDATE_MS = 5 * 60_000;
  type ProfileState = Profile | null | 'error' | undefined;

  let profile = $state<ProfileState>(accountCache.value);
  // 화면 상태와 모듈 캐시를 항상 함께 갱신한다.
  const set = (v: ProfileState) => {
    accountCache.value = v;
    profile = v;
  };

  async function load(silent = false) {
    if (!silent) profile = undefined;
    const r = await getProfile();
    accountCache.fetchedAt = Date.now();
    set(r.ok ? r.data : 'error');
  }

  // 캐시가 반응형이라 읽기를 untrack으로 감싸 마운트 때 한 번만 돈다.
  $effect(() =>
    untrack(() => {
      if (accountCache.value === undefined) void load();
      else if (Date.now() - accountCache.fetchedAt > REVALIDATE_MS) void load(true);
    }),
  );

  async function doUnlink() {
    const r = await unlinkGoogle();
    if (r.ok) await load();
    else set('error');
  }
  async function doLogout() {
    closeSheet();
    await logout();
    set(null);
  }
  function askLogout() {
    showSheet(
      { kind: 'notice', eyebrow: 'Account', title: '로그아웃할까요?', muted: true, text: '이 기기에 저장된 게임 진행은 그대로 남아요. 같은 구글 계정으로 다시 로그인하면 계정에 저장된 기록을 다시 볼 수 있어요.' },
      [
        { label: '로그아웃', cls: 'btn-primary', fn: () => void doLogout() },
        { label: '취소', fn: closeSheet },
      ],
    );
  }
  async function doDeleteFlow() {
    if (!window.confirm('정말 계정을 삭제할까요? 이 기기의 게임 저장 데이터는 남지만, 계정 연동은 완전히 사라집니다.')) return;
    const start = await startProfileDeletion();
    if (!start.ok) return set('error');
    const confirmResult = await confirmProfileDeletion(start.data.confirmToken);
    set(confirmResult.ok ? null : 'error');
  }
</script>

{#if profile === undefined}
  <div class="account"><div class="eyebrow">Account</div><p class="muted" style="font-size:13px">확인 중…</p></div>
{:else if profile === 'error'}
  <div class="account">
    <div class="eyebrow">Account</div>
    <p class="muted" style="font-size:13px">서버에 연결할 수 없어 로그인 상태를 확인하지 못했습니다. 게임은 계속 즐길 수 있어요 — 저장은 이 기기에만 남습니다.</p>
    <div class="account-actions"><button class="btn" onclick={() => load()}>다시 시도</button></div>
  </div>
{:else if !profile || !profile.linked.google}
  <div class="account">
    <div class="eyebrow">Account</div>
    <p class="muted" style="font-size:13px">구글 계정을 연결하면 다른 기기에서도 로그인할 수 있어요. (게임 진행은 이 기기에만 저장됩니다.)</p>
    <div class="account-actions"><a class="btn btn-primary g-btn" href={googleStartUrl()}>구글로 로그인</a></div>
  </div>
{:else}
  <div class="account">
    <div class="eyebrow">Account</div>
    <div class="account-row"><div class="who"><b>{profile.googleEmailMasked ?? '구글 계정'}</b><span class="muted" style="font-size:12px">연결됨</span></div></div>
    <div class="account-actions">
      <button class="btn" onclick={doUnlink}>연동 해제</button>
      <button class="btn" data-act="logout" onclick={askLogout}>로그아웃</button>
      <button class="btn" style="color:var(--bad)" onclick={doDeleteFlow}>계정 삭제</button>
    </div>
  </div>
{/if}
