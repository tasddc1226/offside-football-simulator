// T-10-068 공유 미리보기 카드(og-card.ts)를 PNG로 굽는다 — 카카오톡·디스코드 미리보기는 SVG를 받지 않는다.
// 워커 전용. 글꼴은 구글 폰트에서 카드에 쓰인 글자만(text=) 받아 온다(한글 전체 글꼴은 수 MB라 번들에 못 넣는다).
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// wrangler는 .wasm을 WebAssembly.Module로 묶는다(CompiledWasm 기본 규칙).
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import type { PublicHofEntry } from '@offside/contracts';
import { cardGlyphs, careerCardSvg, FAMILY } from './og-card.js';

let ready: Promise<void> | null = null;
const init = () =>
  (ready ??= initWasm(resvgWasm).catch((e: unknown) => {
    ready = null; // 다음 요청에서 다시 시도한다
    throw e;
  }));

/** 요청을 받자마자 wasm 준비를 시작한다(실패는 굽기에서 다시 드러난다). */
export const warmUp = () => void init().catch(() => {});

// 같은 글자 조합(같은 카드를 다시 굽거나 숫자 글꼴)은 엣지에 하루 둔다.
const FONT_REQ = () =>
  ({
    signal: AbortSignal.timeout(3000),
    cf: { cacheTtl: 86400, cacheEverything: true },
  }) as RequestInit;

/** 이 글자들만 담은 TTF. User-Agent 없이 물으면 구글 폰트가 woff2가 아닌 truetype을 준다(resvg는 woff2를 못 읽는다). */
async function fontFor(family: string, text: string): Promise<Uint8Array> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@700&text=${encodeURIComponent(text)}`,
    FONT_REQ(),
  ).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`font css ${r.status}`))));
  const src = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
  if (!src) throw new Error('font url');
  const res = await fetch(src, FONT_REQ());
  if (!res.ok) throw new Error(`font ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function renderCareerCard(e: PublicHofEntry): Promise<Uint8Array> {
  const glyphs = cardGlyphs(e);
  const [, kr, num] = await Promise.all([
    init(),
    fontFor(FAMILY.kr, glyphs.kr),
    fontFor(FAMILY.num, glyphs.num),
  ]);
  const resvg = new Resvg(careerCardSvg(e), {
    font: { fontBuffers: [kr, num], loadSystemFonts: false, defaultFontFamily: FAMILY.kr },
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
