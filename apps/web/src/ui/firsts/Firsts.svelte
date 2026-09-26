<script lang="ts">
  // T-10-027 서버 최초 기록 — 모든 플레이어를 통틀어 처음 세운 기록. 로그인 없이 누구나 본다.
  // 최근 기록 탭은 날짜별 연대기, 분류 탭은 규칙 전체(아직 아무도 못 세운 기록 포함)를 보여 준다.
  import type { FirstsResponse, ServerFirst } from '@offside/contracts';
  import { getFirsts } from '../../api/client.js';
  import { loadHOF } from '../../game/season.js';
  import { goHome } from '../nav.js';
  import { appState } from '../state.svelte.js';
  import Topbar from '../Topbar.svelte';
  import { kstParts } from '../boardText.js';
  import { FIRSTS_TABS, achievedList, byDay, holderLabel, type FirstsTab } from './firsts.js';

  let data = $state<FirstsResponse | null>(null);
  let failed = $state(false);
  let tab = $state<FirstsTab>('recent');
  $effect(() => {
    void getFirsts().then((r) => {
      if (r.ok) data = r.data;
      else failed = true;
    });
  });

  // 내 선수: 진행 중인 커리어 + 이 기기의 은퇴 선수. 서버엔 이름 공개를 고르지 않은 이름이 없으니 여기서 채운다.
  const G = appState.G;
  const mine: ReadonlyMap<string, string> = new Map([
    ...loadHOF().flatMap((h) => (h.id ? [[h.id, h.name] as const] : [])),
    ...(G ? [[G.cid, G.name] as const] : []),
  ]);

  const total = $derived(data?.items.length ?? 0);
  const achieved = $derived(data ? achievedList(data.items) : []);
  const done = $derived(achieved.length);
  const days = $derived(byDay(achieved));
  const list = $derived(data && tab !== 'recent' ? data.items.filter((x) => x.cat === tab) : []);
</script>

{#snippet who(h: NonNullable<ServerFirst['holder']>)}
  {@const w = holderLabel(h, mine)}
  <span class="first-who">{w.name}{#if w.mine}<span class="pill good">내 선수</span>{/if}</span>
{/snippet}

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>← 홈</button>
    {/snippet}
  </Topbar>
  <section class="card" data-firsts>
    <div class="row" style="justify-content:space-between;align-items:baseline">
      <div>
        <div class="eyebrow">Server firsts</div>
        <h1 style="margin-bottom:4px">서버 최초 업적</h1>
      </div>
      {#if data}<span class="first-count num" data-firsts-count>{done}/{total}</span>{/if}
    </div>
    <p class="muted" style="font-size:13px;margin:0 0 10px">
      모든 플레이어를 통틀어 가장 먼저 세운 기록만 남아요. 이름은 명예의 전당에 이름을 공개한 선수만 보여요.
    </p>
    <div class="hof-sorts" role="group" aria-label="기록 분류">
      {#each FIRSTS_TABS as t (t.id)}
        <button class="hof-sort" aria-pressed={tab === t.id} data-firsts-tab={t.id} onclick={() => (tab = t.id)}>{t.label}</button>
      {/each}
    </div>

    {#if failed}
      <p class="empty">서버 최초 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
    {:else if !data}
      <p class="empty">불러오는 중…</p>
    {:else if tab === 'recent'}
      {#each days as d (d.day)}
        <h2 class="first-day num">{d.day}</h2>
        <ul class="first-list">
          {#each d.items as x (x.id)}
            <li class="first-row" data-first={x.id}>
              <b class="first-label">{x.label}</b>
              <span class="first-time num">{kstParts(x.achievedAt).time}</span>
              {@render who(x.holder)}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">아직 세워진 서버 최초 기록이 없어요. 첫 주인공이 되어 보세요!</p>
      {/each}
    {:else}
      <ul class="first-list">
        {#each list as x (x.id)}
          <li class="first-row" class:locked={!x.holder} data-first={x.id}>
            <b class="first-label">{x.label}</b>
            {#if x.holder && x.achievedAt}
              <span class="first-time num">{kstParts(x.achievedAt).day}</span>
              {@render who(x.holder)}
            {:else}
              <span class="first-who">미달성</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
