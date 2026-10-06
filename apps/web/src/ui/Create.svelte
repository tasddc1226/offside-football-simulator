<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // 선수 생성(T-10-022): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
  // 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
  import { onMount } from 'svelte';
  import { watchDetailOpening } from '@offside/app-core/season-opening';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { POS, DPOS, DETAILS_OF, TRAITS, ATTR_KEYS, FOCUS_PICK, FOCUS_GROWTH, attrLabels, defaultFocus, focusMod, posLabel } from '@offside/game/data';
  import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
  import { baseline } from '@offside/game/candidates';
  import { appState, detailOpenNow, draftBody, draftDpos, randomName } from './state.svelte.js';
  import { CONFEDS, flagOf } from '@offside/contracts/nations';
  import { BODY_LIMITS, BODY_DEFAULT, bmiOf, bodyError } from '@offside/contracts/body';
  import { isKorean, nationOf } from '@offside/game/nation';
  import { startCareer, rollCandidates } from './actions.js';
  import { goHome } from './nav.js';
  import { bodyNote, hiddenStrength, scoutLine, startOvr } from '@offside/app-core/create-view';
  import { dur } from './motion.js';
  import { createText as L } from '@offside/app-core/i18n/ko/create';
  import Topbar from './Topbar.svelte';
  import MiniRadar from './MiniRadar.svelte';
  import NationPicker from './NationPicker.svelte';
  import { doneOnEnter } from './inputDone.js';
  import ScoutScan from './ScoutScan.svelte';

  const C = appState.C;
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const; // 저장값(화면에는 L.foot으로)
  const growthPct = Math.round((FOCUS_GROWTH - 1) * 100);
  // T-10-091 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  let detailOpen = $state(detailOpenNow());
  if (detailOpenNow() && !draftDpos(C)) pickDetail(DETAILS_OF[C.pos][0]!);
  onMount(() => watchDetailOpening(() => {
    detailOpen = true;
    // 개막 전 골라 둔 주력·후보 능력치는 유지한다.
    if (!draftDpos(C)) C.dpos = DETAILS_OF[C.pos][0]!;
  }));
  const dpos = $derived(draftDpos(C));
  const focusLeft = $derived(FOCUS_PICK - C.focus.length);
  // 고른 조합이 시작 분포를 어떻게 바꾸는지 버튼마다 미리 보여준다(주력 ▲ / 가장 덜 쓰는 능력치 ▼).
  const preview = $derived(focusMod(C.pos, C.focus));

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

  function setPos(v: Pos) {
    C.pos = v;
    if (detailOpen) pickDetail(DETAILS_OF[v][0]!);
    else C.focus = defaultFocus(v);
  }
  // 세부 포지션을 바꾸면 주력 능력치도 그 포지션의 기본값으로 다시 켠다.
  function pickDetail(d: DetailPos) {
    C.dpos = d;
    C.focus = [...DPOS[d].focus];
  }
  // 이미 두 개를 골랐으면 먼저 고른 쪽을 밀어낸다 — 한 번의 탭으로 바꿔 끼울 수 있게.
  function toggleFocus(k: AttrKey) {
    if (C.focus.includes(k)) C.focus = C.focus.filter((f) => f !== k);
    else C.focus = [...C.focus, k].slice(-FOCUS_PICK);
  }
  function focusNote(k: AttrKey, d: number): string {
    if (C.focus.includes(k)) return L.focusUp({ d, pct: growthPct });
    return d < 0 ? L.focusDown({ d }) : L.focusNone;
  }
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
  function backToForm() {
    appState.candidates = null;
  }
  function openAll() {
    appState.candidatesOpen = appState.candidatesOpen.map(() => true);
  }
  // 카드를 누르면(닫혀 있든 열려 있든) 바로 열리면서 그 후보가 선택된다 — 한 번의 탭으로
  // "오픈 + 선택"이 끝나는 모바일 우선 상호작용. "모두 오픈"은 선택 없이 전부 펼쳐만 준다.
  function pick(i: number) {
    appState.candidatesOpen[i] = true;
    appState.candidatePick = i;
  }
  function confirmPick() {
    if (!picked) return;
    startCareer(C.name, C.number, picked.attrs, picked.potential);
  }
  // 카드가 세로축으로 뒤집히며 열린다. 감속 모션이면 duration 0(즉시 표시).
  function flipIn(_node: Element) {
    return { duration: dur(360), easing: cubicOut, css: (t: number) => `transform: perspective(800px) rotateY(${(1 - t) * 90}deg); opacity: ${Math.min(1, t * 2)}` };
  }
</script>

<div class="wrap has-cta">
  <Topbar />

  <div>
    <div class="eyebrow">Player Creation · {step === 'form' ? 1 : 2}/2</div>
    <h1>{step === 'form' ? L.titleForm : L.titleCandidates}</h1>
  </div>

  <section class="live-card" class:sticky={step === 'form'} aria-label={L.previewLabel}>
    <div class="lc-num">
      <b class="num">{C.number || '–'}</b>
      <span>{dpos ?? C.pos}</span>
    </div>
    <div class="lc-main">
      <b class="lc-name">{C.name.trim() || L.noName}</b>
      <span class="lc-meta"><span aria-hidden="true">{flagOf(nation.code)}</span> {tn(nation.ko)} · {posLabel({ pos: C.pos, dpos })} · {L.foot({ v: C.foot })}{bodyErr ? '' : ` · ${body.h}cm ${body.w}kg`}</span>
      <div class="lc-tags">
        {#if trait}<span class="lc-tag">{trait.icon} {trait.name}</span>{/if}
        {#if C.focus.length}<span class="lc-tag">{L.focusTag({ list: C.focus.map((k) => labels[k]).join('·') })}</span>{/if}
      </div>
    </div>
    <div class="lc-side">
      <MiniRadar pos={C.pos} attrs={cardAttrs} size={72} />
      <span class="lc-ovr">{picked ? L.ovrStart : L.ovrEst} OVR <b class="num">{startOvr(C.pos, cardAttrs)}</b></span>
    </div>
  </section>

  {#if step === 'form'}
    <section class="card stack create-form">
      <div class="row" style="flex-wrap:nowrap">
        <div class="field" style="flex:1">
          <label for="f-name">{L.name}</label>
          <div class="name-input">
            <input type="text" id="f-name" maxlength="10" autocomplete="off" enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter bind:value={C.name} />
            <button type="button" class="dice" data-act="random-name" aria-label={L.randomName} onclick={() => (C.name = randomName())}>🎲</button>
          </div>
        </div>
        <div class="field" style="width:84px">
          <label for="f-num">{L.number}</label>
          <input type="number" id="f-num" inputmode="numeric" min="1" max="99" placeholder="1–99" enterkeyhint="done" use:doneOnEnter bind:value={C.number} />
        </div>
      </div>

      <div class="field">
        <label for="f-nation">{L.nation}</label>
        <NationPicker id="f-nation" bind:value={C.nation} />
        <p class="muted fs-sm" data-nation-note>
          {foreign ? L.nationForeign({ nation: tn(nation.ko), cup: tn(CONFEDS[nation.conf].cup) }) : L.nationHome} {L.nationSame}
        </p>
      </div>

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
        <span class="lbl">{L.position}</span>
        <div class="seg two">
          {#each posKeys as k (k)}
            <button class="opt pos-opt" data-set="pos" data-val={k} aria-pressed={C.pos === k} onclick={() => setPos(k)}>
              <span class="pos-code num">{k}</span><b>{tn(POS[k].label)}</b><small>{POS[k].blurb}</small>
            </button>
          {/each}
        </div>
      </div>

      {#if detailOpen && DETAILS_OF[C.pos].length > 1}
        <div class="field">
          <span class="lbl">{L.detailPosition}</span>
          <div class="seg" class:two={DETAILS_OF[C.pos].length === 2} class:three={DETAILS_OF[C.pos].length === 3}>
            {#each DETAILS_OF[C.pos] as d (d)}
              <button class="opt pos-opt" data-set="dpos" data-val={d} aria-pressed={C.dpos === d} onclick={() => pickDetail(d)}>
                <span class="pos-code num">{d}</span><b>{tn(DPOS[d].label)}</b><small>{DPOS[d].blurb}</small>
              </button>
            {/each}
          </div>
          <p class="muted fs-sm">{L.detailNote}</p>
        </div>
      {/if}

      <div class="field">
        <span class="lbl">{L.footLabel}</span>
        <div class="seg three">
          {#each feet as f (f)}
            <button class="opt" data-set="foot" data-val={f} aria-pressed={C.foot === f} onclick={() => (C.foot = f)}><b>{L.foot({ v: f })}</b></button>
          {/each}
        </div>
      </div>

      <div class="field">
        <span class="lbl">{L.focusTitle({ n: FOCUS_PICK })}</span>
        <div class="seg two">
          {#each ATTR_KEYS as k (k)}
            {@const d = preview[k] ?? 0}
            <button class="opt focus-opt" data-set="focus" data-val={k} aria-pressed={C.focus.includes(k)} onclick={() => toggleFocus(k)}>
              <b>{labels[k]}</b><small class:up={d > 0} class:down={d < 0}>{focusNote(k, d)}</small>
            </button>
          {/each}
        </div>
      </div>

      <div class="field">
        <span class="lbl">{L.trait}</span>
        <div class="seg two">
          {#each TRAITS as t (t.id)}
            <button class="opt trait-opt" data-set="trait" data-val={t.id} aria-pressed={C.trait === t.id} title={t.desc} onclick={() => (C.trait = t.id)}>
              <b><span aria-hidden="true">{t.icon}</span> {t.name}</b><small>{t.short}</small>
            </button>
          {/each}
        </div>
      </div>
      <p class="muted fs-sm">{L.potentialNote}</p>
    </section>

    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        <button class="btn" data-act="home" onclick={goHome}>{L.cancel}</button>
        <button class="btn btn-primary" data-act="next-candidates" disabled={focusLeft > 0 || !!bodyErr} onclick={() => (scouting = true)}>
          {bodyErr ? L.checkBody : focusLeft > 0 ? L.focusMore({ n: focusLeft }) : L.seeCandidates}
        </button>
      </div>
    </div>
  {:else if appState.candidates}
    <div class="row cand-intro">
      <p class="muted">{L.candIntro}</p>
      {#if appState.candidatesOpen.some((o) => !o)}
        <button class="icon-btn" data-act="open-all" onclick={openAll}>{L.openAll}</button>
      {/if}
    </div>
    <p class="muted">{appState.candidatePotentialOpen ? L.potentialHelp : L.potentialWeb}</p>
    <div class="cand-list">
      {#each appState.candidates as cand, i (i)}
        {#if appState.candidatesOpen[i]}
          <button class="cand-card open" class:picked={appState.candidatePick === i} data-cand={i} data-cand-open="true" aria-pressed={appState.candidatePick === i} onclick={() => pick(i)} in:flipIn>
            <span class="cc-head">
              <span class="cc-no">{L.candNo({ n: i + 1 })}</span>
              <span class="cc-ovr">OVR <b class="num">{startOvr(C.pos, cand.attrs)}</b></span>
              {#if appState.candidatePick === i}<span class="pill good">{L.picked}</span>{/if}
            </span>
            <span class="muted">{appState.candidatePotentialOpen ? L.potentialRange(cand.potential) : L.potentialLocked}</span>
            <span class="cc-scout">“{scoutLine(C.pos, cand.attrs)}”</span>
            <span class="cc-body">
              <MiniRadar pos={C.pos} attrs={cand.attrs} size={84} />
              <span class="cc-bars">
                {#each ATTR_KEYS as k (k)}
                  {@const v = Math.round(cand.attrs[k])}
                  <span class="cc-bar" class:hi={cand.hintKeys.includes(k)}>
                    <span>{labels[k]}</span>
                    <i><em style:width="{v}%"></em></i>
                    <b class="num">{v}</b>
                  </span>
                {/each}
              </span>
            </span>
          </button>
        {:else}
          <button class="cand-card" data-cand={i} onclick={() => pick(i)} in:fly|global={{ y: 14, duration: dur(280), delay: dur(90 * i) }}>
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

    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        <button class="btn" data-act="home" onclick={backToForm}>{L.back}</button>
        <button class="btn btn-primary" data-act="start" disabled={appState.candidatePick == null} onclick={confirmPick}>
          {appState.candidatePick == null ? L.pickOne : L.kickoff({ n: appState.candidatePick + 1 })}
        </button>
      </div>
    </div>
  {/if}
</div>
{#if scouting}<ScoutScan pos={C.pos} steps={scoutSteps} onDone={scouted} />{/if}
