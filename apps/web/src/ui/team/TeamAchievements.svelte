<script lang="ts">
  // T-11-028 시즌 업적 화면 — 점수·등급, 다음 목표, 분류별 업적. 불러오기는 Team.svelte가 맡는다.
  import type { AchCategory } from '@offside/contracts/owner-team';
  import type { ClubAchievementsResponse } from '@offside/app-core/api/team';
  import { num } from '@offside/app-core/teamText';
  import {
    achDone, achGradeView, achNear, achOpenGroup, achPoints, achRankText, achSections, achState, achTotal,
  } from '@offside/app-core/teamOwner';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import AchGradeBadge from './AchGradeBadge.svelte';

  let {
    ach,
    status,
    newIds,
    cat = $bindable(),
    load,
    onrank,
  }: {
    ach: ClubAchievementsResponse | null;
    status: LoadStatus;
    /** 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
    newIds: ReadonlySet<string>;
    /** 보고 있는 분류(선수·팀·구단주·감독). */
    cat: AchCategory;
    /** 시즌을 지정해 다시 불러온다(없으면 보고 있는 시즌). */
    load: (season?: number) => void;
    /** 기록실 업적 랭킹을 연다. */
    onrank: () => void;
  } = $props();
</script>

<section class="card stack" style="gap:12px" data-club-achievements>
  <div class="tm-title">
    <div>
      <div class="eyebrow">Season achievements</div>
      <h1>시즌 업적</h1>
    </div>
    {#if ach && ach.seasons.length > 1}
      <select class="tm-season" aria-label="시즌" value={ach.season} onchange={(e) => load(Number(e.currentTarget.value))}>
        {#each ach.seasons as o (o.id)}
          <option value={o.id}>{o.name}</option>
        {/each}
      </select>
    {/if}
  </div>
  <LoadState {status} failText="업적을 불러오지 못했어요." retry={() => load(ach?.season)}>
    {#if ach}
      {@const tot = achTotal(ach.groups)}
      {@const gv = achGradeView(ach.score)}
      {@const sections = achSections(ach.groups)}
      {@const sec = sections.find((x) => x.id === cat) ?? sections[0]!}
      {@const near = achNear(ach.groups)}
      {@const openId = sec.groups.find((g) => g.items.some((i) => newIds.has(i.id)))?.id ?? achOpenGroup(sec.groups)}
      <div class="tm-ach-sum" data-ach-summary>
        <div class="tm-ach-head">
          <AchGradeBadge grade={gv.grade} large />
          <div class="tm-ach-total"><b>{num(ach.score)}</b><span class="muted">점</span></div>
          <button class="tm-ach-rank" data-act="ach-ranking" onclick={onrank}>
            <small class="muted">업적 랭킹</small><span>{achRankText(ach.rank, ach.ranked)}</span>
          </button>
        </div>
        <div class="tm-bar" role="progressbar" aria-label="다음 등급까지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gv.ratio * 100)}>
          <span style:width="{gv.ratio * 100}%"></span>
        </div>
        <p class="muted fs-sm" data-ach-next>
          {gv.next ? `${gv.next.name}까지 ${num(gv.toNext)}점` : '최고 등급이에요'} · 업적 {tot.done}/{tot.total} 달성
        </p>
        <p class="muted fs-xs">{ach.seasons.find((o) => o.id === ach?.season)?.name ?? ''}에 처음 뛰어 은퇴한 내 선수 {ach.players}명과 이 시즌 팀·구단 활동으로 채워요. 시즌마다 처음부터 다시 쌓아요.</p>
      </div>
      {#if near.length}
        <div class="tm-near" data-ach-near>
          <div class="eyebrow">다음 목표</div>
          <ul>
            {#each near as n (n.item.id)}
              <li>
                <span class="tm-near-txt"><b>{n.item.label}</b><small class="muted">{n.group} · {achState(n.item)}</small></span>
                <span class="tm-pts">+{num(n.item.worth)}점</span>
                <span class="tm-bar sm" aria-hidden="true"><span style:width="{n.ratio * 100}%"></span></span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="tm-ach-cats" role="tablist" aria-label="업적 분류" style:grid-template-columns="repeat({sections.length}, minmax(0, 1fr))">
        {#each sections as x (x.id)}
          <button role="tab" aria-selected={sec.id === x.id} data-ach-cat={x.id} onclick={() => (cat = x.id)}>
            <span>{x.name.replace(' 업적', '')}</span>
            <small class="num">{x.locked ? '🔒︎' : num(x.score)}</small>
          </button>
        {/each}
      </div>
      {#if sec.locked}
        <div class="tm-ach tm-ach-locked tm-ach-soon" data-ach-group="manager">
          <div class="tm-ach-head"><span class="tm-ach-stage">SOON</span><b>감독 커리어</b></div>
          <small class="muted">감독 시뮬레이션이 열리면 감독으로 거둔 성적도 업적이 돼요. 선수·팀·구단주 업적처럼 시즌마다 새로 쌓여요.</small>
        </div>
      {:else}
        {#each sec.groups as g (`${ach.season}-${g.id}`)}
          <details class="tm-ach" data-ach-group={g.id} open={g.id === openId}>
            <summary>
              <span class="tm-ach-stage">{g.stage}</span>
              <b>{g.title}</b>
              <span class="tm-ach-count">{achDone(g.items)}/{g.items.length}</span>
            </summary>
            <ul>
              {#each g.items as i (i.id)}
                <li class:done={i.done}>
                  <span class="tm-ach-txt"><span>{i.label}{#if newIds.has(i.id)}<em class="tm-ach-new">NEW</em>{/if}</span><small>{achState(i)}</small></span>
                  <span class="tm-pts" class:got={i.points > 0}>{achPoints(i)}</span>
                </li>
              {/each}
            </ul>
          </details>
        {/each}
      {/if}
    {/if}
  </LoadState>
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
  .tm-ach-sum {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-ach-sum p {
    margin: 0;
  }
  .tm-ach-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tm-ach-total {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .tm-ach-rank {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    min-height: 44px;
    justify-content: center;
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
  }
  .tm-ach-rank small {
    font-size: 0.6875rem;
    font-weight: 600;
  }
  .tm-ach-cats {
    display: grid;
    gap: 6px;
  }
  .tm-ach-cats button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-height: 48px;
    padding: 6px 4px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
  }
  .tm-ach-cats button small {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .tm-ach-cats button[aria-selected='true'] {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }
  .tm-ach-cats button[aria-selected='true'] small {
    color: var(--accent-text);
  }
  .tm-ach-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .tm-ach-new {
    margin-left: 6px;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--bad, #e5484d);
    color: #fff;
    font-style: normal;
    font-size: 0.625rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    vertical-align: 1px;
  }
  .tm-ach-txt small {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .tm-pts {
    flex: none;
    font-family: var(--display);
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .tm-pts.got,
  .tm-near .tm-pts {
    color: var(--accent-text);
  }
  .tm-ach-total b {
    font-family: var(--display);
    font-size: 2rem;
    line-height: 1;
    color: var(--accent-text);
  }
  .tm-bar {
    display: block;
    height: 8px;
    border-radius: 99px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .tm-bar.sm {
    grid-column: 1 / -1;
    height: 6px;
    background: var(--line);
  }
  .tm-bar > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
  }
  .tm-near ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tm-near li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 6px 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .tm-near-txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
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
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .tm-ach li.done .tm-ach-txt small {
    color: var(--accent-text);
    font-weight: 700;
  }
  .tm-ach-locked {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    border-style: dashed;
    background: var(--surface-2);
    color: var(--muted);
  }
  .tm-ach-locked b {
    flex: 1;
  }
  .tm-ach-soon {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 12px;
  }
  .tm-ach-soon b {
    color: var(--ink);
  }
</style>
