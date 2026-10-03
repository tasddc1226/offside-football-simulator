<script lang="ts">
  import { CREST_SHAPES, CREST_PATTERNS } from '@offside/game/crests';
  import { defaultTeamLogo, type TeamLogo } from '@offside/contracts/team-logo';
  let { logo, name, size = 48 }: { logo?: TeamLogo | null | undefined; name: string; size?: number } = $props();
  const value = $derived(logo ?? defaultTeamLogo(name));
  let failedImage = $state('');
  const clip = $props.id();
</script>

<span class="team-logo" style:width="{size}px" style:height="{size}px">
  {#if value.img && failedImage !== value.img}
    <img src={value.img} alt="{name} 로고" width={size} height={size} onerror={() => (failedImage = value.img ?? '')} />
  {:else}
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="{name} 로고">
      <defs><clipPath id={clip}><path d={CREST_SHAPES[value.shape]} /></clipPath></defs>
      <g clip-path="url(#{clip})">
        <rect width="64" height="64" fill={value.bg} />
        {#if value.pattern !== 'plain'}<path d={CREST_PATTERNS[value.pattern]} fill={value.fg} opacity=".22" />{/if}
        <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-size={value.text.length > 2 ? 17 : value.text.length > 1 ? 22 : 28} font-weight="700" fill={value.fg}>{value.text}</text>
      </g>
      <path d={CREST_SHAPES[value.shape]} fill="none" stroke={value.fg} stroke-width="2" stroke-linejoin="round" />
    </svg>
  {/if}
</span>

<style>
  .team-logo {display:inline-flex;align-items:center;justify-content:center;flex:none;vertical-align:middle;}
  svg,img {display:block;width:100%;height:100%;}
  img {object-fit:contain;border-radius:12%;}
</style>
