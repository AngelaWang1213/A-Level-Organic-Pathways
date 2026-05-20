/**
 * Shared reaction-arrow geometry for aliphatic (vis-network) and aromatic (SVG).
 */

export const ARROW_LEN = 9;
export const ARROW_HALF_WIDTH_RATIO = 0.32;
export const EDGE_WIDTH = 1.2;
export const EDGE_WIDTH_ACTIVE = 2.2;

/** vis-network default "arrow" head: length ≈ 15*scaleFactor + 3*lineWidth; half-width ≈ 0.3*length */
const VIS_ARROW_BACK_HALF_WIDTH = 0.3;

/**
 * scaleFactor so canvas arrowheads match aromatic SVG size at the given edge width.
 */
export function visArrowScaleFactor(lineWidth = EDGE_WIDTH) {
  const targetLen =
    ARROW_LEN * (ARROW_HALF_WIDTH_RATIO / VIS_ARROW_BACK_HALF_WIDTH);
  const scale = (targetLen - 3 * lineWidth) / 15;
  return Math.max(0.15, Math.round(scale * 100) / 100);
}
