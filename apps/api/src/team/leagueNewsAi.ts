import type { Locale } from '@offside/contracts/i18n';
import { LOCALES } from '@offside/contracts/i18n';
import type {
  LeagueNewsAi,
  LeagueNewsItem,
  LeagueNewsResponse,
  LeagueNewsTeam,
} from '@offside/contracts';
import type { Db } from '../db/client.js';
import { EDGE } from '../edgeKeys.js';
import { purgeEdgeOrigin } from '../edgeCache.js';
import type { Bindings } from '../env.js';
import { leagueProgress } from './league.js';
import { currentLeague } from './leagueSchedule.js';
import { buildLeagueNews, frontItem } from './leagueNews.js';

// T-11-658 AI 기자: 라운드가 끝나면 신문 1면(푸시 1면과 같은 기사)을 Workers AI가 네 언어로 다시 쓴다.
// AI에는 그 기사의 사실(팀 · 점수 · 순위 · 분)만 JSON으로 주고, 팀 · 선수 이름은 데이터로만 다루게 한다. 결과는 숫자 · 점수 ·
// 이름 · 길이 · 글자를 검사해 통과한 언어만 저장하고, 나머지 언어는 화면이 템플릿 문장을 쓴다. 원문 · 결과는 로그에 남기지 않는다.

export const LEAGUE_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
/** 라운드마다 AI를 부르는 최대 횟수(못 쓴 언어만 다시 부른다). */
export const LEAGUE_AI_TRIES = 3;

const LANGUAGE: Record<Locale, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  zh: 'Traditional Chinese (Taiwan)',
};
/** 언어별 헤드라인 · 본문 글자 수 상한(이름 길이를 감안). */
const LIMIT: Record<Locale, { head: number; body: number }> = {
  ko: { head: 48, body: 280 },
  en: { head: 96, body: 520 },
  ja: { head: 48, body: 280 },
  zh: { head: 40, body: 240 },
};
const TONE: Record<Locale, string> = {
  // i18n-ignore: AI 프롬프트(한국어 문체 예시)
  ko: 'Write in Korean newspaper style ending sentences with 합니다/했습니다 (formal). The headline is a short noun phrase or sentence without a period.',
  en: 'Write in lively British football newspaper English. The headline has no period.',
  ja: 'Write in Japanese sports newspaper style (である調 is fine for the headline, です・ます for the body).',
  zh: 'Write in Traditional Chinese with Taiwan vocabulary only (never Simplified characters), sports newspaper style.',
};

type Side = {
  team: string;
  goals: number;
  ovr: number;
  xg?: number;
};
export type NewsFacts = {
  story: LeagueNewsItem['kind'];
  meaning: string;
  /** 대회 표기(언어별 문구). AI는 이 글자로만 대회를 부른다. */
  where: string;
  home?: Side;
  away?: Side;
  winner?: string | null;
  team?: string;
  [k: string]: unknown;
};
/**
 * AI에 줄 사실과 이름표. 팀 · 선수 이름은 사용자가 쓴 글자라 AI에는 [T1] · [T2] · [P1] 같은 자리표만 주고, 검사를 통과한 뒤
 * 실제 이름으로 바꾼다(이름을 옮기거나 바꾸지 못하고, 이름 속 지시문도 AI에 닿지 않는다).
 */
export type NewsBrief = { facts: NewsFacts; names: Record<string, string> };

const side = (token: string, t: LeagueNewsTeam, goals: number, xg: number | undefined): Side => ({
  team: token,
  goals,
  ovr: t.ovr,
  ...(xg !== undefined ? { xg: Math.round(xg * 10) / 10 } : {}),
});

/** 대회 표기. 부 · 리그 번호를 AI가 헷갈려 '6부 리그 1부'처럼 쓰지 않게 문구로 준다. */
const WHERE: Record<Locale, (tier: number, league: number, round: number) => string> = {
  ko: (t, l, r) => `오프사이드 리그 ${t}부 ${l}리그 ${r}라운드`, // i18n-ignore: AI 프롬프트 재료
  en: (t, l, r) => `OFFSIDE League Tier ${t} (group ${l}), Round ${r}`,
  ja: (t, l, r) => `オフサイドリーグ ${t}部 ${l}組 第${r}節`,
  zh: (t, l, r) => `OFFSIDE 聯賽 第${t}級 第${l}組 第${r}輪`,
};

/** 기사 하나를 AI에 줄 사실 · 이름표로 바꾼다. 이 밖의 사실은 쓰지 못하게 한다. */
export function briefOf(item: LeagueNewsItem, round: number, lang: Locale): NewsBrief {
  if (item.kind === 'leader' || item.kind === 'streak') {
    const base = {
      story: item.kind,
      where: WHERE[lang](item.tier, item.league, round),
      team: '[T1]',
    };
    const names = { '[T1]': item.team.name };
    return item.kind === 'leader'
      ? {
          names,
          facts: {
            ...base,
            points: item.points,
            meaning: item.changed
              ? 'team took over first place in its tier after this round, with the given points.'
              : 'team is still first in its tier after this round, with the given points.',
          },
        }
      : {
          names,
          facts: {
            ...base,
            wins: item.n,
            meaning: 'team has won the given number of league games in a row (wins).',
          },
        };
  }
  const m = item.match;
  const scorer = 'scorer' in item && item.scorer?.name ? item.scorer.name : null;
  const names: Record<string, string> = { '[T1]': m.home.name, '[T2]': m.away.name };
  if (scorer) names['[P1]'] = scorer;
  const base = {
    story: item.kind,
    where: WHERE[lang](m.tier, m.league, m.round),
    home: side('[T1]', m.home, m.homeGoals, m.homeXg),
    away: side('[T2]', m.away, m.awayGoals, m.awayXg),
    winner: m.homeGoals === m.awayGoals ? null : m.homeGoals > m.awayGoals ? '[T1]' : '[T2]',
  };
  const facts = ((): NewsFacts => {
    switch (item.kind) {
      case 'upset':
        return {
          ...base,
          ovrGap: item.gap,
          meaning:
            'Upset: the winner had a lower team OVR (by ovrGap) than the loser before kick-off.',
        };
      case 'goalfest':
        return {
          ...base,
          totalGoals: m.homeGoals + m.awayGoals,
          meaning: 'A high-scoring match (totalGoals).',
        };
      case 'derby':
        return {
          ...base,
          homeRankBefore: item.homeRank,
          awayRankBefore: item.awayRank,
          meaning: 'Derby: the two teams sat next to each other in the table before this round.',
        };
      case 'teamOfRound':
        return {
          ...base,
          margin: Math.abs(m.homeGoals - m.awayGoals),
          meaning: 'Team of the round: the biggest winning margin of this round.',
        };
      case 'comeback':
        return {
          ...base,
          trailedBy: item.trailed,
          meaning: 'Comeback: the winner was behind by trailedBy goal(s) and still won.',
        };
      case 'lateWinner':
        return {
          ...base,
          minute: item.minute,
          ...(scorer ? { scorer: '[P1]' } : {}),
          meaning: 'Late winner: the deciding goal came in the given minute.',
        };
      case 'hattrick':
        return {
          ...base,
          scorerGoals: item.goals,
          ...(scorer ? { scorer: '[P1]' } : {}),
          meaning: 'Hat-trick: one player of the winner scored scorerGoals goals in this match.',
        };
      case 'firstWin':
        return {
          ...base,
          gamesBefore: item.before,
          meaning: 'First win: the winner had played gamesBefore league games without a win.',
        };
    }
  })();
  return { facts, names };
}

/** 결과에 써도 되는 숫자(사실의 숫자 + 그 합 · 차 · 다음 수). */
function numbersOf(f: NewsFacts): Set<string> {
  const nums = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === 'number') nums.add(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk({ ...f, meaning: undefined, where: undefined });
  for (const d of f.where.match(/\d+/g) ?? []) nums.add(Number(d));
  if (f.home && f.away) {
    nums.add(f.home.goals + f.away.goals);
    nums.add(Math.abs(f.home.goals - f.away.goals));
  }
  if (typeof f.gamesBefore === 'number') nums.add(f.gamesBefore + 1);
  // 승점 3점처럼 리그 규칙으로 늘 맞는 수.
  nums.add(3);
  const out = new Set<string>();
  for (const n of nums) {
    out.add(String(n));
    if (!Number.isInteger(n)) out.add(n.toFixed(1));
  }
  return out;
}

const systemPrompt = (lang: Locale) => {
  const l = LIMIT[lang];
  return [
    `You are a reporter for "OFFSIDE Daily", the in-game newspaper of OFFSIDE, a football (soccer) simulation game where players own clubs in the OFFSIDE League. Write today's front-page story in ${LANGUAGE[lang]}.`,
    'Use ONLY the facts in the JSON the user sends. Never invent players, minutes, scores, statistics, quotes, injuries, managers or history.',
    'Teams and players appear as tokens such as [T1], [T2] and [P1]. Write the tokens exactly as they are wherever the names go (particles may follow them). Never write any other team or player name, nickname or translation.',
    'Name the competition only with the exact "where" text, and only in the body (never in the headline). "home" and "away" are the home and away teams; ovr is team strength (write OVR), xg is expected goals (write xG).',
    'Never write JSON field names such as ovrGap, trailedBy or totalGoals; say it in plain words.',
    'Describe only what the facts and "meaning" say. Do not add stoppage time, comebacks, injuries, form, crowd size, weather or anything else that is not given.',
    'Write numbers with Arabic digits. Write a score with a hyphen, the winner first (for a draw, home first), using only the given goals.',
    `"head": one headline line, at most ${l.head} characters. "body": 2 or 3 sentences, at most ${l.body} characters.`,
    TONE[lang],
    'No emoji, hashtags, links, quotes from people, or markdown.',
    'Reply with JSON only: {"head": "...", "body": "..."}',
  ].join('\n');
};

type ChatOutput = { choices?: { message?: { content?: string | null } }[]; response?: string };

const HANGUL = /[\uac00-\ud7a3\u3131-\u318e]/;
const KANA = /[\u3040-\u30ff]/;
const BAD = /https?:|www\.|[<>{}[\]`*#@\\]|```/i;
const TOKEN = /\[[TP]\d\]/g;

/** 전각 숫자를 반각으로. */
const halfDigits = (s: string) =>
  s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));

/** 이름 끝소리: 0 받침 없음, 1 받침, 2 ㄹ 받침. 한글이 아니면 숫자 · 영문 읽는 소리로 어림한다. */
function finalSound(name: string): 0 | 1 | 2 {
  const ch = name.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? 0 : jong === 8 ? 2 : 1;
  }
  if ('178'.includes(ch)) return 2;
  if ('036'.includes(ch)) return 1;
  const c = ch.toLowerCase();
  if (c === 'l') return 2;
  if (c === 'm' || c === 'n') return 1;
  return 0;
}

/** 자리표 뒤 조사를 실제 이름 끝소리에 맞춘다(AI는 자리표만 보고 조사를 붙인다). */
const PARTICLES: [RegExp, (s: 0 | 1 | 2) => string][] = [
  [/^(으로|로)/, (s) => (s === 1 ? '으로' : '로')], // i18n-ignore: 한국어 조사 규칙
  [/^(이|가)(?![\uac00-\ud7a3])/, (s) => (s ? '이' : '가')], // i18n-ignore: 한국어 조사 규칙
  [/^(을|를)/, (s) => (s ? '을' : '를')], // i18n-ignore: 한국어 조사 규칙
  [/^(은|는)/, (s) => (s ? '은' : '는')], // i18n-ignore: 한국어 조사 규칙
  [/^(과|와)/, (s) => (s ? '과' : '와')], // i18n-ignore: 한국어 조사 규칙
];
function fillNames(text: string, names: Record<string, string>, lang: Locale): string {
  return text.replace(/(\[[TP]\d\])([\uac00-\ud7a3]*)/g, (_, token: string, after: string) => {
    const name = names[token]!;
    if (lang !== 'ko' || !after) return `${name}${after}`;
    const s = finalSound(name);
    for (const [re, pick] of PARTICLES) {
      const m = after.match(re);
      if (m) return `${name}${pick(s)}${after.slice(m[0].length)}`;
    }
    return `${name}${after}`;
  });
}

/**
 * 그 꼭지가 아니면 쓰면 안 되는 말(사실에 없는 주장). AI가 이변 기사에 '역전승', 첫 경기 승리에 '시즌 첫 승'을 붙이곤 했다.
 * 추가 시간은 경기 기록에 없어 늘 막는다.
 */
const CLAIMS: { only?: LeagueNewsItem['kind']; re: RegExp }[] = [
  {
    only: 'comeback',
    re: /역전|comeback|came from behind|turn(ed)? (it )?around|turnaround|逆転|逆轉/i, // i18n-ignore: 금지어
  },
  { only: 'firstWin', re: /첫 ?승|first (league )?win|初勝利|首勝/i }, // i18n-ignore: 금지어
  { only: 'hattrick', re: /해트트릭|hat-?trick|ハットトリック|帽子戲法|帽子把戲/i }, // i18n-ignore: 금지어
  {
    only: 'lateWinner',
    re: /극장|종료 직전|막판|last[- ]gasp|late winner|dying (minutes|seconds)|終了間際|劇的弾|絕殺/i, // i18n-ignore: 금지어
  },
  {
    re: /추가 ?시간|인저리|stoppage|injury[- ]time|added time|ロスタイム|アディショナル|補時|傷停/i, // i18n-ignore: 금지어
  },
];

/** 답의 JSON. 모델이 가끔 {"head"} {"body"}처럼 둘로 나눠 내서, 통째로 못 읽으면 객체마다 읽어 합친다. */
function parseReply(raw: string): Record<string, unknown> | null {
  const obj = (t: string) => {
    try {
      const v: unknown = JSON.parse(t);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const whole = raw.match(/\{[\s\S]*\}/)?.[0];
  const parts = (raw.match(/\{[^{}]*\}/g) ?? []).map(obj);
  const out =
    (whole ? obj(whole) : null) ??
    (parts.length && parts.every(Boolean)
      ? (Object.assign({}, ...parts) as Record<string, unknown>)
      : null);
  if (!out) return null;
  // {"head": "..."} 뒤에 본문을 JSON 밖 글로 잇는 답도 있다.
  const tail = raw
    .slice(raw.lastIndexOf('}') + 1)
    .replace(/```/g, '')
    .trim();
  if (out.body === undefined && out.text === undefined && out.article === undefined && tail)
    out.body = tail;
  return out;
}

/**
 * AI 출력 검사. 통과하면 이름을 채운 { head, body }, 아니면 null. 모르는 자리표, 주인공 팀 누락, 사실에 없는 숫자, 맞지 않는
 * 점수, 다른 언어 글자(한글 · 가나), 링크 · 마크다운, 길이 초과를 거른다.
 */
export function checkArticle(
  raw: string,
  brief: NewsBrief,
  lang: Locale,
): { head: string; body: string } | null {
  const r = inspectArticle(raw, brief, lang);
  return 'reason' in r ? null : r;
}

/** checkArticle과 같고, 거른 이유(로그용, 원문 없이)를 돌려준다. */
export function inspectArticle(
  raw: string,
  { facts, names }: NewsBrief,
  lang: Locale,
): { head: string; body: string } | { reason: string } {
  const no = (reason: string) => ({ reason });
  const p = parseReply(raw);
  if (!p) return no('json');
  // 모델이 가끔 headline · title / text · article로 낸다.
  const rawHead = p.head ?? p.headline ?? p.title;
  const rawBody = p.body ?? p.text ?? p.article;
  if (typeof rawHead !== 'string' || typeof rawBody !== 'string') return no('shape');
  const head = halfDigits(rawHead.trim());
  const body = halfDigits(rawBody.trim().replace(/\s*\n+\s*/g, ' '));
  const l = LIMIT[lang];
  if (head.length < 4 || head.length > l.head || head.includes('\n')) return no('head-length');
  if (body.length < 20 || body.length > l.body) return no('body-length');
  // 대회 이름은 본문에만(헤드라인이 '오프사이드 리그 1부 1리그 3라운드 …'처럼 길어진다).
  if ((lang === 'ko' || lang === 'ja') && head.includes(WHERE[lang](0, 0, 0).split(' ')[0]!))
    return no('head-where');
  const text = `${head} ${body}`;
  const tokens: string[] = text.match(TOKEN) ?? [];
  if (tokens.some((t) => !(t in names))) return no('token');
  // 주인공 팀(이긴 팀 · 선두 · 연승 팀, 무승부면 두 팀 중 하나)이 실려야 한다.
  const heroes = facts.team ? [facts.team] : facts.winner ? [facts.winner] : ['[T1]', '[T2]'];
  if (!heroes.some((h) => tokens.includes(h))) return no('hero');
  const rest = text.replace(TOKEN, ' ');
  if (BAD.test(rest)) return no('markup');
  if (lang !== 'ko' && HANGUL.test(rest)) return no('hangul');
  if (lang !== 'ja' && KANA.test(rest)) return no('kana');
  // 점수 표기는 실제 점수여야 한다.
  if (facts.home && facts.away) {
    const ok = new Set([
      `${facts.home.goals}-${facts.away.goals}`,
      `${facts.away.goals}-${facts.home.goals}`,
    ]);
    for (const s of rest.matchAll(/(\d+)\s*[-:–—對对]\s*(\d+)/g))
      if (!ok.has(`${s[1]}-${s[2]}`)) return no('score');
  }
  if (CLAIMS.some((c) => c.only !== facts.story && c.re.test(rest))) return no('claim');
  const allowed = numbersOf(facts);
  for (const n of rest.match(/\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(n)) return no('number');
  const fill = (t: string) => {
    const filled = fillNames(t, names, lang);
    // 숫자 뒤 '였/이었'도 읽는 소리에 맞춘다(AI가 '2.1였으며'처럼 쓴다).
    return lang === 'ko'
      ? filled.replace(/(\d)(이었|였)/g, (_, d: string) => `${d}${finalSound(d) ? '이었' : '였'}`) // i18n-ignore: 한국어 조사 규칙
      : filled;
  };
  return { head: fill(head), body: fill(body) };
}

/** 한 언어로 1면을 쓴다. 바인딩 오류 · 빈 답 · 검사 실패는 { reason }. */
export async function writeArticle(
  ai: Ai,
  brief: NewsBrief,
  lang: Locale,
): Promise<{ head: string; body: string } | { reason: string }> {
  const out = (await ai
    .run(LEAGUE_AI_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt(lang) },
        { role: 'user', content: JSON.stringify(brief.facts) },
      ],
      max_tokens: 700,
      temperature: 0.6,
      chat_template_kwargs: { enable_thinking: false },
    })
    .catch(() => undefined)) as ChatOutput | undefined;
  const raw = (out?.choices?.[0]?.message?.content ?? out?.response ?? '').trim();
  return raw ? inspectArticle(raw, brief, lang) : { reason: 'empty' };
}

type AiRow = { kind: string; ref: string; text_json: string; tries: number };
type AiText = LeagueNewsAi['text'];

const readText = (json: string): AiText => {
  try {
    const v = JSON.parse(json) as AiText;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};
const complete = (t: AiText) => LOCALES.every((l) => t[l]);

const rowOf = (db: Db, season: number, round: number) =>
  db.$client
    .prepare(
      'SELECT kind, ref, text_json, tries FROM league_news_ai WHERE season = ? AND round = ?',
    )
    .bind(season, round)
    .first<AiRow>();

const refOf = (item: LeagueNewsItem) =>
  item.kind === 'leader' || item.kind === 'streak' ? item.team.teamId : item.match.id;

/**
 * cron 단계: 마지막으로 끝난 라운드의 1면을 아직 다 못 썼으면 못 쓴 언어만 쓴다. 라운드마다 최대 LEAGUE_AI_TRIES번,
 * 한 번에 언어 수만큼 AI를 부른다. 쓰면 신문 엣지 캐시를 지운다.
 */
export async function writeLeagueNewsAi(env: Bindings, db: Db, now: string) {
  const ai = env.AI;
  if (!ai) return null;
  const league = await currentLeague(db, now);
  if (!league) return null;
  const { played } = await leagueProgress(db, league.season);
  if (played < 1) return null;
  const row = await rowOf(db, league.season, played);
  const before = row ? readText(row.text_json) : {};
  if (row && (complete(before) || row.tries >= LEAGUE_AI_TRIES)) return null;
  const news = await buildLeagueNews(db, league.season, played);
  if (!news) return null;
  const item = frontItem(news);
  const todo = LOCALES.filter((l) => !before[l]);
  const written = item
    ? await Promise.all(
        todo.map(async (l) => {
          const r = await writeArticle(ai, briefOf(item, news.round, l), l);
          return [l, 'reason' in r ? null : r, 'reason' in r ? r.reason : null] as const;
        }),
      )
    : [];
  const text: AiText = { ...before };
  for (const [l, a] of written) if (a) text[l] = a;
  await db.$client
    .prepare(
      `INSERT INTO league_news_ai (season, round, kind, ref, text_json, tries, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (season, round) DO UPDATE SET text_json = excluded.text_json, tries = league_news_ai.tries + 1,
         updated_at = excluded.updated_at`,
    )
    .bind(
      league.season,
      played,
      item?.kind ?? 'none',
      item ? refOf(item) : '',
      JSON.stringify(text),
      // 쓸 기사가 없는 라운드는 다시 부르지 않는다.
      item ? 1 : LEAGUE_AI_TRIES,
      LEAGUE_AI_MODEL,
      now,
      now,
    )
    .run();
  if (env.PUBLIC_API_ORIGIN && written.some(([, a]) => a))
    await purgeEdgeOrigin(env.PUBLIC_API_ORIGIN, [EDGE.leagueNews(league.season, played)]).catch(
      () => {},
    );
  return {
    season: league.season,
    round: played,
    wrote: written.filter(([, a]) => a).length,
    failed: written.filter(([, a]) => !a).length,
    // 거른 이유만 남긴다(언어:이유). 원문 · 결과 문장은 로그에 남기지 않는다.
    ...(written.some(([, , why]) => why)
      ? { why: written.flatMap(([l, , why]) => (why ? [`${l}:${why}`] : [])).join(',') }
      : {}),
  };
}

/**
 * 신문 응답에 붙일 AI 1면. final은 더 바뀌지 않는지(엣지 캐시에 담아도 되는지): 다 썼거나, 횟수를 다 썼거나, AI가 쓰지 않는
 * 지난 라운드다.
 */
export async function leagueNewsAiOf(
  db: Db,
  news: LeagueNewsResponse,
  hasAi: boolean,
): Promise<{ ai: LeagueNewsAi | null; final: boolean }> {
  if (news.round < 1 || !news.items.length) return { ai: null, final: true };
  const row = await rowOf(db, news.season, news.round);
  if (!row) {
    if (!hasAi) return { ai: null, final: true };
    const { played } = await leagueProgress(db, news.season);
    return { ai: null, final: news.round < played };
  }
  const text = readText(row.text_json);
  const final = complete(text) || row.tries >= LEAGUE_AI_TRIES;
  return {
    ai:
      row.kind !== 'none' && Object.keys(text).length
        ? { kind: row.kind, ref: row.ref, text }
        : null,
    final,
  };
}
