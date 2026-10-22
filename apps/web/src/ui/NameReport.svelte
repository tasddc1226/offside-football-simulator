<script lang="ts">
  // 남의 공개 이름(명예의 전당 선수·구단) 신고 — 앱스토어 UGC 정책. 운영자가 관리 화면에서 가리거나 기각한다.
  import { reportName } from '@offside/app-core/api/reports';
  import type { NameReportKind } from '@offside/contracts/board-limits';
  import { toast } from './helpers.js';
  import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

  const { kind, id, name }: { kind: NameReportKind; id: string; name: string } = $props();
  /** T-11-167 owner는 구단주 닉네임 신고다(id는 그 구단). */
  const T =
    kind === 'owner'
      ? { act: 'nick-report', title: L.reportNickTitle, label: L.reportNickLabel, btn: L.reportNickBtn }
      : {
          act: 'name-report',
          title: L.reportTitle,
          label: L.reportLabel,
          btn: kind === 'team' ? L.reportTeamBtn : L.reportPlayerBtn,
        };
  let sent = $state(false);
  let busy = $state(false);

  async function send() {
    if (busy || !confirm(`${T.title({ name })} ${L.reportBody}`)) return;
    busy = true;
    const r = await reportName({ kind, id });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    sent = true;
    toast(L.reportSent);
  }
</script>

<button class="name-report" data-act={T.act} aria-label={T.label({ name })} disabled={sent || busy} onclick={send}>
  {sent ? L.reportDone : T.btn}
</button>

<style>
  /* T-11-237 가끔 쓰는 기능이라 테두리 없는 작은 회색 글자로(앱과 같게). 여러 개는 NameReports가 한 줄로 묶는다. */
  .name-report {
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    background: none;
    font: inherit;
    font-size: var(--fs-label);
    color: var(--muted);
    cursor: pointer;
  }
  .name-report:disabled {
    cursor: default;
  }
</style>
