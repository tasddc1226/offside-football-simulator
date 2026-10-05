<script lang="ts">
  import { toast } from './helpers.js';
  import { copyText } from './inapp-open.js';

  // 기존 공개 후원 정보. 게임 혜택이나 광고 제거 구매와 연결하지 않는다.
  const ACCOUNT = '토스뱅크 1000-1599-4723 양*영';
  async function copyAccount() {
    toast((await copyText(ACCOUNT)) ? '계좌번호를 복사했어요. 고마워요' : '복사하지 못했어요. 아래 계좌번호를 직접 적어 주세요');
  }
</script>

<section class="card voluntary-support" aria-labelledby="home-support" data-home-support>
  <h2 id="home-support">개발자 응원하기</h2>
  <p class="muted">재밌게 즐기셨다면 개발을 응원해 주세요. 후원은 선택이며, 게임 혜택이나 광고 제거는 제공하지 않아요.</p>
  <button class="btn" data-act="coffee" onclick={copyAccount}>후원 계좌 복사</button>
  <p class="muted support-account">{ACCOUNT}</p>
</section>

<style>
  .voluntary-support { margin-top: 24px; }
  h2 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.6; }
  button { min-height: 44px; margin-top: 12px; max-width: 100%; }
  .support-account { margin: 8px 0 0; overflow-wrap: anywhere; }
</style>
