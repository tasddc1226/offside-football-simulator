<script lang="ts">
  // 라운지에 올린 팀 · 선수 카드. 올린 때의 모습을 그대로 그리고, 눌러야 팀 프로필을 불러온다.
  import { FORMATION_ROWS } from '@offside/contracts/owner-team';
  import { detailPosOf } from '@offside/contracts/positions';
  import type { ChatShare } from '@offside/contracts/chat';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { fmtValue } from '@offside/app-core/format';
  import { chatText as L } from '@offside/app-core/i18n/ko/chat';
  import PlayerCard from './team/PlayerCard.svelte';
  import PlayerPeek from './team/PlayerPeek.svelte';
  import TeamLogo from './team/TeamLogo.svelte';

  let { share, label, onteam, onlisting }: { share: ChatShare; label: string; onteam: (teamId: string) => void; onlisting: (listingId: string) => void } = $props();
  let peek = $state<HTMLElement | null>(null);

  /** 공격이 위로 오도록 뒤 줄부터 그린다. */
  const rows = $derived.by(() => {
    if (share.kind !== 'team') return [];
    let at = 0;
    return FORMATION_ROWS[share.formation].map((n) => share.slots.slice(at, (at += n))).reverse();
  });
</script>

{#if share.kind === 'team'}
  <button class="share team" aria-label={label} data-chat-share="team" onclick={() => onteam(share.teamId)}>
    <span class="head">
      <TeamLogo logo={share.logo} name={share.name} size={36} />
      <span class="who"><small>{L.shareTeamTag}</small><b>{share.name}</b><span class="meta">{share.formation} · {L.shareRecord(share.record)}</span></span>
      <span class="ovr"><b>{share.ovr}</b><small>OVR</small></span>
    </span>
    <span class="pitch" aria-hidden="true">
      {#each rows as row, r (r)}
        <span class="line">
          {#each row as s, i (i)}<span class="dot" class:youth={s.youth}><b>{s.rating}</b><small>{s.name}</small></span>{/each}
        </span>
      {/each}
    </span>
    <span class="open">{L.shareOpenTeam} ›</span>
  </button>
{:else}
  {@const player = share.player as TeamPlayer}
  <div class="share player" data-chat-share={share.listing ? 'listing' : 'player'}>
    <small class="tag">{share.listing ? L.shareListingTag : L.sharePlayerTag}</small>
    <!-- 팀 그라운드의 카드와 같은 크기로 그리고, 누르면 같은 확대 카드가 뜬다. -->
    <button class="player-wrap" aria-label={label} aria-haspopup="dialog" data-act="chat-share-peek" onclick={(e) => (peek = e.currentTarget)}>
      <PlayerCard {player} name={share.name} rating={player.peak} role={detailPosOf(player)} compact />
    </button>
    {#if share.listing}
      {@const listing = share.listing}
      <span class="price">{fmtValue(listing.price)}</span>
      <button class="open link" data-act="chat-share-listing" onclick={() => onlisting(listing.id)}>{L.shareListingOpen} ›</button>
    {:else if share.teamId && share.teamName}
      {@const teamId = share.teamId}
      <button class="open link" data-act="chat-share-team" onclick={() => onteam(teamId)}>{L.shareOwnedBy({ team: share.teamName })} ›</button>
    {/if}
  </div>
  {#if peek}
    <PlayerPeek {player} name={share.name} rating={player.peak} origin={peek} onclose={() => (peek = null)} />
  {/if}
{/if}

<style>
  .share {display:flex;flex-direction:column;gap:8px;min-width:0;padding:10px;border:1px solid var(--line);border-radius:var(--radius-md,12px);background:var(--surface);color:inherit;font:inherit;text-align:left;}
  .team {width:min(280px,100%);cursor:pointer;}
  .team:focus-visible,.link:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}
  .head {display:flex;align-items:center;gap:8px;min-width:0;}
  .who {display:flex;flex:1;flex-direction:column;min-width:0;line-height:1.3;}
  .who small,.tag {color:var(--muted);font-size:11px;font-weight:600;}
  .who b {overflow:hidden;font-size:15px;text-overflow:ellipsis;white-space:nowrap;}
  .meta {color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;}
  .ovr {display:flex;flex:none;flex-direction:column;align-items:center;line-height:1.1;}
  .ovr b {font-size:22px;font-variant-numeric:tabular-nums;}
  .ovr small {color:var(--muted);font-size:10px;}
  .pitch {display:flex;flex-direction:column;gap:6px;padding:10px 4px;border-radius:var(--radius-sm);background:#1c4a35;color:#f2f6f1;}
  .line {display:flex;justify-content:space-around;gap:2px;}
  .dot {display:flex;flex:1 1 0;flex-direction:column;align-items:center;min-width:0;line-height:1.2;}
  .dot b {display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#f2f6f1;color:#14201a;font-size:12px;font-variant-numeric:tabular-nums;}
  .dot.youth b {background:#ffffff33;color:#f2f6f1;}
  .dot small {overflow:hidden;max-width:100%;margin-top:2px;font-size:10px;text-overflow:ellipsis;white-space:nowrap;}
  .open {align-self:flex-end;color:var(--accent-text);font-size:12px;font-weight:600;}
  .player {align-items:center;width:fit-content;max-width:min(190px,100%);}
  .tag {align-self:flex-start;}
  /* 팀 그라운드(TeamPitch .tm-slot)의 카드 크기와 같다. */
  .player-wrap {display:block;width:77px;padding:0;border:0;border-radius:var(--radius-md);background:none;color:inherit;font:inherit;cursor:zoom-in;touch-action:manipulation;}
  .player-wrap:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}
  .player-wrap :global(.compact .card-face) {height:86px;padding:8px 3px 10px;}
  .player-wrap :global(.compact .card-art) {height:36px;margin-top:6px;}
  @media(max-width:440px) {
    .player-wrap {width:clamp(50px,calc((100vw - 42px) * .16),64px);}
    .player-wrap :global(.compact .card-face) {height:72px;padding:6px 2px 8px;}
    .player-wrap :global(.compact .card-art) {height:26px;margin-top:4px;}
    .player-wrap :global(.compact .card-name) {font-size:10px;margin-top:1px;}
  }
  .price {font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}
  .link {min-height:36px;padding:0 4px;border:0;background:none;font:inherit;font-size:12px;font-weight:600;cursor:pointer;align-self:center;text-align:center;}
</style>
