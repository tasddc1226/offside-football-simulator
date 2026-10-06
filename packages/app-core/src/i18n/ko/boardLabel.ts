// board 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  noticeLabel: '공지사항',
  releaseLabel: '릴리즈 노트',
  reportSpam: '스팸·광고',
  reportAbuse: '욕설·비방',
  reportSexual: '음란·불쾌한 내용',
  reportOther: '기타',
  views: (p: { n: number }) => `조회 ${p.n}`,
  likes: (p: { n: number }) => `좋아요 ${p.n}`,
  commentCount: (p: { n: number }) => `댓글 ${p.n}`,
  edited: '수정됨',
  monthDayHour: (p: { month: number; day: number; hour: number; minute: number }) =>
    `${p.month}월 ${p.day}일 ${p.hour}시${p.minute ? ` ${p.minute}분` : ''}`,
};

export type BoardLabelMsgs = typeof ko;
export const boardLabelText = ns('boardLabel', ko);
