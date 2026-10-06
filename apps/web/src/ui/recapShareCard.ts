// T-11-128 시즌 결산 SNS 공유 이미지(4:5, 1080×1350). 결산 화면과 같은 값(app-core seasonRecap.ts)을 캔버스에 직접 그린다.
// 시즌 등급 엠블럼은 랭킹과 같은 벡터 레이어(gradeEmblem.ts)를 Path2D로 옮긴다. 결산 화면이 열 때만 불러온다(첫 화면 번들 밖).
import type { SeasonRecap } from '@offside/contracts';
import { gradeEmblem, EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
import {
  rankText,
  recapHeadline,
  recapHighlights,
  recapNumbers,
  topPercent,
} from '@offside/app-core/seasonRecap';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { anonName } from '@offside/app-core/format';
import { num, recordText } from '@offside/app-core/teamText';
import { cardFile } from './share/shareCard.js';

const W = 1080;
const H = 1350;
const PAD = 60;
const BODY = "'IBM Plex Sans KR', 'Apple SD Gothic Neo', sans-serif";
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const C = {
  bg: '#0b120e',
  ink: '#eef4ef',
  muted: '#9fb0a5',
  gold: '#f0b437',
  cell: 'rgba(238,244,239,0.06)',
  cellLine: 'rgba(238,244,239,0.12)',
};

export async function makeRecapShareFile(recap: SeasonRecap): Promise<File> {
  const season = teamSeasonLabel(recap.season);
  await Promise.all([
    document.fonts.load(`700 60px ${BODY}`, `${season}${recapHeadline(recap)}${L.cardTagline}`),
    document.fonts.load(`700 80px ${DISPLAY}`, '0123456789,+%#OFFSIDE SEASON RECAP'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  try {
    drawRecapShareCard(canvas, recap);
    return await cardFile(canvas, `recap-${season}`);
  } finally {
    canvas.width = 0; // 큰 캔버스 메모리를 바로 놓는다(iOS 사파리 캔버스 한도).
    canvas.height = 0;
  }
}

export function drawRecapShareCard(canvas: HTMLCanvasElement, r: SeasonRecap) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context');
  const tier = recapTier(r);
  const palette = EMBLEM_PALETTE[tier];
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = 'left',
    family = BODY,
    max?: number,
    weight = 700,
  ) => {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y, max);
    return Math.min(ctx.measureText(value).width, max ?? Infinity);
  };

  // 바탕 — 어두운 잔디색에 시즌 등급 빛, 비스듬한 결.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(540, 360, 40, 540, 360, 720);
  glow.addColorStop(0, `${palette.base}88`);
  glow.addColorStop(0.45, `${palette.base}22`);
  glow.addColorStop(1, `${palette.base}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 26;
  for (let x = -H; x < W; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  ctx.restore();

  // 머리 — 게임 이름 · SEASON RECAP · 시즌 이름.
  text('OFFSIDE', PAD, 86, 40, C.gold, 'left', DISPLAY);
  text('SEASON RECAP', W - PAD, 86, 30, C.muted, 'right', DISPLAY);
  text(teamSeasonLabel(r.season), 540, 196, 88, C.ink, 'center', BODY, W - PAD * 2);

  // 시즌 등급 엠블럼(64 격자 → 230px).
  const { layers } = gradeEmblem(tier);
  ctx.save();
  ctx.translate(540 - 115, 222);
  ctx.scale(230 / 64, 230 / 64);
  ctx.shadowColor = `${palette.base}aa`;
  ctx.shadowBlur = 18;
  for (const layer of layers) {
    ctx.fillStyle = palette[layer.tone];
    ctx.fill(new Path2D(layer.d));
  }
  ctx.restore();
  text(tierTitle({ tier, season: r.season }), 540, 506, 48, palette.light, 'center');
  text(tierReason(r), 540, 550, 26, C.muted, 'center', BODY, undefined, 400);
  text(recapHeadline(r), 540, 614, 32, C.ink, 'center', BODY, W - PAD * 2);

  // 숫자 칸 — 세 칸씩 두 줄.
  // 은퇴 선수 수는 한 줄 요약에 들어 있어 칸에서 뺀다(A매치보다 발롱도르가 먼저).
  const cells = recapNumbers(r)
    .filter((c) => c.key !== 'retired' && c.key !== 'caps')
    .slice(0, 6);
  const cols = 3;
  const gap = 24;
  const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
  const ch = 128;
  cells.forEach((cell, i) => {
    const x = PAD + (i % cols) * (cw + gap);
    const y = 656 + Math.floor(i / cols) * (ch + gap);
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 18);
    ctx.fillStyle = C.cell;
    ctx.fill();
    ctx.strokeStyle = C.cellLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(
      num(cell.value),
      x + cw / 2,
      y + 76,
      66,
      cell.key === 'players' ? C.ink : C.gold,
      'center',
      DISPLAY,
      cw - 24,
    );
    text(cell.label, x + cw / 2, y + 110, 24, C.muted, 'center', BODY, cw - 24, 500);
  });
  const rows = Math.ceil(cells.length / cols);
  let y = 656 + rows * (ch + gap) + 6;

  // 대표 선수 · 팀 두 칸.
  const half = (W - PAD * 2 - gap) / 2;
  const panel = (x: number, eyebrow: string, title: string, lines: string[]) => {
    ctx.beginPath();
    ctx.roundRect(x, y, half, 176, 18);
    ctx.fillStyle = C.cell;
    ctx.fill();
    ctx.strokeStyle = C.cellLine;
    ctx.stroke();
    text(eyebrow, x + 26, y + 42, 22, C.muted, 'left', BODY, half - 52, 500);
    text(title, x + 26, y + 90, 38, C.ink, 'left', BODY, half - 52);
    lines.forEach((line, i) =>
      text(line, x + 26, y + 128 + i * 32, 24, C.gold, 'left', BODY, half - 52, 600),
    );
  };
  if (r.best)
    panel(PAD, L.best, r.best.name ?? anonName(r.best.pos, null), [
      L.bestScore({ score: num(r.best.score) }),
      ...(r.stats?.scorer
        ? [`${L.scorer} ${L.scorerGoals({ n: num(r.stats.scorer.goals) })}`]
        : []),
    ]);
  else panel(PAD, L.secActivity, L.players, [num(r.players)]);
  if (r.team) {
    const pct = topPercent(r.team.rank, r.team.ranked);
    panel(PAD + half + gap, L.secTeam, r.team.name, [
      recordText({ w: r.team.wins, d: r.team.draws, l: r.team.losses }),
      `${L.teamRank} ${rankText(r.team.rank, r.team.ranked)}${pct === null ? '' : ` · ${L.topPct({ pct })}`}`,
    ]);
  } else if (r.achievements) {
    const pct = topPercent(r.achievements.rank, r.achievements.ranked);
    panel(PAD + half + gap, L.secAch, L.achScore, [
      num(r.achievements.score),
      `${rankText(r.achievements.rank, r.achievements.ranked)}${pct === null ? '' : ` · ${L.topPct({ pct })}`}`,
    ]);
  }
  y += 176 + 30;

  // 자랑거리 알약 — 들어가는 만큼만 한 줄로.
  ctx.font = `700 26px ${BODY}`;
  const pills: { label: string; w: number }[] = [];
  let used = 0;
  for (const label of recapHighlights(r)) {
    const w = ctx.measureText(label).width + 44;
    if (used + w + (pills.length ? 14 : 0) > W - PAD * 2) break;
    used += w + (pills.length ? 14 : 0);
    pills.push({ label, w });
  }
  let px = 540 - used / 2;
  for (const p of pills) {
    ctx.beginPath();
    ctx.roundRect(px, y, p.w, 54, 27);
    ctx.fillStyle = `${palette.base}33`;
    ctx.fill();
    ctx.strokeStyle = `${palette.light}88`;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(p.label, px + p.w / 2, y + 36, 26, palette.mark, 'center');
    px += p.w + 14;
  }

  // 바닥 — 한 줄 소개와 주소.
  ctx.fillStyle = C.cellLine;
  ctx.fillRect(PAD, H - 108, W - PAD * 2, 1.5);
  text(L.cardTagline, PAD, H - 52, 26, C.muted, 'left', BODY, 600, 500);
  text('offside-lab.com', W - PAD, H - 50, 38, C.gold, 'right', DISPLAY);
}
