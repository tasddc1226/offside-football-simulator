<script lang="ts">
  // T-10-092 구단주 팀 — 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가 채운다) 다른 구단주의 팀과 겨룬다.
  // 구단주 화면에서 처음 열 때 불러오는 지연 청크다. 경기 결과는 서버가 정한다(웹은 보여 주기만).
  import { onMount } from 'svelte';
  import {
    DETAIL_LABEL,
    FORMATION_IDS,
    FORMATION_ROWS,
    FORMATIONS,
    LINEUP_SIZE,
    TEAM_NAME_MAX,
    TEAM_NAME_MIN,
    YOUTH_NAME,
    YOUTH_OVR,
    fit,
    lineStrength,
    slotRating,
    teamOvr,
    type FormationId,
  } from '@offside/contracts/owner-team';
  import {
    fetchClubAchievements,
    fetchOpponents,
    fetchOwnerTeam,
    fetchTeamMatches,
    playMatch,
    saveOwnerTeam,
    type ClubAchievement,
    type ClubAchievementsResponse,
    type OwnerTeam,
    type TeamMatch,
    type TeamOpponent,
    type TeamPlayer,
    type TeamRecord,
  } from '../../api/team.js';
  import { FACE_ABBR, GK_ABBR } from '../../game/attributes.js';
  import { ATTR_KEYS } from '../../game/data.js';
  import { loadHOF } from '../../game/season.js';
  import { POS_LABEL, anonName } from '../../game/pos-label.js';
  import { toast } from '../helpers.js';
  import { startGoogleLogin } from '../login.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import { appState } from '../state.svelte.js';
  import Topbar from '../Topbar.svelte';

  type View = 'team' | 'achievements' | 'opponents' | 'result' | 'history';

  let status = $state<LoadStatus>('loading');
  let needLogin = $state(false);
  let team = $state<OwnerTeam | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let matchesLeft = $state(0);
  let perDay = $state(0);
  let view = $state<View>('team');

  // 편집 초안 — 저장하기 전까지 이 기기에만 있다.
  let name = $state('');
  let formation = $state<FormationId>('4-3-3');
  let slots = $state<(string | null)[]>(Array(LINEUP_SIZE).fill(null));
  let saving = $state(false);
  let picking = $state<number | null>(null);

  let opponents = $state<TeamOpponent[]>([]);
  let oppStatus = $state<LoadStatus>('loading');
  let playing = $state(false);
  let result = $state<TeamMatch | null>(null);
  let history = $state<TeamMatch[]>([]);
  let histStatus = $state<LoadStatus>('loading');
  let ach = $state<ClubAchievementsResponse | null>(null);
  let achStatus = $state<LoadStatus>('loading');
  /** 선수 고르기 정렬 — 그 자리 실력 · 레전드 점수 · 최고 OVR. */
  let pickSort = $state<'fit' | 'score' | 'peak'>('fit');
  const PICK_SORTS = [
    ['fit', '자리 실력'],
    ['score', '레전드 점수'],
    ['peak', '최고 OVR'],
  ] as const;

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = new Map(loadHOF().flatMap((h) => (h.id ? [[h.id, h.name] as const] : [])));
  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  const nameOf = (p: TeamPlayer) =>
    localNames.get(p.careerId) ?? p.publicName ?? anonName(p.pos, p.number);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;

  const slotCodes = $derived(FORMATIONS[formation]);
  const ratings = $derived(
    slotCodes.map((slot, i) => {
      const id = slots[i];
      const p = id ? byId.get(id) : undefined;
      return p ? slotRating(slot, p) : null;
    }),
  );
  const ovr = $derived(teamOvr(ratings));
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = $derived(lineStrength(slotCodes, ratings));
  const LINE_CELLS = [
    ['atk', '공격'],
    ['mid', '중원'],
    ['def', '수비'],
    ['gk', '골문'],
  ] as const;
  const filled = $derived(slots.filter((s) => s !== null).length);
  const dirty = $derived(
    !team ||
      name.trim() !== team.name ||
      formation !== team.formation ||
      slots.some((id, i) => id !== (team?.slots[i]?.careerId ?? null)),
  );
  const nameOk = $derived(name.trim().length >= TEAM_NAME_MIN && name.trim().length <= TEAM_NAME_MAX);
  /** 그라운드 줄(공격이 위). 각 줄은 slots 인덱스 목록. */
  const rows = $derived.by(() => {
    let at = 0;
    return FORMATION_ROWS[formation]
      .map((n) => {
        const row = Array.from({ length: n }, (_, k) => at + k);
        at += n;
        return row;
      })
      .reverse();
  });
  const playHint = $derived(
    !team
      ? '팀을 저장하면 경기할 수 있어요.'
      : dirty
        ? '바꾼 편성을 저장해야 경기할 수 있어요.'
        : team.slots.every((s) => s.careerId === null)
          ? '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.'
          : matchesLeft === 0
            ? '오늘 경기는 모두 치렀어요. 한국 시각 자정에 다시 열려요.'
            : null,
  );

  function applyTeam(t: OwnerTeam | null) {
    team = t;
    name = t?.name ?? '';
    formation = t?.formation ?? '4-3-3';
    slots = t ? t.slots.map((s) => s.careerId) : Array(LINEUP_SIZE).fill(null);
  }

  async function load() {
    status = 'loading';
    const r = await fetchOwnerTeam();
    if (!r.ok) {
      needLogin = r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
      status = needLogin ? 'ready' : 'error';
      return;
    }
    players = r.data.players;
    matchesLeft = r.data.matchesLeft;
    perDay = r.data.matchesPerDay;
    applyTeam(r.data.teams[0] ?? null);
    status = 'ready';
  }
  onMount(() => void load());

  // ───────── 편성 ─────────
  const candidates = $derived.by(() => {
    if (picking === null) return [];
    const slot = slotCodes[picking]!;
    return players
      .map((p) => {
        const rating = slotRating(slot, p);
        return {
          p,
          rating,
          // 자리별 실력이 있으면 최고 OVR 대비, 없으면 적합도 규칙(서버 buildLineup과 같다).
          fit: p.roles && p.peak > 0 ? rating / p.peak : fit(slot, p.pos, p.dpos),
          at: slots.indexOf(p.careerId),
        };
      })
      .sort((a, b) =>
        pickSort === 'score'
          ? (b.p.legendScore ?? 0) - (a.p.legendScore ?? 0) || b.rating - a.rating
          : pickSort === 'peak'
            ? b.p.peak - a.p.peak || b.rating - a.rating
            : b.rating - a.rating || b.p.peak - a.p.peak,
      );
  });
  /** 최고 시점 대표 능력치 한 줄(골키퍼는 골키퍼 능력치 이름). */
  const attrLine = (p: TeamPlayer) =>
    p.attrs
      ? ATTR_KEYS.map((k) => `${(p.pos === 'GK' ? GK_ABBR : FACE_ABBR)[k]} ${p.attrs![k]}`).join(' · ')
      : null;

  /** 고른 자리에 선수를 넣는다. 이미 다른 자리에 있던 선수면 두 자리를 맞바꾼다. */
  function assign(id: string | null) {
    if (picking === null) return;
    const next = [...slots];
    const from = id ? next.indexOf(id) : -1;
    if (from >= 0) next[from] = next[picking] ?? null;
    next[picking] = id;
    slots = next;
    picking = null;
  }

  /** 실력이 같으면 먼저 채울 자리(스트라이커·골키퍼·센터백 …). */
  const FILL_ORDER = ['ST', 'GK', 'CB', 'CM', 'AM', 'DM', 'W', 'FB'];

  /** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). */
  function autoFill() {
    const next: (string | null)[] = Array(LINEUP_SIZE).fill(null);
    const order = slotCodes
      .map((slot, i) => ({ slot, i }))
      .sort((a, b) => FILL_ORDER.indexOf(a.slot) - FILL_ORDER.indexOf(b.slot));
    for (;;) {
      let best: { i: number; id: string; r: number } | null = null;
      for (const { slot, i } of order) {
        if (next[i] !== null) continue;
        for (const p of players) {
          if (next.includes(p.careerId)) continue;
          const r = slotRating(slot, p);
          if (r > YOUTH_OVR && (!best || r > best.r)) best = { i, id: p.careerId, r };
        }
      }
      if (!best) break;
      next[best.i] = best.id;
    }
    slots = next;
  }

  async function save() {
    if (saving || !nameOk) return;
    saving = true;
    const r = await saveOwnerTeam({
      ...(team ? { teamId: team.id } : {}),
      name: name.trim(),
      formation,
      slots,
    });
    saving = false;
    if (!r.ok) return toast(r.error.message);
    const created = !team;
    applyTeam(r.data.team);
    toast(created ? '팀을 만들었어요' : '편성을 저장했어요');
  }

  // ───────── 경기 ─────────
  async function openOpponents() {
    view = 'opponents';
    oppStatus = 'loading';
    const r = await fetchOpponents();
    if (!r.ok) {
      oppStatus = 'error';
      return;
    }
    opponents = r.data.items;
    oppStatus = 'ready';
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    playing = true;
    const r = await playMatch(o.teamId);
    playing = false;
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') matchesLeft = 0;
      return toast(r.error.message);
    }
    result = r.data.match;
    matchesLeft = r.data.matchesLeft;
    if (team) team.record = r.data.record;
    view = 'result';
    window.scrollTo(0, 0);
  }

  // ───────── 시즌 업적 ─────────
  async function openAchievements(season?: number) {
    view = 'achievements';
    achStatus = 'loading';
    const r = await fetchClubAchievements(season);
    if (!r.ok) {
      achStatus = 'error';
      return;
    }
    ach = r.data;
    achStatus = 'ready';
  }
  const achDone = (items: ClubAchievement[]) => items.filter((i) => i.done).length;
  const n = (v: number) => v.toLocaleString('ko-KR');
  /** 업적 한 줄의 오른쪽 표시. */
  const achState = (i: ClubAchievement) =>
    i.level !== undefined
      ? `${i.level}단계 · ${n(i.cur ?? 0)}${i.unit ?? ''}${i.next != null ? ` · NEXT ${n(i.next)}` : ' · 최고 단계'}`
      : i.max !== undefined
        ? `${i.cur ?? 0} / ${i.max}`
        : i.done
          ? '달성 완료'
          : '미달성';

  async function openHistory() {
    view = 'history';
    histStatus = 'loading';
    const r = await fetchTeamMatches();
    if (!r.ok) {
      histStatus = 'error';
      return;
    }
    history = r.data.items;
    histStatus = 'ready';
  }

  const outcome = (m: TeamMatch) => {
    const mine = m[m.mine].goals;
    const theirs = m[m.mine === 'home' ? 'away' : 'home'].goals;
    return mine > theirs ? '승' : mine < theirs ? '패' : '무';
  };
  const OUTCOME_TITLE = { 승: '승리', 무: '무승부', 패: '패배' } as const;
  const recordText = (r: TeamRecord) => `${r.w}승 ${r.d}무 ${r.l}패`;
  const pct = (f: number) => `${Math.round(f * 100)}%`;
  const kstDate = (iso: string) => {
    const d = new Date(Date.parse(iso) + 9 * 3_600_000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  function back() {
    if (view === 'team' || view === 'achievements') appState.screen = 'owner';
    else view = 'team';
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && picking !== null) picking = null;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="team-back" onclick={back}>{view === 'team' || view === 'achievements' ? '← 구단주' : '← 내 팀'}</button>
    {/snippet}
  </Topbar>

  <LoadState {status} failText="팀을 불러오지 못했어요." retry={load}>
    {#if needLogin}
      <section class="card stack" style="gap:10px">
        <div class="eyebrow">My team</div>
        <h1>내 팀</h1>
        <p class="muted">구글로 로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</p>
        <button class="btn btn-primary self-start" onclick={() => void startGoogleLogin(null)}>구글로 로그인</button>
      </section>
    {:else if view === 'team' || view === 'achievements'}
      <div class="seg two tm-tabs" role="group" aria-label="내 팀 메뉴">
        <button class="opt" aria-pressed={view === 'team'} onclick={() => (view = 'team')} data-act="team-tab">팀</button>
        <button class="opt" aria-pressed={view === 'achievements'} onclick={() => void openAchievements()} data-act="team-achievements">시즌 업적</button>
      </div>
      {#if view === 'achievements'}
        <section class="card stack" style="gap:12px" data-club-achievements>
          <div class="tm-title">
            <div>
              <div class="eyebrow">Season achievements</div>
              <h1>시즌 업적</h1>
            </div>
            {#if ach && ach.seasons.length > 1}
              <select class="tm-season" aria-label="시즌" value={ach.season ?? 0} onchange={(e) => void openAchievements(Number(e.currentTarget.value))}>
                {#each ach.seasons as o (o.id ?? 0)}
                  <option value={o.id ?? 0}>{o.name}</option>
                {/each}
              </select>
            {/if}
          </div>
          <LoadState status={achStatus} failText="업적을 불러오지 못했어요." retry={() => void openAchievements(ach?.season ?? undefined)}>
            {#if ach}
              <p class="muted fs-sm">{ach.seasons.find((o) => o.id === ach?.season)?.name ?? ''}에 처음 뛰어 은퇴한 내 선수 {ach.players}명의 기록으로 채워요.</p>
              {#each ach.groups as g (g.id)}
                <details class="tm-ach" data-ach-group={g.id}>
                  <summary>
                    <span class="tm-ach-stage">{g.stage}</span>
                    <b>{g.title}</b>
                    <span class="tm-ach-count">{achDone(g.items)} / {g.items.length}</span>
                  </summary>
                  <ul>
                    {#each g.items as i (i.id)}
                      <li class:done={i.done}><span>{i.label}</span><small>{achState(i)}</small></li>
                    {/each}
                  </ul>
                </details>
              {/each}
            {/if}
          </LoadState>
        </section>
      {:else}
      <section class="card stack tm-head" style="gap:12px">
        <div class="tm-title">
          <div>
            <div class="eyebrow">My team</div>
            <h1>{team?.name ?? '팀 만들기'}</h1>
          </div>
          <div class="tm-ovr-badge" aria-label="팀 OVR {ovr}"><small>OVR</small><b>{ovr}</b></div>
        </div>
        {#if team}
          <p class="muted tm-record" data-team-record>{recordText(team.record)} · 오늘 남은 경기 {matchesLeft}/{perDay}</p>
        {:else}
          <p class="muted">은퇴한 내 선수로 11명을 꾸려요. 빈 자리는 유스 선수(OVR {YOUTH_OVR})가 채워서, 한 명만 넣어도 경기할 수 있어요.</p>
        {/if}
        <label class="field">
          <span class="lbl">팀 이름</span>
          <input type="text" bind:value={name} minlength={TEAM_NAME_MIN} maxlength={TEAM_NAME_MAX} placeholder="팀 이름 ({TEAM_NAME_MIN}~{TEAM_NAME_MAX}자)" data-team-name />
        </label>
        <div class="seg three" role="group" aria-label="포메이션">
          {#each FORMATION_IDS as f (f)}
            <button class="opt tm-form" aria-pressed={formation === f} data-formation={f} onclick={() => (formation = f)}>{f}</button>
          {/each}
        </div>
        <dl class="tm-lines" data-team-lines>
          {#each LINE_CELLS as [k, label] (k)}
            <div><dt>{label}</dt><dd>{Math.round(lines[k])}</dd></div>
          {/each}
        </dl>
        <p class="muted fs-sm">포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 가요. 선수는 자리마다 그 자리 능력치로 뛰어요.</p>
      </section>

      <section class="tm-pitch" aria-label="선발 {filled}명 · 나머지 유스 선수">
        {#each rows as row, r (r)}
          <div class="tm-row">
            {#each row as i (i)}
              {@const id = slots[i]}
              {@const p = id ? byId.get(id) : undefined}
              <button class="tm-slot" class:youth={!p} data-slot={i} onclick={() => (picking = i)} aria-label="{DETAIL_LABEL[slotCodes[i]!]} · {p ? nameOf(p) : YOUTH_NAME} · {ratings[i] ?? YOUTH_OVR}">
                <span class="tm-code">{slotCodes[i]}</span>
                <b>{ratings[i] ?? YOUTH_OVR}</b>
                <span class="tm-name">{p ? nameOf(p) : YOUTH_NAME}</span>
              </button>
            {/each}
          </div>
        {/each}
      </section>

      <section class="card stack" style="gap:10px">
        {#if players.length === 0}
          <p class="muted">아직 은퇴한 선수가 없어요. 첫 커리어를 끝까지 뛰면 팀에 넣을 수 있어요.</p>
        {:else}
          <p class="muted fs-sm">선수 {filled}명 · 유스 {LINEUP_SIZE - filled}명. 자리를 누르면 선수를 바꿀 수 있어요.</p>
        {/if}
        <div class="tm-actions">
          <button class="btn" onclick={autoFill} disabled={players.length === 0} data-act="team-auto">자동 배치</button>
          <button class="btn btn-primary" onclick={save} disabled={saving || !nameOk || !dirty} data-act="team-save">{team ? '편성 저장' : '팀 만들기'}</button>
        </div>
        <button class="btn btn-accent btn-block" onclick={openOpponents} disabled={!!playHint} data-act="team-play">경기하기</button>
        {#if playHint}<p class="muted fs-sm">{playHint}</p>{/if}
        {#if team}
          <button class="icon-btn self-start" onclick={openHistory} data-act="team-history">최근 경기</button>
        {/if}
      </section>
      {/if}
    {:else if view === 'opponents'}
      <section class="card stack" style="gap:12px">
        <div>
          <div class="eyebrow">Match</div>
          <h1>상대 고르기</h1>
          <p class="muted fs-sm">내 팀 OVR {team?.ovr ?? ovr}과 비슷한 팀이에요 · 오늘 남은 경기 {matchesLeft}/{perDay}</p>
        </div>
        <LoadState status={oppStatus} failText="상대를 불러오지 못했어요." retry={openOpponents}>
          {#each opponents as o (o.teamId)}
            <div class="tm-opp" data-opponent={o.teamId}>
              <div class="tm-opp-info">
                <b>{o.name}</b>
                <span class="muted fs-sm">{o.owner} · {o.formation} · {recordText(o.record)}</span>
              </div>
              <span class="tm-opp-ovr">{o.ovr}</span>
              <button class="btn btn-primary btn-sm" disabled={playing || matchesLeft === 0} onclick={() => void challenge(o)} data-act="team-challenge">도전</button>
            </div>
          {:else}
            <p class="muted">아직 겨룰 팀이 없어요. 다른 구단주가 팀을 꾸리면 여기에 나와요.</p>
          {/each}
          <button class="icon-btn self-start" onclick={openOpponents} disabled={playing}>다른 상대 보기</button>
        </LoadState>
      </section>
    {:else if view === 'result' && result}
      {@const m = result}
      <section class="card stack tm-result" style="gap:14px" data-team-result>
        <div>
          <div class="eyebrow">Full time</div>
          <h1>{OUTCOME_TITLE[outcome(m)]}</h1>
        </div>
        <div class="tm-score">
          <div class="tm-side" class:mine={m.mine === 'home'}>
            <b>{m.home.name}</b><small class="muted">{m.home.owner} · OVR {m.home.ovr}</small>
          </div>
          <div class="tm-goals"><b>{m.home.goals}</b><span aria-hidden="true">:</span><b>{m.away.goals}</b></div>
          <div class="tm-side away" class:mine={m.mine === 'away'}>
            <b>{m.away.name}</b><small class="muted">{m.away.owner} · OVR {m.away.ovr}</small>
          </div>
        </div>
        {#if m.events.length}
          <ol class="tm-events">
            {#each m.events as e, k (k)}
              <li class:away={e.side === 'away'}>
                <span class="tm-min">{e.minute}'</span>
                <span>
                  <b>{eventName(e.scorerId, e.scorer)}</b>
                  {#if e.assist}<small class="muted">도움 {eventName(e.assistId, e.assist)}</small>{/if}
                </span>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">골 없이 비겼어요.</p>
        {/if}
        <p class="muted fs-sm">{kstDate(m.createdAt)}{team && m.mine === 'home' ? ` · 내 팀 ${recordText(team.record)}` : ''}</p>
        <div class="tm-actions">
          <button class="btn" onclick={() => (view = 'team')}>내 팀</button>
          <button class="btn btn-primary" onclick={openOpponents} disabled={matchesLeft === 0}>다시 경기하기</button>
        </div>
      </section>
    {:else if view === 'history'}
      <section class="card stack" style="gap:12px">
        <div>
          <div class="eyebrow">Matches</div>
          <h1>최근 경기</h1>
        </div>
        <LoadState status={histStatus} failText="경기 기록을 불러오지 못했어요." retry={openHistory}>
          {#each history as m (m.id)}
            {@const opp = m[m.mine === 'home' ? 'away' : 'home']}
            <button class="tm-hist" onclick={() => ((result = m), (view = 'result'))} data-team-match={m.id}>
              <span class="tm-out" data-out={outcome(m)}>{outcome(m)}</span>
              <span class="tm-opp-info">
                <b>{m[m.mine].goals} : {opp.goals} {opp.name}</b>
                <span class="muted fs-sm">{m.mine === 'home' ? '도전' : '도전받음'} · {opp.owner} · {kstDate(m.createdAt)}</span>
              </span>
            </button>
          {:else}
            <p class="muted">아직 치른 경기가 없어요.</p>
          {/each}
        </LoadState>
      </section>
    {/if}
  </LoadState>
</div>

{#if picking !== null}
  {@const slot = slotCodes[picking]!}
  <button class="tm-scrim" aria-label="닫기" onclick={() => (picking = null)}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="{DETAIL_LABEL[slot]} 자리 선수 고르기">
    <div class="tm-sheet-head">
      <div>
        <div class="eyebrow">{slot}</div>
        <h2>{DETAIL_LABEL[slot]}</h2>
      </div>
      <button class="icon-btn" onclick={() => (picking = null)}>닫기</button>
    </div>
    <div class="seg three tm-sort" role="group" aria-label="정렬">
      {#each PICK_SORTS as [k, label] (k)}
        <button class="opt" aria-pressed={pickSort === k} onclick={() => (pickSort = k)} data-pick-sort={k}>{label}</button>
      {/each}
    </div>
    <div class="tm-list">
      <button class="tm-pick" aria-pressed={slots[picking] === null} onclick={() => assign(null)} data-pick="youth">
        <b class="tm-pick-ovr">{YOUTH_OVR}</b>
        <span class="tm-opp-info"><span>{YOUTH_NAME}</span><small class="muted">자리를 비워 두면 유스 선수가 뛰어요</small></span>
      </button>
      {#each candidates as c (c.p.careerId)}
        <button class="tm-pick" aria-pressed={slots[picking] === c.p.careerId} onclick={() => assign(c.p.careerId)} data-pick={c.p.careerId}>
          <b class="tm-pick-ovr">{c.rating}</b>
          <span class="tm-opp-info">
            <span>{nameOf(c.p)}</span>
            <small class="muted">{c.p.dpos ? DETAIL_LABEL[c.p.dpos] : POS_LABEL[c.p.pos]} · 최고 {c.p.peak} · 적합 {pct(c.fit)}{c.at >= 0 && c.at !== picking ? ` · ${slotCodes[c.at]} 자리에서 바꿈` : ''}</small>
            {#if attrLine(c.p)}<small class="muted tm-attrs">{attrLine(c.p)}</small>{/if}
          </span>
        </button>
      {:else}
        <p class="muted">넣을 수 있는 은퇴 선수가 없어요.</p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tm-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .tm-title h1 {
    overflow-wrap: anywhere;
  }
  .tm-ovr-badge {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 58px;
    padding: 6px 8px;
    border-radius: 12px;
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .tm-ovr-badge small {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
  }
  .tm-ovr-badge b {
    font-family: var(--display);
    font-size: 1.625rem;
    color: var(--pitch-accent);
  }
  .tm-form {
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.0625rem;
  }
  .tm-tabs {
    margin-bottom: 12px;
  }
  .tm-season {
    flex: none;
    max-width: 45%;
    min-height: 40px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }
  .tm-ach {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .tm-ach summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .tm-ach-stage {
    flex: none;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    background: var(--surface-2);
    color: var(--accent-text);
  }
  .tm-ach summary b {
    flex: 1;
    min-width: 0;
  }
  .tm-ach-count {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--accent-text);
  }
  .tm-ach ul {
    list-style: none;
    margin: 0;
    padding: 0 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tm-ach li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .tm-ach li small {
    flex: none;
    color: var(--muted);
    text-align: right;
  }
  .tm-ach li.done small {
    color: var(--accent-text);
    font-weight: 700;
  }
  .tm-sort {
    margin-bottom: 6px;
  }
  .tm-attrs {
    font-size: 0.6875rem;
  }
  .tm-lines {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 0;
  }
  .tm-lines div {
    display: grid;
    place-items: center;
    padding: 6px 0;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .tm-lines dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .tm-lines dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.25rem;
    font-weight: 700;
  }
  .tm-pitch {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 6px;
    border-radius: 16px;
    background:
      linear-gradient(var(--chalk), var(--chalk)) center / 100% 1px no-repeat,
      repeating-linear-gradient(180deg, var(--pitch) 0 44px, var(--pitch-2) 44px 88px);
    box-shadow: var(--shadow);
  }
  .tm-row {
    display: flex;
    justify-content: space-around;
    gap: 4px;
  }
  .tm-slot {
    flex: 1 1 0;
    max-width: 76px;
    min-width: 0;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 2px;
    border: 1px solid color-mix(in srgb, var(--on-pitch) 35%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, #000 22%, transparent);
    color: var(--on-pitch);
    font: inherit;
    cursor: pointer;
  }
  .tm-slot.youth {
    border-style: dashed;
    background: transparent;
  }
  .tm-slot b {
    font-family: var(--display);
    font-size: 1.25rem;
    line-height: 1;
    color: var(--pitch-accent);
  }
  .tm-slot.youth b {
    color: var(--on-pitch);
  }
  .tm-code {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
  }
  .tm-name {
    max-width: 100%;
    font-size: 0.6875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-opp,
  .tm-hist,
  .tm-pick {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tm-hist,
  .tm-pick {
    width: 100%;
    background: none;
    border-inline: 0;
    border-bottom: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 52px;
  }
  .tm-pick[aria-pressed='true'] {
    background: var(--surface-2);
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-opp-ovr,
  .tm-pick-ovr {
    flex: none;
    min-width: 2.2em;
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
    text-align: center;
    color: var(--accent-text);
  }
  .tm-out {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-weight: 700;
    background: var(--surface-2);
  }
  .tm-out[data-out='승'] {
    color: var(--good);
  }
  .tm-out[data-out='패'] {
    color: var(--bad);
  }
  .tm-score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .tm-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-side.away {
    text-align: right;
  }
  .tm-side.mine b {
    color: var(--accent-text);
  }
  .tm-goals {
    display: flex;
    gap: 8px;
    font-family: var(--display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .tm-events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-events li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .tm-events li.away {
    flex-direction: row-reverse;
    text-align: right;
  }
  .tm-events li > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .tm-min {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    min-width: 2.2em;
  }
  .tm-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .tm-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    padding: 16px 16px calc(12px + var(--safe-b));
    border-radius: 18px 18px 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .tm-sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 8px;
  }
  .tm-list {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
