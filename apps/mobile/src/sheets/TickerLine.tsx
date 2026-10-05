// 경기 한 줄(라운드·승무패·상대·스코어·내 기록, 웹 sheets/TickerLine.svelte). 경기 중계 시트와 구간 리포트의
// 경기별 기록이 함께 쓴다. muted: 중계에서 지난 줄은 옅게(웹 .ticker.live div:not(:first-child)), bold: 최신 줄.
import { Text, View } from 'react-native';
import { RES_LABEL, type TickerRow } from '@offside/app-core/sheets';
import { sheetCoreText } from '@offside/app-core/i18n/ko/sheetCore';
import { useColors } from '../theme/useColors';
import { DISPLAY, rem } from '../theme/type';
import { Txt } from '../ui/Txt';

export function ResBadge({ res, size = 'sm' }: { res: 'W' | 'D' | 'L'; size?: 'sm' | 'dot' }) {
  const c = useColors();
  const bg = res === 'W' ? c.good : res === 'D' ? c.muted : c.bad;
  const dot = size === 'dot';
  // 글자색을 surface로 두면 라이트(흰 글자)·다크(짙은 글자) 모두 배경색 대비 4.5:1 이상이다.
  return (
    <View
      style={{
        width: dot ? 26 : 24,
        height: dot ? 26 : 20,
        borderRadius: dot ? 13 : 5,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c.surface, fontSize: rem(0.6875), fontWeight: '700' }}>
        {RES_LABEL[res]}
      </Text>
    </View>
  );
}

export function TickerLine({
  m,
  muted = false,
  bold = false,
}: {
  m: TickerRow;
  muted?: boolean;
  bold?: boolean;
}) {
  const c = useColors();
  const fg = muted ? c.muted : c.ink;
  const w = bold ? '600' : '400';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt tone="muted" style={{ width: 34, fontFamily: DISPLAY[600], fontSize: rem(0.8125) }}>
        {`${m.rd}R`}
      </Txt>
      <View style={{ width: 30 }}>
        <ResBadge res={m.res} />
      </View>
      <Txt
        style={{
          flex: 1,
          fontSize: rem(0.8125),
          lineHeight: rem(0.8125) * 1.5,
          color: fg,
          fontWeight: w,
        }}
      >
        {`${m.opp} ${m.score} `}
        <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: w }}>
          {'· '}
          {m.mins ? (
            <>
              {sheetCoreText.tickerMins({ n: m.mins })}
              {m.g ? (
                <>
                  {' · '}
                  <Txt style={{ fontSize: rem(0.8125), fontWeight: '700', color: fg }}>
                    {sheetCoreText.tickerGoals({ n: m.g })}
                  </Txt>
                </>
              ) : null}
              {m.a ? ` · ${sheetCoreText.tickerAssists({ n: m.a })}` : ''}
              {` · ${m.rating}`}
            </>
          ) : m.inj ? (
            sheetCoreText.tickerInjured
          ) : (
            sheetCoreText.tickerNone
          )}
        </Txt>
      </Txt>
    </View>
  );
}
