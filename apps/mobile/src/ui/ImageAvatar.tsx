import { memo, useEffect, useId, useMemo, useState } from 'react';
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
import {
  avatarImagePlan,
  avatarMotionImageSources,
  IMAGE_SHEETS,
} from '@offside/game/avatar-image';
import type { AvatarSpec } from '@offside/game/avatar';
import type { MotionFrame } from '@offside/game/avatar-motion';
import { avatarImageSource } from './avatarImageSources';

export const ImageAvatar = memo(function ImageAvatar({
  spec,
  width,
  portrait = false,
  motionFrame,
  onReady,
  preloadMotion = false,
}: {
  spec: AvatarSpec;
  width: number | string;
  portrait?: boolean;
  motionFrame?: MotionFrame | undefined;
  onReady?: ((ready: boolean) => void) | undefined;
  preloadMotion?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const plan = useMemo(
    () => avatarImagePlan(spec, motionFrame, portrait),
    [spec, motionFrame, portrait],
  );
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const wanted = [
    ...new Set([
      ...plan.layers.map((l) => l.source),
      ...(preloadMotion ? avatarMotionImageSources(spec) : []),
    ]),
  ];
  const sources = wanted.join('|');
  const complete = wanted.every((s) => loaded.has(s));
  useEffect(
    () => onReady?.(sources.split('|').every((s) => loaded.has(s))),
    [sources, loaded, onReady],
  );
  return (
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
      {preloadMotion &&
        wanted.map((source) => (
          <Image
            key={source}
            href={avatarImageSource(source)}
            x={-100}
            y={-100}
            width={1}
            height={1}
            opacity={0}
            onLoad={() => setLoaded((old) => (old.has(source) ? old : new Set([...old, source])))}
          />
        ))}
      <G clipPath={`url(#${id}-outer)`} opacity={complete ? 1 : 0}>
        {plan.layers.map((layer, i) => {
          const sheet = IMAGE_SHEETS[layer.source]!,
            [x, y, w, h] = layer.crop;
          return (
            <G key={i}>
              <Defs>
                <ClipPath id={`${id}-crop-${i}`}>
                  <Rect x={x} y={y} width={w} height={h} />
                </ClipPath>
                {layer.exclude && (
                  <Mask
                    id={`${id}-head-${i}`}
                    maskUnits="userSpaceOnUse"
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                  >
                    <Rect x={x} y={y} width={w} height={h} fill="white" />
                    <Rect
                      x={layer.exclude[0]}
                      y={layer.exclude[1]}
                      width={layer.exclude[2]}
                      height={layer.exclude[3]}
                      fill="black"
                    />
                  </Mask>
                )}
                {!!layer.filters.length && (
                  <Filter
                    id={`${id}-colour-${i}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    filterUnits="userSpaceOnUse"
                  >
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
                    <Filter
                      id={`${id}-fabric-${i}`}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      filterUnits="userSpaceOnUse"
                    >
                      <FeColorMatrix type="matrix" values={layer.pattern.mask} />
                    </Filter>
                    <Mask
                      id={`${id}-fabric-mask-${i}`}
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
                        filter={`url(#${id}-fabric-${i})`}
                      />
                    </Mask>
                  </>
                )}
              </Defs>
              <G
                transform={`translate(${layer.x} ${layer.y}) scale(${layer.scale}) translate(${-x} ${-y})`}
              >
                <G
                  clipPath={`url(#${id}-crop-${i})`}
                  {...(layer.exclude ? { mask: `url(#${id}-head-${i})` } : {})}
                >
                  <Image
                    href={avatarImageSource(layer.source)}
                    width={sheet.width}
                    height={sheet.height}
                    {...(layer.filters.length ? { filter: `url(#${id}-colour-${i})` } : {})}
                    onLoad={() =>
                      setLoaded((old) =>
                        old.has(layer.source) ? old : new Set([...old, layer.source]),
                      )
                    }
                  />
                  {layer.pattern && (
                    <G mask={`url(#${id}-fabric-mask-${i})`} opacity={0.78}>
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
        {plan.decorations?.map((r, i) => (
          <Rect
            key={`prop-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.fill}
            opacity={r.opacity}
          />
        ))}
      </G>
    </Svg>
  );
});
