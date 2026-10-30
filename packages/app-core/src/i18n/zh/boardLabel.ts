import type { Translation } from '../core';
import type { BoardLabelMsgs } from '../ko/boardLabel';

// Times are Korea Standard Time (KST).
export const boardLabel: Translation<BoardLabelMsgs> = {
  noticeLabel: '公告',
  releaseLabel: '更新說明',
  reportSpam: '垃圾訊息・廣告',
  reportAbuse: '辱罵・誹謗',
  reportSexual: '色情・令人不適的內容',
  reportOther: '其他',
  views: (p) => `瀏覽 ${p.n}`,
  likes: (p) => `讚 ${p.n}`,
  commentCount: (p) => `留言 ${p.n}`,
  edited: '已編輯',
  monthDayHour: (p) => `${p.month}月${p.day}日 ${p.hour}時${p.minute ? `${p.minute}分` : ''}`,
};
