<script lang="ts">
  // ui.ts seasonTab()/compsCard()/storiesCard()/meter() 포트 (224~259줄, 340~345줄, 671~684줄)
  // T-11-024 순서: 방금 끝난 구간 리포트 → 다음 구간 준비(컨디션·훈련·자기 투자) → 시즌 현황(진행 막대·누적 기록·
  // 순위표·대회) → 스토리 → 최근 소식 → 버튼. 버튼은 고정 바 없이 탭 맨 아래 한 자리에 둔다 — 이벤트·시즌 결산이 대기 중이면
  // 그걸 열고, 아니면 구간을 진행한다. 결과와 훈련 선택을 지나야 누를 수 있다. 리포트와 겹치는 숫자·소식은 다시 그리지 않는다.
  import { PHASES, LAST_PHASE } from '@offside/game/data';
  import { roundRange, leagueOf, blockMatches, TRAININGS, trainingLabel, trainingCard, trainingHelp, TRAINING_NOTE, INVESTS, INVEST_NOTE, investCard, investHelp, investDef, fmtMoney, STORIES, turnNo } from '@offside/game/engine';
  import { eventById } from '@offside/game/events-data';
  import type { GameState } from '@offside/game/types';
  import { save } from '../helpers.js';
  import { seasonLabel } from '@offside/app-core/career';
  import { appState } from '../state.svelte.js';
  import { advance, nextPending } from '../actions.js';
  import { buzz } from '../motion.js';
  import PhaseReport from './PhaseReport.svelte';
  import LeagueTable from './LeagueTable.svelte';

  const { s }: { s: GameState } = $props();

  const S = $derived(s.season);
  const avg = $derived(S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-');
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const label = $derived(phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`);
  const lastCol = $derived((s.pos === 'GK' || s.pos === 'DF' ? ['무실점', S.cs] : ['도움', S.assists]) as [string, number]);
  const comps = $derived(s.season.comps || []);
  const activeStories = $derived(Object.entries(s.story || {}).filter(([, v]) => !v.done));
  const t = $derived(turnNo(s));
  const picked = $derived(TRAININGS.find((x) => x.id === s.training));
  const invest = $derived(investDef(s));
  const report = $derived(appState.report && appState.report.year === s.year ? appState.report : null);
  // 리포트가 개막 후 첫 구간이면 시즌 누적 = 구간 기록이라 누적 칸을 숨긴다. 개막 전(0경기)에도 숨긴다.
  const showTotals = $derived(S.played > 0 && !(report?.block && S.played === report.games.length));
  const left = $derived(leagueOf(s.leagueId).matches - S.played);
  const btnLabel = $derived(phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? left : Math.min(blockMatches(s), left)}경기 진행`);
  // 최근 소식: 리포트에 이미 나온 구간 기록은 빼고 5줄만, '더 보기'로 14줄까지.
  const FEED_SHORT = 5;
  const FEED_LONG = 14;
  let feedAll = $state(false);
  const feed = $derived.by(() => {
    const hide = report ? `${report.year} ${PHASES[report.ph]}` : null;
    return s.log.filter((l) => l.t !== hide).slice(0, FEED_LONG);
  });

  const pendingLabel = $derived(s.pending?.type === 'event' ? '⚡ 이벤트 확인' : '시즌 결산 보기');

  function onAdvance() {
    buzz();
    void advance();
  }

  function onPending() {
    buzz();
    nextPending();
  }

  function meterCls(v: number, badAt: number, warnAt: number): string {
    return v < badAt ? 'bad' : v < warnAt ? 'warn' : '';
  }

  function setTraining(id: string) {
    s.training = id;
    save();
  }

  function setInvest(id: string) {
    s.invest = id;
    save();
  }

  function waitText(k: string): string {
    const c = (s.chains || []).find((x) => {
      const e = eventById(x.id);
      return e && e.story === k;
    });
    if (!c) return '';
    return c.at <= t ? '곧 이어짐' : `약 ${c.at - t}구간 후`;
  }
</script>

{#if report}
  {#key report.key}
    <PhaseReport r={report} />
  {/key}
{/if}

<!-- 훈련·자기 투자 카드 공통 내용 -->
{#snippet optBody(label: string, c: { effect: string[]; tag: string })}
  <b>{label}</b><small>{#each c.effect as part, i (i)}{i ? ' · ' : ''}<span class="nowrap">{part}</span>{/each}</small>{#if c.tag}<small class="train-tag">{c.tag}</small>{/if}
{/snippet}
{#snippet helpBody(title: string, body: string, note: string)}
  <b>{title}</b>
  <p>{body}</p>
  <p class="muted fs-xs">{note}</p>
{/snippet}

<section class="card stack" data-prep>
  <div><div class="eyebrow">Next · {label}</div><h2>다음 구간 준비</h2></div>
  <div class="meters">
    <div class="meter"><span>컨디션</span><div class="bar"><i class={meterCls(s.cond, 40, 65)} style="width:{Math.round(s.cond)}%"></i></div><span class="v">{Math.round(s.cond)}</span></div>
    <div class="meter"><span>사기</span><div class="bar"><i class={meterCls(s.morale, 40, 60)} style="width:{Math.round(s.morale)}%"></i></div><span class="v">{Math.round(s.morale)}</span></div>
    <div class="meter"><span>인기</span><div class="bar"><i class="acc" style="width:{Math.min(100, Math.round(s.fame))}%"></i></div><span class="v">{Math.round(s.fame)}</span></div>
  </div>
  <h3 class="sub-title">훈련 방향</h3>
  <div class="train">
    {#each TRAININGS as tr (tr.id)}
      {@const c = trainingCard(s, tr)}
      <button class="opt" data-train={tr.id} aria-pressed={s.training === tr.id} onclick={() => setTraining(tr.id)}>
        {@render optBody(trainingLabel(s, tr), c)}
      </button>
    {/each}
  </div>
  {#if picked}
    <div class="train-help" data-train-help aria-live="polite">
      {@render helpBody(trainingLabel(s, picked), trainingHelp(s, picked), TRAINING_NOTE)}
    </div>
  {/if}
</section>

<section class="card stack">
  <div class="row" style="justify-content:space-between">
    <div><div class="eyebrow">Invest</div><h2>자기 투자</h2></div>
    <span class="pill" data-invest-money>보유 {fmtMoney(s.money)}원</span>
  </div>
  <div class="train">
    {#each INVESTS as d (d.id)}
      {@const c = investCard(s, d)}
      <button class="opt" data-invest={d.id} aria-pressed={invest.id === d.id} disabled={!c.affordable} onclick={() => setInvest(d.id)}>
        {@render optBody(d.label, c)}
      </button>
    {/each}
  </div>
  <div class="train-help" data-invest-help aria-live="polite">
    {@render helpBody(invest.label, investHelp(s, invest), INVEST_NOTE)}
  </div>
</section>

<section class="card stack" data-season-status>
  <div>
    <div class="eyebrow">{seasonLabel(s)} Season</div>
    <h2>{label}</h2>
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
  </div>
  {#if showTotals}
    <div class="stats" style="margin-top:0" data-season-totals>
      <div><b>{S.apps}</b><span>출전</span></div>
      <div><b>{S.goals}</b><span>골</span></div>
      <div><b>{s.pos === 'GK' || s.pos === 'DF' ? S.assists : S.starts}</b><span>{s.pos === 'GK' || s.pos === 'DF' ? '도움' : '선발'}</span></div>
      <div><b>{lastCol[1]}</b><span>{lastCol[0]}</span></div>
      <div><b>{avg}</b><span>평점</span></div>
    </div>
  {/if}
  <LeagueTable {s} />
  {#if comps.length}
    <div>
      <h3 class="sub-title" style="margin-bottom:2px">이번 시즌 대회</h3>
      {#each comps as c (c.name)}
        <div class="story-row">
          <b>{c.name}</b>
          <span class="muted">{c.stage || (c.type === 'super' ? '개막 전 단판' : '1구간 시작')}{c.alive && c.stage ? ' · 진행 중' : ''}</span>
          <span class="muted">{c.apps}경기 {c.g}골</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

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

{#if feed.length}
  <section class="card">
    <div class="eyebrow">Timeline</div>
    <h2 style="margin-bottom:6px">최근 소식</h2>
    <div class="feed">
      {#each feedAll ? feed : feed.slice(0, FEED_SHORT) as l, i (i)}
        <div><time>{l.t}</time><span class={l.kind}>{l.text}</span></div>
      {/each}
    </div>
    {#if feed.length > FEED_SHORT}
      <button class="icon-btn" style="margin-top:8px" data-act="feed-more" aria-expanded={feedAll} onclick={() => (feedAll = !feedAll)}>{feedAll ? '접기' : '더 보기'}</button>
    {/if}
  </section>
{/if}

<div class="advance-go">
  {#if s.pending}
    <button class="btn btn-block btn-accent" data-act="resume" onclick={onPending}>{pendingLabel} →</button>
  {:else}
    <p class="muted fs-sm">훈련 <b>{picked ? trainingLabel(s, picked) : '-'}</b> · 자기 투자 <b>{invest.label}</b></p>
    <button class="btn btn-block btn-primary" data-act="advance" onclick={onAdvance}>{btnLabel} →</button>
  {/if}
</div>
