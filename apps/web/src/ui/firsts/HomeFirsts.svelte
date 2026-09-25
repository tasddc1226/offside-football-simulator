<script lang="ts">
  // T-10-027 홈의 서버 최초 기록 카드. 가장 최근에 세워진 기록 한 줄을 보여 주고, 누르면 전체 화면으로 간다.
  import type { ServerFirst } from '@offside/contracts';
  import { getFirsts } from '../../api/client.js';
  import { goFirsts } from '../actions.js';
  import { achievedList } from './firsts.js';

  let latest = $state<ServerFirst | null>(null);
  let count = $state<{ done: number; total: number } | null>(null);
  $effect(() => {
    void getFirsts().then((r) => {
      if (!r.ok) return;
      latest = achievedList(r.data.items)[0] ?? null;
      count = { done: r.data.achieved, total: r.data.items.length };
    });
  });
</script>

<button class="card firsts-home" data-act="firsts" onclick={goFirsts}>
  <span class="eyebrow">Server firsts</span>
  <b>{latest ? latest.label : '서버 최초 기록'}</b>
  <span class="muted num">{count ? `서버 최초 업적 ${count.done} / ${count.total}` : '모든 플레이어 중 처음 세운 기록'}</span>
  <span class="firsts-go" aria-hidden="true">→</span>
</button>
