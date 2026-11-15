// T-11-729 에디트 파일 읽기(구단 이름 · 엠블럼 / 대회 · 수상 · 리그 이름). 웹은 파일을 고르고, 앱은 파일 내용을 붙여넣는다.
// 붙여넣은 글에는 앞뒤 설명 · 보이지 않는 글자(BOM) · 둥근 따옴표가 섞이기 쉽고, 링크나 잘린 내용을 넣는 일도 잦았다(라운지 · 디시 제보).
// 무엇이 틀렸는지 나눠 알리고, 다른 종류의 파일은 지금 설정을 덮어쓰기 전에 막는다.
// 첫 화면(customNames 부팅)이 읽으므로 문구 사전을 가져오지 않는다. 안내 문구는 editFileText.ts.

export type EditFileKind = 'clubs' | 'names';
export type EditFileError = 'empty' | 'link' | 'cut' | 'notFile' | 'wrongKind';
export type EditFileRead =
  { ok: true; data: Record<string, unknown> } | { ok: false; reason: EditFileError };

const parse = (t: string): unknown => {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
};
const count = (t: string, ch: string) => t.split(ch).length - 1;

/** 에디트 파일 글을 읽는다. 구단 파일은 옛 형식(감싸지 않은 구단 표)도 받는다. */
export function readEditFile(text: string, kind: EditFileKind): EditFileRead {
  const t = text.replace(/^\uFEFF/, '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  const start = t.indexOf('{');
  if (start < 0) return { ok: false, reason: /https?:\/\/|www\./i.test(t) ? 'link' : 'notFile' };
  const end = t.lastIndexOf('}');
  const body = end > start ? t.slice(start, end + 1) : t.slice(start);
  // 둥근 따옴표는 원문으로 못 읽을 때만 바꿔 본다(이름 속 따옴표를 건드리지 않게).
  const raw = parse(body) ?? parse(body.replace(/[“”„‟″]/g, '"'));
  if (raw === undefined)
    return {
      ok: false,
      reason: end <= start || count(body, '{') > count(body, '}') ? 'cut' : 'notFile',
    };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, reason: 'notFile' };
  const obj = raw as Record<string, unknown>;
  const other = kind === 'clubs' ? 'names' : 'clubs';
  if (kind in obj) return { ok: true, data: obj };
  if (other in obj) return { ok: false, reason: 'wrongKind' };
  if (kind === 'clubs' && Object.keys(obj).length) return { ok: true, data: { clubs: obj } };
  return { ok: false, reason: 'notFile' };
}
