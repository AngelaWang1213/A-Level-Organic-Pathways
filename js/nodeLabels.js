import { refreshAromaticEdges } from "./graph.js?v=20260521e";
import {
  getStructureImageCandidates,
  getCasRegistryNumber,
  resolveCompoundName,
  hydrateStructureImage,
  structureImageUrl,
} from "./structureImage.js?v=20260520n";

const IMAGE_SIZE = { map: 120, modal: 220 };

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildNodeCardHtml(n, opts = {}) {
  const showStructureImages = opts.showStructureImages === true;
  const variant = opts.variant === "modal" ? "modal" : "map";
  const imgPx = IMAGE_SIZE[variant];

  let html = `<div class="node-label-title">${escapeHtml(n.label)}</div>`;

  const compound = n.example || n.structure_name;
  const resolved = compound ? resolveCompoundName(compound) : null;
  const localSrc = n.structure_image
    ? structureImageUrl(n.structure_image)
    : null;
  /** Custom PNG works even when example is in SKIP_IMAGE (e.g. "coupling with phenol"). */
  const showStructure =
    showStructureImages && (localSrc || (compound && resolved));

  if (showStructure) {
    const candidates = localSrc ? [] : getStructureImageCandidates(compound);
    const firstSrc =
      localSrc || (candidates.length > 0 ? candidates[0].src : null);

    if (firstSrc || localSrc || getCasRegistryNumber(compound)) {
      const localImg = Boolean(localSrc);
      html += `<div class="node-label-structure-wrap${
        localImg ? " node-label-structure-wrap--local" : ""
      }" data-compound="${escapeHtml(compound)}"${
        localImg ? ' data-local-image="1"' : ""
      }>
      <img
        class="node-label-structure"
        src="${escapeHtml(firstSrc || "")}"
        alt="${escapeHtml(compound)} structure"
        width="${imgPx}"
        height="${imgPx}"
        loading="${localImg ? "eager" : "lazy"}"
        decoding="async"
        referrerpolicy="no-referrer"
        ${localImg ? "" : "hidden"}
      />
    </div>`;
    }
  }

  if (n.example) {
    html += `<div class="node-label-detail">(${escapeHtml(n.example)})</div>`;
  }
  if (n.displayed_formula) {
    html += `<div class="node-label-detail">${escapeHtml(n.displayed_formula)}</div>`;
  }
  return html;
}

function wireStructureImageFallback(root, onImageReady) {
  root.querySelectorAll(".node-label-structure-wrap").forEach((wrap) => {
    const compound = wrap.dataset.compound;
    if (!compound) return;

    if (wrap.dataset.localImage === "1") {
      const img = wrap.querySelector(".node-label-structure");
      if (img) {
        const done = () => onImageReady?.();
        if (img.complete && img.naturalWidth > 0) {
          done();
        } else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      } else {
        onImageReady?.();
      }
      return;
    }

    hydrateStructureImage(wrap, compound)
      .then(() => onImageReady?.())
      .catch(() => onImageReady?.());
  });
}

/** Measure label card and resize vis hit-box to match (graph coordinates). */
export function syncVisBoxesToLabels(network) {
  const spec = network?._nodeBoxSpec;
  if (!spec || spec.mode !== "aromatic" || !network.body?.data) return;
  if (network._syncingVisBoxes) return;

  const margin = spec.margin ?? 18;
  const boxPad = spec.boxSyncPadding ?? 4;
  const minW = spec.widthConstraint.minimum;
  const minH = spec.heightConstraint.minimum;
  const maxW = spec.widthConstraint.maximum;
  const maxH = spec.heightConstraint.maximum;
  const data = network.body.data;
  const scale = network.getScale() || 1;

  if (!network._nodeDimensions) {
    network._nodeDimensions = new Map();
  }

  const updates = [];

  document.querySelectorAll(".node-labels--aromatic .node-label").forEach((el) => {
    const id = el.dataset.id;
    if (!id) return;

    const rect = el.getBoundingClientRect();
    const contentW = rect.width / scale;
    const contentH = rect.height / scale;

    const w = Math.min(maxW, Math.max(minW, Math.ceil(contentW) + boxPad));
    const h = Math.min(maxH, Math.max(minH, Math.ceil(contentH) + boxPad));

    const prev = network._nodeDimensions.get(id);
    if (prev?.width === w && prev?.height === h) return;

    network._nodeDimensions.set(id, { width: w, height: h });
    updates.push({
      id,
      shape: "box",
      margin,
      width: w,
      height: h,
      borderWidth: spec.borderWidth,
      shapeProperties: spec.shapeProperties,
    });
  });

  if (updates.length === 0) return;

  network._syncingVisBoxes = true;
  try {
    data.nodes.update(updates);
    refreshAromaticEdges(network);
    network._drawAromaticArrows?.();
  } finally {
    network._syncingVisBoxes = false;
  }
}

export function mountNodeLabelOverlays(nodes, options = {}) {
  const showStructureImages = options.showStructureImages === true;
  const overlay = document.getElementById("node-labels");
  if (!overlay) return;
  overlay.className = showStructureImages
    ? "node-labels node-labels--aromatic"
    : "node-labels node-labels--aliphatic";
  overlay.innerHTML = "";

  const onLayoutChange = options.onLayoutChange;
  const network = options.network;

  for (const n of nodes) {
    const el = document.createElement("div");
    el.className = `node-label node-label--tier-${(n.tier || "A2").toLowerCase()}`;
    el.dataset.id = n.id;
    el.innerHTML = buildNodeCardHtml(n, { showStructureImages, variant: "map" });
    overlay.appendChild(el);
  }

  const scheduleBoxSync = () => {
    if (!document.body.contains(overlay) || !network?.body?.data) return;
    if (network._nodeBoxSpec?.mode === "aromatic") {
      requestAnimationFrame(() => {
        if (!network?.body?.data) return;
        syncVisBoxesToLabels(network);
        onLayoutChange?.();
      });
    } else {
      onLayoutChange?.();
    }
  };

  scheduleBoxSync();
  if (showStructureImages) {
    wireStructureImageFallback(overlay, scheduleBoxSync);
  }
}

export function syncNodeLabelPositions(network) {
  const overlay = document.getElementById("node-labels");
  if (!overlay || !network?.body?.data) return;

  const scale = network.getScale();
  const ids = network.body.data.nodes.getIds();

  for (const id of ids) {
    const el = overlay.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!el) continue;

    const pos = network.getPositions([id])[id];
    const dom = network.canvasToDOM(pos);
    el.style.left = `${dom.x}px`;
    el.style.top = `${dom.y}px`;
    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}

export function setNodeLabelHighlight(activeNodeIds) {
  document.querySelectorAll(".node-label").forEach((el) => {
    const active = activeNodeIds.has(el.dataset.id);
    el.classList.toggle("active", active);
    el.classList.toggle("dimmed", !active && activeNodeIds.size > 0);
  });
}

export function clearNodeLabelHighlight() {
  document.querySelectorAll(".node-label").forEach((el) => {
    el.classList.remove("active", "dimmed", "zoom-focus");
  });
}

export function setNodeZoomFocus(nodeId) {
  document.querySelectorAll(".node-label").forEach((el) => {
    el.classList.toggle("zoom-focus", el.dataset.id === nodeId);
  });
}

export function clearNodeZoomFocus() {
  document.querySelectorAll(".node-label").forEach((el) => {
    el.classList.remove("zoom-focus");
  });
}

export function bindNodeLabelSync(network) {
  const sync = () => {
    if (!network.body?.data || network._syncingVisBoxes) return;
    syncNodeLabelPositions(network);
    if (network._nodeBoxSpec?.mode === "aromatic") {
      syncVisBoxesToLabels(network);
    }
    if (network._svgArrows) {
      requestAnimationFrame(() => network._drawAromaticArrows?.());
    }
  };
  network.on("afterDrawing", sync);
  network.on("zoom", sync);
  network.on("dragging", sync);
  network.on("animationFinished", sync);
  sync();
}

/** Single click = path pick; double click = zoom card (delegated — survives remount) */
export function bindNodeLabelClicks(onNodeClick, onNodeDblClick, onCancelPendingClick) {
  const overlay = document.getElementById("node-labels");
  if (!overlay || overlay.dataset.clickBound === "1") return;
  overlay.dataset.clickBound = "1";

  overlay.addEventListener("click", (e) => {
    const label = e.target.closest(".node-label");
    if (!label) return;
    if (e.target.closest(".node-label-ext-link")) return;

    e.stopPropagation();
    const id = label.dataset.id;
    if (!id) return;

    onNodeClick(id);
  });

  overlay.addEventListener("dblclick", (e) => {
    const label = e.target.closest(".node-label");
    if (!label) return;
    if (e.target.closest(".node-label-ext-link")) return;

    e.stopPropagation();
    e.preventDefault();
    onCancelPendingClick?.();

    const id = label.dataset.id;
    if (id && onNodeDblClick) onNodeDblClick(id);
  });
}
