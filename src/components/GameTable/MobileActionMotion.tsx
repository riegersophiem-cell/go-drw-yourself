import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { CardColor, Direction, PublicPlayerView } from "../../game/types";
import type { PlaybackBeat } from "../../multiplayer/playbackBeats";
import "./MobileActionMotion.css";

export interface MobileActionMotionProps {
  beat: PlaybackBeat;
  players: PublicPlayerView[];
  direction: Direction;
  containerRef: RefObject<HTMLDivElement | null>;
}

const COLOR_HEX: Record<Exclude<CardColor, "WILD">, string> = {
  RED: "#e5484d", BLUE: "#3b82f6", GREEN: "#22c55e", YELLOW: "#eab308", VIOLET: "#7047eb",
};

interface Pt { x: number; y: number; }

function centerOf(el: Element, containerRect: DOMRect): Pt {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top };
}

/**
 * REMOTE_MOBILE_FULL's equivalent of TABLE_DEVICE's ActionChoreography.
 * The compact ring is a wrapping flex strip, not an ellipse — there is no
 * seatGeometry formula to place seats on — so positions are measured live
 * from the actual rendered `[data-player-id]` / `[data-draw-pile]` DOM nodes
 * instead. Deliberately simpler than the table version (straight lines, two
 * steps, no bow) per the brief (section 21/23-26): mobile gets a reduced,
 * non-fullscreen presentation, not the table choreography scaled down.
 */
export function MobileActionMotion({ beat, players, direction, containerRef }: MobileActionMotionProps) {
  const [step, setStep] = useState(0);
  const [geometry, setGeometry] = useState<{ points: Record<string, Pt>; drawPile: Pt | null; size: { w: number; h: number } } | null>(null);

  useEffect(() => {
    setStep(0);
    setGeometry(null);
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const points: Record<string, Pt> = {};
    players.forEach((p) => {
      // Target the avatar specifically, not the whole seat token (avatar +
      // name pill stacked below it) — centering on the full token made the
      // glyph land on top of the name text instead of just the avatar
      // (found live). Falls back to the seat token for TABLE_DEVICE-style
      // markup that has no separate avatar element.
      const el = container.querySelector(`[data-player-id="${p.playerId}"] .player-ring__avatar`) ?? container.querySelector(`[data-player-id="${p.playerId}"]`);
      if (el) points[p.playerId] = centerOf(el, containerRect);
    });
    const drawEl = container.querySelector('[data-draw-pile="true"]');
    const drawPile = drawEl ? centerOf(drawEl, containerRect) : null;
    setGeometry({ points, drawPile, size: { w: containerRect.width, h: containerRect.height } });
    const t1 = setTimeout(() => setStep(1), 380);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.id]);

  if (!geometry) return null;
  const accent = beat.chosenColor ? COLOR_HEX[beat.chosenColor] : beat.card && beat.card.color !== "WILD" ? COLOR_HEX[beat.card.color] : "#93b4ff";

  // A small hand-of-cards silhouette (two layered leaves), not a flat debug
  // rectangle — the mobile-scale equivalent of ActionChoreography's
  // handstack glyph (brief follow-up: "diese dunklen kleinen
  // Hand-Stack-Elemente... wirken noch technisch/provisorisch").
  function Glyph({ point, delayMs, cardBack }: { point: Pt; delayMs?: number; cardBack?: boolean }) {
    return (
      <div
        className={`mobile-action-motion__glyph ${cardBack ? "mobile-action-motion__glyph--cardback" : ""}`}
        style={{ left: `${point.x}px`, top: `${point.y}px`, transitionDelay: delayMs ? `${delayMs}ms` : undefined }}
      >
        {!cardBack && <span className="mobile-action-motion__leaf" />}
        <span className="mobile-action-motion__leaf mobile-action-motion__leaf--front" />
      </div>
    );
  }

  if (beat.kind === "ROTATE") {
    const n = players.length;
    return (
      <div className="mobile-action-motion" aria-hidden="true">
        {players.map((p, i) => {
          const from = geometry.points[p.playerId];
          const toPlayer = players[(((i + direction) % n) + n) % n];
          const to = toPlayer ? geometry.points[toPlayer.playerId] : undefined;
          if (!from || !to) return null;
          return <Glyph key={p.playerId} point={step === 0 ? from : to} delayMs={i * 30} />;
        })}
      </div>
    );
  }

  if (beat.kind === "SWAP") {
    const a = beat.actorPlayerId ? geometry.points[beat.actorPlayerId] : undefined;
    const b = beat.targetPlayerId ? geometry.points[beat.targetPlayerId] : undefined;
    if (!a || !b) return null;
    return (
      <div className="mobile-action-motion" aria-hidden="true">
        <svg className="mobile-action-motion__link" width={geometry.size.w} height={geometry.size.h}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mobile-action-motion__swap-line" style={{ stroke: accent }} />
        </svg>
        <Glyph point={step === 0 ? a : b} />
        <Glyph point={step === 0 ? b : a} delayMs={60} />
      </div>
    );
  }

  if (beat.kind === "SKIP" && beat.targetPlayerId) {
    const a = beat.actorPlayerId ? geometry.points[beat.actorPlayerId] : undefined;
    const b = geometry.points[beat.targetPlayerId];
    if (!a || !b) return null;
    return (
      <div className="mobile-action-motion" aria-hidden="true">
        <svg className="mobile-action-motion__link" width={geometry.size.w} height={geometry.size.h}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mobile-action-motion__target-line" style={{ stroke: accent, color: accent }} />
        </svg>
        <div className="mobile-action-motion__marker" style={{ left: `${b.x}px`, top: `${b.y}px`, borderColor: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
    );
  }

  if ((beat.kind === "DRAW" || beat.kind === "STACK") && beat.actorPlayerId && geometry.drawPile) {
    const to = geometry.points[beat.actorPlayerId];
    if (!to) return null;
    const count = Math.min(4, beat.count ?? 1);
    const drawPile = geometry.drawPile;
    return (
      <div className="mobile-action-motion" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <Glyph key={i} point={step === 0 ? drawPile : to} delayMs={i * 70} cardBack />
        ))}
      </div>
    );
  }

  return null;
}
