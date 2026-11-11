// T-11-648 감독 커리어 3 엔진 묶음(@offside/game/manager3). 기획: docs/tracking/manager-career-plan-v3.md
export * from './manager3/rules.js';
export type * from './manager3/types.js';
export {
  attrCap,
  avgAttr,
  baseAttrs,
  playerValue,
  wageFor,
  leagueOf as m3League,
  M3_LEAGUES as M3_LEAGUE_TIERS,
} from './manager3/people.js';
export {
  autoLineup,
  lineupLines,
  rankOf,
  roleGap,
  slotRating,
  sortTable,
  tacticLines,
} from './manager3/match.js';
export {
  answerBid,
  listPlayer,
  releasePlayer,
  renewPlayer,
  renewWage,
  renewalEventWage,
  starterAvg,
  wageBill,
  type BidResult,
} from './manager3/market.js';
export {
  acceptOffer,
  answerEvent,
  boardMinimum,
  canRetire,
  closeWindow,
  continueBlock,
  continueReview,
  eventChoices,
  expectedRank,
  isDone,
  newManager3,
  playBlock,
  restSeason,
  retire,
  setPlan,
  signTarget,
  spendPoint,
  startSeason,
  stayAtClub,
  talkEffect,
  targetOptions,
  withRng,
} from './manager3/season.js';
export {
  bestSeason3,
  ending3,
  grade3,
  managerResult3,
  mastery3,
  migrateManager3Save,
  previewManager3,
  specialScores3,
  specials3,
  type Manager3Result,
} from './manager3/result.js';
export { squadDisplayName, squadName } from './manager3/names.js';
export * from './manager3/stories.js';
