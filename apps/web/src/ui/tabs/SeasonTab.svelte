<script lang="ts">
  // ui.ts seasonTab()/compsCard()/storiesCard()/meter() 포트 (224~259줄, 340~345줄, 671~684줄)
  import { PHASES, LAST_PHASE } from '../../game/data.js';
  import { teamRank, roundRange, TRAININGS, trainingLabel, trainingDesc, STORIES, turnNo } from '../../game/engine.js';
  import { EVENTS } from '../../game/events-data.js';
  import type { GameState } from '../../game/types.js';
  import { save, seasonLabel } from '../helpers.js';
  import { appState } from '../state.svelte.js';
  import PhaseReport from './PhaseReport.svelte';
  import LeagueTable from './LeagueTable.svelte';

  const { s }: { s: GameState } = $props();

  const S = $derived(s.season);
  const avg = $derived(S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-');
  const rank = $derived(teamRank(s));
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const label = $derived(phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`);
  const lastCol = $derived((s.pos === 'GK' || s.pos === 'DF' ? ['무실점', S.cs] : ['도움', S.assists]) as [string, number]);
  const comps = $derived(s.season.comps || []);
  const activeStories = $derived(Object.entries(s.story || {}).filter(([, v]) => !v.done));
  const t = $derived(turnNo(s));

  function meterCls(v: number, badAt: number, warnAt: number): string {
    return v < badAt ? 'bad' : v < warnAt ? 'warn' : '';
  }

  function setTraining(id: string) {
    s.training = id;
    save();
  }

  function waitText(k: string): string {
    const c = (s.chains || []).find((x) => {
      const e = EVENTS.find((y) => y.id === x.id);
      return e && e.story === k;
    });
    if (!c) return '';
    return c.at <= t ? '곧 이어짐' : `약 ${c.at - t}구간 후`;
  }
</script>

{#if appState.report && appState.report.year === s.year}
  {#key appState.report.key}
    <PhaseReport r={appState.report} />
  {/key}
{/if}

<section class="card">
  <div class="row" style="justify-content:space-between">
    <div><div class="eyebrow">{seasonLabel(s)} Season</div><h2>{label}</h2></div>
    <span class="pill">{rank ? `팀 ${rank}위` : '개막 전'} · {S.w}승 {S.d}무 {S.l}패</span>
  </div>
  <div class="track">
    {#each [0, 1, 2] as i (i)}
      <div class={i < phase ? 'done' : i === phase ? 'now' : ''}></div>
    {/each}
  </div>
  <div class="track-lbl">
    {#each ['프리시즌', '전반기', '후반기'] as tl (tl)}
      <span>{tl}</span>
    {/each}
  </div>
  <div class="stats">
    <div><b>{S.apps}</b><span>출전</span></div>
    <div><b>{S.goals}</b><span>골</span></div>
    <div><b>{s.pos === 'GK' || s.pos === 'DF' ? S.assists : S.starts}</b><span>{s.pos === 'GK' || s.pos === 'DF' ? '도움' : '선발'}</span></div>
    <div><b>{lastCol[1]}</b><span>{lastCol[0]}</span></div>
    <div><b>{avg}</b><span>평점</span></div>
  </div>
</section>

<LeagueTable {s} />

<section class="card meters">
  <div class="meter"><span>컨디션</span><div class="bar"><i class={meterCls(s.cond, 40, 65)} style="width:{Math.round(s.cond)}%"></i></div><span class="v">{Math.round(s.cond)}</span></div>
  <div class="meter"><span>사기</span><div class="bar"><i class={meterCls(s.morale, 40, 60)} style="width:{Math.round(s.morale)}%"></i></div><span class="v">{Math.round(s.morale)}</span></div>
  <div class="meter"><span>인기</span><div class="bar"><i class="acc" style="width:{Math.min(100, Math.round(s.fame))}%"></i></div><span class="v">{Math.round(s.fame)}</span></div>
</section>

{#if comps.length}
  <section class="card">
    <div class="eyebrow">Competitions</div>
    <h2 style="margin-bottom:6px">이번 시즌 대회</h2>
    {#each comps as c (c.name)}
      <div class="story-row">
        <b>{c.name}</b>
        <span class="muted">{c.stage || (c.type === 'super' ? '개막 전 단판' : '1구간 시작')}{c.alive && c.stage ? ' · 진행 중' : ''}</span>
        <span class="muted">{c.apps}경기 {c.g}골</span>
      </div>
    {/each}
  </section>
{/if}

{#if activeStories.length}
  <section class="card">
    <div class="eyebrow">Storylines</div>
    <h2 style="margin-bottom:6px">진행 중인 스토리</h2>
    {#each activeStories as [k, v] (k)}
      <div class="story-row">
        <b>{STORIES[k]!.name}</b>
        <span class="dots">
          {#each Array.from({ length: STORIES[k]!.total }) as _, i (i)}
            <i class={i < v.stage ? 'on' : ''}></i>
          {/each}
        </span>
        <span class="muted">{waitText(k)}</span>
      </div>
    {/each}
  </section>
{/if}

<section class="card stack">
  <div><div class="eyebrow">Training</div><h2>이번 구간 훈련 방향</h2></div>
  <div class="train">
    {#each TRAININGS as tr (tr.id)}
      <button class="opt" data-train={tr.id} aria-pressed={s.training === tr.id} onclick={() => setTraining(tr.id)}>
        <b>{trainingLabel(s, tr)}</b><small>{trainingDesc(s, tr)}</small>
      </button>
    {/each}
  </div>
  <p class="muted" style="font-size:12px">진행 버튼은 화면 아래 고정 액션바에 있습니다.</p>
</section>

<section class="card">
  <div class="eyebrow">Timeline</div>
  <h2 style="margin-bottom:6px">최근 소식</h2>
  <div class="feed">
    {#each s.log.slice(0, 14) as l, i (i)}
      <div><time>{l.t}</time><span class={l.kind}>{l.text}</span></div>
    {/each}
  </div>
</section>
