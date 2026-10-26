import { retentionPushText as ko, type RetentionStory } from '../i18n/ko/retentionPush.js';
import { retentionPushText as en } from '../i18n/en/retentionPush.js';
import { retentionPushText as ja } from '../i18n/ja/retentionPush.js';
import type { Lang } from '../lang.js';

// T-11-501 리텐션 푸시 문구 채우기와 되읽기. 알림함에는 한국어 문장이 남으므로, 다른 언어로 보일 때는 한국어 틀에 맞춰
// 숫자 자리를 되읽고 같은 이야기의 그 언어 틀에 다시 넣는다.

export type RetentionParams = Partial<Record<'n' | 'w' | 'd' | 'l' | 'season', number>>;
type Part = 'title' | 'body';

export const fillRetention = (template: string, params: RetentionParams = {}) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) =>
    String(params[k as keyof RetentionParams] ?? ''),
  );

export const retentionContent = (story: RetentionStory, params: RetentionParams = {}) => ({
  title: fillRetention(ko[story].title, params),
  body: fillRetention(ko[story].body, params),
});

const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const patterns = (Object.keys(ko) as RetentionStory[]).flatMap((story) =>
  (['title', 'body'] as Part[]).map((part) => {
    const keys: string[] = [];
    const source = escape(ko[story][part]).replace(/\\?\{(\w+)\\?\}/g, (_, k: string) => {
      keys.push(k);
      return '(\\d+)';
    });
    return { story, part, keys, re: new RegExp(`^${source}$`) };
  }),
);

/** 한국어 리텐션 문장을 lang으로. 리텐션 문구가 아니면 null. */
export function retentionText(text: string, lang: Exclude<Lang, 'ko'>): string | null {
  for (const { story, part, keys, re } of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const params = Object.fromEntries(keys.map((k, i) => [k, Number(m[i + 1])])) as RetentionParams;
    return fillRetention((lang === 'en' ? en : ja)[story][part], params);
  }
  return null;
}
