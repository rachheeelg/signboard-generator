  // ---- Edit these ----
  const WORDS = ['Grocery', 'Restaurant', 'Cafe'];   // the red words, in order
  const HOLD_START = 0.12;  // portion of the scroll showing just "The Signmator" at the start
  const DOCK_AT   = 0.82;   // portion of the scroll after which the lockup moves to the top
  // --------------------

  const track  = document.querySelector('.track');
  const sticky = document.querySelector('.sticky');
  const lockup = document.querySelector('.lockup');
  const slot   = document.querySelector('.slot');

  const spans = WORDS.map(w => {
    const s = document.createElement('span');
    s.textContent = w;
    slot.appendChild(s);
    return s;
  });

  // Lock the slot to the widest word so the black words stay put
  const measure = () => {
    slot.style.setProperty('--w', Math.max(...spans.map(s => s.offsetWidth)) + 'px');
    render(true);
  };

  let lastIndex = null, lastDocked = null;

  function render(force) {
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (track.offsetHeight - innerHeight)));

    sticky.style.setProperty('--p', p);   // gradient follows scroll continuously

    // -1 = no red word, 0..n-1 = which word is showing
    let index = -1;
    if (p >= HOLD_START && p < DOCK_AT) {
      const t = (p - HOLD_START) / (DOCK_AT - HOLD_START);
      index = Math.min(WORDS.length - 1, Math.floor(t * WORDS.length));
    }
    const docked = p >= DOCK_AT;

    if (force || index !== lastIndex) {
      spans.forEach((s, i) => {
        s.classList.toggle('current', i === index);
        s.classList.toggle('past', docked ? true : i < index);
      });
      lockup.classList.toggle('closed', index < 0);   // tight spacing when no red word
      
      lastIndex = index;
    }
    if (force || docked !== lastDocked) {
      lockup.classList.toggle('docked', docked);
      sticky.classList.toggle('docked', docked);
      lastDocked = docked;
    }
  }

  addEventListener('scroll', () => render(false), { passive: true });
  addEventListener('resize', measure);
  document.fonts.ready.then(measure);
  measure();