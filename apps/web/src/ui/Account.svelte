<script lang="ts">
  import { onMount } from 'svelte';
  // ───────── 계정 영역: 구글 로그인 · 프로필 · 연동 해제 · 로그아웃 · 탈퇴 (account.ts 포트) ─────────
  // 게임 데이터는 전부 localStorage에 남고, 여기서 다루는 건 로그인 상태뿐이다. 오프라인/서버
  // 오류에도 게임 자체는 그대로 플레이할 수 있어야 하므로, 실패 시 조용히 "로그아웃 상태" 취급하고
  // 게임 화면을 막지 않는다.
  import {
    unlinkGoogle, logout, startProfileDeletion, confirmProfileDeletion,
  } from '@offside/app-core/api/client';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { refreshChatIdentity } from './chat-state.svelte.js';
  import { accountLabel, isMember } from '@offside/app-core/account';
  import { closeSheet, showSheet } from './sheetState.svelte.js';
  import NicknameForm from './NicknameForm.svelte';
  import { accountText as L } from '@offside/app-core/i18n/ko/account';

  /** 관리자 계정(설정 화면이 확인한다)은 댓글 닉네임이 '운영자'로 고정돼 바꾸는 칸이 없다. */
  let { admin = false }: { admin?: boolean } = $props();

  // `undefined`는 "아직 한 번도 불러오지 않음"을, `null`은 "확인 결과 로그인 안 됨"을 뜻한다. 설정 화면은
  // 벗어났다 돌아오면 이 컴포넌트가 다시 마운트되므로, 모듈 스코프에 캐시를 둬 재검증
  // 간격이 지나기 전까지는 "확인 중…" 이 다시 보이지 않게 한다(원본 account.ts와 동일한 캐시 정책).
  // 로그인 상태는 OAuth 복귀(전체 새로고침)나 이 패널의 버튼으로만 바뀐다 — 설정을 오갈 때마다 다시 묻지 않는다.
  const REVALIDATE_MS = 5 * 60_000;
  // 화면은 반응형 모듈 캐시를 그대로 그린다(설정의 운영 도구 입구도 같은 값을 본다).
  const profile = $derived(accountCache.value);
  const set = (v: typeof accountCache.value) => (accountCache.value = v);

  async function load(silent = false) {
    if (!silent) set(undefined);
    await refreshAccount();
  }

  onMount(() => {
    if (accountCache.value === undefined) void load();
    else if (Date.now() - accountCache.fetchedAt > REVALIDATE_MS) void load(true);
  });

  async function doUnlink() {
    const r = await unlinkGoogle();
    if (r.ok) {
      refreshChatIdentity();
      await load();
    }
    else set('error');
  }
  async function doLogout() {
    closeSheet();
    await logout();
    refreshChatIdentity();
    set(null);
  }
  function askLogout() {
    showSheet(
      { kind: 'notice', eyebrow: 'Account', title: L.logoutTitle, muted: true, text: L.logoutBodyWeb },
      [
        { label: L.logout, cls: 'btn-primary', fn: () => void doLogout() },
        { label: L.cancel, fn: closeSheet },
      ],
    );
  }
  async function doDeleteFlow() {
    if (!window.confirm(L.deleteBody)) return;
    const start = await startProfileDeletion();
    if (!start.ok) return set('error');
    const confirmResult = await confirmProfileDeletion(start.data.confirmToken);
    if (confirmResult.ok) refreshChatIdentity();
    set(confirmResult.ok ? null : 'error');
  }
</script>

{#if profile === undefined}
  <div class="account-card"><div class="who"><b>{L.title}</b><span class="muted">{L.checking}</span></div></div>
{:else if profile === 'error'}
  <div class="account-card">
    <div class="who"><b>{L.errorTitle}</b><span class="muted">{L.errorBody}</span></div>
    <button class="btn btn-sm" onclick={() => load()}>{L.retry}</button>
  </div>
{:else if !profile || !isMember(profile)}
  <!-- T-10-102 비로그인은 안내만 — 구글 로그인 버튼은 구단주 화면이 카드 밖에 하나만 둔다(T-11-026 잠긴 '내 팀' 카드 안). -->
  <div class="account-card">
    <div class="who"><b>{L.guestTitle}</b><span class="muted">{L.guestBody}</span></div>
  </div>
{:else}
  {@const label = accountLabel(profile)}
  <div class="account-card">
    <div class="who"><b>{label.title}</b><span class="muted">{label.via}</span></div>
    <button class="btn btn-primary btn-sm" data-act="logout" onclick={askLogout}>{L.logout}</button>
  </div>
  <div class="account-nick">
    <span class="muted">{profile.nickname ? L.nickname : L.nicknamePrompt}</span>
    {#if admin}<b>{L.nicknameFixed({ nickname: profile.nickname })}</b>
    {:else}{#key profile.nickname}<NicknameForm current={profile.nickname} />{/key}{/if}
  </div>
  <div class="account-more">
    {#if profile.linked.google}
      <button class="link-btn" onclick={doUnlink}>{L.unlinkGoogle}</button>
      <span aria-hidden="true">·</span>
    {/if}
    <button class="link-btn bad" onclick={doDeleteFlow}>{L.deleteAccount}</button>
  </div>
{/if}
