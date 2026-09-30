<script lang="ts">
  // 남의 공개 이름(명예의 전당 선수·구단) 신고 — 앱스토어 UGC 정책. 운영자가 관리 화면에서 가리거나 기각한다.
  import { reportName } from '@offside/app-core/api/reports';
  import type { NameReportKind } from '@offside/contracts/board-limits';
  import { toast } from './helpers.js';

  const { kind, id, name }: { kind: NameReportKind; id: string; name: string } = $props();
  let sent = $state(false);
  let busy = $state(false);

  async function send() {
    if (busy || !confirm(`'${name}' 이름을 신고할까요? 운영자가 확인하고 가립니다.`)) return;
    busy = true;
    const r = await reportName({ kind, id });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    sent = true;
    toast('신고했어요. 운영자가 확인할게요.');
  }
</script>

<p class="name-report">
  <button class="icon-btn" data-act="name-report" disabled={sent || busy} onclick={send}>
    {sent ? '신고했어요' : '이름 신고'}
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
