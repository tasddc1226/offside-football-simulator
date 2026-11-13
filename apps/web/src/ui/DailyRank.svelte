<script lang="ts">
  // T-11-723 오늘의 랭킹(기록실 탭). 오늘(한국 시각) 은퇴한 선수의 레전드 점수 순위와 어제 1 · 2 · 3위. 자정에 순위가 굳고
  // 1 · 2 · 3위 카드에 표식이 남는다. 탭을 열 때만 부르고 메모(60초)를 거친다.
  import type { DailyRankResponse, PublicHofEntry } from '@offside/contracts';
  import { DAILY_RANK_REWARDS, dailyRankOpen, dailyRankStart, DAILY_RANK_FIRST_DAY } from '@offside/contracts/daily-rank';
  import { getDailyRank } from '@offside/app-core/api/client';
  import { kstMonthDayHour } from '@offside/app-core/boardText';
  import { playerName } from '@offside/app-core/format';
  import { raiserLabel } from '@offside/app-core/hofRaiser';
  import { hofText as L } from '@offside/app-core/i18n/ko/hof';
  import { loadHOF } from '@offside/game/hof-store';
  import HofRow from './HofRow.svelte';
  import LoadState from './LoadState.svelte';
  import { openPublicLegend } from './openLegend.js';

  let data = $state<DailyRankResponse | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  async function load() {
    status = 'loading';
    const res = await getDailyRank();
    if (res.ok) {
      data = res.data;
      status = 'ready';
    } else status = 'error';
  }
  $effect(() => void load());

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  const reward = L.dailyReward({
    scout: DAILY_RANK_REWARDS[0]!.scout,
    reroll: DAILY_RANK_REWARDS[0]!.reroll,
    rest: DAILY_RANK_REWARDS[1]!.reroll,
  });
</script>

{#snippet row(h: PublicHofEntry, rank: number)}
  {@const t = { ...h, score: h.legendScore }}
  <button class="hof-row" data-hof-id={h.id} onclick={() => void openPublicLegend(h)}>
    <HofRow
      {rank}
      name={playerName(h.name, h.pos, h.number)}
      pos={h.pos}
      dpos={h.dpos}
      nation={h.nation}
      club={h.lastClub}
      clubId={h.lastClubId}
      showClub
      shortPos
      retireAge={h.retireAge}
      rn={h.retiredNumber?.number}
      wall={h.wallOfHonor ? h.number : null}
      tag={myIds.has(h.id) ? L.mine : null}
      owner={raiserLabel(h.raiser)}
      {t}
      titleId={h.title}
      compact
    />
  </button>
{/snippet}

<section class="card stack" style="gap:12px" data-daily-rank>
  <div>
    <div class="eyebrow">Daily</div>
    <h2>{L.dailyTitle}</h2>
  </div>
  <p class="muted fs-sm dr-p">{L.dailyLead}</p>
  <p class="muted fs-sm dr-p" data-daily-reward>{reward}</p>
  <LoadState {status} rows={6} failText={L.dailyFailed} retry={() => void load()}>
    {#if data && !dailyRankOpen(data.day)}
      <p class="empty" data-daily-opens>{L.dailyOpens({ when: kstMonthDayHour(dailyRankStart(DAILY_RANK_FIRST_DAY)) })}</p>
    {:else if data}
      <p class="dr-state">
        <span class="pill" data-daily-count>{L.dailyCount({ n: data.entries.length })}</span>
        <span class="muted fs-sm" data-daily-reset>{L.dailyReset({ when: kstMonthDayHour(data.resetAt) })}</span>
      </p>
      {#if data.entries.length}
        <div class="hof-list-head"><span>{L.listHead}</span><span>{L.sortScore}</span></div>
        <ol class="hof-ranking-list" data-daily-list>
          {#each data.entries as h, i (h.id)}
            <li>{@render row(h, i)}</li>
          {/each}
        </ol>
      {:else}
        <p class="empty" data-daily-empty>{L.dailyEmpty}</p>
      {/if}
      {#if data.yesterday}
        <div class="dr-yesterday" data-daily-yesterday>
          <h3>{L.dailyYesterday}</h3>
          <ol class="hof-ranking-list">
            {#each data.yesterday.winners as w (w.entry.id)}
              <li>{@render row(w.entry, w.rank - 1)}</li>
            {/each}
          </ol>
        </div>
      {/if}
    {/if}
  </LoadState>
</section>

<style>
  .dr-p {
    margin: 0;
  }
  .dr-state {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dr-yesterday {
    margin-top: 6px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .dr-yesterday h3 {
    margin: 0 0 6px;
    font-size: var(--fs-body);
  }
</style>
