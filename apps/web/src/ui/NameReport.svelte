<script lang="ts">
  // 남의 공개 이름(명예의 전당 선수·구단) 신고 — 앱스토어 UGC 정책. 운영자가 관리 화면에서 가리거나 기각한다.
  import { reportName } from '@offside/app-core/api/reports';
  import type { NameReportKind } from '@offside/contracts/board-limits';
  import { toast } from './helpers.js';
  import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

  const { kind, id, name }: { kind: NameReportKind; id: string; name: string } = $props();
  /** T-11-167 owner는 구단주 닉네임 신고다(id는 그 구단). */
  const nick = $derived(kind === 'owner');
  let sent = $state(false);
  let busy = $state(false);

  async function send() {
    const title = nick ? L.reportNickTitle({ name }) : L.reportTitle({ name });
    if (busy || !confirm(`${title} ${L.reportBody}`)) return;
    busy = true;
    const r = await reportName({ kind, id });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    sent = true;
    toast(L.reportSent);
  }
</script>

<p class="name-report">
  <button class="icon-btn" data-act={nick ? 'nick-report' : 'name-report'} aria-label={nick ? L.reportNickLabel({ name }) : L.reportLabel({ name })} disabled={sent || busy} onclick={send}>
    {sent ? L.reportDone : nick ? L.reportNickBtn : L.reportBtn}
  </button>
</p>

<style>
  .name-report {
    margin: 12px 0 0;
    text-align: center;
  }
  .name-report button {
    font-size: 0.8125rem;
    color: var(--muted);
  }
</style>
