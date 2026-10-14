<script lang="ts">
  import { onMount } from 'svelte';
  import { primeAvatarSpec, retiredAvatarSpec, avatarSpec, type AvatarSpec } from '@offside/game/avatar';
  import { newGame } from '@offside/game/engine';
  import { IMAGE_HAIRS, type ImageHair } from '@offside/game/avatar-image';
  import { MINI_POSES, MOTIONS, type MotionId } from '@offside/game/avatar-motion';
  import { LOOK_STYLES, lookCode } from '@offside/game/look';
  import { KIT_PATTERNS, kitOf } from '@offside/game/kits';
  import ImageAvatar from '../ui/ImageAvatar.svelte';
  import PlayerCard from '../ui/team/PlayerCard.svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { avatarLookText as K } from '@offside/app-core/i18n/ko/avatarLook';
  import { avatarPngReviewText as L } from '@offside/app-core/i18n/ko/avatarPngReview';
  let hair=$state<ImageHair>('short'), condition=$state('normal'), skin=$state(0), colour=$state(0), beard=$state(0), expr=$state(0), band=$state(0), glasses=$state(0), wrist=$state(0), boots=$state(0), socks=$state(0), gray=$state(0);
  let pat=$state<typeof KIT_PATTERNS[number]>('-');
  let motion=$state<MotionId>('run'), frame=$state(0), playing=$state(true);
  const names=[K.styleShort,K.styleFringe,K.styleLong,K.styleMohawk,K.styleSlick,K.styleBuzz,K.styleAfro,K.styleBun,K.styleSpiky];
  // i18n-ignore: stored Foot enum value, not visible copy
  const armyGame=newGame({name:'PNG',number:10,pos:'FW',foot:'오른발',trait:'late',focus:['pac','sho']},1);
  armyGame.mil.serving=true;armyGame.mil.type='army';const army=avatarSpec(armyGame);
  const spec=$derived.by(()=>{
    const b=condition==='army'?army:condition==='retired'?retiredAvatarSpec('image-review',42):primeAvatarSpec({id:'image-review',lastClub:''});
    return {...b,hairStyle:condition==='army'?'buzz':hair,look:{...b.look,skin,hair:colour},beard:beard===2?'full':beard===1?'stubble':null,expr:condition==='injured'?'pain':expr===2?'wink':expr===1?'happy':null,gray:gray/100,band,glasses,wrist,boots,socks,kit:condition==='normal'||condition==='injured'?{...kitOf({id:'',name:''}),pat}:b.kit,acc:condition==='injured'?['bandage','crutch']:b.acc} as AvatarSpec;
  });
  const player=$derived<TeamPlayer>({careerId:'image-review',publicName:'OFFSIDE',pos:'FW',dpos:'ST',peak:94,roles:null,attrs:{pac:92,sho:96,dri:91,pas:85,def:42,phy:88},number:10,legendScore:1200,nation:'KR',season:1,look:lookCode({owned:[],pick:{style:LOOK_STYLES.indexOf(hair),skin,hair:colour,beard,expr,band,glasses,wrist,boots,socks}})});
  const controls=$derived([{key:'skin',label:K.itemSkin,max:5,value:skin,set:(v:number)=>skin=v},{key:'hair',label:K.itemHair,max:12,value:colour,set:(v:number)=>colour=v},{key:'beard',label:K.itemBeard,max:2,value:beard,set:(v:number)=>beard=v},{key:'expr',label:K.itemExpr,max:2,value:expr,set:(v:number)=>expr=v},{key:'band',label:K.itemBand,max:8,value:band,set:(v:number)=>band=v},{key:'glasses',label:K.itemGlasses,max:6,value:glasses,set:(v:number)=>glasses=v},{key:'wrist',label:K.itemWrist,max:6,value:wrist,set:(v:number)=>wrist=v},{key:'boots',label:K.itemBoots,max:10,value:boots,set:(v:number)=>boots=v},{key:'socks',label:K.itemSocks,max:7,value:socks,set:(v:number)=>socks=v}]);
  onMount(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)playing=false;let raf:number,last=0,index=0;const tick=(now:number)=>{const list=MOTIONS[motion].frames;if(playing&&now-last>list[index%list.length]!.ms){last=now;index=(index+1)%list.length;frame=index;}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);});
</script>
<section class="legacy" data-legacy-preview>
  <h2>{L.legacyTitle}</h2><p>{L.legacyIntro}</p>
  <nav aria-label={K.itemStyle}>{#each IMAGE_HAIRS as key,i (key)}<button data-legacy-hair={key} aria-pressed={hair===key} onclick={()=>hair=key}>{names[i]}</button>{/each}</nav>
  <nav aria-label={L.states}>{#each ['normal','army','injured','retired'] as value (value)}<button data-legacy-state={value} aria-pressed={condition===value} onclick={()=>condition=value}>{L[value as 'normal'|'army'|'injured'|'retired']}</button>{/each}</nav>
  <div class="display"><div class="character"><ImageAvatar {spec} /></div><div class="portrait"><ImageAvatar {spec} portrait /></div><div class="card"><PlayerCard {player} name="OFFSIDE" rating={94} role="ST" /></div></div>
  <div class="controls">{#each controls as c (c.key)}<label>{c.label} · {c.value}<input data-image-control={c.key} type="range" min="0" max={c.max} value={c.value} oninput={e=>c.set(Number(e.currentTarget.value))} /></label>{/each}<label>{L.gray} · {gray}%<input type="range" min="0" max="100" bind:value={gray} /></label><label>{L.kitPattern}<select bind:value={pat}>{#each KIT_PATTERNS as p (p)}<option value={p}>{p}</option>{/each}</select></label></div>
  <h3>{L.animation}</h3><div class="motion-controls"><label>{L.animation}<select bind:value={motion} onchange={()=>frame=0}>{#each Object.keys(MOTIONS) as key (key)}<option value={key}>{key}</option>{/each}</select></label><button aria-pressed={playing} onclick={()=>playing=!playing}>{L.playPause}</button></div>
  <div class="animated"><ImageAvatar {spec} motionFrame={MOTIONS[motion].frames[frame%MOTIONS[motion].frames.length]} /></div>
  <div class="poses">{#each ['stand',...MINI_POSES] as pose (pose)}<figure><ImageAvatar {spec} motionFrame={pose==='stand'?{ms:100}:{ms:100,pose:pose as typeof MINI_POSES[number]}} /><figcaption>{pose}</figcaption></figure>{/each}</div>
</section>
<style>
  .legacy{margin:24px 0;border:1px solid var(--review-line);background:var(--review-surface);border-radius:16px;padding:20px 16px;color:var(--review-ink)}h2{font-size:24px;margin:0 0 12px}p{font-size:14px;line-height:1.6}nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,select{min-height:44px;background:var(--review-surface);color:inherit;border:1px solid var(--review-line);padding:8px 12px;border-radius:20px}button[aria-pressed='true']{background:#2d6542;color:white}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #d38f25;outline-offset:3px}.display{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:24px}.character :global(svg.avatar){width:144px;height:192px}.portrait :global(svg.avatar){width:96px;height:84px}.card{width:170px}.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;margin:24px 0}label{display:flex;flex-direction:column;gap:8px;font-size:13px}input{width:100%;min-height:44px}.motion-controls{display:flex;gap:12px;align-items:end}.animated{display:flex;justify-content:center;margin:24px}.animated :global(svg.avatar){width:192px;height:216px}.poses{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:12px}figure{margin:0;min-width:0;text-align:center}.poses :global(svg.avatar){width:100%;height:120px}figcaption{font:12px/1.5 monospace}select{max-width:100%}
</style>
