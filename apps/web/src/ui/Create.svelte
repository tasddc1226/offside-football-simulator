<script lang="ts">
  // ui.ts renderCreate() 포트 (184~204줄)
  import { scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { POS, TYPES, TRAITS, ATTR_LABEL, GK_LABEL, ATTR_KEYS } from '../game/data.js';
  import type { Pos } from '../game/data.js';
  import { appState } from './state.svelte.js';
  import { goHome, startCareer, rollCandidates } from './actions.js';
  import { dur } from './motion.js';
  import Topbar from './Topbar.svelte';

  const C = appState.C;
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const;
  const types = $derived(TYPES[C.pos]);
  $effect(() => {
    if (!types.find((t) => t.id === C.type)) C.type = types[0]!.id;
  });

  // 1단계(프로필 입력) → 2단계(후보 카드 선택). appState.candidates가 있으면 2단계.
  const step = $derived<'form' | 'candidates'>(appState.candidates ? 'candidates' : 'form');
  const labels = $derived(C.pos === 'GK' ? GK_LABEL : ATTR_LABEL);

  function setPos(v: Pos) {
    C.pos = v;
    C.type = TYPES[v][0]!.id;
  }
  function setFoot(v: typeof C.foot) {
    C.foot = v;
  }
  function setType(v: string) {
    C.type = v;
  }
  function setTrait(v: string) {
    C.trait = v;
  }
  function toCandidates() {
    rollCandidates();
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
    if (appState.candidatePick == null || !appState.candidates) return;
    const chosen = appState.candidates[appState.candidatePick]!;
    startCareer(C.name, C.number, chosen.attrs);
  }
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={step === 'form' ? goHome : backToForm}>{step === 'form' ? '취소' : '← 다시 입력'}</button>
    {/snippet}
  </Topbar>
  {#if step === 'form'}
    <section class="card stack" style="gap:16px">
      <div>
        <div class="eyebrow">Player Creation · 1/2</div>
        <h1>고교 3학년, 나는 어떤 선수인가</h1>
      </div>
      <div class="row" style="flex-wrap:nowrap">
        <div class="field" style="flex:1"><label for="f-name">이름</label><input type="text" id="f-name" maxlength="10" bind:value={C.name} /></div>
        <div class="field" style="width:84px"><label for="f-num">등번호</label><input type="number" id="f-num" min="1" max="99" bind:value={C.number} /></div>
      </div>
      <div class="field">
        <span class="lbl">포지션</span>
        <div class="seg four">
          {#each posKeys as k (k)}
            <button class="opt" data-set="pos" data-val={k} aria-pressed={C.pos === k} onclick={() => setPos(k)}><b>{POS[k].label}</b><small>{k}</small></button>
          {/each}
        </div>
      </div>
      <div class="field">
        <span class="lbl">주발</span>
        <div class="seg">
          {#each feet as f (f)}
            <button class="opt" data-set="foot" data-val={f} aria-pressed={C.foot === f} onclick={() => setFoot(f)}><b>{f}</b></button>
          {/each}
        </div>
      </div>
      <div class="field">
        <span class="lbl">플레이 유형 · 강점과 약점</span>
        <div class="seg">
          {#each types as t (t.id)}
            <button class="opt" data-set="type" data-val={t.id} aria-pressed={C.type === t.id} onclick={() => setType(t.id)}><b>{t.name}</b><small>{t.desc}</small></button>
          {/each}
        </div>
      </div>
      <div class="field">
        <span class="lbl">성장 특성</span>
        <div class="seg" style="grid-template-columns:1fr 1fr">
          {#each TRAITS as t (t.id)}
            <button class="opt" data-set="trait" data-val={t.id} aria-pressed={C.trait === t.id} onclick={() => setTrait(t.id)}><b>{t.name}</b><small>{t.desc}</small></button>
          {/each}
        </div>
      </div>
      <p class="muted" style="font-size:13px">잠재력은 숨겨져 있습니다. 스카우트 평가로만 짐작할 수 있어요.</p>
      <button class="btn btn-primary btn-block" data-act="next-candidates" onclick={toCandidates}>후보 선수 보기 →</button>
    </section>
  {:else if appState.candidates}
    <section class="card stack" style="gap:16px">
      <div>
        <div class="eyebrow">Player Creation · 2/2</div>
        <h1>세 명의 후보 중 한 명을 고르세요</h1>
        <p class="muted" style="font-size:13px">세 후보는 능력치 총합이 같습니다 — 분포만 다릅니다. 카드를 눌러 스카우트 리포트를 확인하세요.</p>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="icon-btn" data-act="open-all" onclick={openAll}>모두 오픈</button>
      </div>
      <div class="cand-grid">
        {#each appState.candidates as cand, i (i)}
          {#if appState.candidatesOpen[i]}
            <!-- 카드 오픈 모션(T-10-003 goal 3): 뒤집히듯 살짝 축소된 상태에서 확대되며 나타난다.
                 감속 모션이면 duration 0(즉시 표시, 기존 동작과 동일). -->
            <button
              class="cand-card open"
              class:picked={appState.candidatePick === i}
              data-cand={i}
              data-cand-open="true"
              onclick={() => pick(i)}
              in:scale={{ start: 0.86, duration: dur(220), easing: quintOut }}
            >
              <div class="cand-open-head"><b>후보 {i + 1}</b>{#if appState.candidatePick === i}<span class="pill good">선택됨</span>{/if}</div>
              {#each ATTR_KEYS as k (k)}
                <div class="cand-attr-row"><span>{labels[k]}</span><b>{Math.round(cand.attrs[k])}</b></div>
              {/each}
            </button>
          {:else}
            <button class="cand-card" data-cand={i} onclick={() => pick(i)}>
              <span class="cand-n">?</span>
              <span class="cand-lbl">후보 {i + 1}</span>
            </button>
          {/if}
        {/each}
      </div>
      <button class="btn btn-primary btn-block" data-act="start" disabled={appState.candidatePick == null} onclick={confirmPick}>
        {appState.candidatePick == null ? '후보를 선택하세요' : `후보 ${appState.candidatePick + 1}로 킥오프 →`}
      </button>
    </section>
  {/if}
</div>
