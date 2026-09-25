<script lang="ts">
  // T-10-026 칭호 도감(트로피 탭). 얻은 칭호는 눌러서 대표 칭호로 고르고(다시 누르면 자동 선택으로),
  // 못 얻은 칭호는 접힌 목록에서 조건·진행도를 본다. 숨김 칭호는 얻기 전까지 이름을 가린다.
  import { TITLES, TITLE_CATS, RARITY_LABEL, mainTitle, titleById, type TitleDef } from '../../game/titles.js';
  import type { GameState } from '../../game/types.js';
  import { save } from '../helpers.js';
  import TitleTag from './TitleTag.svelte';

  const { s }: { s: GameState } = $props();
  const earned = $derived(
    (s.titles ?? [])
      .map((e) => ({ d: titleById(e.id), year: e.year }))
      .filter((x): x is { d: TitleDef; year: number } => !!x.d)
      .sort((a, b) => b.d.rarity - a.d.rarity || b.year - a.year),
  );
  const have = $derived(new Set(earned.map((x) => x.d.id)));
  const main = $derived(mainTitle(s));
  const locked = $derived(
    TITLE_CATS.map((c) => ({ ...c, list: TITLES.filter((d) => d.cat === c.id && !have.has(d.id)) })).filter((c) => c.list.length),
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
      <h2>칭호 도감</h2>
    </div>
    <span class="muted num" style="font-size:13px">{earned.length} / {TITLES.length}</span>
  </div>
  {#if main}
    <p class="title-main">대표 칭호 <TitleTag name={main.name} rarity={main.rarity} /> <span class="muted">{s.titleSel ? '직접 고름' : '자동'}</span></p>
  {/if}
  {#if earned.length}
    <p class="muted" style="font-size:12px">칭호를 누르면 대표 칭호로 정해져 선수 카드와 명예의 전당에 표시됩니다.</p>
    <ul class="title-list">
      {#each earned as x (x.d.id)}
        <li>
          <button class="title-item" data-title={x.d.id} aria-pressed={main?.id === x.d.id} onclick={() => pick(x.d.id)}>
            <TitleTag name={x.d.name} rarity={x.d.rarity} />
            <span class="title-desc">{x.d.desc}</span>
            <span class="title-year num">{x.year ? x.year : '이전 기록'}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">아직 얻은 칭호가 없습니다. 프로 데뷔가 첫 번째 칭호예요.</p>
  {/if}
  {#if locked.length}
    <details class="title-locked">
      <summary>아직 얻지 못한 칭호 {TITLES.length - earned.length}개</summary>
      {#each locked as c (c.id)}
        <div class="eyebrow" style="margin:12px 0 4px">{c.label}</div>
        <ul class="title-list compact">
          {#each c.list as d (d.id)}
            {@const p = d.progress?.(s)}
            <li class="title-item locked" data-title-locked={d.id}>
              <span class="title-name">{d.hidden ? '???' : d.name}</span>
              <span class="title-desc">{d.hidden ? '숨겨진 칭호' : d.desc} · {RARITY_LABEL[d.rarity]}</span>
              {#if p && !d.hidden}
                <span class="title-year num">{p[0]}/{p[1]}</span>
                <span class="title-prog" role="progressbar" aria-label="{d.name} 진행도" aria-valuemin={0} aria-valuemax={p[1]} aria-valuenow={p[0]}
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
