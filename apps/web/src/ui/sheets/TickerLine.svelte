<script lang="ts">
  // 경기 한 줄(라운드·승무패·상대·스코어·내 기록). 경기 중계 시트와 구간 리포트의 경기별 기록이 함께 쓴다.
  import { RES_LABEL, type TickerRow } from './types.js';
  let { m }: { m: TickerRow } = $props();
</script>

<div>
  <span class="rd">{m.rd}R</span><span class="res {m.res}">{RES_LABEL[m.res]}</span>
  <span
    >{m.opp} {m.score}
    <span class="muted"
      >· {#if m.mins}{m.mins}분{#if m.g} · <b>{m.g}골</b>{/if}{#if m.a} · {m.a}도움{/if} · {m.rating}{:else if m.inj}부상 결장{:else}출전 없음{/if}</span
    ></span
  >
</div>
