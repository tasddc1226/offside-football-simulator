<script lang="ts">
  // T-11-376 급여 안내 — 편성 화면 급여 막대를 누르면 연다. 규칙 · 급여표 · 예산 안에서 고르는 예 · 왜 있는지.
  // 첫 화면 번들 밖 지연 청크(TeamLineup이 import()로 부른다).
  import { salaryExamples, salaryRows } from '@offside/app-core/salary';
  import { salaryText as S } from '@offside/app-core/i18n/ko/salary';
  import PopSheet from '../PopSheet.svelte';

  const { sum, budget, onclose }: { sum: number; budget: number; onclose: () => void } = $props();
  const rows = salaryRows();
  const examples = $derived(salaryExamples(budget));
</script>

<PopSheet label={S.title} {onclose}>
  <div class="salary-guide" data-salary-guide>
    <h2>{S.title}</h2>
    <p class="fs-sm">{S.intro}</p>
    <p class="sg-free fs-sm">{S.free}</p>
    <dl class="sg-now">
      <div><dt>{S.budget}</dt><dd class="num" data-salary-budget>{budget}</dd></div>
      <div><dt>{S.used}</dt><dd class="num">{sum}</dd></div>
      <div><dt>{S.left}</dt><dd class="num">{Math.max(0, budget - sum)}</dd></div>
    </dl>
    <h3>{S.tableTitle}</h3>
    <p class="muted fs-sm">{S.tableNote}</p>
    <table class="sg-table" data-salary-table>
      <thead><tr><th scope="col">{S.tableOvr}</th><th scope="col">{S.tableSalary}</th></tr></thead>
      <tbody>{#each rows as r (r.band)}<tr><td>{r.band}</td><td class="num">{r.salary}</td></tr>{/each}</tbody>
    </table>
    <h3>{S.examplesTitle({ budget })}</h3>
    <ul class="fs-sm">{#each examples as line (line)}<li>{line}</li>{/each}</ul>
    <p class="muted fs-sm">{S.examplesNote}</p>
    <h3>{S.howTitle}</h3>
    <ul class="fs-sm"><li>{S.how1}</li><li>{S.how2}</li><li>{S.how3}</li></ul>
    <h3>{S.whyTitle}</h3>
    <ul class="fs-sm"><li>{S.why1}</li><li>{S.why2}</li><li>{S.why3}</li><li>{S.why4}</li></ul>
    <button type="button" class="btn btn-block" data-act="salary-close" onclick={onclose}>{S.close}</button>
  </div>
</PopSheet>

<style>
  .salary-guide {display:flex;flex-direction:column;gap:8px;}
  .salary-guide h2 {margin:0;font-size:1.125rem;}
  .salary-guide h3 {margin:8px 0 0;font-size:.95rem;}
  .salary-guide p {margin:0;}
  .salary-guide ul {margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;}
  .sg-free {color:var(--good);font-weight:600;}
  .sg-now {display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 0;}
  .sg-now div {border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center;background:var(--surface-2);}
  .sg-now dt {font-size:11px;color:var(--muted);}
  .sg-now dd {margin:2px 0 0;font-size:1.25rem;font-weight:700;}
  .sg-table {width:100%;border-collapse:collapse;font-size:13px;}
  .sg-table th,.sg-table td {padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;}
  .sg-table th {font-size:12px;color:var(--muted);font-weight:600;}
  .sg-table td.num {text-align:right;font-weight:700;}
  .sg-table th:last-child {text-align:right;}
</style>
