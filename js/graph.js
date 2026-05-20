/* Heirloom Plum Brunch — light brunch (matches web/css/styles.css) */
const PLUM = {
  deep: "#6f2451",
  mid: "#8f3a66",
  soft: "#b86a94",
  border: "#9e4872",
  a2: "#5a1f42",
  surface: "#7d2f5c",
  pink: "#ec9ccc",
  pale: "#f5d4e8",
  accent: "#f5c4dc",
  blush: "#fadceb",
  cream: "#fff6fa",
  creamMuted: "#f5e6ee",
};

const TIER_COLORS = {
  AS: {
    background: PLUM.pale,
    border: PLUM.pink,
    highlight: { background: PLUM.blush, border: PLUM.mid },
  },
  A2: {
    background: PLUM.blush,
    border: PLUM.accent,
    highlight: { background: PLUM.pale, border: PLUM.mid },
  },
};

const DIM_EDGE = { color: "rgba(184,106,148,0.4)", highlight: PLUM.deep };
const DIM_NODE_BORDER = "rgba(158,72,114,0.45)";

/** Unchanged from original aliphatic mind map */
export const NODE_BOX_ALIPHATIC = {
  mode: "aliphatic",
  margin: 32,
  borderWidth: 2,
  shapeProperties: { borderRadius: 8 },
  widthConstraint: { minimum: 240, maximum: 340 },
  heightConstraint: { minimum: 132, maximum: 200 },
};

/** Aromatic — compact boxes so edge arrowheads stay visible outside HTML labels */
export const NODE_BOX_AROMATIC = {
  mode: "aromatic",
  margin: 10,
  borderWidth: 2,
  shapeProperties: { borderRadius: 10 },
  widthConstraint: { minimum: 200, maximum: 280 },
  heightConstraint: { minimum: 155, maximum: 230 },
  /** Extra hit-area padding when syncing vis box to measured label (not edge routing). */
  boxSyncPadding: 4,
};

/** Invisible on canvas — visible lines/arrows are SVG in #aromatic-arrows (both pathways). */
export const SVG_OVERLAY_EDGE = {
  arrows: { to: { enabled: false } },
  arrowStrikethrough: true,
  color: { color: "rgba(255,246,250,0)", opacity: 0, highlight: PLUM.deep },
  width: 14,
};

/** @deprecated Use SVG_OVERLAY_EDGE */
export const AROMATIC_EDGE = SVG_OVERLAY_EDGE;

export const NODE_COLOR_AROMATIC_HIT = {
  background: "rgba(255,246,250,0.02)",
  border: "rgba(255,246,250,0.02)",
};

const HIDDEN_LABEL_FONT = {
  size: 1,
  color: "rgba(0,0,0,0)",
  face: "Courier New",
};

/** Zoom limits relative to last “Fit map” scale (prevents map shrinking to a dot). */
export const ZOOM_LIMITS = {
  minRatioOfFit: 0.5,
  maxRatioOfFit: 2.5,
  absoluteMin: 0.12,
  absoluteMax: 3,
};

export function getNodeBoxSpec(showStructureImages) {
  return showStructureImages ? NODE_BOX_AROMATIC : NODE_BOX_ALIPHATIC;
}

export function recordFitScale(network) {
  if (!network) return;
  const fit = network.getScale() || 1;
  network._fitScale = fit;
  const min = Math.max(ZOOM_LIMITS.absoluteMin, fit * ZOOM_LIMITS.minRatioOfFit);
  const max = Math.min(ZOOM_LIMITS.absoluteMax, fit * ZOOM_LIMITS.maxRatioOfFit);
  network._zoomMin = min;
  network._zoomMax = max;
  try {
    network.setOptions({
      interaction: { zoomMin: min, zoomMax: max },
    });
  } catch {
    /* older vis builds may ignore zoomMin/zoomMax */
  }
}

export function clampScale(network, scale) {
  const min = network?._zoomMin ?? ZOOM_LIMITS.absoluteMin;
  const max = network?._zoomMax ?? ZOOM_LIMITS.absoluteMax;
  return Math.min(max, Math.max(min, scale));
}

let _clampingZoom = false;

export function bindZoomConstraints(network) {
  if (!network || network._zoomBound) return;
  network._zoomBound = true;

  network.on("zoom", () => {
    if (_clampingZoom) return;
    const current = network.getScale();
    const clamped = clampScale(network, current);
    if (Math.abs(current - clamped) > 0.002) {
      _clampingZoom = true;
      network.moveTo({ scale: clamped, animation: false });
      _clampingZoom = false;
    }
  });
}

/** vis-network heightConstraint only supports minimum (not maximum). */
function visHeightConstraint(spec) {
  return { minimum: spec.heightConstraint.minimum };
}

function nodeStyleAliphatic(spec) {
  return {
    margin: spec.margin,
    widthConstraint: spec.widthConstraint,
    heightConstraint: visHeightConstraint(spec),
    borderWidth: spec.borderWidth,
    shapeProperties: spec.shapeProperties,
  };
}

function defaultAromaticSize(spec) {
  return {
    width: spec.widthConstraint.minimum,
    height: spec.heightConstraint.minimum,
    margin: spec.margin,
    borderWidth: spec.borderWidth,
    shapeProperties: spec.shapeProperties,
  };
}

function aromaticNodeEndpointOffset(network, nodeId) {
  const spec = NODE_BOX_AROMATIC;
  const stored = network._nodeDimensions?.get(nodeId);
  const w = stored?.width ?? spec.widthConstraint.minimum;
  const h = stored?.height ?? spec.heightConstraint.minimum;
  return Math.max(14, Math.min(32, Math.round(Math.min(w, h) * 0.1)));
}

function aromaticEdgeEndpointOffset(network, edge) {
  return {
    from: aromaticNodeEndpointOffset(network, edge.from),
    to: aromaticNodeEndpointOffset(network, edge.to),
  };
}

/** Re-apply edge endpoint offsets after label boxes move/resize (SVG arrow pathways). */
export function refreshAromaticEdges(network) {
  if (!network?._svgArrows || !network.body?.data) return;
  const data = network.body.data;
  const updates = data.edges.get().map((e) => ({
    id: e.id,
    ...SVG_OVERLAY_EDGE,
    endPointOffset: endpointOffsetForAromaticEdge(network, e),
  }));
  if (updates.length) data.edges.update(updates);
}

function endpointOffsetForAromaticEdge(network, edge) {
  if (typeof network._aromaticEdgeOffsetFromLabels === "function") {
    return network._aromaticEdgeOffsetFromLabels(network, edge);
  }
  return aromaticEdgeEndpointOffset(network, edge);
}

function nodeSizeFor(network, nodeId) {
  const spec = network._nodeBoxSpec || NODE_BOX_ALIPHATIC;
  if (spec.mode === "aliphatic") {
    return nodeStyleAliphatic(spec);
  }
  const stored = network._nodeDimensions?.get(nodeId);
  if (stored) {
    return {
      width: stored.width,
      height: stored.height,
      margin: spec.margin,
      borderWidth: spec.borderWidth,
      shapeProperties: spec.shapeProperties,
    };
  }
  return defaultAromaticSize(spec);
}

function nodeColor(tier, aromatic = false) {
  const c = TIER_COLORS[tier] || TIER_COLORS.A2;
  if (aromatic) {
    return {
      background: NODE_COLOR_AROMATIC_HIT.background,
      border: NODE_COLOR_AROMATIC_HIT.border,
      highlight: c.highlight,
    };
  }
  return {
    background: c.background,
    border: c.border,
    highlight: c.highlight,
  };
}

export function createMindMapGraph(container, nodes, reactions, layout, graphOpts = {}) {
  const positions = layout.positions || {};
  const edgeGroups = new Map();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const aromatic = graphOpts.showStructureImages === true;
  const boxSpec = getNodeBoxSpec(aromatic);
  const aliphaticStyle = nodeStyleAliphatic(NODE_BOX_ALIPHATIC);
  const aromaticInitial = defaultAromaticSize(NODE_BOX_AROMATIC);
  const defaultEdgeOffset = Math.max(
    14,
    Math.min(
      32,
      Math.round(
        Math.min(
          boxSpec.widthConstraint.minimum,
          boxSpec.heightConstraint.minimum
        ) * 0.1
      )
    )
  );

  const visNodes = nodes.map((n) => {
    const pos = positions[n.id] || { x: 0, y: 0 };
    const base = {
      id: n.id,
      label: " ",
      x: pos.x,
      y: pos.y,
      fixed: { x: true, y: true },
      color: nodeColor(n.tier, aromatic),
      font: HIDDEN_LABEL_FONT,
      shape: "box",
    };

    if (aromatic) {
      return {
        ...base,
        width: aromaticInitial.width,
        height: aromaticInitial.height,
        margin: aromaticInitial.margin,
        borderWidth: aromaticInitial.borderWidth,
        shapeProperties: aromaticInitial.shapeProperties,
      };
    }

    return {
      ...base,
      ...aliphaticStyle,
      color: {
        background: NODE_COLOR_AROMATIC_HIT.background,
        border: NODE_COLOR_AROMATIC_HIT.border,
        highlight: nodeColor(n.tier, false).highlight,
      },
    };
  });

  const visEdges = reactions
    .filter((r) => !r.disabled_for_pathfinding && r.from !== r.to)
    .map((r) => {
      const key = `${r.from}::${r.to}`;
      const idx = edgeGroups.get(key) || 0;
      edgeGroups.set(key, idx + 1);
      const roundness =
        typeof r.smooth_roundness === "number"
          ? r.smooth_roundness
          : 0.28 + idx * 0.26;
      const bendSign =
        typeof r.curve_bend_sign === "number" ? r.curve_bend_sign : 1;
      const bendScale =
        typeof r.curve_bend_scale === "number" ? r.curve_bend_scale : 1;

      return {
        id: r.id,
        from: r.from,
        to: r.to,
        ...SVG_OVERLAY_EDGE,
        endPointOffset: {
          from: defaultEdgeOffset,
          to: defaultEdgeOffset,
        },
        smooth: {
          type: "curvedCW",
          roundness: Math.min(roundness, 0.62),
          bendSign,
          bendScale,
        },
      };
    });

  const visOptions = {
    physics: { enabled: false },
    nodes: aromatic
      ? {
          chosen: { node: false },
          font: HIDDEN_LABEL_FONT,
          shape: "box",
          margin: boxSpec.margin,
          borderWidth: boxSpec.borderWidth,
          shapeProperties: boxSpec.shapeProperties,
        }
      : {
          chosen: { node: false },
          font: HIDDEN_LABEL_FONT,
          shape: "box",
          margin: NODE_BOX_ALIPHATIC.margin,
          widthConstraint: NODE_BOX_ALIPHATIC.widthConstraint,
          heightConstraint: visHeightConstraint(NODE_BOX_ALIPHATIC),
          borderWidth: NODE_BOX_ALIPHATIC.borderWidth,
          shapeProperties: NODE_BOX_ALIPHATIC.shapeProperties,
        },
    edges: { chosen: { edge: false }, selectionWidth: 2 },
    interaction: {
      hover: false,
      tooltipDelay: 999999,
      navigationButtons: false,
      keyboard: { enabled: true },
      zoomView: true,
      dragView: true,
      dragNodes: false,
      hideEdgesOnDrag: false,
      multiselect: false,
      selectConnectedEdges: false,
      zoomMin: ZOOM_LIMITS.absoluteMin,
      zoomMax: ZOOM_LIMITS.absoluteMax,
    },
  };

  const network = new vis.Network(
    container,
    { nodes: visNodes, edges: visEdges },
    visOptions
  );
  network._tierById = new Map(nodes.map((n) => [n.id, n.tier]));
  network._nodeById = nodeById;
  network._nodeBoxSpec = boxSpec;
  network._nodeDimensions = aromatic ? new Map() : null;
  network._aromatic = aromatic;
  network._svgArrows = true;
  refreshAromaticEdges(network);
  bindZoomConstraints(network);
  return network;
}

export function highlightPath(network, nodeIds, edgeIds) {
  const data = network.body.data;
  const tierById = network._tierById;
  const activeNodes = new Set(nodeIds);
  const activeEdges = new Set(edgeIds);
  const aromatic = network._aromatic;
  const borderWidth = aromatic
    ? NODE_BOX_AROMATIC.borderWidth
    : NODE_BOX_ALIPHATIC.borderWidth;

  data.nodes.get().forEach((n) => {
    const active = activeNodes.has(n.id);
    const size = nodeSizeFor(network, n.id);
    data.nodes.update({
      id: n.id,
      borderWidth: active ? 3 : borderWidth,
      font: HIDDEN_LABEL_FONT,
      color: active
        ? {
            background: PLUM.pink,
            border: PLUM.deep,
            highlight: { background: PLUM.accent, border: PLUM.a2 },
          }
        : {
            background: NODE_COLOR_AROMATIC_HIT.background,
            border: NODE_COLOR_AROMATIC_HIT.border,
            highlight: nodeColor(tierById.get(n.id), aromatic).highlight,
          },
      ...size,
    });
  });

  data.edges.get().forEach((e) => {
    data.edges.update({
      id: e.id,
      ...SVG_OVERLAY_EDGE,
      endPointOffset: endpointOffsetForAromaticEdge(network, e),
    });
  });
}

export function resetHighlight(network, nodeList) {
  const data = network.body.data;
  const tierById = new Map(nodeList.map((n) => [n.id, n.tier]));
  const aromatic = network._aromatic;
  const borderWidth = aromatic
    ? NODE_BOX_AROMATIC.borderWidth
    : NODE_BOX_ALIPHATIC.borderWidth;

  data.nodes.get().forEach((n) => {
    const size = nodeSizeFor(network, n.id);
    data.nodes.update({
      id: n.id,
      borderWidth,
      font: HIDDEN_LABEL_FONT,
      color: aromatic
        ? nodeColor(tierById.get(n.id), true)
        : {
            background: NODE_COLOR_AROMATIC_HIT.background,
            border: NODE_COLOR_AROMATIC_HIT.border,
            highlight: nodeColor(tierById.get(n.id), false).highlight,
          },
      ...size,
    });
  });

  data.edges.get().forEach((e) => {
    data.edges.update({
      id: e.id,
      ...SVG_OVERLAY_EDGE,
      endPointOffset: endpointOffsetForAromaticEdge(network, e),
    });
  });
}

export function fitMindMap(network, animation = true) {
  const opts = {
    animation: animation
      ? { duration: 500, easingFunction: "easeInOutQuad" }
      : false,
  };
  if (network._aromatic) {
    opts.padding = 60;
  }
  const applyFitScale = () => recordFitScale(network);
  if (animation) {
    network.once("animationFinished", applyFitScale);
  } else {
    requestAnimationFrame(applyFitScale);
  }
  network.fit(opts);
}
