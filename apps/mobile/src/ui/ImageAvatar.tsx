import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Image as NativeImage, Platform, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, {
  G,
  Rect,
  Image,
  Defs,
  ClipPath,
  Mask,
  SvgXml,
  Filter,
  FeColorMatrix,
  FeComposite,
} from 'react-native-svg';
import { avatarImagePlan, IMAGE_SHEETS, type AvatarImagePlan } from '@offside/game/avatar-image';
import type { AvatarSpec } from '@offside/game/avatar';
import { avatarImageSource } from './avatarImageSources';
import { useBakedAvatar } from './avatarBake';

/**
 * T-11-270 선수 그림은 한 번 구워 둔 PNG로 보여 준다.
 * 층 20~30개를 react-native-svg 색 필터로 겹쳐 그리면 스크롤 · 다시 그리기마다 필터를 다시 계산해 화면이 1~2초씩 멈췄다.
 * 그림 계획이 같으면 같은 그림이라, 화면 밖 굽는 곳(AvatarBaker)이 한 번 찍은 파일을 모든 화면이 같이 쓴다.
 * 굽기에 실패하면 예전처럼 층을 직접 그린다.
 */
export const ImageAvatar = memo(function ImageAvatar({
  spec,
  width,
  portrait = false,
  onReady,
}: {
  spec: AvatarSpec;
  width: number | string;
  portrait?: boolean;
  onReady?: ((ready: boolean) => void) | undefined;
}) {
  const plan = useMemo(() => avatarImagePlan(spec, portrait), [spec, portrait]);
  const baked = useBakedAvatar(plan);
  useEffect(() => {
    if (!baked.failed) onReady?.(!!baked.uri);
  }, [baked.uri, baked.failed, onReady]);
  if (baked.failed) return <AvatarLayers plan={plan} width={width} onReady={onReady} />;
  const size =
    typeof width === 'number'
      ? { width, height: (width / plan.width) * plan.height }
      : { width: '100%' as const, height: '100%' as const };
  if (!baked.uri) return <View style={size} />;
  return (
    <ExpoImage
      source={{ uri: baked.uri }}
      style={size}
      contentFit="contain"
      contentPosition="bottom"
      cachePolicy="memory"
      transition={0}
      accessible={false}
    />
  );
});

/** 층을 react-native-svg로 직접 겹쳐 그린다. 굽는 곳과 굽기 실패 때만 쓴다. */
export const AvatarLayers = memo(function AvatarLayers({
  plan,
  width,
  onReady,
}: {
  plan: AvatarImagePlan;
  width: number | string;
  onReady?: ((ready: boolean) => void) | undefined;
}) {
  const id = useId().replace(/:/g, '');
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const markLoaded = useCallback(
    (source: string) => setLoaded((old) => (old.has(source) ? old : new Set([...old, source]))),
    [],
  );
  const wanted = [...new Set(plan.layers.map((l) => l.source))];
  const sources = wanted.join('|');
  const complete = wanted.every((s) => loaded.has(s));
  useEffect(
    () => onReady?.(sources.split('|').every((s) => loaded.has(s))),
    [sources, loaded, onReady],
  );
  // 안드로이드 react-native-svg의 <Image>는 onLoad를 부르지 않고, 그림을 받기 전에 필터를 그리면 그 뒤 레이어까지 빠진다.
  // 같은 그림을 숨긴 RN Image로 먼저 받아(같은 Fresco 캐시) 다 받은 뒤에 레이어를 그린다.
  return (
    <>
      {wanted.map((source) => (
        <NativeImage
          key={source}
          source={avatarImageSource(source)}
          style={styles.probe}
          resizeMethod="scale"
          onLoad={() => markLoaded(source)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ))}
      <Svg
        width={width}
        height={typeof width === 'number' ? (width / plan.width) * plan.height : '100%'}
        viewBox={`0 0 ${plan.width} ${plan.height}`}
        preserveAspectRatio="xMidYMax meet"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <ClipPath id={`${id}-outer`}>
            <Rect width={plan.width} height={plan.height} />
          </ClipPath>
        </Defs>
        {complete && (
          <G clipPath={`url(#${id}-outer)`}>
            {plan.layers.map((layer, i) => {
              const sheet = IMAGE_SHEETS[layer.source]!,
                [x, y, w, h] = layer.crop,
                // 안드로이드 react-native-svg는 같은 id의 자르기 · 마스크 · 필터 정의가 바뀌어도 처음 것을 계속 써서,
                // 프레임이 바뀌면 몸이 예전 프레임 자리로 잘려 사라진다. 그림 칸마다 id를 따로 둔다.
                k = `${i}-${layer.source}-${Math.round(x)}-${Math.round(y)}`;
              return (
                <G key={k}>
                  <Defs>
                    <ClipPath id={`${id}-crop-${k}`}>
                      <Rect x={x} y={y} width={w} height={h} />
                    </ClipPath>
                    {!!layer.filters.length && (
                      <Filter id={`${id}-colour-${k}`} {...filterRegion(x, y, w, h)}>
                        {layer.filters.map((op) =>
                          op.kind === 'matrix' ? (
                            <FeColorMatrix
                              key={op.result}
                              in={op.input}
                              result={op.result}
                              type="matrix"
                              values={op.values}
                            />
                          ) : (
                            <FeComposite
                              key={op.result}
                              in={op.input}
                              in2={op.input2}
                              operator={op.operator}
                              {...(op.operator === 'arithmetic' ? { k2: 1, k3: 1 } : {})}
                              result={op.result}
                            />
                          ),
                        )}
                      </Filter>
                    )}
                    {layer.pattern && (
                      <>
                        <Filter id={`${id}-fabric-${k}`} {...filterRegion(x, y, w, h)}>
                          <FeColorMatrix type="matrix" values={layer.pattern.mask} />
                        </Filter>
                        <Mask
                          id={`${id}-fabric-mask-${k}`}
                          maskUnits="userSpaceOnUse"
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                        >
                          <Image
                            href={avatarImageSource(layer.source)}
                            width={sheet.width}
                            height={sheet.height}
                            filter={`url(#${id}-fabric-${k})`}
                          />
                        </Mask>
                      </>
                    )}
                  </Defs>
                  <G
                    transform={`translate(${layer.x} ${layer.y}) scale(${layer.scale}) translate(${-x} ${-y})`}
                  >
                    <G clipPath={`url(#${id}-crop-${k})`}>
                      <Image
                        href={avatarImageSource(layer.source)}
                        width={sheet.width}
                        height={sheet.height}
                        {...(layer.filters.length ? { filter: `url(#${id}-colour-${k})` } : {})}
                      />
                      {layer.pattern && (
                        <G mask={`url(#${id}-fabric-mask-${k})`} opacity={0.78}>
                          {layer.pattern.rects.map((r, j) => (
                            <Rect
                              key={j}
                              x={r.x}
                              y={r.y}
                              width={r.width}
                              height={r.height}
                              fill={r.fill}
                            />
                          ))}
                        </G>
                      )}
                    </G>
                  </G>
                </G>
              );
            })}
            {plan.crest && (
              <G transform={`translate(${plan.crest.x} ${plan.crest.y})`}>
                <SvgXml xml={plan.crest.svg} width={plan.crest.size} height={plan.crest.size} />
              </G>
            )}
          </G>
        )}
      </Svg>
    </>
  );
});

// 안드로이드 react-native-svg는 필터 영역 좌표를 화면 픽셀로 읽어서, 시트 좌표 영역을 주면 그림이 통째로 사라진다.
// 색 필터는 픽셀마다 계산이라 영역이 없어도(기본 영역) 결과가 같다.
const filterRegion = (x: number, y: number, width: number, height: number) =>
  Platform.OS === 'android' ? {} : { x, y, width, height, filterUnits: 'userSpaceOnUse' as const };

const styles = StyleSheet.create({
  probe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
