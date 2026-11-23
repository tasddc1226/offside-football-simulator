<script lang="ts">
  // T-11-802 홈 맨 아래(소식 아래 · 푸터 위) '의견 보내기' 한 줄. 첫 화면 번들 밖 지연 청크(Home.svelte가 import()로 부른다)이고,
  // 시트(VoiceSheet)도 누를 때 지연으로 연다. 홈에서는 요청하지 않는다. 눈썹 글자 Feedback은 사전에 넣지 않고, 화면 낭독기가 영어 단어부터 읽지 않게 숨긴다.
  import { voiceText as VT } from '@offside/app-core/i18n/ko/voice';

  let open = $state(false);
  let btn = $state<HTMLButtonElement | null>(null);
</script>

<button class="card home-voice" data-act="home-voice" bind:this={btn} onclick={() => (open = true)}>
  <span class="hv-text">
    <span class="eyebrow" aria-hidden="true">Feedback</span>
    <b>{VT.homeTitle}</b>
    <span class="muted fs-sm">{VT.homeSub}</span>
  </span>
  <span class="hv-chev" aria-hidden="true">›</span>
</button>

{#if open}{#await import('./VoiceSheet.svelte') then { default: VoiceSheet }}<VoiceSheet screen="home" onclose={() => ((open = false), btn?.focus())} />{/await}{/if}

<style>
  .home-voice {
    box-sizing: border-box;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .hv-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hv-chev {
    flex: none;
    color: var(--muted);
    font-size: 1.25em;
  }
</style>
