<script lang="ts">
  // 클럽 엠블럼(T-10-009). 유저 로고(글자·이미지)가 있으면 그걸, 없으면 기본 엠블럼(T-10-063, game/crests.ts)을,
  // 기본 엠블럼 정의가 없는 클럽이면 이름 첫 글자 + 클럽 고유색 글자 엠블럼을 그린다.
  import { defaultLogo } from '../game/clubs.js';
  import { crestOf, CREST_MOTIFS, CREST_PATTERNS, CREST_SHAPES, TRI_THIRD_PATH } from '../game/crests.js';
  import { clubCustom } from './clubCustom.svelte.js';
  const { club, size = 22 }: { club: { id: string; name: string }; size?: number } = $props();
  const custom = $derived(clubCustom.map[club.id]?.logo);
  const crest = $derived(custom ? null : crestOf(club));
  const logo = $derived(custom ?? defaultLogo(club));
  const clip = $props.id();
</script>

{#if crest}
  {@const shape = CREST_SHAPES[crest.shape]}
  {@const text = crest.motif?.startsWith('=') ? crest.motif.slice(1) : null}
  {@const motif = crest.motif && !text ? CREST_MOTIFS[crest.motif] : null}
  <svg class="club-badge crest" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <defs><clipPath id={clip}><path d={shape} /></clipPath></defs>
    <path d={shape} fill="none" stroke="var(--crest-halo)" stroke-width="6" stroke-linejoin="round" />
    <g clip-path="url(#{clip})">
      <rect width="64" height="64" fill={crest.base} />
      <path d={CREST_PATTERNS[crest.pattern]} fill={crest.accent} />
      {#if crest.third}<path d={TRI_THIRD_PATH} fill={crest.third} />{/if}
      {#if crest.disc}<circle cx="32" cy="32" r="15" fill="#fff" />{/if}
      {#if motif}
        <g transform={crest.disc ? `translate(32 32) scale(.78) translate(-32 -32) ${motif.t ?? ''}` : motif.t}>
          <path d={motif.d} fill={crest.motifColor} />
          {#if motif.k}<path d={motif.k} fill={crest.disc ? '#fff' : crest.base} />{/if}
        </g>
      {:else if text}
        <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-size={text.length > 1 ? 19 : 25} font-weight="800" fill={crest.motifColor}>{text}</text>
      {/if}
    </g>
    {#if crest.edge}<path d={shape} fill="none" stroke={crest.edge} stroke-width="3.5" stroke-linejoin="round" />{/if}
  </svg>
{:else if logo.img}
  <img class="club-badge" src={logo.img} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" />
{:else}
  <span class="club-badge" aria-hidden="true" style:width="{size}px" style:height="{size}px" style:background={logo.bg} style:color={logo.fg} style:font-size="{Math.round(size * (logo.text.length > 1 ? 0.36 : 0.5))}px">{logo.text}</span>
{/if}
