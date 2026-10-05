<script lang="ts">
  // T-11-098 친구 · 친선전 — 내 친구 코드(초대 링크) · 코드로 신청 · 받은/보낸 신청 · 친구 목록과 친선전 · 최근 친선전.
  // 친선전은 레이팅·전적에 들어가지 않는다. 이 쪽을 열 때만 불러온다(웹 메모 1분, 쓰기를 하면 메모가 비워진다).
  import { onMount } from 'svelte';
  import { normalizeFriendCode } from '@offside/contracts/owner-team';
  import {
    acceptFriend,
    fetchFriends,
    playFriendly,
    removeFriend,
    requestFriend,
    type FriendPerson,
    type FriendsResponse,
  } from '@offside/app-core/api/friends';
  import type { TeamMatch } from '@offside/app-core/api/team';
  import {
    friendAcceptedText,
    friendCodeLabel,
    friendInviteText,
    friendInviteUrl,
    friendRequestText,
    h2hText,
  } from '@offside/app-core/friendText';
  import { toast } from '../helpers.js';
  import { copyText } from '../inapp-open.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import { clearInvite, pendingInvite } from '../friendInvite.svelte.js';
  import TeamLogo from './TeamLogo.svelte';
  import TeamMatchRow from './TeamMatchRow.svelte';

  let {
    onplayed,
    onopen,
  }: {
    /** 친선전을 치렀다 — 결과(중계)를 연다. */
    onplayed: (m: TeamMatch, matchesLeft: number) => void;
    /** 최근 친선전 한 경기를 연다. */
    onopen: (m: TeamMatch, matchesLeft: number) => void;
  } = $props();

  let status = $state<LoadStatus>('loading');
  let data = $state<FriendsResponse | null>(null);
  let busy = $state(false);
  let codeInput = $state('');
  let invite = $state<string | null>(pendingInvite());

  async function load() {
    status = 'loading';
    const r = await fetchFriends();
    if (!r.ok) {
      status = 'error';
      return;
    }
    data = r.data;
    // 내 코드로 들어온 초대 링크는 쓸 일이 없다.
    if (invite && invite === r.data.code) {
      clearInvite();
      invite = null;
    }
    status = 'ready';
  }
  onMount(() => void load());

  /** 쓰기 하나를 돌리고(겹치지 않게) 성공하면 목록을 다시 받는다. */
  async function run<T>(
    act: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
    done?: (d: T) => void,
  ) {
    if (busy) return;
    busy = true;
    const r = await act();
    busy = false;
    if (!r.ok) return toast(r.error.message);
    done?.(r.data);
    await load();
  }

  function sendCode(raw: string, fromInvite = false) {
    const code = normalizeFriendCode(raw);
    if (!code) return toast('친구 코드 8자리를 확인해 주세요.');
    void run(
      () => requestFriend({ code }),
      (d) => {
        toast(friendRequestText(d));
        codeInput = '';
        if (fromInvite) {
          clearInvite();
          invite = null;
        }
      },
    );
  }

  function dropInvite() {
    clearInvite();
    invite = null;
  }

  const accept = (p: FriendPerson) =>
    run(() => acceptFriend(p.code), () => toast(friendAcceptedText(p.name)));
  const remove = (p: FriendPerson, ask: string | null) => {
    if (ask && !confirm(ask)) return;
    void run(() => removeFriend(p.code));
  };

  async function play(p: FriendPerson) {
    if (busy) return;
    busy = true;
    const r = await playFriendly(p.code);
    busy = false;
    if (!r.ok) {
      if (r.error.reason === 'FRIENDLY_DAILY_LIMIT' && data) data.matchesLeft = 0;
      return toast(r.error.message);
    }
    onplayed(r.data.match, r.data.matchesLeft);
  }

  async function share() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: friendInviteText(data.code, window.location.origin) });
      } catch (e) {
        // 공유 시트를 닫은 것(AbortError)은 실패가 아니다.
        if ((e as Error)?.name !== 'AbortError') toast('공유하지 못했어요');
      }
      return;
    }
    const copied = await copyText(friendInviteUrl(data.code, window.location.origin));
    toast(copied ? '초대 링크를 복사했어요' : '공유하지 못했어요');
  }
  async function copyCode() {
    if (!data) return;
    toast((await copyText(friendCodeLabel(data.code))) ? '코드를 복사했어요' : '코드를 복사하지 못했어요');
  }

  const canChallenge = (p: FriendPerson) =>
    !!data && data.canPlay && data.matchesLeft > 0 && !!p.team && p.team.filled > 0;
  const teamLine = (p: FriendPerson) => (p.team ? `${p.team.name} · OVR ${p.team.ovr}` : '이번 시즌 팀이 없어요');
</script>

<section class="card stack" style="gap:12px" data-friends>
  <div>
    <div class="eyebrow">Friends</div>
    <h1>친구</h1>
    {#if data}
      <p class="muted fs-sm">친선전은 레이팅과 전적에 들어가지 않아요. 오늘 남은 친선전 {data.matchesLeft}/{data.matchesPerDay}</p>
      {#if !data.canPlay}<p class="muted fs-sm" data-friends-hint>이번 시즌 팀을 만들면 친구와 친선전을 할 수 있어요.</p>{/if}
    {/if}
  </div>
  <LoadState {status} failText="친구 목록을 불러오지 못했어요." retry={() => void load()}>
    {#if data}
      {#if invite}
        <div class="fr-invite" role="status" data-friend-invite>
          <p>초대 링크로 들어왔어요. 코드 <b>{friendCodeLabel(invite)}</b> 구단주에게 친구 신청할까요?</p>
          <div class="fr-row-actions">
            <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => sendCode(invite!, true)} data-act="friend-invite-send">신청</button>
            <button class="btn btn-sm" onclick={dropInvite}>닫기</button>
          </div>
        </div>
      {/if}

      <div class="fr-code">
        <span class="muted fs-sm">내 친구 코드</span>
        <b class="fr-code-value" data-friend-code>{friendCodeLabel(data.code)}</b>
        <div class="fr-row-actions">
          <button class="btn btn-sm" onclick={share} data-act="friend-share">초대 링크 공유</button>
          <button class="btn btn-sm" onclick={copyCode}>코드 복사</button>
        </div>
      </div>

      <form class="fr-add" onsubmit={(e) => { e.preventDefault(); sendCode(codeInput); }}>
        <label class="fr-add-label" for="friend-code-input">친구 코드로 신청</label>
        <div class="fr-add-row">
          <input id="friend-code-input" type="text" enterkeyhint="send" bind:value={codeInput} placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" data-friend-code-input />
          <button class="btn btn-primary" type="submit" disabled={busy || !codeInput.trim()} data-act="friend-request">신청</button>
        </div>
      </form>

      {#if data.received.length}
        <h2 class="fr-h">받은 신청 {data.received.length}</h2>
        {#each data.received as p (p.code)}
          <div class="fr-person" data-friend-received={p.code}>
            <div class="fr-info"><b>{p.name}</b><span class="muted fs-sm">{teamLine(p)}</span></div>
            <div class="fr-row-actions">
              <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => void accept(p)} data-act="friend-accept">수락</button>
              <button class="btn btn-sm" disabled={busy} onclick={() => remove(p, null)}>거절</button>
            </div>
          </div>
        {/each}
      {/if}

      <h2 class="fr-h">친구 {data.friends.length}/{data.max}</h2>
      {#each data.friends as p (p.code)}
        {@const h2h = h2hText(p.h2h)}
        <div class="fr-person" data-friend={p.code}>
          <TeamLogo logo={p.team?.logo ?? null} name={p.team?.name ?? p.name} size={32} decorative />
          <div class="fr-info">
            <b>{p.name}</b>
            <span class="muted fs-sm">{teamLine(p)}</span>
            {#if h2h}<span class="fs-sm">상대 전적 {h2h}</span>{/if}
          </div>
          <div class="fr-row-actions">
            <button class="btn btn-primary btn-sm" disabled={busy || !canChallenge(p)} onclick={() => void play(p)} data-act="friend-play">친선전</button>
            <button class="icon-btn fs-sm" disabled={busy} onclick={() => remove(p, `${p.name} 님과 친구를 끊을까요? 상대 전적도 사라져요.`)} data-act="friend-remove">끊기</button>
          </div>
        </div>
      {:else}
        <p class="muted">아직 친구가 없어요. 신청을 수락하면 여기에 보여요.</p>
      {/each}

      {#if data.sent.length}
        <h2 class="fr-h">보낸 신청</h2>
        {#each data.sent as p (p.code)}
          <div class="fr-person" data-friend-sent={p.code}>
            <div class="fr-info"><b>{p.name}</b><span class="muted fs-sm">{teamLine(p)}</span></div>
            <button class="btn btn-sm" disabled={busy} onclick={() => remove(p, null)}>취소</button>
          </div>
        {/each}
      {/if}

      {#if data.recent.length}
        <h2 class="fr-h">최근 친선전</h2>
        {#each data.recent as m (m.id)}
          <TeamMatchRow {m} onopen={(x) => onopen(x, data!.matchesLeft)} />
        {/each}
      {/if}
    {/if}
  </LoadState>
</section>

<style>
  .fr-h {
    margin: 6px 0 0;
    font-size: 0.9375rem;
  }
  .fr-invite {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1.5px solid var(--accent-text);
    border-radius: 12px;
  }
  .fr-invite p {
    margin: 0;
    font-size: 0.875rem;
  }
  .fr-code {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fr-code-value {
    font-family: var(--display);
    font-size: 1.5rem;
    letter-spacing: 0.06em;
  }
  .fr-add {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fr-add-label {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .fr-add-row {
    display: flex;
    gap: 8px;
  }
  .fr-add-row input {
    flex: 1;
    min-width: 0;
    text-transform: uppercase;
  }
  .fr-row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: none;
  }
  .fr-person {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .fr-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
