<script lang="ts" module>
  // T-11-605 후보에서 입력으로 돌아온 사람에게 같은 후보가 나오는 이유를 알린다. 화면이 단계마다 다시 그려져 모듈에 둔다.
  let returned = false;
</script>

<script lang="ts">
  import { createScoutItems } from './createScoutItems.svelte.js';
  import { pickCreateDetail, setCreatePosition, toggleCreateFocus } from '@offside/app-core/create-controls';
  import { createCandidateReveal } from './createCandidateReveal.svelte.js';
  import PositionGuide from './PositionGuide.svelte';
  import ItemsHint from './ItemsHint.svelte';
  import { tn } from '@offside/game/i18n/names';
  // 선수 생성(T-10-022): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
  // T-11-605 입력을 포지션 → 주력 → 특성 → 정보(선택: 더 꾸미기)로 나눠 한 화면에 한 가지만 고른다. 어느 단계에서든 기본값으로 후보를 볼 수 있다.
  // appState.candidates가 있으면 후보 카드 비교·선택.
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { CREATE_PROGRESS, candidateEdge, createProgressAt, detailBlurb, nextCreateStep, numberInvalid, positionTendency, prevCreateStep, type CreateStep } from '@offside/app-core/create-steps';
  import { COACH_STEPS } from '@offside/app-core/tutorial';
  import { coach } from './coach.svelte.js';
  import { clearCreateDraft, restoreCreateDraft, saveCreateDraft } from './createDraft.js';
  import { watchDetailOpening } from '@offside/app-core/season-opening';
  import { cubicOut } from 'svelte/easing';
  import { fly, slide } from 'svelte/transition';
  import { POS, DPOS, DETAILS_OF, TRAITS, ATTR_KEYS, FOCUS_PICK, attrLabels, focusMod, posLabel } from '@offside/game/data';
  import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
  import { baseline, candidatePotentialGrades } from '@offside/game/candidates';
  // T-11-196 프리미엄 후보 식을 등록한다(첫 화면 번들에서 떼어 둠).
  import '@offside/game/premiumScout';
  import { appState, detailOpenNow, draftBody, draftDpos, randomName } from './state.svelte.js';
  import { CONFEDS, flagOf } from '@offside/contracts/nations';
  import { BODY_LIMITS, BODY_DEFAULT, bmiOf, bodyError } from '@offside/contracts/body';
  import { isKorean, nationOf } from '@offside/game/nation';
  import { startCareer, rollCandidates, revealCandidatePotential, keepCandidate, keptDraft, restoreKeptDraft } from './actions.js';
  import { clubBlock, clubOffer, loadClubShop, payWithClub } from '@offside/app-core/club-reward';
  import { fundsText } from '@offside/app-core/funds';
  import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
  import type { RewardShopResponse } from '@offside/contracts';
  import { REROLL_MILEAGE, rerollMileageLeft } from '@offside/contracts/cup';
  import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';
  import { scoutWhatText } from '@offside/app-core/scoutOdds';
  import ScoutOdds from './cup/ScoutOdds.svelte';
  import ScoutPityGauge from './ScoutPityGauge.svelte';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
  import { go, goHome, goRerollShop } from './nav.js';
  import { bodyNote, focusNote, hiddenStrength, scoutLine, startOvr, ovrFocusView, seasonStartNote } from '@offside/app-core/create-view';
  import { dur } from './motion.js';
  import { createText as L } from '@offside/app-core/i18n/ko/create';
  import MiniRadar from './MiniRadar.svelte';
  import NationPicker from './NationPicker.svelte';
  import CreateLook from './CreateLook.svelte';
  import { doneOnEnter } from './inputDone.js';
  import ScoutScan from './ScoutScan.svelte';
  import RevealFx from './RevealFx.svelte';
  import CountUp from './CountUp.svelte';
  import { gradeTier, revealTotal } from '@offside/app-core/reveal';
  import { revealText as R } from '@offside/app-core/i18n/ko/reveal';

  const C = appState.C;
  // T-11-654 지금 만들면 어느 시즌 선수인지 — 기록실 · 시즌 업적으로 이어진다(휴식기면 없음).
  const seasonNote = seasonStartNote(new Date().toISOString());
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const; // 저장값(화면에는 L.foot으로)
  // T-10-091 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  let detailOpen = $state(detailOpenNow());
  // T-11-294 탭을 새로 열면 기본값이다. 킵한 후보가 있으면 그 조건으로 맞춰 바로 다시 나오게 한다(T-11-327 앱을 연 뒤 한 번).
  // T-11-605 새로 고침이면 고르던 입력과 단계를 되살린다.
  if (!restoreCreateDraft()) restoreKeptDraft({ auto: true });
  if (detailOpenNow() && !draftDpos(C)) pickDetail(DETAILS_OF[C.pos][0]!);
  onMount(() => watchDetailOpening(() => {
    detailOpen = true;
    // 개막 전 골라 둔 주력·후보 능력치는 유지한다.
    if (!draftDpos(C)) C.dpos = DETAILS_OF[C.pos][0]!;
  }));
  const dpos = $derived(draftDpos(C));
  // 킵 저장소는 반응형이 아니라 후보 목록이 바뀔 때도 다시 본다(킵하고 입력으로 돌아온 경우).
  const kept = $derived.by(() => {
    void appState.candidates;
    return keptDraft();
  });
  const focusLeft = $derived(FOCUS_PICK - C.focus.length);
  // 고른 조합이 시작 분포를 어떻게 바꾸는지 버튼마다 미리 보여준다(주력 ▲ / 가장 덜 쓰는 능력치 ▼).
  const preview = $derived(focusMod(C.pos, C.focus));
  const ovrFocus = $derived(ovrFocusView(C.pos, C.focus, dpos));

  const step = $derived<'form' | 'candidates'>(appState.candidates ? 'candidates' : 'form');
  const labels = $derived(attrLabels(C.pos));
  const picked = $derived(appState.candidates && appState.candidatePick != null ? appState.candidates[appState.candidatePick]! : null);
  // 라이브 카드의 레이더·OVR: 후보를 골랐으면 그 후보, 아니면 지금 조합의 기준 분포.
  const cardAttrs = $derived(picked?.attrs ?? baseline(C.pos, C.focus, dpos));
  const trait = $derived(TRAITS.find((t) => t.id === C.trait));

  // T-10-096 국적·체격
  const nation = $derived(nationOf(C));
  const foreign = $derived(!isKorean(C));
  const body = $derived(draftBody(C));
  const bodyErr = $derived(bodyError(body));
  const note = $derived(bodyNote(C.pos, body));
  const LIM = BODY_LIMITS;

  // T-11-605 단계
  let heading = $state<HTMLElement | null>(null);
  const numErr = $derived(numberInvalid(C.number));
  const progress = $derived(createProgressAt(appState.createStep, !!appState.candidates));
  const progressNo = $derived(CREATE_PROGRESS.indexOf(progress) + 1);
  const progressName = { pos: L.navPos, focus: L.navFocus, trait: L.navTrait, info: L.navInfo, candidates: L.navCand };
  const title = $derived(
    appState.candidates ? L.titleCandidates : { pos: L.titlePos, focus: L.titleFocus, trait: L.titleTrait, info: L.titleInfo, extra: L.titleExtra }[appState.createStep],
  );
  const lastForm = $derived(appState.createStep === 'info' || appState.createStep === 'extra');
  /** 후보를 볼 수 없는 이유. 없으면 null. */
  const blocker = $derived(bodyErr ? L.checkBody : numErr ? L.checkNumber : focusLeft > 0 ? L.focusMore({ n: focusLeft }) : null);
  function goStep(s: CreateStep) {
    if (appState.candidates) backToForm();
    appState.createStep = s;
    window.scrollTo(0, 0);
    void tick().then(() => heading?.focus({ preventScroll: true }));
  }
  // 안내의 다음 버튼으로 주력 단계로 넘어가면 화면도 같이 넘어간다. 사용자가 이전으로 돌아오는 것은 막지 않는다.
  $effect(() => {
    const id = coach.i === null ? null : COACH_STEPS[coach.i]?.id;
    untrack(() => {
      if (id === 'focus' && appState.createStep === 'pos' && !appState.candidates) appState.createStep = 'focus';
    });
  });
  // 입력이 바뀔 때마다 이 탭에 적어 둔다. 커리어를 시작하면 지운다(confirmPick).
  $effect(() => {
    JSON.stringify(C);
    void appState.createStep;
    if (appState.screen === 'create') saveCreateDraft();
  });
  onDestroy(() => {
    if (appState.screen === 'create') return;
    returned = false;
  });

  function setPos(v: Pos) { setCreatePosition(C, v, detailOpen); }
  function pickDetail(d: DetailPos) { pickCreateDetail(C, d); }
  function toggleFocus(k: AttrKey) { toggleCreateFocus(C, k); }
  // T-10-111 후보를 바로 보여 주지 않고 스카우트가 추리는 연출(약 3초)이 끝난 뒤에 뽑는다.
  let scouting = $state(false);
  const scoutSteps = $derived([
    L.stepVideo({ nation: tn(nation.ko) }),
    L.stepPool({ pos: posLabel({ pos: C.pos, dpos }) }),
    L.stepFocus({ list: C.focus.map((k) => labels[k]).join('·') }),
    L.stepBody({ h: body.h, w: body.w }),
    L.stepDone,
  ]);
  function scouted() {
    rollCandidates();
    scouting = false;
  }
  // T-11-145 선수 후보 리롤권(오프사이드 컵 보상) — 로그인한 구단주가 1장 이상 가졌을 때만 '후보 다시 뽑기'를 보인다.
  // 후보 단계에 들어올 때 한 번 장수를 묻고(로그인 흔적이 없으면 묻지 않는다), 쓸 때마다 서버가 돌려준 장수로 바꾼다.
  const scoutItems = createScoutItems(() => step === 'candidates');
  const premium = $derived(!!appState.candidates?.some((c) => c.guaranteed));
  const guest = !hasSessionHint();
  const quiet = $derived(scoutItems.state.rerolls < 1 && scoutItems.state.scouts < 1 && scoutItems.state.pity.used < 1);
  // T-11-153 웹은 보상형 광고가 없어 로그인한 구단주가 구단 자금으로 후보 잠재력을 본다. 구단주(장수를 받음)이고 아직 안 봤을 때만 묻는다.
  let club = $state<RewardShopResponse | null>(null);
  let clubLoaded = $state(false);
  let clubBusy = $state(false);
  let clubMsg = $state('');
  $effect(() => {
    if (step !== 'candidates' || !scoutItems.state.owner || appState.candidatePotentialOpen) return;
    void loadClubShop().then((r) => {
      club = r;
      clubLoaded = true;
    });
  });
  const clubCand = $derived(appState.candidatePotentialOpen ? null : clubOffer(club, 'candidates'));
  const clubLock = $derived(appState.candidatePotentialOpen ? null : clubBlock(club, 'candidates'));
  // T-11-628 웹에서도 볼 수 있는데 앱 안내가 떠서 웹에는 없는 기능으로 읽혔다. 비로그인은 맨 위 소개, 자금 버튼 · 못 보는 이유가 있으면 그 안내로
  // 충분하다. 구단 자금 값을 받지 못했거나 팔지 않을 때만 앱 안내를 둔다.
  const appPotentialHint = $derived(!appState.candidatePotentialOpen && scoutItems.state.owner && clubLoaded && !clubCand && !clubLock);
  // 카드 아래 도구 묶음: 쓸 수 있는 도구가 있는 묶음만 보인다.
  const hasChangeTools = $derived(scoutItems.state.scouts > 0 || scoutItems.state.pity.used > 0 || scoutItems.state.rerolls > 0 || scoutItems.state.owner);
  const hasPotentialTools = $derived(appState.candidatePotentialOpen || (!quiet && appPotentialHint) || !!clubLock || !!clubCand || !!clubMsg);
  async function revealWithClub() {
    const o = clubCand;
    if (clubBusy || !o) return;
    clubBusy = true;
    clubMsg = '';
    const batch = appState.candidates;
    let saveFailed = false;
    const r = await payWithClub(o, confirm, () => (saveFailed = !revealCandidatePotential(batch)));
    clubBusy = false;
    if (!r) return;
    if (r.shop) club = r.shop;
    clubMsg = saveFailed ? L.potentialSaveFailed : r.message;
  }
  function backToForm() {
    returned = true;
    appState.candidates = null;
  }
  function openAll() {
    appState.candidatesOpen.forEach((_, i) => reveal.stage(i));
    appState.candidatesOpen = appState.candidatesOpen.map(() => true);
  }
  // 카드를 누르면(닫혀 있든 열려 있든) 바로 열리면서 그 후보가 선택된다 — 한 번의 탭으로
  // "오픈 + 선택"이 끝나는 모바일 우선 상호작용. "모두 오픈"은 선택 없이 전부 펼쳐만 준다.
  function pick(i: number) {
    // 연출 중인 카드를 다시 누르면 바로 결과로 간다.
    if (reveal.state.fx[i] && !reveal.state.fx[i].done) reveal.land(i);
    reveal.stage(i);
    appState.candidatesOpen[i] = true;
    appState.candidatePick = i;
  }
  function confirmPick() {
    if (!picked) return;
    startCareer(C.name, C.number, picked.attrs, picked.potential);
    if (appState.screen === 'game') clearCreateDraft();
  }
  // T-11-371 팩 오픈식 공개: 열 때 보이는 값(OVR · 보장 · 천장)으로만 강도를 정한다. 이 화면에서 연 카드만 연출하고,
  // 같은 화면의 두 번째 카드부터는 짧게. 감속 모션 · 업무 모드 · "연출 짧게"면 결과만.
  const reveal = createCandidateReveal(C);
  // 카드가 세로축으로 뒤집히며 열린다. 감속 모션이면 duration 0(즉시 표시). 대박은 뒷면에서 한 박자 쉬고 뒤집힌다.
  // 닫힌 카드 높이에서 열린 높이로 함께 자라, 아래 카드가 한 프레임에 밀리지 않는다.
  function flipIn(node: Element, delay = 0) {
    const h = node.getBoundingClientRect().height;
    return { delay, duration: dur(360), easing: cubicOut, css: (t: number) => `transform: perspective(800px) rotateY(${(1 - t) * 90}deg); opacity: ${Math.min(1, t * 2)}; height: ${closedH + (h - closedH) * t}px; overflow: hidden` };
  }
  let closedH = 60;
  function closedSize(node: HTMLElement) {
    closedH = node.offsetHeight;
  }
</script>
{#snippet loginTools()}
  <p class="muted fs-sm" data-login-tools>
    {L.loginTools} <button class="link-btn" data-act="login-tools-go" onclick={() => go('owner')}>{L.loginToolsGo}</button>
  </p>
{/snippet}
{#snippet ovrGuide(showTitle = true)}
  <div class="ovr-guide" data-testid="ovr-guide">
    {#if showTitle}<b>{ovrFocus.title}</b>{/if}
    <p>{ovrFocus.groups}</p>
    <p class="muted">{ovrFocus.subs}</p>
    <p class="muted">{ovrFocus.note}</p>
    <p class="muted">{L.ovrStartNote}</p>
  </div>
{/snippet}


<div class="wrap has-cta create-wizard" class:compact-candidates={!!appState.candidates && quiet} class:extra={appState.createStep === 'extra' && !appState.candidates}>
  <div class="cw-head">
    <h1 bind:this={heading} tabindex="-1">{title}</h1>
    <nav class="cw-steps" aria-label={L.stepNav}>
      {#each CREATE_PROGRESS as s, i (s)}
        {#if s === 'candidates'}
          <span class="cw-step" class:on={progress === s} aria-current={progress === s ? 'step' : undefined}><i></i>{progressName[s]}</span>
        {:else}
          <button type="button" class="cw-step" class:on={progress === s} class:done={i < progressNo - 1} data-step-go={s} aria-current={progress === s ? 'step' : undefined} onclick={() => goStep(s)}><i></i>{progressName[s]}</button>
        {/if}
      {/each}
    </nav>
  </div>

  {#if step === 'form'}
    <section class="live-card compact" aria-label={L.previewLabel}>
      <div class="lc-num">
        <b class="num">{C.number || '–'}</b>
        <span>{dpos ?? C.pos}</span>
      </div>
      <div class="lc-main">
        <b class="lc-name">{C.name.trim() || L.noName}</b>
        <span class="lc-meta"><span aria-hidden="true">{flagOf(nation.code)}</span> {tn(nation.ko)} · {appState.createStep === 'info' || appState.createStep === 'extra' ? `${L.foot({ v: C.foot })}${bodyErr ? '' : ` · ${body.h}cm ${body.w}kg`}` : posLabel({ pos: C.pos, dpos })}</span>
        <span class="lc-meta">{#if trait}{trait.icon} {trait.name}{/if}{C.focus.length ? ` · ${L.focusTag({ list: C.focus.map((k) => labels[k]).join('·') })}` : ''}</span>
      </div>
      <div class="lc-side">
        <MiniRadar pos={C.pos} attrs={cardAttrs} size={44} />
        <span class="lc-ovr">{L.ovrEst} <b class="num"><CountUp value={startOvr(C.pos, cardAttrs)} animate={false} ms={280} /></b></span>
      </div>
    </section>

    {#if returned}<p class="muted fs-sm cw-note" data-same-candidates>{L.sameCandidates}</p>{/if}

    <section class="card stack create-form">
      {#if appState.createStep === 'pos'}
        <div class="field" data-coach="pos">
          <span class="lbl">{L.position}</span>
          <div class="seg pos-grid">
            {#each posKeys as k (k)}
              <button class="opt dpos-opt" data-set="pos" data-val={k} aria-pressed={C.pos === k} onclick={() => setPos(k)}><b>{tn(POS[k].label)}</b></button>
            {/each}
          </div>
        </div>
        {#if detailOpen && DETAILS_OF[C.pos].length > 1}
          <div class="field">
            <span class="lbl">{L.detailPosition}</span>
            <div class="seg three dpos-grid">
              {#each DETAILS_OF[C.pos] as d (d)}
                <button class="opt dpos-opt" data-set="dpos" data-val={d} aria-pressed={C.dpos === d} onclick={() => pickDetail(d)}>
                  <b>{tn(DPOS[d].label)}</b>
                </button>
              {/each}
            </div>
          </div>
        {/if}
        <div class="dpos-panel" data-dpos-panel aria-live="polite">
          <b>{dpos ? detailBlurb(dpos) : POS[C.pos].blurb}</b>
          {#if positionTendency(C.pos, dpos)}<span class="fs-sm" data-tendency>{positionTendency(C.pos, dpos)}</span>{/if}
          {#if detailOpen && DETAILS_OF[C.pos].length > 1}<span class="muted fs-sm">{L.detailNote}</span>{/if}
        </div>
        {#if kept}
          <div class="stack" data-kept-elsewhere>
            <p class="fs-sm">{L.keptElsewhere({ pos: posLabel(kept), focus: kept.focus.map((k) => labels[k]).join('·') })}</p>
            <button class="btn btn-sm self-start" data-act="restore-kept" onclick={() => restoreKeptDraft()}>{L.keptRestore}</button>
          </div>
        {/if}
      {:else if appState.createStep === 'focus'}
        <div class="field" data-coach="focus">
          <span class="lbl">{L.focusTitle({ n: FOCUS_PICK })}</span>
          <div class="seg two">
            {#each ATTR_KEYS as k (k)}
              {@const d = preview[k] ?? 0}
              <button class="opt focus-opt" data-set="focus" data-val={k} aria-pressed={C.focus.includes(k)} onclick={() => toggleFocus(k)}>
                <b class:ovr-core={ovrFocus.keys.includes(k)}>{labels[k]}</b><small class:up={d > 0} class:down={d < 0}>{focusNote(C.focus.includes(k), d)}</small>
              </button>
            {/each}
          </div>
          <p class="muted fs-sm">{L.focusMeaning}</p>
          <!-- T-11-651 고른 주력 조합으로 정해지는 유형을 바로 보여 준다(은퇴 카드에 남는 유형). -->
          <p class="fs-sm focus-type" data-focus-type={ovrFocus.typeId}>{ovrFocus.typeLine}</p>
        </div>
        <details class="ovr-more" data-testid="ovr-guide">
          <summary class="disc-row"><span>{ovrFocus.title}: {ovrFocus.groups}</span><span class="disc-chev" aria-hidden="true"></span></summary>
          <div class="stack">
            <p class="muted fs-sm">{L.ovrWhy}</p>
            <p class="muted fs-sm">{ovrFocus.subs}</p>
            <p class="muted fs-sm">{ovrFocus.note}</p>
            <p class="muted fs-sm">{L.ovrStartNote}</p>
            <!-- T-11-234 타깃맨·골 사냥꾼 같은 유형별 주력 능력치를 생성 중에도 본다(커리어 시작 뒤 시즌 탭과 같은 안내). -->
            <PositionGuide pos={C.pos} />
          </div>
        </details>
      {:else if appState.createStep === 'trait'}
        <div class="field">
          <span class="lbl">{L.trait}</span>
          <div class="stack trait-list">
            {#each TRAITS as t (t.id)}
              <button class="opt trait-opt" data-set="trait" data-val={t.id} aria-pressed={C.trait === t.id} onclick={() => (C.trait = t.id)}>
                <b><span aria-hidden="true">{t.icon}</span> {t.name}</b><small>{t.desc}</small>
              </button>
            {/each}
          </div>
        </div>
        <p class="muted fs-sm">{L.potentialNote}</p>
      {:else if appState.createStep === 'info'}
        <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
          <div class="field" style="flex:1;min-width:0">
            <label for="f-name">{L.name}</label>
            <div class="name-input">
              <input type="text" id="f-name" maxlength="12" autocomplete="off" enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter bind:value={C.name} />
              <button type="button" class="dice" data-act="random-name" aria-label={L.randomName} onclick={() => (C.name = randomName())}><span aria-hidden="true">🎲</span> {L.randomNameShort}</button>
            </div>
          </div>
          <div class="field" style="width:84px;flex:none">
            <label for="f-num">{L.number}</label>
            <input type="number" id="f-num" inputmode="numeric" min="1" max="99" placeholder="1–99" enterkeyhint="done" use:doneOnEnter bind:value={C.number} aria-invalid={numErr} aria-describedby="f-id-note" />
          </div>
        </div>
        <p class="fs-sm cw-note" class:muted={!numErr} class:body-err={numErr} id="f-id-note" data-number-note aria-live="polite">
          {numErr ? L.numberErr : !C.number ? L.numberHint : L.nameHint}
        </p>
        <div class="field">
          <label for="f-nation">{L.nation}</label>
          <NationPicker id="f-nation" bind:value={C.nation} />
          <p class="muted fs-sm" data-nation-note>
            {foreign ? L.nationForeign({ nation: tn(nation.ko), cup: tn(CONFEDS[nation.conf].cup) }) : L.nationHome} {L.nationSame}
          </p>
        </div>
        <button class="btn" data-step-go="extra" onclick={() => goStep('extra')}>{L.moreCustomize} →</button>
      {:else}
        <p class="muted fs-sm cw-note">{L.extraNote}</p>
        <div class="field">
          <span class="lbl">{L.body}</span>
          <div class="row body-row">
            <label class="body-in" for="f-height">
              <span class="sr-only">{L.height}</span>
              <input type="number" id="f-height" inputmode="numeric" min={LIM.height.min} max={LIM.height.max} placeholder={String(BODY_DEFAULT[C.pos].h)} value={C.height ?? BODY_DEFAULT[C.pos].h} oninput={(e) => (C.height = e.currentTarget.value === '' ? null : Math.round(+e.currentTarget.value))} enterkeyhint="done" use:doneOnEnter aria-invalid={!!bodyErr} aria-describedby="f-body-note" />
              <span aria-hidden="true">cm</span>
            </label>
            <label class="body-in" for="f-weight">
              <span class="sr-only">{L.weight}</span>
              <input type="number" id="f-weight" inputmode="numeric" min={LIM.weight.min} max={LIM.weight.max} placeholder={String(BODY_DEFAULT[C.pos].w)} value={C.weight ?? BODY_DEFAULT[C.pos].w} oninput={(e) => (C.weight = e.currentTarget.value === '' ? null : Math.round(+e.currentTarget.value))} enterkeyhint="done" use:doneOnEnter aria-invalid={!!bodyErr} aria-describedby="f-body-note" />
              <span aria-hidden="true">kg</span>
            </label>
          </div>
          <p class="fs-sm" class:muted={!bodyErr} class:body-err={!!bodyErr} id="f-body-note" data-body-note aria-live="polite">
            {#if bodyErr}
              {bodyErr}
            {:else}
              {L.bodyNote({ bmi: bmiOf(body).toFixed(1), note })}
            {/if}
          </p>
        </div>
        <div class="field">
          <span class="lbl">{L.footLabel}</span>
          <div class="seg three">
            {#each feet as f (f)}
              <button class="opt" data-set="foot" data-val={f} aria-pressed={C.foot === f} onclick={() => (C.foot = f)}><b>{L.foot({ v: f })}</b></button>
            {/each}
          </div>
        </div>
        <CreateLook />
      {/if}
    </section>

    <!-- 주력을 덜 고르면 아래 버튼이 같은 안내를 하므로 빠른 링크를 두지 않는다. -->
    {#if !lastForm && !(appState.createStep === 'focus' && blocker === L.focusMore({ n: focusLeft }))}
      <div class="cw-quick">
        <button class="link-btn" data-act="next-candidates" data-coach="candidates" disabled={!!blocker} onclick={() => (scouting = true)}>{blocker ?? L.quickCandidates}</button>
        <span class="muted fs-sm">{L.quickNote}</span>
      </div>
    {/if}

    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        {#if appState.createStep === 'pos'}
          <button class="btn" data-act="home" onclick={goHome}>{L.cancel}</button>
        {:else}
          <button class="btn" data-act="step-prev" onclick={() => goStep(prevCreateStep(appState.createStep)!)}>{L.prev}</button>
        {/if}
        {#if lastForm}
          <button class="btn btn-primary" data-act="next-candidates" data-coach="candidates" disabled={!!blocker} onclick={() => (scouting = true)}>{blocker ?? L.seeCandidates}</button>
        {:else}
          <button class="btn btn-primary" data-act="step-next" disabled={appState.createStep === 'focus' && focusLeft > 0} onclick={() => goStep(nextCreateStep(appState.createStep)!)}>
            {appState.createStep === 'focus' && focusLeft > 0 ? L.focusMore({ n: focusLeft }) : L.next}
          </button>
        {/if}
      </div>
    </div>
  {:else if appState.candidates}
    <div class="row cand-intro">
      {#if guest && !appState.candidatePotentialOpen}
        <p class="muted" data-cand-login>{L.potentialLogin} <button class="link-btn" data-act="potential-login-go" onclick={() => go('owner')}>{L.potentialLoginGo}</button></p>
      {:else}
        <p class="muted">{L.candIntro}</p>
      {/if}
      {#if appState.candidatesOpen.some((o) => !o)}
        <button class="icon-btn" data-act="open-all" onclick={openAll}>{L.openAll}</button>
      {/if}
    </div>
    <!-- T-11-437 카드의 OVR이 확정값처럼 보이지 않게 소개 바로 아래에 둔다(앱과 같은 자리). -->
    <p class="muted fs-sm cand-note" data-candidate-stats-note>{L.candNote}</p>
    <!-- T-11-221 후보 카드를 먼저 보이고, 다시 뽑기 · 잠재력 보기 같은 도구는 카드 아래로. -->
    <div class="cand-list" data-coach="cands">
      {#each appState.candidates as cand, i (i)}
        {#if appState.candidatesOpen[i]}
          {@const f = reveal.state.fx[i]}
          {@const tier = reveal.tiers[i] ?? 'normal'}
          <button class="cand-card open rv-card rv-{tier}" class:compact={appState.candidatePick !== i} class:rv-run={f && !f.done} class:rv-land={f?.done && revealTotal(f) > 0} class:picked={appState.candidatePick === i} data-cand={i} data-cand-open="true" data-reveal={f ? (f.done ? 'done' : 'hint') : 'static'} data-reveal-tier={tier} style:--rv-hint="{f && !f.done ? f.hint : 0}ms" style:--rv-delay="{f && !f.done ? f.back : 0}ms" aria-pressed={appState.candidatePick === i} onclick={() => pick(i)} in:flipIn={f?.back ?? 0}>
            {#if f?.done && revealTotal(f) > 0}<span class="sr-only" aria-live="polite">{R.candLive({ n: i + 1, ovr: startOvr(C.pos, cand.attrs), tier: tier === 'jackpot' ? R.jackpot : tier === 'good' ? R.good : '' })}</span>{/if}
            <span class="cc-head">
              <span class="cc-no">{L.candNo({ n: i + 1 })}</span>
              <span class="cc-ovr">OVR <b class="num">{#if f && f.hint > 0 && !f.done}<CountUp value={startOvr(C.pos, cand.attrs)} ms={f.back + f.hint} />{:else}{startOvr(C.pos, cand.attrs)}{/if}</b></span>
              {#if cand.pity}<span class="pill good" data-cand-pity={cand.pity}>{cand.pity === 'elite' ? SL.pillElite : SL.pillSure}</span>{:else if cand.guaranteed}<span class="pill" data-cand-sure>{SL.sure}</span>{/if}
              {#if cand.kept}<span class="pill" data-cand-kept>{L.kept}</span>{/if}
              {#if appState.candidatePick === i}<span class="pill good">{L.picked}</span>{/if}
            </span>
            {#if appState.candidatePick !== i && !appState.candidatePotentialOpen && !cand.kept?.revealed}
              <!-- T-11-605 고르지 않은 카드는 잠재력 비공개를 되풀이하지 않고 비교할 내용만 보인다. -->
            {:else if appState.candidatePotentialOpen || cand.kept?.revealed}
              {@const g = candidatePotentialGrades(cand.potential)}
              {#if reveal.state.potFresh && !cand.kept?.revealed}
                <span class="muted" data-cand-potential={i}><RevealFx grade={`${g.min}~${g.max}`} text={L.potentialRange(g)} tier={gradeTier(g.max)} /></span>
              {:else}
                <span class="muted" data-cand-potential={i}>{L.potentialRange(g)}</span>
              {/if}
            {:else}
              <span class="muted" data-cand-potential={i}>{L.potentialLocked}</span>
            {/if}
            <span class="cc-scout">“{scoutLine(C.pos, cand.attrs, C.focus)}”</span>
            {#if appState.candidatePick === i}
            <span class="cc-detail" transition:slide={{ duration: dur(360), easing: cubicOut }}>
            <span class="muted fs-sm" data-cand-edge={i}>{candidateEdge(C.pos, appState.candidates, i)}</span>
            <span class="cc-body">
              <MiniRadar pos={C.pos} attrs={cand.attrs} size={84} />
              <span class="cc-bars">
                {#each ATTR_KEYS as k (k)}
                  {@const v = Math.round(cand.attrs[k])}
                  <span class="cc-bar" class:hi={cand.hintKeys.includes(k)}>
                    <span class:ovr-core={ovrFocus.keys.includes(k)}>{labels[k]}</span>
                    <i><em style:width="{v}%"></em></i>
                    <b class="num">{v}</b>
                  </span>
                {/each}
              </span>
            </span>
            </span>
            {/if}
          </button>
        {:else}
          <button class="cand-card" data-cand={i} use:closedSize onclick={() => pick(i)} in:fly|global={{ y: 14, duration: dur(280), delay: dur(90 * i) }}>
            <span class="cand-n">?</span>
            <span class="cc-closed">
              <b>{L.candNo({ n: i + 1 })}</b>
              <small>{L.scoutMemo({ k: labels[hiddenStrength(cand.attrs, C.focus)] })}</small>
            </span>
            <span class="cc-tap" aria-hidden="true">{L.tapToOpen}</span>
          </button>
        {/if}
      {/each}
    </div>
    {#if premium}<p class="muted fs-sm" data-premium-note>{SL.premiumNote}</p>{/if}
    <!-- 카드 아래 도구를 고른 후보 · 다른 후보 찾기 · 잠재력 확인으로 묶는다. -->
    {#if picked || hasChangeTools || hasPotentialTools}
      <section class="card cand-tools" data-cand-tools>
        {#if picked}
          {@const n = appState.candidatePick! + 1}
          <div class="tool-group" data-tools="picked">
            <div class="tool-row">
              <h2 class="tool-h">{L.toolsPicked}</h2>
              <button class="btn btn-sm" data-act="keep-candidate" aria-pressed={!!picked.kept} onclick={() => keepCandidate(picked.kept ? null : appState.candidatePick)}>
                {picked.kept ? L.unkeepBtn({ n }) : L.keepBtn({ n })}
              </button>
            </div>
            {#if !quiet}<p class="muted fs-sm">{L.keepHelp}</p>{/if}
          </div>
        {/if}
        {#if hasChangeTools}
          <div class="tool-group" data-tools="change">
            <h2 class="tool-h">{L.toolsChange}</h2>
            {#if scoutItems.state.scouts > 0}
              <button class="btn btn-sm btn-primary self-start" data-act="premium-scout" disabled={scoutItems.state.scoutBusy || scoutItems.state.rerolling} onclick={scoutItems.premiumScout}>{scoutItems.state.scoutBusy ? SL.busy : SL.btn({ n: scoutItems.state.scouts })}</button>
              <p class="muted fs-sm">{scoutWhatText()}</p>
              <ScoutPityGauge pity={scoutItems.state.pity} />
              <ScoutOdds />
            {:else if scoutItems.state.pity.used > 0}
              <ScoutPityGauge pity={scoutItems.state.pity} empty />
            {/if}
            {#if scoutItems.state.rerolls > 0}
              <button class="btn btn-sm self-start" data-act="reroll-candidates" disabled={scoutItems.state.rerolling} onclick={scoutItems.reroll}>{scoutItems.state.rerolling ? CL.rerollBusy : CL.rerollBtn({ n: scoutItems.state.rerolls })}</button>
              <p class="muted fs-sm" data-reroll-mileage>{CL.rerollMileage({ n: rerollMileageLeft(scoutItems.state.mileage), need: REROLL_MILEAGE })}</p>
            {:else if scoutItems.state.owner}
              <p class="muted fs-sm" data-reroll-hint>
                {CL.createShopHint} <button class="link-btn" data-act="reroll-shop-go" onclick={goRerollShop}>{CL.createShopGo}</button>
              </p>
            {/if}
          </div>
        {/if}
        {#if hasPotentialTools}
          <div class="tool-group" data-tools="potential">
            <h2 class="tool-h">{L.toolsPotential}</h2>
            {#if clubCand}
              <button class="btn btn-sm self-start" data-act="candidate-potential-club" disabled={clubBusy} onclick={revealWithClub}>
                {clubBusy ? B.clubBusy : B.clubCandidates({ price: fundsText(clubCand.price) })}
              </button>
            {/if}
            <!-- T-11-610 잠재력을 왜 못 보는지 접지 않고 보인다. 구단주는 모자란 자금 · 오늘 상한(비로그인은 맨 위 소개에서 안내). -->
            {#if clubLock}
              <p class="muted fs-sm" data-cand-club-lock={clubLock.reason}>
                {clubLock.reason === 'short' ? L.potentialClubShort({ price: fundsText(clubLock.price), balance: fundsText(clubLock.balance) }) : L.potentialClubCapped}
              </p>
            {/if}
            {#if appState.candidatePotentialOpen}
              <p class="muted fs-sm">{premium ? SL.premiumHelp : L.potentialHelp}</p>
            {:else if !quiet && appPotentialHint}
              <p class="muted fs-sm" data-cand-app-hint>{L.potentialWeb}</p>
            {/if}
            {#if clubMsg}<p class="muted fs-sm" aria-live="polite">{clubMsg}</p>{/if}
          </div>
        {/if}
      </section>
    {/if}
    {#if guest && !quiet}
      {@render loginTools()}
    {/if}
    {#if !quiet}
      <!-- T-11-355 상품 위치 안내(설정과 같은 카드, 기기마다 닫을 때까지) -->
      <ItemsHint />
    {/if}
    {#if quiet}
      <!-- T-11-437 쓸 도구가 없으면 상점 위치 · 능력치 설명을 한 번에 접어 둔다. -->
      <details class="card more-tools" data-more-tools>
        <summary class="disc-row" data-act="more-tools-toggle">{L.moreTools}<span class="disc-chev" aria-hidden="true"></span></summary>
        <div class="stack more-body">
          {#if guest}{@render loginTools()}{/if}
          {#if picked}<p class="muted fs-sm">{L.keepHelp}</p>{/if}
          {#if appPotentialHint}<p class="muted fs-sm" data-cand-app-hint>{L.potentialWeb}</p>{/if}
          <ItemsHint />
          {@render ovrGuide()}
          <p class="muted fs-sm">{L.ovrCore}</p>
          <PositionGuide pos={C.pos} />
        </div>
      </details>
    {:else}
      <!-- T-11-221 OVR 주요 능력치 설명은 펼침 행으로 접어 둔다(후보 카드를 아래로 밀지 않게). -->
      <details class="card ovr-guide-box">
        <summary class="disc-row" data-act="ovr-guide-toggle">{ovrFocus.title}<span class="disc-chev" aria-hidden="true"></span></summary>
        {@render ovrGuide(false)}
        <p class="muted fs-sm">{L.ovrCore}</p>
      </details>
      <div class="card position-guide-box"><PositionGuide pos={C.pos} /></div>
    {/if}

    {#if seasonNote}<p class="muted fs-sm season-note" data-create-season-note>{seasonNote}</p>{/if}
    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        <button class="btn" data-act="home" onclick={backToForm}>{L.back}</button>
        <button class="btn btn-primary" data-act="start" data-coach="start" disabled={appState.candidatePick == null} onclick={confirmPick}>
          {appState.candidatePick == null ? L.pickOne : L.kickoff({ n: appState.candidatePick + 1 })}
        </button>
      </div>
    </div>
  {/if}
</div>
{#if scouting}<ScoutScan pos={C.pos} steps={scoutSteps} onDone={scouted} />{/if}

<style>
/* T-11-605 단계 머리 · 작은 미리보기: 360×780에서 한 단계가 스크롤 없이 들어온다. */
.create-wizard { gap: 10px; --progress: var(--pitch); --sel: var(--pitch); }
/* 금색은 후보의 강점 · 공개 연출에만 쓴다. 다크 모드 초록은 배경에 묻혀 선택지(.opt)와 같은 금색을 쓴다. */
:global(:root[data-theme='dark']) .create-wizard { --progress: var(--ink); --sel: var(--accent); }
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light'])) .create-wizard { --progress: var(--ink); --sel: var(--accent); }
}
.create-wizard { padding-top: calc(10px + var(--safe-t)); }
.cw-head { display: flex; flex-direction: column; gap: 4px; }
.cw-head h1 { margin: 0; font-size: var(--fs-title2); line-height: 1.25; outline: none; word-break: keep-all; }
.cw-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
.cw-step { display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; min-height: 36px; padding: 0; border: 0; background: none; color: var(--muted); font-size: var(--fs-caption2); font-weight: 600; text-align: left; word-break: keep-all; }
.cw-step i { display: block; height: 4px; border-radius: 2px; background: var(--line); }
.cw-step.done i, .cw-step.on i { background: var(--progress); }
.cw-step.on { color: var(--ink); }
.cw-note { margin: 0; }
.live-card.compact { padding: 8px 12px; gap: 10px; box-shadow: none; }
.compact .lc-num b { font-size: var(--fs-title1); line-height: 1; }
.compact .lc-main { min-width: 0; gap: 0; }
.compact .lc-name { font-size: var(--fs-body); }
.compact .lc-meta { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: var(--fs-caption); }
.compact .lc-side { flex-direction: row; gap: 6px; }
.compact .lc-ovr b { margin-left: 0; }
.compact .lc-ovr { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.create-form { gap: 8px; padding: 12px; }
.create-form .lbl { margin-bottom: 2px; }
.pos-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
/* 영어 · 일본어 포지션 이름은 네 칸에 안 들어가 단어가 잘린다. */
:global(html[lang='en']) .pos-grid, :global(html[lang='ja']) .pos-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dpos-grid { gap: 6px; }
.dpos-opt { align-items: center; padding: 4px 6px; text-align: center; font-size: var(--fs-label); line-height: 1.2; word-break: keep-all; }
.dpos-panel { display: flex; flex-direction: column; gap: 2px; padding-left: 10px; border-left: 3px solid var(--progress); font-size: var(--fs-label); line-height: 1.4; }
.focus-opt b.ovr-core { text-decoration: underline; text-underline-offset: 3px; }
.focus-type { font-weight: 600; }
.ovr-more .stack { gap: 6px; padding-bottom: 8px; }
.ovr-more p { margin: 0; }
.trait-list { gap: 8px; }
.cw-quick { display: flex; flex-direction: column; align-items: center; text-align: center; }
.cw-quick .link-btn { min-height: 32px; }
.create-wizard .name-input input { padding-right: 74px; }
.create-wizard .name-input .dice { display: flex; align-items: center; justify-content: center; gap: 2px; width: auto; padding: 0 6px; font-size: var(--fs-caption); font-weight: 600; white-space: nowrap; }
.cand-card.compact { gap: 2px; padding: 8px 14px; }
.create-wizard .cand-card { padding-block: 10px; gap: 10px; }
.create-wizard .cand-card.open { gap: 4px; }
.create-wizard .cand-card .cand-n { width: 36px; height: 36px; font-size: var(--fs-title3); }
.create-wizard .cc-no { font-size: var(--fs-body); }
.create-wizard .cc-ovr b { font-size: var(--fs-title3); }
.create-wizard .cc-scout { line-height: 1.3; }
.create-wizard .cc-bars { gap: 2px; }
.create-wizard .cc-bar { line-height: 1.15; }
.create-wizard .cc-bar b { font-size: var(--fs-label); line-height: 1.15; }
/* 도구가 적은 후보 화면은 공개 연출이 끝난 높이도 360×780 안에 둔다.
   설명·버튼 크기·진행 바의 안전 여백은 유지하고 카드/도구 사이 공간만 줄인다. */
@media (max-height: 780px) {
  .create-wizard.compact-candidates { gap: 4px; }
  .compact-candidates .cand-list { gap: 8px; }
  .compact-candidates .cand-card { padding-block: 6px; }
  .compact-candidates .cand-tools { padding: 0; }
}
/* 주소창까지 있는 브라우저의 작은 화면: 보조 설명을 접어 고르는 칸을 먼저 보인다. */
@media (max-height: 700px) {
  .create-wizard { gap: 8px; }
  .cw-quick .muted { display: none; }
  .compact .lc-meta + .lc-meta { display: none; }
  .cand-note { display: none; }
  .create-wizard.extra .live-card { display: none; }
}
.cand-card.open.picked:not(.rv-good.rv-land, .rv-jackpot.rv-land, .rv-jackpot.rv-run) { border-color: var(--sel); box-shadow: inset 0 0 0 1.5px var(--sel), var(--shadow); }
.cc-detail { display: flex; flex-direction: column; gap: 4px; }
.cand-tools { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
.tool-group { display: flex; flex-direction: column; gap: 6px; }
.tool-group p { margin: 0; }
.tool-group + .tool-group { padding-top: 12px; border-top: 1px solid var(--line); }
.tool-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; }
.tool-h { margin: 0; font-size: var(--fs-label); font-weight: 600; color: var(--muted); }
.ovr-guide-box, .position-guide-box, .more-tools { padding-block: 0; }
.more-body { padding-bottom: 14px; }
.cand-note { margin: 0; }
.position-guide-box :global(.position-guide) { border-top: 0; }
.ovr-guide-box .ovr-guide { margin-top: 0; }
.ovr-guide { border-left: 3px solid var(--progress); padding: 4px 0 4px 12px; margin: 12px 0; font-size: var(--fs-label); line-height: 1.5; }
.ovr-guide p { margin: 4px 0 0; overflow-wrap: anywhere; }
/* .cc-bar span의 overflow: hidden이 밑줄을 자르지 않게 아래 여백을 넓히되 줄 높이는 그대로 둔다. */
.cc-bar .ovr-core { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; padding-bottom: 3px; margin-bottom: -3px; }
/* 비활성 버튼이 다음 할 일을 문장으로 알려 주므로 흐리지 않고 옅은 면에 진한 글자로 둔다. */
.action-bar .btn-primary:disabled { opacity: 1; background: var(--surface-2); border-color: var(--line); color: var(--ink); }
/* T-11-371 공개 연출: 단서 단계에 능력치 막대가 0부터 차오르고, 결과에 강도별 테두리 빛. */
.rv-run .cc-bar em { animation: rv-fill var(--rv-hint) cubic-bezier(.22,.61,.36,1) var(--rv-delay) both; }
.rv-good.rv-land, .rv-jackpot.rv-land { box-shadow: 0 0 0 2px var(--accent), 0 0 18px 2px color-mix(in srgb, var(--accent) 45%, transparent); animation: rv-land .5s ease-out; }
.rv-jackpot.rv-run { box-shadow: 0 0 0 2px var(--accent); animation: rv-charge .45s ease-in-out infinite alternate; }
@keyframes rv-fill { from { width: 0; } }
@keyframes rv-land { 0% { transform: scale(.96); } 60% { transform: scale(1.02); } 100% { transform: scale(1); } }
@keyframes rv-charge { to { box-shadow: 0 0 0 2px var(--accent), 0 0 16px 4px color-mix(in srgb, var(--accent) 50%, transparent); } }
@media (prefers-reduced-motion: reduce) { .rv-run .cc-bar em, .rv-land, .rv-run { animation: none; } }
</style>
