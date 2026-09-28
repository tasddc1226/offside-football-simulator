// T-10-079 SNS 공유용 한 장 이미지(1080×1350, 인스타 4:5). 은퇴 리포트와 같은 LegendView로 카드 내용을 만들고
// (shareCardData — 순수 함수라 테스트한다) 캔버스에 그린다(drawShareCard). 은퇴 화면의 공유 이미지 카드(지연 로드)만 쓴다.
import { legendBand } from '../../game/legend-bands.js';
import { styleReport } from '../../game/playStyleReport.js';
import { careerChapters } from '../../game/retirement-report.js';
import { POS_LABEL } from '../../game/pos-label.js';
import { titleById } from '../../game/titles.js';
import { totals } from '../format.js';
import type { LegendView } from '../state.svelte.js';

export const CARD_W = 1080;
export const CARD_H = 1350;
/** 여정에 싣는 구단 수(넘치면 첫 구단과 마지막 구단들만 남기고 가운데를 줄인다). 성향 칸이 있으면 줄어든다. */
const STOPS = { withStyle: 3, alone: 5 };

export interface ShareCardData {
  kicker: string;
  name: string;
  sub: string;
  score: number;
  /** 등급 · 대표 칭호 · 영구결번 배지. */
  pills: { text: string; gold?: boolean }[];
  stats: { value: string; label: string }[];
  /** 커리어 여정(연도 · 구단 · 리그). 가운데를 줄였으면 null 한 칸이 들어간다. */
  stops: ({ years: string; club: string; league: string } | null)[];
  style: { icon: string; name: string; line: string; best: string | null } | null;
}

const yy = (from: number, to: number) =>
  from === to ? `${from}` : `${from}–${String(to % 100).padStart(2, '0')}`;

export function shareCardData(v: LegendView, titleId: string | null | undefined): ShareCardData {
  const d = v.d;
  const back = v.pos === 'GK' || v.pos === 'DF';
  const t = d ? totals(d) : null;
  const span = d?.career.length ? `${d.career[0]!.year}–${d.career.at(-1)!.year}` : null;
  const main = titleById(titleId);
  const rn = v.rn?.kind === 'granted' ? v.rn : null;
  const pills: ShareCardData['pills'] = [{ text: legendBand(v.score).name, gold: true }];
  if (main && main.cat !== 'legend') pills.push({ text: `‘${main.name}’` });
  if (rn) pills.push({ text: `👑 ${rn.club} 영구결번 ${rn.number}` });
  else pills.push({ text: `최고 OVR ${v.peak}` });

  const apps = t?.p ?? v.totals.apps;
  const stats = [
    { value: String(d?.career.length ?? '—'), label: '시즌' },
    { value: String(apps), label: '경기' },
    back
      ? { value: String(t?.cs ?? '—'), label: '무실점' }
      : { value: `${t?.g ?? v.totals.goals}`, label: '골' },
    back
      ? { value: String(v.totals.trophies), label: '트로피' }
      : { value: `${t?.a ?? v.totals.assists}`, label: '도움' },
  ];
  if (!back) stats.push({ value: String(v.totals.trophies), label: '트로피' });

  const r = d ? styleReport(d.style, d.career) : null;
  const all = (d ? careerChapters(d) : []).map((c) => ({
    years: yy(c.from, c.to),
    club: c.club,
    league: c.leagues.at(-1)!,
  }));
  const room = r ? STOPS.withStyle : STOPS.alone;
  const stops = all.length > room ? [all[0]!, null, ...all.slice(-(room - 2))] : all;
  return {
    kicker: `FULL TIME${v.number != null ? ` · NO.${v.number}` : ''}`,
    name: v.name,
    sub: [POS_LABEL[v.pos], span, `${v.age}세 은퇴`].filter(Boolean).join(' · '),
    score: v.score,
    pills,
    stats,
    stops,
    style: r
      ? {
          icon: r.type.icon,
          name: r.type.name,
          line: r.type.line,
          best: r.best ? `성공 확률 ${r.best.pct}%의 ‘${r.best.title}’, 기어이 해냈다` : null,
        }
      : null,
  };
}

// ───────── 그리기 ─────────
const C = {
  bg0: '#0c1c14',
  bg1: '#08120d',
  ink: '#eef4ef',
  muted: '#a9b8ae',
  gold: '#f0b437',
  line: 'rgba(238, 244, 239, 0.16)',
  chip: 'rgba(238, 244, 239, 0.08)',
};
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "'IBM Plex Sans KR', system-ui, sans-serif";
const PAD = 80;

/** 폭을 넘으면 끝을 '…'로 줄인다. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  // letterSpacing을 지원하지 않는 브라우저도 같은 모양이 나오게 한 글자씩 놓는다(가운데 정렬 기준).
  const w = [...text].reduce((n, ch) => n + ctx.measureText(ch).width + gap, -gap);
  let cx = x - w / 2;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.textAlign = 'center';
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gold: boolean,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = gold ? C.gold : C.chip;
  ctx.fill();
  if (!gold) {
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** 카드에 쓰는 웹폰트를 기다린다(늦게 오면 대체 글꼴로 그려진다). */
export async function loadCardFonts() {
  if (!document.fonts) return;
  await Promise.all(
    [`700 120px ${DISPLAY}`, `600 40px ${DISPLAY}`, `700 80px ${BODY}`, `400 32px ${BODY}`].map(
      (f) => document.fonts.load(f, '가A1').catch(() => []),
    ),
  );
}

export function drawShareCard(canvas: HTMLCanvasElement, c: ShareCardData) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const mid = CARD_W / 2;
  const inner = CARD_W - PAD * 2;

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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // 머리: FULL TIME · 이름 · 포지션/기간
  ctx.fillStyle = C.gold;
  ctx.font = `600 34px ${DISPLAY}`;
  spaced(ctx, c.kicker, mid, 118, 7);
  ctx.fillStyle = C.ink;
  ctx.font = `700 104px ${BODY}`;
  ctx.fillText(fit(ctx, c.name, inner), mid, 232);
  ctx.fillStyle = C.muted;
  ctx.font = `400 34px ${BODY}`;
  ctx.fillText(fit(ctx, c.sub, inner), mid, 290);

  // 레전드 점수
  ctx.fillStyle = C.gold;
  ctx.font = `700 210px ${DISPLAY}`;
  ctx.fillText(String(c.score), mid, 500);
  ctx.fillStyle = C.muted;
  ctx.font = `600 30px ${DISPLAY}`;
  spaced(ctx, 'LEGEND SCORE', mid, 546, 8);

  // 배지: 한 줄에 가운데 정렬(넘치면 뒤 배지부터 뺀다).
  ctx.font = `600 32px ${BODY}`;
  const padX = 28;
  let pills = c.pills.map((p) => ({ ...p, w: ctx.measureText(p.text).width + padX * 2 }));
  while (pills.length > 1 && pills.reduce((n, p) => n + p.w + 16, -16) > inner)
    pills = pills.slice(0, -1);
  let px = mid - pills.reduce((n, p) => n + p.w + 16, -16) / 2;
  for (const p of pills) {
    pill(ctx, px, 578, p.w, 62, !!p.gold);
    ctx.fillStyle = p.gold ? '#1a1204' : C.ink;
    ctx.fillText(fit(ctx, p.text, p.w - padX), px + p.w / 2, 621);
    px += p.w + 16;
  }

  // 통산 기록
  const sy = 680;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, sy);
  ctx.lineTo(CARD_W - PAD, sy);
  ctx.moveTo(PAD, sy + 148);
  ctx.lineTo(CARD_W - PAD, sy + 148);
  ctx.stroke();
  const cw = inner / c.stats.length;
  c.stats.forEach((s, i) => {
    const x = PAD + cw * (i + 0.5);
    ctx.fillStyle = C.ink;
    ctx.font = `700 76px ${DISPLAY}`;
    ctx.fillText(s.value, x, sy + 88);
    ctx.fillStyle = C.muted;
    ctx.font = `400 28px ${BODY}`;
    ctx.fillText(s.label, x, sy + 128);
  });

  // 커리어 여정(성향이 없으면 더 길게)
  let y = sy + 206;
  ctx.fillStyle = C.gold;
  ctx.font = `600 28px ${DISPLAY}`;
  spaced(ctx, 'THE JOURNEY', mid, y, 6);
  y += 56;
  for (const s of c.stops) {
    if (!s) {
      ctx.fillStyle = C.muted;
      ctx.font = `400 30px ${BODY}`;
      ctx.fillText('⋮', mid - 175, y - 6);
      y += 40;
      continue;
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = C.muted;
    ctx.font = `600 34px ${DISPLAY}`;
    ctx.fillText(s.years, mid - 190, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `600 34px ${BODY}`;
    const club = fit(ctx, s.club, 430);
    ctx.fillText(club, mid - 160, y);
    const cwid = ctx.measureText(club).width;
    ctx.fillStyle = C.muted;
    ctx.font = `400 26px ${BODY}`;
    ctx.fillText(
      fit(ctx, s.league, CARD_W - PAD - (mid - 160 + cwid + 16)),
      mid - 160 + cwid + 16,
      y,
    );
    ctx.textAlign = 'center';
    y += 52;
  }

  // 플레이 성향
  if (c.style) {
    y = Math.max(y + 18, 1100);
    ctx.fillStyle = C.gold;
    ctx.font = `600 28px ${DISPLAY}`;
    spaced(ctx, 'HOW I PLAYED', mid, y, 6);
    ctx.font = `700 52px ${BODY}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(fit(ctx, `${c.style.icon} ${c.style.name}`, inner), mid, y + 70);
    ctx.fillStyle = C.muted;
    ctx.font = `400 30px ${BODY}`;
    ctx.fillText(fit(ctx, c.style.best ?? c.style.line, inner), mid, y + 120);
  }

  // 바닥: 게임 이름과 주소
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, CARD_H - 100, inner, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `700 36px ${BODY}`;
  ctx.fillText('오프사이드', PAD, CARD_H - 44);
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${BODY}`;
  ctx.fillText('고3부터 은퇴까지, 한 선수의 인생', PAD + 200, CARD_H - 46);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.gold;
  ctx.font = `600 36px ${DISPLAY}`;
  ctx.fillText('offside-lab.com', CARD_W - PAD, CARD_H - 44);
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
