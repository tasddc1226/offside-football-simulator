<script lang="ts">
  import { toast } from './helpers.js';
  import { copyText } from './inapp-open.js';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';

  // 기존 공개 후원 정보. 게임 혜택이나 광고 제거 구매와 연결하지 않는다.
  const ACCOUNT = '토스뱅크 1000-1599-4723 양*영';
  async function copyAccount() {
    toast((await copyText(ACCOUNT)) ? L.supportCopied : L.supportCopyFailed({ account: ACCOUNT }));
  }
</script>

<section class="card voluntary-support" aria-labelledby="home-support" data-home-support>
  <h2 id="home-support">{L.supportTitle}</h2>
  <p class="muted">{L.supportBody}</p>
  <button class="btn btn-block" data-act="coffee" onclick={copyAccount}>{L.supportCopy}</button>
</section>

<style>
  .voluntary-support { margin-top: 24px; }
  h2 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.6; }
  button { min-height: 44px; margin-top: 12px; }
</style>
