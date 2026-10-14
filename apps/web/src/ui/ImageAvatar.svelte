<script lang="ts">
  import { avatarImagePlan, avatarMotionImageSources, IMAGE_SHEETS } from '@offside/game/avatar-image';
  import type { AvatarSpec } from '@offside/game/avatar';
  import type { MotionFrame } from '@offside/game/avatar-motion';
  import { avatarImageUrl } from './avatarImageSources';
  const { spec, portrait=false, motionFrame, preloadMotion=false, onload, onerror, onready }: { spec: AvatarSpec; portrait?: boolean; motionFrame?: MotionFrame | undefined;preloadMotion?:boolean; onready?: ((ready:boolean)=>void) | undefined; onload?: (()=>void) | undefined; onerror?: (()=>void) | undefined } = $props();
  const plan=$derived(avatarImagePlan(spec,motionFrame,portrait));
  const id=$props.id();
  let loaded=$state<string[]>([]);
  const markLoaded=(source:string)=>{if(!loaded.includes(source))loaded=[...loaded,source];};
  const wanted=$derived([...new Set([...plan.layers.map(l=>l.source),...(preloadMotion?avatarMotionImageSources(spec):[])])]);
  // 그림 목록에 없는 그림이 있으면 그리지 않고 부르는 쪽에 알린다(선수 자리만 빈다).
  const missing=$derived(wanted.some(source=>!avatarImageUrl(source)));
  const complete=$derived(!missing&&wanted.every(source=>loaded.includes(source)));
  $effect(()=>{onready?.(complete);if(complete)onload?.();});
  $effect(()=>{if(missing)onerror?.();});
</script>

<svg class="avatar image-avatar" data-avatar-renderer="image" data-hair={spec.hairStyle} data-pose={motionFrame?.pose??'stand'}
  viewBox="0 0 {plan.width} {plan.height}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" style="image-rendering:auto;shape-rendering:auto">
  <defs><clipPath id="{id}-outer"><rect width={plan.width} height={plan.height} /></clipPath></defs>
  {#if preloadMotion&&!missing}{#each wanted as source (source)}<image href={avatarImageUrl(source)} x="-100" y="-100" width="1" height="1" opacity="0" onload={()=>markLoaded(source)} {onerror}/>{/each}{/if}
  {#if !missing}
  <g clip-path="url(#{id}-outer)" visibility={complete?'visible':'hidden'}>
  {#each plan.layers as layer, i (i)}
    {@const sheet=IMAGE_SHEETS[layer.source]!}
    {@const [x,y,w,h]=layer.crop}
    <defs>
      <clipPath id="{id}-crop-{i}"><rect {x} {y} width={w} height={h} /></clipPath>
      {#if layer.filters.length}<filter id="{id}-colour-{i}" {x} {y} width={w} height={h} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        {#each layer.filters as op (op.result)}
          {#if op.kind==='matrix'}<feColorMatrix in={op.input} result={op.result} type="matrix" values={op.values.join(' ')} />
          {:else}<feComposite in={op.input} in2={op.input2} operator={op.operator} result={op.result} k2={op.operator==='arithmetic'?1:0} k3={op.operator==='arithmetic'?1:0} />{/if}
        {/each}
      </filter>{/if}
      {#if layer.pattern}<filter id="{id}-fabric-{i}" {x} {y} width={w} height={h} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values={layer.pattern.mask.join(' ')} /></filter><mask id="{id}-fabric-mask-{i}" maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}><image href={avatarImageUrl(layer.source)} width={sheet.width} height={sheet.height} filter="url(#{id}-fabric-{i})" /></mask>{/if}
    </defs>
    <g transform="translate({layer.x} {layer.y}) scale({layer.scale}) translate({-x} {-y})">
      <g clip-path="url(#{id}-crop-{i})">
        <image href={avatarImageUrl(layer.source)} width={sheet.width} height={sheet.height} filter={layer.filters.length?`url(#${id}-colour-${i})`:undefined} onload={()=>markLoaded(layer.source)} {onerror} />
        {#if layer.pattern}<g mask="url(#{id}-fabric-mask-{i})" opacity=".78">{#each layer.pattern.rects as r,j (j)}<rect x={r.x} y={r.y} width={r.width} height={r.height} fill={r.fill}/>{/each}</g>{/if}
      </g>
    </g>
  {/each}
  {#if plan.crest}<image x={plan.crest.x} y={plan.crest.y} width={plan.crest.size} height={plan.crest.size} href={`data:image/svg+xml,${encodeURIComponent(plan.crest.svg)}`} />{/if}
  {#if plan.decorations}{#each plan.decorations as r,i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity}/>{/each}{/if}
  </g>
  {/if}
</svg>

<style>svg { display:block; overflow:hidden; }</style>
