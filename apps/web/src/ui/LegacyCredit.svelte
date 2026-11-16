<script lang="ts">
  // T-11-733 은퇴 리포트의 '은퇴 유산' 장면 — 종류와 등급만(금액은 보이지 않는다). LateCredits와 함께 지연 로드된다.
  import { legacyCredit } from '@offside/app-core/legacy-view';
  import { gameLegacyText as L } from '@offside/app-core/i18n/ko/gameLegacy';
  import type { LegacyKind } from '@offside/game/types';

  const {
    legacy,
    reveal,
  }: {
    legacy: { k: LegacyKind; t: number };
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
  const c = $derived(legacyCredit(legacy));
</script>

<section class="film-style" data-credit="legacy" data-legacy={`${legacy.k}-${c.t}`} use:reveal>
  <div class="eyebrow film-kicker">Legacy</div>
  <h2>{L.creditTitle}</h2>
  <div class="style-type">
    <b data-legacy-name>{c.kind}</b>
    <div class="film-pills"><span class="pill legacy-tier t{c.t}">{c.tier}</span></div>
    <p>{c.line}</p>
  </div>
</section>

<style>
  .legacy-tier.t3,
  .legacy-tier.t4 {
    color: var(--film-gold);
    border-color: currentColor;
  }
  .legacy-tier.t4 {
    font-weight: 800;
  }
</style>
