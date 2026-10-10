<script lang="ts">
  // 구단주 화면(T-10-058) — 게임 속 사용자 프로필. 환경설정에 있던 계정(구글 로그인·닉네임) 카드와
  // 운영 도구(관리자) 입구, 명예의 전당에 있던 '내 선수'를 이리로 옮겼다.
  // T-10-102 비로그인이면 계정 카드는 안내만, 구글 로그인 버튼은 카드 밖에 하나만 두고 로그인해야 쓰는 '내 팀'은 숨긴다.
  // 구단 이름·엠블럼 변경은 환경설정으로 옮겼다.
  // T-11-026 구단 허브 — 맨 위에 구단주 요약(은퇴 선수·레전드 점수·결번), 그 아래 '내 팀' 카드(전적·레이팅·오늘 남은
  // 경기와 바로 경기하기), 내 선수 상위 3명, 계정은 맨 아래. 비로그인이면 '내 팀' 자리에 잠긴 카드와 로그인 버튼을 둔다.
  import Topbar from './Topbar.svelte';
  import OwnerAvatar from './OwnerAvatar.svelte';
  import AdSlot from '../ads/AdSlot.svelte';
  import { fetchBoardViewer } from '@offside/app-core/api/boards';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { fetchMarketFunds, type MarketFundsResponse } from '@offside/app-core/api/market';
  import { fundsText } from '@offside/app-core/market';
  import { fundsHistoryText as F } from '@offside/app-core/i18n/ko/fundsHistory';
  import BoostShop from './cup/BoostShop.svelte';
  import RerollShop from './cup/RerollShop.svelte';
  import { ownerLockedText, ownerSummary, ownerTeamCard, ownerTeamEmptyText, type OwnerSummary, type OwnerTeamCard } from '@offside/app-core/ownerHub';
  import { num, recordText } from '@offside/app-core/teamText';
  import { fmtValue } from '@offside/app-core/format';
  import { founderLabel } from '@offside/app-core/friendText';
  import { appState, type TeamView } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import { isMember } from '@offside/app-core/account';
  import Account from './Account.svelte';
  import MyPlayers from './MyPlayers.svelte';
  import TeamLogo from './team/TeamLogo.svelte';
  import { loadHOF } from '@offside/game/hof-store';
  import { startGoogleLogin } from './login.js';
  import { go, takeFocus } from './nav.js';
  import { openFriends } from './friendInvite.svelte.js';
  import { myTeamTarget, ownerDotLabel } from '@offside/app-core/ownerDots';
  import { googleStartUrl } from '@offside/app-core/api/client';
  import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
  import { accountText as A } from '@offside/app-core/i18n/ko/account';
  import { fetchSeasonRecap, type SeasonRecapResponse } from '@offside/app-core/api/seasonRecap';
  import { recapCardView } from '@offside/app-core/seasonRecap';
  import { profileTier, tierTitle } from '@offside/app-core/ownerTier';
  import GradeEmblem from './team/GradeEmblem.svelte';
  import { ownerProfileText as H } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from './cup/TitleBadge.svelte';
  import { seasonRecapText as R } from '@offside/app-core/i18n/ko/seasonRecap';

  // T-11-152 후보 화면 '리롤권 상점 가기'로 들어왔으면 리롤권 상점을 펼친 채로 연다(한 번만 읽힌다).
  const shopFocus = takeFocus('rerollShop');
  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
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
  $effect(() => {
    if (linked) void fetchBoardViewer().then((r) => (admin = linked && r.ok && r.data.admin));
    else admin = false;
  });

  // 요약은 '내 선수'가 불러온 목록으로 센다(비로그인이면 이 기기 기록).
  let summary = $state<OwnerSummary | null>(null);

  // 내 팀 카드 — 팀 화면과 같은 응답(1분 메모)이라 팀 화면에 들어가도 다시 묻지 않는다.
  let card = $state<OwnerTeamCard | null>(null);
  let cardFailed = $state(false);
  $effect(() => {
    if (!linked) return;
    void fetchOwnerTeam().then((r) => {
      if (r.ok) card = ownerTeamCard(r.data);
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
  // T-11-128 시즌 결산 카드 — 끝난 시즌이 있으면 가장 최근 결산을 한 줄로 알린다. 불러오지 못하면 카드를 숨긴다.
  let recap = $state<SeasonRecapResponse | null>(null);
  $effect(() => {
    void fetchSeasonRecap().then((r) => {
      if (r.ok) recap = r.data;
    });
  });
  const recapCard = $derived(recap ? recapCardView(recap) : null);
  // 지난 시즌 등급(구단주 랭킹과 같은 업적 등급, 마감 업적 점수로) — 프로필 이름 앞에 붙인다(그 시즌 기록이 없으면 없다).
  // 댓글 · 채팅에도 같은 등급이 나간다(서버 ownerTiersOf).
  const tierTag = $derived(recap ? profileTier(recap) : null);
  /** 받은 친구 신청(T-11-142)이나 아직 안 본 새 업적이 있으면 '내 팀' 버튼에 빨간 점, 누르면 바로 친구 · 업적 탭으로. */
  const teamDot = $derived(ownerDotLabel({ friendReq: appState.friendReq, achNew: appState.achNew }));
  function openMyTeam() {
    const to = myTeamTarget(appState);
    if (to === 'friends') openFriends();
    else openTeam(to);
  }
  function openTeam(v: TeamView = 'team') {
    appState.teamView = v;
    go('team');
  }
</script>

{#snippet achDot()}
  {#if teamDot}<span class="btn-dot" data-team-dot><span class="sr-only">{teamDot}</span></span>{/if}
{/snippet}

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Owner</div>
    <h1>{L.title}</h1>
  </header>

  {#if linked || guest}
    <section class="card owner-hub" data-owner-summary aria-label={L.summaryLabel}>
      <div class="owner-id">
        <OwnerAvatar name={nickname ?? L.avatarInitial} size={48} />
        <div class="owner-who">
          <b>{#if tierTag}<span class="owner-last-tier" title={tierTitle(tierTag)} data-owner-crest={tierTag.tier}><GradeEmblem id={tierTag.tier} size={24} /></span>{/if}{guest ? L.guestName : (nickname ?? L.title)}{#if card?.founder}<span class="pill good owner-founder" data-owner-founder>{founderLabel()}</span>{/if}{#if card?.title}<span class="owner-founder"><TitleBadge title={card.title} size="sm" /></span>{/if}</b>
          {#if tierTag}<span class="ach-grade owner-tier" data-grade={tierTag.tier} data-owner-tier={tierTag.tier}>{tierTitle(tierTag)}</span>{/if}
          <span class="muted fs-sm">{guest ? L.guestSub : card?.team ? `${card.team.name} · ${card.season}` : L.signedInSubWeb}</span>
        </div>
      </div>
      {#if (guest && localCount === 0) || (summary?.players === 0 && !market?.clubValue)}
        <p class="muted fs-sm owner-empty">{L.emptySummary}</p>
        {#if linked}<p class="muted fs-sm owner-empty">{L.fundsLine({ funds })}</p>{/if}
      {:else}
      <dl class="owner-stats">
        <div class="owner-value" data-owner-value><dt>{L.statClubValue}</dt><dd>{clubValue !== null ? fmtValue(clubValue) : '–'}</dd></div>
        {#if linked}<div class="owner-funds" data-owner-funds><dt>{L.statFunds}<span class="owner-funds-go" aria-hidden="true">›</span></dt><dd>{funds}</dd><button class="tap-cover" data-act="funds-history" aria-label={F.openAria} onclick={() => go('funds')}></button></div>{/if}
        <div><dt>{L.statRetired}</dt><dd>{summary ? L.playersCount({ n: summary.players, text: num(summary.players) }) : '–'}</dd></div>
        <div><dt>{L.statLegend}</dt><dd>{summary ? num(summary.score) : '–'}</dd></div>
        <div><dt>{L.statRetiredNumbers}</dt><dd>{summary ? L.numbersCount({ n: summary.retired }) : '–'}</dd></div>
      </dl>
      {/if}
    </section>
    <AdSlot place="owner-summary" />
  {/if}

  <!-- T-11-128 시즌 결산: 끝난 시즌이 있을 때만. 비로그인도 본다(프로필 쿠키만 있으면 된다). -->
  {#if recap && recapCard}
    <section class="card owner-market" aria-label={R.cardTitle} data-owner-recap data-recap-status={recap.status}>
      <div class="owner-who">
        <small class="eyebrow">Season recap</small>
        <h2>{R.cardTitle}{#if recapCard.isNew}<span class="pill good owner-founder" data-recap-new>{R.newBadge}</span>{/if}</h2>
        <span class="muted fs-sm">{recapCard.line}</span>
        {#if recapCard.chips.length > 0}
          <span class="recap-chips">
            {#each recapCard.chips as c (c.kind)}<span class="pill recap-chip medal {c.medal}" data-recap-chip={c.kind}>{c.chip}</span>{/each}
          </span>
        {/if}
      </div>
      <button class="btn" data-act="recap" onclick={() => go('recap')}>{R.open}</button>
    </section>
  {/if}

  <!-- T-10-092 내 팀: 구글로 로그인한 구단주만 — 확인 중·연결 실패면 그리지 않는다. 비로그인이면 잠긴 카드. -->
  {#if linked}
    <section class="card owner-team" aria-label={L.myTeam} data-owner-team>
      <div class="owner-team-head">
        {#if card?.team}<TeamLogo logo={card.team.logo} name={card.team.name} size={44} decorative />{/if}
        <div class="owner-who">
          <small class="eyebrow">My team{card?.season ? ` · ${card.season}` : ''}</small>
          <h2>{card?.team?.name ?? L.myTeam}</h2>
          {#if card?.team}<span class="muted fs-sm">{L.manager({ manager: card.team.manager, formation: card.team.formation })}</span>{/if}
        </div>
        {#if card?.team}
          <div class="owner-ovr" aria-label={L.teamOvr({ ovr: card.team.ovr })}><small>OVR</small><b>{card.team.ovr}</b></div>
        {/if}
      </div>
      {#if card?.team}
        <dl class="owner-stats owner-team-stats" data-owner-team-record>
          <div><dt>{L.statRecord}</dt><dd>{recordText(card.team.record)}</dd></div>
          <div><dt>{L.statRating}</dt><dd>{num(card.team.rating)}</dd></div>
          <div><dt>{L.statToday}</dt><dd>{card.left}/{card.perDay}</dd></div>
        </dl>
        <div class="owner-actions">
          <button class="btn" data-act="team" onclick={openMyTeam}>{L.myTeam}{@render achDot()}</button>
          <button class="btn btn-accent" data-act="owner-play" disabled={!!card.playHint} onclick={() => openTeam('opponents')}>{L.play}</button>
        </div>
        {#if card.playHint}<p class="muted fs-sm">{card.playHint}</p>{/if}
      {:else}
        <p class="muted fs-sm">
          {card ? ownerTeamEmptyText(card) : cardFailed ? L.teamFailed : L.loading}
        </p>
        <button class="btn {card && card.players > 0 ? 'btn-primary' : ''} btn-block" data-act="team" onclick={openMyTeam}>
          {card && card.players > 0 ? L.buildTeam : L.myTeam}{@render achDot()}
        </button>
      {/if}
    </section>
    <section class="card stack" data-owner-hall-entry aria-label={H.hallTitle}>
      <h2>{H.hallTitle}</h2>
      <p class="muted fs-sm">{H.hallSummary}</p>
      <button class="btn btn-block" data-act="open-owner-hall" onclick={() => go('honors')}>{H.openHall}</button>
    </section>
    <section class="card owner-market owner-tap" aria-label={L.marketTitle} data-owner-market>
      <div class="owner-who">
        <small class="eyebrow">Transfer market</small>
        <h2>{L.marketTitle}</h2>
        <span class="muted fs-sm">{L.marketSub({ funds })}</span>
      </div>
      <span class="tap-go" aria-hidden="true">›</span>
      <button class="tap-cover" data-act="market" aria-label={`${L.marketTitle} ${L.open}`} onclick={() => go('market')}></button>
    </section>
    <!-- T-11-152 리롤권 상점: 펼칠 때만 상점을 묻는다. 사면 자금 줄을 다시 받는다(쓰기 성공으로 메모가 비워졌다). -->
    <RerollShop focus={shopFocus} onbought={(balance, spent) => market && (market = { balance, clubValue: market.clubValue - spent })} />
    <BoostShop />
  {:else if guest}
    <section class="card owner-team" aria-label={L.myTeam} data-owner-team-locked>
      <small class="eyebrow">My team</small>
      <h2>{L.myTeam}</h2>
      <div class="owner-lock" aria-hidden="true">
        {#each [1, 4, 3, 3] as n, r (r)}
          <span class="owner-lock-row">{#each { length: n } as _, i (i)}<i></i>{/each}</span>
        {/each}
        <span class="owner-lock-badge">{L.lockBadge}</span>
      </div>
      <p class="muted fs-sm">{ownerLockedText(localCount)}</p>
      <!-- 로그아웃·탈퇴 직후엔 세션 쿠키가 없으므로 링크로 바로 가지 않고 startGoogleLogin이 새 익명 세션부터 받는다. -->
      <a class="btn btn-primary btn-block" data-act="google-login" href={googleStartUrl()} onclick={(e) => { e.preventDefault(); void startGoogleLogin(null); }}>{A.loginGoogle}</a>
    </section>
  {/if}

  {#if !guest || localCount > 0}<MyPlayers onrows={(rows) => (summary = ownerSummary(rows))} />{/if}

  <section class="card settings-card" id="account-slot" aria-label={L.accountSection}>
    <Account {admin} />
    {#if admin}
      <button class="settings-row settings-trigger owner-admin" data-act="admin" onclick={() => (appState.screen = 'admin')}>
        <span class="settings-label"><strong>{L.adminTools}</strong></span>
        <i class="settings-chev" aria-hidden="true">›</i>
      </button>
    {/if}
  </section>
</div>

<style>
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
  /* 이름 앞 지난 시즌 등급 엠블럼(LoL 이름 앞 지난 시즌 티어처럼). */
  .owner-last-tier {
    display: inline-flex;
    vertical-align: -5px;
    margin-right: 4px;
  }
  .owner-tier {
    font-family: var(--display);
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .owner-who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .owner-who b {
    font-size: 1.125rem;
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
    border-radius: 12px;
    background: var(--surface-2);
    min-width: 0;
    grid-column: span 2;
  }
  .owner-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .owner-stats dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .owner-stats .owner-value {
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
    font-size: 1.75rem;
    color: var(--accent-text);
  }
  .owner-empty {
    margin: 0;
  }
  .owner-team-stats dd {
    font-size: 1.0625rem;
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
    border-radius: 12px;
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .owner-ovr small {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
  }
  .owner-ovr b {
    font-family: var(--display);
    font-size: 1.625rem;
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
    border-radius: 14px;
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
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink);
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.2);
  }
  .owner-market {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .owner-market h2 {
    margin: 0;
  }
  .owner-tap {
    position: relative;
  }
  .owner-admin {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
</style>
