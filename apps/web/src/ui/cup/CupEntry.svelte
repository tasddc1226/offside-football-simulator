<script lang="ts">
  // T-11-145 컵 신청 상태(배너와 대회 화면이 함께 쓴다) — 접수 중이면 신청·취소·불가 이유, 시작한 뒤엔 내 다음 경기와
  // 명단 마감 안내, 끝났으면 내 성적. 신청·취소가 성공하면 onchanged로 부모가 다시 불러온다.
  import { divisionLabel } from '@offside/app-core/cupDivision';
  import { enterCup, withdrawCup, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { cupEnterConfirmLines, cupEntryTeamAction } from '@offside/app-core/cupEntry';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { go } from '../nav.js';
  import { appState } from '../state.svelte.js';
  import { toast } from '../helpers.js';
  import { lockAtOf, lockWhen, roundLabel, stageLabel, teamMap, teamName, whenText } from './cupView.js';

  import TeamLogo from '../team/TeamLogo.svelte';

  // 로그인한 구단주에게만 그린다(비로그인 안내는 대회 화면의 로그인 카드가 한다).
  let { data, me, onchanged }: { data: CupResponse; me: CupMeResponse | null; onchanged: () => void } = $props();

  let busy = $state(false);
  // T-11-443 신청 전 한 번 더 묻는다(선발 잠금 · 구간 상한 안내). 팀 화면 프리셋의 카드 안 확인과 같은 모양.
  let asking = $state(false);
  // T-11-443 편성을 고치면 풀리는 이유면 편성 화면으로 가는 버튼.
  const teamAction = $derived(cupEntryTeamAction(me?.eligibility));
  function openTeam() {
    appState.teamView = 'team';
    go('team');
  }
  const entry = $derived(me?.entry && me.entry.status !== 'withdrawn' ? me.entry : null);
  const names = $derived(teamMap(data.teams));
  const registeredTeam = $derived(entry ? names.get(entry.teamId) : undefined);
  const reason = $derived.by(() => {
    const e = me?.eligibility;
    if (!e || e.ok) return null;
    switch (e.reason) {
      case 'no-team': return L.reasonNoTeam;
      case 'not-enough': return L.reasonNotEnough({ filled: e.filled, min: data.cup.minFilled });
      case 'listed': return L.reasonListed;
      case 'full': return L.reasonFull;
      case 'closed': return L.reasonClosed;
      case 'over-cap': return L.reasonOverCap({ ovr: me?.ovr ?? 0, cap: data.cup.ovrMax ?? 0 });
      case 'entered-other': return L.reasonEnteredOther;
      default: return null;
    }
  });
  const next = $derived(me?.next ?? null);
  // T-11-410 구간 대회: 내 OVR로 들어갈 가장 낮은 구간 안내(신청 전), 상한 있는 구간이면 대회 중 명단 상한 안내.
  const fit = $derived.by(() => {
    if (!data.divisions || me?.ovr == null) return null;
    const lowest = data.divisions.find((d) => d.division === 'master' || (d.ovrMax != null && me!.ovr! <= d.ovrMax));
    return lowest ? L.divisionFit({ ovr: me.ovr, division: divisionLabel(lowest.division)! }) : null;
  });
  const capNote = $derived(data.cup.ovrMax != null ? L.divisionLockNote({ cap: data.cup.ovrMax }) : null);
  const nextVs = $derived.by(() => {
    if (!next || !entry) return '';
    const other = next.homeTeamId === entry.teamId ? next.awayTeamId : next.homeTeamId;
    return teamName(names, other);
  });
  // T-11-405 다음 경기 예상(지금 두 팀 명단 기준). 토너먼트(조 없음)면 무승부 뒤 승부차기 안내를 붙인다.
  const odds = $derived(next ? (me?.nextOdds ?? null) : null);
  const nextLock = $derived.by(() => {
    if (!next) return null;
    const at = lockAtOf(data.cup, next.round);
    return at ? lockWhen(at, Date.now()) : null;
  });

  async function enter() {
    if (busy) return;
    busy = true;
    const r = await enterCup(data.cup.id);
    busy = false;
    asking = false;
    if (!r.ok) {
      toast(r.error.message);
      return onchanged();
    }
    toast(L.toastEntered);
    onchanged();
  }
  async function withdraw() {
    if (busy || !confirm(L.withdrawConfirm)) return;
    busy = true;
    const r = await withdrawCup(data.cup.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(L.toastWithdrawn);
    onchanged();
  }
</script>

{#if registeredTeam}
  <div class="ce-team" data-cup-registered-team={registeredTeam.teamId}>
    <TeamLogo logo={registeredTeam.logo} name={registeredTeam.name} size={40} decorative />
    <div class="ce-team-who">
      <small class="muted">{L.registeredTeam}</small>
      <b>{registeredTeam.name}</b>
      <small class="muted">{registeredTeam.owner}</small>
    </div>
    <span class="fs-sm ce-team-ovr">OVR {registeredTeam.ovr}</span>
  </div>
{/if}

{#if data.phase === 'open'}
  {#if entry}
    <div class="ce-row" data-cup-entered>
      <span class="pill good">{L.entered}</span>
      <button class="btn btn-sm" data-act="cup-withdraw" disabled={busy} onclick={withdraw}>{busy ? L.withdrawing : L.withdraw}</button>
    </div>
    <p class="muted fs-sm">{L.enterLockNote}</p>
    {#if capNote}<p class="muted fs-sm" data-cup-cap-note>{capNote}</p>{/if}
  {:else if me?.eligibility.ok}
    {#if asking}
      <div class="ce-ask" role="group" aria-label={L.enterAskTitle} data-cup-enter-ask>
        <b>{L.enterAskTitle}</b>
        <ul class="ce-ask-lines">{#each cupEnterConfirmLines(data.cup) as line (line)}<li>{line}</li>{/each}</ul>
        <div class="ce-row">
          <button class="btn" disabled={busy} onclick={() => (asking = false)} data-act="cup-enter-cancel">{L.enterAskCancel}</button>
          <button class="btn btn-primary" disabled={busy} onclick={enter} data-act="cup-enter-confirm">{busy ? L.entering : L.enterAskOk}</button>
        </div>
      </div>
    {:else}
      <button class="btn btn-primary btn-block" data-act="cup-enter" disabled={busy} onclick={() => (asking = true)}>{L.enter}</button>
      <p class="muted fs-sm">{L.enterLockNote}</p>
      {#if capNote}<p class="muted fs-sm" data-cup-cap-note>{capNote}</p>{/if}
    {/if}
    {#if fit}<p class="muted fs-sm" data-cup-fit>{fit}</p>{/if}
  {:else if reason}
    <p class="muted fs-sm" data-cup-reason={me?.eligibility.reason}>{reason}</p>
    {#if fit && me?.eligibility.reason === 'over-cap'}<p class="muted fs-sm" data-cup-fit>{fit}</p>{/if}
    {#if teamAction}<button class="btn btn-sm ce-team-btn" data-act="cup-to-lineup" onclick={openTeam}>{teamAction}</button>{/if}
  {/if}
{:else if data.phase !== 'soon' && data.phase !== 'cancelled' && me}
  {#if !entry}
    <p class="muted fs-sm">{L.notEntered}</p>
  {:else if entry.status === 'champion'}
    <p class="ce-win" data-cup-champion><b>{L.youWon}</b></p>
  {:else if entry.status === 'out'}
    <p class="fs-sm" data-cup-out>{entry.stage ? L.myResult({ stage: stageLabel(entry.stage) }) : ''}</p>
  {:else if data.phase === 'closed'}
    <div class="ce-row"><span class="pill good">{L.entered}</span></div>
  {:else if next}
    <div class="ce-next" data-cup-next>
      <b>{L.nextMatch({ round: roundLabel(next.round), vs: nextVs, at: whenText(next.at) })}</b>
      {#if odds}
        <div class="ce-odds" data-cup-odds>
          <span class="fs-sm num">{L.oddsLine(odds)}</span>
          <div class="ce-odds-bar" aria-hidden="true">
            <span class="w" style:width="{odds.win}%"></span>
            <span class="d" style:width="{odds.draw}%"></span>
            <span class="l" style:width="{odds.loss}%"></span>
          </div>
          <small class="muted">{L.oddsNote}{next.group === null ? ` ${L.oddsKoNote}` : ''}</small>
        </div>
      {/if}
      {#if me.locked}
        <span class="pill warn" data-cup-locked>{L.lockedNow}</span>
      {:else if nextLock}
        <span class="muted fs-sm" data-cup-lock>{L.lockNote({ when: nextLock })}</span>
      {/if}
    </div>
  {:else if data.phase === 'group' || data.phase === 'knockout'}
    <p class="muted fs-sm">{L.nextPending}</p>
  {/if}
{/if}

<style>
  .ce-team {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .ce-team-who { display: flex; flex-direction: column; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .ce-team-ovr { flex: none; font-variant-numeric: tabular-nums; }

  .ce-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ce-ask { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--radius-md); background: var(--surface-2); }
  .ce-ask-lines { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-label); line-height: 1.5; }
  .ce-ask .ce-row button { flex: 1; min-height: 44px; }
  .ce-team-btn { align-self: flex-start; }
  .ce-odds { display: flex; flex-direction: column; gap: 4px; }
  .ce-odds-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--line);
  }
  .ce-odds-bar .w { background: var(--good); }
  .ce-odds-bar .d { background: var(--muted); }
  .ce-odds-bar .l { background: var(--bad); }
  .ce-next {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    overflow-wrap: anywhere;
  }
  .ce-next .pill {
    align-self: flex-start;
    white-space: normal;
  }
  .ce-win {
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--pitch);
    color: var(--pitch-accent);
  }
</style>
