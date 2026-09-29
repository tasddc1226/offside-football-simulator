// 시트 본문 고르기(웹 sheets/SheetBody.svelte + PlaySheets.svelte). 종류마다 한 컴포넌트.
// T-11-005 아직 옮기지 않은 종류는 Pending이 눈썹·제목만 보인다(버튼은 Sheet가 그대로 그려 게임은 진행된다).
import type { SheetView } from '@offside/app-core/sheets';
import { Notice } from './Notice';
import { Pending } from './Pending';

export function SheetBody({ v }: { v: SheetView }) {
  switch (v.kind) {
    case 'notice':
      return <Notice v={v} />;
    default:
      return <Pending v={v} />;
  }
}
