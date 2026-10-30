<script lang="ts">
  // T-11-492 문자중계 2D 그라운드 — 22명과 공을 그라운드 위에 그리고, 줄마다 app-core matchGround가 정한 자리로 옮긴다.
  // 움직임은 CSS 전환(--mg-dur)으로만 그리고, 움직임 줄이기면 전환 없이 자리만 바꾼다. 위치는 연출이라 결과와 상관없다.
  import { teamLiveText as L } from '@offside/app-core/i18n/ko/teamLive';
  import { arrowShape, type GroundArrow, type GroundSide, type GroundSpot, type Pt } from '@offside/app-core/matchGround';

  let {
    spots,
    ball,
    dur,
    goal = null,
    trail = [],
    arrows = [],
    home,
    away,
  }: {
    spots: readonly GroundSpot[];
    ball: Pt;
    /** 이번 동작의 전환 시간(ms). */
    dur: number;
    /** 골이 들어간 팀(골망 · GOAL 배너). */
    goal?: GroundSide | null;
    /** 골까지 공이 지난 길. */
    trail?: readonly Pt[];
    /** 장면 카드 선택지 화살표. */
    arrows?: readonly GroundArrow[];
    home: string;
    away: string;
  } = $props();

  function arrowPath(a: GroundArrow) {
    const q = arrowShape(a).ctrl;
    return `M${a.from[0]} ${a.from[1]}${q ? `Q${q[0]} ${q[1]} ` : 'L'}${a.to[0]} ${a.to[1]}`;
  }
  const trailPoints = $derived(trail.map((p) => `${p[0]},${p[1]}`).join(' '));
</script>

<section class="mg" style:--mg-dur="{dur}ms" aria-label={L.groundAria({ home, away })} data-match-ground>
  <div class="mg-field">
    <svg class="mg-lines" viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="102" height="65" />
      <path d="M52.5 1.5V66.5" />
      <circle cx="52.5" cy="34" r="9.15" />
      <path d="M1.5 13.85H18V54.15H1.5M1.5 24.85H7V43.15H1.5M103.5 13.85H87V54.15H103.5M103.5 24.85H98V43.15H103.5" />
      <path d="M18 26.7A9.15 9.15 0 0 1 18 41.3M87 26.7A9.15 9.15 0 0 0 87 41.3" />
    </svg>
    {#if goal}<i class="mg-net" class:left={goal === 'away'} aria-hidden="true"></i>{/if}
    {#if arrows.length}<i class="mg-shade" aria-hidden="true"></i>{/if}
    {#if goal && trail.length > 1}
      <svg class="mg-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={trailPoints} /></svg>
    {/if}
    {#if arrows.length}
      <svg class="mg-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {#each arrows as a (a.n)}<path d={arrowPath(a)} /><circle cx={a.to[0]} cy={a.to[1]} r="0.9" />{/each}
      </svg>
      {#each arrows as a (a.n)}
        {@const k = arrowShape(a).key}
        <span class="mg-key" style:left="{k[0]}%" style:top="{k[1]}%" aria-hidden="true">{a.n}</span>
      {/each}
    {/if}
    {#each spots as p (p.key)}
      <span class="mg-pl {p.side}" class:on={p.on} class:mate={p.mate} class:dim={p.dim} style:left="{p.x}%" style:top="{p.y}%" aria-hidden="true">
        {p.no}{#if p.tag}<span class="mg-tag">{p.tag}</span>{/if}
      </span>
    {/each}
    <i class="mg-ball" style:left="{ball[0]}%" style:top="{ball[1]}%" aria-hidden="true"></i>
    {#if goal}<div class="mg-banner" aria-hidden="true">GOAL!</div>{/if}
  </div>
  <div class="mg-dir muted" aria-hidden="true">
    <span>{L.attackHome({ t: home })}</span>
    <span>{L.attackAway({ t: away })}</span>
  </div>
</section>

<style>
  .mg {
    --mg-home: var(--pitch-accent);
    --mg-home-ink: #1b1405;
    --mg-away: #22324f;
    --mg-away-ink: #f2f6f1;
    display: grid;
    gap: 5px;
  }
  .mg-field {
    position: relative;
    container-type: inline-size;
    width: 100%;
    aspect-ratio: 105 / 68;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: repeating-linear-gradient(90deg, var(--pitch) 0 10%, var(--pitch-2) 10% 20%);
    --mg-dot: clamp(16px, 5cqw, 24px);
  }
  .mg-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: var(--chalk);
    stroke-width: 0.35;
  }
  .mg-shade {
    position: absolute;
    inset: 0;
    background: rgba(6, 18, 12, 0.28);
  }
  .mg-net {
    position: absolute;
    right: 0;
    top: 39%;
    width: 6px;
    height: 22%;
    border-radius: 2px;
    background: var(--pitch-accent);
    animation: mg-net 0.9s ease-out 2;
  }
  .mg-net.left {
    right: auto;
    left: 0;
  }
  .mg-pl {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--mg-dot);
    height: var(--mg-dot);
    margin: calc(var(--mg-dot) / -2) 0 0 calc(var(--mg-dot) / -2);
    border-radius: 50%;
    font: 700 calc(var(--mg-dot) * 0.56) / 1 var(--display);
    font-variant-numeric: tabular-nums;
    transition:
      left var(--mg-dur) cubic-bezier(0.45, 0.05, 0.35, 1),
      top var(--mg-dur) cubic-bezier(0.45, 0.05, 0.35, 1),
      transform 0.3s ease,
      opacity 0.3s ease;
  }
  .mg-pl.home {
    background: var(--mg-home);
    color: var(--mg-home-ink);
    box-shadow: 0 0 0 1.5px var(--mg-home-ink);
  }
  .mg-pl.away {
    background: var(--mg-away);
    color: var(--mg-away-ink);
    box-shadow: 0 0 0 1.5px var(--mg-away-ink);
  }
  .mg-pl.on {
    z-index: 4;
    transform: scale(1.25);
  }
  .mg-pl.home.on,
  .mg-pl.home.mate {
    box-shadow:
      0 0 0 1.5px var(--mg-home-ink),
      0 0 0 4px color-mix(in srgb, var(--mg-home) 50%, transparent);
  }
  .mg-pl.away.on {
    box-shadow:
      0 0 0 1.5px var(--mg-away-ink),
      0 0 0 4px rgba(242, 246, 241, 0.35);
  }
  .mg-pl.mate {
    z-index: 3;
  }
  .mg-pl.dim {
    opacity: 0.45;
  }
  .mg-tag {
    position: absolute;
    top: calc(var(--mg-dot) + 3px);
    left: 50%;
    transform: translateX(-50%);
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(10, 24, 17, 0.85);
    color: #f2f6f1;
    font: 500 10px/1.4 var(--body);
    white-space: nowrap;
  }
  .mg-ball {
    position: absolute;
    z-index: 5;
    width: 9px;
    height: 9px;
    margin: -4.5px 0 0 -4.5px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow:
      0 0 0 1.5px #0a1811,
      0 2px 3px rgba(0, 0, 0, 0.45);
    transition:
      left calc(var(--mg-dur) * 0.8) cubic-bezier(0.3, 0.1, 0.3, 1),
      top calc(var(--mg-dur) * 0.8) cubic-bezier(0.3, 0.1, 0.3, 1);
  }
  .mg-trail,
  .mg-arrows {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    fill: none;
    pointer-events: none;
  }
  .mg-trail polyline {
    stroke: rgba(255, 255, 255, 0.75);
    stroke-width: 1.6;
    stroke-dasharray: 2 4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .mg-arrows path {
    stroke: var(--pitch-accent);
    stroke-width: 2;
    stroke-dasharray: 5 4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .mg-arrows circle {
    fill: var(--pitch-accent);
  }
  .mg-key {
    position: absolute;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border-radius: 50%;
    background: var(--pitch);
    color: var(--pitch-accent);
    box-shadow: 0 0 0 1.5px var(--pitch-accent);
    font: 700 12px/1 var(--display);
  }
  .mg-banner {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 6;
    transform: translate(-50%, -50%);
    font: 800 clamp(2.2rem, 13cqw, 3.4rem) / 1 var(--display);
    letter-spacing: 0.06em;
    color: var(--pitch-accent);
    text-shadow:
      0 2px 0 #0a1811,
      0 0 18px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: mg-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .mg-dir {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--fs-caption);
  }
  @keyframes mg-net {
    0% {
      opacity: 0.2;
    }
    40% {
      opacity: 1;
    }
    100% {
      opacity: 0.3;
    }
  }
  @keyframes mg-pop {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.6);
    }
    100% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mg-pl,
    .mg-ball {
      transition: none;
    }
    .mg-net,
    .mg-banner {
      animation: none;
    }
  }
</style>
