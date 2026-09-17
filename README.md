# WMC Tract Endpoint Decoding Viewer

Interactive visualization of white matter tract endpoint decoding using Neurosynth meta-analytic topics, built for the [brainlife.io](https://brainlife.io) platform.

## What it shows

The viewer has two exploration modes accessible from the sidebar:

**Cluster Mode** — browse tracts grouped by hierarchical clustering:
- Dendrogram showing tract similarity structure
- Per-cluster cortical surface map, radar chart, and word cloud (pre-generated PNGs)
- Tract list for each cluster (click any tract to jump to Tract Mode)

**Tract Mode** — explore individual tracts:
- Searchable list of all 51 tracts, color-coded by cluster membership
- Top 15 Neurosynth topics as a bar chart (computed live from the matrix)
- Full decoding score strip across all 104 topics

**Matrix Tab** — full 51 × 104 heatmap with hover tooltips; click any row to jump to Tract Mode.

## Data format

Each dataset lives in its own subfolder under `testdata/`:

```
testdata/
└── thr-15/                                 ← threshold 0.15, 7 clusters
    ├── matrix.csv                           ← 51 tracts × 104 topics (Pearson r)
    ├── clusters.json                        ← cluster assignments
    ├── dendro.png                           ← dendrogram image
    ├── 1_surf.png                           ← cortical surface map for cluster 1
    ├── 1_radar.png                          ← radar chart for cluster 1
    ├── 1_wordcloud.png                      ← word cloud for cluster 1
    └── … (up to N clusters)
└── thr-15_5clusters/                       ← same threshold, 5-cluster solution
    ├── matrix.csv                           ← (same matrix, different clustering)
    ├── clusters.json                        ← 5-cluster assignments
    ├── dendro.png
    └── … (5 sets of surf/radar/wordcloud)
```

### matrix.csv

CSV with header row. First column = tract name (`tract`), remaining columns = Neurosynth topic IDs
in the format `{id}_{term1}_{term2}_{term3}`. Values are Pearson correlation coefficients. Use `NaN` for missing data.

### clusters.json

```json
{
  "numClusters": 7,
  "assignments": {
    "leftCST": 4,
    "rightCST": 4,
    "leftpArc": 2,
    ...
  }
}
```

If `clusters.json` is absent, the viewer auto-detects the number of clusters by probing for `{n}_surf.png` files and splits tracts equally (placeholder only — add `clusters.json` for accurate assignments).

### Image naming convention

Cluster images must be named exactly: `{clusterIndex}_surf.png`, `{clusterIndex}_radar.png`, `{clusterIndex}_wordcloud.png`

The original filenames from Python scripts (e.g. `1_LPI+RAS_thr-15_surf.png`) need to be renamed to `1_surf.png` etc.

## Adding a new threshold / clustering

1. Create a subfolder under `testdata/` with matrix.csv, clusters.json, dendro.png, and `{n}_surf/radar/wordcloud.png` files
2. Add the entry to `config.thresholds` in `index.html`:
   ```js
   thresholds: {
     '0.15 (7 clusters)': 'thr-15',
     '0.20 (7 clusters)': 'thr-20'   // ← add here
   }
   ```

## Running locally

```bash
npm install
npm start
# opens http://localhost:3000
```

## Embedding in brainlife.io

Override `dataBase` in the `config` object to point at your brainlife output URL:

```js
config: {
  dataBase: 'https://brainlife.io/api/warehouse/download/....',
  thresholds: { '0.15': 'thr-15' },
  defaultThreshold: '0.15'
}
```

## Dependencies (CDN, no build step)

- [Vue 2](https://v2.vuejs.org/) — reactive UI
- [PapaParse](https://www.papaparse.com/) — CSV parsing

## Credits

Developed by Kim Ray, University of Texas at Austin (Pestilli Lab).  
Supported by the [brainlife.io](https://brainlife.io) platform.
