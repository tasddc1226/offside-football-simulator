<script lang="ts">
  // T-11-128 결산 단체사진 — 그 시즌에 키운 선수들을 국가대표 단체사진처럼 세운다(뒷줄은 서고 앞줄은 조금 낮게).
  // 얼굴은 커리어 ID, 유니폼은 마지막 구단(명예의 전당 시상대와 같은 전성기 도트). 대표 선수(1등)는 앞줄 가운데에 주장 완장.
  // 화면에 처음 들어올 때 플래시가 한 번 터진다(움직임 줄이기면 없다).
  import type { RecapSquadMember } from '@offside/contracts';
  import { primeAvatarSpec } from '@offside/game/avatar';
  import { playerName } from '@offside/app-core/format';
  import { PHOTO_MAX, photoRows } from '@offside/app-core/seasonRecap';
  import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
  import PixelAvatar from '../PixelAvatar.svelte';

  const { squad, season }: { squad: readonly RecapSquadMember[]; season: string } = $props();
  const captain = $derived(squad[0]?.card.careerId);
  // 앞줄이 0번이라 뒤집어 뒷줄부터 그린다.
  const rows = $derived(photoRows(squad).reverse());
  const more = $derived(Math.max(0, squad.length - PHOTO_MAX));
  const nameOf = (m: RecapSquadMember) => playerName(m.card.publicName, m.card.pos, m.card.number);
  const specOf = (m: RecapSquadMember) => {
    const spec = primeAvatarSpec({ id: m.card.careerId, lastClub: m.lastClub ?? '', lastClubId: m.lastClubId });
    return m.card.careerId === captain ? { ...spec, acc: [...spec.acc, 'armband' as const] } : spec;
  };

  let shot = $state(false);
  function flash(node: HTMLElement) {
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      shot = true;
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }
</script>

<figure class="photo" class:shot use:flash data-recap-photo aria-label={L.photoAria({ season, names: squad.slice(0, PHOTO_MAX).map(nameOf).join(', ') })}>
  <div class="stage" aria-hidden="true">
    <span class="banner">{L.photoCaption({ season })}</span>
    {#each rows as row, r (r)}
      <div class="line" style="--row: {rows.length - 1 - r}; --n: {row.length}">
        {#each row as m (m.card.careerId)}
          <span class="mate" class:captain={m.card.careerId === captain} title={nameOf(m)}>
            <PixelAvatar spec={specOf(m)} />
          </span>
        {/each}
      </div>
    {/each}
    <span class="flash"></span>
  </div>
  <figcaption>
    <b>{L.photoCaption({ season })}</b>
    {#if more > 0}<span>{L.photoMore({ n: more })}</span>{/if}
  </figcaption>
</figure>

<style>
  .photo { margin: 0; }
  /* 경기장 — 위는 관중석(점), 아래는 줄무늬 잔디. 테마와 상관없이 같은 사진. */
  .stage {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    min-height: 168px;
    padding: 34px 6px 14px;
    border-radius: 14px;
    background:
      radial-gradient(circle at 20% 18%, #ffffff14 0 1px, transparent 2px) 0 0 / 9px 9px,
      linear-gradient(180deg, #1b2a3a 0, #22374a 42%, transparent 42%),
      repeating-linear-gradient(90deg, #2f7a4c 0 28px, #2a6f45 28px 56px);
    isolation: isolate;
  }
  .banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 12px;
    border-radius: 4px;
    background: #f0b437;
    color: #231700;
    font-family: var(--display);
    font-size: 0.8125rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  /* 뒷줄일수록 위로 겹쳐 서고, 앞줄일수록 앞(위 레이어). 한 줄은 살짝 겹쳐 붙는다. */
  .line {
    flex-wrap: nowrap;
    display: flex;
    justify-content: center;
    margin-top: -22px;
    z-index: calc(10 - var(--row));
  }
  .line:first-of-type { margin-top: 0; }
  .line:nth-of-type(even) { transform: translateX(6px); }
  .mate {
    display: block;
    width: 48px;
    height: 64px;
    margin-inline: -6px;
    filter: drop-shadow(0 3px 2px #0006);
  }
  .mate :global(.avatar) { width: 100%; height: 100%; }
  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    z-index: 20;
  }
  .shot .flash { animation: flash 0.9s ease-out; }
  .shot .mate { animation: settle 0.6s ease-out both; }
  figcaption {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 0.8125rem;
  }
  figcaption span { color: var(--muted); }
  @keyframes flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
  @keyframes settle { from { transform: translateY(4px); } }
  /* 좁은 폰(360px 이하)에서도 한 줄 8명이 들어가게 더 겹쳐 선다(도트는 정수배 48×64 그대로). */
  @media (max-width: 360px) {
    .mate { margin-inline: -9px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .shot .flash, .shot .mate { animation: none; }
  }
</style>
