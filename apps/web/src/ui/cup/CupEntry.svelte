<script lang="ts">
  // T-11-145 컵 신청 상태(배너와 대회 화면이 함께 쓴다) — 접수 중이면 신청·취소·불가 이유, 시작한 뒤엔 내 다음 경기와
  // 명단 마감 안내, 끝났으면 내 성적. 신청·취소가 성공하면 onchanged로 부모가 다시 불러온다.
  import { enterCup, withdrawCup, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { toast } from '../helpers.js';
  import { lockAtOf, lockWhen, roundLabel, stageLabel, teamMap, teamName, whenText } from './cupView.js';

  let { data, me, linked, onchanged }: { data: CupResponse; me: CupMeResponse | null; linked: boolean; onchanged: () => void } = $props();

  let busy = $state(false);
  const entry = $derived(me?.entry && me.entry.status !== 'withdrawn' ? me.entry : null);
  const names = $derived(teamMap(data.teams));
  const reason = $derived.by(() => {
    const e = me?.eligibility;
    if (!e || e.ok) return null;
    switch (e.reason) {
      case 'no-team': return L.reasonNoTeam;
      case 'not-enough': return L.reasonNotEnough({ filled: e.filled, min: data.cup.minFilled });
      case 'listed': return L.reasonListed;
      case 'full': return L.reasonFull;
      case 'closed': return L.reasonClosed;
      default: return null;
    }
  });
  const next = $derived(me?.next ?? null);
  const nextVs = $derived.by(() => {
    if (!next || !entry) return '';
    const other = next.homeTeamId === entry.teamId ? next.awayTeamId : next.homeTeamId;
    return teamName(names, other);
  });
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

{#if data.phase === 'open'}
  {#if !linked}
    <p class="muted fs-sm" data-cup-login>{L.loginToEnter}</p>
  {:else if entry}
    <div class="ce-row" data-cup-entered>
      <span class="pill good">{L.entered}</span>
      <button class="btn btn-sm" data-act="cup-withdraw" disabled={busy} onclick={withdraw}>{busy ? L.withdrawing : L.withdraw}</button>
    </div>
    <p class="muted fs-sm">{L.enterLockNote}</p>
  {:else if me?.eligibility.ok}
    <button class="btn btn-primary btn-block" data-act="cup-enter" disabled={busy} onclick={enter}>{busy ? L.entering : L.enter}</button>
    <p class="muted fs-sm">{L.enterLockNote}</p>
  {:else if reason}
    <p class="muted fs-sm" data-cup-reason={me?.eligibility.reason}>{reason}</p>
  {/if}
{:else if data.phase !== 'soon' && data.phase !== 'cancelled' && linked && me}
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
  .ce-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ce-next {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 12px;
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
    border-radius: 12px;
    background: var(--pitch);
    color: var(--pitch-accent);
  }
</style>
