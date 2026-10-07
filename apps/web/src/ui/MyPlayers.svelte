<script lang="ts">
  // 구단주 화면의 '내 선수'(T-10-058 — 명예의 전당의 '내 선수' 탭을 옮겼다). 레전드 점수 순.
  // T-10-013: 계정에 연결돼 있으면 계정 기록(서버), 아니면 이 기기 기록(ft_hof)이다. 서버에는 선수 이름이
  // 없어(공개를 고른 경우만) 같은 기기의 기록이 있으면 그 이름·공개 설정을 쓴다.
  // T-11-029 시즌 탭(프리시즌 / 시즌 1…)으로 거른다 — 개막한 시즌이 둘 이상일 때만 보이고, 기본은 지금 시즌이다.
  import { onMount } from 'svelte';
  import type { PublicHofEntry } from '@offside/contracts';
  import { loadHOF } from '@offside/game/hof-store';
  import type { HofEntry } from '@offside/game/types';
  import { localCardValue, myPlayerNation } from '@offside/app-core/myPlayers';
  import { getMyCareers, getRetiredNumbersIn } from '@offside/app-core/api/client';
  import { deviceSeasonOf, emptySeasonText, myDefaultSeason, mySeasonOptions, serverSeasonOf } from '@offside/app-core/mySeason';
  import { fillGranted } from './retiredNumber.svelte.js';
  import { openLocalLegend, openPublicLegend } from './legend.js';
  import { playerName } from '@offside/app-core/format';
  import HofRow, { type RowStats } from './HofRow.svelte';
  import { seasonNow } from './seasonNow.svelte.js';
  import type { DetailPos, POS } from '@offside/game/data';
  import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
  import { seasonLabel } from '@offside/app-core/seasonName';

  /** T-11-026 구단주 화면이 요약(선수 수·점수 합·결번 수)을 세도록 불러온 목록을 알려 준다. T-11-029 고른 시즌 것만. */
  let { onrows }: { onrows?: (rows: readonly MineRow[]) => void } = $props();

  type MineRow = { nation?: string | undefined; key: string; name: string; pos: keyof typeof POS; dpos?: DetailPos | null | undefined; club: string; clubId?: string | null | undefined; rn?: number | null | undefined; tag: string | null; stats: RowStats; title: string | null; season: number; /** T-11-109 비로그인 구단 가치용 카드 기준가(이 기기 기록만). */ value?: number; open: () => void };
  /** 처음엔 이만큼만 보이고 '모두 보기'로 펼친다(T-11-026 구단주 화면 위쪽을 내 팀에 내주려 상위 3명만). */
  const SHOW = 3;

  const local = loadHOF();
  const now = new Date().toISOString();
  /** 업로드 대기 중인 은퇴 기록(onMount에서 채운다) — 시즌을 아직 못 받은 기록은 지금 시즌으로 센다. */
  let pendingIds: ReadonlySet<string> = new Set();
  const localRow = (h: HofEntry, i: number): MineRow => ({
    nation: myPlayerNation(h),
    key: h.id ?? h.name + i,
    name: h.name,
    pos: h.pos,
    dpos: h.dpos,
    club: h.lastClub,
    clubId: h.lastClubId,
    rn: h.rn?.kind === 'granted' ? h.rn.number : null,
    tag: h.public ? L.tagPublic : null,
    stats: h,
    title: h.title ?? null,
    season: deviceSeasonOf(h, pendingIds, now),
    value: localCardValue(h),
    open: () => openLocalLegend(h),
  });
  const serverRow = (e: PublicHofEntry): MineRow => ({
    nation: myPlayerNation(undefined, e),
    key: e.id,
    name: playerName(e.name, e.pos, e.number),
    pos: e.pos,
    dpos: e.dpos,
    club: e.lastClub,
    clubId: e.lastClubId,
    rn: e.retiredNumber?.number,
    tag: e.name ? L.tagPublic : null,
    stats: { ...e, score: e.legendScore },
    title: e.title ?? null,
    season: serverSeasonOf(e),
    open: () => void openPublicLegend(e),
  });

  let source = $state<'loading' | 'account' | 'device' | 'offline'>('loading');
  let rows = $state<MineRow[]>([]);
  let expanded = $state(false);
  // T-11-110 목록은 불러온 시각(now)으로, 시즌 탭·기본 시즌은 띄운 채 개막을 넘기면 다시 고른다.
  const clock = seasonNow();
  const seasons = $derived(mySeasonOptions(clock.now));
  let picked = $state<number | null>(null);
  const season = $derived(picked ?? myDefaultSeason(clock.now));
  const inSeason = $derived(seasons.length > 1 ? rows.filter((r) => r.season === season) : rows);
  const shown = $derived(expanded ? inSeason : inSeason.slice(0, SHOW));
  $effect(() => {
    if (source !== 'loading') onrows?.(inSeason);
  });

  onMount(async () => {
    const [r, outbox] = await Promise.all([getMyCareers(), import('../sync/outbox.js')]);
    pendingIds = outbox.pendingRetirementIds();
    let list: MineRow[];
    if (!r.ok || !r.data.linked) {
      source = !r.ok && r.error.code === 'NETWORK_ERROR' ? 'offline' : 'device';
      list = local.map(localRow);
    } else {
      const onServer = new Set(r.data.entries.map((e) => e.id));
      const byId = new Map(local.flatMap((h, i) => (h.id ? [[h.id, localRow(h, i)] as const] : [])));
      // 방금 은퇴해 아직 업로드 대기 중인 선수도 잠깐 더한다.
      const pending = outbox.pendingRetirementIds();
      list = [
        ...r.data.entries.map((e) => {
          const row = byId.get(e.id);
          // 이 기기 기록이 있어도 결번(T-10-076)은 서버 값을 쓴다 — 소급으로 받은 결번은 기기에 없다.
          return row ? { ...row, nation: myPlayerNation(row, e), rn: row.rn ?? e.retiredNumber?.number, season: serverSeasonOf(e) } : serverRow(e);
        }),
        ...[...byId].filter(([id]) => !onServer.has(id) && pending.has(id)).map(([, row]) => row),
      ];
      source = 'account';
    }
    rows = list.sort((a, b) => b.stats.score - a.stats.score);
    // T-10-076 배포 전 은퇴를 소급해 받은 결번은 이 기기에 없다 — 결과를 모르는 기록이 있을 때만 서버 목록에서 채운다
    // (계정 목록은 서버가 결번을 함께 준다).
    if (source === 'device' && local.some((h) => h.id && h.detail && h.rn === undefined)) {
      // T-11-029 결번은 시즌마다 따로 — 결과를 모르는 기록이 속한 시즌의 결번 목록을 받는다.
      const rn = await getRetiredNumbersIn(
        local.filter((h) => h.id && h.detail && h.rn === undefined).map((h) => deviceSeasonOf(h, pendingIds, now)),
      );
      if (!rn.ok) return;
      fillGranted(rn.data);
      const byCareer = new Map(rn.data.map((x) => [x.careerId, x.number]));
      rows = rows.map((r) => ({ ...r, rn: r.rn ?? byCareer.get(r.key) }));
    }
  });
</script>

<section class="card" data-my-players aria-labelledby="my-players-title">
  <div class="eyebrow">My players</div>
  <h2 id="my-players-title" style="margin-bottom:8px">{L.title}</h2>
  {#if source === 'loading'}
    <p class="empty">{L.loading}</p>
  {:else}
    <p class="muted hof-source" data-my-source={source}>
      {source === 'account'
        ? L.sourceAccount
        : source === 'offline'
          ? L.sourceOffline
          : L.sourceDeviceWeb}
    </p>
    {#if seasons.length > 1}
      <div class="seg board-tabs hof-seasons" role="group" aria-label={L.seasonGroup}>
        {#each seasons as s (s.id)}
          <button class="opt" aria-pressed={season === s.id} data-my-season={s.id} onclick={() => ((picked = s.id), (expanded = false))}>{seasonLabel(s.id, s.name)}</button>
        {/each}
      </div>
    {/if}
    {#each shown as r, i (r.key)}
      <button class="hof-row" data-my-player={i} onclick={r.open}>
        <HofRow nation={r.nation} showNation={r.nation !== undefined} rank={i} name={r.name} pos={r.pos} dpos={r.dpos} club={r.club} clubId={r.clubId} rn={r.rn} tag={r.tag} t={r.stats} titleId={r.title} />
      </button>
    {:else}
      <p class="empty">{emptySeasonText(season, seasons.length > 1 ? rows.length : 0)}</p>
    {/each}
    {#if !expanded && inSeason.length > SHOW}
      <button class="icon-btn self-start" data-act="my-players-all" onclick={() => (expanded = true)}>{L.showAll({ n: inSeason.length })}</button>
    {/if}
  {/if}
</section>
