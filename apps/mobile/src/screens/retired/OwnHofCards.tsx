// 내 은퇴 선수(서버에 올라간 기록) 아래의 SNS 공유 이미지(T-10-079)·대표 칭호·이름 공개·로그인 카드(웹 OwnHofCards.svelte;
// 공유 버튼은 화면 아래 ShareBar, T-10-067). T-10-032: 짧은 커리어는 전체 명예의 전당과 공유 링크에 오르지 않으므로(서버도 같은
// 기준으로 거른다) 두 카드 대신 안내만 한다.
import { isHofEligible, SHORT_CAREER_NOTE } from '@offside/contracts/hof-rules';
import type { LegendView } from '@offside/app-core/state';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { View } from 'react-native';
import { KeepLoginCard } from './KeepLoginCard';
import { PublishCard } from './PublishCard';
import { ShareImageCard } from './ShareImageCard';
import { TitlePickCard } from './TitlePickCard';

// 은퇴 리포트와 같은 v를 받는다(공유 이미지가 리포트와 같은 값을 그리게). v.own이 있을 때만 그린다.
export function OwnHofCards({ v }: { v: LegendView }) {
  const h = v.own;
  if (!h) return null;
  return (
    <>
      <ShareImageCard v={v} />
      <TitlePickCard h={h} />
      {isHofEligible(h.age) ? (
        <>
          <PublishCard key={h.id} h={h} />
          <KeepLoginCard id={h.id!} />
        </>
      ) : (
        <Card>
          <View>
            <Txt v="eyebrow">Hall of Fame</Txt>
            <Txt v="h2" accessibilityRole="header">
              내 선수에만 남는 기록
            </Txt>
          </View>
          <Txt v="sm" tone="muted">
            {SHORT_CAREER_NOTE}
          </Txt>
        </Card>
      )}
    </>
  );
}
