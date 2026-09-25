<script lang="ts">
  // T-10-005 명예의 전당: '전체'(모든 유저 · 서버) / '내 선수'. 행을 누르면 상세로.
  // T-10-013 '내 선수'는 계정에 연결돼 있으면 계정 기록(서버), 아니면 이 기기 기록(ft_hof)이다.
  // 서버에는 선수 이름이 없어(공개를 고른 경우만) 같은 기기의 기록이 있으면 그 이름·공개 설정을 쓴다.
  import type { PublicHofEntry } from '@offside/contracts';
  import { POS } from '../game/data.js';
  import { loadHOF } from '../game/season.js';
  import type { HofEntry } from '../game/types.js';
  import { getHof, getMyCareers } from '../api/client.js';
  import { anonName, openLocalLegend, openPublicLegend } from './legend.js';

  type Tab = 'all' | 'mine';
  type Pos = keyof typeof POS;
  type RowStats = Pick<PublicHofEntry, 'apps' | 'goals' | 'assists' | 'trophies' | 'peak' | 'ballon'>;
  type MineRow = { key: string; name: string; pos: Pos; tag: string | null; stats: RowStats; score: number; open: () => void };
  const local = loadHOF();
  let tab = $state<Tab>('all');
  let all = $state<PublicHofEntry[] | null>(null);
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
    score: h.score,
    open: () => openLocalLegend(h),
  });
  const serverRow = (e: PublicHofEntry): MineRow => ({
    key: e.id,
    name: e.name ?? anonName(e.pos, e.number),
    pos: e.pos,
    tag: e.name ? '공개' : null,
    stats: e,
    score: e.legendScore,
    open: () => void openPublicLegend(e),
  });
  const deviceRows = local.slice(0, 30).map(localRow);

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
    ].sort((a, b) => b.score - a.score);
    source = 'account';
  }

  function pickTab(t: Tab) {
    tab = t;
    if (t === 'mine' && source === 'idle') void loadMine();
  }

  $effect(() => {
    void getHof(50).then((r) => {
      if (r.ok) all = r.data.entries;
      else failed = true;
    });
  });

  const myIds = new Set(local.map((h) => h.id).filter(Boolean));
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
    <button class="opt" aria-pressed={tab === 'all'} data-hof-tab="all" onclick={() => pickTab('all')}>전체</button>
    <button class="opt" aria-pressed={tab === 'mine'} data-hof-tab="mine" onclick={() => pickTab('mine')}>내 선수</button>
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
  {:else if source === 'loading' || source === 'idle'}
    <p class="empty">불러오는 중…</p>
  {:else}
    {@const rows = source === 'account' ? accountRows : deviceRows}
    <p class="muted hof-source" data-hof-source={source}>
      {source === 'account'
        ? '계정에 기록된 선수예요. 다른 기기에서도 똑같이 보여요.'
        : source === 'offline'
          ? '서버에 연결하지 못해 이 기기에 저장된 선수를 보여 줘요.'
          : '이 기기에 저장된 선수예요. 구글 계정을 연결하면 계정에 모아 볼 수 있어요.'}
    </p>
    {#each rows as r, i (r.key)}
      <button class="hof-row" data-hof-mine={i} onclick={r.open}>
        {@render row(i, r.name, r.pos, r.tag, r.stats, r.score)}
      </button>
    {:else}
      <p class="empty">아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.</p>
    {/each}
  {/if}
</section>
