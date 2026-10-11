<script lang="ts">
  // T-11-200 훈련 방향 육각형(시즌 탭). 능력치 축 이름표가 곧 그 능력치 훈련 버튼이다 — 약한 곳을 보고 그 축을 눌러 키운다.
  // 고른 훈련이 올리는 축(피지컬은 피지컬·스피드, 개인 코치는 전부)에 바깥 화살표를 그린다. 주력 능력치는 ★, 자기 투자 특훈의 축은 점선 화살표. 휴식·코치·미디어는 아래 칩(SeasonTab).
  import { Tween } from 'svelte/motion';
  import { radarData } from '@offside/app-core/format';
  import { investTarget, trainingCard, trainingLabel, TRAININGS } from '@offside/game/engine';
  import { focusOf } from '@offside/game/player';
  import { dur } from './motion.js';
  import type { GameState } from '@offside/game/types';

  const { s, onpick }: { s: GameState; onpick: (id: string, btn: HTMLElement) => void } = $props();
  const d = $derived(radarData(s));
  // T-10-003 goal 3: 현재 능력치 폴리곤은 시즌 시작 대비 값에서 순간 이동시키지 않고 부드럽게 모핑한다.
  const nowTween = Tween.of(() => d.nowVals, { duration: dur(550) });
  const nowPoly = $derived(d.toPoly(nowTween.current));

  /** 고른 훈련이 올리는 축. */
  const upKeys = $derived(
    s.training === 'coach' ? d.points.map((p) => p.key) : s.training === 'phy' ? ['phy', 'pac'] : [s.training],
  );
  // 이름표 버튼 자리(viewBox 좌표, 레이더 바깥 둘레). 화면 좌표는 아래 VB로 백분율로 바꾼다.
  const VB = { x: -20, y: -10, w: 340, h: 316 };
  const slot = (x: number, y: number) => {
    const ang = Math.atan2(y - d.CX, x - d.CX);
    return [d.CX + Math.cos(ang) * 128, d.CX + Math.sin(ang) * 132] as const;
  };
  const arrow = (x: number, y: number, len: number) => {
    const dx = x - d.CX,
      dy = y - d.CX,
      n = Math.hypot(dx, dy) || 1;
    return { x1: x + (dx / n) * 6, y1: y + (dy / n) * 6, x2: x + (dx / n) * (6 + len), y2: y + (dy / n) * (6 + len) };
  };
  const focus = $derived(focusOf(s));
  /** 자기 투자 특훈이 올리는 축 — 훈련 화살표와 겹치지 않을 때 점선 화살표로. */
  const invKey = $derived(s.invest === 'weak' || s.invest === 'best' ? investTarget(s, s.invest) : null);
  const trainOf = (k: string) => TRAININGS.find((t) => t.id === k)!;
</script>

<div class="train-radar" style="aspect-ratio:{VB.w}/{VB.h}">
  <svg class="radar" viewBox="{VB.x} {VB.y} {VB.w} {VB.h}" aria-hidden="true">
    <defs>
      <marker id="tr-head" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" class="tr-head" />
      </marker>
    </defs>
    {#each d.rings as ring (ring)}
      <polygon class="rd-ring" points={ring} />
    {/each}
    {#each d.spokes as [x, y], i (i)}
      <line class="rd-ring" x1={d.CX} y1={d.CX} x2={x.toFixed(1)} y2={y.toFixed(1)} />
    {/each}
    {#if d.prev}
      <polygon class="rd-prev" points={d.prev} />
    {/if}
    <polygon class="rd-now" points={nowPoly} />
    {#each d.dots as [x, y], i (i)}
      {@const on = upKeys.includes(d.points[i]!.key)}
      <circle class="rd-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r={on ? 4.5 : 3} />
      {#if on}
        {@const a = arrow(x, y, s.training === 'coach' ? 8 : 16)}
        <line class="tr-arrow" x1={a.x1.toFixed(1)} y1={a.y1.toFixed(1)} x2={a.x2.toFixed(1)} y2={a.y2.toFixed(1)} marker-end="url(#tr-head)" />
      {:else if d.points[i]!.key === invKey}
        {@const a = arrow(x, y, 12)}
        <line class="tr-arrow inv" x1={a.x1.toFixed(1)} y1={a.y1.toFixed(1)} x2={a.x2.toFixed(1)} y2={a.y2.toFixed(1)} marker-end="url(#tr-head)" />
      {/if}
    {/each}
  </svg>
  {#each d.points as p (p.key)}
    {@const [x, y] = slot(p.x, p.y)}
    {@const tr = trainOf(p.key)}
    {@const c = trainingCard(s, tr)}
    <button
      class="tr-axis"
      data-train={p.key}
      aria-pressed={s.training === p.key}
      aria-label="{trainingLabel(s, tr)} · {p.labelKr} {p.value} · {c.effect[0]}{c.tag ? ` · ${c.tag}` : ''}"
      style="left:{(((x - VB.x) / VB.w) * 100).toFixed(2)}%;top:{(((y - VB.y) / VB.h) * 100).toFixed(2)}%"
      onclick={(e) => onpick(p.key, e.currentTarget)}
    >
      <span class="rd-abbr"><span class="rd-kr">{p.labelKr}</span>{#if focus.includes(p.key)}<span class="tr-focus"> ★</span>{/if}</span>
      <span class="rd-val"
        >{p.value}{#if p.delta > 0}<span class="rd-up"> +{p.delta}</span>{:else if p.delta < 0}<span class="rd-down"> {p.delta}</span>{/if}</span
      >
    </button>
  {/each}
</div>
