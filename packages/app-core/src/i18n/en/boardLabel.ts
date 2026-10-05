import type { Translation } from '../core';
import type { BoardLabelMsgs } from '../ko/boardLabel';
import { plural } from './_util';

export const boardLabel: Translation<BoardLabelMsgs> = {
  noticeLabel: 'Announcements',
  releaseLabel: 'Release notes',
  reportSpam: 'Spam or ads',
  reportAbuse: 'Abuse or insults',
  reportSexual: 'Sexual or offensive content',
  reportOther: 'Other',
  views: (p) => `${plural(p.n, 'view')}`,
  likes: (p) => `${plural(p.n, 'like')}`,
  commentCount: (p) => `${plural(p.n, 'comment')}`,
  edited: 'edited',
};
