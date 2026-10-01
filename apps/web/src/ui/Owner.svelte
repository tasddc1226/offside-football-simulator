<script lang="ts">
  // 구단주 화면(T-10-058) — 게임 속 사용자 프로필. 환경설정에 있던 계정(구글 로그인·닉네임) 카드와
  // 운영 도구(관리자) 입구, 명예의 전당에 있던 '내 선수'를 이리로 옮겼다.
  // T-10-102 비로그인이면 계정 카드는 안내만, 구글 로그인 버튼은 카드 밖에 하나만 두고 로그인해야 쓰는 '내 팀'은 숨긴다.
  // 구단 이름·엠블럼 변경은 환경설정으로 옮겼다.
  // T-11-026 구단 허브 — 맨 위에 구단주 요약(은퇴 선수·레전드 점수·결번), 그 아래 '내 팀' 카드(전적·레이팅·오늘 남은
  // 경기와 바로 경기하기), 내 선수 상위 3명, 계정은 맨 아래. 비로그인이면 '내 팀' 자리에 잠긴 카드와 로그인 버튼을 둔다.
  import Topbar from './Topbar.svelte';
  import { fetchBoardViewer } from '@offside/app-core/api/boards';
  import { fetchOwnerTeam } from '@offside/app-core/api/team';
  import { ownerLockedText, ownerSummary, ownerTeamCard, ownerTeamEmptyText, type OwnerSummary, type OwnerTeamCard } from '@offside/app-core/ownerHub';
  import { num, recordText } from '@offside/app-core/teamText';
  import { appState, type TeamView } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import Account from './Account.svelte';
  import MyPlayers from './MyPlayers.svelte';
  import { loadHOF } from '@offside/game/season';
  import { startGoogleLogin } from './login.js';
  import { go } from './nav.js';
  import { googleStartUrl } from '@offside/app-core/api/client';

  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  let admin = $state(false);
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && acct.linked.google;
  });
  // T-10-103 비로그인으로 확인됐고 이 기기에 은퇴한 선수도 없으면 빈 '내 선수'를 숨긴다(확인 중·연결 실패면 그대로 둔다).
  const localCount = loadHOF().length;
  // 로그인 안 함(익명 프로필이거나 세션 없음). 확인 중·연결 실패는 아니다.
  const guest = $derived.by(() => {
    const acct = accountCache.value;
    return acct === null || (!!acct && acct !== 'error' && !acct.linked.google);
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
  function openTeam(v: TeamView = 'team') {
    appState.teamView = v;
    go('team');
  }
</script>

<div class="wrap">
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">Owner</div>
    <h1>구단주</h1>
  </header>

  {#if linked || guest}
    <section class="card owner-hub" data-owner-summary aria-label="구단주 요약">
      <div class="owner-id">
        <span class="owner-avatar" aria-hidden="true">{(nickname ?? '구').slice(0, 1)}</span>
        <div class="owner-who">
          <b>{guest ? '게스트 구단주' : (nickname ?? '구단주')}</b>
          <span class="muted fs-sm">{guest ? '기록은 이 기기에만 저장돼요' : card?.team ? `${card.team.name} · ${card.season}` : 'Google 계정으로 로그인했어요'}</span>
        </div>
      </div>
      {#if summary?.players === 0}
        <p class="muted fs-sm owner-empty">첫 커리어를 끝까지 뛰면 은퇴 선수와 레전드 점수가 여기에 쌓여요.</p>
      {:else}
      <dl class="owner-stats">
        <div><dt>은퇴 선수</dt><dd>{summary ? `${num(summary.players)}명` : '–'}</dd></div>
        <div><dt>레전드 점수</dt><dd>{summary ? num(summary.score) : '–'}</dd></div>
        <div><dt>영구결번</dt><dd>{summary ? `${summary.retired}개` : '–'}</dd></div>
      </dl>
      {/if}
    </section>
  {/if}

  <!-- T-10-092 내 팀: 구글로 로그인한 구단주만 — 확인 중·연결 실패면 그리지 않는다. 비로그인이면 잠긴 카드. -->
  {#if linked}
    <section class="card owner-team" aria-label="내 팀" data-owner-team>
      <div class="owner-team-head">
        <div class="owner-who">
          <small class="eyebrow">My team{card?.season ? ` · ${card.season}` : ''}</small>
          <h2>{card?.team?.name ?? '내 팀'}</h2>
          {#if card?.team}<span class="muted fs-sm">{card.team.manager} 감독 · {card.team.formation}</span>{/if}
        </div>
        {#if card?.team}
          <div class="owner-ovr" aria-label="팀 OVR {card.team.ovr}"><small>OVR</small><b>{card.team.ovr}</b></div>
        {/if}
      </div>
      {#if card?.team}
        <dl class="owner-stats owner-team-stats" data-owner-team-record>
          <div><dt>전적</dt><dd>{recordText(card.team.record)}</dd></div>
          <div><dt>레이팅</dt><dd>{num(card.team.rating)}</dd></div>
          <div><dt>오늘 경기</dt><dd>{card.left}/{card.perDay}</dd></div>
        </dl>
        <div class="owner-actions">
          <button class="btn" data-act="team" onclick={() => openTeam()}>내 팀 · 업적</button>
          <button class="btn btn-accent" data-act="owner-play" disabled={!!card.playHint} onclick={() => openTeam('opponents')}>경기하기</button>
        </div>
        {#if card.playHint}<p class="muted fs-sm">{card.playHint}</p>{/if}
      {:else}
        <p class="muted fs-sm">
          {card ? ownerTeamEmptyText(card) : cardFailed ? '시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요.' : '불러오는 중…'}
        </p>
        <button class="btn {card && card.players > 0 ? 'btn-primary' : ''} btn-block" data-act="team" onclick={() => openTeam()}>
          {card && card.players > 0 ? '팀 만들기' : '내 팀 · 시즌 업적'}
        </button>
      {/if}
    </section>
  {:else if guest}
    <section class="card owner-team" aria-label="내 팀" data-owner-team-locked>
      <small class="eyebrow">My team</small>
      <h2>내 팀</h2>
      <div class="owner-lock" aria-hidden="true">
        {#each [1, 4, 3, 3] as n, r (r)}
          <span class="owner-lock-row">{#each { length: n } as _, i (i)}<i></i>{/each}</span>
        {/each}
        <span class="owner-lock-badge">🔒︎ 로그인하면 열려요</span>
      </div>
      <p class="muted fs-sm">{ownerLockedText(localCount)}</p>
      <!-- 로그아웃·탈퇴 직후엔 세션 쿠키가 없으므로 링크로 바로 가지 않고 startGoogleLogin이 새 익명 세션부터 받는다. -->
      <a class="btn btn-primary btn-block" data-act="google-login" href={googleStartUrl()} onclick={(e) => { e.preventDefault(); void startGoogleLogin(null); }}>구글로 로그인</a>
    </section>
  {/if}

  {#if !guest || localCount > 0}<MyPlayers onrows={(rows) => (summary = ownerSummary(rows))} />{/if}

  <section class="card settings-card" id="account-slot" aria-label="계정">
    <Account {admin} />
    {#if admin}
      <button class="settings-row settings-trigger owner-admin" data-act="admin" onclick={() => (appState.screen = 'admin')}>
        <span class="settings-label"><strong>운영 도구</strong></span>
        <i class="settings-chev" aria-hidden="true">›</i>
      </button>
    {/if}
  </section>
</div>

<style>
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
  .owner-avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--pitch);
    color: var(--pitch-accent);
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
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
  .owner-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
  .owner-admin {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
</style>
