<script lang="ts" module>
  // T-11-373 강화 효과의 별(왼쪽 %, 위 %, 크기 px, 지연 s).
  type FxBit = { x: number; y: number; z: number; d: number };
  const STARS: FxBit[] = [
    { x: 62, y: 17, z: 12, d: 0 },
    { x: 14, y: 44, z: 9, d: 0.7 },
    { x: 78, y: 70, z: 10, d: 1.3 },
    { x: 30, y: 82, z: 7, d: 1.9 },
  ];
  const STARS_MORE: FxBit[] = [
    { x: 40, y: 32, z: 8, d: 0.4 },
    { x: 84, y: 38, z: 7, d: 1.1 },
    { x: 8, y: 66, z: 8, d: 1.6 },
    { x: 56, y: 88, z: 9, d: 2.1 },
  ];
  const FX_BITS: Record<number, FxBit[]> = {
    5: STARS,
    8: [...STARS, ...STARS_MORE],
    9: [...STARS, ...STARS_MORE],
    10: [...STARS, ...STARS_MORE],
  };
</script>

<script lang="ts">
  import { cardAvatarSpec } from '@offside/game/avatar';
  import PixelAvatar from '../PixelAvatar.svelte';
  import { intlLocale } from '@offside/contracts/i18n';
  import { tn } from '@offside/game/i18n/names';
  import { onMount } from 'svelte';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
  import { typeName } from '@offside/game/data';
  import type { DetailPos } from '@offside/contracts/positions';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
  import { cardBody, cardFootNote, cardSeasonBadge, cardSeasonColor, cardTier, isLegendTier } from '@offside/app-core/format';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import { specialRibbon } from '@offside/app-core/cardSpecial';
  import { enhanceFx } from '@offside/app-core/cardEnhanceFx';
  import { showsPosOvr } from '@offside/app-core/cardEnhance';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';

  let { player, name, rating, role, nation, season, compact = false, mini = false, youth = false, deploymentRating, ratingLabel = L.peakOvr }:
    { player?: TeamPlayer | undefined; name: string; rating: number; role: DetailPos; nation?: string | null | undefined; season?: number | undefined; compact?: boolean; mini?: boolean; youth?: boolean; deploymentRating?: number | undefined; ratingLabel?: string } = $props();
  // T-11-114 카드 시즌 뱃지(유스 선수·시즌을 모르는 옛 응답은 없다).
  const portrait = $derived(!youth && player?.careerId ? cardAvatarSpec(player) : null);
  const cardSeason = $derived(youth ? undefined : (season ?? player?.season));
  const country = $derived(!youth ? NATION_BY_CODE.get(nation ?? player?.nation ?? DEFAULT_NATION) : undefined);
  const tier = $derived(youth ? 'youth' : cardTier(player?.legendScore, player?.peak ?? rating));
  // T-11-372 시즌 특별 카드 띠(가장 최근 시즌 · 높은 표식 하나).
  const special = $derived(youth ? null : specialRibbon(player?.specials, player?.daily));
  const specialColor = $derived(special?.color ?? null);
  // T-11-373 강화 단계 효과(등급 색 위에 입힌다).
  const level = $derived(youth ? 0 : (player?.enhance ?? 0));
  const fx = $derived(enhanceFx(level));
  const fxLine = $derived(fx ? `linear-gradient(135deg,${fx.stops.join(',')})` : undefined);
  const fxSpin = $derived(fx && level >= 5 ? `conic-gradient(${fx.stops.join(',')})` : undefined);
  const fxBits = $derived(FX_BITS[level] ?? []);
  const statKeys = $derived(player?.pos === 'GK' ? ['def', 'phy', 'pas', 'pac', 'sho', 'dri'] as const : ['pac', 'sho', 'dri', 'pas', 'def', 'phy'] as const);
  const statLabels = $derived(player?.pos === 'GK' ? GK_ABBR : FACE_ABBR);
  // 플레이스타일(커리어 유형 — 시너지 듀오의 기준). 자리가 좁은 compact 카드에는 넣지 않는다.
  const style = $derived(!compact && player ? typeName(player.pos, player.type) : null);
  const body = $derived(player ? cardBody(player) : null);
  let nameViewport = $state<HTMLElement>();
  let viewportWidth = $state(0);
  let nameWidth = $state(0);
  let inView = $state(false);
  const nameOverflow = $derived(Math.max(0, nameWidth - viewportWidth));
  const nameDuration = $derived(Math.max(8, nameOverflow / 12 + 4));
  onMount(() => {
    // 간소화 카드(mini)는 이름 띠가 없다.
    if (!nameViewport) return;
    const observer = new IntersectionObserver(([entry]) => (inView = !!entry?.isIntersecting));
    observer.observe(nameViewport);
    return () => observer.disconnect();
  });
  // 자리 OVR은 제 자리가 아닐 때만 — 같으면 같은 숫자가 두 번 보인다. 강화 OVR만큼 높은 것은 +N 배지로 안다.
  const deployed = $derived(deploymentRating !== undefined && showsPosOvr(rating, deploymentRating, level));
</script>

{#snippet card()}
<div class="player-card" data-enhance={fx ? level : undefined} style:--fx-line={fxLine} style:--fx-spin={fxSpin} data-fx-spin={fxSpin ? '' : undefined} class:compact class:mini class:youth class:deployed class:special={!!special} data-tier={tier} data-special={special?.kind} style:--special-bg={specialColor?.bg} style:--special-ink={specialColor?.ink} style:--special-glow={specialColor?.glow}>
  <div class="card-face">
    {#if fx}<span class="card-fx" aria-hidden="true">{#each fxBits as b (`${b.x}-${b.d}`)}<i style:left="{b.x}%" style:top="{b.y}%" style:--z="{b.z}px" style:animation-delay="{b.d}s"></i>{/each}</span>{/if}
    <div class="card-rating" title="{ratingLabel} {rating}"><b>{rating}</b><span>{role}</span></div>
    {#if cardSeason !== undefined}<span class="card-season" data-card-season={cardSeason} style:--season-bg={cardSeasonColor(cardSeason)} title={teamSeasonLabel(cardSeason)}>{cardSeasonBadge(cardSeason)}</span>{/if}
    {#if country}<span class="card-nation" role="img" aria-label={L.nationAria({ name: tn(country.ko) })} title={tn(country.ko)}>{flagOf(country.code)}</span>{/if}
    {#if fx}<span class="card-enhance" data-card-enhance={level} style:color={fx.badgeInk}>+{level}</span>{/if}
    {#if special && compact}<span class="card-special" data-card-special={special.kind} data-card-special-season={special.season} role="img" aria-label={special.aria} title={special.text}>{special.text}</span>{/if}
    {#if player?.locked && !youth}<span class="card-lock" data-card-locked role="img" aria-label={L.lockedAria} title={L.lockedAria}><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg></span>{/if}
    <div class="card-art" class:has-portrait={!!portrait} aria-hidden="true">
      {#if portrait}
        <PixelAvatar spec={portrait} portrait />
        {#if player?.number != null}<span class="portrait-number">{player.number}</span>{/if}
      {:else}
      <svg viewBox="0 0 100 96"><path d="M30 10 15 17 3 38 20 48 26 36 24 90 76 90 74 36 80 48 97 38 85 17 70 10 62 5Q50 16 38 5Z" /><path class="shirt-trim" d="M38 5Q50 25 62 5M25 73H75M34 12V87M66 12V87" /></svg>
      <span class="shirt-number">{player?.number ?? (youth ? '+' : name.slice(0, 1))}</span>
      {/if}
    </div>
    {#if !mini}<strong class="card-name" class:scrolling={nameOverflow > 1} class:in-view={inView} title={name}
      bind:this={nameViewport} bind:clientWidth={viewportWidth} style:--name-offset="-{nameOverflow}px" style:--name-duration="{nameDuration}s">
      <span class="name-track" bind:offsetWidth={nameWidth}>{name}</span>
    </strong>{/if}
    {#if style}<span class="card-type" data-card-type={player?.type}>{style}</span>{/if}
    {#if deployed && deploymentRating !== undefined}<span class="card-deployment" title={L.posOvr({ n: deploymentRating })}><span>{L.posOvrLabel}</span><b>{deploymentRating}</b></span>{/if}
    {#if !compact}
      <div class="card-divider"></div>
      <div class="card-career"><span title={L.legendScoreTitle}>LS</span><b>{(player?.legendScore ?? 0).toLocaleString(intlLocale())}</b></div>
      {#if body}<div class="card-body" data-card-body>{body}</div>{/if}
      <dl class="card-attributes" aria-label={L.attributesAria}>
        {#each statKeys as key (key)}
          <div><dt>{statLabels[key]}</dt><dd>{player?.attrs ? Math.round(player.attrs[key]) : '—'}</dd></div>
        {/each}
      </dl>
      {#if special}<div class="card-special-foot" data-card-special={special.kind} data-card-special-season={special.season} role="img" aria-label={special.aria}>{special.text}</div>{/if}
      <div class="card-foot">{cardFootNote(player ?? {}) ?? (isLegendTier(tier) ? L.footLegend : L.footMine)}</div>
    {/if}
  </div>
</div>
{/snippet}

{#if fx}<div class="card-fx-wrap" data-enhance={level} style:--fx-glow={fx.glow}>{@render card()}</div>{:else}{@render card()}{/if}

<style>
  .player-card { --card-base:#e8d5a8; --card-light:#fff2ce; --card-dark:#8a6324; --card-ink:#392b14; --card-line:#b79654; width:100%; padding:2px; background:var(--card-line); clip-path:polygon(0 9%,16% 9%,25% 2%,50% 0,75% 2%,84% 9%,100% 9%,98% 84%,86% 93%,50% 100%,14% 93%,2% 84%); filter:drop-shadow(0 4px 5px #0003); }
  .player-card[data-tier='icon'] { --card-base:#1d2547; --card-light:#4a5a92; --card-dark:#0a0f26; --card-ink:#ffe9b0; --card-line:#e6c369; }
  .player-card[data-tier='legend'] { --card-base:#28382e; --card-light:#51614b; --card-dark:#101e17; --card-ink:#fce7b1; --card-line:#d1ac5f; }
  .player-card[data-tier='elite'] { --card-base:#f1c654; --card-light:#fff4bf; --card-dark:#a36f12; --card-ink:#3b2604; --card-line:#d99a1e; }
  .player-card[data-tier='silver'] { --card-base:#d6dfe0; --card-light:#f8faf6; --card-dark:#83989c; --card-ink:#243339; --card-line:#9fb3b6; }
  .player-card[data-tier='bronze'] { --card-base:#d7a27a; --card-light:#f6d6bb; --card-dark:#7d4a29; --card-ink:#3a1f0e; --card-line:#a86e45; }
  .player-card[data-tier='youth'] { --card-base:#d5e4d8; --card-light:#eaf3e9; --card-dark:#9bae9b; --card-ink:#365342; --card-line:#8cab97; opacity:.82; }
  .card-face { position:relative; overflow:hidden; min-height:183px; padding:28px 10px 20px; clip-path:inherit; background:linear-gradient(135deg,transparent 34%,#ffffff25 34.5%,transparent 35%,transparent 62%,#ffffff1c 62.5%,transparent 63%),radial-gradient(ellipse at 80% 10%,var(--card-light),transparent 70%),linear-gradient(165deg,var(--card-base),var(--card-dark)); color:var(--card-ink); }
  .card-rating { position:absolute; top:28px; left:11px; display:flex; flex-direction:column; align-items:center; z-index:1; }
  .card-rating b { font-family:var(--display); font-size:2.3rem; font-weight:800; line-height:.9; }
  .card-rating span { font-family:var(--display); font-size:var(--fs-label); font-weight:700; line-height:1; margin-top:4px; }
  .card-nation {position:absolute;top:82px;left:11px;z-index:1;width:36px;text-align:center;font-family:system-ui,sans-serif;font-size:18px;line-height:18px;}
  /* T-11-114 시즌 뱃지(색은 cardSeasonColor). */
  .card-lock {position:absolute;top:30px;right:11px;z-index:1;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#000a;box-shadow:0 0 0 1px #ffffff66 inset;} .card-lock svg {width:13px;height:13px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;} .card-lock rect {fill:#fff;stroke:none;}
  .compact .card-lock {top:32px;right:5px;width:16px;height:16px;} .compact .card-lock svg {width:10px;height:10px;}
  /* T-11-373 강화 단계 효과. 등급 면은 그대로 두고 테두리 · 빛 · 움직임만 얹는다. 움직임은 transform · opacity만 쓰고, 움직임 줄이기를 따른다. */
  .card-fx-wrap {width:100%;filter:drop-shadow(0 0 var(--fx-blur,3px) var(--fx-glow));}
  .card-fx-wrap[data-enhance='2'] {--fx-blur:4px;}
  .card-fx-wrap[data-enhance='3'] {--fx-blur:6px;}
  .card-fx-wrap[data-enhance='4'] {--fx-blur:8px;}
  .card-fx-wrap[data-enhance='5'] {--fx-blur:11px;}
  .card-fx-wrap[data-enhance='6'],.card-fx-wrap[data-enhance='7'] {--fx-blur:12px;}
  .card-fx-wrap[data-enhance='8'],.card-fx-wrap[data-enhance='9'] {--fx-blur:14px;}
  .card-fx-wrap[data-enhance='10'] {--fx-blur:18px;}
  .player-card[data-enhance] {position:relative;background:var(--fx-line);padding:3px;filter:none;}
  .player-card[data-enhance='1'],.player-card[data-enhance='2'] {padding:2px;}
  .player-card[data-enhance='3'],.player-card[data-enhance='4'] {width:calc(100% + 2px);margin:-1px;}
  .player-card[data-fx-spin] {width:calc(100% + 4px);margin:-2px;padding:4px;overflow:hidden;}
  .player-card[data-enhance='10'] {width:calc(100% + 6px);margin:-3px;padding:5px;}
  .player-card[data-fx-spin]::before {content:'';position:absolute;left:50%;top:50%;width:190%;aspect-ratio:1;translate:-50% -50%;background:var(--fx-spin);animation:fx-spin 5s linear infinite;}
  .player-card[data-enhance='10']::before {animation-duration:3s;}
  .player-card[data-enhance] > .card-face {z-index:1;}
  .card-fx {position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;}
  .card-fx::before,.card-fx::after {content:'';position:absolute;}
  /* +1 잔디: 잔디 깎은 줄무늬가 아래에서 올라온다. */
  [data-enhance='1'] .card-fx::before {inset:55% 0 0;background:repeating-linear-gradient(90deg,#35d68a33 0 12%,#35d68a0d 12% 24%);-webkit-mask-image:linear-gradient(transparent,#000);mask-image:linear-gradient(transparent,#000);}
  /* +2 조명탑: 위 양쪽에서 내리꽂는 빛줄기. */
  [data-enhance='2'] .card-fx::before {inset:0;background:linear-gradient(112deg,#ffffff66 0,#bfe8ff33 18%,transparent 42%),linear-gradient(248deg,#ffffff66 0,#bfe8ff33 18%,transparent 42%);}
  /* +3 홍염: 아래에서 피어오르는 불빛이 일렁인다. */
  [data-enhance='3'] .card-fx::before {inset:40% -10% -5%;background:radial-gradient(60% 75% at 25% 100%,#ff6a2bb0,transparent 75%),radial-gradient(55% 90% at 72% 100%,#ffd34da0,transparent 75%),linear-gradient(transparent,#e5261f55);mix-blend-mode:screen;transform-origin:50% 100%;animation:fx-flare 2.4s ease-in-out infinite alternate;}
  [data-enhance='3'] .card-fx::after {inset:0;background:radial-gradient(1.5px 1.5px at 22% 74%,#fff3b0,transparent),radial-gradient(1.5px 1.5px at 66% 82%,#ffd34d,transparent),radial-gradient(1px 1px at 44% 66%,#fff3b0,transparent),radial-gradient(1px 1px at 82% 62%,#ffb14d,transparent);animation:fx-ember 3.2s ease-out infinite;}
  /* +4 오프사이드 라인: 판독 라인이 카드를 좌우로 훑는다. */
  [data-enhance='4'] .card-fx::before {inset:0;background:linear-gradient(90deg,#7a5cff33 1px,transparent 1px) 0 0/16.66% 100%,linear-gradient(165deg,#f04dff24,#7cf8ff24);}
  [data-enhance='4'] .card-fx::after {top:0;bottom:0;left:0;width:18%;background:linear-gradient(90deg,transparent,#7cf8ff55 70%,#fff 88%,#7cf8ff 90%,transparent 92%);animation:fx-var 3.2s ease-in-out infinite alternate;}
  /* +5 풀타임: 무지개 테두리가 돌고, 홀로그램 빛이 지나가고, 별이 반짝인다. */
  [data-enhance='5'] .card-fx::before {inset:0;background:linear-gradient(125deg,#ff5f6d2e,#fff27a2e 30%,#7cf29c2e 50%,#6ad0ff2e 70%,#b388ff2e);}
  [data-enhance='5'] .card-fx::after {top:-20%;bottom:-20%;left:-60%;width:45%;background:linear-gradient(100deg,transparent,#ffffff70 50%,transparent);transform:rotate(12deg);animation:fx-sheen 3.6s ease-in-out infinite;}
  /* +6 연장전: 시계 눈금이 천천히 돌고 금빛이 지나간다. */
  [data-enhance='6'] .card-fx::before {left:50%;top:42%;width:92%;aspect-ratio:1;translate:-50% -50%;border-radius:50%;background:repeating-conic-gradient(#fff3b070 0 1.5deg,transparent 1.5deg 15deg);-webkit-mask-image:radial-gradient(closest-side,transparent 86%,#000 87%);mask-image:radial-gradient(closest-side,transparent 86%,#000 87%);animation:fx-spin 12s linear infinite;}
  [data-enhance='6'] .card-fx::after,[data-enhance='8'] .card-fx::after,[data-enhance='9'] .card-fx::after,[data-enhance='10'] .card-fx::after {top:-20%;bottom:-20%;left:-60%;width:45%;background:linear-gradient(100deg,transparent,#fff3b080 50%,transparent);transform:rotate(12deg);animation:fx-sheen 3.6s ease-in-out infinite;}
  /* +7 승부차기: 골망 위로 조명이 숨 쉰다. */
  [data-enhance='7'] .card-fx::before {inset:0 0 34%;background:repeating-linear-gradient(45deg,#ffffff38 0 1px,transparent 1px 9px),repeating-linear-gradient(-45deg,#ffffff38 0 1px,transparent 1px 9px);-webkit-mask-image:linear-gradient(#000 45%,transparent);mask-image:linear-gradient(#000 45%,transparent);}
  [data-enhance='7'] .card-fx::after {inset:0;background:radial-gradient(60% 45% at 50% 45%,#ff3b4e66,transparent 75%);animation:fx-breath 2.2s ease-in-out infinite alternate;}
  /* +8 결승전: 푸른 밤하늘에 금별. */
  [data-enhance='8'] .card-fx::before {inset:0;background:linear-gradient(170deg,#1d4fff26,#051a6633);}
  [data-enhance='8'] .card-fx i,[data-enhance='9'] .card-fx i {background:#ffe27a;}
  /* +9 우승컵: 위에서 금빛이 내려오고 금별이 반짝인다. */
  [data-enhance='9'] .card-fx::before {inset:0;background:radial-gradient(90% 55% at 50% 0,#ffd21f88,transparent 75%);}
  /* +10 마지막 휘슬: 빛살이 돌고 별이 반짝인다. */
  [data-enhance='10'] .card-fx::before {left:50%;top:40%;width:170%;aspect-ratio:1;translate:-50% -50%;background:repeating-conic-gradient(#fff1a866 0 7deg,transparent 7deg 20deg);-webkit-mask-image:radial-gradient(closest-side,#000 15%,transparent 72%);mask-image:radial-gradient(closest-side,#000 15%,transparent 72%);mix-blend-mode:screen;animation:fx-spin 14s linear infinite;}
  [data-enhance='10'] .card-rating b,[data-enhance='9'] .card-rating b,[data-enhance='8'] .card-rating b {text-shadow:0 0 6px #fff3b0;}
  .card-fx i {position:absolute;width:var(--z,12px);height:var(--z,12px);background:#fff;clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);animation:fx-twinkle 2.4s ease-in-out infinite;}
  .compact .card-fx i {width:7px;height:7px;}
  @keyframes fx-spin {to {rotate:360deg;}}
  @keyframes fx-breath {from {opacity:.35;} to {opacity:1;}}
  @keyframes fx-flare {from {opacity:.65;transform:scaleY(.86);} to {opacity:1;transform:scaleY(1.08);}}
  @keyframes fx-ember {from {opacity:0;transform:translateY(14%);} 25% {opacity:1;} to {opacity:0;transform:translateY(-26%);}}
  @keyframes fx-var {from {transform:translateX(-30%);} to {transform:translateX(480%);}}
  @keyframes fx-sheen {0%,35% {transform:translateX(0) rotate(12deg);} 100% {transform:translateX(420%) rotate(12deg);}}
  @keyframes fx-twinkle {0%,100% {opacity:0;transform:scale(.3) rotate(0);} 50% {opacity:1;transform:scale(1) rotate(45deg);}}
  @media(prefers-reduced-motion:reduce) {
    .player-card[data-fx-spin]::before,.card-fx::before,.card-fx::after {animation:none;}
    [data-enhance='4'] .card-fx::after {left:62%;}
    [data-enhance='5'] .card-fx::after,[data-enhance='6'] .card-fx::after,[data-enhance='8'] .card-fx::after,[data-enhance='9'] .card-fx::after,[data-enhance='10'] .card-fx::after {display:none;}
    .card-fx i {animation:none;opacity:.9;}
    }
  /* 자물쇠 아래 오른쪽 단계 배지. */
  .card-enhance {position:absolute;top:44px;left:44px;z-index:2;padding:2px 6px 1px;border-radius:999px;background:var(--fx-line);font:800 11px/1.2 var(--display);box-shadow:0 0 0 1px #ffffff88 inset,0 1px 3px #0006;}
  .compact .card-enhance {top:50px;left:auto;right:4px;padding:1px 4px 0;font-size:8px;}
  .card-season {position:absolute;top:9px;left:50%;transform:translateX(-50%);z-index:1;padding:2px 5px 1px;border-radius:3px;background:var(--season-bg);color:#fff;font:800 9px/1.1 system-ui,sans-serif;letter-spacing:.06em;box-shadow:0 0 0 1px #ffffff55 inset;}
  .compact .card-season {top:4px;padding:1px 3px 0;font-size:7px;}
  /* T-11-372 시즌 특별 카드: 테두리를 표식 색으로 바꾸고 빛을 두르며, 아래쪽에 띠를 단다. */
  .player-card.special { --card-line:var(--special-bg); filter:drop-shadow(0 0 5px var(--special-glow)) drop-shadow(0 4px 5px #0003); }
  .card-special {position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:2;max-width:86%;padding:2px 7px 1px;border-radius:3px;background:var(--special-bg);color:var(--special-ink);font:800 9px/1.2 system-ui,sans-serif;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 0 0 1px #ffffff88 inset,0 1px 3px #0005;}
  .compact .card-special {bottom:4px;padding:1px 4px 0;font-size:7px;}
  .mini .card-special {display:none;}
  .card-special-foot {width:max-content;max-width:92%;margin:7px auto 0;padding:2px 8px 1px;border-radius:3px;background:var(--special-bg);color:var(--special-ink);font:800 .62rem/1.3 system-ui,sans-serif;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 0 0 1px #ffffff88 inset;}
  .card-special-foot + .card-foot {margin-top:4px;}
  .card-deployment {display:flex;flex-direction:column;align-items:center;font-size:8px;line-height:10px;}
  .card-deployment b {font-family:var(--display);font-size:12px;line-height:13px;}
  .card-art { position:relative; height:72px; margin-left:26px; }
  .card-art svg { width:100%; height:100%; fill:var(--card-dark); stroke:var(--card-ink); stroke-opacity:.4; stroke-width:1.4; }
  .card-art .shirt-trim { fill:none; stroke:var(--card-light); stroke-width:2; stroke-opacity:.65; }
  .shirt-number { position:absolute; inset:25% 0 0; display:flex; align-items:center; justify-content:center; font-family:var(--display); font-size:1.8rem; font-weight:700; }
  .card-art.has-portrait { display:flex; justify-content:center; align-items:flex-end; }
  .card-art.has-portrait :global(.avatar) { width:auto; max-width:100%; height:100%; }
  .portrait-number { position:absolute; right:0; bottom:0; min-width:16px; padding:1px 3px; border-radius:3px; color:var(--card-light); background:var(--card-ink); font:700 10px/1.1 var(--display); text-align:center; }
  .compact .portrait-number { min-width:10px; padding:0 2px; font-size:7px; }
  .card-name { display:block; margin-top:4px; text-align:center; font-size:var(--fs-body2); white-space:nowrap; overflow:hidden; line-height:1.6; }
  .name-track {display:inline-block;width:max-content;vertical-align:top;}
  .card-name.scrolling {text-align:left;}
  .card-name.scrolling .name-track {animation:card-name-scroll var(--name-duration) linear infinite;}
  .card-name:not(.in-view) .name-track,
  .player-card:hover .name-track,
  .player-card:active .name-track,
  :global(button:focus-visible) .name-track {animation-play-state:paused;}
  @keyframes card-name-scroll {0%,15% {transform:translateX(0);} 85%,100% {transform:translateX(var(--name-offset));}}
  @media(prefers-reduced-motion:reduce) {
    .card-name.scrolling {overflow-x:auto;scrollbar-width:none;}
    .card-name.scrolling .name-track {animation:none;}
    .card-name::-webkit-scrollbar {display:none;}
  }
  .card-type {display:block;width:max-content;max-width:100%;margin:3px auto 0;padding:1px 7px;border:1px solid color-mix(in srgb,var(--card-ink),transparent 65%);border-radius:var(--radius-pill);font-size:10px;line-height:1.4;font-weight:700;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .card-divider { height:1px; background:var(--card-ink); opacity:.25; margin:4px 0 6px; }
  .card-career { display:flex;justify-content:center;align-items:baseline;gap:4px;font-size:var(--fs-caption); }
  .card-career b { font-family:var(--display); font-size:var(--fs-title3); }
  .card-body { font-size:var(--fs-caption2); text-align:center; font-weight:700; opacity:.85; }
  .card-attributes {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 4px;margin:8px 0 0;text-align:center;}
  .card-attributes dt {font-size:10px;line-height:1.3;font-weight:600;}
  .card-attributes dd {margin:0;font-family:var(--display);font-size:var(--fs-title2);line-height:1.1;font-weight:700;}
  .card-foot { font-size:var(--fs-caption2); text-align:center; margin-top:7px; opacity:.8; }
  .compact .card-face { min-height:0; height:100px; padding:11px 4px 13px; }
  .compact .card-rating { top:14px; left:7px; }
  .compact .card-rating b { font-size:var(--fs-title1); }
  .compact .card-rating span { font-size:var(--fs-caption2); margin-top:2px; }
  .compact .card-nation {top:13px;left:auto;right:5px;width:16px;font-size:12px;line-height:14px;}
  .compact .card-art { height:48px; margin:10px 0 0 17px; }
  .compact .shirt-number { font-size:var(--fs-title3); }
  .compact .card-name { font-size:11px; margin-top:3px; }
  .compact.deployed .card-art {height:36px;}
  @media(max-width:440px) { .compact .card-face { height:88px; padding:8px 3px 10px; } .compact .card-rating { left:5px;top:11px; } .compact .card-season {top:2px;} .compact .card-rating b { font-size:var(--fs-title2); } .compact .card-art { height:34px;margin-top:8px; } .compact .shirt-number {font-size:var(--fs-body);} .compact.deployed .card-art {height:24px;} }
  /* 이적시장 목록용 — 이름은 줄 옆에 따로 나오므로 카드에서 뺀다(compact와 같이 쓴다). 높이는 이름 줄만큼 줄인다. */
  .mini .card-face {height:84px;}
  @media(max-width:440px) { .mini .card-face {height:68px;} }
</style>
