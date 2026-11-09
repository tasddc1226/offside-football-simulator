<script lang="ts">
  // T-11-681 리그·대회 로고. 유저가 고른 이미지가 있으면 그 이미지, 없으면 기본 엠블럼(app-core compEmblem.ts, 앱과 공용)을 그린다.
  // 누르면 그 자리에서 로고 시트(CompIconSheet)가 떠 이미지를 고른다(게임 화면을 떠나지 않는다). 이름이 옆에 있는 장식이라
  // 그림은 스크린 리더에 숨기고, 버튼에만 "○○ 로고 바꾸기"를 단다. still이면 누를 수 없는 그림만 그린다.
  import { COMP_EMBLEM_VIEWBOX, compEmblem } from '@offside/app-core/compEmblem';
  import { compIconsText as T } from '@offside/app-core/i18n/ko/compIcons';
  import { tn } from '@offside/game/i18n/names';
  import { compIcons, dismissCompIconHint } from './compIcons.svelte.js';
  import { customNames } from './customNames.svelte.js';
  import CompIconSheet from './CompIconSheet.svelte';

  let { ko, size = 24, still = false }: { ko: string; size?: number; still?: boolean } = $props();
  let open = $state(false);
  const img = $derived(compIcons.map[ko]);
  // 바꾼 이름에서 약칭을 따므로 이름표가 바뀌면 다시 그린다.
  const art = $derived((void customNames.map[ko], compEmblem(ko)));
  function show() {
    dismissCompIconHint();
    open = true;
  }
</script>

{#snippet face()}
  {#if img}
    <img class="comp-icon-img" src={img} alt="" width={size} height={size} />
  {:else}
    <svg viewBox={COMP_EMBLEM_VIEWBOX} width={size} height={size} aria-hidden="true" focusable="false">
      {#each art.layers as l, i (i)}<path d={l.d} fill={l.fill} />{/each}
      <text x="32" y={art.mark.y} text-anchor="middle" font-size={art.mark.size} font-weight="800" fill={art.mark.fill} font-family="system-ui, -apple-system, sans-serif" letter-spacing="-0.5">{art.mark.text}</text>
    </svg>
  {/if}
{/snippet}

{#if still}
  <span class="comp-icon" style="--s:{size}px" data-comp-icon={ko} data-comp-kind={art.kind}>{@render face()}</span>
{:else}
  <button type="button" class="comp-icon comp-icon-btn" style="--s:{size}px" data-comp-icon={ko} data-comp-kind={art.kind} data-comp-custom={img ? '' : undefined} aria-label={T.logoLabel({ name: tn(ko) })} onclick={show}>{@render face()}</button>
{/if}
{#if open}<CompIconSheet {ko} onclose={() => (open = false)} />{/if}

<style>
  .comp-icon {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: var(--s);
    height: var(--s);
    vertical-align: middle;
  }
  .comp-icon-btn {
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    border-radius: 6px;
    /* 작은 그림도 손가락으로 누르기 쉽게 누르는 자리를 넓힌다. */
    position: relative;
  }
  .comp-icon-btn::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .comp-icon-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .comp-icon-btn:active {
    transform: scale(0.94);
  }
  .comp-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  svg {
    display: block;
  }
</style>
