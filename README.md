# WJEC A2 Organic Pathways

First-version reaction database extracted from **A2 - Organic mind map.pdf**.

## Data files

| Path | Purpose |
|------|---------|
| `data/aliphatic/nodes.json` | Aliphatic functional group nodes |
| `data/aliphatic/reactions.json` | Aliphatic reactions |
| `data/aliphatic/layout.json` | Aliphatic mind-map positions |
| `data/aromatic/nodes.json` | Aromatic pathway nodes |
| `data/aromatic/reactions.json` | Aromatic reactions |
| `data/aromatic/layout.json` | Aromatic mind-map positions |

## Source & review

- **Source:** Desktop `A2 - Organic mind map.pdf` (text-extractable version).
- **Status:** Draft — check arrows and conditions with your teacher before exams.
- **Known fixes applied:** Industrial hydration temperature `3000 C` → `300 °C`; duplicate carboxylic acid boxes merged to one node.

## Pathfinding notes

- Reactions with `"disabled_for_pathfinding": true` are no-ops or tests only (e.g. Tollens as test, tertiary alcohol no reaction).
- Esterification is stored as `carboxylic_acid → ester` (alcohol required in `reagents`).
- Acid/alkaline ester hydrolysis lists `also_forms` for the co-product (future app can expand edges).

## Web app (mind map + shortest path)

```bash
cd "/Users/angela/Desktop/Chem organic"
python3 -m http.server 8080
```

Open in browser: **http://localhost:8080/web/** (must use this URL — not `file://`)

After updates, hard-refresh (**Cmd+Shift+R** on Mac) so the browser reloads JavaScript modules.

- **Aliphatic / Aromatic tabs** — switch pathway maps in the toolbar
- **Full-screen mind map** — fixed layout; pinch/scroll to zoom
- **Shortest path** between two compounds (plus equally short alternatives where applicable)
- Click any arrow for structured reaction details (reagents, conditions, mechanism)

## Next steps

- Refine aromatic layout positions after review with your map.
- Quiz mode.
- `aliases.json` for NaOH / KOH(aq) etc.
