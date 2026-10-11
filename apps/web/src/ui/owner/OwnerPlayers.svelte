<script lang="ts">
  import Topbar from '../Topbar.svelte';
  import BackBar from '../BackBar.svelte';
  import { go } from '../nav.js';
  import MyPlayers from '../MyPlayers.svelte';
</script>
<div class="wrap" data-owner-players-screen><Topbar /><MyPlayers /></div>
<BackBar act="players-back" fallback={() => go('owner')} />
