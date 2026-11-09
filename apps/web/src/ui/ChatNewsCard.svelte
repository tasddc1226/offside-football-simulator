<script lang="ts">
  // T-11-652 라운지에 올린 리그 경기 기사. 올린 때의 스코어를 그리고, 누르면 리그 화면을 연다.
  import type { ChatNewsShare } from '@offside/contracts/chat';
  import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
  import TeamLogo from './team/TeamLogo.svelte';

  let { news, label, onopen }: { news: ChatNewsShare; label: string; onopen: () => void } = $props();
</script>

<button class="news" aria-label={label} data-chat-news={news.matchId} onclick={onopen}>
  <span class="tag"><b>{N.chatTag}</b><small>{N.where({ tier: news.tier, league: news.league, round: news.round })}</small></span>
  <span class="score">
    <span class="side"><TeamLogo logo={news.home.logo} name={news.home.name} size={28} decorative /><b>{news.home.name}</b></span>
    <span class="goals">{news.home.goals}:{news.away.goals}</span>
    <span class="side away"><TeamLogo logo={news.away.logo} name={news.away.name} size={28} decorative /><b>{news.away.name}</b></span>
  </span>
  <span class="open">{N.chatOpen} ›</span>
</button>

<style>
  .news {display:flex;flex-direction:column;gap:8px;width:280px;max-width:100%;padding:10px;border:1px solid var(--line);border-top:3px solid var(--text);border-radius:var(--radius-md,12px);background:var(--surface);color:inherit;font:inherit;text-align:left;cursor:pointer;}
  .tag {display:flex;justify-content:space-between;gap:6px;align-items:baseline;}
  .tag b {font-family:var(--display);font-size:13px;}
  .tag small {color:var(--muted);font-size:11px;}
  .score {display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;}
  .side {display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;overflow-wrap:anywhere;font-size:13px;}
  .side.away {align-items:flex-end;text-align:right;}
  .goals {font-family:var(--display);font-weight:800;font-size:1.5rem;font-variant-numeric:tabular-nums;}
  .open {font-size:12px;color:var(--accent-text);}
</style>
