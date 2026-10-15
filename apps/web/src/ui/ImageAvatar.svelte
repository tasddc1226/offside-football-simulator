<script lang="ts">
  // T-11-270 겹쳐 그리기 계획을 한 번 합성한 캔버스(avatarComposite)를 옮겨 그린다. 크기 · 아래 가운데 정렬은 예전 svg와 같다.
  import { avatarImagePlan } from '@offside/game/avatar-image';
  import type { AvatarSpec } from '@offside/game/avatar';
  import { AVATAR_PX, composeAvatar } from './avatarComposite';
  const { spec, portrait=false, onload, onerror }: { spec: AvatarSpec; portrait?: boolean; onload?: (()=>void) | undefined; onerror?: (()=>void) | undefined } = $props();
  const plan=$derived(avatarImagePlan(spec,portrait));
  let canvas: HTMLCanvasElement;
  let ready=$state(false);
  $effect(()=>{
    const p=plan;
    let live=true;
    composeAvatar(p).then(src=>{
      if(!live)return;
      const ctx=canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(src,0,0);
      ready=true;
      onload?.();
    },()=>{if(live){ready=false;onerror?.();}});
    return ()=>{live=false;};
  });
</script>

<canvas bind:this={canvas} class="avatar image-avatar" data-avatar-renderer="image" data-hair={spec.hairStyle} data-ready={ready}
  width={plan.width*AVATAR_PX} height={plan.height*AVATAR_PX} aria-hidden="true"></canvas>

