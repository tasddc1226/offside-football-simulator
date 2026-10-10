<script lang="ts">
  import { accountText as L } from '@offside/app-core/i18n/ko/account';

  let { onclick, act = 'google-login', block = true }: {
    onclick: () => void | Promise<void>;
    act?: string;
    block?: boolean;
  } = $props();
</script>

<button type="button" class="btn btn-primary" class:btn-block={block} data-google-login data-act={act} {onclick}>{L.loginGoogle}</button>
