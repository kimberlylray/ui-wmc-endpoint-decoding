/* ─────────────────────────────────────────────────────────────────
   WMC Tract Endpoint Decoding Viewer  —  combined cluster + tract view
   Depends on: Vue 2, PapaParse
   ───────────────────────────────────────────────────────────────── */

// Cluster colour palette — matches dendrogram colours
const CLUSTER_COLORS = [
  '#e07b7b', // 1 – red
  '#d4a843', // 2 – amber
  '#6bbf6b', // 3 – green
  '#5aaccc', // 4 – blue
  '#9b75d4', // 5 – purple
  '#d47a5a', // 6 – orange
  '#7abcd4'  // 7 – sky
];

// Diverging colour scale: blue → white → red (for decoding scores)
function scoreToColor(v, vmin, vmax) {
  if (v === null || isNaN(v)) return '#2a2d40';
  const mid = (vmin + vmax) / 2;
  let t;
  if (v < mid) {
    t = (v - vmin) / (mid - vmin);
    const r = Math.round(59  + t * (240 - 59));
    const g = Math.round(108 + t * (240 - 108));
    const b = Math.round(196 + t * (240 - 196));
    return `rgb(${r},${g},${b})`;
  } else {
    t = (v - mid) / (vmax - mid);
    const r = Math.round(240 + t * (196 - 240));
    const g = Math.round(240 - t * (240 - 59));
    const b = Math.round(240 - t * (240 - 59));
    return `rgb(${r},${g},${b})`;
  }
}

// Parse topic label: "102_novel_repetition_priming" → "novel repetition priming"
function topicLabel(raw) {
  return raw.replace(/^\d+_/, '').replace(/_/g, ' ');
}

// ─── Main component ────────────────────────────────────────────────
Vue.component('wmc-viewer', {
  props: ['config'],

  template: `
  <div class="wmc-root">

    <!-- ── Header ─────────────────────────────────────────── -->
    <header class="wmc-header">
      <div class="wmc-title">WMC Tract <span>Endpoint Decoding</span></div>
      <div class="header-spacer"></div>
      <div class="control-group">
        <label>Threshold</label>
        <select v-model="selectedThreshold" @change="onThresholdChange">
          <option v-for="(folder, label) in config.thresholds" :key="label" :value="label">{{ label }}</option>
        </select>
      </div>
      <div class="control-group" v-if="numClusters > 0">
        <label>Clusters</label>
        <span class="stat-chip">{{ numClusters }}</span>
      </div>
      <div class="control-group" v-if="tractOrder.length > 0">
        <label>Tracts</label>
        <span class="stat-chip">{{ tractOrder.length }}</span>
      </div>
    </header>

    <!-- ── Body ───────────────────────────────────────────── -->
    <div class="wmc-body">

      <!-- ── Sidebar ──────────────────────────────────────── -->
      <nav class="wmc-sidebar">

        <!-- Sidebar mode tabs -->
        <div class="sidebar-tabs">
          <button class="stab" :class="{active: sideMode==='clusters'}" @click="sideMode='clusters'">
            Clusters
          </button>
          <button class="stab" :class="{active: sideMode==='tracts'}" @click="sideMode='tracts'">
            Tracts
          </button>
        </div>

        <!-- CLUSTER MODE -->
        <template v-if="sideMode==='clusters'">
          <div class="sidebar-section">Dendrogram</div>
          <div class="dendro-wrap" v-if="dendroSrc">
            <img :src="dendroSrc" alt="Tract clustering dendrogram" />
          </div>
          <div class="sidebar-section">Clusters</div>
          <div class="cluster-list">
            <button
              v-for="c in clusters"
              :key="c.id"
              class="cluster-btn"
              :class="{ active: selectedCluster === c.id }"
              @click="selectCluster(c.id)"
            >
              <span class="cluster-dot" :style="{ background: c.color }"></span>
              <span class="cluster-label">Cluster {{ c.id }}</span>
              <span class="cluster-count">{{ c.tracts.length }} tracts</span>
            </button>
          </div>
        </template>

        <!-- TRACT MODE -->
        <template v-else>
          <div class="sidebar-section" style="display:flex;align-items:center;gap:8px;">
            <span>Tracts</span>
            <input
              class="tract-search"
              v-model="tractSearch"
              placeholder="Search…"
              @focus="tractSearch=''"
            />
          </div>
          <div class="cluster-list">
            <button
              v-for="t in filteredTracts"
              :key="t"
              class="tract-btn"
              :class="{ active: selectedTract === t }"
              @click="selectTract(t)"
            >
              <span class="cluster-dot" :style="{ background: tractClusterColor(t) }"></span>
              <span class="tract-btn-label">{{ t }}</span>
              <span class="cluster-count">C{{ tractClusterIndex(t) }}</span>
            </button>
          </div>
        </template>
      </nav>

      <!-- ── Content ──────────────────────────────────────── -->
      <main class="wmc-content">

        <!-- Tabs -->
        <div class="wmc-tabs">
          <button class="tab-btn" :class="{active: tab==='cluster'}" @click="tab='cluster'">Cluster View</button>
          <button class="tab-btn" :class="{active: tab==='tract'}"   @click="tab='tract'">Tract View</button>
          <button class="tab-btn" :class="{active: tab==='matrix'}"  @click="tab='matrix'">Full Matrix</button>
        </div>

        <!-- Loading -->
        <div class="tab-panel" v-if="loading">
          <div class="loading"><div class="spinner"></div>Loading data…</div>
        </div>

        <!-- ── CLUSTER VIEW TAB ──────────────────────────── -->
        <div class="tab-panel" v-else-if="tab==='cluster'">
          <div v-if="!selectedCluster" class="empty-state">
            Select a cluster from the sidebar (or switch to "Clusters" mode) to explore its decoding profile.
          </div>
          <div v-else>
            <div class="panel-cluster-header" :style="{ borderColor: activeCluster.color }">
              <span class="panel-cluster-dot" :style="{ background: activeCluster.color }"></span>
              <strong>Cluster {{ selectedCluster }}</strong>
              <span class="text-muted" style="margin-left:8px;">{{ activeCluster.tracts.length }} tracts</span>
            </div>
            <div class="cluster-panel">
              <!-- Brain surface -->
              <div class="panel-card">
                <div class="panel-card-title">Cortical Surface — Endpoint Map</div>
                <img :src="clusterImg('surf')" :alt="'Cluster ' + selectedCluster + ' surface'" />
              </div>
              <!-- Radar chart -->
              <div class="panel-card">
                <div class="panel-card-title">Top Cognitive Topics — Radar</div>
                <img :src="clusterImg('radar')" :alt="'Cluster ' + selectedCluster + ' radar'" />
              </div>
              <!-- Word cloud -->
              <div class="panel-card">
                <div class="panel-card-title">Topic Word Cloud</div>
                <img :src="clusterImg('wordcloud')" :alt="'Cluster ' + selectedCluster + ' wordcloud'" />
              </div>
              <!-- Tract list -->
              <div class="panel-card">
                <div class="panel-card-title">Tracts in Cluster {{ selectedCluster }}</div>
                <div class="tract-list">
                  <span
                    class="tract-tag"
                    v-for="t in activeCluster.tracts"
                    :key="t"
                    @click="selectTractAndSwitch(t)"
                    title="Click to explore this tract"
                  >{{ t }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TRACT VIEW TAB ────────────────────────────── -->
        <div class="tab-panel" v-else-if="tab==='tract'">
          <div v-if="!selectedTract" class="empty-state">
            Select a tract from the sidebar (switch to "Tracts" mode) to explore its decoding profile.
          </div>
          <div v-else>
            <div class="panel-cluster-header" :style="{ borderColor: tractClusterColor(selectedTract) }">
              <span class="panel-cluster-dot" :style="{ background: tractClusterColor(selectedTract) }"></span>
              <strong>{{ selectedTract }}</strong>
              <span class="text-muted" style="margin-left:8px;">Cluster {{ tractClusterIndex(selectedTract) }}</span>
              <button class="show-cluster-btn" @click="jumpToCluster(tractClusterIndex(selectedTract))">
                View cluster →
              </button>
            </div>

            <!-- Top topics bar chart -->
            <div class="tract-section-title">Top Cognitive Topics</div>
            <div class="topic-bars">
              <div v-for="item in tractTopTopics" :key="item.topic" class="topic-bar-row">
                <div class="topic-bar-label" :title="item.topic">{{ topicLabel(item.topic) }}</div>
                <div class="topic-bar-track">
                  <div
                    class="topic-bar-fill"
                    :style="{
                      width: barWidth(item.value) + '%',
                      background: item.value >= 0 ? '#4f8ef7' : '#e07b7b'
                    }"
                  ></div>
                  <span class="topic-bar-val">{{ item.value.toFixed(3) }}</span>
                </div>
              </div>
            </div>

            <!-- Mini strip: all topics for this tract -->
            <div class="tract-section-title" style="margin-top:24px;">All Topics (decoding score)</div>
            <div class="tract-strip-wrap">
              <div class="tract-strip">
                <div
                  v-for="topic in topics"
                  :key="topic"
                  class="strip-cell"
                  :style="{ background: cellColor(selectedTract, topic) }"
                  @mousemove="showTip($event, selectedTract, topic)"
                  @mouseleave="hideTip"
                ></div>
              </div>
              <div class="strip-legend">
                <span>{{ vmin.toFixed(2) }}</span>
                <div class="legend-grad"></div>
                <span>{{ vmax.toFixed(2) }}</span>
                <span style="margin-left:16px;color:var(--text-muted)">r</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── MATRIX TAB ────────────────────────────────── -->
        <div class="tab-panel" v-else-if="tab==='matrix'">
          <div class="matrix-legend">
            <span>{{ vmin.toFixed(2) }}</span>
            <div class="legend-grad"></div>
            <span>{{ vmax.toFixed(2) }}</span>
            <span style="margin-left:16px;color:var(--text-muted)">Decoding score (r)</span>
          </div>
          <div class="matrix-wrap">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="corner">Tract → Topic</th>
                  <th class="col-header" v-for="t in topics" :key="t" :title="t">{{ topicLabel(t) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tract in tractOrder" :key="tract" @click="selectTractAndSwitch(tract)" style="cursor:pointer;">
                  <th class="row-header" :style="{ borderLeft: '3px solid ' + tractClusterColor(tract) }">{{ tract }}</th>
                  <td
                    class="cell"
                    v-for="topic in topics"
                    :key="topic"
                    :style="{ background: cellColor(tract, topic) }"
                    @mousemove.stop="showTip($event, tract, topic)"
                    @mouseleave="hideTip"
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>

    <!-- ── Tooltip ─────────────────────────────────────────── -->
    <div
      class="cell-tooltip"
      v-if="tooltip.visible"
      :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }"
    >
      <strong>{{ tooltip.tract }}</strong>
      <span>{{ topicLabel(tooltip.topic) }}</span><br/>
      <span v-if="tooltip.value !== null">r = {{ tooltip.value.toFixed(4) }}</span>
      <span v-else style="color:#e07b7b">No data (NaN)</span>
    </div>

  </div>
  `,

  data() {
    return {
      tab: 'cluster',
      sideMode: 'clusters',     // 'clusters' | 'tracts'
      loading: true,
      selectedThreshold: this.config.defaultThreshold || Object.keys(this.config.thresholds)[0],
      selectedCluster: null,
      selectedTract: null,
      tractSearch: '',
      numClusters: 0,
      clusters: [],             // [{ id, color, tracts }]
      tractOrder: [],           // row order from CSV
      topics: [],               // column names (raw)
      matrix: {},               // { tractName: { topicName: value } }
      clusterAssignments: {},   // { tractName: clusterIndex }
      vmin: -0.5,
      vmax: 0.5,
      tooltip: { visible: false, x: 0, y: 0, tract: '', topic: '', value: null }
    };
  },

  computed: {
    thresholdFolder() { return this.config.thresholds[this.selectedThreshold]; },
    baseUrl()         { return `${this.config.dataBase}/${this.thresholdFolder}`; },
    dendroSrc()       { return `${this.baseUrl}/dendro.png`; },

    activeCluster() {
      return this.clusters.find(c => c.id === this.selectedCluster) || null;
    },

    filteredTracts() {
      const q = this.tractSearch.toLowerCase();
      if (!q) return this.tractOrder.slice().sort();
      return this.tractOrder.filter(t => t.toLowerCase().includes(q)).sort();
    },

    tractTopTopics() {
      if (!this.selectedTract || !this.matrix[this.selectedTract]) return [];
      const row = this.matrix[this.selectedTract];
      return Object.entries(row)
        .filter(([, v]) => v !== null && !isNaN(v))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 15)
        .map(([topic, value]) => ({ topic, value }));
    }
  },

  mounted() { this.loadData(); },

  methods: {
    onThresholdChange() {
      this.loading = true;
      this.selectedCluster = null;
      this.selectedTract = null;
      this.loadData();
    },

    loadData() {
      const url = `${this.baseUrl}/matrix.csv`;
      Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: (results) => {
          this.parseMatrix(results);
          this.loading = false;
          if (this.clusters.length > 0) this.selectCluster(this.clusters[0].id);
        },
        error: (err) => {
          console.error('Failed to load matrix CSV:', err);
          this.loading = false;
        }
      });
    },

    parseMatrix(results) {
      const rows = results.data;
      if (!rows.length) return;

      const allCols = results.meta.fields;
      const tractCol = allCols[0];
      const topicCols = allCols.slice(1);

      this.topics = topicCols;
      this.tractOrder = [];
      this.matrix = {};
      let allValues = [];

      rows.forEach(row => {
        const tractName = row[tractCol];
        if (!tractName) return;
        this.tractOrder.push(tractName);
        this.matrix[tractName] = {};
        topicCols.forEach(t => {
          const raw = row[t];
          const v = (raw === 'NaN' || raw === '' || raw === undefined) ? null : parseFloat(raw);
          this.matrix[tractName][t] = v;
          if (v !== null && !isNaN(v)) allValues.push(v);
        });
      });

      allValues.sort((a, b) => a - b);
      const lo = Math.floor(allValues.length * 0.05);
      const hi = Math.ceil(allValues.length * 0.95);
      this.vmin = allValues[lo] ?? -0.5;
      this.vmax = allValues[hi] ?? 0.5;

      this.buildClusters();
    },

    buildClusters() {
      const clusterJsonUrl = `${this.baseUrl}/clusters.json`;
      fetch(clusterJsonUrl)
        .then(r => { if (!r.ok) throw new Error('no clusters.json'); return r.json(); })
        .then(data => { this.applyClusterMap(data); })
        .catch(() => {
          this.probeClusterCount().then(n => {
            this.numClusters = n;
            const perCluster = Math.ceil(this.tractOrder.length / n);
            this.clusters = Array.from({ length: n }, (_, i) => ({
              id: i + 1,
              color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
              tracts: this.tractOrder.slice(i * perCluster, (i + 1) * perCluster)
            }));
            this.rebuildAssignments();
          });
        });
    },

    applyClusterMap(data) {
      this.numClusters = data.numClusters;
      const byCluster = {};
      for (const [tract, cIdx] of Object.entries(data.assignments)) {
        if (!byCluster[cIdx]) byCluster[cIdx] = [];
        byCluster[cIdx].push(tract);
      }
      this.clusters = Object.entries(byCluster)
        .map(([id, tracts]) => ({
          id: parseInt(id),
          color: CLUSTER_COLORS[(parseInt(id) - 1) % CLUSTER_COLORS.length],
          tracts
        }))
        .sort((a, b) => a.id - b.id);
      this.rebuildAssignments();
    },

    rebuildAssignments() {
      this.clusterAssignments = {};
      this.clusters.forEach(c => {
        c.tracts.forEach(t => { this.clusterAssignments[t] = c.id; });
      });
    },

    probeClusterCount() {
      return new Promise(resolve => {
        let n = 0;
        const tryNext = i => {
          if (i > 10) { resolve(Math.max(n, 1)); return; }
          fetch(`${this.baseUrl}/${i}_surf.png`, { method: 'HEAD' })
            .then(r => { if (r.ok) { n = i; tryNext(i + 1); } else resolve(Math.max(n, 1)); })
            .catch(() => resolve(Math.max(n, 1)));
        };
        tryNext(1);
      });
    },

    selectCluster(id) {
      this.selectedCluster = id;
      this.tab = 'cluster';
      this.sideMode = 'clusters';
    },

    selectTract(name) {
      this.selectedTract = name;
      this.tab = 'tract';
    },

    selectTractAndSwitch(name) {
      this.selectedTract = name;
      this.sideMode = 'tracts';
      this.tab = 'tract';
    },

    jumpToCluster(id) {
      this.selectedCluster = id;
      this.sideMode = 'clusters';
      this.tab = 'cluster';
    },

    clusterImg(type) {
      return `${this.baseUrl}/${this.selectedCluster}_${type}.png`;
    },

    cellColor(tract, topic) {
      const v = this.matrix[tract]?.[topic] ?? null;
      return scoreToColor(v, this.vmin, this.vmax);
    },

    tractClusterColor(tract) {
      const cIdx = this.clusterAssignments[tract];
      if (!cIdx) return '#555';
      return CLUSTER_COLORS[(cIdx - 1) % CLUSTER_COLORS.length];
    },

    tractClusterIndex(tract) {
      return this.clusterAssignments[tract] || '?';
    },

    topicLabel(raw) { return topicLabel(raw); },

    // Scale bar width: largest |value| = 100%, maintain sign split at 50%
    barWidth(v) {
      const maxAbs = this.tractTopTopics.length
        ? Math.max(...this.tractTopTopics.map(x => Math.abs(x.value)))
        : 1;
      return maxAbs > 0 ? (Math.abs(v) / maxAbs) * 96 : 0;
    },

    showTip(event, tract, topic) {
      const v = this.matrix[tract]?.[topic] ?? null;
      this.tooltip = {
        visible: true,
        x: event.clientX + 14,
        y: event.clientY - 10,
        tract, topic, value: v
      };
    },
    hideTip() { this.tooltip.visible = false; }
  }
});
