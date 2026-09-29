// 아직 앱으로 옮기지 않은 시트 본문 자리(T-11-005 작업 중에만 쓴다).
import { useSnapshot } from 'valtio';
import { sheetLabel, type SheetView } from '@offside/app-core/sheets';
import { Txt } from '../ui/Txt';

export function Pending({ v }: { v: SheetView }) {
  const s = useSnapshot(v);
  return (
    <>
      <Txt v="eyebrow">{s.kind}</Txt>
      <Txt v="h2">{sheetLabel(v)}</Txt>
    </>
  );
}
