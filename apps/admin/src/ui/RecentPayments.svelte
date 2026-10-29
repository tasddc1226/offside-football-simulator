<script lang="ts">
  // 최근 아이템 결제(서버 원장 iap_purchases 최신 30건, 기간과 무관). 광고 제거는 스토어 알림이라 여기 없다.
  import type { AdminRevenue } from '@offside/contracts';
  import { dimLabel, kstTime, productLabel } from '../kpi.ts';

  let { rev, limit = 30 }: { rev: AdminRevenue; limit?: number } = $props();
</script>

<section class="panel">
  <header>
    <h2>최근 아이템 결제</h2>
    <span class="hint">기간과 무관한 최신 {Math.min(limit, rev.recent.length)}건 · 광고 제거 제외</span>
  </header>
  {#if rev.recent.length}
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>시각 (KST)</th><th>상품</th><th>구단주</th><th>스토어</th><th>상태</th></tr></thead>
        <tbody>
          {#each rev.recent.slice(0, limit) as p, i (`${p.createdAt}-${i}`)}
            <tr>
              <td>{kstTime(p.createdAt)}</td>
              <td>{productLabel(p.productId)}</td>
              <td>{p.nickname ?? '이름 없음'}</td>
              <td>{dimLabel(p.store)}</td>
              <td>
                {#if p.refundedAt}<span class="chip bad">환불</span>{:else}<span class="chip good">완료</span>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="note">아이템 결제 기록이 없어요.</p>
  {/if}
</section>
