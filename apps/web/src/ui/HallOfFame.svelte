<script lang="ts">
  // T-10-005 명예의 전당: '전체'(모든 유저 · 서버) / '내 선수'(이 기기 · ft_hof). 행을 누르면 상세로.
  import type { PublicHofEntry } from '@offside/contracts';
  import { POS } from '../game/data.js';
  import { loadHOF } from '../game/season.js';
  import { getHof } from '../api/client.js';
  import { anonName, openLocalLegend, openPublicLegend } from './legend.js';

  type Tab = 'all' | 'mine';
  type Pos = keyof typeof POS;
  type RowStats = Pick<PublicHofEntry, 'apps' | 'goals' | 'assists' | 'trophies' | 'peak' | 'ballon'>;
  const mine = loadHOF();
  let tab = $state<Tab>('all');
  let all = $state<PublicHofEntry[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    void getHof(50).then((r) => {
      if (r.ok) all = r.data.entries;
      else failed = true;
    });
  });

  const myIds = new Set(mine.map((h) => h.id).filter(Boolean));
</script>

{#snippet row(i: number, name: string, pos: Pos, tag: string | null, t: RowStats, score: number)}
  <div class="hof-rank">{i + 1}</div>
  <div>
    <b>{name}</b> <span class="pill">{POS[pos].label}</span>
    {#if tag}<span class="pill">{tag}</span>{/if}
    <div class="muted" style="font-size:12px">{t.apps}경기 {t.goals}골 {t.assists}도움 · 트로피 {t.trophies} · 최고 OVR {t.peak}{t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}</div>
  </div>
  <div class="num" style="font-size:22px;font-weight:700">{score}</div>
{/snippet}

<section class="card">
  <div class="eyebrow">Legends</div>
  <h2 style="margin-bottom:8px">명예의 전당</h2>
  <div class="seg hof-tabs">
    <button class="opt" aria-pressed={tab === 'all'} data-hof-tab="all" onclick={() => (tab = 'all')}>전체</button>
    <button class="opt" aria-pressed={tab === 'mine'} data-hof-tab="mine" onclick={() => (tab = 'mine')}>내 선수</button>
  </div>

  {#if tab === 'all'}
    {#if all === null && !failed}
      <p class="empty">불러오는 중…</p>
    {:else if failed}
      <p class="empty">전체 명예의 전당을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
    {:else if all && all.length}
      {#each all as h, i (h.id)}
        <button class="hof-row" data-hof-id={h.id} onclick={() => void openPublicLegend(h)}>
          {@render row(i, h.name ?? anonName(h.pos, h.number), h.pos, myIds.has(h.id) ? '내 선수' : null, h, h.legendScore)}
        </button>
      {/each}
    {:else}
      <p class="empty">아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.</p>
    {/if}
  {:else if mine.length}
    {#each mine.slice(0, 30) as h, i (h.id ?? h.name + i)}
      <button class="hof-row" data-hof-mine={i} onclick={() => openLocalLegend(h)}>
        {@render row(i, h.name, h.pos, h.public ? '공개' : null, h, h.score)}
      </button>
    {/each}
  {:else}
    <p class="empty">아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.</p>
  {/if}
</section>
