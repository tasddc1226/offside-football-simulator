<script lang="ts">
  // T-11-360 홈 출석 체크 — 오프사이드 컵 배너 · 구단주 선물 아래의 한 줄 입구와, 하루(KST) 한 번 저절로 뜨는 출석 창.
  // 로그인한 구단주는 창에서 하루 한 번 출석해 그날 칸의 보상을 받고, 로그인하지 않은 기기는 같은 도장판과 로그인 버튼을 본다
  // (로그인하면 홈으로 돌아와 바로 출석). 묻는 조건 · 메모는 app-core api/attendance.ts, 띄우는 날은 attendance-view.ts.
  // 첫 화면 번들 밖 지연 청크(Home.svelte가 import()로 부른다).
  import { checkInAttendance, fetchAttendance, type AttendanceCard } from '@offside/app-core/api/attendance';
  import {
    attendanceBoard,
    attendancePopupDue,
    boardTotal,
    markAttendancePopup,
    rewardText,
  } from '@offside/app-core/attendance-view';
  import { attendanceText as L } from '@offside/app-core/i18n/ko/attendance';
  import LoginButtons from './LoginButtons.svelte';
  import PopSheet from './PopSheet.svelte';
  import { toast } from './helpers.js';

  let card = $state<AttendanceCard | null>(null);
  let open = $state(false);
  let busy = $state(false);
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 번 주지 않는다. 출석이 끝나면 새 키(다음 날 누름)로 바꾼다.
  let key = crypto.randomUUID();
  const att = $derived(card?.kind === 'owner' ? card.att : null);
  const board = $derived(att ? attendanceBoard(att.stamps, att.checkedIn) : attendanceBoard(0, false));
  const ITEM = { reroll: L.itemReroll, boost: L.itemBoost, scout: L.itemScout };

  // auto: 페이지를 연 뒤 처음 그린 홈일 때만(Home.svelte가 정한다). 로그아웃 뒤 · 다른 화면에서 돌아올 때는 띄우지 않는다.
  const { auto = false }: { auto?: boolean } = $props();

  $effect(() => {
    void fetchAttendance().then((c) => {
      card = c;
      // 컵 우승 팝업 같은 다른 창이 떠 있으면 오늘은 저절로 띄우지 않는다(다음에 홈에 올 때 뜬다).
      if (auto && c && attendancePopupDue(c) && !document.querySelector('[aria-modal="true"]')) {
        markAttendancePopup();
        open = true;
      }
    });
  });

  async function checkIn() {
    if (!att || att.checkedIn || busy) return;
    busy = true;
    const r = await checkInAttendance(key);
    busy = false;
    if (r.ok) {
      key = crypto.randomUUID();
      card = { kind: 'owner', att: r.data.attendance };
      toast(L.stamped({ n: r.data.attendance.stamps, reward: rewardText(r.data.granted) }));
    } else if (r.error.reason === 'ATTENDANCE_CHECKED') {
      card = { kind: 'owner', att: { ...att, checkedIn: true } };
    } else if (r.error.reason === 'GOOGLE_LOGIN_REQUIRED') {
      card = { kind: 'guest' };
    } else {
      toast(L.fail);
    }
  }
</script>

{#if !card}
  <!-- 불러오는 동안도 같은 높이를 차지해 아래 홈이 밀리지 않게 한다(CLS). -->
  <div class="card home-att-entry" aria-hidden="true"><span class="hae-title"><b>{L.title}</b></span></div>
{:else}
  <button class="card home-att-entry" data-act="attendance-open" data-home-attendance={card.kind} aria-label={L.entryLabel} onclick={() => (open = true)}>
    <span class="hae-title"><b>{L.title}</b>{#if att && att.streak > 0}<span class="hae-streak num">🔥 {L.streak({ n: att.streak })}</span>{/if}</span>
    <span class="hae-sub fs-sm" class:done={att?.checkedIn}>
      {#if !att}{L.entryGuest}{:else if att.checkedIn}✓ {L.entryDone}{:else}{L.entryToday({ reward: board.next.text })}{/if}
    </span>
    <svg class="hae-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </button>
{/if}

{#if card && open}
  <PopSheet label={L.title} onclose={() => (open = false)}>
    <div class="home-att" data-attendance-sheet={card.kind} data-checked={att?.checkedIn ? '1' : '0'}>
      <div class="ha-head">
        <div class="ha-title">
          <small class="eyebrow">Daily</small>
          <h2>{L.title}</h2>
        </div>
        {#if att && att.streak > 0}<span class="ha-streak num" data-attendance-streak={att.streak}>🔥 {L.streak({ n: att.streak })}</span>{/if}
      </div>
      <div class="ha-board" role="img" aria-label={L.boardLabel({ filled: board.filled, total: board.total })}>
        {#each board.cells as cell (cell.n)}
          <span class="ha-cell it-{cell.item}" class:on={cell.on} class:big={cell.big} class:today={cell.today}>
            <small class="ha-day num">{cell.n}</small>
            {#if cell.on}<b class="ha-mark">✓</b>{:else if cell.big}<b class="ha-mark">🎁</b>{:else}<b class="ha-qty num">+{cell.qty}</b>{/if}
          </span>
        {/each}
      </div>
      <ul class="ha-legend fs-xs" aria-hidden="true">
        {#each ['reroll', 'boost', 'scout'] as const as k (k)}<li class="it-{k}">{ITEM[k]}</li>{/each}
      </ul>
      <div class="ha-meta fs-sm">
        {#if att}<span class="muted num">{L.board({ filled: board.filled, total: board.total })}</span>{/if}
        <span data-attendance-next><span class="muted">{board.next.today ? L.todayLabel : L.tomorrowLabel}</span> · <b>{board.next.text}</b></span>
      </div>
      {#if !att}
        <p class="ha-lead fs-sm">{L.guestLead(boardTotal())}</p>
        <LoginButtons back={{ home: true }} act="attendance-google-login" />
      {:else if att.checkedIn}
        <p class="ha-done fs-sm" data-attendance-done>{L.checked}</p>
      {:else}
        <button class="btn btn-accent btn-block" onclick={checkIn} disabled={busy} data-act="attendance-check-in">{busy ? L.busy : L.btn}</button>
      {/if}
      {#if att}<p class="muted fs-xs ha-grace">{L.grace}</p>{/if}
      <button class="btn btn-block" data-act="attendance-close" onclick={() => (open = false)}>{L.close}</button>
    </div>
  </PopSheet>
{/if}

<style>
  .home-att-entry {
    box-sizing: border-box;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding-block: 12px;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .hae-title {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex: none;
  }
  .hae-streak {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--accent-text);
  }
  .hae-sub {
    flex: 1;
    min-width: 0;
    text-align: right;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hae-sub.done {
    color: var(--accent-text);
    font-weight: 700;
  }
  .hae-chev {
    flex: none;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 2;
  }
  .home-att {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ha-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .ha-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ha-title h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  .ha-streak {
    flex: none;
    font-weight: 700;
    font-size: 0.8125rem;
    color: var(--accent-text);
  }
  /* 아이템 색: 리롤권 = 기본, 강화권 = 금(--r4), 스카우트권 = 파랑(--r2). 칭호 등급 색이라 두 테마 모두 대비가 맞다. */
  .it-reroll {
    --it: var(--muted);
  }
  .it-boost {
    --it: var(--r4);
  }
  .it-scout {
    --it: var(--r2);
  }
  .ha-board {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  /* T-11-378 동그라미 도장. 글자는 기본 글자색, 아이템은 칸 바탕 · 테두리 고리 색으로만 보인다(색 글자는 옅은 바탕에서
     대비가 모자란다). 큰 보상 칸은 고리가 두껍다. */
  .ha-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border-radius: 50%;
    line-height: 1;
    color: var(--ink);
    background: color-mix(in srgb, var(--it) 8%, var(--surface));
    box-shadow: inset 0 0 0 2px var(--it);
  }
  .ha-cell.big {
    background: color-mix(in srgb, var(--it) 16%, var(--surface));
    box-shadow: inset 0 0 0 3px var(--it);
  }
  .ha-day {
    font-size: 0.625rem;
  }
  .ha-qty,
  .ha-mark {
    font-size: 0.8125rem;
  }
  .ha-cell.on {
    background: var(--accent);
    box-shadow: none;
    color: var(--accent-ink);
  }
  .ha-cell.today {
    box-shadow: none;
    outline: 2px dashed var(--accent);
    outline-offset: -2px;
  }
  .ha-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
  }
  .ha-legend li {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ha-legend li::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--it);
  }
  .ha-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .ha-lead,
  .ha-done,
  .ha-grace {
    margin: 0;
  }
  .ha-done {
    text-align: center;
    font-weight: 700;
    color: var(--accent-text);
  }
</style>
