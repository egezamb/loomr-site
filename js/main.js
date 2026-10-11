(() => {
  const pages = [...document.querySelectorAll('.page')];
  const roomsIndex = document.querySelector('.rooms-index');
  const roomBtns = [...roomsIndex.querySelectorAll('button')];
  const cur = document.querySelector('.counter .cur');
  const bar = document.querySelector('.counter .bar i');
  const navLinks = [...document.querySelectorAll('nav.main a')];
  const pad = n => String(n).padStart(2, '0');
  const weave = document.querySelector('.weave');
  const weaveNum = weave.querySelector('.weave-num');
  const weaveName = weave.querySelector('.weave-name');
  const names = [...document.querySelectorAll('.menu li a')].map(a => a.textContent);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // cover: last thread lands at 620ms + 11 * 32ms; the label gets a beat to be read
  const COVER = 1100, REVEAL = 1000;
  let index = -1, locked = false;

  document.querySelector('.counter .tot').textContent = pad(pages.length);
  document.querySelector('.year').textContent = new Date().getFullYear();

  // Wrap every letter of the big titles so they can rise one by one
  document.querySelectorAll('.split').forEach(el => {
    const label = [...el.childNodes].map(n => n.nodeType === Node.TEXT_NODE ? n.textContent : ' ').join('');
    el.setAttribute('aria-label', label.replace(/\s+/g, ' ').trim());
    let d = 0;
    const words = [];
    el.childNodes.forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return words.push(node.cloneNode());
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) return words.push(document.createTextNode(' '));
        const w = document.createElement('span');
        w.className = 'w';
        w.setAttribute('aria-hidden', 'true');
        [...part].forEach(c => {
          const ch = document.createElement('span');
          ch.className = 'ch';
          ch.style.setProperty('--d', d++);
          ch.textContent = c;
          w.append(ch);
        });
        words.push(w);
      });
    });
    el.replaceChildren(...words);
  });

  function show(next) {
    const prev = pages[index];
    if (prev) prev.classList.remove('active');
    const target = pages[next];
    target.classList.add('active');

    index = next;
    document.body.classList.toggle('light', target.hasAttribute('data-light'));
    document.body.classList.toggle('last', index === pages.length - 1);
    cur.textContent = pad(index + 1);
    bar.style.transform = `scaleX(${(index + 1) / pages.length})`;

    const room = target.dataset.room;
    roomsIndex.hidden = room === undefined;
    roomBtns.forEach((b, i) => b.classList.toggle('on', String(i) === room));
    navLinks.forEach(a => a.classList.toggle('on', +a.dataset.go === index && index !== 0));
    history.replaceState(null, '', '#' + target.id);
  }

  // Threads close over the screen, the page swaps underneath, then they open again
  function go(next) {
    next = Math.max(0, Math.min(pages.length - 1, next));
    if (locked || next === index) return;

    // first load: the page starts behind the threads with the LOOMR mark, then they open
    if (index === -1) {
      show(next);
      locked = true;
      setTimeout(open, 700);
      setTimeout(() => { locked = false; }, 700 + REVEAL);
      return;
    }
    if (reduceMotion) return show(next);

    locked = true;
    weave.classList.toggle('down', next < index);
    weaveNum.textContent = `${pad(next + 1)} / ${pad(pages.length)}`;
    weaveName.textContent = names[next] || '';
    weave.classList.remove('out');
    weave.classList.add('in');
    setTimeout(() => { show(next); open(); }, COVER);
    setTimeout(() => { locked = false; }, COVER + REVEAL);
  }

  function open() {
    weave.classList.replace('in', 'out');
  }

  const next = () => go(index + 1);
  const prevPage = () => go(index - 1);
  const burger = document.querySelector('.burger');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
  };
  const closeMenu = () => setMenu(false);

  // Click anywhere on a page -> next page
  document.querySelector('.stage').addEventListener('click', e => {
    const jump = e.target.closest('[data-go]');
    if (jump) { e.preventDefault(); go(+jump.dataset.go); return; }
    if (e.target.closest('[data-next]')) { e.preventDefault(); next(); return; }
    if (e.target.closest('a,button')) { e.preventDefault(); return; }
    if (index === pages.length - 1) return;
    next();
  });

  document.querySelectorAll('header [data-go], .menu [data-go], .rooms-index [data-go]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); closeMenu(); go(+a.dataset.go); }));

  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.querySelectorAll('.tools button:not(.burger)').forEach(b => b.addEventListener('click', e => e.preventDefault()));

  addEventListener('keydown', e => {
    if (e.key === 'Escape') return closeMenu();
    // let focused links/buttons handle Enter and Space natively
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('a,button')) return;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prevPage(); }
  });

  let wheelAcc = 0, wheelTimer;
  addEventListener('wheel', e => {
    if (document.body.classList.contains('menu-open')) return;
    wheelAcc += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => wheelAcc = 0, 180);
    if (Math.abs(wheelAcc) > 60 && !locked) { wheelAcc > 0 ? next() : prevPage(); wheelAcc = 0; }
  }, { passive: true });

  let touchY = null;
  addEventListener('touchstart', e => touchY = e.touches[0].clientY, { passive: true });
  addEventListener('touchend', e => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) dy > 0 ? next() : prevPage();
    touchY = null;
  });

  // Resolve #section-id (or legacy #3 numeric) to a page index
  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    const byId = pages.findIndex(p => p.id === h);
    if (byId !== -1) return byId;
    const n = parseInt(h, 10);
    return n >= 1 && n <= pages.length ? n - 1 : 0;
  };
  addEventListener('hashchange', () => go(fromHash()));
  go(fromHash());
})();
