<script lang="ts">
  // 클럽 엠블럼(T-10-009). 유저 로고(이미지·글자)가 있으면 그걸, 없으면 기본 엠블럼(T-10-063, game/crests.ts)을 그린다.
  import { crestOf, TRI_THIRD_PATH } from '../game/crests.js';
  import { clubCustom } from './clubCustom.svelte.js';
  const { club, size = 22 }: { club: { id: string; name: string }; size?: number } = $props();
  const logo = $derived(clubCustom.map[club.id]?.logo);
  const crest = $derived(logo ? null : crestOf(club));
  const clip = $props.id();
</script>

{#if crest}
  <svg class="club-badge crest" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <defs><clipPath id={clip}><path d={crest.shape} /></clipPath></defs>
    <path d={crest.shape} fill="none" stroke="var(--crest-halo)" stroke-width="6" stroke-linejoin="round" />
    <g clip-path="url(#{clip})">
      <rect width="64" height="64" fill={crest.base} />
      {#if crest.pattern}<path d={crest.pattern} fill={crest.accent} />{/if}
      {#if crest.third}<path d={TRI_THIRD_PATH} fill={crest.third} />{/if}
      {#if crest.disc}<circle cx="32" cy="32" r="15" fill="#fff" />{/if}
      {#if crest.icon}
        <g transform={crest.transform}>
          <path d={crest.icon.d} fill={crest.motifColor} />
          {#if crest.icon.k}<path d={crest.icon.k} fill={crest.disc ? '#fff' : crest.base} />{/if}
        </g>
      {:else if crest.text}
        <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-size={crest.text.length > 1 ? 19 : 25} font-weight="800" fill={crest.motifColor}>{crest.text}</text>
      {/if}
    </g>
    {#if crest.edge}<path d={crest.shape} fill="none" stroke={crest.edge} stroke-width="3.5" stroke-linejoin="round" />{/if}
  </svg>
{:else if logo?.img}
  <img class="club-badge" src={logo.img} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" />
{:else if logo}
  <span class="club-badge" aria-hidden="true" style:width="{size}px" style:height="{size}px" style:background={logo.bg} style:color={logo.fg} style:font-size="{Math.round(size * (logo.text.length > 1 ? 0.36 : 0.5))}px">{logo.text}</span>
{/if}
