<script lang="ts">
  import { onMount } from 'svelte';
  import { createCupAdmin, emptyCupAdmin } from '@offside/app-core/admin/cupPredictions';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { predictionPercentages } from '@offside/app-core/cupPredictions';
  import { roundLabel } from '../cup/cupView';
  import { toast } from '../helpers';
  let { cups }: {cups: import('@offside/app-core/api/admin').AdminCup[]}=$props();
  let s=$state(emptyCupAdmin());
  const model=createCupAdmin(v=>s=v);
  let reason=$state('');
  const seasons=$derived([...new Set(s.cups.map(x=>x.cup.season))]);
  const active=$derived(s.report?.items.find(x=>x.match.id===s.matchId));
  onMount(()=>{void model.load(cups); return ()=>model.dispose();});
  async function recover(){
    if(!confirm(L.adminRecoverConfirm))return;
    if(await model.recover(reason)){reason='';toast(L.adminRecovered);}
  }
</script>
<section class="pred-admin stack" data-admin="cup-predictions">
  <h2>{L.adminPredictionTitle}</h2>
  <p class="muted fs-sm">{L.adminPredictionNote}</p>
  <div class="filters">
    <label>{L.adminSeason}<select value={s.season} disabled={s.busy} onchange={e=>model.season(Number(e.currentTarget.value))}>{#each seasons as n (n)}<option value={n}>{n}</option>{/each}</select></label>
    <label>{L.adminCompetition}<select value={s.cupId} disabled={s.busy} onchange={e=>model.select(e.currentTarget.value)}>{#each s.cups.filter(x=>x.cup.season===s.season) as x (x.cup.id)}<option value={x.cup.id}>{L.edition({n:x.cup.edition})}</option>{/each}</select></label>
    <button class="btn" disabled={s.loading||s.busy} onclick={()=>model.refresh()}>{L.adminRefresh}</button>
  </div>
  {#if s.error}<p role="alert">{s.error}</p>{/if}
  {#if s.loading}<p role="status">{L.loading}</p>
  {:else if s.report}
    <div class="summary"><span>{L.adminPeople} <b>{s.report.participants}</b></span>{#each [['total',L.adminTotal],['hits',L.adminHits],['granted',L.adminGranted]] as [key,label] (key)}<span>{label} <b>{s.report.items.reduce((n,x)=>n+x[key as 'total'|'hits'|'granted'],0)}</b></span>{/each}</div>
    {#each s.report.items as x (x.match.id)}
      {@const m=x.match}
      {@const pct=predictionPercentages({...x,matchId:m.id})}
      <article class="match" data-admin-match={m.id}>
        <div class="row"><span class="muted fs-xs">{roundLabel(m.round)} {m.group?L.groupName({no:m.group}):''} · {kst(m.at)}</span></div>
        <div class="admin-score-row"><b>{x.homeName||L.tbd}</b><div class="admin-score-center"><span class="pill" class:good={m.played} class:cup-upcoming={!m.played && m.at > new Date().toISOString()} class:warn={!m.played && m.at <= new Date().toISOString()}>{m.played?L.matchFinished:m.at<=new Date().toISOString()?L.matchProcessing:L.matchScheduled}</span><b>{m.played?`${m.homeGoals} : ${m.awayGoals}`:'vs'}</b></div><b>{x.awayName||L.tbd}</b></div>
        <div class="shares"><span>{L.predictionHome} {pct.home}%</span>{#if m.round.startsWith('g')}<span>{L.predictionDraw} {pct.draw}%</span>{/if}<span>{L.predictionAway} {pct.away}%</span></div>
        <p class="muted fs-xs">{L.adminTotal} {x.total} · {L.adminHits} {x.hits} · {L.adminGranted} {x.granted}{#if m.played} · {L.adminPending} {x.pending} · {L.adminUnpaid} {x.unpaid}{/if}</p>
        <button class="btn" disabled={s.busy} onclick={()=>{reason='';void model.details(m.id);}}>{L.adminDetails}</button>
        {#if s.matchId===m.id}
          <div class="detail" data-admin-prediction-detail>
            <button class="btn" disabled={s.busy} onclick={model.close}>{L.adminClose}</button>
            {#if s.detailLoading}<p role="status">{L.loading}</p>{/if}
            {#if s.rows && !s.rows.items.length}<p class="muted">{L.predictionEmpty}</p>{/if}
            {#each s.rows?.items??[] as r (r.profileId)}
              <div class="person"><b>{r.nickname}</b><small>{r.profileId}</small><span>{r.pick==='home'?L.predictionHome:r.pick==='away'?L.predictionAway:L.predictionDraw} · {r.correct===null?(m.played?L.adminPending:L.predictionSelected):r.correct?L.predictionHit:L.predictionMiss}{r.rewardedAt?` · ${L.predictionRewarded}`:r.correct?` · ${L.adminUnpaid}`:''}</span><small class="muted">{kst(r.updatedAt)}</small></div>
            {/each}
            {#if s.rows?.next}<button class="btn" disabled={s.detailLoading||s.busy} onclick={()=>model.details(m.id,true)}>{L.adminMore}</button>{/if}
            {#if active?.match.played}
              <label>{L.adminReason}<textarea maxlength="200" bind:value={reason} disabled={s.busy}></textarea></label>
              <button class="btn" disabled={s.busy||reason.trim().length<5||!(x.pending+x.unpaid)} onclick={recover}>{s.busy?L.loading:L.adminRecover}</button>
            {/if}
          </div>
        {/if}
      </article>
    {/each}
  {:else}<p>{L.adminNoCups}</p>{/if}
</section>
<style>
  .admin-score-row{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center}.admin-score-row>b:first-child{text-align:right}.admin-score-row>b{overflow-wrap:anywhere}.admin-score-center{display:flex;flex-direction:column;align-items:center;gap:4px}.admin-score-center .pill{white-space:nowrap}
  h2,p{margin:0}.pred-admin{gap:12px;margin-top:20px;min-width:0}.filters{display:flex;flex-wrap:wrap;align-items:end;gap:8px}.filters label{flex:1;min-width:100px}label{display:flex;flex-direction:column;gap:6px;font-size:13px}select,textarea{min-height:44px;width:100%;min-width:0}textarea{resize:vertical}.summary,.shares{display:flex;flex-wrap:wrap;gap:8px 16px}.summary{padding:12px;border:1px solid var(--line);border-radius:12px}.match{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding:14px 0;min-width:0}.match>.row{flex-wrap:wrap}.person{overflow-wrap:anywhere}.detail{display:flex;flex-direction:column;gap:12px;border-left:2px solid var(--accent);padding-left:12px}.person{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--line)}.btn{min-height:44px}
</style>
