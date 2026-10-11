<script lang="ts">
  // ui.ts attrCard() 포트 (292~314줄)
  import { ovr } from '@offside/game/attributes';
  import { attrData } from '@offside/app-core/format';
  import type { GameState } from '@offside/game/types';
  import Radar from './Radar.svelte';
  import { gameAttrText as L } from '@offside/app-core/i18n/ko/gameAttr';

  const { s }: { s: GameState } = $props();
  const d = $derived(attrData(s));
</script>

<section class="card">
  <div class="eyebrow">Attributes</div>
  <div class="attr-head"><h2>{L.title}</h2><span class="pill">{d.roleName ?? ''} · OVR {ovr(s)}</span></div>
  <Radar {s} />
  <p class="radar-legend muted"><i class="lg-now"></i>{L.legendNow} <i class="lg-prev"></i>{L.legendPrev}</p>
  <div class="role-line">
    <span class="muted">{L.roleOvr}</span>
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
  <p class="muted stat-note"><b>{L.noteBold}</b>{L.noteRest({ role: d.roleName ?? '' })}</p>
</section>
