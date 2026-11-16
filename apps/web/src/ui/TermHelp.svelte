<script lang="ts">
  // T-11-732 용어 설명 "?" 버튼(앱 components/TermHelp.tsx). 누르면 아래에서 설명 창이 올라와 그 화면에 나오는 용어만 풀어 준다.
  // more가 false면(선수 만들기처럼 화면을 떠나면 안 되는 곳) 용어 사전으로 가는 버튼을 숨긴다.
  import { TERM_HELP, term, type TermHelpKey } from '@offside/app-core/glossary';
  import { glossaryText as L } from '@offside/app-core/i18n/ko/glossary';
  import PopSheet from './PopSheet.svelte';
  import { goGlossary } from './nav.js';

  const { of, more = true }: { of: TermHelpKey; more?: boolean } = $props();
  let open = $state(false);
  const terms = $derived(TERM_HELP[of].map(term));
  function all() {
    open = false;
    goGlossary();
  }
</script>

<button
  type="button"
  class="term-help"
  data-term-help={of}
  aria-label={L.help({ term: terms.map((t) => t.term).join(' · ') })}
  aria-haspopup="dialog"
  onclick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    open = true;
  }}>?</button>
{#if open}
  <PopSheet label={L.sheetLabel} onclose={() => (open = false)}>
    <dl class="term-list" data-term-sheet={of}>
      {#each terms as t (t.id)}
        <dt>{t.term}</dt>
        <dd>{t.desc}</dd>
      {/each}
    </dl>
    <div class="stack" style="gap:8px">
      {#if more}<button class="btn btn-block" data-act="glossary-all" onclick={all}>{L.more}</button>{/if}
      <button class="btn btn-block btn-tonal" data-act="term-close" onclick={() => (open = false)}>{L.close}</button>
    </div>
  </PopSheet>
{/if}

<style>
  .term-help {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin-left: 4px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--muted);
    font: 700 12px/1 inherit;
    vertical-align: middle;
    cursor: pointer;
  }
  /* 눈에 보이는 원은 작게 두고 누르는 자리는 44px로 넓힌다. */
  .term-help::after { content: ''; position: absolute; inset: -12px; }
  .term-help:hover { color: var(--ink); border-color: var(--muted); }
  .term-list { margin: 4px 0 0; }
  .term-list dt { font-weight: 700; margin-top: 12px; }
  .term-list dt:first-child { margin-top: 0; }
  .term-list dd { margin: 4px 0 0; color: var(--muted); font-size: var(--fs-label); line-height: 1.55; }
</style>
