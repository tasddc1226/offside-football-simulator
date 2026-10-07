import type { Translation } from '../core';
import type { BoardLabelMsgs } from '../ko/boardLabel';

// 시각은 한국 시간(KST)이며 일본 시간과 같다.
export const boardLabel: Translation<BoardLabelMsgs> = {
  noticeLabel: 'お知らせ',
  releaseLabel: 'アップデート情報',
  reportSpam: 'スパム・宣伝',
  reportAbuse: '暴言・誹謗中傷',
  reportSexual: 'わいせつ・不快な内容',
  reportOther: 'その他',
  views: (p) => `閲覧 ${p.n}`,
  likes: (p) => `いいね ${p.n}`,
  commentCount: (p) => `コメント ${p.n}`,
  edited: '編集済み',
  monthDayHour: (p) => `${p.month}月${p.day}日 ${p.hour}時${p.minute ? `${p.minute}分` : ''}`,
};
