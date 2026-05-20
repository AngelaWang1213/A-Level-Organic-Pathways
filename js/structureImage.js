/**
 * 2D structure images: PubChem (primary), optional CAS Common Chemistry SVG,
 * ChemSpider / CAS search links when embedding fails.
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * @see https://commonchemistry.cas.org/api-overview
 * @see http://www.chemspider.com/
 */

const PUBCHEM_PNG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";
const MOLVIEW_SEARCH = "https://molview.org/";
const CAS_DETAIL = "https://commonchemistry.cas.org/detail";
const CAS_API_DETAIL = "https://commonchemistry.cas.org/api/detail";
const CHEMSPIDER_COMPOUND = "https://www.chemspider.com/Chemical-Structure";
const CHEMSPIDER_IMAGE = "https://www.chemspider.com/ImagesHandler.ashx";

/** Resolve project-relative path (e.g. images/structures/foo.png) to full URL under /web/. */
export function structureImageUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith("/")) {
    return relativePath;
  }
  return new URL(relativePath, window.location.href).href;
}

/** Skip generic / polymer examples that have no single structure */
const SKIP_IMAGE = new Set([
  "poly(ethene)",
  "N-alkylbenzamide",
  "N-ethylethanamide",
  "coupling with phenol",
  "coupling with phenylamine",
  "coupling with naphthalen-2-ol",
]);

const NAME_ALIASES = {
  chloroethane: "chloroethane",
  "1,2-dibromoethane": "1,2-dibromoethane",
  "ethyl ethanoate": "ethyl ethanoate",
  "sodium ethanoate": "sodium acetate",
  "sodium phenoxide": "sodium phenoxide",
  "phenylammonium chloride": "anilinium chloride",
  "benzenediazonium chloride": "benzenediazonium chloride",
  "2,4,6-tribromophenol": "2,4,6-tribromophenol",
  "phenyl ethanoate": "phenyl acetate",
  phenylethanone: "acetophenone",
};

/** PubChem CID (resolved name) — more reliable than name-only PNG */
const PUBCHEM_CID = {
  benzene: 241,
  methylbenzene: 1140,
  acetophenone: 7410,
  nitrobenzene: 7416,
  phenylamine: 6115,
  "anilinium chloride": 8870,
  "benzenediazonium chloride": 60992,
  chlorobenzene: 7964,
  "sodium phenoxide": 66602278,
  phenol: 996,
  "phenyl acetate": 31229,
  "sodium benzoate": 517055,
  "benzoic acid": 243,
  "2,4,6-tribromophenol": 1483,
};

/** CAS Registry Number for [CAS Common Chemistry](https://commonchemistry.cas.org/) */
const CAS_RN = {
  benzene: "71-43-2",
  methylbenzene: "108-88-3",
  acetophenone: "98-86-2",
  nitrobenzene: "98-95-3",
  phenylamine: "62-53-3",
  "anilinium chloride": "142-04-1",
  "benzenediazonium chloride": "100-34-5",
  chlorobenzene: "108-90-7",
  "sodium phenoxide": "139-02-6",
  phenol: "108-95-2",
  "phenyl acetate": "122-79-0",
  "sodium benzoate": "532-32-1",
  "benzoic acid": "65-85-0",
  "2,4,6-tribromophenol": "118-79-6",
};

/** ChemSpider compound ID for [ChemSpider](http://www.chemspider.com/) links */
const CHEMSPIDER_CSID = {
  benzene: 681,
  methylbenzene: 1108,
  acetophenone: 7412,
  nitrobenzene: 7365,
  phenylamine: 5833,
  "anilinium chloride": 6914875,
  "benzenediazonium chloride": 10333309,
  chlorobenzene: 7239,
  "sodium phenoxide": 83153,
  phenol: 996,
  "phenyl acetate": 7580,
  "sodium benzoate": 29126,
  "benzoic acid": 636462,
  "2,4,6-tribromophenol": 83545,
};

export function resolveCompoundName(example) {
  if (!example || typeof example !== "string") return null;
  const trimmed = example.trim();
  if (SKIP_IMAGE.has(trimmed)) return null;
  return NAME_ALIASES[trimmed] ?? trimmed;
}

export function pubChemStructureImageUrl(compoundName, size = "200x200") {
  const name = resolveCompoundName(compoundName);
  if (!name) return null;
  const cid = PUBCHEM_CID[name];
  if (cid) {
    return `${PUBCHEM_PNG}/cid/${cid}/PNG?image_size=${size}`;
  }
  return `${PUBCHEM_PNG}/name/${encodeURIComponent(name)}/PNG?image_size=${size}`;
}

export function molViewSearchUrl(compoundName) {
  const name = resolveCompoundName(compoundName);
  if (!name) return MOLVIEW_SEARCH;
  return `${MOLVIEW_SEARCH}?q=${encodeURIComponent(name)}`;
}

export function casCommonChemistryUrl(compoundName) {
  const name = resolveCompoundName(compoundName);
  const casRn = name && CAS_RN[name];
  if (!casRn) {
    return `https://commonchemistry.cas.org/?q=${encodeURIComponent(compoundName)}`;
  }
  return `${CAS_DETAIL}?cas_rn=${encodeURIComponent(casRn)}`;
}

export function chemSpiderUrl(compoundName) {
  const name = resolveCompoundName(compoundName);
  const csid = name && CHEMSPIDER_CSID[name];
  if (csid) return `${CHEMSPIDER_COMPOUND}.${csid}.html`;
  return `http://www.chemspider.com/Search.aspx?q=${encodeURIComponent(compoundName)}`;
}

function chemSpiderImageUrl(compoundName) {
  const name = resolveCompoundName(compoundName);
  const csid = name && CHEMSPIDER_CSID[name];
  if (!csid) return null;
  return `${CHEMSPIDER_IMAGE}?id=${csid}`;
}

/**
 * Ordered image URLs to try (PubChem CID → PubChem name → ChemSpider thumbnail).
 */
export function getStructureImageCandidates(compoundName) {
  const name = resolveCompoundName(compoundName);
  if (!name) return [];

  const seen = new Set();
  const out = [];

  const add = (src, source) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, source });
  };

  const cid = PUBCHEM_CID[name];
  if (cid) {
    add(`${PUBCHEM_PNG}/cid/${cid}/PNG?image_size=200x200`, "pubchem-cid");
  }
  add(`${PUBCHEM_PNG}/name/${encodeURIComponent(name)}/PNG?image_size=200x200`, "pubchem-name");
  add(chemSpiderImageUrl(compoundName), "chemspider");

  return out;
}

export function getCasRegistryNumber(compoundName) {
  const name = resolveCompoundName(compoundName);
  return name ? CAS_RN[name] || null : null;
}

/**
 * Optional: set localStorage.casCommonChemistryApiKey after registering at
 * https://www.cas.org/services/commonchemistry-api
 */
export function getCasApiKey() {
  try {
    return localStorage.getItem("casCommonChemistryApiKey")?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchCasStructureSvg(casRn) {
  const apiKey = getCasApiKey();
  if (!apiKey || !casRn) return null;

  try {
    const url = `${CAS_API_DETAIL}?cas_rn=${encodeURIComponent(casRn)}`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const svg = data?.image;
    return typeof svg === "string" && svg.includes("<svg") ? svg : null;
  } catch {
    return null;
  }
}

export function getStructureReferenceLinks(compoundName) {
  return {
    molview: molViewSearchUrl(compoundName),
    cas: casCommonChemistryUrl(compoundName),
    chemspider: chemSpiderUrl(compoundName),
  };
}

function probeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.referrerPolicy = "no-referrer";
    img.src = src;
  });
}

/**
 * Load best available structure image into the wrap (async fallbacks).
 */
export async function hydrateStructureImage(wrap, compoundName) {
  const img = wrap.querySelector(".node-label-structure");
  if (!img) return;

  if (wrap.dataset.localImage === "1") {
    return;
  }

  const initial = img.getAttribute("src")?.trim();
  if (initial && (await probeImage(initial))) {
    img.removeAttribute("hidden");
    return;
  }

  const candidates = getStructureImageCandidates(compoundName);
  for (const { src } of candidates) {
    if (await probeImage(src)) {
      img.src = src;
      img.removeAttribute("hidden");
      return;
    }
  }

  const casRn = getCasRegistryNumber(compoundName);
  const svg = await fetchCasStructureSvg(casRn);
  if (svg) {
    const slot = document.createElement("div");
    slot.className = "node-label-structure-svg";
    slot.innerHTML = svg;
    img.replaceWith(slot);
    return;
  }

  img.remove();
  const miss = document.createElement("p");
  miss.className = "node-label-structure-missing";
  miss.textContent = "No structure image available";
  wrap.appendChild(miss);
}
