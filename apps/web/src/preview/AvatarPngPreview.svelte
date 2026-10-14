<script lang="ts">
  import { primeAvatarSpec } from '@offside/game/avatar';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PixelAvatar from '../ui/PixelAvatar.svelte';
  import PlayerCard from '../ui/team/PlayerCard.svelte';
  import OriginalPngAvatar from '../ui/OriginalPngAvatar.svelte';
  import LegacyImagePreview from './LegacyImagePreview.svelte';
  import { ORIGINAL_AVATARS, type OriginalAvatarStyle, type OriginalAvatarPose } from '../ui/originalAvatar';

  import { avatarPngReviewText as L } from '@offside/app-core/i18n/ko/avatarPngReview';
  let artwork = $state<OriginalAvatarStyle>('dread');
  let pose = $state<OriginalAvatarPose>('standing');
  let dark = $state(false);
  const spec = primeAvatarSpec({ id: 'png-review-player', lastClub: '' });
  const player: TeamPlayer = {
    careerId: 'png-review-player', publicName: 'OFFSIDE', pos: 'FW', dpos: 'ST', peak: 94,
    roles: null, attrs: { pac: 92, sho: 96, dri: 91, pas: 85, def: 42, phy: 88 },
    number: 10, legendScore: 1200, nation: 'KR', season: 1, height: 180, weight: 75,
  };
</script>

<svelte:head><title>OFFSIDE · Original PNG review</title></svelte:head>
<main class="review" data-theme={dark ? 'dark' : 'light'}>
  <header>
    <small>OFFSIDE / WEB REVIEW / ORIGINAL PNG</small>
    <h1>{L.title}</h1>
    <p>{L.intro}</p>
    <p class="note">{L.note}</p>
  </header>
  <LegacyImagePreview />
  <nav aria-label={L.artwork}>
    {#each Object.keys(ORIGINAL_AVATARS) as key (key)}
      {@const style = key as OriginalAvatarStyle}
      <button data-artwork-pick={style} aria-pressed={artwork === style} onclick={() => artwork = style}>{L[style]}</button>
    {/each}
    <button class="theme" aria-pressed={dark} onclick={() => dark = !dark}>{L.theme}</button>
  </nav>
  <div class="columns">
    <section data-preview="character">
      <h2>{L.character}</h2>
      <div class="character-pair">
        <figure><div class="figure-art large"><PixelAvatar {spec} {artwork} /></div><figcaption>{L.originalSize}</figcaption></figure>
        <figure><div class="figure-art game-size"><PixelAvatar {spec} {artwork} /></div><figcaption>{L.gameSize}</figcaption></figure>
      </div>
      <div class="game-sample player">
        <div><strong>OFFSIDE</strong><p>ST · 26 · OVR 94</p><small>{L.careerSize}</small></div>
        <PixelAvatar {spec} {artwork} />
      </div>
    </section>
    <section data-preview="cards">
      <h2>{L.cards}</h2>
      <p class="caption">{L.cardIntro}</p>
      <div class="cards">
        <div class="full-card"><PlayerCard {player} name="OFFSIDE" rating={94} role="ST" {artwork} /></div>
        <div class="card-sizes">
          <div class="compact-card"><PlayerCard {player} name="OFFSIDE" rating={94} role="ST" {artwork} compact /></div>
          <div class="mini-card"><PlayerCard {player} name="OFFSIDE" rating={94} role="ST" {artwork} compact mini /></div>
        </div>
      </div>
    </section>
  </div>
  <section data-preview="poses">
    <h2>{L.poses}</h2>
    <nav aria-label={L.poseAria}>
      {#each ['standing', 'running', 'shooting'] as value (value)}
        {@const selectedPose = value as OriginalAvatarPose}
        <button data-pose-pick={value} aria-pressed={pose === value} onclick={() => pose = selectedPose}>{L[selectedPose]}</button>
      {/each}
    </nav>
    <div class="pose-art"><OriginalPngAvatar {artwork} {pose} /></div>
    <p class="caption">{L.poseNote}</p>
  </section>
  <footer>
    <a href={ORIGINAL_AVATARS[artwork]} target="_blank" rel="noopener">{L.openSource}</a>
    <a href="/?avatarPng={artwork}" target="_blank" rel="noopener">{L.openGame}</a>
    <p>{L.footer}</p>
  </footer>
</main>

<style>
  :global(body) { margin: 0; padding: 0; max-width: none; }
  .review { --review-bg:#edf1eb; --review-surface:#fff; --review-ink:#233b2c; --review-line:#c6d1c6; min-height:100vh; background:var(--review-bg); color:var(--review-ink); padding:24px max(16px,calc((100vw - 1060px)/2)) 48px; }
  .review[data-theme='dark'] { --review-bg:#101b16; --review-surface:#1a2b21; --review-ink:#e3eee3; --review-line:#405747; }
  header small { font:700 11px/1.5 system-ui; letter-spacing:.1em; }
  h1 { font-size:clamp(26px,4vw,40px); margin:12px 0; line-height:1.2; }
  h2 { font-size:20px; margin:0 0 12px; }
  p { margin:8px 0; line-height:1.6; }
  .note { border-left:3px solid #759477; padding-left:12px; max-width:760px; font-size:14px; }
  nav { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0; }
  nav button { min-height:44px; padding:9px 14px; border:1px solid var(--review-line); border-radius:24px; background:var(--review-surface); color:var(--review-ink); font:600 14px/1.4 system-ui; cursor:pointer; }
  nav button[aria-pressed='true'] { background:#2d6542; color:#fff; border-color:#2d6542; }
  nav button:focus-visible { outline:3px solid #d38f25; outline-offset:3px; }
  .columns { display:grid; gap:16px; }
  section { min-width:0; padding:20px 16px; margin-bottom:16px; border:1px solid var(--review-line); border-radius:16px; background:var(--review-surface); }
  .character-pair { display:flex; justify-content:space-around; align-items:end; gap:12px; }
  figure { margin:0; text-align:center; min-width:0; }
  .figure-art { display:flex; align-items:end; justify-content:center; height:260px; }
  .large :global(svg.avatar) { width:144px; height:252px; }
  .game-size :global(svg.avatar) { width:72px; height:96px; }
  figcaption, .caption { font-size:12px; line-height:1.6; }
  .game-sample { display:flex; justify-content:space-between; gap:12px; margin:24px 0 0; padding:16px; border-radius:12px; border:1px solid var(--review-line); background:var(--review-bg); color:var(--review-ink); }
  .game-sample p { font-size:13px; }
  .game-sample small { font-size:11px; }
  .cards { display:flex; align-items:start; justify-content:center; gap:16px; margin-top:18px; }
  .full-card { width:180px; flex-shrink:1; min-width:0; }
  .card-sizes { display:grid; justify-items:center; gap:16px; }
  .compact-card { width:104px; }
  .mini-card { width:68px; }
  .pose-art { display:flex; justify-content:center; height:260px; }
  .pose-art :global(svg.avatar) { width:100%; height:100%; max-width:460px; }
  footer { display:flex; flex-wrap:wrap; gap:12px 20px; font-size:13px; }
  footer a { color:inherit; text-decoration:underline; min-height:44px; display:inline-flex; align-items:center; }
  footer p { flex-basis:100%; }
  @media(min-width:760px) { .columns { grid-template-columns:1fr 1fr; } section { padding:24px; } .full-card { width:200px; } }
  @media(max-width:359px) { .review { padding-inline:12px; } .cards { gap:8px; } .full-card { width:150px; } .compact-card { width:88px; } .large :global(svg.avatar) { width:120px; } }
</style>
