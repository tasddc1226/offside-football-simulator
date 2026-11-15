// T-11-729 에디트 파일 읽기 실패 안내(설정 화면에서만 읽는다. 첫 화면 청크에 문구가 실리지 않게 editFile.ts와 나눴다).
import type { EditFileError, EditFileKind } from './editFile.js';
import { editFileText as L } from './i18n/ko/editFile.js';

/** 읽기 실패 안내. 다른 종류의 파일이면 어느 설정에서 가져오는지 알려 준다. */
export const editFileErrorText = (reason: EditFileError, kind: EditFileKind): string =>
  reason === 'wrongKind' ? (kind === 'clubs' ? L.wrongNames : L.wrongClubs) : L[reason];
