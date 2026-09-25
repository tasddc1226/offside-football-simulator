<script lang="ts">
  // T-10-027 홈 타일의 서버 최초 기록 진입점. 가장 최근에 세워진 기록 한 줄을 보여 주고, 누르면 전체 화면으로 간다.
  import type { ServerFirst } from '@offside/contracts';
  import { getFirsts } from '../../api/client.js';
  import { goFirsts } from '../actions.js';
  import { achievedList } from './firsts.js';

  let latest = $state<ServerFirst | null>(null);
  let count = $state<{ done: number; total: number } | null>(null);
  $effect(() => {
    void getFirsts().then((r) => {
      if (!r.ok) return;
      const done = achievedList(r.data.items);
      latest = done[0] ?? null;
      count = { done: done.length, total: r.data.items.length };
    });
  });
</script>

<button class="tile tile-link" data-act="firsts" onclick={goFirsts}>
  <span class="eyebrow">Server firsts</span><b>{latest ? latest.label : '서버 최초 기록'}</b><span class="muted num" style="font-size:13px"
    >{count ? `서버 최초 업적 ${count.done} / ${count.total}` : '모든 플레이어 중 첫 기록 보기'} →</span
  >
</button>
