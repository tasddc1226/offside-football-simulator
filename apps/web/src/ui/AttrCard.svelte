<script lang="ts">
  // ui.ts attrCard() 포트 (292~314줄)
  import { ovr } from '../game/attributes.js';
  import { attrData } from './format.js';
  import type { GameState } from '../game/types.js';
  import Radar from './Radar.svelte';

  const { s }: { s: GameState } = $props();
  const d = $derived(attrData(s));
</script>

<section class="card">
  <div class="eyebrow">Attributes</div>
  <div class="attr-head"><h2>능력치</h2><span class="pill">{d.roleName} · OVR {ovr(s)}</span></div>
  <Radar {s} />
  <p class="radar-legend muted"><i class="lg-now"></i>현재 <i class="lg-prev"></i>시즌 시작</p>
  <div class="role-line">
    <span class="muted">포지션별 OVR</span>
    {#each d.roles as r (r.role)}
      <span class={r.on ? 'on' : ''} title={r.title}>{r.role} <b class="num">{r.ovr}</b></span>
    {/each}
  </div>
  <div class="stat-list">
    {#each d.groups as g (g.key)}
      <div class="stat-grp">
        <div class="stat-head"><span><small>{g.abbr}</small>{g.labelKr}</span><b class="num {g.tier}">{g.value}</b></div>
        <ul>
          {#each g.rows as row (row.key)}
            <li class={row.bold ? 'key' : ''}><span>{row.name}</span><b class="num {row.tier}">{row.value}</b></li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
  <p class="muted stat-note"><b>굵은 글씨</b>가 {d.roleName} OVR을 결정하는 능력치예요.</p>
</section>
