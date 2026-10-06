// T-10-079 SNS 공유용 한 장 이미지(1080×1350, 인스타 4:5)의 캔버스 그리기. 카드 내용(shareCardData — 순수 함수라
// 테스트한다)은 앱과 함께 쓰는 @offside/app-core/shareCard 에서 만든다. 은퇴 화면의 공유 이미지 카드(지연 로드)만 쓴다.
import {
  CARD_H,
  CARD_W,
  cardBrand,
  tagline,
  type ShareCardData,
} from '@offside/app-core/shareCard';
import { drawJersey } from './jerseyCanvas.js';

export { CARD_H, CARD_W, shareCardData, type ShareCardData } from '@offside/app-core/shareCard';

// ───────── 그리기 ─────────
const C = {
  bg0: '#0c1c14',
  bg1: '#08120d',
  ink: '#eef4ef',
  muted: '#a9b8ae',
  gold: '#f0b437',
  onGold: '#1a1204',
  line: 'rgba(238, 244, 239, 0.16)',
  chip: 'rgba(238, 244, 239, 0.08)',
};
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "'IBM Plex Sans KR', system-ui, sans-serif";
/** 카드에 쓰는 글꼴 전부 — 그리기 전에 이 목록 그대로 불러온다(loadCardFonts). */
const F = {
  kicker: `600 34px ${DISPLAY}`,
  name: `700 104px ${BODY}`,
  sub: `400 34px ${BODY}`,
  score: `700 210px ${DISPLAY}`,
  label: `600 30px ${DISPLAY}`,
  heading: `600 28px ${DISPLAY}`,
  pill: `600 32px ${BODY}`,
  statValue: `700 76px ${DISPLAY}`,
  statLabel: `400 28px ${BODY}`,
  years: `600 34px ${DISPLAY}`,
  club: `600 34px ${BODY}`,
  league: `400 26px ${BODY}`,
  styleName: `700 52px ${BODY}`,
  note: `400 30px ${BODY}`,
  brand: `700 36px ${BODY}`,
  tagline: `400 26px ${BODY}`,
  url: `600 36px ${DISPLAY}`,
  // 결번 유니폼 글자(유니폼 도안 단위 — 그릴 때 유니폼 크기만큼 커진다).
  jerseyName: `600 10px ${BODY}`,
  jerseyNumber: `700 50px ${DISPLAY}`,
};
const PAD = 80;
const PILL = { h: 62, padX: 28, gap: 16, min: 300 };
/** 여정 한 줄: 연도는 YEAR_X에 오른쪽 맞춤, 구단·리그는 CLUB_X부터. */
const YEAR_X = CARD_W / 2 - 190;
const CLUB_X = CARD_W / 2 - 160;

/** 카드에 쓰는 웹폰트를 카드 글자로 불러온다(한글 폰트는 글자 범위별로 나뉘어 있어 실제 글자를 넘겨야 다 온다). */
export async function loadCardFonts(c: ShareCardData) {
  if (!document.fonts) return;
  const sample = [
    c.kicker,
    c.name,
    c.sub,
    ...c.pills.map((p) => p.text + (p.tail ?? '')),
    ...c.stats.map((s) => s.label),
    ...c.stops.flatMap((s) => (s ? [s.club, s.league] : [])),
    c.style?.name,
    c.style?.best ?? c.style?.line,
    c.jersey?.name,
    ...c.honours.map((h) => h.name),
    `${cardBrand()} ${tagline()} offside-lab.com LEGEND SCORE THE JOURNEY HONOURS HOW I PLAYED ×0123456789`,
  ].join('');
  await Promise.all(Object.values(F).map((f) => document.fonts.load(f, sample).catch(() => [])));
}

export function drawShareCard(canvas: HTMLCanvasElement, c: ShareCardData) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const mid = CARD_W / 2;
  const inner = CARD_W - PAD * 2;

  /** 글꼴·색·정렬을 정하고 한 줄 쓴다. max를 주면 넘칠 때 끝을 '…'로 줄인다. 쓴 폭을 돌려준다. */
  const text = (
    s: string,
    x: number,
    y: number,
    font: string,
    color: string,
    { align = 'center', max }: { align?: CanvasTextAlign; max?: number } = {},
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if (max != null && ctx.measureText(s).width > max) {
      while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
      s = `${s}…`;
    }
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  };
  /** 자간을 벌린 가운데 정렬 제목(letterSpacing이 없는 브라우저도 같은 모양이 나오게 한 글자씩 놓는다). */
  const spaced = (s: string, y: number, font: string, color: string, gap: number, cx = mid) => {
    ctx.font = font;
    const ws = [...s].map((ch) => ctx.measureText(ch).width);
    let x = cx - ws.reduce((n, w) => n + w + gap, -gap) / 2;
    [...s].forEach((ch, i) => {
      text(ch, x, y, font, color, { align: 'left' });
      x += ws[i]! + gap;
    });
  };
  const rule = (y: number) => {
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, y, inner, 2);
  };

  // 배경: 은퇴 크레딧과 같은 밤 경기장 톤 + 위쪽 금빛 조명 + 센터 서클.
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, C.bg0);
  bg.addColorStop(0.45, C.bg1);
  bg.addColorStop(1, C.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(mid, 0, 0, mid, 0, 760);
  glow.addColorStop(0, 'rgba(240, 180, 55, 0.18)');
  glow.addColorStop(1, 'rgba(240, 180, 55, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, 760);
  ctx.strokeStyle = 'rgba(238, 244, 239, 0.05)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mid, 430, 240, 0, Math.PI * 2);
  ctx.moveTo(0, 430);
  ctx.lineTo(CARD_W, 430);
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';

  // 머리: FULL TIME · 이름 · 포지션/기간
  spaced(c.kicker, 118, F.kicker, C.gold, 7);
  text(c.name, mid, 232, F.name, C.ink, { max: inner });
  text(c.sub, mid, 290, F.sub, C.muted, { max: inner });

  // 레전드 점수(영구결번이면 왼쪽으로 비키고 오른쪽에 결번 유니폼)
  const scoreX = c.jersey ? mid - 200 : mid;
  text(String(c.score), scoreX, 500, F.score, C.gold);
  spaced('LEGEND SCORE', 546, F.label, C.muted, 8, scoreX);
  if (c.jersey) {
    drawJersey(ctx, { cx: mid + 215, top: 306, width: 220 }, c.jersey, {
      name: F.jerseyName,
      number: F.jerseyNumber,
    });
  }

  // 배지: 한 줄에 가운데 정렬. 넘치면 뒷부분(tail)이 있는 마지막 배지는 앞을 줄이고, 그래도 안 되면 뒤 배지부터 뺀다.
  ctx.font = F.pill;
  const width = (s: string) => ctx.measureText(s).width;
  let pills = c.pills.map((p) => ({ ...p, w: width(p.text + (p.tail ?? '')) + PILL.padX * 2 }));
  const rowW = () => pills.reduce((n, p) => n + p.w + PILL.gap, -PILL.gap);
  while (pills.length > 1 && rowW() > inner) {
    const last = pills.at(-1)!;
    const room = last.w - (rowW() - inner);
    if (last.tail && room >= PILL.min) {
      last.w = room;
      let head = last.text;
      while (head.length > 1 && width(`${head}…${last.tail}`) > room - PILL.padX * 2)
        head = head.slice(0, -1);
      last.text = `${head.trimEnd()}…`;
      break;
    }
    pills = pills.slice(0, -1);
  }
  let px = mid - rowW() / 2;
  for (const p of pills) {
    ctx.beginPath();
    ctx.roundRect(px, 578, p.w, PILL.h, PILL.h / 2);
    ctx.fillStyle = p.gold ? C.gold : C.chip;
    ctx.fill();
    if (!p.gold) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    text(p.text + (p.tail ?? ''), px + p.w / 2, 621, F.pill, p.gold ? C.onGold : C.ink, {
      max: p.w - PILL.padX * 2,
    });
    px += p.w + PILL.gap;
  }

  // 통산 기록
  const sy = 680;
  rule(sy);
  rule(sy + 148);
  const cw = inner / c.stats.length;
  c.stats.forEach((s, i) => {
    const x = PAD + cw * (i + 0.5);
    text(s.value, x, sy + 88, F.statValue, C.ink);
    text(s.label, x, sy + 128, F.statLabel, C.muted);
  });

  // 커리어 여정(+ 성향이 없으면 대표 우승). 성향 칸이 없으면 기록 아래~바닥 줄 사이 가운데에 둔다(짧은 여정이 위에 몰리지 않게).
  let y = sy + 206;
  const HONOURS_GAP = 26;
  if (!c.style) {
    const rows = c.stops.reduce((n, s) => n + (s ? 52 : 40), 0);
    const honoursH = c.honours.length ? HONOURS_GAP + 56 + c.honours.length * 52 : 0;
    const blockH = 22 + 56 + rows + honoursH - 52 + 10; // 제목 글자 윗선 ~ 마지막 줄 아랫선
    y = Math.max(y, Math.round(sy + 148 + (CARD_H - 100 - (sy + 148) - blockH) / 2 + 22));
  }
  spaced('THE JOURNEY', y, F.heading, C.gold, 6);
  y += 56;
  for (const s of c.stops) {
    if (!s) {
      text('⋮', YEAR_X + 15, y - 6, F.note, C.muted);
      y += 40;
      continue;
    }
    text(s.years, YEAR_X, y, F.years, C.muted, { align: 'right' });
    const lx = CLUB_X + text(s.club, CLUB_X, y, F.club, C.ink, { align: 'left', max: 430 }) + 16;
    text(s.league, lx, y, F.league, C.muted, { align: 'left', max: CARD_W - PAD - lx });
    y += 52;
  }
  if (c.honours.length) {
    y += HONOURS_GAP;
    spaced('HONOURS', y, F.heading, C.gold, 6);
    y += 56;
    for (const h of c.honours) {
      text(h.count, YEAR_X, y, F.years, C.gold, { align: 'right' });
      text(h.name, CLUB_X, y, F.club, C.ink, { align: 'left', max: CARD_W - PAD - CLUB_X });
      y += 52;
    }
  }

  // 플레이 성향
  if (c.style) {
    y = Math.max(y + 18, 1100);
    spaced('HOW I PLAYED', y, F.heading, C.gold, 6);
    text(`${c.style.icon} ${c.style.name}`, mid, y + 70, F.styleName, C.ink, { max: inner });
    text(c.style.best ?? c.style.line, mid, y + 120, F.note, C.muted, { max: inner });
  }

  // 바닥: 게임 이름과 주소
  rule(CARD_H - 100);
  const bw = text(cardBrand(), PAD, CARD_H - 44, F.brand, C.ink, { align: 'left' });
  text(tagline(), PAD + bw + 24, CARD_H - 46, F.tagline, C.muted, { align: 'left' });
  text('offside-lab.com', CARD_W - PAD, CARD_H - 44, F.url, C.gold, { align: 'right' });
}

/** 캔버스 → PNG 파일(공유 시트·저장에 넘긴다). */
export function cardFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(new File([b], `offside-${name}.png`, { type: 'image/png' }))
          : reject(new Error('toBlob')),
      'image/png',
    ),
  );
}
