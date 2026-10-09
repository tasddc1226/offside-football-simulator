<script lang="ts">
  // T-11-175 홈의 친구 초대 이벤트 타일. 제목 · 보상 장수를 친구 화면과 같은 곳(friend 문구 · INVITE_REROLLS)에서 가져와서
  // 첫 화면 번들 밖 지연 청크로 둔다(Home.svelte가 import()로 부른다).
  import { INVITE_REROLLS } from '@offside/contracts/owner-team';
  import { friendText as LF } from '@offside/app-core/i18n/ko/friend';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import { openFriends } from './friendInvite.svelte.js';
</script>

<button class="tile tile-link tile-wide" data-act="home-invite" onclick={openFriends}>
  <span class="eyebrow">Invite event</span><b>{LF.eventTitle}</b><span class="muted fs-sm">{L.inviteSub({ n: INVITE_REROLLS })}</span>
</button>
