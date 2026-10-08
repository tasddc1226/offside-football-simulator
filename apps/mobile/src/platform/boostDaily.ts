// T-11-157 잠재력 강화의 하루 횟수 중 광고(광고 제거 구매자의 바로 받기 포함)로 받은 몫을 이 기기에 센다(규칙은 app-core
// boost-daily). 구단 자금 몫은 서버가 센다.
import { adBoostsToday, spendAdBoost } from '@offside/app-core/boost-daily';
import { kv } from './setup';

const KEY = 'offside_boost_ad';

/** 저장된 값 그대로(boostDayLeft에 넘긴다). */
export const adBoostRaw = () => kv.getString(KEY);
/** 오늘 광고로 받은 강화 횟수. */
export const adBoostsUsed = () => adBoostsToday(adBoostRaw());
/** 광고로 한 번 받았다. */
export const markAdBoost = () => kv.set(KEY, spendAdBoost(adBoostRaw()));
