// T-11-729 에디트 파일 가져오기 안내(app-core editFile.ts · 웹 ClubCustomSettings · CustomNamesSettings · 앱 settings 두 화면).
import { ns } from '../core';

const ko = {
  empty: '붙여넣은 내용이 없어요.',
  link: '링크가 아니라 파일 안의 내용을 넣어야 해요. 파일을 열어 내용 전체를 복사해 주세요.',
  cut: '파일 내용이 중간에 잘렸어요. 처음 { 부터 마지막 } 까지 전체를 복사해 주세요.',
  notFile:
    '게임에서 내보낸 에디트 파일 내용이 아니에요. 내보낸 파일을 열어 내용 전체를 복사해 주세요.',
  wrongNames:
    '대회 · 수상 · 리그 이름 파일이에요. 설정의 대회·수상 이름 · 로고 바꾸기에서 가져와 주세요.',
  wrongClubs: '구단 이름 · 엠블럼 파일이에요. 설정의 구단 이름·엠블럼 변경에서 가져와 주세요.',
  pasteHint:
    '내보낸 에디트 파일을 열어 내용 전체를 복사한 뒤 붙여넣어요. 파일 이름이나 링크로는 가져올 수 없어요.',
};

export type EditFileMsgs = typeof ko;
export const editFileText = ns('editFile', ko);
