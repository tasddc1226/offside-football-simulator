<script lang="ts">
  // ui.ts renderCreate() 포트 (184~204줄)
  import { POS, TYPES, TRAITS } from '../game/data.js';
  import type { Pos } from '../game/data.js';
  import { appState } from './state.svelte.js';
  import { goHome, startCareer } from './actions.js';
  import Topbar from './Topbar.svelte';

  const C = appState.C;
  const posKeys = Object.keys(POS) as Pos[];
  const feet = ['오른발', '왼발', '양발'] as const;
  const types = $derived(TYPES[C.pos]);
  $effect(() => {
    if (!types.find((t) => t.id === C.type)) C.type = types[0]!.id;
  });

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
  function submit() {
    startCareer(C.name, C.number);
  }
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>취소</button>
    {/snippet}
  </Topbar>
  <section class="card stack" style="gap:16px">
    <div>
      <div class="eyebrow">Player Creation</div>
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
    <button class="btn btn-primary btn-block" data-act="start" onclick={submit}>킥오프 →</button>
  </section>
</div>
