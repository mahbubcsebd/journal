import { COLORS, rgba } from "@/lib/desk/format";
import type { ReactionBrief, ReactionZone } from "@/lib/desk/types";

const CHIP_RIGHT_INSET = 8;
const CHIP_HEIGHT = 17;
const CHIP_PAD_X = 6;
const CHIP_GAP_Y = 2;

/**
 * Draws small `%` chips beside scored reaction zones near the right chart margin
 * (`bg-hull` fill with Jade outline for support, Coral for resistance).
 */
export function drawReactionChips(
  ctx: CanvasRenderingContext2D,
  width: number,
  brief: ReactionBrief | null | undefined,
  yForPrice: (price: number) => number | null,
) {
  if (!brief) return;
  const zones: ReactionZone[] = [...brief.above, ...brief.below].filter((z) => z.probability !== null);
  if (zones.length === 0) return;

  ctx.save();
  ctx.font = '600 11px "Schibsted Grotesk Variable", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const placedY: number[] = [];
  for (const z of zones) {
    const rawY = yForPrice((z.top + z.bottom) / 2);
    if (rawY === null) continue;
    let cy = rawY;
    while (placedY.some((prev) => Math.abs(prev - cy) < CHIP_HEIGHT + CHIP_GAP_Y)) {
      cy += z.side === "support" ? CHIP_HEIGHT + CHIP_GAP_Y : -(CHIP_HEIGHT + CHIP_GAP_Y);
    }
    placedY.push(cy);

    const text = `${Math.round((z.probability ?? 0) * 100)}%`;
    const chipW = Math.ceil(ctx.measureText(text).width) + CHIP_PAD_X * 2;
    const x = width - CHIP_RIGHT_INSET - chipW;
    const y = Math.round(cy - CHIP_HEIGHT / 2);
    const tone = z.side === "support" ? COLORS.jade : COLORS.coral;

    ctx.fillStyle = "#15262f";
    ctx.strokeStyle = rgba(tone, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, chipW, CHIP_HEIGHT, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tone;
    ctx.fillText(text, x + chipW / 2, y + CHIP_HEIGHT / 2 + 0.5);
  }
  ctx.restore();
}

