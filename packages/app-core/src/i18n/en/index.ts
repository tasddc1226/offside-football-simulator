// 영어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 영어 사용자에게만 불러온다(웹은 지연 청크).
// 직접 고치지 않는다: node tooling/scripts/i18n-index.mjs
import { en as game } from '@offside/game/i18n/en/index';
import { account } from './account';
import { ad } from './ad';
import { backup } from './backup';
import { board } from './board';
import { boardLabel } from './boardLabel';
import { chat } from './chat';
import { chatReject } from './chatReject';
import { club } from './club';
import { clubSync } from './clubSync';
import { create } from './create';
import { dex } from './dex';
import { firsts } from './firsts';
import { firstsTab } from './firstsTab';
import { friend } from './friend';
import { game } from './game';
import { gameActions } from './gameActions';
import { gameAttr } from './gameAttr';
import { gameBoost } from './gameBoost';
import { gameCareer } from './gameCareer';
import { gameLeague } from './gameLeague';
import { gameMySeason } from './gameMySeason';
import { gamePlayer } from './gamePlayer';
import { gamePotential } from './gamePotential';
import { gamePotentialNote } from './gamePotentialNote';
import { gameReport } from './gameReport';
import { gameSeason } from './gameSeason';
import { gameTrophy } from './gameTrophy';
import { hof } from './hof';
import { hofOwn } from './hofOwn';
import { hofRn } from './hofRn';
import { home } from './home';
import { homeLive } from './homeLive';
import { homeMore } from './homeMore';
import { inbox } from './inbox';
import { legend } from './legend';
import { legendRn } from './legendRn';
import { legendStyle } from './legendStyle';
import { legendToast } from './legendToast';
import { market } from './market';
import { marketChart } from './marketChart';
import { marketValueChart } from './marketValueChart';
import { owner } from './owner';
import { ownerConflict } from './ownerConflict';
import { ownerPlayers } from './ownerPlayers';
import { push } from './push';
import { retired } from './retired';
import { settings } from './settings';
import { settingsApi } from './settingsApi';
import { share } from './share';
import { sheetAchieve } from './sheetAchieve';
import { sheetContract } from './sheetContract';
import { sheetCore } from './sheetCore';
import { sheetMinigame } from './sheetMinigame';
import { sheetPlay } from './sheetPlay';
import { shell } from './shell';
import { shellInstall } from './shellInstall';
import { shellInstallGuide } from './shellInstallGuide';
import { shellLogin } from './shellLogin';
import { shellMore } from './shellMore';
import { teamAch } from './teamAch';
import { teamCore } from './teamCore';
import { teamHome } from './teamHome';
import { teamLive } from './teamLive';
import { teamMatch } from './teamMatch';
import { title } from './title';
import { titleTag } from './titleTag';

export const en = {
  ...game,
  account,
  ad,
  backup,
  board,
  boardLabel,
  chat,
  chatReject,
  club,
  clubSync,
  create,
  dex,
  firsts,
  firstsTab,
  friend,
  game,
  gameActions,
  gameAttr,
  gameBoost,
  gameCareer,
  gameLeague,
  gameMySeason,
  gamePlayer,
  gamePotential,
  gamePotentialNote,
  gameReport,
  gameSeason,
  gameTrophy,
  hof,
  hofOwn,
  hofRn,
  home,
  homeLive,
  homeMore,
  inbox,
  legend,
  legendRn,
  legendStyle,
  legendToast,
  market,
  marketChart,
  marketValueChart,
  owner,
  ownerConflict,
  ownerPlayers,
  push,
  retired,
  settings,
  settingsApi,
  share,
  sheetAchieve,
  sheetContract,
  sheetCore,
  sheetMinigame,
  sheetPlay,
  shell,
  shellInstall,
  shellInstallGuide,
  shellLogin,
  shellMore,
  teamAch,
  teamCore,
  teamHome,
  teamLive,
  teamMatch,
  title,
  titleTag,
};
