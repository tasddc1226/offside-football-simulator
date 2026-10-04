// 구간 리포트·시즌 결산의 '새 칭호' 줄(웹 titles/NewTitles.svelte). pop이면 칭호가 90ms 간격으로 튀어 오른다
// (delay: 구간 리포트가 앞 요소가 나온 뒤로 늦춰 준다).
import { View } from 'react-native';
import type { TitleView } from '@offside/game/titles';
import { TitleTag } from '../../components/TitleTag';
import { Txt } from '../../ui/Txt';

export function NewTitles({
  titles,
  pop = false,
  delay = 0,
}: {
  titles: readonly TitleView[];
  pop?: boolean;
  delay?: number;
}) {
  if (!titles.length) return null;
  return (
    <View testID="new-titles">
      <Txt v="eyebrow" style={{ marginBottom: 6 }}>
        새 칭호
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {titles.map((x, i) => (
          <TitleTag key={x.id} name={x.name} rarity={x.rarity} pop={pop} d={delay + i * 90} />
        ))}
      </View>
    </View>
  );
}
