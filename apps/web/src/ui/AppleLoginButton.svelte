<script lang="ts">
  // T-11-202 웹 Sign in with Apple 버튼. 애플 디자인 지침대로 검은 바탕(어두운 테마는 흰 바탕)에 애플 로고와 문구.
  import { accountText as L } from '@offside/app-core/i18n/ko/account';

  let { onclick, act = 'apple-login', block = true }: {
    onclick: () => void | Promise<void>;
    act?: string;
    block?: boolean;
  } = $props();
</script>

<button type="button" class="btn btn-apple" class:btn-block={block} data-apple-login data-act={act} {onclick}>
  <svg viewBox="0 0 17 20" width="15" height="18" aria-hidden="true"
    ><path
      d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8 2.2-1.2 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM11.6 3c.7-.9 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"
      fill="currentColor"
    /></svg
  >
  {L.loginApple}
</button>
