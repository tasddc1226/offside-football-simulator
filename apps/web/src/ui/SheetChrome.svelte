<script lang="ts">
  // T-11-022 업무 모드의 스프레드시트 틀 — 문서 제목·메뉴·도구 모음·수식 입력줄·열/행 머리글·시트 탭 자리.
  // 꾸밈이라 보조기기에는 숨긴다(aria-hidden). 게임 조작은 그대로 본문·하단 탭(.tabs → 시트 탭 모양)으로 한다.
  // 본문을 누르면 그 자리의 칸을 선택한 것처럼 테두리를 두르고, 칸 주소·누른 글자를 수식 입력줄에 보여 준다.
  import { SHEET_DOC, SHEET_ICON, sheetOn } from './skin.svelte.js';

  // 격자 크기(style.css [data-skin='sheet']의 --sx-top·--sx-row·--sx-col·--sx-head와 같은 값).
  const SX_TOP = 158;
  const SX_ROW = 21;
  const SX_COL = 100;
  const SX_HEAD = 46;
  const COLS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const MENUS = ['파일', '수정', '보기', '삽입', '서식', '데이터', '도구', '확장 프로그램', '도움말'];

  let scrollY = $state(0);
  let viewH = $state(800);
  let formula = $state('');
  let sel = $state<{ col: number; row: number } | null>(null);
  const addr = $derived(sel ? `${COLS[sel.col]}${sel.row + 1}` : 'A1');

  const firstRow = $derived(Math.floor(scrollY / SX_ROW));
  const rows = $derived(Array.from({ length: Math.ceil((viewH - SX_TOP) / SX_ROW) + 2 }, (_, i) => firstRow + i + 1));
  const rowShift = $derived(-(scrollY % SX_ROW));

  function pick(e: PointerEvent) {
    const t = e.target as Element | null;
    if (!sheetOn() || !t || t.closest('.sx-chrome')) return;
    const col = Math.floor((e.pageX - SX_HEAD) / SX_COL);
    const row = Math.floor((e.pageY - SX_TOP) / SX_ROW);
    if (col < 0 || col >= COLS.length || row < 0) return;
    sel = { col, row };
    // 빈 칸(문서 바탕)을 누르면 비운다 — html·body의 textContent에는 스크립트 본문까지 들어 있다.
    const text = t === document.body || t === document.documentElement ? '' : (t.textContent ?? '');
    formula = text.replace(/\s+/g, ' ').trim().slice(0, 140);
  }
</script>

<svelte:window bind:scrollY bind:innerHeight={viewH} />
<svelte:document onpointerdowncapture={pick} />

{#if sheetOn()}
  <div class="sx-chrome" aria-hidden="true">
    <div class="sx-title">
      <img class="sx-doc-icon sx-keep" src={SHEET_ICON} alt="" width="28" height="28" />
      <div class="sx-doc">
        <div class="sx-doc-name">{SHEET_DOC} <span class="sx-doc-tools">☆ ▭ ☁</span></div>
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
  {#if sel}<div class="sx-sel" style:left={`${SX_HEAD + sel.col * SX_COL}px`} style:top={`${SX_TOP + sel.row * SX_ROW}px`}></div>{/if}
{/if}
