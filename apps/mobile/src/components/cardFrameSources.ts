// T-11-753 카드 틀 그림(packages/app-core/assets/card-frame, Blender 렌더). 등급마다 위 · 가운데 · 아래 세 조각이다(웹 cardFrameSources.ts).
/* eslint-disable @typescript-eslint/no-require-imports */
// Metro는 require 경로가 글자 그대로여야 해서 경로를 풀어 쓴다.
type Frame = { top: number; mid: number; bot: number };

const FRAMES: Record<string, Frame> = {
  icon: {
    top: require('../../../../packages/app-core/assets/card-frame/icon-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/icon-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/icon-bot.webp'),
  },
  legend: {
    top: require('../../../../packages/app-core/assets/card-frame/legend-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/legend-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/legend-bot.webp'),
  },
  elite: {
    top: require('../../../../packages/app-core/assets/card-frame/elite-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/elite-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/elite-bot.webp'),
  },
  gold: {
    top: require('../../../../packages/app-core/assets/card-frame/gold-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/gold-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/gold-bot.webp'),
  },
  silver: {
    top: require('../../../../packages/app-core/assets/card-frame/silver-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/silver-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/silver-bot.webp'),
  },
  bronze: {
    top: require('../../../../packages/app-core/assets/card-frame/bronze-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/bronze-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/bronze-bot.webp'),
  },
  youth: {
    top: require('../../../../packages/app-core/assets/card-frame/youth-top.webp'),
    mid: require('../../../../packages/app-core/assets/card-frame/youth-mid.webp'),
    bot: require('../../../../packages/app-core/assets/card-frame/youth-bot.webp'),
  },
};

/** 그 등급 틀. 모르는 등급이면 골드 틀. */
export const cardFrame = (tier: string): Frame => FRAMES[tier] ?? FRAMES.gold!;
