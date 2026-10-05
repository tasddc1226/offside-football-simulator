// 영어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 영어 사용자에게만 불러온다(웹은 지연 청크).
// 직접 고치지 않는다: node tooling/scripts/i18n-index.mjs
import { events } from './_events';
import { names } from './_names';
import { gAttrLabel } from './gAttrLabel';
import { gBoost } from './gBoost';
import { gComps } from './gComps';
import { gData } from './gData';
import { gDex } from './gDex';
import { gDexGroups } from './gDexGroups';
import { gFanfeed } from './gFanfeed';
import { gGkLabel } from './gGkLabel';
import { gLegend } from './gLegend';
import { gMilitary } from './gMilitary';
import { gMinigame } from './gMinigame';
import { gNational } from './gNational';
import { gPlayStyle } from './gPlayStyle';
import { gRarity } from './gRarity';
import { gRecords } from './gRecords';
import { gRoleName } from './gRoleName';
import { gSeason } from './gSeason';
import { gStats } from './gStats';
import { gSubs } from './gSubs';
import { gTitles } from './gTitles';
import { gTraining } from './gTraining';
import { gTurn } from './gTurn';

export const en = {
  __events: events,
  __names: names,
  gAttrLabel,
  gBoost,
  gComps,
  gData,
  gDex,
  gDexGroups,
  gFanfeed,
  gGkLabel,
  gLegend,
  gMilitary,
  gMinigame,
  gNational,
  gPlayStyle,
  gRarity,
  gRecords,
  gRoleName,
  gSeason,
  gStats,
  gSubs,
  gTitles,
  gTraining,
  gTurn,
};
