<script lang="ts">
  import ShareSheet from '../share/ShareSheet.svelte';
  import type { TeamShareData } from './teamShareCard.js';
  import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';

  let { data, onclose }: { data: TeamShareData; onclose: () => void } = $props();

  // 그리는 코드는 시트를 열 때 불러온다(첫 화면 번들 밖).
  const make = async () => (await import('./teamShareCard.js')).makeTeamShareFile(data);
</script>

<ShareSheet
  {make}
  {onclose}
  act="team-share"
  alt={L.shareAltWeb({ name: data.name })}
  shareTitle={L.shareTitleWeb({ name: data.name })}
  shareText={L.shareTextWeb({ name: data.name })}
  note={data.draft ? L.shareDraftNote : undefined}
  text={{ title: L.shareTitle, lead: L.shareLeadWeb, close: L.shareCloseAria, making: L.shareMaking, makeFail: L.shareMakeFail, openFail: L.shareOpenFailWeb, save: L.saveImage, share: L.shareNow, remake: L.remake, makingBtn: L.makingBtn }}
/>
