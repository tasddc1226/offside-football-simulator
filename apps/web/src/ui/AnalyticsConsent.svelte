<script lang="ts">
  import { onMount } from 'svelte';
  import { enabled, getConsent, onConsent, setConsent } from '../analytics/browser.js';
  import type { Consent } from '@offside/app-core/analytics-model';
  const { settings = false }: { settings?: boolean } = $props();
  let available = $state(false);
  let choice = $state<Consent>('unknown');
  onMount(() => {
    available = enabled();
    choice = getConsent();
    return onConsent(() => { choice = getConsent(); });
  });
</script>

{#if available && (settings || choice === 'unknown')}
  <section class="card analytics-consent" aria-label="선택적 이용 분석" data-analytics="consent">
    <strong>게임 개선을 위한 이용 분석 <span class="muted">(선택)</span></strong>
    <p class="muted">동의하면 Google Analytics가 방문 경로, 화면 이동과 커리어 시작·시즌 완료·은퇴·공유 버튼 이용을 쿠키로 분석해요. 이름과 커리어 ID는 보내지 않아요. 동의하지 않아도 게임은 똑같이 이용할 수 있어요.</p>
    <p class="muted">분석 정보는 Google의 해외 서버에서 처리되며, 사용자·이벤트 데이터는 2개월 보관해요. 환경설정에서 언제든 바꿀 수 있어요. <a href="/legal/privacy/#analytics">자세히 보기</a></p>
    {#if settings}<p>현재: {choice === 'granted' ? '동의' : choice === 'denied' ? '동의 안 함' : '선택 전'}</p>{/if}
    <div class="analytics-choices">
      <button class="btn" data-analytics="deny" onclick={() => setConsent('denied')}>{choice === 'granted' ? '분석 동의 철회' : '동의 안 함'}</button>
      <button class="btn" data-analytics="accept" onclick={() => setConsent('granted')} disabled={choice === 'granted'}>분석에 동의</button>
    </div>
    {#if settings}<p class="muted">철회하면 이후 수집이 중단되고 이 브라우저의 분석용 쿠키·기록을 지워요. 이미 전송된 정보가 자동 삭제되지는 않아요.</p>{/if}
  </section>
{/if}

<style>
  .analytics-consent { padding: 16px; margin: 12px auto; max-width: 640px; }
  p { font-size: 12px; line-height: 1.6; margin: 8px 0; }
  .analytics-choices { display: flex; flex-wrap: wrap; gap: 8px; }
  .analytics-choices .btn { flex: 1; }
</style>
