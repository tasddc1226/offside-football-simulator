<script lang="ts" module>
  // 구단별·최신순 선택은 선수 상세에 다녀와도 그대로 둔다(화면이 다시 그려져도 모듈 값은 남는다).
  const view = $state<{ order: 'club' | 'recent' }>({ order: 'club' });
</script>

<script lang="ts">
  // T-10-076 기록실 '영구결번' 탭 — 서버의 모든 결번을 구단별(결번 많은 구단 먼저) 또는 최신순으로 본다.
  // 유니폼은 구단 엠블럼 색(rnStyle), 누르면 그 선수의 은퇴 상세.
  import type { RetiredNumbersResponse } from '@offside/contracts';
  import { LEAGUE_BASE } from '@offside/contracts/club-names';
  import { getRetiredNumbers } from '../api/client.js';
  import { POS } from '../game/data.js';
  import { loadHOF } from '../game/season.js';
  import ClubMark from './ClubMark.svelte';
  import { anonName } from './format.js';
  import { openPublicLegendById } from './legend.js';
  import { RN_SHIRT, RN_TRIM, rnStyle } from './rnStyle.js';

  type Item = RetiredNumbersResponse['items'][number];

  let items = $state<Item[] | null>(null);
  let failed = $state(false);
  void getRetiredNumbers().then((r) => {
    if (r.ok) items = r.data.items;
    else failed = true;
  });

  const myIds = new Set(loadHOF().map((h) => h.id).filter(Boolean));
  const leagueOf = (clubId: string) =>
    LEAGUE_BASE.find((l) => l.id === clubId.slice(0, clubId.lastIndexOf('-')))?.name ?? '';
  const day = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  /** 구단별 — 결번이 많은 구단 먼저, 같으면 먼저 결번을 낸 구단. 구단 안에서는 번호 순. */
  const clubs = $derived.by(() => {
    const by: Record<string, Item[]> = {};
    for (const it of items ?? []) (by[it.clubId] ??= []).push(it);
    return Object.values(by)
      .map((list) => list.sort((a, b) => a.number - b.number))
      .sort(
        (a, b) =>
          b.length - a.length ||
          Math.min(...a.map((x) => x.seq)) - Math.min(...b.map((x) => x.seq)),
      );
  });
  const recent = $derived([...(items ?? [])].sort((a, b) => b.seq - a.seq));
</script>

{#snippet tile(it: Item, withClub: boolean)}
  <button class="rn-tile" style={rnStyle(it.clubId)} data-rn-tile={it.seq} onclick={() => void openPublicLegendById(it.careerId)}>
    <svg class="rn-jersey rn-tile-shirt" viewBox="0 0 120 124" aria-hidden="true">
      <path class="rn-shirt" d={RN_SHIRT} />
      <path class="rn-trim" d={RN_TRIM} />
      <text class="rn-jersey-num" x="60" y="92">{it.number}</text>
    </svg>
    <b class="rn-tile-name">{it.name ?? anonName(it.pos, it.number)}</b>
    <span class="muted fs-xs">
      {#if withClub}<ClubMark name={it.club} id={it.clubId} size={14} /> {it.club}{:else}{POS[it.pos].label}{/if}
    </span>
    <span class="muted fs-xs num">{it.seq}번째 · {day(it.grantedAt)}</span>
    {#if myIds.has(it.careerId)}<span class="pill rn-tile-mine">내 선수</span>{/if}
  </button>
{/snippet}

<section class="card" data-rn-wall>
  <div class="eyebrow">Retired Numbers</div>
  <h1 style="margin-bottom:6px">영구결번</h1>
  <p class="muted fs-sm rn-wall-lead">한 구단에서 오래, 크게 빛난 선수의 등번호는 그 구단에서 다시 쓰지 않습니다. 구단마다 한 번호에 한 명뿐입니다.</p>

  {#if items === null && !failed}
    <p class="empty">불러오는 중…</p>
  {:else if failed}
    <p class="empty">영구결번을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
  {:else if items?.length}
    <div class="rn-wall-sum">
      <div><b class="num">{items.length}</b><small>결번</small></div>
      <div><b class="num">{clubs.length}</b><small>구단</small></div>
      <div><b class="num">{day(recent[0]!.grantedAt)}</b><small>최근 결번</small></div>
    </div>
    <div class="hof-sorts" role="group" aria-label="정렬">
      <button class="hof-sort" aria-pressed={view.order === 'club'} data-rn-order="club" onclick={() => (view.order = 'club')}>구단별</button>
      <button class="hof-sort" aria-pressed={view.order === 'recent'} data-rn-order="recent" onclick={() => (view.order = 'recent')}>최신순</button>
    </div>
    {#if view.order === 'club'}
      {#each clubs as list (list[0]!.clubId)}
        {@const c = list[0]!}
        <div class="rn-club" data-rn-club={c.clubId}>
          <div class="rn-club-head">
            <ClubMark name={c.club} id={c.clubId} size={22} />
            <b>{c.club}</b>
            <span class="muted fs-xs">{leagueOf(c.clubId)}</span>
            <span class="num rn-club-count">{list.length}</span>
          </div>
          <div class="rn-tiles">
            {#each list as it (it.seq)}{@render tile(it, false)}{/each}
          </div>
        </div>
      {/each}
    {:else}
      <div class="rn-tiles">
        {#each recent as it (it.seq)}{@render tile(it, true)}{/each}
      </div>
    {/if}
  {:else}
    <p class="empty">아직 영구결번이 없습니다. 한 구단의 전설이 되어 첫 번째 결번의 주인공이 되어 보세요.</p>
  {/if}
</section>
