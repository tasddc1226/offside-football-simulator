<script lang="ts">
  // T-10-005 명예의 전당: 모든 유저의 은퇴 선수(서버). 행을 누르면 상세로. 이 기기에서 은퇴한 선수에는
  // '내 선수' 표시를 단다. 내 선수 목록은 구단주 화면으로 옮겼다(T-10-058, MyPlayers).
  // 홈에서는 레전드 점수 TOP 3만 보여 주고, '전체 보기'(full)에서는 순위 유형(득점·도움·발롱도르…)을 골라
  // 100명씩 페이지로 나눠 보여 준다. score가 아닌 유형은 그 기록이 0인 선수를 뺀다(서버와 같은 규칙).
  import type { HofSort, PublicHofEntry } from '@offside/contracts';
  import { loadHOF } from '../game/season.js';
  import { getHof } from '../api/client.js';
  import { openPublicLegend } from './legend.js';
  import { anonName } from './format.js';
  import { openHof } from './nav.js';
  import HofRow, { type RowStats } from './HofRow.svelte';
  import { appState } from './state.svelte.js';

  let { full = false }: { full?: boolean } = $props();
  const TOP = 3;
  const PER_PAGE = 100;

  const SORTS: Record<HofSort, { label: string; unit: string; get: (s: RowStats) => number }> = {
    score: { label: '레전드 점수', unit: '', get: (s) => s.score },
    goals: { label: '득점', unit: '골', get: (s) => s.goals },
    assists: { label: '도움', unit: '도움', get: (s) => s.assists },
    ga: { label: '공격포인트', unit: 'P', get: (s) => s.goals + s.assists },
    apps: { label: '출전', unit: '경기', get: (s) => s.apps },
    trophies: { label: '트로피', unit: '개', get: (s) => s.trophies },
    awards: { label: '개인상', unit: '회', get: (s) => s.awards },
    ballon: { label: '발롱도르', unit: '회', get: (s) => s.ballon },
    caps: { label: 'A매치', unit: '경기', get: (s) => s.caps },
    peak: { label: '최고 OVR', unit: '', get: (s) => s.peak },
  };
  const SORT_KEYS = Object.keys(SORTS) as HofSort[];
  // 전체 보기의 페이지·유형은 appState에 둬 선수 상세에서 돌아와도 그대로다.
  const page = $derived(full ? appState.hof.page : 1);
  const sort = $derived<HofSort>(full ? appState.hof.sort : 'score');
  const by = $derived(SORTS[sort]);
  let all = $state<PublicHofEntry[] | null>(null);
  let total = $state(0);
  let failed = $state(false);

  function pickSort(s: HofSort) {
    appState.hof = { ...appState.hof, sort: s, page: 1 };
  }
  function goPage(p: number) {
    appState.hof.page = p;
    window.scrollTo(0, 0);
  }

  $effect(() => {
    const [p, s] = [page, sort];
    all = null;
    failed = false;
    void getHof(full ? PER_PAGE : TOP, p, s).then((r) => {
      if (p !== page || s !== sort) return; // 더 늦게 고른 페이지·유형의 응답만 쓴다.
      if (r.ok) {
        all = r.data.entries;
        total = r.data.total ?? r.data.entries.length;
      } else failed = true;
    });
  });

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  const offset = $derived((page - 1) * PER_PAGE);
  const pages = $derived(Math.max(1, Math.ceil(total / PER_PAGE)));
  const emptyText = $derived(
    sort === 'score' ? '아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.' : `아직 ${by.label} 기록이 있는 은퇴 선수가 없습니다.`,
  );
</script>

{#snippet pager()}
  {#if full && pages > 1}
    <nav class="hof-pager" aria-label="명예의 전당 페이지">
      <button class="icon-btn" data-hof-page="prev" disabled={page <= 1} onclick={() => goPage(page - 1)}>← 이전</button>
      <span class="num" aria-live="polite">{page} / {pages}</span>
      <button class="icon-btn" data-hof-page="next" disabled={page >= pages} onclick={() => goPage(page + 1)}>다음 →</button>
    </nav>
  {/if}
{/snippet}

<section class="card" data-hof={full ? 'full' : 'home'}>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <div>
      <div class="eyebrow">Legends</div>
      {#if full}<h1 style="margin-bottom:8px">명예의 전당</h1>{:else}<h2 style="margin-bottom:8px">명예의 전당</h2>{/if}
    </div>
    {#if !full && all?.length}
      <button class="icon-btn" data-act="hof-all" onclick={openHof}>전체 보기</button>
    {/if}
  </div>
  {#if full}
    <div class="hof-sorts" role="group" aria-label="순위 유형">
      {#each SORT_KEYS as k (k)}
        <button class="hof-sort" aria-pressed={sort === k} data-hof-sort={k} onclick={() => pickSort(k)}>{SORTS[k].label}</button>
      {/each}
    </div>
  {/if}

  {#if all === null && !failed}
    <p class="empty">불러오는 중…</p>
  {:else if failed}
    <p class="empty">명예의 전당을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
  {:else if all && all.length}
    {#if full}<p class="muted hof-source">{sort === 'score' ? '은퇴 선수' : `${by.label} 기록이 있는 선수`} {total}명 · {by.label} 순</p>{/if}
    {#each all as h, i (h.id)}
      {@const t = { ...h, score: h.legendScore }}
      <button class="hof-row" data-hof-id={h.id} onclick={() => void openPublicLegend(h)}>
        <HofRow
          rank={offset + i}
          name={h.name ?? anonName(h.pos, h.number)}
          pos={h.pos}
          tag={myIds.has(h.id) ? '내 선수' : null}
          {t}
          titleId={h.title}
          value={by.get(t)}
          unit={by.unit}
          showScore={sort !== 'score'}
        />
      </button>
    {/each}
    {@render pager()}
  {:else}
    <p class="empty">{emptyText}</p>
  {/if}
</section>
