import type { Translation } from '../core';
import type { BoardLabelMsgs } from '../ko/boardLabel';

export const boardLabel: Translation<BoardLabelMsgs> = {
  noticeLabel: 'Announcements',
  releaseLabel: 'Release notes',
  reportSpam: 'Spam or ads',
  reportAbuse: 'Abuse or insults',
  reportSexual: 'Sexual or offensive content',
  reportOther: 'Other',
  views: (p) => `${p.n} view${p.n === 1 ? '' : 's'}`,
  likes: (p) => `${p.n} like${p.n === 1 ? '' : 's'}`,
  commentCount: (p) => `${p.n} comment${p.n === 1 ? '' : 's'}`,
  edited: 'edited',
};
