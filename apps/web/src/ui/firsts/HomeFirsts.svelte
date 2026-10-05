<script lang="ts">
  // T-10-027 홈 타일의 서버 최초 기록 진입점. 가장 최근에 세워진 기록 한 줄을 보여 주고, 누르면 전체 화면으로 간다.
  import type { ServerFirst } from '@offside/contracts';
  import { getFirsts } from '@offside/app-core/api/client';
  import { go } from '../nav.js';
  import { achievedList } from '@offside/app-core/firsts';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';

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

<button class="tile tile-link" data-act="firsts" onclick={() => go('firsts')}>
  <span class="eyebrow">Server firsts</span><b>{latest ? latest.label : L.firstsTitle}</b><span class="muted num fs-sm"
    >{count ? L.firstsCount(count) : L.firstsEmpty} →</span
  >
</button>
