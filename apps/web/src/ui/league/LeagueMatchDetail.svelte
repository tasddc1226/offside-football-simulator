<script lang="ts">
  // T-11-418b 리그 경기 상세 — 스코어와 득점 기록, 처음 열면 문자중계부터. 컵 경기 상세와 같은 모양이고 리그는 홈 경기라
  // 중계에 홈 · 원정을 그대로 둔다. 선수 이름은 서버가 준 공개 이름 · 익명 표기 그대로다.
  import { onMount } from 'svelte';
  import { fetchLeagueMatch, type LeagueMatch, type LeagueMatchResponse, type LeagueTableResponse } from '@offside/app-core/api/league';
  import { cupText as C } from '@offside/app-core/i18n/ko/cup';
  import { leagueText as L } from '@offside/app-core/i18n/ko/league';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { cupLiveMatch, firstLive } from '@offside/app-core/teamLive';
  import { teamMatchText as TM } from '@offside/app-core/i18n/ko/teamMatch';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import TeamLive from '../team/TeamLive.svelte';
  import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
  import { matchArticle } from '@offside/app-core/leagueNews';
  import { accountCache } from '../account-state.svelte.js';
  import { isMember } from '@offside/app-core/account';
  import { shareToLounge } from '../team/loungeShare.js';

  let { season, m, table, mineId, onback }: { season: number; m: LeagueMatch; table: LeagueTableResponse; mineId: string | null; onback: () => void } = $props();

  let status = $state<LoadStatus>('loading');
  let detail = $state<LeagueMatchResponse | null>(null);
  let live = $state(false);
  const keep = (_: string | null, fallback: string) => fallback;
  const owners = $derived(new Map(table.teams.map((t) => [t.teamId, t.owner])));

  async function load() {
    status = 'loading';
    const r = await fetchLeagueMatch(season, m.id);
    if (!r.ok) return (status = 'error');
    detail = r.data;
    live = firstLive(m.id);
    status = 'ready';
  }
  onMount(() => void load());
  const linked = $derived.by(() => {
    const acct = accountCache.value;
    return !!acct && acct !== 'error' && isMember(acct);
  });
  let sharing = $state(false);
  async function share() {
    if (sharing) return;
    sharing = true;
    await shareToLounge({ kind: 'leagueMatch', season, matchId: m.id });
    sharing = false;
  }
  const mineSide = $derived(m.homeTeamId === mineId ? 'home' : m.awayTeamId === mineId ? 'away' : null);
</script>

<button class="btn btn-sm self-start" data-act="league-detail-back" onclick={onback}>{L.detailBack}</button>
<LoadState {status} failText={C.detailFail} retry={load}>
  {#if detail && live}
    {@const v = cupLiveMatch(detail.match, mineId)}
    <TeamLive match={v.match} neutral={v.neutral} name={keep} onend={() => ((live = false), window.scrollTo(0, 0))} />
  {:else if detail}
    {@const d = detail.match}
    {@const article = matchArticle(d)}
    <section class="card stack lmd" style="gap:14px" data-league-detail={m.id}>
      <div>
        <div class="eyebrow">Offside League</div>
        <h1>{L.detailTitle({ tier: detail.league.tier, league: detail.league.league, round: detail.league.round })}</h1>
      </div>
      <div class="lmd-score">
        <div class="lmd-side" class:mine={mineSide === 'home'}>
          <TeamLogo logo={d.home.logo} name={d.home.name} size={40} decorative />
          <b>{d.home.name}</b><small class="muted">{owners.get(d.home.teamId) ?? d.home.owner} · OVR {d.home.ovr}</small>
        </div>
        <div class="lmd-goals"><b>{d.home.goals}</b><span aria-hidden="true">:</span><b>{d.away.goals}</b></div>
        <div class="lmd-side away" class:mine={mineSide === 'away'}>
          <TeamLogo logo={d.away.logo} name={d.away.name} size={40} decorative />
          <b>{d.away.name}</b><small class="muted">{owners.get(d.away.teamId) ?? d.away.owner} · OVR {d.away.ovr}</small>
        </div>
      </div>
      <article class="lmd-article" data-league-article>
        <small class="eyebrow">{N.articleTitle}</small>
        <h2>{article.head}</h2>
        {#each article.body as line (line)}<p class="fs-sm">{line}</p>{/each}
      </article>
      {#if d.events.length}
        <ol class="lmd-events">
          {#each d.events as e, k (k)}
            <li class:away={e.side === 'away'}>
              <span class="lmd-min">{e.minute}'</span>
              <span><b>{e.scorer}</b>{#if e.assist}<small class="muted">{C.assist({ name: e.assist })}</small>{/if}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="muted">{C.noGoals}</p>
      {/if}
      <p class="muted fs-sm">{kstMonthDayTime(d.createdAt)}</p>
      <div class="lmd-acts">
        <button class="btn" data-act="league-replay" onclick={() => (live = true)}>{TM.replay}</button>
        {#if linked && !detail.league.forfeit}<button class="btn" data-act="league-article-share" disabled={sharing} aria-label={N.shareAria({ home: d.home.name, away: d.away.name })} onclick={() => void share()}>{N.shareAct}</button>{/if}
      </div>
    </section>
  {/if}
</LoadState>

<style>
  .lmd-article { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-left: 3px solid var(--accent); background: var(--surface-2, transparent); border-radius: var(--radius-sm, 8px); }
  .lmd-article h2, .lmd-article p { margin: 0; }
  .lmd-article h2 { font-size: 1.1rem; line-height: 1.35; }
  .lmd-article p { line-height: 1.55; }
  .lmd-acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .lmd-score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; }
  .lmd-side { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .lmd-side.away { text-align: right; align-items: flex-end; }
  .lmd-side.mine b { color: var(--accent-text); }
  .lmd-goals { display: flex; gap: 8px; font-family: var(--display); font-size: 2.5rem; font-weight: 700; line-height: 1; }
  .lmd-events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .lmd-events li { display: flex; gap: 10px; align-items: baseline; }
  .lmd-events li.away { flex-direction: row-reverse; text-align: right; }
  .lmd-events li > span:last-child { display: flex; flex-direction: column; }
  .lmd-min { flex: none; font-family: var(--display); font-weight: 700; color: var(--muted); min-width: 2.2em; }
</style>
