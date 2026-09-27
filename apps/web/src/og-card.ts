// T-10-068 공유 링크(/career/<id>) 미리보기 이미지. 선수마다 엠블럼·이름·레전드 점수를 담은 1200×630 카드를
// SVG로 그린다(PNG 변환은 워커의 og-render.ts). 워커 번들에 게임 로직을 끌어오지 않게 순수 데이터 모듈만 쓴다.
import type { PublicHofEntry } from '@offside/contracts';
import { crestOf, crestSvg } from './game/crests.js';
import { CLUBS } from './game/data.js';
import { legendBand } from './game/legend-bands.js';
import { anonName, POS_LABEL } from './game/pos-label.js';
import { hashStr } from './game/rng.js';

export const OG_W = 1200;
export const OG_H = 630;
/** 카드 모양이 바뀌면 올린다 — 이미지 URL이 바뀌어 미리보기 캐시(카카오톡 등)가 새로 받는다. */
const CARD_VERSION = 1;

/** 기록에 남은 클럽 id(T-10-066), 없으면(옛 기록) 기본 이름으로 찾는다. 대표팀·모르는 이름은 엠블럼 없음. */
function lastClubOf(e: PublicHofEntry): { id: string; name: string } | null {
  if (e.lastClubId) return { id: e.lastClubId, name: e.lastClub };
  const c = CLUBS.find((x) => x.baseName === e.lastClub || x.name === e.lastClub);
  return c ? { id: c.id, name: e.lastClub } : null;
}

type Line = {
  text: string;
  font: 'kr' | 'num';
  size: number;
  x: number;
  y: number;
  fill: string;
  anchor?: 'end';
  spacing?: number;
};

function lines(e: PublicHofEntry): Line[] {
  const who = e.name ?? anonName(e.pos, e.number);
  // 한글은 글자 폭이 대략 글자 크기와 같다 — 오른쪽 칸(660px)에 들어가게 줄인다.
  const nameSize = Math.min(88, Math.floor(660 / Math.max(1, [...who].length)));
  const band = legendBand(e.legendScore);
  return [
    {
      text: `FULL TIME${e.number != null ? ` · NO.${e.number}` : ''}`,
      font: 'num',
      size: 30,
      x: 470,
      y: 170,
      fill: '#e8b64a',
      spacing: 4,
    },
    { text: who, font: 'kr', size: nameSize, x: 470, y: 288, fill: '#ffffff' },
    {
      text: `${POS_LABEL[e.pos]} · ${e.retireAge}세 은퇴 · ${e.lastClub}`,
      font: 'kr',
      size: 30,
      x: 470,
      y: 340,
      fill: '#b9c7bf',
    },
    { text: String(e.legendScore), font: 'num', size: 132, x: 466, y: 488, fill: '#f2c14e' },
    {
      text: 'LEGEND SCORE',
      font: 'num',
      size: 26,
      x: 470 + String(e.legendScore).length * 62 + 28,
      y: 440,
      fill: '#e8b64a',
      spacing: 3,
    },
    {
      text: band.name,
      font: 'kr',
      size: 34,
      x: 470 + String(e.legendScore).length * 62 + 28,
      y: 484,
      fill: '#ffffff',
    },
    {
      text: `${e.apps}경기 · ${e.goals}골 · ${e.assists}도움 · 트로피 ${e.trophies}`,
      font: 'kr',
      size: 30,
      x: 470,
      y: 552,
      fill: '#dfe7e2',
    },
    {
      text: '오프사이드 · offside-lab.com',
      font: 'kr',
      size: 24,
      x: OG_W - 56,
      y: OG_H - 36,
      fill: '#7f9187',
      anchor: 'end',
    },
  ];
}

const FAMILY = { kr: 'IBM Plex Sans KR', num: 'Barlow Condensed' } as const;
const badgeText = (e: PublicHofEntry) => (e.number != null ? String(e.number) : e.pos);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 카드 SVG. 글꼴은 이름만 적고, 실제 글꼴 파일은 렌더러가 넣는다(cardGlyphs로 필요한 글자만 받는다). */
export function careerCardSvg(e: PublicHofEntry): string {
  const club = lastClubOf(e);
  // 엠블럼을 모르면(옛 기록·대표팀) 왼쪽이 비지 않게 등번호(없으면 포지션) 배지를 둔다.
  const crest = club
    ? `<g transform="translate(96 150) scale(5)">${crestSvg(crestOf(club), 'crest', '#0d1f15')}</g>`
    : `<rect x="116" y="170" width="280" height="280" rx="56" fill="#123021" stroke="#e8b64a" stroke-width="4"/>` +
      `<text x="256" y="366" font-family="${FAMILY.num}" font-size="150" font-weight="700" fill="#f2c14e" text-anchor="middle">${badgeText(e)}</text>`;
  const text = lines(e)
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" font-family="${FAMILY[l.font]}" font-size="${l.size}" font-weight="700" fill="${l.fill}"${l.anchor ? ` text-anchor="${l.anchor}"` : ''}${l.spacing ? ` letter-spacing="${l.spacing}"` : ''}>${esc(l.text)}</text>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">` +
    `<defs><radialGradient id="bg" cx="0.2" cy="0.1" r="1.1"><stop offset="0" stop-color="#1f4a32"/><stop offset="0.55" stop-color="#0c1d14"/><stop offset="1" stop-color="#060d09"/></radialGradient></defs>` +
    `<rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>` +
    `<rect x="24" y="24" width="${OG_W - 48}" height="${OG_H - 48}" rx="28" fill="none" stroke="#2c5a40" stroke-width="2"/>` +
    crest +
    text +
    `</svg>`
  );
}

/** 글꼴별로 카드에 쓰이는 글자(구글 폰트에서 이 글자만 받는다). 엠블럼의 이름 글자도 포함. */
export function cardGlyphs(e: PublicHofEntry): Record<keyof typeof FAMILY, string> {
  const out = { kr: '', num: '' };
  for (const l of lines(e)) out[l.font] += l.text;
  const club = lastClubOf(e);
  if (club) out.kr += crestOf(club).text ?? '';
  else out.num += badgeText(e);
  const uniq = (s: string) => [...new Set(s.replace(/\s/g, ''))].join('');
  return { kr: uniq(out.kr), num: uniq(out.num) };
}

/** 카드 내용이 바뀌면(이름 공개·점수 등) 달라지는 이미지 URL 꼬리표 — 미리보기 캐시를 새로 받게 한다. */
export const cardVersion = (e: PublicHofEntry): string =>
  hashStr(
    [
      CARD_VERSION,
      e.name,
      e.pos,
      e.number,
      e.retireAge,
      e.legendScore,
      e.lastClub,
      e.lastClubId,
      e.apps,
      e.goals,
      e.assists,
      e.trophies,
    ].join('|'),
  ).toString(36);
