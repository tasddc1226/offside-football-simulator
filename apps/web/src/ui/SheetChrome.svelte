<script lang="ts" module>
  // 격자 크기(style.css [data-skin='sheet']의 --sx-* 와 같은 값).
  export const SX_TOP = 158;
  export const SX_ROW = 21;
  export const SX_COL = 100;
  export const SX_HEAD = 46;
</script>

<script lang="ts">
  // T-11-022 업무 모드의 스프레드시트 틀 — 문서 제목·메뉴·도구 모음·수식 입력줄·열/행 머리글·시트 탭 자리.
  // 꾸밈이라 보조기기에는 숨긴다(aria-hidden). 게임 조작은 그대로 본문·하단 탭(.tabs → 시트 탭 모양)으로 한다.
  // 본문을 누르면 그 자리의 칸을 선택한 것처럼 테두리를 두르고, 칸 주소·누른 글자를 수식 입력줄에 보여 준다.
  import { sheetOn, SHEET_TITLE } from './skin.svelte.js';

  const COLS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const MENUS = ['파일', '수정', '보기', '삽입', '서식', '데이터', '도구', '확장 프로그램', '도움말'];
  const docName = SHEET_TITLE.replace(/ - .*$/, '');

  let scrollY = $state(0);
  let viewH = $state(800);
  let formula = $state('');
  let sel = $state<{ col: number; row: number } | null>(null);
  const addr = $derived(sel ? `${COLS[sel.col % 26]}${sel.row + 1}` : 'A1');

  const firstRow = $derived(Math.floor(scrollY / SX_ROW));
  const rows = $derived(Array.from({ length: Math.ceil((viewH - SX_TOP) / SX_ROW) + 2 }, (_, i) => firstRow + i + 1));
  const rowShift = $derived(-(scrollY % SX_ROW));

  $effect(() => {
    if (!sheetOn()) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      scrollY = window.scrollY;
      viewH = window.innerHeight;
    };
    const queue = () => (raf ||= requestAnimationFrame(sync));
    const pick = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest('.sx-chrome')) return;
      const col = Math.floor((e.pageX - SX_HEAD) / SX_COL);
      const row = Math.floor((e.pageY - SX_TOP) / SX_ROW);
      if (col < 0 || row < 0) return;
      sel = { col, row };
      const text = (t instanceof HTMLElement ? t.innerText : t.textContent) ?? '';
      formula = text.replace(/\s+/g, ' ').trim().slice(0, 140);
    };
    sync();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.addEventListener('pointerdown', pick, true);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      document.removeEventListener('pointerdown', pick, true);
    };
  });
</script>

{#if sheetOn()}
  <div class="sx-chrome" aria-hidden="true">
    <div class="sx-title">
      <span class="sx-doc-icon"><svg viewBox="0 0 16 16" width="28" height="28"><rect x="2" y="1" width="12" height="14" rx="1.5" fill="#34a853" /><path d="M4.5 6h7v6h-7zM4.5 8h7M4.5 10h7M7.5 6v6" fill="none" stroke="#fff" stroke-width="1" /></svg></span>
      <div class="sx-doc">
        <div class="sx-doc-name">{docName} <span class="sx-doc-tools">☆ ▭ ☁</span></div>
        <div class="sx-menus">{#each MENUS as m (m)}<span>{m}</span>{/each}</div>
      </div>
      <div class="sx-right">
        <span class="sx-round">◷</span>
        <span class="sx-round">▤</span>
        <span class="sx-share">🔒︎ 공유</span>
        <span class="sx-avatar">나</span>
      </div>
    </div>
    <div class="sx-tools">
      <span>↶</span><span>↷</span><span>⎙</span><span>⌖</span><i></i>
      <span class="sx-w">100% ▾</span><i></i>
      <span>₩</span><span>%</span><span>.0</span><span>.00</span><span class="sx-w">123 ▾</span><i></i>
      <span class="sx-w sx-font">기본값... ▾</span><i></i>
      <span>−</span><span class="sx-size">10</span><span>+</span><i></i>
      <b>B</b><em>I</em><s>S</s><u>A</u><i></i>
      <span>◧</span><span>⊞</span><span>⇔</span><i></i>
      <span>≡</span><span>⊥</span><span>↵</span><span>⟲</span><i></i>
      <span>⛓︎</span><span>▣</span><span>▥</span><span>▿</span><span>Σ</span>
    </div>
    <div class="sx-formula">
      <span class="sx-name">{addr}</span>
      <span class="sx-fx">fx</span>
      <span class="sx-value">{formula}</span>
    </div>
    <div class="sx-cols">
      <span class="sx-corner"></span>
      {#each COLS as c, i (c)}<span class:on={sel?.col === i}>{c}</span>{/each}
    </div>
    <div class="sx-rows"><div style:transform={`translateY(${rowShift}px)`}>{#each rows as r (r)}<span class:on={sel?.row === r - 1}>{r}</span>{/each}</div></div>
    <div class="sx-foot"><span>＋</span><span>≡</span><span class="sx-sheet-tab">시트1</span></div>
  </div>
  {#if sel}<div class="sx-sel" aria-hidden="true" style:left={`${SX_HEAD + sel.col * SX_COL}px`} style:top={`${SX_TOP + sel.row * SX_ROW}px`}></div>{/if}
{/if}
