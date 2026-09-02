// SCR-029 커리어 대시보드 자리표시. 이 작업은 PlayerHeader와 "허브로"만 채운다(전체 구현은 T-1-009).
import { buttonClassName, buttonStyle, PlayerHeader } from '@offside/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCareer } from '../engine/use-career.js';
import { POSITION_LABELS } from '../shared/labels.js';

export const Route = createFileRoute('/career/$careerId/')({
  component: CareerDashboardPlaceholder,
});

function CareerDashboardPlaceholder() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);

  if (query.data === undefined) {
    // 부모 레이아웃의 loader가 이미 데이터를 캐시에 채웠다. RESOLVED가 아닌 순간은 사실상 없다.
    return null;
  }

  const { state } = query.data;
  const profile = state.player.profile;
  const draft = state.player.draft;
  const name = profile?.name ?? draft.name ?? '이름 없는 선수';
  const position = profile?.position ?? draft.position;

  return (
    <div className="flex flex-col gap-os-6">
      <PlayerHeader
        name={name}
        team={state.contract?.teamName ?? '무소속'}
        position={{ label: '포지션', value: position ? POSITION_LABELS[position] : '—' }}
        archetype={{ label: '아키타입', value: profile?.archetypeId ?? '—' }}
        shirtNumber={{ label: '등번호', value: state.contract ? String(state.contract.shirtNumber) : '—' }}
      />
      <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
        허브로
      </Link>
    </div>
  );
}
