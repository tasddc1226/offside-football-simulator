<script lang="ts">
  // T-11-269 시즌 통계 — 기록 탭의 통계 카드나 경기 결과의 우리 선수 이름에서 들어온다. 선수별 골 · 도움, 날짜별 전적,
  // 상대별 전적을 탭으로 나눠 보여 준다. 랭크 경기만 센다(친선전은 저장하지 않는다).
  // T-11-358 흐름 요약(최근 흐름 · 연속 기록 · 도전/도전받음 · 가장 큰 승패)과 경기 종류별 전적(랭크 · 친선 · 컵)을 위에 둔다.
  // 남의 팀 프로필에서도 같은 화면을 쓴다(embedded: 제목을 h2로, 돌아가기 대신 닫기).
  import { tick } from 'svelte';
  import type { TeamStatsResponse } from '@offside/app-core/api/team';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from './TeamLogo.svelte';
  import TeamSeasonReport from './TeamSeasonReport.svelte';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
  import { teamCoreText as C } from '@offside/app-core/i18n/ko/teamCore';
  import { statsDayLabel } from '@offside/app-core/teamText';
  import { bigMatchLine, formAria, formLetter, statsKindRows, streakText, type StatsKindRow } from '@offside/app-core/teamStats';
  import { TEAM_STATS_MATCHES_MAX } from '@offside/contracts/owner-team';

  let {
    stats,
    status,
    seasonName,
    focus,
    name,
    onreload,
    onback,
    backText = L.backHistory,
    embedded = false,
  }: {
    stats: TeamStatsResponse | null;
    status: LoadStatus;
    seasonName: string;
    /** 경기 결과에서 누른 선수(그 줄로 옮겨 강조한다). */
    focus: string | null;
    name: (id: string | null, fallback: string) => string;
    onreload: () => void;
    onback: () => void;
    backText?: string;
    embedded?: boolean;
  } = $props();

  type Tab = 'players' | 'days' | 'opponents';
  let tab = $state<Tab>('players');
  const tabs = (): [Tab, string][] => [
    ['players', L.statsTabPlayers],
    ['days', L.statsTabDays],
    ['opponents', L.statsTabOpponents],
  ];
  const record = (t: { w: number; d: number; l: number }) => C.record(t);

  // 선수 줄로 옮기기 — 통계가 준비되면 한 번만.
  let scrolled: string | null = null;
  $effect(() => {
    if (!focus || status !== 'ready' || scrolled === focus) return;
    scrolled = focus;
    tab = 'players';
    void tick().then(() =>
      document.querySelector(`[data-stats-player="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'center' }),
    );
  });
</script>

{#snippet kindList(kinds: StatsKindRow[])}
  {#if kinds.length}
    <div class="stack" style="gap:6px" data-stats-kinds>
      <h3 class="tm-stats-sub">{L.statsKindsTitle}</h3>
      <ul class="tm-stats-rows">
        {#each kinds as k (k.key)}
          <li data-stats-kind={k.key}>
            <b>{k.label}</b>
            <span>
              <span>{k.record ? record(k.record) : L.statsKindNone}</span>
              {#if k.record}<small class="muted">{L.statsGfGa({ gf: k.record.gf, ga: k.record.ga })}</small>{/if}
            </span>
          </li>
        {/each}
      </ul>
      <p class="muted fs-xs" style="margin:0">{L.statsKindNote}</p>
    </div>
  {/if}
{/snippet}

<section class="card stack" style="gap:12px" data-team-stats>
  <div>
    <div class="eyebrow">Stats</div>
    {#if embedded}<h2>{L.statsTitle}</h2>{:else}<h1>{L.statsTitle}</h1>{/if}
    {#if seasonName}<p class="muted fs-sm" style="margin:0">{seasonName}</p>{/if}
  </div>
  <LoadState {status} failText={L.statsFail} retry={onreload}>
    {@const s = stats!}
    {@const kinds = statsKindRows(s)}
    {#if s.matches === 0}
      <p class="muted">{L.statsEmpty}</p>
      {@render kindList(kinds)}
    {:else}
      <div class="tm-stats-total">
        <b data-stats-total>{record(s.total)}</b>
        <span class="muted fs-sm">{L.statsGfGa({ gf: s.total.gf, ga: s.total.ga })}</span>
      </div>
      {#if s.summary}
        {@const f = s.summary}
        {@const streak = streakText(f.streak)}
        <div class="stack tm-stats-flow" style="gap:8px" data-stats-flow>
          <h3 class="tm-stats-sub">{L.statsFlowTitle}</h3>
          {#if f.form.length}
            <div class="tm-stats-form">
              <small class="muted">{L.statsFormLabel({ n: f.form.length })}</small>
              <span class="tm-form-row" role="img" aria-label={formAria(f.form)} data-stats-form={f.form.join('')}>
                {#each f.form as r, i (i)}<span class="tm-form {r}" aria-hidden="true">{formLetter(r)}</span>{/each}
              </span>
            </div>
          {/if}
          <p class="muted fs-sm" style="margin:0">{streak ? `${streak} · ` : ''}{L.statsBestWinStreak({ n: f.bestWinStreak })}</p>
          <dl class="tm-stats-pairs">
            <div><dt>{L.kindChallenge}</dt><dd>{record(f.home)}</dd></div>
            <div><dt>{L.kindChallenged}</dt><dd>{record(f.away)}</dd></div>
            {#if f.biggestWin}<div data-stats-big="win"><dt>{L.statsBiggestWin}</dt><dd>{bigMatchLine(f.biggestWin)}</dd></div>{/if}
            {#if f.biggestLoss}<div data-stats-big="loss"><dt>{L.statsBiggestLoss}</dt><dd>{bigMatchLine(f.biggestLoss)}</dd></div>{/if}
          </dl>
        </div>
        {@render kindList(kinds)}
      {/if}
      <TeamSeasonReport report={s.report} />
      <div class="seg three" role="group" aria-label={L.statsTabLabel}>
        {#each tabs() as [k, label] (k)}
          <button class="hof-sort" aria-pressed={tab === k} onclick={() => (tab = k)} data-stats-tab={k}>{label}</button>
        {/each}
      </div>
      {#if tab === 'players'}
        {#if s.players.length}
          <ol class="tm-stats-list">
            <li class="tm-stats-head muted fs-sm" aria-hidden="true"><span></span><span>{L.statsGoals}</span><span>{L.statsAssists}</span></li>
            {#each s.players as p, i (p.careerId ?? `anon:${p.name}`)}
              <li data-stats-player={p.careerId ?? undefined} class:focus={!!focus && p.careerId === focus}>
                <span class="tm-stats-name"><small class="muted">{i + 1}</small> {name(p.careerId, p.name)}</span>
                <b>{p.goals}</b>
                <b>{p.assists}</b>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">{L.statsNoScorers}</p>
        {/if}
      {:else if tab === 'days'}
        <ul class="tm-stats-rows">
          {#each s.days as d (d.day)}
            <li data-stats-day={d.day}>
              <b>{statsDayLabel(d.day)}</b>
              <span><span>{record(d)}</span><small class="muted">{L.statsGfGa({ gf: d.gf, ga: d.ga })}</small></span>
            </li>
          {/each}
        </ul>
      {:else}
        <ul class="tm-stats-rows">
          {#each s.opponents as o (o.teamId)}
            <li data-stats-opp={o.teamId}>
              <span class="tm-stats-opp">
                <TeamLogo logo={o.logo} name={o.name} size={28} decorative />
                <span class="tm-stats-name"><b>{o.name}</b><small class="muted">{L.statsOppOwner({ owner: o.owner, n: o.w + o.d + o.l })}</small></span>
              </span>
              <span><span>{record(o)}</span><small class="muted">{L.statsGfGa({ gf: o.gf, ga: o.ga })}</small></span>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="muted fs-xs" style="margin:0">{s.capped ? L.statsCapped({ n: TEAM_STATS_MATCHES_MAX }) : L.statsNote({ n: s.matches })}</p>
    {/if}
  </LoadState>
  <button class="btn" onclick={onback} data-act="team-stats-back">{backText}</button>
</section>

<style>
  .tm-stats-total {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tm-stats-total b {
    font-family: var(--display);
    font-size: var(--fs-title1);
  }
  .tm-stats-sub {
    margin: 0;
    font-size: var(--fs-body1);
  }
  .tm-stats-form {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tm-form-row {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tm-form {
    display: inline-grid;
    place-items: center;
    min-width: 1.6em;
    height: 1.6em;
    padding: 0 3px;
    border-radius: var(--radius-xs);
    border: 1px solid currentColor;
    font-size: var(--fs-label);
    font-weight: 700;
  }
  .tm-form.w {
    color: var(--good);
  }
  .tm-form.d {
    color: var(--muted);
  }
  .tm-form.l {
    color: var(--bad);
  }
  .tm-stats-pairs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 6px 12px;
    margin: 0;
  }
  .tm-stats-pairs dt {
    font-size: var(--fs-label);
    color: var(--muted);
  }
  .tm-stats-pairs dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .tm-stats-list,
  .tm-stats-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .tm-stats-list li {
    display: grid;
    grid-template-columns: 1fr 3.2em 3.2em;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    border-top: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .tm-stats-list li > b,
  .tm-stats-head > span:not(:first-child) {
    text-align: right;
  }
  .tm-stats-list li.tm-stats-head {
    border-top: 0;
    padding-bottom: 2px;
  }
  .tm-stats-list li.focus {
    background: var(--surface-2);
    border-radius: var(--radius-sm);
  }
  .tm-stats-rows li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
  .tm-stats-rows li > span:last-child {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    flex: none;
  }
  .tm-stats-opp {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .tm-stats-name {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-stats-list .tm-stats-name {
    display: block;
  }
</style>
