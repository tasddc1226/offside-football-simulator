<script lang="ts">
  import GoogleLoginButton from './GoogleLoginButton.svelte';
  // 내 은퇴 선수 아래 로그인 권유(T-10-029). 공유는 로그인 없이도 되고(ShareBar, T-10-067), 로그인하면 이 기록이
  // 계정에 남아 다른 기기에서도 볼 수 있다. 로그인을 마치면 이 선수 상세로 돌아온다. 로그인했거나 서버에 연결하지
  // 못하면 숨긴다.
  import { onMount } from 'svelte';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { isMember } from '@offside/app-core/account';
  import { startGoogleLogin } from './login.js';
  import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

  const { id }: { id: string } = $props();
  const profile = $derived(accountCache.value);

  onMount(() => {
    if (accountCache.value === undefined || accountCache.value === 'error') void refreshAccount();
  });
</script>

{#if profile && profile !== 'error' && !isMember(profile)}
  <section class="card stack" data-share="login">
    <div><div class="eyebrow">Account</div><h2>{shellMoreText.keepLoginTitle}</h2></div>
    <p class="muted fs-sm">
      {shellMoreText.keepLoginBody}
    </p>
    <GoogleLoginButton act="share-login" onclick={() => startGoogleLogin({ career: id })} />
  </section>
{/if}
