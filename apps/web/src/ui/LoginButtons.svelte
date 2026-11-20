<script lang="ts">
  // 로그인 버튼 묶음 — 구글과 Apple(T-11-204). 앱 screens/owner/LoginButtons.tsx와 같은 자리에 쓴다.
  import GoogleLoginButton from './GoogleLoginButton.svelte';
  import AppleLoginButton from './AppleLoginButton.svelte';
  import type { LoginPlace } from '@offside/app-core/funnelEvents';
  import { startAppleLogin, startGoogleLogin, type LoginReturn } from './login.js';

  let { back = null, act = 'google-login', block = true, place = 'owner' }: {
    /** 로그인을 마치고 돌아갈 곳(없으면 구단주 화면). */
    back?: LoginReturn | null;
    /** 구글 버튼의 data-act. Apple 버튼은 'apple-'를 앞에 붙인다. */
    act?: string;
    block?: boolean;
    /** T-11-792 이 버튼이 있는 곳(로그인 시도 계측). 안 넘기면 구단주 화면의 로그인 카드다. */
    place?: LoginPlace;
  } = $props();
</script>

<div class="login-btns" class:login-btns-block={block}>
  <GoogleLoginButton {act} {block} onclick={() => startGoogleLogin(back, place)} />
  <AppleLoginButton act={act.includes('google') ? act.replace('google', 'apple') : `apple-${act}`} {block} onclick={() => startAppleLogin(back, place)} />
</div>
