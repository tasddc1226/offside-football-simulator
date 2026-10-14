<script lang="ts">
  import type { AvatarSpec } from '@offside/game/avatar';
  import { MOTIONS, type MotionId, type MotionFrame } from '@offside/game/avatar-motion';
  import { canRun } from '@offside/app-core/avatarStage';
  import ImageAvatar from '../ImageAvatar.svelte';
  const { spec, active=true, motion='run', frame=0, onReady }: { spec:AvatarSpec;active?:boolean;motion?:MotionId;frame?:number;onReady?:(ready:boolean)=>void }=$props();
  let ready=$state(false);
  let failedStyle=$state<string>();
  const still=$derived(!canRun(spec,active));
  const failed=$derived(failedStyle===spec.hairStyle);
  const shownMotion=$derived(still||failed||!ready?'idle':motion);
  const body=$derived.by(()=>{const selected:MotionFrame={...(MOTIONS[shownMotion].frames[still?0:frame]??MOTIONS[shownMotion].frames[0]??MOTIONS.idle.frames[0]!)};delete selected.ball;return selected;});
  $effect(()=>onReady?.(!still&&!failed&&ready));
</script>
<div class="avatar-stage" aria-hidden="true" data-ready={ready} data-motion={shownMotion} data-frame={still?0:frame}>
  <div class="avatar-walker">{#if failed}<ImageAvatar {spec}/>{:else}<ImageAvatar {spec} motionFrame={body} preloadMotion={!still} onready={value=>ready=value} onerror={()=>{ready=false;failedStyle=spec.hairStyle;}} />{/if}</div>
</div>
<style>.avatar-stage {width:100%;height:100%;background:transparent}.avatar-walker {display:block;width:100%;height:100%}.avatar-walker :global(svg) {display:block;width:100%;height:100%}</style>
