import type { Translation } from '@offside/contracts/i18n';
import type { gDatingText } from '../ko/gDating';
export const gDating: Translation<typeof gDatingText> = {
  title: 'ピッチ外の交際報道',
  text: '一緒に食事する写真が広まりました。記者が私生活とプレーについて質問します。',
  privateLabel: '私生活は公表しないと答える',
  privateResult: '短く答えて取材を終えました。次の質問は週末の試合に移りました。',
  confirmLabel: '相手と相談して交際を認める',
  confirmResult: '二人でコメントを出しました。次の練習場前には報道陣が増えました。',
  pitchLabel: 'ピッチで答えると話す',
  pitchResult: '取材を切り上げて練習場に戻りました。コーチが個人練習を担当しました。',
};
