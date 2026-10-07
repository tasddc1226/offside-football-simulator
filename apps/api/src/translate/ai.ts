import type { Locale } from '@offside/contracts/i18n';
import type { PostText, PostTranslateResponse } from '@offside/contracts';
import { POST_BODY_MAX, POST_TITLE_MAX } from '@offside/contracts/board-limits';
import { AppError } from '../errors.js';

// T-11-146 Workers AI 번역. 운영 도구의 공지 번역 초안과 사용자 글(댓글·채팅) "번역 보기"가 함께 쓴다.
// 사람이 누를 때만 부른다(초안은 관리자 버튼, 번역 보기는 사용자 버튼 + D1 캐시). 원문·번역문은 로그에 남기지 않는다.
export const TRANSLATE_MODEL = '@cf/google/gemma-4-26b-a4b-it';

const LANGUAGE: Record<Locale, string> = { ko: 'Korean', en: 'English', ja: 'Japanese' };
const GLOSSARY = [
  '확률 도감 = Odds guide = 確率図鑑', // i18n-ignore: 번역 용어집
  '명예의 전당 = Hall of Fame = 殿堂', // i18n-ignore: 번역 용어집
  '영구결번 = retired number = 永久欠番', // i18n-ignore: 번역 용어집
  '이적시장 = transfer market = 移籍市場', // i18n-ignore: 번역 용어집
  '구단주 = owner = オーナー', // i18n-ignore: 번역 용어집
  '상무 = Sangmu = 尚武', // i18n-ignore: 번역 용어집
  '잠재력 = potential = ポテンシャル', // i18n-ignore: 번역 용어집
].join('; ');

const systemPrompt = (to: Locale) =>
  [
    `You are the translator for OFFSIDE, a football (soccer) career simulation game. Translate the user's message into ${LANGUAGE[to]}.`,
    'Keep line breaks, Markdown markers such as "## " and "- ", numbers, dates, version strings, emoji and names exactly.',
    to === 'ja'
      ? 'Use natural polite Japanese (です・ます) unless the message is casual chat; then keep it casual.'
      : to === 'ko'
        ? 'Use natural Korean. Keep the tone of the original (casual chat stays casual).'
        : 'Use plain, natural English. Keep the tone of the original.',
    // 화면 사전(app-core i18n)과 같은 표기. 용어집이 없으면 'Probability Encyclopedia'·'上武'처럼 옮겼다(T-11-146 비교).
    `Use these game terms (Korean = English = Japanese): ${GLOSSARY}.`,
    `If the message is already in ${LANGUAGE[to]}, return it unchanged.`,
    'Output only the translation. No quotes, notes or explanations.',
  ].join('\n');

const unavailable = (message: string) => new AppError({ code: 'SERVICE_UNAVAILABLE', message });
const DRAFT_UNAVAILABLE = '지금은 번역 초안을 만들 수 없어요. 잠시 후 다시 시도해 주세요.'; // i18n-ignore: 운영 도구 전용
const TEXT_UNAVAILABLE = '지금은 번역할 수 없어요. 잠시 후 다시 시도해 주세요.'; // i18n-ignore: 응답 때 errorText가 옮긴다

type ChatOutput = { choices?: { message?: { content?: string | null } }[]; response?: string };

/** 한 덩어리를 to 언어로 옮긴다. 바인딩이 없거나 결과가 비면 503(message). */
export async function translateText(
  ai: Ai | undefined,
  text: string,
  to: Locale,
  message = TEXT_UNAVAILABLE,
): Promise<string> {
  if (!ai) throw unavailable(message);
  const out = (await ai
    .run(TRANSLATE_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt(to) },
        { role: 'user', content: text },
      ],
      max_tokens: Math.min(4096, 256 + text.length * 4),
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
    })
    .catch(() => undefined)) as ChatOutput | undefined;
  const result = (out?.choices?.[0]?.message?.content ?? out?.response ?? '').trim();
  if (!result) throw unavailable(message);
  return result;
}

/** 관리자 "번역 초안 만들기": 제목·본문을 영어·일본어로(네 번 동시에). 저장은 하지 않는다. */
export async function draftTranslations(
  ai: Ai | undefined,
  input: PostText,
): Promise<PostTranslateResponse> {
  const one = (text: string, to: 'en' | 'ja') => translateText(ai, text, to, DRAFT_UNAVAILABLE);
  const [enTitle, enBody, jaTitle, jaBody] = await Promise.all([
    one(input.title, 'en'),
    one(input.body, 'en'),
    one(input.title, 'ja'),
    one(input.body, 'ja'),
  ]);
  // 번역이 원문보다 길어져도 저장할 수 있게 한도에서 자른다(관리자가 읽고 고친다).
  const text = (title: string, body: string) => ({
    title: title.slice(0, POST_TITLE_MAX),
    body: body.slice(0, POST_BODY_MAX),
  });
  return { en: text(enTitle, enBody), ja: text(jaTitle, jaBody) };
}
