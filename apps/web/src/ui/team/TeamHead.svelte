<script lang="ts">
  // 내 팀 편성 화면 맨 위 카드 — 팀 이름·OVR·전적, 이름 칸, 시즌 선택과 바로가기.
  import { MANAGER_NAME_MAX, MANAGER_NAME_MIN, TEAM_NAME_MAX, TEAM_NAME_MIN, YOUTH_OVR } from '@offside/contracts/owner-team';
  import type { OwnerTeam, OwnerTeamResponse } from '@offside/app-core/api/team';
  import { num, recordText } from '@offside/app-core/teamText';
  import { doneOnEnter } from '../inputDone.js';

  let {
    team,
    seasonName,
    editable,
    ovr,
    matchesLeft,
    perDay,
    seasons,
    season,
    current,
    name = $bindable(),
    manager = $bindable(),
    renaming = $bindable(),
    onseason,
    onranking,
  }: {
    team: OwnerTeam | null;
    seasonName: string;
    editable: boolean;
    ovr: number;
    matchesLeft: number;
    perDay: number;
    seasons: OwnerTeamResponse['seasons'];
    season: number;
    current: number | null;
    name: string;
    manager: string;
    /** 팀이 있으면 이름 칸은 '이름 바꾸기'를 눌렀을 때만 펼친다. */
    renaming: boolean;
    onseason: (id: number) => void;
    /** 기록실 랭킹을 연다(id가 있으면 그 팀 프로필). */
    onranking: (id?: string | null) => void;
  } = $props();
</script>

<section class="card stack tm-head" style="gap:12px">
  <div class="tm-title">
    <div>
      <div class="eyebrow">My team · {seasonName}</div>
      <h1>{team?.name ?? (editable ? '팀 만들기' : '팀 없음')}</h1>
      {#if team}<span class="muted fs-sm">{team.manager} 감독</span>{/if}
    </div>
    <div class="tm-ovr-badge" aria-label="팀 OVR {ovr}"><small>OVR</small><b>{ovr}</b></div>
  </div>
  {#if team}
    <dl class="tm-stats" data-team-record>
      <div><dt>전적</dt><dd>{recordText(team.record)}</dd></div>
      <div><dt>레이팅</dt><dd>{num(team.rating)}</dd></div>
      <div><dt>{editable ? '오늘 경기' : '시즌'}</dt><dd>{editable ? `${matchesLeft}/${perDay}` : '지난 시즌'}</dd></div>
    </dl>
  {:else if editable}
    <p class="muted">{seasonName}에 뛰고 은퇴한 내 선수로 11명을 꾸려요. 빈 자리는 유스 선수(OVR {YOUTH_OVR})가 채워서, 한 명만 넣어도 경기할 수 있어요. 팀은 시즌마다 새로 꾸려요.</p>
  {:else}
    <p class="muted">{seasonName}에는 팀을 꾸리지 않았어요.</p>
  {/if}
  {#if !editable && team}
    <p class="muted fs-sm" data-team-readonly>지난 시즌 팀이라 보기만 할 수 있어요.</p>
  {/if}
  {#if editable && (!team || renaming)}
    <div class="tm-names">
      <label class="field">
        <span class="lbl">팀 이름</span>
        <input type="text" bind:value={name} minlength={TEAM_NAME_MIN} maxlength={TEAM_NAME_MAX} placeholder="{TEAM_NAME_MIN}~{TEAM_NAME_MAX}자" data-team-name enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
      </label>
      <label class="field">
        <span class="lbl">감독 이름</span>
        <input type="text" bind:value={manager} minlength={MANAGER_NAME_MIN} maxlength={MANAGER_NAME_MAX} placeholder="{MANAGER_NAME_MIN}~{MANAGER_NAME_MAX}자" data-team-manager enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
      </label>
    </div>
  {/if}
  <div class="tm-links">
    {#if seasons.length > 1}
      <select class="tm-season" aria-label="시즌" value={season} onchange={(e) => onseason(Number(e.currentTarget.value))} data-team-season>
        {#each seasons as o (o.id)}
          <option value={o.id}>{o.name}{o.id === current ? ' (지금)' : ''}</option>
        {/each}
      </select>
    {/if}
    {#if editable && team && !renaming}
      <button class="icon-btn" onclick={() => (renaming = true)} data-act="team-rename">이름 바꾸기</button>
    {/if}
    {#if team}
      <button class="icon-btn" onclick={() => onranking(team?.id ?? null)} data-act="team-profile">팀 프로필 · 순위</button>
    {/if}
    <button class="icon-btn" onclick={() => onranking()} data-act="team-ranking">라이브 랭킹</button>
  </div>
</section>

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
  .tm-stats {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr;
    gap: 8px;
    margin: 0;
  }
  .tm-stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
    min-width: 0;
  }
  .tm-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .tm-stats dd {
    margin: 0;
    font-family: var(--display);
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
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
  .tm-names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
</style>
