// 아직 앱으로 옮기지 않은 화면 자리(T-11-005 작업 중에만 쓴다).
import { goHome } from '../game/nav';
import { BackBar } from './ActionBar';
import { Card } from './Card';
import { Screen } from './Screen';
import { Topbar } from './Topbar';
import { Txt } from './Txt';

export function Placeholder({ title }: { title: string }) {
  return (
    <Screen footer={<BackBar fallback={goHome} />}>
      <Topbar />
      <Card>
        <Txt v="h1">{title}</Txt>
        <Txt tone="muted">준비 중인 화면이에요.</Txt>
      </Card>
    </Screen>
  );
}
