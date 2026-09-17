# White matter tract decoding UI

A dependency-free static interface for browsing 61 white-matter tracts. Select a tract to visualize its endpoints over a rendered fsaverage surface and load its decoding plot and word-cloud PNGs.

The browser-ready fsaverage preview is at `assets/fsaverage/fsaverage-pial.png`; it was generated from the supplied left/right fsaverage pial GIFTI surfaces.

## Run locally

Open `index.html` directly in a browser, or serve the directory with any static server:

```sh
python3 -m http.server 8000
```

## Decoding PNGs

The UI supports the supplied threshold variants `0.05`, `0.10`, `0.15`, and `0.20`. Copy those folders into `assets/decoding/`:

```text
assets/decoding/Decoding/threshold-05_tract_decoding/
assets/decoding/Decoding/threshold-10_tract_decoding/
assets/decoding/Decoding/threshold-15_tract_decoding/
assets/decoding/Decoding/threshold-20_tract_decoding/
```

For example, `leftArc` at threshold `0.05` loads:

```text
assets/decoding/Decoding/threshold-05_tract_decoding/leftArc_thr-05_radar.png
assets/decoding/Decoding/threshold-05_tract_decoding/leftArc_thr-05_wordcloud.png
```