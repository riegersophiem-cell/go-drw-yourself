import type { ReactElement } from "react";
import type { CardType } from "../../game/types";

// Bold, single-color pictograms modeled on the reference "No-Mercy Card
// System" artwork (thick geometric shapes, no thin keyboard-style glyphs).
// Every icon is drawn on a 0 0 100 100 viewBox so it drops into the card's
// corner/center slots at any size. Rendered in currentColor (white).

const STROKE = 9;

function RotateHandsIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 12 A38 38 0 1 1 15 34" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      <path d="M15 34 L15 16 M15 34 L33 34" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      {[0, 120, 240].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 50 58)`}>
          <rect x={41} y={40} width={18} height={26} rx={4} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function TriangleIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 16 L88 82 L12 82 Z" fill="currentColor" />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <rect x={18} y={18} width={64} height={64} rx={6} fill="currentColor" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx={50} cy={50} r={34} fill="currentColor" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 12 L88 50 L50 88 L12 50 Z" fill="currentColor" />
    </svg>
  );
}

function SemicircleIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M16 58 A34 34 0 0 1 84 58 Z" fill="currentColor" />
    </svg>
  );
}

function TargetSkipIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx={38} cy={50} r={30} stroke="currentColor" strokeWidth={7} />
      <path d="M38 12 L38 24 M38 76 L38 88 M0 50 L12 50 M64 50 L76 50" stroke="currentColor" strokeWidth={7} strokeLinecap="round" />
      <circle cx={38} cy={40} r={8} fill="currentColor" />
      <path d="M22 68 Q38 54 54 68" stroke="currentColor" strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M14 68 L30 68" stroke="currentColor" strokeWidth={8} strokeLinecap="round" />
      <path d="M68 68 L92 68 M92 68 L82 58 M92 68 L82 78" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function GiveTwoToLowestIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx={32} cy={30} r={13} fill="currentColor" />
      <path d="M14 68 Q32 46 50 68 Z" fill="currentColor" />
      <g transform="translate(58 46) rotate(-8)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="none" stroke="currentColor" strokeWidth={7} />
      </g>
      <g transform="translate(68 40) rotate(8)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="currentColor" />
      </g>
    </svg>
  );
}

function DiscardOneExtraIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <rect x={30} y={10} width={30} height={42} rx={5} fill="currentColor" />
      <path d="M45 58 L45 78 M45 78 L34 67 M45 78 L56 67" stroke="currentColor" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M20 88 L70 88 L64 74 L26 74 Z" fill="none" stroke="currentColor" strokeWidth={7} strokeLinejoin="round" />
    </svg>
  );
}

function SwapHandIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <g transform="translate(8 30) rotate(-6)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="currentColor" />
      </g>
      <g transform="translate(66 30) rotate(6)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="currentColor" />
      </g>
      <path d="M38 24 L62 24 M62 24 L54 16 M62 24 L54 32" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M62 76 L38 76 M38 76 L46 68 M38 76 L46 84" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx={50} cy={50} r={36} stroke="currentColor" strokeWidth={10} />
      <path d="M26 26 L74 74" stroke="currentColor" strokeWidth={10} strokeLinecap="round" />
    </svg>
  );
}

function ReverseIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M18 38 Q18 20 40 20 L72 20" stroke="currentColor" strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d="M72 20 L60 8 M72 20 L60 32" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M82 62 Q82 80 60 80 L28 80" stroke="currentColor" strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d="M28 80 L40 68 M28 80 L40 92" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function CardStackPlusIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <g transform="translate(30 46) rotate(-8)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="none" stroke="currentColor" strokeWidth={6} />
      </g>
      <g transform="translate(44 42) rotate(8)">
        <rect x={0} y={0} width={26} height={38} rx={4} fill="currentColor" />
      </g>
      <text x={50} y={30} textAnchor="middle" fontSize={30} fontWeight={900} fill="currentColor">
        {label}
      </text>
    </svg>
  );
}

function SkipEveryoneIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx={30} cy={30} r={11} fill="currentColor" />
      <path d="M14 62 Q30 42 46 62 Z" fill="currentColor" />
      <circle cx={68} cy={30} r={11} fill="currentColor" />
      <path d="M52 62 Q68 42 84 62 Z" fill="currentColor" />
      <circle cx={49} cy={78} r={16} fill="none" stroke="currentColor" strokeWidth={7} />
      <path d="M38 89 L60 67" stroke="currentColor" strokeWidth={7} strokeLinecap="round" />
    </svg>
  );
}

function DiscardAllIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <g transform="translate(20 10) rotate(-10)">
        <rect x={0} y={0} width={22} height={32} rx={4} fill="currentColor" />
      </g>
      <g transform="translate(40 6) rotate(4)">
        <rect x={0} y={0} width={22} height={32} rx={4} fill="currentColor" />
      </g>
      <g transform="translate(58 14) rotate(14)">
        <rect x={0} y={0} width={22} height={32} rx={4} fill="currentColor" />
      </g>
      <path d="M50 46 L50 66" stroke="currentColor" strokeWidth={9} strokeLinecap="round" />
      <path d="M50 66 L38 54 M50 66 L62 54" stroke="currentColor" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M22 90 L78 90 L72 74 L28 74 Z" fill="none" stroke="currentColor" strokeWidth={7} strokeLinejoin="round" />
    </svg>
  );
}

function ReverseDrawFourIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M14 40 Q14 24 32 24 L70 24" stroke="currentColor" strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M70 24 L60 14 M70 24 L60 34" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M86 60 Q86 76 68 76 L30 76" stroke="currentColor" strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M30 76 L40 66 M30 76 L40 86" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x={50} y={58} textAnchor="middle" fontSize={22} fontWeight={900} fill="currentColor">
        +4
      </text>
    </svg>
  );
}

function ColorRouletteIcon() {
  const colors = ["#e5484d", "#eab308", "#22c55e", "#3b82f6"];
  return (
    <svg viewBox="0 0 100 100" fill="none">
      {colors.map((c, i) => (
        <path
          key={c}
          d={`M50 50 L50 12 A38 38 0 0 1 ${50 + 38 * Math.sin((Math.PI / 2) * (i + 1))} ${50 - 38 * Math.cos((Math.PI / 2) * (i + 1))} Z`}
          fill={c}
          transform={`rotate(${i * 90} 50 50)`}
        />
      ))}
      <circle cx={50} cy={50} r={16} fill="#18181b" />
      <text x={50} y={58} textAnchor="middle" fontSize={20} fontWeight={900} fill="white">
        ?
      </text>
    </svg>
  );
}

function WildStarIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path
        d="M50 8 L61 38 L94 38 L67 57 L78 88 L50 69 L22 88 L33 57 L6 38 L39 38 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const ICON_BY_TYPE: Record<CardType, () => ReactElement> = {
  ROTATE_HANDS: RotateHandsIcon,
  TRIANGLE: TriangleIcon,
  SQUARE: SquareIcon,
  CIRCLE: CircleIcon,
  DIAMOND: DiamondIcon,
  SEMICIRCLE: SemicircleIcon,
  TARGET_SKIP: TargetSkipIcon,
  GIVE_TWO_TO_LOWEST: GiveTwoToLowestIcon,
  DISCARD_ONE_EXTRA: DiscardOneExtraIcon,
  SWAP_HAND: SwapHandIcon,
  SKIP: SkipIcon,
  REVERSE: ReverseIcon,
  DRAW_1: () => <CardStackPlusIcon label="+1" />,
  DRAW_2: () => <CardStackPlusIcon label="+2" />,
  WILD: WildStarIcon,
  WILD_DRAW_4: () => <CardStackPlusIcon label="+4" />,
  WILD_DRAW_6: () => <CardStackPlusIcon label="+6" />,
  WILD_DRAW_10: () => <CardStackPlusIcon label="+10" />,
  SKIP_EVERYONE: SkipEveryoneIcon,
  DISCARD_ALL: DiscardAllIcon,
  WILD_REVERSE_DRAW_4: ReverseDrawFourIcon,
  WILD_COLOR_ROULETTE: ColorRouletteIcon,
};

export function CardIcon({ type }: { type: CardType }) {
  const Icon = ICON_BY_TYPE[type];
  return Icon ? <Icon /> : null;
}
