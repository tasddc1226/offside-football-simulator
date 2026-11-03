<script lang="ts">
  // T-11-603 랭크 매칭 첫 화면의 내 팀 정보: 디비전 · RP · 시즌 전적 · 승률 · 오늘 남은 경기(그 아래 action으로 매칭 찾기) · 최근 랭크 전적 5경기.
  import { onMount, type Snippet } from 'svelte';
  import { fetchTeamMatches, type OwnerTeam, type TeamMatch } from '@offside/app-core/api/team';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { formStreak, recentForm, recentRanked, winRate, type FormPip } from '@offside/app-core/rankQueue';
  import { divisionHead } from '@offside/app-core/teamDivision';
  import { num, recordText } from '@offside/app-core/teamText';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import DivisionEmblem from './DivisionEmblem.svelte';
  import TeamMatchRow from './TeamMatchRow.svelte';

  let {
    team,
    matchesLeft,
    perDay,
    onopen,
    action,
  }: {
    team: OwnerTeam;
    matchesLeft: number;
    perDay: number;
    /** 최근 전적 한 줄을 누르면 그 경기 결과를 연다. */
    onopen: (m: TeamMatch) => void;
    /** 내 팀 정보와 최근 전적 사이에 놓는 동작(매칭 찾기가 화면 아래로 밀리지 않게). */
    action?: Snippet | undefined;
  } = $props();

  const FORM_N = 5;
  const PIP: Record<FormPip, string> = { w: L.statsFormW, d: L.statsFormD, l: L.statsFormL };
  const head = $derived(divisionHead(team));
  const rate = $derived(winRate(team.record));
  let status = $state<LoadStatus>('loading');
  let matches = $state<TeamMatch[]>([]);
  const recent = $derived(recentRanked(matches, FORM_N));
  const form = $derived(recentForm(matches, FORM_N));
  const streak = $derived(formStreak(form));

  async function load() {
    status = 'loading';
    const r = await fetchTeamMatches(team.season);
    if (!r.ok) {
      status = 'error';
      return;
    }
    matches = r.data.items;
    status = 'ready';
  }
  onMount(() => void load());
</script>

<div class="ri stack" data-rank-info>
  <div class="ri-head">
    {#if head}<DivisionEmblem division={head.division} size={44} />{/if}
    <div class="ri-main">
      {#if head}<b class="ri-div" data-rank-division>{head.name}</b>{/if}
      {#if head}
        <div class="ri-bar" role="progressbar" aria-label={head.aria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={head.pct}><i class:guard={head.guard} style:width="{head.pct}%"></i></div>
        <small class="muted">{head.line}</small>
      {/if}
    </div>
    <span class="ri-rp" data-rank-rp={team.rating}><b>{num(team.rating)}</b><small class="muted">{L.oppRp}</small></span>
  </div>
  <dl class="ri-tiles">
    <div><dt class="muted">{L.infoRecord}</dt><dd>{recordText(team.record)}</dd></div>
    <div><dt class="muted">{L.infoWinRate}</dt><dd data-rank-winrate>{rate === null ? '-' : `${rate}%`}</dd></div>
    <div><dt class="muted">{L.infoLeft}</dt><dd data-rank-left>{matchesLeft}/{perDay}</dd></div>
  </dl>
  {@render action?.()}
  <div class="ri-recent" data-rank-recent>
    <div class="ri-form">
      <b class="ri-recent-title">{L.statsFormLabel({ n: FORM_N })}</b>
      {#if form.length}
        <span class="ri-pips" role="img" aria-label={L.statsFormAria({ list: form.map((p) => PIP[p]).join(' ') })} data-rank-form={form.join('')}>
          {#each form as p, i (i)}<span class="ri-pip {p}" aria-hidden="true">{PIP[p]}</span>{/each}
        </span>
        {#if streak}<small class="ri-streak" data-rank-streak>{streak}</small>{/if}
      {/if}
    </div>
    <LoadState {status} failText={L.historyFail} retry={() => void load()}>
      {#each recent as m (m.id)}
        <TeamMatchRow {m} {onopen} showRp />
      {:else}
        <p class="muted fs-sm ri-empty">{L.infoNoForm}</p>
      {/each}
    </LoadState>
  </div>
</div>

<style>
  .ri {gap: 12px;}
  .ri-head {display: flex; align-items: center; gap: 12px;}
  .ri-main {flex: 1; min-width: 0; display: grid; gap: 4px;}
  .ri-div {font-size: var(--fs-body);}
  .ri-bar {height: 6px; border-radius: 3px; background: var(--line); overflow: hidden;}
  .ri-bar i {display: block; height: 100%; border-radius: 3px; background: var(--accent);}
  .ri-bar i.guard {background: var(--bad);}
  .ri-rp {flex: none; display: grid; justify-items: center; line-height: 1.1;}
  .ri-rp b {font-family: var(--display); font-size: var(--fs-title2); font-weight: 700; color: var(--accent-text); font-variant-numeric: tabular-nums;}
  .ri-rp small {font-size: var(--fs-caption2);}
  .ri-tiles {display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0;}
  .ri-tiles div {padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--ink) 4%, var(--surface)); min-width: 0;}
  .ri-tiles dt {font-size: var(--fs-caption2);}
  .ri-tiles dd {margin: 2px 0 0; font-weight: 700; font-size: var(--fs-body2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere;}
  .ri-recent {display: grid; gap: 8px;}
  .ri-recent-title {font-size: var(--fs-body2);}
  .ri-empty {margin: 0;}
  .ri-form {display: flex; flex-wrap: wrap; align-items: center; gap: 8px;}
  .ri-pips {display: inline-flex; gap: 4px;}
  .ri-pip {width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; font-size: var(--fs-caption2); font-weight: 700; color: var(--ink); background: color-mix(in srgb, var(--ink) 10%, var(--surface));}
  .ri-pip.w {background: color-mix(in srgb, var(--accent) 28%, var(--surface));}
  .ri-pip.l {background: color-mix(in srgb, var(--bad) 22%, var(--surface));}
  .ri-streak {font-weight: 700; color: var(--accent-text);}
</style>
