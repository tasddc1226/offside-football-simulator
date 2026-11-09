<script lang="ts">
  // T-11-648 감독 커리어 3(감독 키우기) 진행 화면. 커리어는 기기에서 돌고(세이브 ft_mgr3_save), 끝나면 감독 카드로 확정한다.
  import type { ManagerCareer } from '@offside/contracts';
  import type { ManagerStyle } from '@offside/contracts/manager-rules';
  import { tn } from '@offside/game/i18n/names';
  import { endingDesc, endingName, leagueName, specialName, styleName, targetName } from '@offside/game/manager';
  import {
    M3_ATTRS,
    M3_BLOCKS,
    M3_FORMATIONS,
    M3_TALKS,
    acceptOffer,
    squadDisplayName,
    answerBid,
    answerEvent,
    attrCap,
    autoLineup,
    bestSeason3,
    boardMinimum,
    canRetire,
    closeWindow,
    continueBlock,
    continueReview,
    expectedRank,
    listPlayer,
    managerResult3,
    playBlock,
    playerValue,
    releasePlayer,
    renewPlayer,
    renewWage,
    restSeason,
    retire,
    setPlan,
    signTarget,
    sortTable,
    spendPoint,
    startSeason,
    stayAtClub,
    targetOptions,
    wageBill,
    type BidResult,
    type M3Attr,
    type M3Level,
    type M3State,
  } from '@offside/game/manager3';
  import {
    clearManager3State,
    loadManager3State,
    saveManager3State,
  } from '@offside/app-core/manager3';
  import { blockRounds, eventView, playerLine, retireInfo, roleName, seasonSteps3 } from '@offside/app-core/manager3View';
  import { abandonManager, finishManager } from '@offside/app-core/manager';
  import { fmtValue } from '@offside/app-core/format';
  import { manager3Text as T } from '@offside/app-core/i18n/ko/manager3';
  import { managerText as M } from '@offside/app-core/i18n/ko/manager';
  import { untrack } from 'svelte';
  import { buzz } from './motion.js';

  let { career, name, onchange }: { career: ManagerCareer; name: string; onchange: () => void } = $props();

  // 부모가 커리어 id로 다시 만들므로 처음 값만 읽는다.
  let st = $state.raw<M3State>(untrack(() => loadManager3State(career, name)));
  let busy = $state(false);
  let error = $state<string | null>(null);
  let note = $state<string | null>(null);
  let tab = $state<'targets' | 'squad' | 'bids'>('targets');
  let confirmRetire = $state(false);
  let confirmAbandon = $state(false);
  let pickTarget = $state(untrack(() => boardMinimum(st)));

  /** 엔진 함수로 상태를 바꾸고 저장한다. 엔진이 제자리에서 바꾸므로 사본에 적용해 화면이 다시 그려지게 한다. */
  function act<R>(fn: (s: M3State) => R): R {
    const next = structuredClone(st);
    const out = fn(next);
    saveManager3State(next);
    if (next.phase === 'preseason' && st.phase !== 'preseason') pickTarget = boardMinimum(next);
    st = next;
    return out;
  }

  const pname = (n: string) => squadDisplayName(n);
  const lvl = (n: M3Level) => [T.level0, T.level1, T.level2][n]!;
  const ev = $derived(st.phase === 'blockResult' ? (st.lastReport?.event ?? null) : null);
  const evText = $derived(ev ? eventView(st, ev) : null);
  const steps = $derived(seasonSteps3(st));
  const table = $derived(st.table.length ? sortTable(st.table) : []);
  const myRank = $derived(st.club ? table.findIndex((t) => t.clubId === st.club!.id) + 1 : 0);
  const lineup = $derived(st.phase === 'block' ? autoLineup(st.squad, st.plan.formation, 55) : []);
  const result = $derived(st.phase === 'done' ? managerResult3(st) : null);
  const best = $derived(st.phase === 'done' ? bestSeason3(st) : null);
  const cap = $derived(attrCap(st.license));

  function bid(i: number) {
    const t = st.targets[i];
    if (!t) return;
    const nm = pname(t.player.name);
    const r: BidResult = act((s) => signTarget(s, i));
    note =
      r === 'signed'
        ? T.bid_signed({ name: nm })
        : r === 'refused'
          ? T.bid_refused({ name: nm })
          : r === 'money'
            ? T.bid_money
            : r === 'full'
              ? T.bid_full
              : T.bid_none;
    buzz(r === 'signed' ? 30 : 10);
  }
  function closeWin() {
    const sold = act(closeWindow);
    note = sold?.length ? T.soldLine({ names: sold.map(pname).join(', ') }) : null;
  }
  function play() {
    note = null;
    act(playBlock);
    buzz(20);
  }

  async function finish() {
    const res = managerResult3(st);
    if (!res) return;
    busy = true;
    error = null;
    const r = await finishManager(st.id, res);
    busy = false;
    if (!r.ok) {
      error = T.cardSendFail;
      return;
    }
    clearManager3State();
    onchange();
  }
  async function abandon() {
    busy = true;
    error = null;
    const r = await abandonManager(st.id);
    busy = false;
    if (!r.ok) {
      error = r.error.message;
      return;
    }
    clearManager3State();
    confirmAbandon = false;
    onchange();
  }
</script>

<section class="card mg-col m3" data-manager3={st.phase}>
  <div class="mg-head">
    <b>{name}</b>
    <span class="muted fs-sm"
      >{T.seasonLabel({ n: st.season + (st.phase === 'done' ? 0 : 1) })} · {T.ageLabel({ age: st.age })} · {T.licenseLabel({ license: st.license })}</span
    >
    <span class="fs-sm">{st.club ? `${tn(st.club.name)} · ${leagueName(st.club.leagueId)}` : T.noClub}</span>
  </div>
  <dl class="mg-stats">
    <div><dt>{T.repLabel}</dt><dd>{st.rep}</dd></div>
    <div><dt>{T.boardLabel}</dt><dd>{st.board}</dd></div>
    <div><dt>{T.fansLabel}</dt><dd>{st.fans}</dd></div>
    <div><dt>{T.harmonyLabel}</dt><dd>{st.harmony}</dd></div>
  </dl>
  {#if st.phase !== 'done'}
    <div class="mg-progress" data-manager3-steps={steps.active}>
      <div class="prog" role="progressbar" aria-label={M.stepsLabel} aria-valuemin={0} aria-valuemax={1} aria-valuenow={steps.progress}><i style:width="{steps.progress * 100}%"></i></div>
      <ol class="mg-steps">
        {#each steps.steps as t, i (i)}<li class:on={i === steps.active} class:done={i < steps.active}>{t}</li>{/each}
      </ol>
    </div>
  {/if}
  {#if st.club && st.phase !== 'offers' && st.phase !== 'preseason' && st.phase !== 'done'}
    <p class="muted fs-sm">{T.budgetLabel} {fmtValue(st.club.budget)} · {T.wageLabel} {fmtValue(wageBill(st))} / {fmtValue(st.club.wageBudget)}</p>
  {/if}
</section>

{#if st.phase === 'offers'}
  <section class="card mg-col" data-manager3-offers>
    <h2>{T.offersHeading}</h2>
    {#each st.offers as o, i (o.clubId)}
      <div class="mg-row">
        <span class="mg-info">
          <b>{tn(o.name)}</b>
          <small>{T.offerMeta({ league: leagueName(o.leagueId), str: Math.round(o.base) })}{#if o.vacancy} · {T.offerVacancy}{/if}</small>
        </span>
        <button class="btn btn-sm btn-primary" data-act="m3-accept" onclick={() => act((s) => acceptOffer(s, i))}>{T.offerAccept}</button>
      </div>
    {:else}
      <p class="muted fs-sm">{T.offersEmpty}</p>
    {/each}
    <div class="m3-actions">
      {#if st.club}<button class="btn" data-act="m3-stay" onclick={() => act(stayAtClub)}>{T.offerStay}</button>{/if}
      {#if !st.club && !st.offers.length}<button class="btn" data-act="m3-rest" onclick={() => act(restSeason)}>{T.offerRest}</button>{/if}
    </div>
  </section>
{:else if st.phase === 'preseason' && st.club}
  {@const exp = expectedRank(st)}
  <section class="card mg-col" data-manager3-preseason>
    <h2>{T.preseasonHeading}</h2>
    <p class="fs-sm">{T.facilities({ train: st.club.trainFac, youth: st.club.youthFac })} · {T.expected(exp)}</p>
    <h3>{T.targetHeading}</h3>
    <p class="muted fs-sm">{T.targetLead}</p>
    <div class="mg-chips" role="radiogroup" aria-label={T.targetHeading}>
      {#each targetOptions(st) as t (t)}
        <button class="mg-chip" role="radio" aria-checked={pickTarget === t} class:on={pickTarget === t} onclick={() => (pickTarget = t)}
          >{targetName(t)}{#if t === boardMinimum(st)}<small>{T.targetMin}</small>{/if}</button
        >
      {/each}
    </div>
    <button class="btn btn-primary" data-act="m3-season" onclick={() => act((s) => startSeason(s, pickTarget))}>{T.seasonStart}</button>
  </section>
{:else if st.phase === 'window'}
  <section class="card mg-col" data-manager3-window={st.window}>
    <h2>{st.window === 'winter' ? T.windowWinter : T.windowSummer}</h2>
    <div class="mg-chips" role="tablist">
      <button class="mg-chip" role="tab" aria-selected={tab === 'targets'} class:on={tab === 'targets'} onclick={() => (tab = 'targets')}>{T.tabTargets}</button>
      <button class="mg-chip" role="tab" aria-selected={tab === 'squad'} class:on={tab === 'squad'} onclick={() => (tab = 'squad')}>{T.tabSquad}</button>
      <button class="mg-chip" role="tab" aria-selected={tab === 'bids'} class:on={tab === 'bids'} onclick={() => (tab = 'bids')}>{T.tabBids({ n: st.bids.length })}</button>
    </div>
    {#if tab === 'targets'}
      {#each st.targets as t, i (t.player.id)}
        <div class="mg-row" data-manager3-target>
          <span class="mg-info">
            <b>{pname(t.player.name)}</b>
            <small>{T.targetMeta({ role: roleName(t.player), age: t.player.age, club: t.fromClub ? tn(t.fromClub) : T.freeAgent })}</small>
            <small>{T.ovrRange({ lo: t.ovrLo, hi: t.ovrHi })} · {T.potRange({ lo: t.potLo, hi: t.potHi })} · {T.fee({ fee: fmtValue(t.fee) })} · {T.willing({ pct: Math.round(t.willing * 100) })}</small>
          </span>
          <button class="btn btn-sm" data-act="m3-bid" onclick={() => bid(i)}>{T.bid}</button>
        </div>
      {/each}
    {:else if tab === 'squad'}
      {#each st.squad as p (p.id)}
        <div class="mg-row" data-manager3-player>
          <span class="mg-info">
            <b>{pname(p.name)}{#if p.academy}<small> · {T.academy}</small>{/if}</b>
            <small>{playerLine(p)} · {T.contract({ n: p.contract })} · {T.wage({ wage: fmtValue(p.wage) })}</small>
          </span>
          <span class="m3-btns">
            <button class="btn btn-sm" onclick={() => act((s) => listPlayer(s, p.id, p.listed === null ? playerValue(p) : null))}>{p.listed === null ? T.list : T.unlist}</button>
            <button class="btn btn-sm mg-danger" onclick={() => act((s) => releasePlayer(s, p.id))}>{T.release}</button>
          </span>
        </div>
      {/each}
    {:else}
      {#each st.bids as b, i (b.player)}
        {@const p = st.squad.find((x) => x.id === b.player)}
        <div class="mg-row">
          <span class="mg-info"><small>{T.bidFrom({ club: tn(b.club), name: p ? pname(p.name) : '', fee: fmtValue(b.fee) })}</small></span>
          <span class="m3-btns">
            <button class="btn btn-sm" onclick={() => act((s) => answerBid(s, i, true))}>{T.bidAccept}</button>
            <button class="btn btn-sm" onclick={() => act((s) => answerBid(s, i, false))}>{T.bidReject}</button>
          </span>
        </div>
      {/each}
    {/if}
    {#if note}<p class="fs-sm" role="status">{note}</p>{/if}
    <button class="btn btn-primary" data-act="m3-close-window" onclick={closeWin}>{T.windowClose}</button>
  </section>
{:else if st.phase === 'block'}
  {@const rr = blockRounds(st)}
  <section class="card mg-col" data-manager3-block={st.block}>
    <h2>{T.blockHeading({ n: st.block + 1, total: M3_BLOCKS })}</h2>
    <p class="muted fs-sm">{T.blockRounds(rr)}{#if myRank} · {T.tableRow({ rank: myRank, pts: table[myRank - 1]!.pts })}{/if}</p>
    {#if note}<p class="fs-sm" role="status">{note}</p>{/if}
    <h3>{T.planFormation}</h3>
    <div class="mg-chips" role="radiogroup" aria-label={T.planFormation}>
      {#each M3_FORMATIONS as f (f)}
        <button class="mg-chip" role="radio" aria-checked={st.plan.formation === f} class:on={st.plan.formation === f} onclick={() => act((s) => setPlan(s, { formation: f }))}
          >{f}<small>{T.famLabel({ n: st.fam[f] })}</small></button
        >
      {/each}
    </div>
    <h3>{T.planMentality}</h3>
    <div class="mg-chips" role="radiogroup" aria-label={T.planMentality}>
      {#each ['attack', 'balance', 'defense', 'counter'] as ManagerStyle[] as m (m)}
        <button class="mg-chip" role="radio" aria-checked={st.plan.mentality === m} class:on={st.plan.mentality === m} onclick={() => act((s) => setPlan(s, { mentality: m }))}>{styleName(m)}</button>
      {/each}
    </div>
    {#each [['press', T.planPress, T.pressDesc], ['line', T.planLine, T.lineDesc], ['tempo', T.planTempo, T.tempoDesc]] as const as [k, label, desc] (k)}
      <div class="m3-level">
        <span class="fs-sm">{label}</span>
        <div class="mg-chips" role="radiogroup" aria-label={label}>
          {#each [0, 1, 2] as M3Level[] as n (n)}
            <button class="mg-chip" role="radio" aria-checked={st.plan[k] === n} class:on={st.plan[k] === n} onclick={() => act((s) => setPlan(s, { [k]: n }))}>{lvl(n)}</button>
          {/each}
        </div>
        <small class="muted">{desc}</small>
      </div>
    {/each}
    <h3>{T.planTalk}</h3>
    <div class="mg-chips" role="radiogroup" aria-label={T.planTalk}>
      {#each M3_TALKS as t (t)}
        <button class="mg-chip" role="radio" aria-checked={st.plan.talk === t} class:on={st.plan.talk === t} onclick={() => act((s) => setPlan(s, { talk: t }))}>{T[`talk_${t}`]}</button>
      {/each}
    </div>
    <small class="muted">{T[`talkDesc_${st.plan.talk}`]}</small>
    <details>
      <summary class="disc-row">{T.lineupHeading} · {T.lineupAuto}<span class="disc-chev" aria-hidden="true"></span></summary>
      <ul class="m3-list">
        {#each lineup as id, i (i)}
          {@const p = st.squad.find((x) => x.id === id)}
          <li>{p ? `${pname(p.name)} · ${playerLine(p)} · ${T.fitness} ${p.fit}` : T.lineupEmpty}</li>
        {/each}
      </ul>
    </details>
    <details>
      <summary class="disc-row">{T.tableHeading}<span class="disc-chev" aria-hidden="true"></span></summary>
      <ol class="m3-list">
        {#each table as t (t.clubId)}<li class:me={t.clubId === st.club?.id}>{tn(t.name)} · {t.pts}</li>{/each}
      </ol>
    </details>
    <button class="btn btn-primary" data-act="m3-play" onclick={play}>{T.playBlock}</button>
  </section>
{:else if st.phase === 'blockResult' && st.lastReport}
  {@const rep = st.lastReport}
  <section class="card mg-col" data-manager3-result={rep.block}>
    <h2>{T.resultHeading({ n: rep.block + 1 })}</h2>
    <p class="fs-sm">{T.rankMove({ from: rep.rankBefore, to: rep.rankAfter })} · {T.moraleAvg({ n: rep.morale })}</p>
    <ul class="m3-list">
      {#each rep.matches as m, i (i)}
        <li class:win={m.gf > m.ga || m.pens === true} class:loss={m.gf < m.ga || m.pens === false}>
          {#if m.cup}<b>{T.cupTag}</b>{/if}
          {tn(m.oppName)} · {m.home ? T.home : T.away} · {m.gf}:{m.ga}{#if m.pens !== undefined} · {m.pens ? T.pensWon : T.pensLost}{/if}
          {#if m.scorers.length}<small class="muted"> {T.scorers({ names: m.scorers.map((id) => pname(st.squad.find((p) => p.id === id)?.name ?? '')).join(', ') })}</small>{/if}
        </li>
      {/each}
    </ul>
    {#if rep.injuries.length}<p class="fs-sm">{T.injuries({ names: rep.injuries.map((id) => pname(st.squad.find((p) => p.id === id)?.name ?? '')).join(', ') })}</p>{/if}
    {#if ev && evText}
      <div class="m3-event" data-manager3-event={ev.id}>
        <h3>{evText.title}</h3>
        <p>{evText.body}</p>
        {#if evText.result === null}
          {#each evText.choices as c, i (i)}<button class="btn" data-act="m3-choice" onclick={() => act((s) => answerEvent(s, i))}>{c}</button>{/each}
        {:else}
          <p class="mg-log">{evText.result}</p>
        {/if}
      </div>
    {/if}
    {#if !ev || ev.choice !== null}
      <button class="btn btn-primary" data-act="m3-next" onclick={() => act(continueBlock)}
        >{st.block >= M3_BLOCKS ? T.toReview : st.block === 3 ? T.toWinter : T.next}</button
      >
    {/if}
  </section>
{:else if st.phase === 'review' && st.review}
  {@const rv = st.review}
  {@const h = rv.record}
  <section class="card mg-col" data-manager3-review>
    <h2>{T.reviewHeading({ n: h.n })}</h2>
    <p>{T.reviewRank({ club: tn(h.club ?? ''), rank: h.rank, teams: h.teams })}</p>
    <p class="muted fs-sm">{T.reviewRecord({ w: h.w, d: h.d, l: h.l, gf: h.gf, ga: h.ga })}</p>
    <div class="mg-chips">
      {#if h.title}<span class="mg-chip mg-static">{T.reviewTitle}</span>{/if}
      {#if h.cup}<span class="mg-chip mg-static">{T.reviewCup}</span>{/if}
      {#if h.promoted}<span class="mg-chip mg-static">{T.reviewPromoted}</span>{/if}
      {#if h.relegated}<span class="mg-chip mg-static">{T.reviewRelegated}</span>{/if}
      {#if h.award}<span class="mg-chip mg-static">{T.reviewAward}</span>{/if}
      <span class="mg-chip mg-static">{h.met ? T.reviewMet : T.reviewMissed}</span>
    </div>
    {#if h.topScorer}<p class="fs-sm">{T.reviewTopScorer({ name: pname(h.topScorer.name), goals: h.topScorer.goals })}</p>{/if}
    {#if rv.sacked}<p class="mg-err">{rv.midSeason ? T.reviewSackedMid : T.reviewSacked}</p>{/if}
    {#if rv.licenseUp}<p class="fs-sm">{T.reviewLicense({ license: rv.licenseUp })}</p>{/if}
    {#if rv.growth.length}
      <details>
        <summary class="disc-row">{T.growthHeading}<span class="disc-chev" aria-hidden="true"></span></summary>
        <ul class="m3-list">
          {#each [...rv.growth].sort((a, b) => b.d - a.d) as g (g.id)}
            {@const p = st.squad.find((x) => x.id === g.id)}
            {#if p}<li>{T.growthLine({ name: pname(p.name), d: g.d })}</li>{/if}
          {/each}
        </ul>
      </details>
    {/if}
    {#if rv.retired.length}<p class="fs-sm">{T.retiredHeading} · {rv.retired.map(pname).join(', ')}</p>{/if}
    {#if rv.intake.length}<p class="fs-sm">{T.intakeHeading} · {rv.intake.map((id) => pname(st.squad.find((p) => p.id === id)?.name ?? '')).join(', ')}</p>{/if}
    {#if rv.expiring.length}
      <h3>{T.expiringHeading}</h3>
      <p class="muted fs-sm">{T.expiringLead}</p>
      {#each rv.expiring as id (id)}
        {@const p = st.squad.find((x) => x.id === id)}
        {#if p}
          <div class="mg-row">
            <span class="mg-info"><b>{pname(p.name)}</b><small>{playerLine(p)} · {T.renewWage({ wage: fmtValue(renewWage(st, p)) })}</small></span>
            <button class="btn btn-sm" onclick={() => act((s) => renewPlayer(s, id))}>{T.renew}</button>
          </div>
        {/if}
      {/each}
    {/if}
    <h3>{T.pointsHeading({ n: st.points })}</h3>
    <p class="muted fs-sm">{T.pointsLead({ cap })}</p>
    <div class="m3-attrs">
      {#each M3_ATTRS as k (k)}
        <div class="m3-attr" title={T[`attrDesc_${k}`]}>
          <span class="fs-sm">{T[`attr_${k}`]}</span>
          <span class="m3-bar"><i style:width="{st.attrs[k]}%"></i></span>
          <b>{st.attrs[k]}</b>
          <button class="btn btn-sm" aria-label={T.pointAdd({ attr: T[`attr_${k}`] })} disabled={st.points <= 0 || st.attrs[k] >= cap} onclick={() => act((s) => spendPoint(s, k as M3Attr))}>+</button>
        </div>
      {/each}
    </div>
    <div class="m3-actions">
      <button class="btn btn-primary" data-act="m3-continue" onclick={() => act(continueReview)}>{T.continueSeason}</button>
      {#if canRetire(st)}<button class="btn" data-act="m3-retire" onclick={() => (confirmRetire = true)}>{T.retire}</button>{/if}
    </div>
    {#if retireInfo(st)}<p class="muted fs-sm">{retireInfo(st)}</p>{/if}
    <p class="muted fs-sm">{T.forcedEnd}</p>
  </section>
{:else if st.phase === 'done' && result}
  <section class="card mg-col" data-manager3-card>
    <h2>{T.cardHeading}</h2>
    <p><b>{M.grade({ grade: result.grade })}</b> · {endingName(result.ending)} · {T.cardSeasons({ n: result.seasons })}</p>
    <p class="muted fs-sm">{endingDesc(result.ending)}</p>
    <p class="fs-sm">{T.cardRecord(result)}</p>
    {#if best && best.club}<p class="fs-sm">{T.cardBest({ n: best.n, club: tn(best.club), rank: best.rank })}</p>{/if}
    <div class="mg-chips">
      {#each Object.entries(result.mastery) as [f, g] (f)}<span class="mg-chip mg-static">{f}<small>{M.mastery({ grade: g })}</small></span>{/each}
    </div>
    <p class="fs-sm">{M.style} {styleName(result.style)} · {M.specials} {result.specials.length ? result.specials.map(specialName).join(' · ') : M.noSpecials}</p>
    <div class="m3-attrs">
      {#each M3_ATTRS as k (k)}
        <div class="m3-attr"><span class="fs-sm">{T[`attr_${k}`]}</span><span class="m3-bar"><i style:width="{st.attrs[k]}%"></i></span><b>{st.attrs[k]}</b></div>
      {/each}
    </div>
    {#if error}<p class="mg-err" role="alert">{error}</p>{/if}
    <button class="btn btn-primary" data-act="m3-finish" disabled={busy} onclick={() => void finish()}>{T.cardConfirm}</button>
  </section>
{/if}

{#if st.history.length}
  <details class="card" data-manager3-history>
    <summary class="disc-row">{T.historyHeading}<span class="disc-chev" aria-hidden="true"></span></summary>
    <ul class="mg-hist">
      {#each st.history as h, i (i)}
        <li>{h.clubId && h.club ? T.historyRow({ n: h.n, club: tn(h.club), rank: h.rank, teams: h.teams }) : `${h.n} · ${T.historyRest}`}</li>
      {/each}
    </ul>
  </details>
{/if}
{#if st.phase !== 'done'}
  <button class="btn mg-abandon" data-act="m3-abandon" onclick={() => ((confirmAbandon = true), (error = null))}>{M.abandon}</button>
{/if}

{#if confirmRetire}
  <button class="mg-scrim" aria-label={M.cancel} onclick={() => (confirmRetire = false)}></button>
  <div class="mg-sheet" role="dialog" aria-modal="true" aria-label={T.retire} data-manager3-retire>
    <h2>{T.retire}</h2>
    <p>{T.retireConfirm}</p>
    <div class="mg-actions">
      <button class="btn" onclick={() => (confirmRetire = false)}>{M.cancel}</button>
      <button class="btn btn-primary" data-act="m3-retire-confirm" onclick={() => ((confirmRetire = false), act(retire))}>{T.retire}</button>
    </div>
  </div>
{/if}
{#if confirmAbandon}
  <button class="mg-scrim" aria-label={M.cancel} onclick={() => (confirmAbandon = false)}></button>
  <div class="mg-sheet" role="dialog" aria-modal="true" aria-label={M.abandon} data-manager-abandon>
    <h2>{M.abandon}</h2>
    <p>{M.abandonConfirm}</p>
    {#if error}<p class="mg-err" role="alert">{error}</p>{/if}
    <div class="mg-actions">
      <button class="btn" onclick={() => (confirmAbandon = false)}>{M.cancel}</button>
      <button class="btn mg-danger" data-act="m3-abandon-confirm" disabled={busy} onclick={() => void abandon()}>{M.abandonOk}</button>
    </div>
  </div>
{/if}

<style>
  h3 {
    margin: 0.5rem 0 0;
    font-size: 0.95rem;
  }
  .m3-actions,
  .m3-btns {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .m3-level {
    display: grid;
    gap: 0.25rem;
  }
  .m3-list {
    margin: 0.25rem 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.2rem;
    font-size: 0.9rem;
  }
  .m3-list .me {
    font-weight: 700;
  }
  .m3-list .win {
    color: var(--good, inherit);
  }
  .m3-list .loss {
    color: var(--bad, inherit);
  }
  .m3-event {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 12px;
    background: var(--surface-2, rgba(127, 127, 127, 0.08));
  }
  .m3-attrs {
    display: grid;
    gap: 0.35rem;
  }
  .m3-attr {
    display: grid;
    grid-template-columns: 7.5rem 1fr 2rem auto;
    align-items: center;
    gap: 0.5rem;
  }
  .m3-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--line, rgba(127, 127, 127, 0.2));
    overflow: hidden;
  }
  .m3-bar i {
    display: block;
    height: 100%;
    background: var(--accent, currentColor);
  }
</style>
