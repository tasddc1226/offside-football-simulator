<script lang="ts">
  // 선수 생성(T-10-022): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
  // 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
  import { cubicOut } from 'svelte/easing';
  import { POS, TRAITS, ATTR_KEYS, FOCUS_PICK, FOCUS_GROWTH, defaultFocus, focusMod } from '../game/data.js';
  import type { AttrKey, Pos } from '../game/data.js';
  import { baseline } from '../game/candidates.js';
  import { appState, randomName } from './state.svelte.js';
  import { goHome, startCareer, rollCandidates } from './actions.js';
  import { POS_BLURB, TRAIT_UI, attrLabels, hiddenStrength, scoutLine, startOvr } from './create-view.js';
  import { dur } from './motion.js';
  import Topbar from './Topbar.svelte';
  import MiniRadar from './MiniRadar.svelte';

  const C = appState.C;
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const;
  const growthPct = Math.round((FOCUS_GROWTH - 1) * 100);
  const focusLeft = $derived(FOCUS_PICK - C.focus.length);
  // 고른 조합이 시작 분포를 어떻게 바꾸는지 버튼마다 미리 보여준다(주력 ▲ / 가장 덜 쓰는 능력치 ▼).
  const preview = $derived(focusMod(C.pos, C.focus));

  const step = $derived<'form' | 'candidates'>(appState.candidates ? 'candidates' : 'form');
  const labels = $derived(attrLabels(C.pos));
  const picked = $derived(appState.candidates && appState.candidatePick != null ? appState.candidates[appState.candidatePick]! : null);
  // 라이브 카드의 레이더·OVR: 후보를 골랐으면 그 후보, 아니면 지금 조합의 기준 분포.
  const cardAttrs = $derived(picked?.attrs ?? baseline(C.pos, C.focus));
  const trait = $derived(TRAITS.find((t) => t.id === C.trait));

  function setPos(v: Pos) {
    C.pos = v;
    C.focus = defaultFocus(v);
  }
  // 이미 두 개를 골랐으면 먼저 고른 쪽을 밀어낸다 — 한 번의 탭으로 바꿔 끼울 수 있게.
  function toggleFocus(k: AttrKey) {
    if (C.focus.includes(k)) C.focus = C.focus.filter((f) => f !== k);
    else C.focus = [...C.focus, k].slice(-FOCUS_PICK);
  }
  function focusNote(k: AttrKey): string {
    const d = preview[k] ?? 0;
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
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={step === 'form' ? goHome : backToForm}>{step === 'form' ? '취소' : '← 다시 입력'}</button>
    {/snippet}
  </Topbar>

  <div>
    <div class="eyebrow">Player Creation · {step === 'form' ? 1 : 2}/2</div>
    <h1>{step === 'form' ? '고교 3학년, 나는 어떤 선수인가' : '스카우트 리포트를 비교해 보세요'}</h1>
  </div>

  <section class="live-card" class:sticky={step === 'form'} aria-label="내 선수 미리보기">
    <div class="lc-num">
      <b class="num">{C.number || '–'}</b>
      <span>{C.pos}</span>
    </div>
    <div class="lc-main">
      <b class="lc-name">{C.name.trim() || '이름 없음'}</b>
      <span class="lc-meta">{POS[C.pos].label} · {C.foot}</span>
      <div class="lc-tags">
        {#if trait}<span class="lc-tag">{TRAIT_UI[trait.id]?.icon} {trait.name}</span>{/if}
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
          <input type="number" id="f-num" inputmode="numeric" min="1" max="99" bind:value={C.number} />
        </div>
      </div>

      <div class="field">
        <span class="lbl">포지션</span>
        <div class="seg two">
          {#each posKeys as k (k)}
            <button class="opt pos-opt" data-set="pos" data-val={k} aria-pressed={C.pos === k} onclick={() => setPos(k)}>
              <span class="pos-code num">{k}</span><b>{POS[k].label}</b><small>{POS_BLURB[k]}</small>
            </button>
          {/each}
        </div>
      </div>

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
              <b>{labels[k]}</b><small class:up={d > 0} class:down={d < 0}>{focusNote(k)}</small>
            </button>
          {/each}
        </div>
      </div>

      <div class="field">
        <span class="lbl">성장 특성</span>
        <div class="seg two">
          {#each TRAITS as t (t.id)}
            <button class="opt trait-opt" data-set="trait" data-val={t.id} aria-pressed={C.trait === t.id} title={t.desc} onclick={() => (C.trait = t.id)}>
              <b><span aria-hidden="true">{TRAIT_UI[t.id]?.icon}</span> {t.name}</b><small>{TRAIT_UI[t.id]?.short ?? t.desc}</small>
            </button>
          {/each}
        </div>
      </div>
      <p class="muted" style="font-size:13px">잠재력은 숨겨져 있어요. 스카우트 평가로만 짐작할 수 있어요.</p>
    </section>

    <div class="create-cta">
      <button class="btn btn-primary btn-block" data-act="next-candidates" disabled={focusLeft > 0} onclick={rollCandidates}>
        {focusLeft > 0 ? `주력 능력치를 ${focusLeft}개 더 골라주세요` : '후보 3명 보기 →'}
      </button>
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
                  <span class="cc-bar" class:hi={cand.hintKeys.includes(k)}>
                    <span>{labels[k]}</span>
                    <i><em style:width="{Math.round(cand.attrs[k])}%"></em></i>
                    <b class="num">{Math.round(cand.attrs[k])}</b>
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

    <div class="create-cta">
      <button class="btn btn-primary btn-block" data-act="start" disabled={appState.candidatePick == null} onclick={confirmPick}>
        {appState.candidatePick == null ? '후보를 한 명 골라주세요' : `후보 ${appState.candidatePick + 1}로 킥오프 →`}
      </button>
    </div>
  {/if}
</div>
