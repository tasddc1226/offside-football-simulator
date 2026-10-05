<script lang="ts">
  // T-10-026 칭호 도감(트로피 탭). 얻은 칭호는 눌러서 대표 칭호로 고르고(다시 누르면 자동 선택으로),
  // 못 얻은 칭호는 접힌 목록에서 조건·진행도를 본다. 숨김 칭호는 얻기 전까지 이름을 가린다.
  import { TITLES, TITLE_CATS, RARITY_LABEL, mainTitle, titleById, type TitleDef } from '@offside/game/titles';
  import type { GameState } from '@offside/game/types';
  import { save } from '../helpers.js';
  import TitleTag from './TitleTag.svelte';
  import { titleText as L } from '@offside/app-core/i18n/ko/title';

  const { s }: { s: GameState } = $props();
  const earned = $derived(
    (s.titles ?? [])
      .map((e) => ({ d: titleById(e.id), year: e.year }))
      .filter((x): x is { d: TitleDef; year: number } => !!x.d)
      .sort((a, b) => b.d.rarity - a.d.rarity || b.year - a.year),
  );
  const have = $derived(new Set(earned.map((x) => x.d.id)));
  // T-10-096 국적으로 얻을 수 없는 칭호(다른 대륙컵·병역 등)는 도감에서 뺀다.
  const pool = $derived(TITLES.filter((d) => !d.avail || d.avail(s) || have.has(d.id)));
  const main = $derived(mainTitle(s));
  const locked = $derived(
    TITLE_CATS.map((c) => ({ ...c, list: pool.filter((d) => d.cat === c.id && !have.has(d.id)) })).filter((c) => c.list.length),
  );

  function pick(id: string) {
    if (s.titleSel === id) delete s.titleSel;
    else s.titleSel = id;
    save();
  }
</script>

<section class="card stack" id="titles" data-title-dex>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <div>
      <div class="eyebrow">Titles</div>
      <h2>{L.dexTitle}</h2>
    </div>
    <span class="muted num fs-sm">{earned.length} / {pool.length}</span>
  </div>
  {#if main}
    <p class="title-main">{L.mainTitle} <TitleTag name={main.name} rarity={main.rarity} /> <span class="muted">{s.titleSel ? L.selManual : L.selAuto}</span></p>
  {/if}
  {#if earned.length}
    <p class="muted fs-xs">{L.pickHint}</p>
    <ul class="title-list">
      {#each earned as x (x.d.id)}
        <li>
          <button class="title-item" data-title={x.d.id} aria-pressed={main?.id === x.d.id} onclick={() => pick(x.d.id)}>
            <TitleTag name={x.d.name} rarity={x.d.rarity} />
            <span class="title-desc">{x.d.desc}</span>
            <span class="title-year num">{x.year ? x.year : L.earlier}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{L.emptyEarned}</p>
  {/if}
  {#if locked.length}
    <details class="title-locked">
      <summary>{L.lockedSummary({ n: pool.length - earned.length })}</summary>
      {#each locked as c (c.id)}
        <div class="eyebrow" style="margin:12px 0 4px">{c.label}</div>
        <ul class="title-list compact">
          {#each c.list as d (d.id)}
            {@const p = d.progress?.(s)}
            <li class="title-item locked" data-title-locked={d.id}>
              <span class="title-name">{d.hidden ? '???' : d.name}</span>
              <span class="title-desc">{d.hidden ? L.hiddenDesc : d.desc} · {RARITY_LABEL[d.rarity]}</span>
              {#if p && !d.hidden}
                <span class="title-year num">{p[0]}/{p[1]}</span>
                <span class="title-prog" role="progressbar" aria-label={L.progressLabel({ name: d.name })} aria-valuemin={0} aria-valuemax={p[1]} aria-valuenow={p[0]}
                  ><i style="width:{Math.round((p[0] / p[1]) * 100)}%"></i></span
                >
              {/if}
            </li>
          {/each}
        </ul>
      {/each}
    </details>
  {/if}
</section>
