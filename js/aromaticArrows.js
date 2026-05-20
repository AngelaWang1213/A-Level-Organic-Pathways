/**
 * SVG overlay for reaction lines + arrowheads (above HTML labels, both pathways).
 * vis-network edges stay invisible and only handle click hit-testing.
 */

import {
  ARROW_LEN,
  ARROW_HALF_WIDTH_RATIO,
  EDGE_WIDTH,
  EDGE_WIDTH_ACTIVE,
} from "./arrowStyle.js?v=20260521a";

const PLUM_SOFT = "#b86a94";
const PLUM_DEEP = "#6f2451";
const TIP_GAP = 4;
/** Wider invisible stroke so clicks match the visible SVG arrow */
const HIT_STROKE_WIDTH = 14;
const BUILD = "20260521h";

const bindings = [];
let resizeObserver = null;
let arrowClickHandler = null;

function layerSize(layer) {
  const parent = layer.parentElement;
  return {
    w: parent?.clientWidth || layer.clientWidth || 1,
    h: parent?.clientHeight || layer.clientHeight || 1,
  };
}

function labelBoxInLayer(layer, labelEl) {
  const lr = layer.getBoundingClientRect();
  const r = labelEl.getBoundingClientRect();
  const w = r.width;
  const h = r.height;
  return {
    centerX: r.left - lr.left + w / 2,
    centerY: r.top - lr.top + h / 2,
    halfW: w / 2,
    halfH: h / 2,
  };
}

function borderPoint(box, towardX, towardY, outwardPx = 0) {
  const dx = towardX - box.centerX;
  const dy = towardY - box.centerY;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x: box.centerX, y: box.centerY };

  const ux = dx / len;
  const uy = dy / len;
  const t =
    Math.min(
      ux !== 0 ? box.halfW / Math.abs(ux) : Infinity,
      uy !== 0 ? box.halfH / Math.abs(uy) : Infinity
    ) + outwardPx;

  return { x: box.centerX + ux * t, y: box.centerY + uy * t };
}

function curveControl(from, to, roundness, bendSign = 1, bendScale = 1) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;
  const sign = bendSign ?? 1;
  const scale = bendScale ?? 1;
  const bend = dist * (roundness ?? 0.3) * 0.55 * sign * scale;
  return { x: mx + nx * bend, y: my + ny * bend };
}

function quadAt(from, ctrl, to, t) {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
  };
}

function curvePath(from, to, roundness, bendSign, bendScale) {
  const c = curveControl(from, to, roundness, bendSign, bendScale);
  return {
    d: `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`,
    ctrl: c,
  };
}

function arrowHeadSvg(tip, dirFrom, fill) {
  const dx = tip.x - dirFrom.x;
  const dy = tip.y - dirFrom.y;
  const len = Math.hypot(dx, dy);
  if (len < 3) return "";

  const ux = dx / len;
  const uy = dy / len;
  const backX = tip.x - ux * ARROW_LEN;
  const backY = tip.y - uy * ARROW_LEN;
  const px = -uy * (ARROW_LEN * ARROW_HALF_WIDTH_RATIO);
  const py = ux * (ARROW_LEN * ARROW_HALF_WIDTH_RATIO);

  return `<polygon points="${tip.x},${tip.y} ${backX + px},${backY + py} ${
    backX - px
  },${backY - py}" fill="${fill}" />`;
}

function getLabelEl(nodeId) {
  const overlay = document.getElementById("node-labels");
  if (!overlay) return null;
  return overlay.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
}

function setLayerActive(active) {
  const layer = document.getElementById("aromatic-arrows");
  if (!layer) return;
  layer.classList.toggle("active", active);
  if (!active) layer.innerHTML = "";
}

/** Aliphatic: arrows under boxes; aromatic: arrows above compact labels */
export function syncArrowLayerPlacement(network) {
  const layer = document.getElementById("aromatic-arrows");
  if (!layer) return;
  const below = Boolean(network?._svgArrows && !network._aromatic);
  layer.classList.toggle("aromatic-arrows--below-labels", below);
}

function drawPathwayEdges(network) {
  const layer = document.getElementById("aromatic-arrows");
  if (!layer || !network?._svgArrows) {
    setLayerActive(false);
    return;
  }

  syncArrowLayerPlacement(network);

  const { w, h } = layerSize(layer);
  if (w < 2 || h < 2) return;

  setLayerActive(true);

  const active = network._activeEdgeIds ?? new Set();
  const edges = network.body?.data?.edges?.get?.() ?? [];
  const boxCache = new Map();
  const paths = [];
  const heads = [];

  const boxFor = (nodeId) => {
    if (boxCache.has(nodeId)) return boxCache.get(nodeId);
    const el = getLabelEl(nodeId);
    if (!el) return null;
    const box = labelBoxInLayer(layer, el);
    boxCache.set(nodeId, box);
    return box;
  };

  for (const e of edges) {
    if (!e.from || !e.to || e.from === e.to) continue;

    const fromBox = boxFor(e.from);
    const toBox = boxFor(e.to);
    if (!fromBox || !toBox) continue;

    const fromPt = borderPoint(fromBox, toBox.centerX, toBox.centerY, 0);
    const toPt = borderPoint(toBox, fromBox.centerX, fromBox.centerY, TIP_GAP);
    const roundness = e.smooth?.roundness ?? 0.3;
    const bendSign = e.smooth?.bendSign ?? 1;
    const bendScale = e.smooth?.bendScale ?? 1;
    const { d, ctrl } = curvePath(fromPt, toPt, roundness, bendSign, bendScale);
    const stroke = active.has(e.id) ? PLUM_DEEP : PLUM_SOFT;
    const sw = active.has(e.id) ? EDGE_WIDTH_ACTIVE : EDGE_WIDTH;

    paths.push(
      `<g class="arrow-edge" data-edge-id="${e.id}">
        <path class="arrow-hit" d="${d}" fill="none" stroke="transparent" stroke-width="${HIT_STROKE_WIDTH}" stroke-linecap="round" />
        <path class="arrow-visible" d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" />
      </g>`
    );

    const dirFrom = quadAt(fromPt, ctrl, toPt, 0.88);
    heads.push(
      `<g class="arrow-head-hit" data-edge-id="${e.id}">${arrowHeadSvg(
        toPt,
        dirFrom,
        stroke
      )}</g>`
    );
  }

  layer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-build="${BUILD}">${paths.join(
    ""
  )}${heads.join("")}</svg>`;
}

export function bindAromaticArrowOverlay(network, onEdgeClick) {
  unbindAromaticArrowOverlay();
  if (!network?._svgArrows) return;

  syncArrowLayerPlacement(network);
  network._activeEdgeIds = new Set();
  network._drawAromaticArrows = () => drawPathwayEdges(network);

  const layer = document.getElementById("aromatic-arrows");
  if (layer && onEdgeClick) {
    arrowClickHandler = (e) => {
      const edgeId =
        e.target.closest?.("[data-edge-id]")?.dataset?.edgeId;
      if (!edgeId) return;
      e.stopPropagation();
      onEdgeClick(edgeId);
    };
    layer.addEventListener("click", arrowClickHandler);
  }

  const events = ["afterDrawing", "zoom", "dragging", "animationFinished"];
  for (const ev of events) {
    const handler = network._drawAromaticArrows;
    network.on(ev, handler);
    bindings.push({ network, ev, handler });
  }

  if (layer && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => network._drawAromaticArrows?.());
    resizeObserver.observe(layer.parentElement || layer);
  }

  const run = () => network._drawAromaticArrows?.();
  requestAnimationFrame(run);
  setTimeout(run, 50);
  setTimeout(run, 200);
  setTimeout(run, 800);
  setTimeout(run, 2000);
}

export function unbindAromaticArrowOverlay() {
  const layer = document.getElementById("aromatic-arrows");
  if (layer && arrowClickHandler) {
    layer.removeEventListener("click", arrowClickHandler);
    arrowClickHandler = null;
  }

  for (const { network, ev, handler } of bindings) {
    try {
      network.off(ev, handler);
    } catch {
      /* destroyed */
    }
  }
  bindings.length = 0;
  resizeObserver?.disconnect();
  resizeObserver = null;
  setLayerActive(false);
  layer?.classList.remove("aromatic-arrows--below-labels");
}

export function setAromaticArrowHighlight(network, edgeIds) {
  if (!network?._svgArrows) return;
  network._activeEdgeIds = new Set(edgeIds ?? []);
  network._drawAromaticArrows?.();
}

export function aromaticEdgeEndpointOffsetFromLabels(network, edge) {
  const scale = network.getScale() || 1;
  const layer = document.getElementById("aromatic-arrows");

  const offsetFor = (nodeId, towardId) => {
    const el = getLabelEl(nodeId);
    const towardEl = getLabelEl(towardId);
    if (!layer || !el || !towardEl) return 40;

    const box = labelBoxInLayer(layer, el);
    const toward = labelBoxInLayer(layer, towardEl);
    const dx = toward.centerX - box.centerX;
    const dy = toward.centerY - box.centerY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const borderPx = Math.min(
      ux !== 0 ? box.halfW / Math.abs(ux) : Infinity,
      uy !== 0 ? box.halfH / Math.abs(uy) : Infinity
    );
    return Math.max(25, Math.round(borderPx / scale) + 6);
  };

  return {
    from: offsetFor(edge.from, edge.to),
    to: offsetFor(edge.to, edge.from),
  };
}

export const AROMATIC_ARROWS_BUILD = BUILD;
