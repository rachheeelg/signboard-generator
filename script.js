const WORDS      = ['Grocery', 'Restaurant', 'Cafe'];
const HOLD_START = 0.12; 
const DOCK_AT    = 0.82; 
// --------------------

const track   = document.querySelector('.track');
const sticky  = document.querySelector('.sticky');
const lockup  = document.querySelector('.lockup');
const slot    = document.querySelector('.slot');
const buttons = document.querySelectorAll('.toolbar button');

const spans = WORDS.map(word => {
  const s = document.createElement('span');
  s.textContent = word;
  slot.appendChild(s);
  return s;
});

let lastIndex = null;
let lastDocked = null;
let ticking = false;

function measure() {
  const widest = Math.max(...spans.map(s => s.offsetWidth));
  slot.style.setProperty('--w', `${widest}px`);
  render(true);
}

function render(force = false) {
  const scrollable = Math.max(1, track.offsetHeight - innerHeight);
  const p = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / scrollable));

  sticky.style.setProperty('--p', p); 

  const docked = p >= DOCK_AT;

  let index = -1;
  if (p >= HOLD_START && !docked) {
    const t = (p - HOLD_START) / (DOCK_AT - HOLD_START);
    index = Math.min(WORDS.length - 1, Math.floor(t * WORDS.length));
  }

  if (force || index !== lastIndex) {
    spans.forEach((s, i) => {
      s.classList.toggle('current', i === index);
      s.classList.toggle('past', docked || i < index);
    });
    lockup.classList.toggle('closed', index < 0);
    lastIndex = index;
  }

  if (force || docked !== lastDocked) {
    lockup.classList.toggle('docked', docked);
    sticky.classList.toggle('docked', docked);
    lastDocked = docked;
  }
}

addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    render();
    ticking = false;
  });
}, { passive: true });

addEventListener('resize', measure);
document.fonts.ready.then(measure);
measure();

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ============================================================
   SIDEBAR: size panel + colour panel
   ============================================================ */
{
  /* ---- SETTINGS ---- */
  const CANVAS_SELECTOR = '#canvas';
  const SPACE_TOP    = 110;  // room left for the docked title
  const SPACE_BOTTOM = 110;  // room left for the toolbar
  const SPACE_SIDE   = 40;   // gap on the left and right of the canvas

  const sidebar  = document.getElementById('sidebar');
  const canvas   = document.querySelector(CANVAS_SELECTOR);
  const panel    = sidebar.querySelector('[data-panel="size"]');
  const wSlider  = document.getElementById('canvasW');
  const hSlider  = document.getElementById('canvasH');
  const rSlider  = document.getElementById('canvasR');   // corner radius
  const ratioBox = document.getElementById('ratioGrid');

  /* ---------- sizes are counted in whole squares ---------- */
  const cellSize = () =>
    parseFloat(getComputedStyle(canvas).getPropertyValue('--cell')) || 35;

  // the free space between sidebar, title and toolbar
  function area() {
    const sb     = sidebar.classList.contains('open') ? sidebar.offsetWidth : 0;
    const left   = sb + SPACE_SIDE;
    const width  = innerWidth - left - SPACE_SIDE;
    const height = innerHeight - SPACE_TOP - SPACE_BOTTOM;
    return { left, top: SPACE_TOP, width, height };
  }

  // the size the person chose (kept even when it has to shrink to fit)
  let cols = Math.round(canvas.offsetWidth  / cellSize());
  let rows = Math.round(canvas.offsetHeight / cellSize());
  let radius = 0;   // corner radius in px

  // apply the size, keep it inside the free space, centre it there
  function draw() {
    const cell    = cellSize();
    const a       = area();
    const maxCols = Math.max(1, Math.floor(a.width  / cell));
    const maxRows = Math.max(1, Math.floor(a.height / cell));

    const c = Math.min(Math.max(1, cols), maxCols);
    const r = Math.min(Math.max(1, rows), maxRows);

    // +1px so the last grid line is included as the right/bottom edge
    canvas.style.width  = c * cell + 1 + 'px';
    canvas.style.height = r * cell + 1 + 'px';

    // corners can round up to half the shorter side (a full pill/circle)
    const maxR = Math.floor(Math.min(c, r) * cell / 2);
    const rad  = Math.min(radius, maxR);
    canvas.style.borderRadius = rad + 'px';
    if (rSlider) { rSlider.min = 0; rSlider.max = maxR; rSlider.step = 1; rSlider.value = rad; }
    canvas.style.left   = a.left + a.width  / 2 + 'px';
    if (typeof renderSign === 'function') renderSign();
    canvas.style.top    = a.top  + a.height / 2 + 'px';

    // sliders move one square at a time and stop at the edge
    wSlider.min = 1; wSlider.max = maxCols; wSlider.step = 1; wSlider.value = c;
    hSlider.min = 1; hSlider.max = maxRows; hSlider.step = 1; hSlider.value = r;
  }

  /* ---------- fit the panel on short screens (no scrolling) ---------- */
  function fitPanel() {
    if (!panel.classList.contains('active')) return;
    const grid    = panel.querySelector('.ratio-grid');
    const sliders = panel.querySelector('.sliders');
    grid.style.transform = '';                 // measure at full size
    grid.style.marginBottom = '';
    const cs   = getComputedStyle(panel);
    const room = panel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gridH = grid.offsetHeight;
    const fit  = Math.min(1, (room - sliders.offsetHeight - 12) / gridH);  // 12px min gap
    if (fit < 1) {
      grid.style.transform = `scale(${fit})`;
      grid.style.marginBottom = -(gridH * (1 - fit)) + 'px';   // give back the freed space
    }
  }

  /* ---------- 1. open / close (any tool that has a panel) ---------- */
  const panels = sidebar.querySelectorAll('.panel');
  const hasPanel = tool => !!sidebar.querySelector(`[data-panel="${tool}"]`);
  let currentTool = null;

  // the grid is a sizing guide: show it while the size panel is open,
  // hide it once the person moves on (the shape and colour stay)
  function leavingSize() {
    if (currentTool === 'size') canvas.classList.add('no-grid');
  }

  function openSidebar(tool) {
    leavingSize();
    if (tool === 'size') canvas.classList.remove('no-grid');
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === tool));
    document.querySelectorAll('[data-tool]').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === tool));
    currentTool = tool;
    sidebar.classList.add('open');
    document.body.classList.add('panel-open');
    draw();
    fitPanel();
    if (typeof fitAbout === 'function') fitAbout();
  }
  function closeSidebar() {
    leavingSize();
    sidebar.classList.remove('open');
    document.body.classList.remove('panel-open');
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    currentTool = null;
    draw();
  }

  // each toolbar button opens its own panel; clicking it again closes
  document.querySelectorAll('[data-tool]').forEach(btn => {
    const tool = btn.dataset.tool;
    if (!hasPanel(tool)) return;          // tools without a panel yet
    btn.addEventListener('click', () => {
      currentTool === tool ? closeSidebar() : openSidebar(tool);
    });
  });

  // click anywhere outside the sidebar to close
  document.addEventListener('click', e => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target)) return;
    const b = e.target.closest('[data-tool]');
    if (b && hasPanel(b.dataset.tool)) return;   // that button handles itself
    closeSidebar();
  });

  // press Escape to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  /* ---------- 2. aspect-ratio cards ---------- */
  // w/h = the real ratio for the canvas
  // pw/ph = size of the little preview rectangle on the card (from Figma)
  // order + preview sizes from the new design: portrait, landscape / portrait, landscape
  const ratios = [
    { w: 9,  h: 16, pw: 71,  ph: 122 },
    { w: 16, h: 9,  pw: 135, ph: 78  },
    { w: 4,  h: 5,  pw: 78,  ph: 111 },
    { w: 5,  h: 4,  pw: 111, ph: 78  },
  ];

  ratios.forEach(r => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ratio';

    card.innerHTML = `
      <div class="shape-area">
        <div class="shape" style="width:${r.pw}px;height:${r.ph}px"></div>
      </div>
      <span>${r.w} : ${r.h}</span>`;

    card.addEventListener('click', () => {
      ratioBox.querySelectorAll('.ratio').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // biggest canvas with this ratio that fits, in whole squares
      const cell    = cellSize();
      const a       = area();
      const maxCols = Math.max(1, Math.floor(a.width  / cell));
      const maxRows = Math.max(1, Math.floor(a.height / cell));

      let c = maxCols;
      let rr = Math.round(c * r.h / r.w);
      if (rr > maxRows) {
        rr = maxRows;
        c  = Math.round(rr * r.w / r.h);
      }
      cols = c;
      rows = rr;
      draw();
    });

    ratioBox.appendChild(card);
  });

  /* ---------- 3. sliders (values are numbers of squares) ---------- */
  wSlider.addEventListener('input', () => { cols = +wSlider.value; draw(); });
  hSlider.addEventListener('input', () => { rows = +hSlider.value; draw(); });
  if (rSlider) rSlider.addEventListener('input', () => { radius = +rSlider.value; draw(); });

  /* ---------- 4. COLOUR PANEL: picker + swatches ---------- */
  // curated pairings: bg = sign colour, text = the text colour that goes with it
  const SWATCHES = [
    { bg: '#986AAB', text: '#EFD302' },
    { bg: '#8FEFDF', text: '#D886B6' },
    { bg: '#FF6648', text: '#99D6EB' },
    { bg: '#F797C3', text: '#C8DCBB' },
    { bg: '#19A58A', text: '#F8BB50' },
    { bg: '#C3371A', text: '#FFB3A6' },   // 6th pair: placeholder (your red + pink)
  ];
  const GRID_LINE       = '#000000';   // grid + outline colour
  const GRID_LINE_LIGHT = '#F6F1EA';   // used instead on very dark sign colours

  const cpArea       = document.getElementById('cpArea');
  const cpAreaHandle = document.getElementById('cpAreaHandle');
  const cpHue        = document.getElementById('cpHue');
  const cpHueHandle  = document.getElementById('cpHueHandle');
  const swatchBox    = document.getElementById('swatches');

  if (cpArea && cpHue && swatchBox) {
    // current colour as hue (0–360), saturation and brightness (0–1)
    let hue = 0, sat = 0, val = 1;

    // --- colour maths ---
    function hsvToHex(h, s, v) {
      const f = n => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
      };
      return '#' + [f(5), f(3), f(1)]
        .map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    function hexToHsv(hex) {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      let h = 0;
      if (d) {
        if (max === r)      h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return { h, s: max ? d / max : 0, v: max };
    }
    function luminance(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255]
        .map(c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; })
        .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    }
    function contrast(a, b) {
      const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
      return (x + .05) / (y + .05);
    }

    // --- apply the colour to the canvas and update the picker ---
    // the curated pairing closest to any colour (used for custom picker colours)
    function nearestPair(hex) {
      const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
      const [r, g, b] = rgb(hex);
      let best = SWATCHES[0], bestD = Infinity;
      SWATCHES.forEach(p => {
        const [r2, g2, b2] = rgb(p.bg);
        // weighted RGB distance: closer to how our eyes compare colours
        const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      });
      return best;
    }

    function applyColour(fromSwatch = false) {
      const hex = hsvToHex(hue, sat, val);
      canvas.style.backgroundColor = hex;

      // sign text: the curated partner of this colour (or of the nearest swatch)
      canvas.style.setProperty('--sign-text', nearestPair(hex).text);

      // if the base is too close to the red grid lines, switch them to pink
      canvas.style.setProperty('--grid-line',
        contrast(hex, GRID_LINE) < 1.6 ? GRID_LINE_LIGHT : GRID_LINE);

      cpArea.style.setProperty('--hue', hue);
      cpAreaHandle.style.left = sat * 100 + '%';
      cpAreaHandle.style.top  = (1 - val) * 100 + '%';
      cpHueHandle.style.left  = hue / 360 * 100 + '%';
      cpAreaHandle.setAttribute('aria-valuetext', hex);
      cpHueHandle.setAttribute('aria-valuenow', Math.round(hue));

      if (!fromSwatch) swatchBox.querySelectorAll('.swatch')
        .forEach(sw => sw.classList.toggle('selected', sw.dataset.hex === hex));
    }

    // --- dragging (mouse, trackpad and touch) ---
    function drag(el, onMove) {
      el.addEventListener('pointerdown', e => {
        el.setPointerCapture(e.pointerId);
        onMove(e);
        const move = ev => onMove(ev);
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      });
    }
    const clamp01 = x => Math.min(1, Math.max(0, x));

    drag(cpArea, e => {
      const r = cpArea.getBoundingClientRect();
      sat = clamp01((e.clientX - r.left) / r.width);
      val = 1 - clamp01((e.clientY - r.top) / r.height);
      applyColour();
    });
    drag(cpHue, e => {
      const r = cpHue.getBoundingClientRect();
      hue = clamp01((e.clientX - r.left) / r.width) * 359.9;
      applyColour();
    });

    // --- keyboard: arrow keys move the handles ---
    cpAreaHandle.addEventListener('keydown', e => {
      const step = e.shiftKey ? .1 : .02;
      if (e.key === 'ArrowLeft')  sat = clamp01(sat - step);
      else if (e.key === 'ArrowRight') sat = clamp01(sat + step);
      else if (e.key === 'ArrowUp')    val = clamp01(val + step);
      else if (e.key === 'ArrowDown')  val = clamp01(val - step);
      else return;
      e.preventDefault(); applyColour();
    });
    cpHueHandle.addEventListener('keydown', e => {
      const step = e.shiftKey ? 30 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')    hue = Math.max(0, hue - step);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') hue = Math.min(359.9, hue + step);
      else return;
      e.preventDefault(); applyColour();
    });

    // --- suggested colours ---
    SWATCHES.forEach(({ bg: hex }) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch';
      sw.dataset.hex = hex;
      sw.style.background = hex;
      sw.setAttribute('aria-label', `Colour ${hex}`);
      sw.addEventListener('click', () => {
        ({ h: hue, s: sat, v: val } = hexToHsv(hex));
        swatchBox.querySelectorAll('.swatch').forEach(x => x.classList.toggle('selected', x === sw));
        applyColour(true);
      });
      swatchBox.appendChild(sw);
    });

    // start from the canvas's current background colour
    const start = getComputedStyle(canvas).backgroundColor.match(/\d+/g) || [246, 241, 234];
    ({ h: hue, s: sat, v: val } = hexToHsv('#' + start.slice(0, 3)
      .map(x => (+x).toString(16).padStart(2, '0')).join('')));
    applyColour();
  }

  /* ---------- 5. LANGUAGE PANEL: lines → languages → text ---------- */
  const lineOpts    = document.getElementById('lineOpts');
  const langOpts    = document.getElementById('langOpts');
  const revealLangs = document.getElementById('revealLangs');
  const revealInput = document.getElementById('revealInput');
  const textInputs  = document.getElementById('textInputs');

  let lineCount = 0;
  const languages = new Set();
  const texts = ['', '', ''];   // what's typed on each line (kept if line count changes)

  /* ============================================================
     LAYOUT ENGINE
     A = main line (line 1), B = secondary (lines 2–3), M = motif
     Items: 'A' 'B' text blocks · 'fB' B flanked by motifs ·
            'M' one motif · 'MM' pair left/right · 'ROW' border row ·
            'flex' empty space that stretches
     ============================================================ */
  const LAYOUTS = {
    portrait: [
      ['A', 'flex', 'B'],
      ['A', 'flex', 'M', 'flex', 'B'],
      ['A', 'flex', 'MM', 'flex', 'B'],
      ['A', 'flex', 'M', 'B'],
      ['ROW', 'A', 'ROW', 'flex', 'B'],
      ['ROW', 'A', 'flex', 'M', 'flex', 'B', 'ROW'],
      ['ROW', 'flex', 'A', 'B', 'flex', 'ROW'],
      ['M', 'flex', 'A', 'B', 'flex', 'M'],
      ['M', 'A', 'flex', 'B', 'flex', 'M'],
    ],
    wide: [
      ['flex', 'A', 'B', 'flex'],
      ['flex', 'A', 'fB', 'flex'],
      ['ROW', 'flex', 'A', 'B', 'flex', 'ROW'],
      ['M', 'flex', 'A', 'B', 'flex', 'M'],
      { items: ['flex', 'A', 'fB', 'flex'], swap: true },   // small A over big B
    ],
  };
  let layoutIndex = 0;
  let motifName = 'squares';

  // motif files in the assets folder (black SVGs, recoloured with CSS masks)
  // ratio = width ÷ height of each file's artboard · mirror = flip the right-hand copy
  const MOTIFS = {
    // rowScale = motif size in border rows (1 = normal); smaller fits more per row
    // squares measured from Rachel's Centre Supply signs: 8 per edge row, 7 per row framing the text
    // rowEdge / rowInset = side margin (share of sign width) for rows at the edge / rows framing the main line
    'squares': { file: 'squares.svg',       ratio: 128.8 / 72.15, ink: 0.95, rowScale: 0.747, rowGap: 0.132,
                 rowEdge: 0.022, rowInset: 0.086 },
    'flower':  { file: 'flower.svg',        ratio: 87.81 / 88.2  },
    // ink = share of the file's width that's actually drawn (the fish has empty space round it)
    // optional rowGap = space between motifs in border rows, as a share of the drawn width (default 0.3)
    'fish':    { file: 'fish.svg',          ratio: 87.81 / 33.47, ink: 0.68 },
    'bar':     { file: 'bar.svg',           ratio: 87.81 / 33.47, ink: 0.86, rowGap: 0.2, rowScale: 0.85 },
    // the flourish uses its half version, facing inward, when it sits in pairs beside text
    'flourish': { file: 'full-flourish.svg', ratio: 86.54 / 33.47, rowScale: 0.8, rowGap: 0.25,
                  pairFile: 'half-flourish.svg', pairRatio: 43.02 / 33.47 },
    'fleur':   { file: 'fleur.svg',         ratio: 146.76 / 94.73, rowScale: 0.8, rowGap: 0.25 },
  };
  function setMask(el, file) {
    el.style.webkitMaskImage = `url(assets/${file})`;
    el.style.maskImage = `url(assets/${file})`;
  }

  const sign = document.createElement('div');
  sign.className = 'sign';
  canvas.appendChild(sign);

  const isCJK = t => /^[\s　-〿㐀-鿿豈-﫿＀-￯]+$/.test(t) && /\S/.test(t);

  // pair = one of two motifs beside each other; right = the right-hand one
  function motifEl(pair = false, right = false) {
    const m = MOTIFS[motifName];
    const usePair = pair && m.pairFile;
    const el = document.createElement('span');
    el.className = 'motif';
    el.setAttribute('aria-hidden', 'true');
    setMask(el, usePair ? m.pairFile : m.file);
    el.style.aspectRatio = usePair ? m.pairRatio : m.ratio;
    if (usePair && !right) el.style.transform = 'scaleX(-1)';   // left half faces inward
    return el;
  }
  const motifRatio = (pair = false) => {
    const m = MOTIFS[motifName];
    return pair && m.pairFile ? m.pairRatio : m.ratio;
  };

  // biggest font size where the block fits its width and height
  function fitText(el, maxW, maxH, oneLine) {
    el.style.width = maxW + 'px';
    el.style.whiteSpace = oneLine ? 'nowrap' : (el.dataset.vertical ? 'pre' : 'normal');
    let lo = 4, hi = 2000;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      const fits = el.scrollWidth <= maxW + 0.5 && el.scrollHeight <= maxH + 0.5;
      fits ? (lo = mid) : (hi = mid);
    }
    el.style.fontSize = lo + 'px';
    return lo;
  }

  function renderSign() {
    const W = parseFloat(canvas.style.width)  || canvas.offsetWidth;
    const H = parseFloat(canvas.style.height) || canvas.offsetHeight;
    if (!W || !H) return;

    const wide   = W >= H;
    const set    = wide ? LAYOUTS.wide : LAYOUTS.portrait;
    let layout   = set[layoutIndex % set.length];
    const swap   = !!layout.swap;
    let items    = layout.items || layout;

    const aText  = texts[0] || '';
    const bText  = texts.slice(1, lineCount).filter(Boolean).join('\n');
    const hasA   = lineCount > 0 && aText.trim();
    const hasB   = bText.trim();
    if (!hasB) items = items.filter(i => i !== 'B' && i !== 'fB');
    if (!hasA) items = items.filter(i => i !== 'A');

    const unit  = Math.min(W, H);
    const padY  = unit * 0.042;               // top/bottom margin, measured from Rachel's signs
    const pad   = unit * 0.06;
    const padX  = wide ? W * 0.045 : pad;     // a little more side margin on wide signs
    const gap   = unit * 0.035;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;
    const ratio  = motifRatio();
    const rowMW  = unit * 0.15;                 // motif width in border rows
    const oneMW  = unit * (wide ? 0.2 : 0.2);   // single / pair / flank motif width

    sign.replaceChildren();
    sign.style.padding = `${padY}px ${padX}px`;
    sign.style.gap = 0;

    const blocks = [];       // text blocks to fit after layout
    let fixedH = 0;          // height taken by motifs + gaps
    let prevSolid = false;

    items.forEach((item, idx) => {
      if (item === 'flex') { const f = document.createElement('div'); f.className = 'sl-flex'; sign.appendChild(f); prevSolid = false; return; }
      if (prevSolid) { const g = document.createElement('div'); g.style.height = gap + 'px'; g.style.flex = 'none'; sign.appendChild(g); fixedH += gap; }
      prevSolid = true;

      if (item === 'ROW') {
        const row = document.createElement('div'); row.className = 'sl-row';
        const mo  = MOTIFS[motifName];
        const ink = mo.ink || 1;                    // crop empty space at the sides
        const mw  = rowMW * (mo.rowScale || 1);     // motif size in this row
        const boxW = mw * ink;
        const sp = boxW * (mo.rowGap ?? 0.3);
        // rows right beside the main line line up with it; other rows run to the sign's edges
        const framesA = items[idx - 1] === 'A' || items[idx + 1] === 'A';
        const margin = framesA ? mo.rowInset : mo.rowEdge;
        const rowW = margin != null ? W * (1 - 2 * margin) : innerW;
        row.style.width = rowW + 'px';
        const n = Math.max(1, Math.floor((rowW + sp) / (boxW + sp) + 0.1));
        for (let i = 0; i < n; i++) {
          const m = motifEl();
          m.style.width = boxW + 'px';
          m.style.aspectRatio = 'auto';
          m.style.height = mw / ratio + 'px';
          // keep the drawing full size inside the narrower box
          m.style.webkitMaskSize = m.style.maskSize = `${mw}px ${mw / ratio}px`;
          row.appendChild(m);
        }
        row.style.height = mw / ratio + 'px';
        fixedH += mw / ratio;
        sign.appendChild(row);
      } else if (item === 'M') {
        const m = motifEl(); m.style.width = oneMW + 'px'; m.style.flex = 'none';
        fixedH += oneMW / ratio; sign.appendChild(m);
      } else if (item === 'MM') {
        const row = document.createElement('div'); row.className = 'sl-pair';
        const pw = oneMW * 0.8 * (motifRatio(true) < ratio ? 0.5 : 1);
        row.append(motifEl(true), motifEl(true, true));
        row.querySelectorAll('.motif').forEach(m => m.style.width = pw + 'px');
        fixedH += pw / motifRatio(true); sign.appendChild(row);
      } else {
        // text block (A, B or flanked B)
        const isA  = item === 'A';
        const txt  = isA ? aText : bText;
        const el   = document.createElement('div');
        el.className = 'sl-text ' + (isA ? 'sl-a' : 'sl-b');
        if (typeof blockFont === 'function') {
          const bf = blockFont(isA ? 'A' : 'B');
          el.style.fontFamily = bf.family;
          el.style.fontWeight = bf.weight;
        }
        const vertical = isA && !wide && isCJK(txt) && txt.replace(/\s/g, '').length <= 6;
        if (vertical) { el.dataset.vertical = '1'; el.textContent = [...txt.replace(/\s/g, '')].join('\n'); }
        else el.textContent = txt;
        if (isCJK(txt)) el.classList.add('sl-cjk');

        if (item === 'fB') {
          const wrap = document.createElement('div'); wrap.className = 'sl-flank';
          const mw = oneMW * 0.75 * (motifRatio(true) < ratio ? 0.5 : 1);
          const l = motifEl(true), r = motifEl(true, true);
          [l, r].forEach(m => { m.style.width = mw + 'px'; m.style.flex = 'none'; });
          wrap.append(l, el, r);
          sign.appendChild(wrap);
          blocks.push({ el, role: 'B', maxW: innerW - 2 * (mw + gap) });
        } else {
          sign.appendChild(el);
          blocks.push({ el, role: isA ? 'A' : 'B', maxW: innerW, vertical });
        }
      }
    });

    // share the free height between the text blocks
    const free = Math.max(20, innerH - fixedH);
    const stacked = items.includes('A') && items.indexOf('B') === items.indexOf('A') + 1;
    const share = swap ? { A: 0.2, B: 0.55 }
                : wide ? { A: 0.5, B: 0.3 }
                : stacked ? { A: 0.5, B: 0.22 }
                : { A: 0.55, B: 0.25 };
    let sizeA = null;
    blocks.sort((a, b) => (a.role === 'A' ? -1 : 1));
    blocks.forEach(b => {
      const maxH = free * (b.vertical ? 0.65 : share[b.role]);   // vertical Chinese gets the most room
      let size = fitText(b.el, b.maxW, maxH, wide);
      // a secondary line stays on one line unless that makes it much smaller
      if (b.role === 'B' && !wide) {
        const one = fitText(b.el, b.maxW, maxH, true);
        if (one >= size * 0.5) size = one; else size = fitText(b.el, b.maxW, maxH, false);
      }
      if (b.role === 'A') sizeA = size;
      // the secondary line is never bigger than the main line (unless swapped)
      // Chinese reads smaller at the same size, so it may go up to 1.5× the main line
      const cap = sizeA && (b.el.classList.contains('sl-cjk') ? sizeA * 1.5 : sizeA);
      if (b.role === 'B' && cap && !swap && size > cap) b.el.style.fontSize = cap + 'px';
    });
  }
  function updateSign() { renderSign(); }

  /* ---------- REGENERATE: next layout ---------- */
  const regen = document.getElementById('regenerate');
  if (regen) regen.addEventListener('click', () => { layoutIndex++; renderSign(); });

  /* ---------- TYPE PANEL: choose the fonts ---------- */
  // file = path to the font file (relative to index.html) — change these to match your files
  const FONTS = {
    latin: [
      { label: 'BORINQUENEERS', family: 'Borinqueneers', file: 'fonts/Borinqueneers.otf' },
      { label: 'CALLEJÓN',      family: 'Callejon',      file: 'fonts/Callejón-Bold.otf' },
      { label: 'Brush Script',  family: 'brush-script-std', file: null },   // Adobe Fonts kit
      { label: 'Cheap Pine',    family: 'cheap-pine-sans', file: null },    // Adobe Fonts kit (Sans, no shadow)
      { label: 'PIRAGUA',       family: 'Piragua-Bold',  file: null },   // already loaded in home.css
      { label: 'Choc',          family: 'choc-mn',       file: null },      // Adobe Fonts kit
      { label: 'Essent',        family: 'EssentVariableTrial-Variable', file: null, weight: 600 },
    ],
    cjk: [
      { label: '黑体中文',             family: 'fz-hei-gb',     file: null },   // Adobe Fonts kit
      { label: '方正活意圆 简',         family: 'FZ HuoYiYuan',  file: 'fonts/FZHuoYYJW-H.TTF' },
      { label: '方正潘虎包装体 简',     family: 'FZ PanHu',      file: 'fonts/FZPanHuBaoZhuangTiS-W05-B.TTF' },
      { label: '方正精美堂寄席文字 简', family: 'FZ JiXi',       file: 'fonts/FZJingMTJXWZJW.TTF' },
      { label: '报隶-简',              family: 'Baoli SC',      file: null },   // macOS system font
    ],
  };
  // up to two fonts, any mix of Latin and Chinese:
  // the 1st pick sets the main line, the 2nd pick the secondary line(s)
  let picks = [];

  // Adobe Fonts load on their own; re-fit the sign when they arrive
  document.fonts.addEventListener('loadingdone', () => renderSign());

  // load each font file once (missing files simply fall back)
  Object.values(FONTS).flat().forEach(f => {
    if (!f.file) return;
    const face = new FontFace(f.family, `url("${encodeURI(f.file)}")`);
    face.load().then(ff => { document.fonts.add(ff); renderSign(); }).catch(() => {});
  });

  const fam = (...fonts) => [...new Set(fonts.filter(Boolean).map(f => `"${f.family}"`))]
    .concat('"EssentVariableTrial-Variable"', 'sans-serif').join(', ');
  // font + weight for each block (read by renderSign)
  function blockFont(role) {
    const [first, second] = picks;
    const main = first, sec = second || first;
    const f = role === 'A' ? main : sec;
    const other = role === 'A' ? sec : main;
    return { family: fam(f, other), weight: f ? (f.weight || 'normal') : 600 };
  }

  const allCards = [];
  function refreshCards() {
    allCards.forEach(({ card, f }) => {
      const i = picks.indexOf(f);
      card.setAttribute('aria-pressed', String(i >= 0));
      card.dataset.pick = i >= 0 ? (i === 0 ? 'MAIN' : 'SECOND') : '';
    });
  }

  [['latin', 'latinFonts'], ['cjk', 'cjkFonts']].forEach(([group, id]) => {
    const list = document.getElementById(id);
    if (!list) return;
    FONTS[group].forEach(f => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'font-card';
      card.setAttribute('aria-pressed', 'false');
      const name = document.createElement('span');
      name.className = 'font-name';
      name.textContent = f.label;
      card.appendChild(name);
      card.style.fontFamily = `"${f.family}", ${group === 'cjk' ? '"EssentVariableTrial-Variable", ' : ''}sans-serif`;
      if (f.weight) card.style.fontWeight = f.weight;
      if (group === 'cjk') card.style.setProperty('--cjk-size', (f.size || 20) + 'px');
      card.addEventListener('click', () => {
        if (picks.includes(f)) picks = picks.filter(p => p !== f);   // click again to unpick
        else if (picks.length < 2) picks.push(f);
        else picks[1] = f;                                              // a 3rd pick replaces the 2nd
        refreshCards();
        renderSign();
      });
      allCards.push({ card, f });
      list.appendChild(card);
    });
  });

  // Fonts draw at different sizes and sit at different heights in their line.
  // Measure each label's real letters, then (1) scale Chinese labels to one
  // visual size and (2) shift every label so its letters sit dead centre.
  function evenFontCards() {
    const ctx = document.createElement('canvas').getContext('2d');
    const measure = (family, text, weight = 'normal') => {
      ctx.font = `${weight} 100px "${family}", sans-serif`;
      return ctx.measureText(text);
    };
    const ref = measure('EssentVariableTrial-Variable', '方正简');
    const target = (ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent) || 80;

    allCards.forEach(({ card, f }) => {
      const name = card.querySelector('.font-name');
      const m = measure(f.family, f.label, f.weight || 'normal');
      const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

      // 1. Chinese: same character height on every card
      if (FONTS.cjk.includes(f)) {
        const c = measure(f.family, '方正简');
        const h = c.actualBoundingBoxAscent + c.actualBoundingBoxDescent;
        card.style.setProperty('--cjk-scale', h ? (target / h).toFixed(3) : 1);
      }

      // 2. centre the letters optically: Latin on its capital height
      //    (accents and descenders like Ó or p are ignored), Chinese on 方.
      //    With line-height 1 the baseline sits at (100 − (ascent + descent)) / 2 + ascent.
      const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
      if (!ink || !(A + D)) return;
      const isCjk = FONTS.cjk.includes(f) && /[\u3400-\u9fff]/.test(f.label);
      const g = measure(f.family, isCjk ? '方' : 'H', f.weight || 'normal');
      const baseline = (100 - (A + D)) / 2 + A;
      const inkMiddle = baseline - (g.actualBoundingBoxAscent - g.actualBoundingBoxDescent) / 2;
      name.style.transform = `translateY(${((50 - inkMiddle) / 100).toFixed(3)}em)`;
    });
  }
  evenFontCards();
  document.fonts.addEventListener('loadingdone', evenFontCards);

  /* ---------- DOWNLOAD: save the sign as a PNG ---------- */
  // The sign is redrawn onto a canvas (without the grid) at 3× screen size.
  const svgCache = {};
  async function motifImage(file, colour) {
    if (!svgCache[file]) svgCache[file] = await (await fetch(`assets/${file}`)).text();
    // recolour the black SVG to the text colour
    const svg = svgCache[file].replace(/#231f20/gi, colour);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
    return img;
  }
  const maskFile = el => (getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage || '')
    .match(/assets\/([^"')]+)/)?.[1];

  async function downloadSign() {
    const box = canvas.getBoundingClientRect();
    const S = 3;                                        // export scale
    const out = document.createElement('canvas');
    out.width = Math.round(box.width * S);
    out.height = Math.round(box.height * S);
    const ctx = out.getContext('2d');
    ctx.scale(S, S);

    // PNG keeps the area outside the rounded corners transparent
    const r = parseFloat(getComputedStyle(canvas).borderTopLeftRadius) || 0;
    ctx.beginPath();
    ctx.roundRect(0, 0, box.width, box.height, r);
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor;
    ctx.fill();
    ctx.save();
    ctx.clip();

    const colour = getComputedStyle(sign).color;

    // motifs
    for (const m of sign.querySelectorAll('.motif')) {
      const file = maskFile(m);
      if (!file) continue;
      const mr = m.getBoundingClientRect();
      const cs = getComputedStyle(m);
      const ms = (cs.maskSize || cs.webkitMaskSize || '').match(/([\d.]+)px ([\d.]+)px/);
      const w = ms ? +ms[1] : mr.width, h = ms ? +ms[2] : mr.height;
      const img = await motifImage(file, colour);
      const cx = mr.left - box.left + mr.width / 2, cy = mr.top - box.top + mr.height / 2;
      ctx.save();
      ctx.translate(cx, cy);
      if (m.style.transform.includes('scaleX(-1)')) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // text: find each rendered line and draw it in the same place
    ctx.fillStyle = colour;
    ctx.textBaseline = 'alphabetic';
    for (const el of sign.querySelectorAll('.sl-text')) {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ascent = ctx.measureText('Hg方').fontBoundingBoxAscent;
      const lines = [];
      const range = document.createRange();
      for (const node of el.childNodes) {
        if (node.nodeType !== 3) continue;
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const rc = range.getClientRects()[0];
          const ch = node.data[i];
          if (!rc || ch === '\n') continue;
          let line = lines.find(l => Math.abs(l.top - rc.top) < 2);
          if (!line) lines.push(line = { top: rc.top, left: rc.left, text: '' });
          line.left = Math.min(line.left, rc.left);
          line.text += ch;
        }
      }
      lines.forEach(l => {
        const t = l.text.replace(/\s+$/, '');
        if (t) ctx.fillText(t, l.left - box.left, l.top - box.top + ascent);
      });
    }
    ctx.restore();

    const name = ((texts[0] || 'signmator').trim().toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'signmator') + '.png';
    out.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try { await document.fonts.ready; await downloadSign(); }
    catch (err) { console.error(err); alert('Sorry, the download didn\'t work. Is the page running on Live Server?'); }
    finally { downloadBtn.disabled = false; }
  });

  /* ---------- close the sidebar when scrolling back up into the intro ---------- */
  const stickyEl = document.querySelector('.sticky');
  new MutationObserver(() => {
    if (!stickyEl.classList.contains('docked') && sidebar.classList.contains('open')) closeSidebar();
  }).observe(stickyEl, { attributes: true, attributeFilter: ['class'] });

  /* ---------- ABOUT PANEL: fit the text to the panel ---------- */
  // biggest text size (12–19px) at which the whole text fits without scrolling
  function fitAbout() {
    const panel = sidebar.querySelector('.about-panel');
    if (!panel || !panel.classList.contains('active')) return;
    let lo = 12, hi = 19;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      panel.style.setProperty('--about-size', mid + 'px');
      panel.scrollHeight <= panel.clientHeight + 1 ? (lo = mid) : (hi = mid);
    }
    panel.style.setProperty('--about-size', lo + 'px');
  }
  addEventListener('resize', fitAbout);
  document.fonts.addEventListener('loadingdone', fitAbout);

  /* ---------- PATTERN PANEL: choose the motif ---------- */
  const motifGrid = document.getElementById('motifGrid');
  if (motifGrid) {
    Object.entries(MOTIFS).forEach(([name, m]) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'motif-card' + (name === motifName ? ' selected' : '');
      card.setAttribute('aria-pressed', String(name === motifName));
      card.setAttribute('aria-label', name);
      card.innerHTML = `<span class="motif-preview" aria-hidden="true"></span>`;
      const prev = card.querySelector('.motif-preview');
      setMask(prev, m.file);
      prev.style.aspectRatio = m.ratio;
      card.addEventListener('click', () => {
        motifName = name;
        motifGrid.querySelectorAll('.motif-card').forEach(c => {
          c.classList.toggle('selected', c === card);
          c.setAttribute('aria-pressed', String(c === card));
        });
        renderSign();
      });
      motifGrid.appendChild(card);
    });
  }

  function buildInputs() {
    textInputs.replaceChildren();
    for (let i = 0; i < lineCount; i++) {
      const field = document.createElement('div');
      field.className = 'text-field';
      field.innerHTML = `
        <label for="textLine${i}">TYPE YOUR CHARACTERS HERE [MAX 50]</label>
        <input id="textLine${i}" type="text" maxlength="50" autocomplete="off">`;
      const input = field.querySelector('input');
      input.value = texts[i];
      input.addEventListener('input', () => { texts[i] = input.value; updateSign(); });
      textInputs.appendChild(field);
    }
  }

  if (lineOpts && langOpts) {
    // step 1: pick one line option
    lineOpts.querySelectorAll('.opt').forEach(btn => {
      btn.addEventListener('click', () => {
        lineOpts.querySelectorAll('.opt').forEach(b =>
          b.setAttribute('aria-pressed', String(b === btn)));
        lineCount = +btn.dataset.lines;
        revealLangs.classList.add('open');
        buildInputs();
        updateSign();
      });
    });

    // step 2: pick one or more languages (click again to unpick)
    langOpts.querySelectorAll('.opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        languages.has(lang) ? languages.delete(lang) : languages.add(lang);
        btn.setAttribute('aria-pressed', String(languages.has(lang)));
        revealInput.classList.toggle('open', languages.size > 0);
        sign.dataset.languages = [...languages].join(' ');
      });
    });
  }

  /* ---------- 6. keep it fitting when the window changes ---------- */
  addEventListener('resize', () => { draw(); fitPanel(); });
  draw();
}