// 은퇴한 내 선수의 SNS 공유용 한 장 이미지(웹 share/ShareImageCard.svelte, T-10-079). 누르면 카드(ShareCardView)를 화면
// 밖에 그려 react-native-view-shot으로 PNG를 찍고, 미리 보기와 함께 공유 시트(expo-sharing)로 보낸다 — 인스타·카톡 공유와
// 이미지 저장은 시트에서 고른다. 웹은 캔버스 1080×1350, 앱은 같은 카드를 0.5배로 줄여 그린 뷰를 찍어 1080×1350으로 뽑는다
// (기기 화소 비율만큼 큰 비트맵을 만들지 않으려고). 카드 내용은 위 은퇴 리포트와 같은 LegendView(v)에서 뽑는다 —
// 영구결번도 리포트처럼 이번 접속의 심사 결과를 먼저 본다.
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { CARD_H, CARD_W, shareCardData, type ShareCardData } from '@offside/app-core/shareCard';
import type { LegendView } from '@offside/app-core/state';
import { rnOf, toast } from '../../game/host';
import { legendTitleOf } from '../../store';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { ShareCardView } from './ShareCardView';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function ShareImageCard({ v }: { v: LegendView }) {
  const h = v.own!;
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 찍는 동안만 화면 밖에 그리는 카드. */
  const [card, setCard] = useState<ShareCardData | null>(null);
  const cardRef = useRef<View>(null);
  const laidOut = useRef<(() => void) | null>(null);

  async function make() {
    if (busy) return;
    setBusy(true);
    try {
      const data = shareCardData({ ...v, rn: rnOf(h.id!, v.rn) }, legendTitleOf(h.id, h.title));
      const ready = new Promise<void>((r) => (laidOut.current = r));
      setCard(data);
      await Promise.race([ready, new Promise<void>((r) => setTimeout(r, 3000))]);
      // 레이아웃이 끝난 뒤 두 프레임 더 — 글꼴·엠블럼이 그려질 때까지.
      await frame();
      await frame();
      const uri = await captureRef(cardRef, {
        format: 'png',
        result: 'tmpfile',
        width: CARD_W,
        height: CARD_H,
      });
      setShot(uri);
    } catch {
      toast('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      laidOut.current = null;
      setCard(null);
      setBusy(false);
    }
  }

  async function send(dialogTitle: string) {
    if (!shot) return;
    try {
      if (!(await Sharing.isAvailableAsync()))
        return toast('이 기기에서는 이미지를 공유할 수 없어요.');
      await Sharing.shareAsync(shot, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    } catch {
      // 공유 시트를 닫은 건 실패가 아니다. 시트를 못 열었을 때만 안내한다.
      toast('공유 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <Card>
      <View testID="share-image">
        <Txt v="eyebrow">Share</Txt>
        <Txt v="h2" accessibilityRole="header">
          SNS 공유 이미지
        </Txt>
      </View>
      {shot ? (
        <>
          <Image
            source={{ uri: shot }}
            testID="share-image-preview"
            accessibilityLabel={`${h.name} 커리어 공유 이미지`}
            style={{ width: '100%', aspectRatio: CARD_W / CARD_H, borderRadius: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn
              style={{ flex: 1 }}
              testID="share-image-save"
              onPress={() => void send('이미지 저장')}
            >
              이미지 저장
            </Btn>
            <Btn
              kind="primary"
              style={{ flex: 1 }}
              testID="share-image-send"
              onPress={() => void send('커리어 카드 공유')}
            >
              바로 공유하기
            </Btn>
          </View>
          {/* 대표 칭호를 바꾼 뒤 다시 그릴 때. */}
          <Btn
            sm
            kind="ghost"
            block
            testID="share-image-remake"
            disabled={busy}
            onPress={() => void make()}
          >
            {busy ? '만드는 중…' : '다시 만들기'}
          </Btn>
        </>
      ) : (
        <>
          <Txt v="sm" tone="muted">
            인스타그램·카카오톡에 바로 올릴 수 있는 한 장짜리 커리어 카드를 만들어요.
          </Txt>
          <Btn
            kind="primary"
            block
            testID="share-image-make"
            disabled={busy}
            onPress={() => void make()}
          >
            {busy ? '만드는 중…' : '공유 이미지 만들기'}
          </Btn>
        </>
      )}
      {card ? (
        // 화면 밖에서 찍는다: 1080×1350 도안을 0.5배로 줄인 540×675 상자를 통째로 캡처한다.
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: -10000, top: 0 }}
        >
          <View
            ref={cardRef}
            collapsable={false}
            onLayout={() => laidOut.current?.()}
            style={{ width: CARD_W / 2, height: CARD_H / 2, overflow: 'hidden' }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: CARD_W,
                height: CARD_H,
                transformOrigin: 'top left',
                transform: [{ scale: 0.5 }],
              }}
            >
              <ShareCardView c={card} />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
