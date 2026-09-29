<script lang="ts">
  // 선수 생성(T-10-022): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
  // 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
  import { cubicOut } from 'svelte/easing';
  import { POS, DPOS, DETAILS_OF, TRAITS, ATTR_KEYS, FOCUS_PICK, FOCUS_GROWTH, attrLabels, defaultFocus, focusMod, posLabel } from '../game/data.js';
  import type { AttrKey, DetailPos, Pos } from '../game/data.js';
  import { baseline } from '../game/candidates.js';
  import { appState, detailOpenNow, draftBody, draftDpos, randomName } from './state.svelte.js';
  import { CONFEDS, flagOf } from '@offside/contracts/nations';
  import { BODY_LIMITS, BODY_DEFAULT, bmiOf, bodyError } from '@offside/contracts/body';
  import { bodyMods, GK_SUBS, SUBS } from '../game/attributes.js';
  import { isKorean, nationOf } from '../game/nation.js';
  import { startCareer, rollCandidates } from './actions.js';
  import { goHome } from './nav.js';
  import { hiddenStrength, scoutLine, startOvr } from './create-view.js';
  import { dur } from './motion.js';
  import { withRo } from './format.js';
  import Topbar from './Topbar.svelte';
  import MiniRadar from './MiniRadar.svelte';
  import NationPicker from './NationPicker.svelte';

  const C = appState.C;
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const;
  const growthPct = Math.round((FOCUS_GROWTH - 1) * 100);
  // T-10-091 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  const detailOpen = detailOpenNow();
  if (detailOpen && !draftDpos(C)) pickDetail(DETAILS_OF[C.pos][0]!);
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
  // 골키퍼에게 보여 줄 체격 보정(나머지는 골키퍼 능력치에 거의 안 쓰인다).
  const GK_BODY = ['div', 'han', 'jmp', 'str', 'ref', 'rea'];
  const body = $derived(draftBody(C));
  const bodyErr = $derived(bodyError(body));
  const bodyNote = $derived.by(() => {
    const mods = Object.entries(bodyMods({ pos: C.pos, body }))
      .filter(([k]) => (C.pos === 'GK' ? GK_BODY.includes(k) : !GK_SUBS.includes(k)))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 4);
    return mods.map(([k, v]) => `${SUBS[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`).join(' · ');
  });
  const L = BODY_LIMITS;

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
    if (C.focus.includes(k)) return `시작 +${d} · 성장 +${growthPct}%`;
    return d < 0 ? `시작 ${d}` : '변화 없음';
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
    startCareer(C.name, C.number, picked.attrs);
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
    <h1>{step === 'form' ? '고교 3학년, 나는 어떤 선수인가' : '스카우트 리포트를 비교해 보세요'}</h1>
  </div>

  <section class="live-card" class:sticky={step === 'form'} aria-label="내 선수 미리보기">
    <div class="lc-num">
      <b class="num">{C.number || '–'}</b>
      <span>{dpos ?? C.pos}</span>
    </div>
    <div class="lc-main">
      <b class="lc-name">{C.name.trim() || '이름 없음'}</b>
      <span class="lc-meta"><span aria-hidden="true">{flagOf(nation.code)}</span> {nation.ko} · {posLabel({ pos: C.pos, dpos })} · {C.foot}{bodyErr ? '' : ` · ${body.h}cm ${body.w}kg`}</span>
      <div class="lc-tags">
        {#if trait}<span class="lc-tag">{trait.icon} {trait.name}</span>{/if}
        {#if C.focus.length}<span class="lc-tag">주력 {C.focus.map((k) => labels[k]).join('·')}</span>{/if}
      </div>
    </div>
    <div class="lc-side">
      <MiniRadar pos={C.pos} attrs={cardAttrs} size={72} />
      <span class="lc-ovr">{picked ? '시작' : '예상'} OVR <b class="num">{startOvr(C.pos, cardAttrs)}</b></span>
    </div>
  </section>

  {#if step === 'form'}
    <section class="card stack create-form">
      <div class="row" style="flex-wrap:nowrap">
        <div class="field" style="flex:1">
          <label for="f-name">이름</label>
          <div class="name-input">
            <input type="text" id="f-name" maxlength="10" autocomplete="off" bind:value={C.name} />
            <button type="button" class="dice" data-act="random-name" aria-label="이름 랜덤으로 바꾸기" onclick={() => (C.name = randomName())}>🎲</button>
          </div>
        </div>
        <div class="field" style="width:84px">
          <label for="f-num">등번호</label>
          <input type="number" id="f-num" inputmode="numeric" min="1" max="99" placeholder="1–99" bind:value={C.number} />
        </div>
      </div>

      <div class="field">
        <label for="f-nation">국적</label>
        <NationPicker id="f-nation" bind:value={C.nation} />
        <p class="muted fs-sm" data-nation-note>
          {#if foreign}
            한국 고교로 축구 유학을 온 선수로 시작해요. {nation.ko} 대표팀에 뽑히고 대륙컵은 {CONFEDS[nation.conf].cup}예요. 병역은 없어요.
          {:else}
            대표팀 대륙컵은 AFC 아시안컵이에요. 병역(상무·현역)이 있고, 아시안게임·올림픽 메달로 특례를 받을 수 있어요.
          {/if}
          대표팀 발탁 기준은 어느 나라든 같아요.
        </p>
      </div>

      <div class="field">
        <span class="lbl">체격</span>
        <div class="row body-row">
          <label class="body-in" for="f-height">
            <span class="sr-only">키</span>
            <input type="number" id="f-height" inputmode="numeric" min={L.height.min} max={L.height.max} placeholder={String(BODY_DEFAULT[C.pos].h)} value={C.height ?? BODY_DEFAULT[C.pos].h} oninput={(e) => (C.height = e.currentTarget.value === '' ? null : Math.round(+e.currentTarget.value))} aria-invalid={!!bodyErr} aria-describedby="f-body-note" />
            <span aria-hidden="true">cm</span>
          </label>
          <label class="body-in" for="f-weight">
            <span class="sr-only">몸무게</span>
            <input type="number" id="f-weight" inputmode="numeric" min={L.weight.min} max={L.weight.max} placeholder={String(BODY_DEFAULT[C.pos].w)} value={C.weight ?? BODY_DEFAULT[C.pos].w} oninput={(e) => (C.weight = e.currentTarget.value === '' ? null : Math.round(+e.currentTarget.value))} aria-invalid={!!bodyErr} aria-describedby="f-body-note" />
            <span aria-hidden="true">kg</span>
          </label>
        </div>
        <p class="fs-sm" class:muted={!bodyErr} class:body-err={!!bodyErr} id="f-body-note" data-body-note aria-live="polite">
          {#if bodyErr}
            {bodyErr}
          {:else}
            BMI {bmiOf(body).toFixed(1)}{bodyNote ? ` · ${bodyNote}` : ' · 포지션 평균 체격'}. 시작 OVR은 같고, 세부 능력치 분포만 조금 달라져요.
          {/if}
        </p>
      </div>

      <div class="field">
        <span class="lbl">포지션</span>
        <div class="seg two">
          {#each posKeys as k (k)}
            <button class="opt pos-opt" data-set="pos" data-val={k} aria-pressed={C.pos === k} onclick={() => setPos(k)}>
              <span class="pos-code num">{k}</span><b>{POS[k].label}</b><small>{POS[k].blurb}</small>
            </button>
          {/each}
        </div>
      </div>

      {#if detailOpen && DETAILS_OF[C.pos].length > 1}
        <div class="field">
          <span class="lbl">세부 포지션</span>
          <div class="seg" class:two={DETAILS_OF[C.pos].length === 2} class:three={DETAILS_OF[C.pos].length === 3}>
            {#each DETAILS_OF[C.pos] as d (d)}
              <button class="opt pos-opt" data-set="dpos" data-val={d} aria-pressed={C.dpos === d} onclick={() => pickDetail(d)}>
                <span class="pos-code num">{d}</span><b>{DPOS[d].label}</b><small>{DPOS[d].blurb}</small>
              </button>
            {/each}
          </div>
          <p class="muted fs-sm">세부 포지션은 은퇴까지 바뀌지 않아요. 능력치 성장·골과 도움 비중이 달라져요.</p>
        </div>
      {/if}

      <div class="field">
        <span class="lbl">주발</span>
        <div class="seg three">
          {#each feet as f (f)}
            <button class="opt" data-set="foot" data-val={f} aria-pressed={C.foot === f} onclick={() => (C.foot = f)}><b>{f}</b></button>
          {/each}
        </div>
      </div>

      <div class="field">
        <span class="lbl">주력 능력치 · {FOCUS_PICK}개 선택</span>
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
        <span class="lbl">성장 특성</span>
        <div class="seg two">
          {#each TRAITS as t (t.id)}
            <button class="opt trait-opt" data-set="trait" data-val={t.id} aria-pressed={C.trait === t.id} title={t.desc} onclick={() => (C.trait = t.id)}>
              <b><span aria-hidden="true">{t.icon}</span> {t.name}</b><small>{t.short}</small>
            </button>
          {/each}
        </div>
      </div>
      <p class="muted fs-sm">잠재력은 숨겨져 있어요. 스카우트 평가로만 짐작할 수 있어요.</p>
    </section>

    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        <button class="btn" data-act="home" onclick={goHome}>취소</button>
        <button class="btn btn-primary" data-act="next-candidates" disabled={focusLeft > 0 || !!bodyErr} onclick={rollCandidates}>
          {bodyErr ? '키·몸무게를 확인해 주세요' : focusLeft > 0 ? `주력 능력치를 ${focusLeft}개 더 골라주세요` : '후보 3명 보기 →'}
        </button>
      </div>
    </div>
  {:else if appState.candidates}
    <div class="row cand-intro">
      <p class="muted">세 후보는 능력치 총합이 같고 분포만 달라요. 카드를 눌러 리포트를 열어 보세요.</p>
      {#if appState.candidatesOpen.some((o) => !o)}
        <button class="icon-btn" data-act="open-all" onclick={openAll}>모두 열기</button>
      {/if}
    </div>
    <div class="cand-list">
      {#each appState.candidates as cand, i (i)}
        {#if appState.candidatesOpen[i]}
          <button class="cand-card open" class:picked={appState.candidatePick === i} data-cand={i} data-cand-open="true" aria-pressed={appState.candidatePick === i} onclick={() => pick(i)} in:flipIn>
            <span class="cc-head">
              <span class="cc-no">후보 {i + 1}</span>
              <span class="cc-ovr">OVR <b class="num">{startOvr(C.pos, cand.attrs)}</b></span>
              {#if appState.candidatePick === i}<span class="pill good">✓ 선택</span>{/if}
            </span>
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
          <button class="cand-card" data-cand={i} onclick={() => pick(i)}>
            <span class="cand-n">?</span>
            <span class="cc-closed">
              <b>후보 {i + 1}</b>
              <small>스카우트 메모: 숨은 무기는 {labels[hiddenStrength(cand.attrs, C.focus)]}</small>
            </span>
            <span class="cc-tap" aria-hidden="true">탭해서 열기</span>
          </button>
        {/if}
      {/each}
    </div>

    <div class="action-bar at-bottom">
      <div class="action-bar-inner with-back">
        <button class="btn" data-act="home" onclick={backToForm}>← 다시 입력</button>
        <button class="btn btn-primary" data-act="start" disabled={appState.candidatePick == null} onclick={confirmPick}>
          {appState.candidatePick == null ? '후보를 한 명 골라주세요' : `${withRo(`후보 ${appState.candidatePick + 1}`)} 킥오프 →`}
        </button>
      </div>
    </div>
  {/if}
</div>
