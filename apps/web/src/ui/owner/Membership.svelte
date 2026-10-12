<script lang="ts">
 import {IOS_APP_STORE_URL} from '@offside/app-core/links';
 import {onMount} from 'svelte';
 import {fetchMembership,saveMemberAppearance,type MembershipResponse,type MemberAppearance} from '@offside/app-core/api/membership';
 import {membershipText as L} from '@offside/app-core/i18n/ko/membership';
 import {go} from '../nav';
 import TitleBadge from '../cup/TitleBadge.svelte';
 let data=$state<MembershipResponse|null>(null),loading=$state(true),message=$state(''),busy=$state(false);
 let theme=$state<MemberAppearance['theme']>('classic'),frame=$state<MemberAppearance['frame']>('none');
 const themes=['classic','midnight','ivory','royal'] as const;
 const frames=['none','brass','silver','emerald'] as const;
 async function load(fresh=false){loading=true;const r=await fetchMembership(fresh);loading=false;if(r.ok){data=r.data;theme=data.membership.appearance.theme;frame=data.membership.appearance.frame;message='';}else message=L.error;}
 async function save(){busy=true;const r=await saveMemberAppearance({theme,frame});busy=false;if(r.ok){data=r.data;message=L.saved;}else message=r.error.message||L.failed;}
 onMount(()=>{void load();});
 const member=$derived(data?.membership);
 const benefits=$derived([L.ad,L.items,L.cosmetics,L.compare,L.teams,L.badge]);
</script>
<div class="wrap stack membership" data-membership>
 <button class="btn" onclick={()=>go('owner')}>{L.back}</button>
 <section class="card stack member-pass">
  <h1>{L.title}</h1><p>{L.lead}</p>
  {#if member?.active&&member.badge}<TitleBadge title={`member-${member.badge}`} />{/if}
  <ul>{#each benefits as benefit (benefit)}<li>{benefit}</li>{/each}</ul><p class="muted">{L.primaryNote}</p>
  <p class="app-only" data-membership-app-only>{L.appOnly}</p><p class="muted">{L.appBenefits}</p>
  <a class="btn btn-primary" href={IOS_APP_STORE_URL}>iOS · {L.download}</a>
 </section>
 {#if loading}<p role="status">{L.loading}</p>{:else if member}
  <section class="card stack"><h2>{L[member.status]}</h2>
   {#if member.paidUntil}<p>{member.autoRenew?L.next:L.until}: <time datetime={member.graceUntil??member.paidUntil}>{new Date(member.graceUntil??member.paidUntil).toLocaleDateString()}</time></p>{/if}
   {#if member.active&&!member.autoRenew}<p>{L.cancelled}</p>{/if}
   <button class="btn" disabled={busy} onclick={()=>load(true)}>{L.retry}</button>
  </section>
  {#if member.active}
   <section class="card stack">
    <h2>{L.theme}</h2><div class="choices">{#each themes as choice (choice)}<button class="btn" aria-pressed={theme===choice} onclick={()=>theme=choice}>{L[choice]}</button>{/each}</div>
    <h2>{L.frame}</h2><div class="choices">{#each frames as choice (choice)}<button class="btn" aria-pressed={frame===choice} onclick={()=>frame=choice}>{choice==='none'?L.noFrame:L[choice]}</button>{/each}</div>
    <button class="btn btn-primary" disabled={busy} onclick={save}>{L.save}</button>
    <button class="btn" onclick={()=>go('honors')}>{L.titleGo}</button>
    <button class="btn" onclick={()=>go('players')}>{L.playersGo}</button>
   </section>
  {/if}
  <section class="card stack"><h2>{L.history}</h2>{#each member.grants as grant (grant.period)}<p><time datetime={grant.at}>{new Date(grant.at).toLocaleDateString()}</time> · {grant.refunded?L.revoked:L.items}</p>{:else}<p class="muted">{L.noHistory}</p>{/each}</section>
 {:else}<button class="btn" onclick={()=>load(true)}>{L.retry}</button>{/if}
 {#if message}<p role="status">{message}</p>{/if}
 <p class="muted">{L.keep}</p><div class="choices"><a href="/legal/terms/">{L.terms}</a><a href="/legal/privacy/">{L.privacy}</a></div>
</div>
<style>
 .membership{max-width:680px}.member-pass{border-top:4px solid var(--accent,#cbbb85)}h1{font-size:1.6rem;margin:0}h2{margin:0;font-size:1.1rem}ul{padding-left:22px;display:grid;gap:12px}li{line-height:1.5}.app-only{font-weight:700}.choices{display:flex;flex-wrap:wrap;gap:10px}.choices button{min-height:48px;flex:1 1 130px}.choices button[aria-pressed=true]{outline:2px solid var(--good,#4cc08a);outline-offset:1px}.membership :global(.btn){white-space:normal;overflow-wrap:anywhere}p{line-height:1.5}
</style>
