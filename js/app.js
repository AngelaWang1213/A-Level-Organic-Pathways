import {
  findShortestPaths,
  buildAdjacency,
  pathToNodeSequence,
} from "./pathfinder.js?v=20260521a";
import {
  createMindMapGraph,
  highlightPath,
  resetHighlight,
  fitMindMap,
  refreshAromaticEdges,
  clampScale,
  recordFitScale,
  constrainView,
} from "./graph.js?v=20260520v4";
import {
  mountNodeLabelOverlays,
  bindNodeLabelSync,
  bindNodeLabelClicks,
  setNodeLabelHighlight,
  clearNodeLabelHighlight,
  syncNodeLabelPositions,
  buildNodeCardHtml,
  syncVisBoxesToLabels,
  setNodeZoomFocus,
  clearNodeZoomFocus,
} from "./nodeLabels.js?v=20260520n";
import {
  bindAromaticArrowOverlay,
  unbindAromaticArrowOverlay,
  syncArrowLayerPlacement,
  setAromaticArrowHighlight,
  aromaticEdgeEndpointOffsetFromLabels,
} from "./aromaticArrows.js?v=20260521h";
import { hydrateStructureImage } from "./structureImage.js?v=20260520n";
import {
  renderReactionTable,
  renderNodeDetailPanel,
  renderPathStepTable,
} from "./detail.js?v=20260521b";

/** Resolve data/ next to js/ (works for GitHub Pages root and local /web/). */
const DATA_ROOT = new URL("../data/", import.meta.url);

function dataFileUrl(pathway, filename) {
  return new URL(`${pathway}/${filename}`, DATA_ROOT).href;
}

const DATA_CACHE = "20260521m";

const PATHWAYS = {
  aliphatic: {
    label: "Aliphatic",
    defaultFrom: "alkene",
    defaultTo: "carboxylic_acid",
  },
  aromatic: {
    label: "Aromatic",
    defaultFrom: "benzene",
    defaultTo: "phenylamine",
  },
};

function applyGraphHighlight(nodeIds, edgeIds = []) {
  if (!state.network) return;
  highlightPath(state.network, nodeIds, edgeIds);
  setAromaticArrowHighlight(state.network, edgeIds);
}

function resetGraphHighlight() {
  if (!state.network) return;
  resetHighlight(state.network, state.nodes);
  setAromaticArrowHighlight(state.network, []);
}

let state = {
  pathway: "aliphatic",
  nodes: [],
  reactions: [],
  layout: null,
  nodeMap: new Map(),
  adjacency: new Map(),
  network: null,
  currentPaths: [],
  activePathIndex: 0,
  /** First node clicked for click-to-find shortest path */
  pickFrom: null,
  /** Node shown in double-click zoom modal */
  zoomedNodeId: null,
};

/** Ignore stale async pathway switches (e.g. aromatic images still loading). */
let pathwaySwitchSeq = 0;

function graphPathwayFor(network) {
  return network?._aromatic ? "aromatic" : "aliphatic";
}

function updatePathwayTabs(pathway) {
  document.querySelectorAll(".pathway-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pathway === pathway);
    btn.setAttribute(
      "aria-selected",
      btn.dataset.pathway === pathway ? "true" : "false"
    );
  });
}

async function loadPathwayData(pathway) {
  const [nodesRes, reactionsRes, layoutRes] = await Promise.all([
    fetch(`${dataFileUrl(pathway, "nodes.json")}?v=${DATA_CACHE}`),
    fetch(`${dataFileUrl(pathway, "reactions.json")}?v=${DATA_CACHE}`),
    fetch(`${dataFileUrl(pathway, "layout.json")}?v=${DATA_CACHE}`),
  ]);
  if (!nodesRes.ok || !reactionsRes.ok) {
    throw new Error(
      `Could not load ${pathway} data (${nodesRes.status}). Check your connection and refresh the page.`
    );
  }
  const nodesJson = await nodesRes.json();
  const reactionsJson = await reactionsRes.json();
  state.layout = layoutRes.ok
    ? await layoutRes.json()
    : { positions: {}, zones: [] };
  state.nodes = nodesJson.nodes;
  state.reactions = reactionsJson.reactions;
  state.nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
  state.adjacency = buildAdjacency(state.reactions);
}

function populateSelects() {
  const sorted = [...state.nodes].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  const fromSel = document.getElementById("from-select");
  const toSel = document.getElementById("to-select");
  fromSel.innerHTML = "";
  toSel.innerHTML = "";

  for (const n of sorted) {
    fromSel.append(new Option(n.label, n.id));
    toSel.append(new Option(n.label, n.id));
  }

  const cfg = PATHWAYS[state.pathway];
  if (state.nodeMap.has(cfg.defaultFrom)) {
    fromSel.value = cfg.defaultFrom;
  }
  if (state.nodeMap.has(cfg.defaultTo)) {
    toSel.value = cfg.defaultTo;
  }
}

function nodeLabel(id) {
  const n = state.nodeMap.get(id);
  return n ? n.label : id;
}

function renderZoneLabels() {
  const container = document.getElementById("zone-labels");
  const zones = state.layout?.zones || [];

  const updatePositions = () => {
    if (!state.network) return;
    container.innerHTML = "";
    for (const z of zones) {
      const dom = document.createElement("span");
      dom.className = `zone-label zone-label--${z.id}`;
      dom.textContent = z.label;
      const canvasPos = state.network.canvasToDOM({ x: z.x, y: z.y });
      dom.style.left = `${canvasPos.x}px`;
      dom.style.top = `${canvasPos.y}px`;
      container.appendChild(dom);
    }
  };

  state.network.on("afterDrawing", updatePositions);
  state.network.on("zoom", updatePositions);
  state.network.on("dragging", updatePositions);
  updatePositions();
}

function destroyGraph() {
  unbindAromaticArrowOverlay();
  if (state.network) {
    state.network.destroy();
    state.network = null;
  }
  document.getElementById("zone-labels").innerHTML = "";
  const overlay = document.getElementById("node-labels");
  if (overlay) {
    overlay.innerHTML = "";
  }
}

function buildGraph() {
  document.getElementById("build-badge")?.remove();
  const container = document.getElementById("graph");
  state.network = createMindMapGraph(
    container,
    state.nodes,
    state.reactions,
    state.layout,
    { showStructureImages: state.pathway === "aromatic" }
  );
  mountNodeLabelOverlays(state.nodes, {
    showStructureImages: state.pathway === "aromatic",
    network: state.network,
    onLayoutChange: () => syncNodeLabelPositions(state.network),
  });
  bindNodeLabelSync(state.network);
  state.network._aromaticEdgeOffsetFromLabels = aromaticEdgeEndpointOffsetFromLabels;
  syncArrowLayerPlacement(state.network);
  bindAromaticArrowOverlay(state.network, showEdgeDetail);
  bindNodeLabelClicks(scheduleNodePick, openNodeZoomModal, cancelNodePick);
  wireNetworkEvents();
  wireMapBackgroundClick();
  renderZoneLabels();
  fitMindMap(state.network, false);
  const redraw = () => {
    if (state.pathway === "aromatic") syncVisBoxesToLabels(state.network);
    syncNodeLabelPositions(state.network);
    refreshAromaticEdges(state.network);
    state.network._drawAromaticArrows?.();
  };
  requestAnimationFrame(redraw);
  setTimeout(redraw, 300);
  setTimeout(redraw, 1200);
  if (state.pathway === "aromatic") {
    setTimeout(() => fitMindMap(state.network, false), 100);
  }
  setTimeout(() => syncNodeLabelPositions(state.network), 150);
}

async function switchPathway(pathway) {
  const graphMatches =
    state.network && graphPathwayFor(state.network) === pathway;
  if (pathway === state.pathway && graphMatches) return;

  const switchId = ++pathwaySwitchSeq;
  const previousPathway = state.pathway;

  clearHighlight();
  document.getElementById("detail-panel").classList.add("hidden");
  updatePathwayTabs(pathway);

  destroyGraph();

  try {
    await loadPathwayData(pathway);
    if (switchId !== pathwaySwitchSeq) return;

    state.pathway = pathway;
    buildGraph();
    populateSelects();

    const cfg = PATHWAYS[pathway];
    document.querySelector(".toolbar-brand h1").textContent =
      `Organic Pathways — ${cfg.label}`;

  } catch (err) {
    if (switchId === pathwaySwitchSeq) {
      destroyGraph();
      state.pathway = previousPathway;
      updatePathwayTabs(previousPathway);
      const cfg = PATHWAYS[previousPathway];
      document.querySelector(".toolbar-brand h1").textContent =
        `Organic Pathways — ${cfg.label}`;
      if (previousPathway) {
        switchPathway(previousPathway).catch(console.error);
      }
    }
    throw err;
  }
}

function renderPathBanner(paths, start) {
  const banner = document.getElementById("path-banner");
  const status = document.getElementById("path-status");
  const routesEl = document.getElementById("path-routes");

  if (paths.length === 0) {
    banner.classList.remove("hidden");
    status.textContent = "No route found within step limit.";
    routesEl.innerHTML = "";
    document.querySelector(".route-steps")?.remove();
    return;
  }

  banner.classList.remove("hidden");
  const steps = paths[0].length;
  const tie =
    paths.length > 1
      ? ` · ${paths.length} equally short routes`
      : "";
  status.textContent = `Shortest route: ${steps} step(s)${tie}`;

  routesEl.innerHTML = "";
  paths.forEach((edgePath, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `route-chip${index === 0 ? " active" : ""}`;
    chip.textContent = paths.length > 1 ? `Route ${index + 1}` : "Show steps";
    chip.addEventListener("click", () => selectPath(index));
    routesEl.appendChild(chip);
  });

  let stepsPanel = document.querySelector(".route-steps");
  if (!stepsPanel) {
    stepsPanel = document.createElement("div");
    stepsPanel.className = "route-steps";
    banner.appendChild(stepsPanel);
  }
  renderStepsPanel(stepsPanel, paths[0], start);
}

function renderStepsPanel(panel, edgePath, start) {
  const chain = pathToNodeSequence(start, edgePath)
    .map(nodeLabel)
    .join(" → ");
  panel.innerHTML = `<p class="path-chain">${chain}</p>`;
  edgePath.forEach((r, i) => {
    panel.insertAdjacentHTML(
      "beforeend",
      renderPathStepTable(r, i + 1, nodeLabel)
    );
  });
}

function selectPath(index) {
  state.activePathIndex = index;
  const edgePath = state.currentPaths[index];
  const start =
    edgePath.length > 0
      ? edgePath[0].from
      : document.getElementById("from-select").value;
  const nodeSeq = pathToNodeSequence(start, edgePath);

  document.querySelectorAll(".route-chip").forEach((c, i) => {
    c.classList.toggle("active", i === index);
  });

  const stepsPanel = document.querySelector(".route-steps");
  if (stepsPanel) renderStepsPanel(stepsPanel, edgePath, start);

  applyGraphHighlight(nodeSeq, edgePath.map((e) => e.id));
  setNodeLabelHighlight(new Set(nodeSeq));
  state.network.fit({
    nodes: nodeSeq,
    animation: { duration: 450, easingFunction: "easeInOutQuad" },
  });
}

function closeNodeZoomModal() {
  state.zoomedNodeId = null;
  const modal = document.getElementById("node-zoom-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("node-zoom-content").innerHTML = "";
  }
  clearNodeZoomFocus();
}

function openNodeZoomModal(nodeId) {
  const n = state.nodeMap.get(nodeId);
  if (!n || !state.network) return;

  cancelNodePick();
  state.zoomedNodeId = nodeId;
  state.pickFrom = null;
  document.getElementById("detail-panel").classList.add("hidden");

  applyGraphHighlight([nodeId], []);
  setNodeLabelHighlight(new Set([nodeId]));
  setNodeZoomFocus(nodeId);

  const modal = document.getElementById("node-zoom-modal");
  const content = document.getElementById("node-zoom-content");
  const showImages = state.pathway === "aromatic";

  content.innerHTML = `
    <h2 id="node-zoom-title" class="node-zoom-title">${n.label}</h2>
    <div class="node-zoom-card">${buildNodeCardHtml(n, { showStructureImages: showImages, variant: "modal" })}</div>
  `;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  if (showImages) {
    content.querySelectorAll(".node-label-structure-wrap").forEach((wrap) => {
      const compound = wrap.dataset.compound;
      if (compound) hydrateStructureImage(wrap, compound).catch(() => {});
    });
  }
}

function wireZoomModal() {
  document.querySelectorAll("[data-zoom-dismiss]").forEach((el) => {
    el.addEventListener("click", () => {
      const hadZoom = !!state.zoomedNodeId;
      closeNodeZoomModal();
      if (hadZoom) restoreHighlightAfterZoomClose();
    });
  });
}

function clearHighlight() {
  state.currentPaths = [];
  state.pickFrom = null;
  closeNodeZoomModal();
  document.getElementById("path-banner").classList.add("hidden");
  document.querySelector(".route-steps")?.remove();
  if (state.network) {
    resetGraphHighlight();
  }
  clearNodeLabelHighlight();
}

function showPickHint(fromId) {
  const banner = document.getElementById("path-banner");
  const status = document.getElementById("path-status");
  banner.classList.remove("hidden");
  status.textContent = `From: ${nodeLabel(fromId)} — click a second compound for shortest path`;
  document.getElementById("path-routes").innerHTML = "";
  document.querySelector(".route-steps")?.remove();
}

function highlightPickedNodes(nodeIds) {
  if (!state.network) return;
  applyGraphHighlight(nodeIds, []);
  setNodeLabelHighlight(new Set(nodeIds));
}

function syncSelects(fromId, toId) {
  const fromSel = document.getElementById("from-select");
  const toSel = document.getElementById("to-select");
  if (fromId && state.nodeMap.has(fromId)) fromSel.value = fromId;
  if (toId && state.nodeMap.has(toId)) toSel.value = toId;
}

function handleNodePick(nodeId) {
  document.getElementById("detail-panel").classList.add("hidden");

  if (!state.pickFrom) {
    state.pickFrom = nodeId;
    state.currentPaths = [];
    syncSelects(nodeId, null);
    highlightPickedNodes([nodeId]);
    showPickHint(nodeId);
    return;
  }

  if (state.pickFrom === nodeId) {
    clearHighlight();
    return;
  }

  const start = state.pickFrom;
  const end = nodeId;
  state.pickFrom = null;
  syncSelects(start, end);
  runPathFind(start, end);
}

let lastBlankDoubleAt = 0;

function handleCanvasBlankClick() {
  if (Date.now() - lastBlankDoubleAt < 450) return;
  clearHighlight();
  document.getElementById("detail-panel").classList.add("hidden");
}

function isBlankCanvasHit(params) {
  if (!state.network) return false;
  const src = params.event?.srcEvent || params.event;
  if (src?.target?.closest?.(".node-label")) return false;

  const nodeId = getClickedNodeId(params);
  if (nodeId) return false;
  if (params.edges?.length) return false;

  if (params.pointer?.DOM && typeof state.network.getEdgeAt === "function") {
    const canvasPos = state.network.DOMtoCanvas(params.pointer.DOM);
    if (state.network.getEdgeAt(canvasPos)) return false;
  }
  return true;
}

function handleCanvasBlankDoubleClick() {
  lastBlankDoubleAt = Date.now();
  closeNodeZoomModal();
  clearHighlight();
  document.getElementById("detail-panel").classList.add("hidden");
  if (!state.network) return;
  fitMindMap(state.network, true);
  state.network.once("animationFinished", () => {
    if (state.pathway === "aromatic") syncVisBoxesToLabels(state.network);
    syncNodeLabelPositions(state.network);
  });
}

function restoreHighlightAfterZoomClose() {
  if (state.currentPaths.length > 0) {
    selectPath(state.activePathIndex);
  } else if (state.pickFrom) {
    highlightPickedNodes([state.pickFrom]);
  } else if (state.network) {
    resetGraphHighlight();
    clearNodeLabelHighlight();
  }
}

function wireDetailActions(content, nodeId) {
  content.querySelector("[data-set-from]")?.addEventListener("click", () => {
    document.getElementById("from-select").value = nodeId;
  });
  content.querySelector("[data-set-to]")?.addEventListener("click", () => {
    document.getElementById("to-select").value = nodeId;
  });
}

function showNodeDetail(nodeId) {
  const n = state.nodeMap.get(nodeId);
  if (!n) return;

  const out = state.reactions.filter(
    (r) => r.from === nodeId && !r.disabled_for_pathfinding && r.from !== r.to
  );
  const inn = state.reactions.filter(
    (r) => r.to === nodeId && !r.disabled_for_pathfinding && r.from !== r.to
  );

  const content = document.getElementById("detail-content");
  content.innerHTML = renderNodeDetailPanel(n, out, inn, nodeLabel, nodeId);
  document.getElementById("detail-panel").classList.remove("hidden");
  wireDetailActions(content, nodeId);
}

function showEdgeDetail(reactionId) {
  const r = state.reactions.find((x) => x.id === reactionId);
  if (!r) return;

  const content = document.getElementById("detail-content");
  content.innerHTML = `
    <h3>Reaction</h3>
    ${renderReactionTable(r, nodeLabel)}
  `;
  document.getElementById("detail-panel").classList.remove("hidden");

  applyGraphHighlight([r.from, r.to], [r.id]);
  setNodeLabelHighlight(new Set([r.from, r.to]));
}

function runPathFind(start, end) {
  if (start == null) start = document.getElementById("from-select").value;
  if (end == null) end = document.getElementById("to-select").value;

  if (start === end) {
    const banner = document.getElementById("path-banner");
    banner.classList.remove("hidden");
    document.getElementById("path-status").textContent =
      "Choose different start and end.";
    document.getElementById("path-routes").innerHTML = "";
    return;
  }

  state.currentPaths = findShortestPaths(state.adjacency, start, end, 12);
  renderPathBanner(state.currentPaths, start);

  if (state.currentPaths.length > 0) {
    selectPath(0);
  } else {
    resetGraphHighlight();
    clearNodeLabelHighlight();
  }
}

let nodePickTimer = null;

/** Debounce single-click path pick so double-click can open zoom without a second pick firing. */
function scheduleNodePick(nodeId) {
  clearTimeout(nodePickTimer);
  if (state.pickFrom && state.pickFrom !== nodeId) {
    handleNodePick(nodeId);
    return;
  }
  nodePickTimer = setTimeout(() => handleNodePick(nodeId), 280);
}

function cancelNodePick() {
  clearTimeout(nodePickTimer);
}

function getClickedNodeId(params) {
  if (params.nodes?.length) return params.nodes[0];

  const src = params.event?.srcEvent || params.event;
  if (src?.clientX != null && src?.clientY != null) {
    const hit = document.elementFromPoint(src.clientX, src.clientY);
    const labelId = hit?.closest?.(".node-label")?.dataset?.id;
    if (labelId) return labelId;
  }

  if (!state.network || !params.pointer?.DOM) return null;
  const canvasPos = state.network.DOMtoCanvas(params.pointer.DOM);
  return state.network.getNodeAt({ x: canvasPos.x, y: canvasPos.y }) ?? null;
}

function wireNetworkEvents() {
  state.network.on("click", (params) => {
    const src = params.event?.srcEvent || params.event;
    if (src?.target?.closest?.(".node-label")) return;

    const nodeId = getClickedNodeId(params);
    if (nodeId) {
      scheduleNodePick(nodeId);
      return;
    }
    if (params.edges.length) {
      showEdgeDetail(params.edges[0]);
      return;
    }
    if (params.pointer?.DOM && typeof state.network.getEdgeAt === "function") {
      const canvasPos = state.network.DOMtoCanvas(params.pointer.DOM);
      const edgeId = state.network.getEdgeAt(canvasPos);
      if (edgeId) {
        showEdgeDetail(edgeId);
        return;
      }
    }
    handleCanvasBlankClick();
  });

  state.network.on("doubleClick", (params) => {
    cancelNodePick();
    const nodeId = getClickedNodeId(params);
    if (nodeId) {
      params.event?.preventDefault?.();
      openNodeZoomModal(nodeId);
      return;
    }
    if (isBlankCanvasHit(params)) {
      params.event?.preventDefault?.();
      handleCanvasBlankDoubleClick();
    }
  });
}

/** Backup: clear when clicking empty canvas (not on a node, edge, or label) */
function wireMapBackgroundClick() {
  const stage = document.querySelector(".map-stage");
  const graph = document.getElementById("graph");
  if (!stage || !graph || stage.dataset.bgClickBound === "1") return;
  stage.dataset.bgClickBound = "1";

  stage.addEventListener("click", (e) => {
    if (e.target.closest(".node-label")) return;
    if (e.target.closest("#detail-panel")) return;
    if (e.target.closest("#node-zoom-modal")) return;
    const canvas = graph.querySelector("canvas");
    if (!canvas || (e.target !== canvas && !canvas.contains(e.target))) return;
    if (!state.network) return;

    const rect = canvas.getBoundingClientRect();
    const dom = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPos = state.network.DOMtoCanvas(dom);

    if (state.network.getNodeAt(canvasPos)) return;
    if (typeof state.network.getEdgeAt === "function") {
      const edgeAt = state.network.getEdgeAt(canvasPos);
      if (edgeAt) return;
    }

    handleCanvasBlankClick();
  });

  stage.addEventListener("dblclick", (e) => {
    if (e.target.closest(".node-label")) return;
    if (e.target.closest("#detail-panel")) return;
    if (e.target.closest("#node-zoom-modal")) return;
    const canvas = graph.querySelector("canvas");
    if (!canvas || (e.target !== canvas && !canvas.contains(e.target))) return;
    if (!state.network) return;

    const rect = canvas.getBoundingClientRect();
    const dom = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPos = state.network.DOMtoCanvas(dom);

    if (state.network.getNodeAt(canvasPos)) return;
    if (typeof state.network.getEdgeAt === "function") {
      const edgeAt = state.network.getEdgeAt(canvasPos);
      if (edgeAt) return;
    }

    e.preventDefault();
    handleCanvasBlankDoubleClick();
  });
}

function wireToolbarEvents() {
  document.getElementById("find-btn").addEventListener("click", () => runPathFind());
  document.getElementById("clear-btn").addEventListener("click", () => {
    clearHighlight();
    document.getElementById("detail-panel").classList.add("hidden");
  });
  document.getElementById("swap-btn").addEventListener("click", () => {
    const from = document.getElementById("from-select");
    const to = document.getElementById("to-select");
    [from.value, to.value] = [to.value, from.value];
  });

  document.getElementById("fit-btn").addEventListener("click", () => {
    if (!state.network) return;
    fitMindMap(state.network, true);
    state.network.once("animationFinished", () => {
      if (state.pathway === "aromatic") syncVisBoxesToLabels(state.network);
      syncNodeLabelPositions(state.network);
    });
  });

  document.getElementById("zoom-in-btn").addEventListener("click", () => {
    if (!state.network) return;
    const scale = clampScale(state.network, state.network.getScale() * 1.2);
    state.network.moveTo({ scale, animation: true });
    state.network.once("animationFinished", () => constrainView(state.network));
  });

  document.getElementById("zoom-out-btn").addEventListener("click", () => {
    if (!state.network) return;
    const scale = clampScale(state.network, state.network.getScale() / 1.2);
    state.network.moveTo({ scale, animation: true });
    state.network.once("animationFinished", () => constrainView(state.network));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !state.network) return;
    closeNodeZoomModal();
    fitMindMap(state.network, true);
  });

  document.getElementById("detail-close").addEventListener("click", () => {
    document.getElementById("detail-panel").classList.add("hidden");
    if (state.currentPaths.length > 0 || state.pickFrom) {
      highlightPickedNodes(
        state.currentPaths.length > 0
          ? pathToNodeSequence(
              document.getElementById("from-select").value,
              state.currentPaths[state.activePathIndex]
            )
          : [state.pickFrom]
      );
    } else if (state.network) {
      resetGraphHighlight();
      clearNodeLabelHighlight();
    }
  });

  document.querySelectorAll(".pathway-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pathway = btn.dataset.pathway;
      if (pathway) {
        switchPathway(pathway).catch(console.error);
      }
    });
  });
}

function wireViewportConstraints() {
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.network?._fitScale) return;
      recordFitScale(state.network);
      constrainView(state.network);
    }, 250);
  });
}

async function init() {
  try {
    wireToolbarEvents();
    wireZoomModal();
    wireViewportConstraints();
    await switchPathway("aliphatic");
  } catch (err) {
    const banner = document.getElementById("path-banner");
    banner.classList.remove("hidden");
    document.getElementById("path-status").textContent = err.message;
    console.error(err);
  }
}

init();
