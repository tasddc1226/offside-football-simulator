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
    canFriendly,
    canPreseasonFriendly,
    founderLabel,
    friendAcceptedText,
    friendCodeLabel,
    friendInviteText,
    friendInviteUrl,
    friendRequestToast,
    inviteEventLines,
    h2hText,
    preseasonFriendlyHint,
    preseasonTeamLine,
  } from '@offside/app-core/friendText';
  import { friendText as L } from '@offside/app-core/i18n/ko/friend';
  import { toast } from '../helpers.js';
  import { copyText } from '../inapp-open.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import { clearInvite, pendingInvite } from '../friendInvite.svelte.js';
  import { appState } from '../state.svelte.js';
  import TeamLogo from './TeamLogo.svelte';
  import TeamMatchRow from './TeamMatchRow.svelte';

  let {
    onplayed,
    onopen,
    onpreseason,
  }: {
    /** 친선전을 치렀다 — 결과(중계)를 연다. */
    onplayed: (m: TeamMatch, matchesLeft: number) => void;
    /** 최근 친선전 한 경기를 연다. */
    onopen: (m: TeamMatch, matchesLeft: number) => void;
    /** T-11-113 프리시즌 팀 화면으로 간다(프리시즌 팀이 없을 때). */
    onpreseason: () => void;
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
    // T-11-142 받은 신청 수(하단 메뉴 점)를 목록과 맞춘다 — 수락·거절 뒤 다시 받을 때도.
    appState.friendReq = r.data.received.length;
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
    if (!code) return toast(L.codeInvalid);
    void run(
      () => requestFriend({ code }),
      (d) => {
        toast(friendRequestToast(d));
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

  /** 친선전 한 판. preseason이면 프리시즌 팀끼리(T-11-113). */
  async function play(p: FriendPerson, preseason = false) {
    if (busy) return;
    busy = true;
    const r = await playFriendly(p.code, preseason);
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
        if ((e as Error)?.name !== 'AbortError') toast(L.shareFail);
      }
      return;
    }
    const copied = await copyText(friendInviteUrl(data.code, window.location.origin));
    toast(copied ? L.linkCopied : L.shareFail);
  }
  async function copyCode() {
    if (!data) return;
    toast((await copyText(friendCodeLabel(data.code))) ? L.codeCopied : L.codeCopyFail);
  }

  const teamLine = (p: FriendPerson) => (p.team ? `${p.team.name} · OVR ${p.team.ovr}` : L.noTeamLine);
</script>

<section class="card stack" style="gap:12px" data-friends>
  <div>
    <div class="eyebrow">Friends</div>
    <h1>{L.title}</h1>
    {#if data}
      <p class="muted fs-sm">{L.info({ left: data.matchesLeft, per: data.matchesPerDay })}</p>
      {#if !data.canPlay}<p class="muted fs-sm" data-friends-hint>{L.needTeam}</p>{/if}
      {#if data.canPlayPreseason === false}
        <div class="fr-legacy" data-friends-preseason-hint>
          <p class="muted fs-sm">{preseasonFriendlyHint()}</p>
          <button class="btn btn-sm" onclick={onpreseason} data-act="friend-preseason-team">{L.makePreseason}</button>
        </div>
      {/if}
    {/if}
  </div>
  <LoadState {status} failText={L.loadFailWeb} retry={() => void load()}>
    {#if data}
      {#if invite}
        <div class="fr-invite" role="status" data-friend-invite>
          <p>{L.inviteBefore}<b>{friendCodeLabel(invite)}</b>{L.inviteAfter}</p>
          <div class="fr-row-actions">
            <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => sendCode(invite!, true)} data-act="friend-invite-send">{L.send}</button>
            <button class="btn btn-sm" onclick={dropInvite}>{L.close}</button>
          </div>
        </div>
      {/if}

      <!-- T-11-175 이벤트 카드를 맨 위에: 홈 타일 · 초대 알림으로 들어오면 바로 보이게. -->
      {#if data.invite}
        {@const ev = inviteEventLines(data.invite)}
        <div class="fr-event" data-invite-event>
          <b>{ev.title}</b>
          <p class="fs-sm">{ev.body}</p>
          {#if ev.mine}<p class="fs-sm" data-invite-mine>{ev.mine}</p>{/if}
          {#if ev.status}<p class="muted fs-sm" data-invite-status>{ev.status}</p>{/if}
          {#if ev.maxed}<p class="muted fs-sm">{ev.maxed}</p>{/if}
        </div>
      {/if}

      <div class="fr-code">
        <span class="muted fs-sm">{L.myCode}</span>
        <b class="fr-code-value" data-friend-code>{friendCodeLabel(data.code)}</b>
        <div class="fr-row-actions">
          <button class="btn btn-sm" onclick={share} data-act="friend-share">{L.shareLink}</button>
          <button class="btn btn-sm" onclick={copyCode}>{L.copyCode}</button>
        </div>
      </div>

      <form class="fr-add" onsubmit={(e) => { e.preventDefault(); sendCode(codeInput); }}>
        <label class="fr-add-label" for="friend-code-input">{L.addByCode}</label>
        <div class="fr-add-row">
          <input id="friend-code-input" type="text" enterkeyhint="send" bind:value={codeInput} placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" data-friend-code-input />
          <button class="btn btn-primary" type="submit" disabled={busy || !codeInput.trim()} data-act="friend-request">{L.send}</button>
        </div>
      </form>

      {#if data.received.length}
        <h2 class="fr-h">{L.receivedTitle({ n: data.received.length })}</h2>
        {#each data.received as p (p.code)}
          <div class="fr-person" data-friend-received={p.code}>
            <div class="fr-info"><b>{p.name}</b><span class="muted fs-sm">{teamLine(p)}</span></div>
            <div class="fr-row-actions">
              <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => void accept(p)} data-act="friend-accept">{L.accept}</button>
              <button class="btn btn-sm" disabled={busy} onclick={() => remove(p, null)}>{L.reject}</button>
            </div>
          </div>
        {/each}
      {/if}

      <h2 class="fr-h">{L.friendsTitle({ n: data.friends.length, max: data.max })}</h2>
      {#each data.friends as p (p.code)}
        {@const h2h = h2hText(p.h2h)}
        {@const preseasonLine = preseasonTeamLine(p)}
        <div class="fr-person" data-friend={p.code}>
          <TeamLogo logo={p.team?.logo ?? null} name={p.team?.name ?? p.name} size={32} decorative />
          <div class="fr-info">
            <b>{p.name}{#if p.founder}<span class="pill good fr-founder" data-friend-founder>{founderLabel()}</span>{/if}</b>
            <span class="muted fs-sm">{teamLine(p)}</span>
            {#if preseasonLine}<span class="muted fs-sm" data-friend-preseason>{preseasonLine}</span>{/if}
            {#if h2h}<span class="fs-sm">{L.h2hLine({ record: h2h })}</span>{/if}
          </div>
          <div class="fr-row-actions">
            <button class="btn btn-primary btn-sm" disabled={busy || !canFriendly(data, p)} onclick={() => void play(p)} data-act="friend-play">{L.play}</button>
            {#if p.preseasonTeam}<button class="btn btn-sm" disabled={busy || !canPreseasonFriendly(data, p)} onclick={() => void play(p, true)} data-act="friend-play-preseason">{L.playPreseason}</button>{/if}
            <button class="icon-btn fs-sm" disabled={busy} onclick={() => remove(p, L.removeConfirm({ name: p.name }))} data-act="friend-remove">{L.remove}</button>
          </div>
        </div>
      {:else}
        <p class="muted">{L.noFriends}</p>
      {/each}

      {#if data.sent.length}
        <h2 class="fr-h">{L.sentTitle}</h2>
        {#each data.sent as p (p.code)}
          <div class="fr-person" data-friend-sent={p.code}>
            <div class="fr-info"><b>{p.name}</b><span class="muted fs-sm">{teamLine(p)}</span></div>
            <button class="btn btn-sm" disabled={busy} onclick={() => remove(p, null)}>{L.cancel}</button>
          </div>
        {/each}
      {/if}

      {#if data.recent.length}
        <h2 class="fr-h">{L.recentTitle}</h2>
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
  .fr-event {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .fr-event p {
    margin: 0;
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
  .fr-legacy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .fr-legacy p {
    margin: 0;
    flex: 1 1 200px;
  }
  .fr-founder {
    margin-left: 6px;
    vertical-align: middle;
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
