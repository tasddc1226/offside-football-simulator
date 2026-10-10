<script lang="ts">
  import Topbar from '../Topbar.svelte';
  import BackBar from '../BackBar.svelte';
  import { go } from '../nav.js';
  import OwnerHall from './OwnerHall.svelte';
</script>

<div class="wrap" data-owner-honors-screen>
  <Topbar />
  <OwnerHall />
</div>
<BackBar act="honors-back" fallback={() => go('owner')} atBottom={false} />
