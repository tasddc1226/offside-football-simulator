import { teamOvr, type FormationId, type TeamLayout } from '@offside/contracts/owner-team';
import type { TeamLines, TeamPlayer } from '@offside/app-core/api/team';
import { cardFile } from '../share/shareCard.js';
import { defaultTeamLogo, type TeamLogo } from '@offside/contracts/team-logo';
import { CREST_SHAPES, CREST_PATTERNS } from '@offside/game/crests';
import { teamHomeText as LH } from '@offside/app-core/i18n/ko/teamHome';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';

export type TeamShareData = {
  name: string;
  logo: TeamLogo | null;
  manager: string;
  seasonName: string;
  formation: FormationId;
  layout: TeamLayout;
  cells: readonly {
    name: string;
    rating: number;
    youth: boolean;
    player?: TeamPlayer | undefined;
  }[];
  lines: TeamLines;
  draft: boolean;
};

export const TEAM_SHARE_W = 1080;
export const TEAM_SHARE_H = 1350;
const BODY = "'IBM Plex Sans KR', 'Apple SD Gothic Neo', sans-serif";
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const SHIELD = new Path2D(
  'M0 16H23L36 4 73 0 110 4 123 16H146L143 150 126 166 73 178 20 166 3 150Z',
);
const SHIRT = new Path2D(
  'M30 10 15 17 3 38 20 48 26 36 24 90 76 90 74 36 80 48 97 38 85 17 70 10 62 5Q50 16 38 5Z',
);

/** 그라운드의 현재 초안을 직접 그린다. DOM 애니메이션이나 추가 API 요청은 사용하지 않는다. */
export async function makeTeamShareFile(data: TeamShareData): Promise<File> {
  const sample = [
    data.name,
    data.logo?.text ?? '',
    data.manager,
    data.seasonName,
    ...data.cells.map((c) => c.name),
    '오프사이드 감독 선발 최고 OVR 포지션 배치 공격 중원 수비 골문 자유0123456789',
    L.cardBrand,
    L.cardManagerWeb({ name: '' }),
    L.cardStarters({ n: 0 }),
    L.cardFootWeb,
    LH.attackDirection,
    LH.posOvr({ n: 0 }),
    LH.lineAtk,
    LH.lineMid,
    LH.lineDef,
    LH.lineGk,
  ].join('');
  await Promise.all([
    document.fonts.load(`700 60px ${BODY}`, sample),
    document.fonts.load(`400 24px ${BODY}`, sample),
    document.fonts.load(`700 78px ${DISPLAY}`, '0123456789 OVR GK CB FB DM CM AM W ST'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = TEAM_SHARE_W;
  canvas.height = TEAM_SHARE_H;
  let logoImage: HTMLImageElement | undefined;
  try {
    if (data.logo?.img) {
      try {
        logoImage = new Image();
        logoImage.src = data.logo.img;
        await logoImage.decode();
      } catch {
        logoImage = undefined;
      }
    }
    drawTeamShareCard(canvas, data, logoImage);
    return await cardFile(canvas, `team-${data.name}`);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    if (logoImage) logoImage.src = '';
  }
}

function nameLines(ctx: CanvasRenderingContext2D, value: string, width: number) {
  let lines: string[] = [];
  let size = 19;
  for (; size >= 11; size--) {
    ctx.font = `700 ${size}px ${BODY}`;
    lines = [];
    let line = '';
    for (const char of value) {
      if (line && ctx.measureText(line + char).width > width) {
        lines.push(line.trim());
        line = '';
      }
      line += char;
    }
    if (line) lines.push(line.trim());
    if (lines.length <= 3) break;
  }
  return { lines, size: Math.max(11, size) };
}

export function drawTeamShareCard(
  canvas: HTMLCanvasElement,
  data: TeamShareData,
  logoImage?: HTMLImageElement,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context');
  ctx.fillStyle = '#0d1511';
  ctx.fillRect(0, 0, TEAM_SHARE_W, TEAM_SHARE_H);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = '#eef4ef',
    align: CanvasTextAlign = 'left',
    family = BODY,
    max?: number,
  ) => {
    ctx.font = `700 ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y, max);
  };
  text(L.cardBrand, 60, 66, 30, '#f0b437');
  text(data.seasonName, 1020, 66, 24, '#a9b8ae', 'right');
  drawLogo(ctx, data.logo ?? defaultTeamLogo(data.name), logoImage);
  text(data.name, 160, 150, 64, '#eef4ef', 'left', BODY, 660);
  text(
    `${data.manager ? L.cardManagerWeb({ name: data.manager }) : ''}${L.cardStarters({ n: data.cells.filter((c) => !c.youth).length })}`,
    60,
    197,
    25,
    '#a9b8ae',
  );
  const ovr = teamOvr(data.cells.map((c) => c.rating));
  text(String(ovr), 1020, 149, 84, '#f0b437', 'right', DISPLAY);
  text('OVR', 1020, 187, 26, '#a9b8ae', 'right', DISPLAY);

  const field = { x: 60, y: 230, w: 960, h: 930 };
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(field.x, field.y, field.w, field.h, 24);
  ctx.clip();
  ctx.fillStyle = '#1c4a35';
  ctx.fillRect(field.x, field.y, field.w, field.h);
  ctx.fillStyle = '#20513b';
  for (let i = 1; i < 10; i += 2)
    ctx.fillRect(field.x, field.y + (i * field.h) / 10, field.w, field.h / 10);
  ctx.strokeStyle = 'rgba(238,244,239,.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(field.x + 22, field.y + 22, field.w - 44, field.h - 44);
  ctx.beginPath();
  ctx.moveTo(field.x + 22, field.y + field.h / 2);
  ctx.lineTo(field.x + field.w - 22, field.y + field.h / 2);
  ctx.moveTo(640, field.y + field.h / 2);
  ctx.arc(540, field.y + field.h / 2, 100, 0, Math.PI * 2);
  ctx.stroke();
  for (const bottom of [false, true]) {
    const y = bottom ? field.y + field.h - 162 : field.y + 22;
    ctx.strokeRect(310, y, 460, 140);
    ctx.strokeRect(430, bottom ? field.y + field.h - 80 : field.y + 22, 220, 58);
  }
  text(LH.attackDirection, 540, field.y + 46, 20, '#b6cec0', 'center');
  // 골키퍼는 마지막에 그려 가까운 수비 카드에 OVR이 가려지지 않게 한다.
  const order = [...data.layout.keys()].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
  for (const i of order) {
    const position = data.layout[i];
    const cell = data.cells[i];
    if (!position || !cell) continue;
    const x = field.x + 24 + ((field.w - 48) * position.x) / 100 - 73;
    const y = field.y + 55 + ((field.h - 110) * position.y) / 100 - 89;
    ctx.save();
    ctx.translate(x, y);
    const legend = (cell.player?.legendScore ?? 0) >= 1000;
    const gold = (cell.player?.peak ?? cell.rating) >= 80;
    const ink = legend ? '#fce7b1' : cell.youth ? '#365342' : '#243339';
    const gradient = ctx.createLinearGradient(0, 0, 146, 178);
    gradient.addColorStop(
      0,
      legend ? '#51614b' : cell.youth ? '#eaf3e9' : gold ? '#fff2ce' : '#f8faf6',
    );
    gradient.addColorStop(
      1,
      legend ? '#101e17' : cell.youth ? '#9bae9b' : gold ? '#8a6324' : '#83989c',
    );
    ctx.fillStyle = gradient;
    ctx.fill(SHIELD);
    ctx.strokeStyle = legend || gold ? '#d1ac5f' : '#9fb3b6';
    ctx.lineWidth = 2;
    ctx.stroke(SHIELD);
    ctx.save();
    ctx.translate(51, 22);
    ctx.scale(0.78, 0.78);
    ctx.fillStyle = legend ? '#101e17' : '#73888b';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.fill(SHIRT);
    ctx.stroke(SHIRT);
    ctx.restore();
    text(String(cell.player?.peak ?? cell.rating), 13, 52, 43, ink, 'left', DISPLAY);
    text(position.slot, 13, 75, 20, ink, 'left', DISPLAY);
    text(
      String(cell.player?.number ?? (cell.youth ? '+' : cell.name.slice(0, 1))),
      90,
      72,
      31,
      ink,
      'center',
      DISPLAY,
    );
    const name = nameLines(ctx, cell.name, 126);
    const lineHeight = name.size + 2;
    const top = 122 - ((name.lines.length - 1) * lineHeight) / 2;
    name.lines.forEach((line, j) =>
      text(line, 73, top + j * lineHeight, name.size, ink, 'center', BODY, 126),
    );
    text(LH.posOvr({ n: cell.rating }), 73, 161, 17, ink, 'center');
    ctx.restore();
  }
  ctx.restore();

  const stats = [
    [LH.lineAtk, data.lines.atk],
    [LH.lineMid, data.lines.mid],
    [LH.lineDef, data.lines.def],
    [LH.lineGk, data.lines.gk],
  ] as const;
  stats.forEach(([label, value], i) => {
    const x = 180 + 240 * i;
    text(label, x - 18, 1221, 25, '#a9b8ae', 'right');
    text(String(Math.round(value)), x + 2, 1223, 42, '#eef4ef', 'left', DISPLAY);
  });
  text(L.cardFootWeb, 60, 1284, 22, '#a9b8ae');
  text('offside-lab.com', 1020, 1285, 32, '#f0b437', 'right', DISPLAY);
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: TeamLogo, image?: HTMLImageElement) {
  ctx.save();
  ctx.translate(60, 92);
  ctx.scale(80 / 64, 80 / 64);
  if (image) {
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 64, 8);
    ctx.clip();
    ctx.drawImage(image, 0, 0, 64, 64);
  } else {
    const path = new Path2D(CREST_SHAPES[logo.shape]);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = logo.bg;
    ctx.fillRect(0, 0, 64, 64);
    if (logo.pattern !== 'plain') {
      ctx.fillStyle = logo.fg;
      ctx.globalAlpha = 0.22;
      ctx.fill(new Path2D(CREST_PATTERNS[logo.pattern]));
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = logo.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${logo.text.length > 2 ? 17 : logo.text.length > 1 ? 22 : 28}px ${BODY}`;
    ctx.fillText(logo.text, 32, 33, 54);
    ctx.restore();
    ctx.strokeStyle = logo.fg;
    ctx.lineWidth = 2;
    ctx.stroke(path);
  }
  ctx.restore();
}
