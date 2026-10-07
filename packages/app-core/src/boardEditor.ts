// T-11-146 관리자 글 편집기의 상태와 저장 입력(웹·앱 공통). 한국어 원문 + 영어·일본어 번역 칸.
import type { Post, PostDetailResponse, PostInput, PostText } from '@offside/contracts';
import { TRANSLATED_LOCALES, type TranslatedLocale } from '@offside/contracts/i18n';
import { translatePost } from './api/boards.js';
import { boardText as L } from './i18n/ko/board.js';

export const POST_LANGS = TRANSLATED_LOCALES;
export type PostLang = TranslatedLocale;
export const postLangLabel = (lang: PostLang): string => (lang === 'en' ? L.langEn : L.langJa);

export type PostDraft = {
  /** 없으면 새 글. */
  id?: string;
  title: string;
  body: string;
  version: string;
  pinned: boolean;
} & Record<PostLang, PostText>;

const blank = (): PostText => ({ title: '', body: '' });

/** 고칠 글은 서버가 관리자에게 준 원문(source)으로 채운다 — post는 화면 언어로 옮긴 것이다. */
export function draftOf(post?: Post, source?: PostDetailResponse['source']): PostDraft {
  if (!post) return { title: '', body: '', version: '', pinned: false, en: blank(), ja: blank() };
  return {
    id: post.id,
    title: source?.title ?? post.title,
    body: source?.body ?? post.body,
    version: post.version ?? '',
    pinned: post.pinned,
    en: { ...blank(), ...source?.i18n.en },
    ja: { ...blank(), ...source?.i18n.ja },
  };
}

/** 번역은 제목·본문을 함께 쓰거나 둘 다 비운다. 반쯤 쓴 언어가 있으면 그 언어를 돌려준다. */
export function inputOf(d: PostDraft): { input: PostInput } | { incomplete: PostLang } {
  const i18n: NonNullable<PostInput['i18n']> = {};
  for (const lang of POST_LANGS) {
    const title = d[lang].title.trim();
    const body = d[lang].body.trim();
    if (!title && !body) continue;
    if (!title || !body) return { incomplete: lang };
    i18n[lang] = { title, body };
  }
  return {
    input: {
      title: d.title,
      body: d.body,
      pinned: d.pinned,
      ...(d.version.trim() ? { version: d.version } : {}),
      i18n,
    },
  };
}

/** "번역 초안 만들기": 한국어 제목·본문으로 영어·일본어 칸을 채운 새 초안, 아니면 보여 줄 안내. 저장은 하지 않는다. */
export async function withDraftTranslations(
  d: PostDraft,
): Promise<{ draft: PostDraft } | { error: string }> {
  const title = d.title.trim();
  const body = d.body.trim();
  if (!title || !body) return { error: L.translateNeedsKorean };
  const r = await translatePost({ title, body });
  return r.ok ? { draft: { ...d, ...r.data } } : { error: r.error.message };
}
