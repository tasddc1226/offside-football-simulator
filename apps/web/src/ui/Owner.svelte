<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  import ManagerResume from './ManagerResume.svelte';
  import LoginButtons from './LoginButtons.svelte';
  // My club keeps owner identity and shared operations outside the season team card.
  // Team slots can expand later without duplicating the owner profile, finances or honors.
  import Topbar from './Topbar.svelte';
  import OwnerAvatar from './OwnerAvatar.svelte';
  import AdSlot from '../ads/AdSlot.svelte';
  import { fetchOwnerSummary } from '@offside/app-core/api/ownerSummary';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { fetchMarketFunds, type MarketFundsResponse } from '@offside/app-core/api/market';
  import { fundsText } from '@offside/app-core/market';
  import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
  import { ownerLockedText, ownerTeamCard, ownerTeamEmptyText, type OwnerSummary, type OwnerTeamCard } from '@offside/app-core/ownerHub';
  import { num, recordText } from '@offside/app-core/teamText';
  import { fmtValue } from '@offside/app-core/format';
  import { appState, type TeamView } from './state.svelte.js';
  import { onMount } from 'svelte';
  import { accountCache, ensureAccount } from './account-state.svelte.js';
  import { isMember } from '@offside/app-core/account';
  import ClubValueInfo from './owner/ClubValueInfo.svelte';
  import OwnerProfileEditor from './owner/OwnerProfileEditor.svelte';
  import { loadMyPlayerSummary } from '@offside/app-core/myPlayers';
  import { ownerPlayersText as P } from '@offside/app-core/i18n/ko/ownerPlayers';
  import TeamLogo from './team/TeamLogo.svelte';
  import { loadHOF } from '@offside/game/hof-store';
  import { go } from './nav.js';
  import { openFriends } from './friendInvite.svelte.js';
  import { myTeamTarget, ownerDotLabel } from '@offside/app-core/ownerDots';
  import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
  import { exchangeText as XC } from '@offside/app-core/i18n/ko/exchange';
  import { seasonPassText as SP } from '@offside/app-core/i18n/ko/seasonPass';
  import { passEntryOpen } from '@offside/contracts/season-pass';
  import { membershipText as MB } from '@offside/app-core/i18n/ko/membership';
  import { MEMBERSHIP_LIVE } from '@offside/contracts/membership';
  import { syncMember } from '../ads/ads';
  import type { Component } from 'svelte';
  import { type OwnerTierTag } from '@offside/contracts';
  import { shapeOf, usesRankLadder } from '@offside/contracts/owner-team';
  import { tierTitle } from '@offside/app-core/ownerTier';
  import GradeEmblem from './team/GradeEmblem.svelte';
  import { ownerProfileText as H } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from './cup/TitleBadge.svelte';
  import { webPay } from './cup/webPay.svelte.js';

  // T-10-016: 운영자면 프로필 편집에 운영 도구 표시를 넘긴다(운영 도구 입구는 T-11-567부터 설정 화면의 계정 카드).
  // 관리자는 구글 연결 계정이라, 연결된 계정일 때만 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다).
  let admin = $state(false);
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
  });
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const localCount = loadHOF().length;
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = $derived.by(() => {
    const acct = accountCache.value;
    return acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  });
  const nickname = $derived.by(() => {
    const acct = accountCache.value;
    return acct && acct !== 'error' ? acct.nickname : null;
  });
  let tierTag = $state<OwnerTierTag | null>(null);
  $effect(() => {
    let alive = true;
    admin = false;
    tierTag = null;
    if (linked) void fetchOwnerSummary().then((r) => {
      if (alive && r.ok) { admin = r.data.admin; tierTag = r.data.tier; }
    });
    return () => { alive = false; };
  });

  // 비로그인 구단 가치는 이 기기 기록의 카드 기준가 합(T-11-567 명예관 미리보기를 빼서 로그인하면 묻지 않는다).
  let summary = $state<OwnerSummary | null>(null);
  $effect(() => {
    if (!guest) return;
    let alive = true;
    void loadMyPlayerSummary(false).then(value => { if (alive) summary = value; });
    return () => { alive = false; };
  });

  // 내 팀 카드 — 팀 화면과 같은 응답(1분 메모)이라 팀 화면에 들어가도 다시 묻지 않는다.
  let card = $state<OwnerTeamCard | null>(null);
  let cardFailed = $state(false);
  $effect(() => {
    if (!linked) return;
    void fetchOwnerTeam().then((r) => {
      if (r.ok) {
        card = ownerTeamCard(r.data);
        syncMember(card.member);
      }
      else cardFailed = true;
    });
  });
  // T-11-080 구단 자금 · 구단 가치(자금 + 가진 카드의 기준가, T-11-109)는 서버가 센다. 이적시장 화면과 같은 응답(1분
  // 메모)이라 이적시장에 들어가도 다시 묻지 않는다. 비로그인이면 이 기기 기록의 카드 기준가 합을 쓴다.
  let market = $state<MarketFundsResponse | null>(null);
  $effect(() => {
    if (!linked) return;
    void fetchMarketFunds().then((r) => {
      if (r.ok) market = r.data;
    });
  });
  const clubValue = $derived(linked ? (market?.clubValue ?? null) : (summary?.value ?? null));
  const funds = $derived(market ? fundsText(market.balance) : '–');
  /** 받은 친구 신청(T-11-142)이나 아직 안 본 새 업적이 있으면 '내 팀' 버튼에 빨간 점, 누르면 바로 친구 · 업적 탭으로. */
  const teamDot = $derived(ownerDotLabel({ friendReq: appState.friendReq, achNew: appState.achNew }));
  function openMyTeam() {
    const to = myTeamTarget(appState);
    if (to === 'friends') openFriends();
    else openTeam(to);
  }
  // T-11-374 카드 과제 창은 열 때만 불러온다(과제 · 고르기 화면이 구단주 화면 청크에 붙지 않게).
  let Exchange = $state<Component<{ onclose: () => void }> | null>(null);
  let exchangeOpen = $state(false);
  function openExchange() {
    exchangeOpen = true;
    if (!Exchange) void import('./owner/CardExchange.svelte').then((m) => (Exchange = m.default));
  }
  // T-11-511 시즌 패스 창도 열 때만 불러온다.
  let Pass = $state<Component<{ onclose: () => void }> | null>(null);
  let passOpen = $state(false);
  function openPass() {
    passOpen = true;
    if (!Pass) void import('./owner/SeasonPass.svelte').then((m) => (Pass = m.default));
  }
  // T-11-512 클럽 멤버십 창도 열 때만 불러온다.
  let Member = $state<Component<{ onclose: () => void }> | null>(null);
  let memberOpen = $state(false);
  function openMember() {
    memberOpen = true;
    if (!Member) void import('./owner/Membership.svelte').then((m) => (Member = m.default));
  }
  // T-11-591 웹 결제창에서 돌아오면 결제를 시작한 시즌 패스 · 멤버십 창을 다시 연다.
  if (webPay.reopen === 'pass') openPass();
  else if (webPay.reopen === 'member') openMember();
  webPay.reopen = null;
  const passEntry = passEntryOpen(new Date().toISOString()) || import.meta.env.DEV;
  const memberEntry = MEMBERSHIP_LIVE || import.meta.env.DEV;
  function openTeam(v: TeamView = 'team') {
    appState.teamView = v;
    go('team');
  }
  // T-11-567 계정 카드가 설정으로 옮겨 가서, 로그인 여부는 이 화면이 직접 확인한다(5분 메모).
  onMount(ensureAccount);
</script>

{#snippet achDot()}
  {#if teamDot}<span class="btn-dot" data-team-dot><span class="sr-only">{teamDot}</span></span>{/if}
{/snippet}

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <h1>{L.hubTitle}</h1>
  </header>

  {#if linked || guest}
    <!-- T-11-567 구단 가치 · 자금은 따로 카드를 두지 않고 프로필 카드 아래 줄에 둔다. -->
    <section class="card owner-hub" data-owner-summary aria-label={L.summaryLabel}>
      <div class="owner-id">
        <OwnerAvatar avatarId={accountCache.value && accountCache.value !== 'error' ? accountCache.value.avatarId : null} name={nickname ?? L.avatarInitial} size={48} />
        <div class="owner-who">
          <b>{#if tierTag}<span class="owner-last-tier" title={tierTitle(tierTag)} data-owner-crest={tierTag.tier}><GradeEmblem id={tierTag.tier} size={24} /></span>{/if}{guest ? L.guestName : (nickname ?? L.title)}{#if card?.title}<span class="owner-founder"><TitleBadge title={card.title} size="sm" /></span>{/if}{#if card?.member}<span class="pill good owner-founder" title={MB.badgeLabel} data-owner-member>{MB.badge}</span>{/if}</b>
          <span class="muted fs-sm">{guest ? L.guestSub : L.title}</span>
        </div>
        {#if linked && accountCache.value && accountCache.value !== 'error'}<OwnerProfileEditor profile={accountCache.value} {admin} />{/if}
      </div>
      <dl class="owner-stats" data-club-operations aria-label={L.operationsHeading}>
        <div class="owner-value" data-owner-value><dt>{L.statClubValue}</dt><ClubValueInfo {linked} /><dd>{clubValue !== null ? fmtValue(clubValue) : '–'}</dd></div>
        {#if linked}<div class="owner-funds" data-owner-funds><dt>{L.statFunds}<span class="owner-funds-go" aria-hidden="true">›</span></dt><dd>{funds}</dd><button class="tap-cover" data-act="funds-history" aria-label={F.openAria} onclick={() => go('funds')}></button></div>{/if}
      </dl>
    </section>
    <AdSlot place="owner-summary" />
  {/if}

  <!-- T-11-338 진행 중인 감독 커리어가 있으면 맨 위에서 이어 한다. -->
  {#if linked}<ManagerResume />{/if}
  {#if linked || guest}<h2 class="hub-section-title">{L.teamsHeading}</h2>{/if}
  <!-- T-10-092 내 팀: 구글로 로그인한 구단주만 — 확인 중·연결 실패면 그리지 않는다. 비로그인이면 잠긴 카드. -->
  {#if linked}
    <section class="card owner-team" aria-label={L.myTeam} data-owner-team>
      <div class="owner-team-head">
        {#if card?.team}<TeamLogo logo={card.team.logo} name={card.team.name} size={44} decorative />{/if}
        <div class="owner-who">
          <small class="eyebrow">{L.myTeam}{card?.season ? ` · ${card.season}` : ''}</small>
          <h2>{card?.team?.name ?? L.myTeam}</h2>
          {#if card?.team}<span class="muted fs-sm">{L.manager({ manager: card.team.manager, formation: shapeOf(card.team.formation, card.team.layout) })}</span>{/if}
        </div>
        {#if card?.team}
          <div class="owner-ovr" aria-label={L.teamOvr({ ovr: card.team.ovr })}><small>OVR</small><b>{card.team.ovr}</b></div>
        {/if}
      </div>
      {#if card?.team}
        <dl class="owner-stats owner-team-stats" data-owner-team-record>
          <div><dt>{L.statRecord}</dt><dd>{recordText(card.team.record)}</dd></div>
          <div><dt>{usesRankLadder(card.team.season) ? L.statRp : L.statRating}</dt><dd>{num(card.team.rating)}</dd></div>
          <div><dt>{L.statToday}</dt><dd>{card.left}/{card.perDay}</dd></div>
        </dl>
        <div class="owner-actions">
          <button class="btn" data-act="team" onclick={openMyTeam}>{L.manageTeam}{@render achDot()}</button>
          <button class="btn btn-accent" data-act="owner-play" disabled={!!card.playHint} onclick={() => openTeam('opponents')}>{L.play}</button>
        </div>
        {#if card.playHint}<p class="muted fs-sm">{card.playHint}</p>{/if}
      {:else}
        {#if card || cardFailed}
          <p class="muted fs-sm">{card ? ownerTeamEmptyText(card) : L.teamFailed}</p>
        {:else}
          <Skeleton rows={2} />
        {/if}
        <button class="btn {card && card.players > 0 ? 'btn-primary' : ''} btn-block" data-act="team" onclick={openMyTeam}>
          {card && card.players > 0 ? L.buildTeam : L.myTeam}{@render achDot()}
        </button>
      {/if}
    </section>
  {:else if guest}
    <section class="card owner-team" aria-label={L.myTeam} data-owner-team-locked>

      <h2>{L.myTeam}</h2>
      <div class="owner-lock" aria-hidden="true">
        {#each [1, 4, 3, 3] as n, r (r)}
          <span class="owner-lock-row">{#each { length: n } as _, i (i)}<i></i>{/each}</span>
        {/each}
        <span class="owner-lock-badge">{L.lockBadge}</span>
      </div>
      <p class="muted fs-sm">{ownerLockedText(localCount)}</p>
      <!-- 로그아웃·탈퇴 직후엔 세션 쿠키가 없으므로 링크로 바로 가지 않고 startGoogleLogin이 새 익명 세션부터 받는다. -->
      <LoginButtons back={null} />
    </section>
  {/if}

  <!-- T-11-567 바로가기: 한 줄 카드 여섯 장을 2열 칸으로 줄였다. 상점 넷은 상점 화면으로 옮겼다. -->
  {#if linked || !guest || localCount > 0}
    <nav class="owner-tiles" aria-label={L.shortcutsHeading} data-owner-tiles>
      {#if !guest || localCount > 0}
        <button class="owner-tile" data-act="open-owner-players" data-owner-players-entry aria-label={P.openPlayers} onclick={() => { appState.playersView = linked ? 'manage' : 'records'; go('players'); }}>
          <b>{P.title}</b><span>{L.tilePlayers}</span>
        </button>
      {/if}
      {#if linked}
        <button class="owner-tile" data-act="market" data-owner-market aria-label={`${L.marketTitle} ${L.open}`} onclick={() => go('market')}>
          <b>{L.marketTitle}</b><span>{L.tileMarket}</span>
        </button>
        <button class="owner-tile" data-act="exchange" data-owner-exchange aria-label={XC.entryAria} onclick={openExchange}>
          <b>{XC.entryTitle}<span class="pill good">{XC.entryNew}</span></b><span>{L.tileExchange}</span>
        </button>
        <button class="owner-tile" data-act="manager" data-owner-manager aria-label={MG.entryAria} onclick={() => go('manager')}>
          <b>{MG.entryTitle}<span class="pill good" data-owner-manager-new>{MG.entryNew}</span></b><span>{L.tileManager}</span>
        </button>
        <button class="owner-tile" data-act="open-owner-hall" data-owner-hall-entry aria-label={`${H.openHall} · ${H.hallNew}`} onclick={() => go('honors')}>
          <b>{H.hallTitle}<span class="pill good" data-owner-hall-new>{H.hallNew}</span></b><span>{L.tileHall}</span>
        </button>
        <button class="owner-tile" data-act="shop" data-owner-shop aria-label={L.shopTitle} onclick={() => go('shop')}>
          <b>{L.shopTitle}</b><span>{L.tileShop}</span>
        </button>
      {/if}
    </nav>
  {/if}
  {#if exchangeOpen && Exchange}<Exchange onclose={() => (exchangeOpen = false)} />{/if}

  {#if linked && (passEntry || memberEntry)}
    <!-- T-11-567 시즌 패스 · 클럽 멤버십은 한 카드에 두 줄로. -->
    <section class="card owner-perks" aria-label={`${SP.entry} · ${MB.entry}`} data-owner-perks>
      {#if passEntry}
        <button class="owner-perk" data-act="season-pass" data-owner-pass aria-label={SP.entry} onclick={openPass}>
          <span class="owner-who"><b>{SP.entry}</b><span class="muted fs-sm">{SP.entryNew}</span></span>
          <i aria-hidden="true">›</i>
        </button>
      {/if}
      {#if memberEntry}
        <button class="owner-perk" data-act="membership" data-owner-membership aria-label={MB.entry} onclick={openMember}>
          <span class="owner-who"><b>{MB.entry}{#if card?.member}<span class="pill good owner-founder">{MB.entryActive}</span>{/if}</b><span class="muted fs-sm">{MB.entrySub}</span></span>
          <i aria-hidden="true">›</i>
        </button>
      {/if}
    </section>
  {/if}
  {#if passOpen && Pass}<Pass onclose={() => (passOpen = false)} />{/if}
  {#if memberOpen && Member}<Member onclose={() => (memberOpen = false)} />{/if}
</div>

<style>
  .hub-section-title {margin:8px 2px 0;font-size:var(--fs-body);}
    .owner-founder {margin-left:6px;vertical-align:middle;}
  .owner-hub {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .owner-id {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .owner-id > .owner-who { flex: 1; }
  /* 이름 앞 지난 시즌 등급 엠블럼(LoL 이름 앞 지난 시즌 티어처럼). */
  .owner-last-tier {
    display: inline-flex;
    vertical-align: -5px;
    margin-right: 4px;
  }
  .owner-who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .owner-who b {
    font-size: var(--fs-title3);
    overflow-wrap: anywhere;
  }
  .owner-who h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }
  /* 6칸 격자 — 아래 숫자 셋은 2칸씩, 구단 가치는 한 줄 전체(자금이 있으면 3칸씩 나란히). */
  .owner-stats {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .owner-stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    min-width: 0;
    grid-column: span 2;
  }
  .owner-stats dt {
    font-size: var(--fs-caption);
    color: var(--muted);
  }
  .owner-stats dd {
    margin: 0;
    font-family: var(--display);
    font-size: var(--fs-title2);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .owner-stats .owner-value dt {padding-right:24px;}
  .owner-stats .owner-value {
    position:relative;
    grid-column: 1 / -1;
  }
  .owner-stats .owner-value:has(+ .owner-funds),
  .owner-stats .owner-funds {
    grid-column: span 3;
  }
  /* 구단 자금 칸 전체가 내역으로 가는 버튼(dl 안이라 칸 위에 .tap-cover 를 덮는다). */
  .owner-stats .owner-funds {
    position: relative;
  }
  .owner-funds-go {
    margin-left: 4px;
  }
  .owner-stats .owner-value dd {
    font-size: var(--fs-title1);
    color: var(--accent-text);
  }
  .owner-team-stats div {
    padding-inline: 6px;
  }
  .owner-team-stats dd {
    font-size: var(--fs-title3);
  }
  .owner-team {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .owner-team h2 {
    margin: 0;
  }
  .owner-team-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .owner-team-head .owner-who { flex: 1; min-width: 0; }
  .owner-ovr {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 58px;
    padding: 6px 8px;
    border-radius: var(--radius-md);
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .owner-ovr small {
    font-family: var(--display);
    font-size: var(--fs-caption2);
    letter-spacing: 0.12em;
  }
  .owner-ovr b {
    font-family: var(--display);
    font-size: var(--fs-title1);
    color: var(--pitch-accent);
  }
  .owner-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .owner-team p {
    margin: 0;
  }
  /* 잠긴 내 팀 — 흐린 그라운드에 11자리(4-3-3)만 찍고 가운데에 자물쇠 표시. */
  .owner-lock {
    position: relative;
    display: flex;
    flex-direction: column-reverse;
    justify-content: space-around;
    gap: 10px;
    padding: 14px 10px;
    border-radius: var(--radius-md);
    background: repeating-linear-gradient(0deg, var(--pitch) 0 22px, var(--pitch-2) 22px 44px);
    overflow: hidden;
  }
  .owner-lock-row {
    display: flex;
    justify-content: space-evenly;
    opacity: 0.45;
  }
  .owner-lock-row i {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px dashed var(--on-pitch);
  }
  .owner-lock-badge {
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--ink);
    font-size: var(--fs-label);
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.2);
  }
  /* T-11-567 바로가기 2열 칸. 좁은 화면에서도 두 칸, 글은 두 줄까지. */
  .owner-tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .owner-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    min-height: 76px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .owner-tile:hover { background: var(--surface-2); }
  .owner-tile b {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: var(--fs-body);
  }
  .owner-tile > span {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--muted);
    font-size: var(--fs-label);
  }
  .owner-tile .pill { font-size: var(--fs-caption2); }
  .owner-perks {
    display: flex;
    flex-direction: column;
    padding-block: 4px;
  }
  .owner-perk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .owner-perk + .owner-perk { border-top: 1px solid var(--line); }
  .owner-perk b { font-size: var(--fs-body); }
  .owner-perk i { color: var(--muted); font-style: normal; font-size: var(--fs-title2); }
</style>
