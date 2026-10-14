// 일본어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 일본어 사용자에게만 불러온다(웹은 지연 청크).
// 직접 고치지 않는다: node tooling/scripts/i18n-index.mjs
import { events } from './_events';
import { names } from './_names';
import { roman } from './_roman';
import { gAttrLabel } from './gAttrLabel';
import { gBoost } from './gBoost';
import { gComps } from './gComps';
import { gData } from './gData';
import { gDating } from './gDating';
import { gDex } from './gDex';
import { gDexGroups } from './gDexGroups';
import { gFanfeed } from './gFanfeed';
import { gGkLabel } from './gGkLabel';
import { gLegend } from './gLegend';
import { gLife } from './gLife';
import { gMilitary } from './gMilitary';
import { gMinigame } from './gMinigame';
import { gNational } from './gNational';
import { gPeek } from './gPeek';
import { gPlayStyle } from './gPlayStyle';
import { gRarity } from './gRarity';
import { gRecords } from './gRecords';
import { gRival } from './gRival';
import { gRoleName } from './gRoleName';
import { gSeason } from './gSeason';
import { gStats } from './gStats';
import { gSubs } from './gSubs';
import { gTitles } from './gTitles';
import { gTraining } from './gTraining';
import { gTurn } from './gTurn';

export const ja = {
  __events: events,
  __names: names,
  __roman: roman,
  gAttrLabel,
  gBoost,
  gComps,
  gData,
  gDating,
  gDex,
  gDexGroups,
  gFanfeed,
  gGkLabel,
  gLegend,
  gLife,
  gMilitary,
  gMinigame,
  gNational,
  gPeek,
  gPlayStyle,
  gRarity,
  gRecords,
  gRival,
  gRoleName,
  gSeason,
  gStats,
  gSubs,
  gTitles,
  gTraining,
  gTurn,
};
