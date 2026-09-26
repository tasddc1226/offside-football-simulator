<script lang="ts">
  import { onMount } from 'svelte';
  // ───────── 계정 영역: 구글 로그인 · 프로필 · 연동 해제 · 로그아웃 · 탈퇴 (account.ts 포트) ─────────
  // 게임 데이터는 전부 localStorage에 남고, 여기서 다루는 건 로그인 상태뿐이다. 오프라인/서버
  // 오류에도 게임 자체는 그대로 플레이할 수 있어야 하므로, 실패 시 조용히 "로그아웃 상태" 취급하고
  // 게임 화면을 막지 않는다.
  import {
    unlinkGoogle, logout, startProfileDeletion, confirmProfileDeletion, googleStartUrl,
  } from '../api/client.js';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { closeSheet, showSheet } from './sheetState.svelte.js';
  import NicknameForm from './NicknameForm.svelte';
  import { rememberLoginReturn } from './login.js';

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
  <div class="account-card"><div class="who"><b>계정</b><span class="muted">확인 중…</span></div></div>
{:else if profile === 'error'}
  <div class="account-card">
    <div class="who"><b>연결할 수 없어요</b><span class="muted">서버에 연결하지 못해 로그인 상태를 확인하지 못했어요. 게임은 계속 즐길 수 있고, 저장은 이 기기에 남습니다.</span></div>
    <button class="btn" onclick={() => load()}>다시 시도</button>
  </div>
{:else if !profile || !profile.linked.google}
  <div class="account-card">
    <div class="who"><b>로그인하지 않았어요</b><span class="muted">구글 계정을 연결하면 은퇴한 선수 기록과 구단 이름을 다른 기기에서도 볼 수 있어요. 게임 진행은 이 기기에만 저장됩니다.</span></div>
    <!-- 설정에서 로그인하면 설정으로 돌아온다(소식에서 로그인하다 그만둔 기록을 지운다). -->
    <a class="btn btn-primary" href={googleStartUrl()} onclick={() => rememberLoginReturn(null)}>구글로 로그인</a>
  </div>
{:else}
  <div class="account-card">
    <div class="who"><b>{profile.googleEmailMasked ?? '구글 계정'}</b><span class="muted">Google 계정으로 로그인했어요.</span></div>
    <button class="btn btn-primary" data-act="logout" onclick={askLogout}>로그아웃</button>
  </div>
  <div class="account-nick">
    <span class="muted">댓글 닉네임{profile.nickname ? '' : ' — 정하면 소식 게시판에 댓글을 쓸 수 있어요'}</span>
    {#if admin}<b>{profile.nickname} · 운영자 계정은 고정이에요</b>
    {:else}{#key profile.nickname}<NicknameForm current={profile.nickname} />{/key}{/if}
  </div>
  <div class="account-more">
    <button class="link-btn" onclick={doUnlink}>구글 연동 해제</button>
    <span aria-hidden="true">·</span>
    <button class="link-btn bad" onclick={doDeleteFlow}>계정 삭제</button>
  </div>
{/if}
