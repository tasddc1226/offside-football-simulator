<script lang="ts">
  // 경기 한 줄(라운드·승무패·상대·스코어·내 기록). 경기 중계 시트와 구간 리포트의 경기별 기록이 함께 쓴다.
  import { RES_LABEL, type TickerRow } from '@offside/app-core/sheets';
  import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
  let { m }: { m: TickerRow } = $props();
</script>

<div>
  <span class="rd">{m.rd}R</span><span class="res {m.res}">{RES_LABEL[m.res]}</span>
  <span
    >{m.opp} {m.score}
    <span class="muted"
      >· {#if m.mins}{sheetCoreText.tickerMins({ n: m.mins })}{#if m.g} · <b>{sheetCoreText.tickerGoals({ n: m.g })}</b>{/if}{#if m.a} · {sheetCoreText.tickerAssists({ n: m.a })}{/if} · {m.rating}{:else if m.inj}{sheetCoreText.tickerInjured}{:else}{sheetCoreText.tickerNone}{/if}</span
    ></span
  >
</div>
