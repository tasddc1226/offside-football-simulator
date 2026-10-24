// 은퇴한 내 선수의 SNS 공유용 한 장 이미지(웹 share/ShareImageCard.svelte, T-10-079). 누르면 카드(ShareCardView)를 화면
// 밖에 그려 react-native-view-shot으로 PNG를 찍고, 미리 보기와 함께 공유 시트(expo-sharing)로 보낸다 — 인스타·카톡 공유와
// 이미지 저장은 시트에서 고른다. T-11-439: 사진첩에 바로 저장하려면 새 네이티브 모듈(expo-media-library)이 필요해(1.1.2 OTA에
// 실을 수 없다) 같은 시트를 여는 버튼 둘 대신 '공유하거나 저장하기' 하나와 시트에서 저장하는 법을 적는다. 만든 뒤 대표 칭호·
// 결번이 바뀌면 낡은 이미지라고 알리고 '바뀐 내용 반영하기'를 주 버튼으로 둔다. 웹은 캔버스 1080×1350, 앱은 같은 카드를 0.5배로 줄여 그린 뷰를 찍어 1080×1350으로 뽑는다
// (기기 화소 비율만큼 큰 비트맵을 만들지 않으려고). 카드 내용은 위 은퇴 리포트와 같은 LegendView(v)에서 뽑는다 —
// 영구결번도 리포트처럼 이번 접속의 심사 결과를 먼저 본다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { retiredTitleOf } from '@offside/app-core/retiredTitle';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useSnapshot } from 'valtio';
import {
  CARD_H,
  CARD_W,
  shareCardData,
  shareCardKey,
  type ShareCardData,
} from '@offside/app-core/shareCard';
import type { LegendView } from '@offside/app-core/state';
import { toast } from '../../game/host';
import { pickedTitles, rnResults } from '../../store';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { ShareCardView } from './ShareCardView';
import { shareText as L } from '@offside/app-core/i18n/ko/share';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function ShareImageCard({ v }: { v: LegendView }) {
  const h = v.own!;
  const [shot, setShot] = useState<{ uri: string; key: string } | null>(null);
  // 대표 칭호·결번(이번 접속 값)이 바뀌면 다시 그린다 — 스냅숏을 읽어 구독한다.
  const rs = useSnapshot(rnResults);
  const pk = useSnapshot(pickedTitles);
  const rnNow = h.id && h.id in rs ? rs[h.id] : v.rn;
  const titleNow = retiredTitleOf(h.id ?? '', h.title, pk);
  // 결번은 rnOf(host)와 같은 규칙: 이번 접속에서 받은 값이 먼저, 없으면 저장된 값.
  const data = useMemo(
    () => shareCardData({ ...v, rn: rnNow as LegendView['rn'] }, titleNow),
    [v, rnNow, titleNow],
  );
  const stale = !!shot && shot.key !== shareCardKey(data);
  const [busy, setBusy] = useState(false);
  /** 찍는 동안만 화면 밖에 그리는 카드. */
  const [card, setCard] = useState<ShareCardData | null>(null);
  const cardRef = useRef<View>(null);
  const laidOut = useRef<(() => void) | null>(null);

  async function make() {
    if (busy) return;
    setBusy(true);
    try {
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
      setShot({ uri, key: shareCardKey(data) });
    } catch {
      toast(L.imageFailed);
    } finally {
      laidOut.current = null;
      setCard(null);
      setBusy(false);
    }
  }

  async function send() {
    if (!shot) return;
    try {
      if (!(await Sharing.isAvailableAsync())) return toast(L.imageCannotShare);
      await Sharing.shareAsync(shot.uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: L.imageShareDialog,
      });
    } catch {
      // 공유 시트를 닫은 건 실패가 아니다. 시트를 못 열었을 때만 안내한다.
      toast(L.imageShareFailed);
    }
  }

  return (
    <Card>
      <View testID="share-image">
        <Txt v="eyebrow">Share</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.imageTitle}
        </Txt>
      </View>
      {shot ? (
        <>
          <Image
            source={{ uri: shot.uri }}
            testID="share-image-preview"
            accessibilityLabel={L.imageAlt({ name: h.name })}
            style={{ width: '100%', aspectRatio: CARD_W / CARD_H, borderRadius: RADIUS.md }}
          />
          {stale ? (
            <>
              <Txt v="sm" testID="share-image-stale">
                {L.imageStale}
              </Txt>
              <Btn
                kind="primary"
                block
                testID="share-image-refresh"
                disabled={busy}
                onPress={() => void make()}
              >
                {busy ? L.imageMaking : L.imageRefresh}
              </Btn>
            </>
          ) : null}
          <Btn
            kind={stale ? undefined : 'primary'}
            block
            testID="share-image-send"
            onPress={() => void send()}
          >
            {L.imageShareOrSave}
          </Btn>
          <Txt v="xs" tone="muted">
            {L.imageSheetNote}
          </Txt>
          {stale ? null : (
            <Btn
              sm
              kind="ghost"
              block
              testID="share-image-remake"
              disabled={busy}
              onPress={() => void make()}
            >
              {busy ? L.imageMaking : L.imageRemake}
            </Btn>
          )}
        </>
      ) : (
        <>
          <Txt v="sm" tone="muted">
            {L.imageNote}
          </Txt>
          <Btn
            kind="primary"
            block
            testID="share-image-make"
            disabled={busy}
            onPress={() => void make()}
          >
            {busy ? L.imageMaking : L.imageMake}
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
