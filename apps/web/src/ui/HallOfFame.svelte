<script lang="ts">
  // T-10-005 명예의 전당: '전체'(모든 유저 · 서버) / '내 선수'. 행을 누르면 상세로.
  // T-10-013 '내 선수'는 계정에 연결돼 있으면 계정 기록(서버), 아니면 이 기기 기록(ft_hof)이다.
  // 서버에는 선수 이름이 없어(공개를 고른 경우만) 같은 기기의 기록이 있으면 그 이름·공개 설정을 쓴다.
  // 홈에서는 레전드 점수 TOP 3만 보여 주고, '전체 보기'(full)에서는 순위 유형(득점·도움·발롱도르…)을 골라
  // 100명씩 페이지로 나눠 보여 준다. score가 아닌 유형은 그 기록이 0인 선수를 뺀다(서버와 같은 규칙).
  import TitleTag from './titles/TitleTag.svelte';
  import { titleById } from '../game/titles.js';
  import type { HofSort, PublicHofEntry } from '@offside/contracts';
  import { POS } from '../game/data.js';
  import { loadHOF } from '../game/season.js';
  import type { HofEntry } from '../game/types.js';
  import { getHof, getMyCareers } from '../api/client.js';
  import { openLocalLegend, openPublicLegend } from './legend.js';
  import { anonName } from './format.js';
  import { openHof } from './nav.js';
  import Laurel from './Laurel.svelte';
  import { appState, type HofTab } from './state.svelte.js';

  let { full = false }: { full?: boolean } = $props();
  const TOP = 3;
  const PER_PAGE = 100;
  const MEDAL = ['gold', 'silver', 'bronze'];

  type Pos = keyof typeof POS;
  type RowStats = Pick<PublicHofEntry, 'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'peak' | 'ballon'> & { score: number };
  type MineRow = { key: string; name: string; pos: Pos; tag: string | null; stats: RowStats; title: string | null; open: () => void };
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
  const local = loadHOF();
  // 전체 보기의 탭·페이지는 appState에 둬 선수 상세에서 돌아와도 그대로다.
  let homeTab = $state<HofTab>('all');
  const tab = $derived(full ? appState.hof.tab : homeTab);
  const page = $derived(full ? appState.hof.page : 1);
  const sort = $derived<HofSort>(full ? appState.hof.sort : 'score');
  const by = $derived(SORTS[sort]);
  let all = $state<PublicHofEntry[] | null>(null);
  let total = $state(0);
  let failed = $state(false);
  /** '내 선수' 출처. idle이면 아직 탭을 열지 않았다. */
  let source = $state<'idle' | 'loading' | 'account' | 'device' | 'offline'>('idle');
  let accountRows = $state<MineRow[]>([]);

  const localRow = (h: HofEntry, i: number): MineRow => ({
    key: h.id ?? h.name + i,
    name: h.name,
    pos: h.pos,
    tag: h.public ? '공개' : null,
    stats: h,
    title: h.title ?? null,
    open: () => openLocalLegend(h),
  });
  const serverRow = (e: PublicHofEntry): MineRow => ({
    key: e.id,
    name: e.name ?? anonName(e.pos, e.number),
    pos: e.pos,
    tag: e.name ? '공개' : null,
    stats: { ...e, score: e.legendScore },
    title: e.title ?? null,
    open: () => void openPublicLegend(e),
  });
  const deviceRows = local.map(localRow);

  async function loadMine() {
    source = 'loading';
    const [r, outbox] = await Promise.all([getMyCareers(), import('../game/outbox.js')]);
    if (!r.ok || !r.data.linked) {
      source = !r.ok && r.error.code === 'NETWORK_ERROR' ? 'offline' : 'device';
      return;
    }
    const onServer = new Set(r.data.entries.map((e) => e.id));
    const byId = new Map(local.flatMap((h, i) => (h.id ? [[h.id, localRow(h, i)] as const] : [])));
    // 방금 은퇴해 아직 업로드 대기 중인 선수도 잠깐 더한다.
    const pending = outbox.pendingRetirementIds();
    accountRows = [
      ...r.data.entries.map((e) => byId.get(e.id) ?? serverRow(e)),
      ...[...byId].filter(([id]) => !onServer.has(id) && pending.has(id)).map(([, row]) => row),
    ];
    source = 'account';
  }

  function pickTab(t: HofTab) {
    if (full) appState.hof = { ...appState.hof, tab: t, page: 1 };
    else homeTab = t;
  }
  function pickSort(s: HofSort) {
    appState.hof = { ...appState.hof, sort: s, page: 1 };
  }
  function goPage(p: number) {
    appState.hof.page = p;
    window.scrollTo(0, 0);
  }

  $effect(() => {
    if (tab === 'mine' && source === 'idle') void loadMine();
  });

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

  const myIds = new Set(local.map((h) => h.id).filter(Boolean));
  const mineAll = $derived(
    (source === 'account' ? accountRows : deviceRows)
      .filter((r) => sort === 'score' || by.get(r.stats) > 0)
      .sort((a, b) => by.get(b.stats) - by.get(a.stats) || b.stats.score - a.stats.score),
  );
  const offset = $derived((page - 1) * PER_PAGE);
  const mineShown = $derived(full ? mineAll.slice(offset, offset + PER_PAGE) : mineAll.slice(0, TOP));
  const pages = $derived(Math.max(1, Math.ceil((tab === 'all' ? total : mineAll.length) / PER_PAGE)));
  const emptyText = $derived(
    sort === 'score' ? '아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.' : `아직 ${by.label} 기록이 있는 은퇴 선수가 없습니다.`,
  );
  const hasRows = $derived(tab === 'all' ? !!all?.length : source !== 'idle' && source !== 'loading' && mineAll.length > 0);
</script>

{#snippet row(i: number, name: string, pos: Pos, tag: string | null, t: RowStats, titleId: string | null | undefined)}
  {@const tt = titleById(titleId)}
  {#if i < MEDAL.length}
    <div class="hof-rank medal {MEDAL[i]}"><Laurel /><span>{i + 1}</span></div>
  {:else}
    <div class="hof-rank">{i + 1}</div>
  {/if}
  <div>
    <b>{name}</b> <span class="pill">{POS[pos].label}</span>
    {#if tag}<span class="pill">{tag}</span>{/if}
    {#if tt}<TitleTag name={tt.name} rarity={tt.rarity} />{/if}
    <div class="muted" style="font-size:12px">{t.apps}경기 {t.goals}골 {t.assists}도움 · 트로피 {t.trophies} · 최고 OVR {t.peak}{t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}{sort !== 'score' ? ` · 레전드 ${t.score}` : ''}</div>
  </div>
  <div class="num hof-value">{by.get(t)}{#if by.unit}<small>{by.unit}</small>{/if}</div>
{/snippet}

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
    {#if !full && hasRows}
      <button class="icon-btn" data-act="hof-all" onclick={() => openHof(tab)}>전체 보기</button>
    {/if}
  </div>
  <div class="seg hof-tabs">
    <button class="opt" aria-pressed={tab === 'all'} data-hof-tab="all" onclick={() => pickTab('all')}>전체</button>
    <button class="opt" aria-pressed={tab === 'mine'} data-hof-tab="mine" onclick={() => pickTab('mine')}>내 선수</button>
  </div>
  {#if full}
    <div class="hof-sorts" role="group" aria-label="순위 유형">
      {#each SORT_KEYS as k (k)}
        <button class="hof-sort" aria-pressed={sort === k} data-hof-sort={k} onclick={() => pickSort(k)}>{SORTS[k].label}</button>
      {/each}
    </div>
  {/if}

  {#if tab === 'all'}
    {#if all === null && !failed}
      <p class="empty">불러오는 중…</p>
    {:else if failed}
      <p class="empty">전체 명예의 전당을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
    {:else if all && all.length}
      {#if full}<p class="muted hof-source">{sort === 'score' ? '은퇴 선수' : `${by.label} 기록이 있는 선수`} {total}명 · {by.label} 순</p>{/if}
      {#each all as h, i (h.id)}
        <button class="hof-row" data-hof-id={h.id} onclick={() => void openPublicLegend(h)}>
          {@render row(offset + i, h.name ?? anonName(h.pos, h.number), h.pos, myIds.has(h.id) ? '내 선수' : null, { ...h, score: h.legendScore }, h.title)}
        </button>
      {/each}
      {@render pager()}
    {:else}
      <p class="empty">{emptyText}</p>
    {/if}
  {:else if source === 'loading' || source === 'idle'}
    <p class="empty">불러오는 중…</p>
  {:else}
    <p class="muted hof-source" data-hof-source={source}>
      {source === 'account'
        ? '계정에 기록된 선수예요. 다른 기기에서도 똑같이 보여요.'
        : source === 'offline'
          ? '서버에 연결하지 못해 이 기기에 저장된 선수를 보여 줘요.'
          : '이 기기에 저장된 선수예요. 구글 계정을 연결하면 계정에 모아 볼 수 있어요.'}
    </p>
    {#each mineShown as r, i (r.key)}
      <button class="hof-row" data-hof-mine={offset + i} onclick={r.open}>
        {@render row(offset + i, r.name, r.pos, r.tag, r.stats, r.title)}
      </button>
    {:else}
      <p class="empty">{emptyText}</p>
    {/each}
    {@render pager()}
  {/if}
</section>
