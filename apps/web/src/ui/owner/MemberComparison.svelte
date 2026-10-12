<script lang="ts">
 import {fetchMembership} from '@offside/app-core/api/membership';
 import {getMyCareers} from '@offside/app-core/api/client';
 import type {PublicHofEntry} from '@offside/contracts';
 import {membershipText as L} from '@offside/app-core/i18n/ko/membership';
 import {go} from '../nav';
 let open=$state(false),busy=$state(false),error=$state(''),query=$state(''),entries=$state<PublicHofEntry[]>([]),selected=$state<string[]>([]);
 const chosen=$derived(selected.flatMap(id=>entries.filter(e=>e.id===id)));
 const metrics=['peak','apps','goals','assists','trophies','legendScore'] as const;
 async function show(){if(open){open=false;return;}busy=true;error='';const m=await fetchMembership();if(!m.ok){error=L.error;busy=false;return;}if(!m.data.membership.active){busy=false;go('membership');return;}const r=await getMyCareers();busy=false;if(r.ok){entries=r.data.entries;open=true;}else error=L.failed;}
 function toggle(id:string){selected=selected.includes(id)?selected.filter(v=>v!==id):selected.length<3?[...selected,id]:selected;}
</script>
<section class="card stack" data-member-comparison>
 <button class="btn" disabled={busy} aria-expanded={open} onclick={show}>{L.compare}</button>
 {#if error}<p role="status">{error}</p>{/if}
 {#if open}
  <p>{L.comparePick}</p>
  {#if entries.length}
   <input aria-label={L.search} placeholder={L.search} bind:value={query}/>
   <div class="picker">{#each entries.filter(e=>(e.name??'').toLowerCase().includes(query.toLowerCase())).slice(0,100) as entry (entry.id)}<button class="btn" aria-pressed={selected.includes(entry.id)} disabled={selected.length===3&&!selected.includes(entry.id)} onclick={()=>toggle(entry.id)}>{entry.name??entry.id} · {L.season} {entry.season??0}</button>{/each}</div>
   {#if chosen.length}<div class="comparison"><table><thead><tr><th scope="col">{L.metric}</th>{#each chosen as entry (entry.id)}<th scope="col">{entry.name??entry.id}</th>{/each}</tr></thead><tbody>{#each metrics as key (key)}<tr><th scope="row">{L[key]}</th>{#each chosen as entry (entry.id)}<td>{entry[key].toLocaleString()}</td>{/each}</tr>{/each}</tbody></table></div>{/if}
  {:else}<p>{L.compareEmpty}</p>{/if}
 {/if}
</section>
<style>.picker{display:flex;flex-wrap:wrap;gap:8px;max-height:260px;overflow:auto}.picker button{min-height:48px;white-space:normal}.picker button[aria-pressed=true]{outline:2px solid var(--good)}.comparison{overflow:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:center;padding:10px 4px;overflow-wrap:anywhere;font-size:12px;border-bottom:1px solid var(--line)}th:first-child{width:26%;text-align:left}input{width:100%;min-height:48px;box-sizing:border-box;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:12px}</style>
