<script lang="ts">
  import { DC_GALLERY_URL, publicDocPath } from '@offside/app-core/links';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';
  import { bizInfoText as B } from '@offside/app-core/i18n/ko/bizInfo';
  import { businessCheckUrl, businessInfo as biz } from '../businessInfo';
</script>

<!-- 문의·SNS 링크 푸터 — 홈과 설정 화면 맨 아래에 같은 모양으로 둔다. -->
<footer class="site-foot">
  <nav class="public-links">
    <a href={publicDocPath('/guide/')}>{L.footGuide}</a>
    <a href={publicDocPath('/faq/')}>{L.footFaq}</a>
    <a href="/fairness/">{L.footFairness}</a>
    <a href="/news/">{L.navBoard}</a>
    <a href="/legends/">{L.footLegends}</a>
    <a href="/about/">{L.footAbout}</a>
  </nav>
  <p>{L.footContact} <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p>
  <p>
    Instagram <a href="https://www.instagram.com/offside.lab.kr/" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a>
    · Threads <a href="https://www.threads.com/@offside.lab.kr" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a>
  </p>
  <p>{L.footCommunity} <a href={DC_GALLERY_URL} target="_blank" rel="noopener noreferrer">{L.footGallery}</a></p>
  <p>{L.footFootballData}</p>
  {#if biz}
    <p class="biz-info" data-testid="business-info">
      {B.name} {biz.name} · {B.owner} {biz.owner} · {B.regNo} {biz.regNo}
      (<a href={businessCheckUrl(biz.regNo)} target="_blank" rel="noopener noreferrer">{B.check}</a>)
      · {B.mailOrder} {biz.mailOrderNo} · {B.address} {biz.address} · {B.phone} {biz.phone}
    </p>
  {/if}
</footer>

<style>
  .public-links { display:flex; flex-wrap:wrap; justify-content:center; gap:4px 16px; }
  .public-links a { display:inline-flex; align-items:center; min-height:44px; }
  .biz-info { font-size: var(--fs-label); word-break: keep-all; }
</style>
