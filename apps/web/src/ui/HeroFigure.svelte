<script lang="ts">
  // T-11-412 홈 '진행 중인 커리어' 카드 오른쪽 위: 선수 그림과 그 왼쪽에 마지막 계약서 사인을 다시 그린다.
  // 둘 다 이름 줄 높이 안에서 끝나 아래 소속 · 시즌 줄은 전폭으로 쓴다.
  // 선수 그림 합성이 무거워 첫 화면 번들 밖 지연 청크로 둔다. 사인은 이 기기에 남은 것만(lastSign.ts), 없으면 그림만.
  import { tn } from '@offside/game/i18n/names';
  import { avatarSpec } from '@offside/game/avatar';
  import type { GameState } from '@offside/game/types';
  import { inkPaths } from '@offside/app-core/lastSign';
  import { SKEW_X, SKEW_Y, signFlourish } from '@offside/app-core/signature';
  import PixelAvatar from './PixelAvatar.svelte';
  import { loadLastSign } from './lastSign.js';
  import { motionOK } from './motion.js';

  const { G }: { G: GameState } = $props();
  const spec = $derived(avatarSpec(G));
  const sign = $derived(loadLastSign(G.cid));

  /** 손 사인을 다 긋는 시간(ms) — 획 길이만큼 나눠 차례로 긋는다. */
  const DRAW_MS = 1400;
  const ink = $derived.by(() => {
    const m = sign?.mark;
    if (m?.kind !== 'ink') return null;
    const xs = m.strokes.flatMap((s) => s.filter((_, i) => i % 2 === 0));
    const ys = m.strokes.flatMap((s) => s.filter((_, i) => i % 2 === 1));
    const pad = 6;
    const x0 = Math.min(...xs) - pad,
      y0 = Math.min(...ys) - pad;
    const w = Math.max(...xs) - x0 + pad,
      h = Math.max(...ys) - y0 + pad;
    const paths = inkPaths(m);
    const total = paths.reduce((a, p) => a + p.len, 0);
    let at = 0;
    return {
      box: `${x0} ${y0} ${w} ${h}`,
      // 패드보다 작게 그리므로 획 굵기를 상자 크기에 맞춘다.
      width: Math.max(2, Math.max(w / 112, h / 44) * 2.4),
      paths: paths.map((p) => {
        const ms = (p.len / total) * DRAW_MS;
        const out = { d: p.d, delay: Math.round(at), ms: Math.max(40, Math.round(ms)) };
        at += ms;
        return out;
      }),
    };
  });
  const NAME_SIZE = 22;
</script>

<div class="hero-fig" class:anim={motionOK} aria-hidden="true">
  {#if sign}
    <div class="hero-sign" data-hero-sign={sign.mark.kind}>
      {#if ink}
        <svg viewBox={ink.box} preserveAspectRatio="xMidYMid meet">
          {#each ink.paths as p, i (i)}
            <path d={p.d} pathLength="1" stroke-width={ink.width} style:--d="{p.delay}ms" style:--t="{p.ms}ms" />
          {/each}
        </svg>
      {:else if sign.mark.kind === 'name'}
        <svg viewBox="-66 -26 132 52" class="name">
          <g transform="matrix(1 {SKEW_Y} {SKEW_X} 1 0 4)">
            <text x="0" y="0" text-anchor="middle" font-size={NAME_SIZE} textLength={sign.mark.name.length > 6 ? 110 : undefined} lengthAdjust="spacingAndGlyphs">{sign.mark.name}</text>
            <path d={signFlourish(52, NAME_SIZE)} pathLength="1" stroke-width="1.6" style:--d="500ms" style:--t="400ms" />
          </g>
        </svg>
      {/if}
      <span class="hero-stamp" style:--d="{ink ? 1500 : 950}ms"><b>SIGNED</b>{tn(sign.club)}</span>
    </div>
  {/if}
  <PixelAvatar {spec} />
</div>

<style>
  .hero-fig {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    pointer-events: none;
  }
  .hero-sign {
    position: relative;
    width: 112px;
    height: 44px;
    margin-top: 4px;
    color: var(--on-pitch);
  }
  .hero-sign svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .hero-sign path {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }
  .hero-sign text {
    fill: currentColor;
    font-style: italic;
    font-weight: 500;
  }
  .hero-stamp {
    position: absolute;
    right: -2px;
    bottom: -12px;
    display: flex;
    gap: 4px;
    align-items: baseline;
    padding: 1px 6px;
    border: 1.5px solid var(--accent);
    border-radius: var(--radius-xs);
    color: var(--accent);
    font-size: var(--fs-caption2);
    line-height: 1.3;
    white-space: nowrap;
    transform: rotate(-6deg);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero-stamp b {
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  /* 감속 모션이 아니면 획을 차례로 긋고, 다 그은 뒤 도장이 찍힌다. 텍스트 이름 사인은 왼쪽부터 드러난다. */
  .anim .hero-sign path {
    stroke-dashoffset: 1;
    animation: hero-ink var(--t) linear var(--d) forwards;
  }
  .anim .hero-sign .name text {
    clip-path: inset(0 100% 0 0);
    animation: hero-reveal 600ms ease-out 200ms forwards;
  }
  .anim .hero-stamp {
    opacity: 0;
    animation: hero-stamp 260ms cubic-bezier(0.2, 1.6, 0.4, 1) var(--d) forwards;
  }
  @keyframes hero-ink {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes hero-reveal {
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  @keyframes hero-stamp {
    from {
      opacity: 0;
      transform: rotate(-6deg) scale(1.6);
    }
    to {
      opacity: 1;
      transform: rotate(-6deg) scale(1);
    }
  }
  @media (max-width: 359px) {
    .hero-sign {
      width: 92px;
      height: 38px;
    }
  }
</style>
