<script lang="ts">
  // 내 은퇴 선수 아래 로그인 권유(T-10-029). 공유는 로그인 없이도 되고(ShareBar, T-10-067), 로그인하면 이 기록이
  // 계정에 남아 다른 기기에서도 볼 수 있다. 로그인을 마치면 이 선수 상세로 돌아온다. 로그인했거나 서버에 연결하지
  // 못하면 숨긴다.
  import { onMount } from 'svelte';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { isMember } from '@offside/app-core/account';
  import { startGoogleLogin } from './login.js';

  const { id }: { id: string } = $props();
  const profile = $derived(accountCache.value);

  onMount(() => {
    if (accountCache.value === undefined || accountCache.value === 'error') void refreshAccount();
  });
</script>

{#if profile && profile !== 'error' && !isMember(profile)}
  <section class="card stack" data-share="login">
    <div><div class="eyebrow">Account</div><h2>로그인하고 기록 지키기</h2></div>
    <p class="muted fs-sm">
      구글로 로그인하면 이 은퇴 기록이 계정에 남아 다른 기기에서도 볼 수 있어요. 공유 링크는 로그인하지 않아도 아래 버튼으로 만들 수 있어요.
    </p>
    <button class="btn btn-block" data-act="share-login" onclick={() => startGoogleLogin({ career: id })}>구글로 로그인</button>
  </section>
{/if}
