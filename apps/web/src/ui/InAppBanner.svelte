<script lang="ts">
  // T-10-115 인앱 브라우저(카톡·인스타 등)에서 연 홈에만 한 번 보이는 안내. 기록이 이 앱 안에만 저장되고 구글 로그인도
  // 막히므로 외부 브라우저로 열도록 권한다. 닫으면 다시 띄우지 않는다.
  import { loadKey, saveKey } from '@offside/game/season';
  import { currentInApp, openExternal } from './inapp-open.js';

  const HINT_KEY = 'ft_inapp_hint';
  const info = currentInApp();
  let hidden = $state(!info || loadKey<boolean>(HINT_KEY) === true);
  function dismiss() {
    saveKey(HINT_KEY, true);
    hidden = true;
  }
</script>

{#if !hidden}
  <section class="card inapp-hint" data-inapp-hint aria-label="외부 브라우저 안내">
    <p>카톡·인스타 안에서 열린 화면이에요. 기록은 이 앱 안에만 저장돼요. 외부 브라우저로 열면 로그인과 저장이 더 안전해요.</p>
    <button class="btn btn-accent" data-act="inapp-open" onclick={() => void openExternal(info)}>외부 브라우저로 열기</button>
    <button class="icon-btn inapp-close" data-act="inapp-close" aria-label="안내 닫기" onclick={dismiss}>✕</button>
  </section>
{/if}

<style>
  .inapp-hint {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-right: 52px;
    border-color: var(--accent);
  }
  .inapp-hint p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .inapp-close {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--muted);
  }
</style>
