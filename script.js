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
    if (typeof fitSign === 'function') fitSign();
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
    document.querySelectorAll('.toolbar [data-tool]').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === tool));
    currentTool = tool;
    sidebar.classList.add('open');
    document.body.classList.add('panel-open');
    draw();
    fitPanel();
  }
  function closeSidebar() {
    leavingSize();
    sidebar.classList.remove('open');
    document.body.classList.remove('panel-open');
    document.querySelectorAll('.toolbar [data-tool]').forEach(b => b.classList.remove('active'));
    currentTool = null;
    draw();
  }

  // each toolbar button opens its own panel; clicking it again closes
  document.querySelectorAll('.toolbar [data-tool]').forEach(btn => {
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
    const b = e.target.closest('.toolbar [data-tool]');
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
  const ratios = [
    { w: 16, h: 9,  pw: 142, ph: 83  },
    { w: 9,  h: 16, pw: 83,  ph: 142 },
    { w: 5,  h: 4,  pw: 117, ph: 83  },
    { w: 4,  h: 5,  pw: 83,  ph: 117 },
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
  const SWATCHES = ['#986AAB', '#D886B6', '#C8DCBB', '#99D6EB', '#F8BB50', '#C3371A'];
  const GRID_RED  = '#C3371A';
  const GRID_PINK = '#FFB3A6';

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
    function applyColour(fromSwatch = false) {
      const hex = hsvToHex(hue, sat, val);
      canvas.style.backgroundColor = hex;

      // if the base is too close to the red grid lines, switch them to pink
      canvas.style.setProperty('--grid-line',
        contrast(hex, GRID_RED) < 1.6 ? GRID_PINK : GRID_RED);

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
    SWATCHES.forEach(hex => {
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

  // the text layer on the sign
  const sign = document.createElement('div');
  sign.className = 'sign-text';
  canvas.appendChild(sign);

  let lineCount = 0;
  const languages = new Set();
  const texts = ['', '', ''];   // what's typed on each line (kept if line count changes)

  // shrink the text until every line fits inside the sign
  function fitSign() {
    const lines = [...sign.children];
    if (!lines.length || lines.every(l => !l.textContent)) return;
    const w = parseFloat(canvas.style.width)  || canvas.offsetWidth;
    const h = parseFloat(canvas.style.height) || canvas.offsetHeight;
    let size = (h * 0.8) / (lines.length * 1.1);        // as big as the height allows
    sign.style.fontSize = size + 'px';
    const widest = Math.max(...lines.map(l => l.scrollWidth));
    if (widest > w * 0.88) size *= (w * 0.88) / widest;  // then fit the width
    sign.style.fontSize = size + 'px';
  }

  function updateSign() {
    sign.replaceChildren(...texts.slice(0, lineCount).map(t => {
      const line = document.createElement('div');
      line.className = 'sign-line';
      line.textContent = t;
      return line;
    }));
    fitSign();
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