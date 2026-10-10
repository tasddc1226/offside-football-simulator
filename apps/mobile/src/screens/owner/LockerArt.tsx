// Pixel artwork shared visually with the web locker room. No native assets or runtime changes.
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { titleIconPath } from '@offside/app-core/ownerTitle';
function Shirt({ x, y, number, color }: { x: number; y: number; number: number; color: string }) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <Path
        d="M17 0h14v5h7l13 10-8 15-8-4v39H5V26l-8 4-8-15L2 5h8V0h7v8h7V0"
        fill="#071811"
        opacity=".6"
        transform="translate(4 5)"
      />
      <Path d="M17 0h14v5h7l13 10-8 15-8-4v39H5V26l-8 4-8-15L2 5h8V0h7v8h7V0" fill={color} />
      <Path d="M10 0h7v8h7V0h7v5H10ZM5 59h30v6H5Z" fill="#dcc88a" />
      <Path d="M5 15h4v41H5ZM31 15h4v41h-4Z" fill="#071811" opacity=".3" />
      <SvgText
        x="20"
        y="43"
        textAnchor="middle"
        fontSize="23"
        fontWeight="900"
        fill="#eee4c7"
        fontFamily="monospace"
      >
        {number}
      </SvgText>
    </G>
  );
}
function Trophy({
  x,
  y,
  earned,
  silver = false,
}: {
  x: number;
  y: number;
  earned: boolean;
  silver?: boolean;
}) {
  return (
    <G transform={`translate(${x} ${y})`} opacity={earned ? 1 : 0.22}>
      <Path
        d="M6 0h26v6h8v19h-8v7h-8v13h11v7H3v-7h11V32H6v-7H-2V6h8Zm0 10H2v10h4Zm26 0v10h4V10Z"
        fill={silver ? '#a7babc' : '#bd8e36'}
      />
      <Path d="M10 2h6v23h-6ZM6 46h25v3H6Z" fill={silver ? '#edf0dc' : '#f3d689'} />
      <Path d="M24 6h5v18h-5ZM19 32h5v13h-5Z" fill={silver ? '#647979' : '#785726'} />
    </G>
  );
}
export function LockerArt({
  zone,
  season = 1,
  title = null,
  awards = 0,
}: {
  zone: number;
  season?: number;
  title?: string | null;
  awards?: number;
}) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 240 290" fill="none">
      <Rect width="240" height="290" fill="#273e33" />
      {[0, 40, 80, 120, 160, 200].map((x) => (
        <G key={x}>
          <Rect x={x} y="10" width="1" height="251" fill="#354c3b" />
        </G>
      ))}
      <Path d="M0 0h240v15H0Z" fill="#59644a" />
      <Path d="M6 2h228v4H6Z" fill="#b8a26a" />
      <Path d="M0 17h240v5H0Z" fill="#16271d" />
      <Path d="M6 23h228v6H6Z" fill="#d8bd7e" />
      <Path d="M14 29h212v3H14Z" fill="#857647" />
      <Path d="M0 235h240v55H0Z" fill="#66523a" />
      <Path d="M0 240h240v3H0ZM0 263h240v2H0Z" fill="#806a46" />
      <Path d="M8 35h224v187H8Z" fill="#0c1d16" />
      <Path d="M13 40h214v179H13Z" fill="#162b20" />
      <Path d="M15 41h210v2H15Z" fill="#324c34" />
      {zone === 0 ? (
        <>
          <Path d="M116 35h8v187h-8Z" fill="#85704c" />
          <Path d="M120 35h2v187h-2Z" fill="#b89e66" />
          {[23, 136].map((x) => (
            <G key={x}>
              <Rect x={x} y="55" width="77" height="3" fill="#778779" />
              <Path d={`M${x + 33} 61v9l-16 8h36l-16-8v-9`} stroke="#a8ac8b" strokeWidth="2" />
              <Rect x={x} y="174" width="77" height="32" fill="#263c2d" />
              <Rect x={x + 30} y="183" width="17" height="3" fill="#b29b66" />
            </G>
          ))}
          <Shirt x={43} y={83} number={0} color="#577b68" />
          <Shirt x={156} y={83} number={season} color="#bdc9a4" />
          <Rect x="30" y="47" width="56" height="4" fill="#d4bc7d" />
          <Rect x="147" y="47" width="56" height="4" fill="#d4bc7d" />
        </>
      ) : zone === 1 ? (
        <>
          <Path d="M55 47h130v117H55Z" fill="#5f5239" />
          <Path d="M61 53h118v105H61Z" fill="#0a2019" />
          <Path d="M86 65h68v49l-8 18-26 18-26-18-8-18Z" fill="#b89c53" />
          <Path d="M92 71h56v42l-7 14-21 15-21-15-7-14Z" fill="#304e38" />
          {title && titleIconPath(title) ? (
            <G transform="translate(101 83) scale(2.4)">
              <Path d={titleIconPath(title)} fill="#ecdf9e" />
            </G>
          ) : (
            <Path
              d="M114 84h12v6h8v18h-8v8h-12v-8h-8V90h8ZM106 110h8v8h12v-8h8v14h-28Z"
              fill="#e1d08e"
            />
          )}
          <Path d="M49 173h142v35H49Z" fill="#9f8957" />
          <Path d="M53 177h134v27H53Z" fill="#152b20" />
          <Path d="M17 49h18v145H17ZM205 49h18v145h-18Z" fill="#233e2a" />
          <Path d="M23 56h6v126h-6ZM211 56h6v126h-6Z" fill="#69864d" />
        </>
      ) : (
        <>
          {[45, 112, 179].map((y) => (
            <G key={y}>
              <Path d={`M15 ${y + 54}h210v7H15Z`} fill="#8f7747" />
              <Path d={`M15 ${y + 54}h210v2H15Z`} fill="#c0a56b" />
            </G>
          ))}
          <Trophy x={42} y={47} earned={awards > 0} />
          <Trophy x={102} y={47} earned={awards > 1} silver />
          <Trophy x={162} y={47} earned={awards > 2} />
          {[38, 98, 158].map((x, i) => (
            <G key={x}>
              <G opacity={awards > i + 3 ? 1 : 0.22}>
                <Path d={`M${x + 5} 116h23v30h-23Z`} fill="#6e2940" />
                <Path d={`M${x} 136h33v28H${x}Z`} fill="#c6a766" />
                <Path d={`M${x + 6} 142h21v16h-21Z`} fill="#edd39a" />
              </G>
            </G>
          ))}
          <Path d="M58 193h124v9H58Z" fill="#3e5941" />
        </>
      )}
      <Path d="M0 220h240v8H0Z" fill="#9b8056" />
      <Path d="M0 228h240v7H0Z" fill="#392e23" />
      <Path d="M10 229h220v6H10Z" fill="#d5b469" />
      {[17, 96, 175].map((x) => (
        <G key={x}>
          <Path d={`M${x} 217h49v5H${x}Z`} fill="#33473a" />
          <Path d={`M${x} 207h49v10H${x}Z`} fill="#14271f" />
          <Path d={`M${x + 3} 207h43v2H${x + 3}Z`} fill="#4c6250" />
        </G>
      ))}
      <Path d="M18 244h6v28h-6ZM216 244h6v28h-6Z" fill="#221e19" />
      <Path d="M6 250h228v4H6Z" fill="#a68a54" />
    </Svg>
  );
}
