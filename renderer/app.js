(function () {
  const $ = (s) => document.querySelector(s);
  const FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass boost': [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
    'Treble boost': [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
    Vocal: [-2, -2, -1, 1, 4, 4, 3, 1, 0, -1],
    Rock: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
    Pop: [-1, 2, 4, 5, 3, 0, -1, -1, -1, -1],
    Classical: [0, 0, 0, 0, 0, 0, -2, -2, -2, -4],
    Dance: [6, 5, 3, 0, 0, -2, -3, -3, 0, 0]
  };
  const F = (p) => '<svg viewBox="0 0 24 24">' + p + '</svg>';
  const S2 = (p) => '<svg class="s" viewBox="0 0 24 24">' + p + '</svg>';
  const IC = {
    play: F('<path d="M8 5v14l11-7z"/>'),
    pause: F('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
    prev: F('<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/>'),
    next: F('<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>'),
    shuffle: S2('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    repeat: S2('<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>'),
    repeat1: S2('<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3M11 10h1v4"/>'),
    vol: S2('<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
    mute: S2('<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>'),
    eq: S2('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
    mini: S2('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
    full: S2('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    plus: S2('<path d="M12 5v14M5 12h14"/>'),
    folder: S2('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    trash: S2('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    edit: S2('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>'),
    music: S2('<path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>'),
    sun: S2('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'),
    moon: S2('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>'),
    bars: F('<path d="M4 10h3v10H4zM10 4h3v16h-3zM16 8h3v12h-3z"/>')
  };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const base = (p) => p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const fmt = (s) => {
    if (!isFinite(s) || s <= 0) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const url = (p) => 'pmp://media/?p=' + encodeURIComponent(p);

  let S = {
    playlists: [],
    view: null,
    volume: 0.8,
    shuffle: false,
    repeat: 'off',
    eq: { preset: 'Flat', gains: PRESETS.Flat.slice() },
    theme: 'dark'
  };
  let cur = null;
  let hist = [];
  let sel = null;
  let query = '';
  let muted = false;
  let saveT = null;
  let toastT = null;
  const artCache = new Map();
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';

  let ctx = null;
  let filters = [];
  let analyser = null;

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => window.pmp.saveState(S), 400);
  }

  function toast(m) {
    const t = $('#toast');
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  function ask(title, value, okText) {
    return new Promise((res) => {
      const d = $('#dlg');
      const i = $('#dlgi');
      $('#dlgt').textContent = title;
      i.hidden = value === null;
      i.value = value || '';
      $('#dlgok').textContent = okText || 'OK';
      d.returnValue = '';
      d.onclose = () => res(d.returnValue === 'ok' ? (value === null ? true : i.value.trim()) : null);
      d.showModal();
      if (!i.hidden) i.select();
    });
  }

  const plById = (id) => S.playlists.find((p) => p.id === id);
  const view = () => plById(S.view) || S.playlists[0];
  const curPl = () => (cur ? plById(cur.pl) : null);
  const curTrack = () => {
    const p = curPl();
    return p ? p.tracks[cur.i] : null;
  };

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    filters = FREQS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f;
      b.Q.value = 1;
      b.gain.value = S.eq.gains[i] || 0;
      return b;
    });
    let n = src;
    filters.forEach((f) => {
      n.connect(f);
      n = f;
    });
    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    n.connect(analyser);
    analyser.connect(ctx.destination);
  }

  function setGain(i, v) {
    S.eq.gains[i] = v;
    if (filters[i]) filters[i].gain.value = v;
  }

  function buildEq() {
    const sel_ = $('#preset');
    sel_.innerHTML = Object.keys(PRESETS).map((k) => '<option>' + esc(k) + '</option>').join('') + '<option>Custom</option>';
    sel_.value = S.eq.preset;
    const box = $('#eqs');
    box.innerHTML = '';
    FREQS.forEach((f, i) => {
      const d = document.createElement('div');
      const r = document.createElement('input');
      r.type = 'range';
      r.min = -12;
      r.max = 12;
      r.step = 1;
      r.value = S.eq.gains[i] || 0;
      r.setAttribute('aria-label', f + ' Hz');
      const fill = () => r.style.setProperty('--p', ((+r.value + 12) / 24) * 100 + '%');
      fill();
      r.addEventListener('input', () => {
        fill();
        setGain(i, +r.value);
        S.eq.preset = 'Custom';
        sel_.value = 'Custom';
        save();
      });
      const l = document.createElement('span');
      l.textContent = f >= 1000 ? f / 1000 + 'k' : f;
      d.append(r, l);
      box.append(d);
    });
  }

  sel_change();
  function sel_change() {
    $('#preset').addEventListener('change', (e) => {
      const k = e.target.value;
      if (!PRESETS[k]) return;
      S.eq.preset = k;
      S.eq.gains = PRESETS[k].slice();
      S.eq.gains.forEach((g, i) => filters[i] && (filters[i].gain.value = g));
      buildEq();
      save();
    });
  }

  let vizOn = false;
  function viz() {
    if (!vizOn) return;
    const c = $('#viz');
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (analyser) {
      const d = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(d);
      const n = 40;
      const w = c.width / n;
      const ac = getComputedStyle(document.body).getPropertyValue('--ac');
      g.fillStyle = ac;
      for (let i = 0; i < n; i++) {
        const v = d[Math.floor((i / n) * d.length * 0.8)] / 255;
        const h = Math.max(2, v * c.height);
        g.fillRect(i * w + 2, c.height - h, w - 4, h);
      }
    }
    requestAnimationFrame(viz);
  }

  function renderSide() {
    const box = $('#pls');
    box.innerHTML = '';
    S.playlists.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'pl' + (p.id === view().id ? ' on' : '');
      d.innerHTML =
        (cur && cur.pl === p.id ? '<span class="eq">' + IC.bars + '</span>' : '') +
        '<span class="n">' + esc(p.name) + '</span><span class="c">' + p.tracks.length + '</span>' +
        '<span class="x"><button data-a="ren" title="Rename">' + IC.edit + '</button><button data-a="del" title="Delete">' + IC.trash + '</button></span>';
      d.addEventListener('click', async (e) => {
        const a = e.target.closest('button');
        if (a && a.dataset.a === 'ren') {
          const n = await ask('Rename playlist', p.name, 'Rename');
          if (n) {
            p.name = n.slice(0, 60);
            renderAll();
            save();
          }
        } else if (a && a.dataset.a === 'del') {
          const ok = await ask('Delete "' + p.name + '"?', null, 'Delete');
          if (!ok) return;
          if (cur && cur.pl === p.id) stop();
          S.playlists = S.playlists.filter((x) => x.id !== p.id);
          if (!S.playlists.length) S.playlists.push({ id: uid(), name: 'My playlist', tracks: [] });
          S.view = S.playlists[0].id;
          renderAll();
          save();
        } else {
          S.view = p.id;
          sel = null;
          renderAll();
          save();
        }
      });
      box.append(d);
    });
  }

  function renderList() {
    const p = view();
    $('#plname').textContent = p.name;
    $('#plcount').textContent = p.tracks.length + (p.tracks.length === 1 ? ' track' : ' tracks');
    const box = $('#list');
    const q = query.toLowerCase();
    const rows = [];
    p.tracks.forEach((t, i) => {
      if (q && !(t.title + ' ' + t.artist + ' ' + t.album).toLowerCase().includes(q)) return;
      rows.push([t, i]);
    });
    if (!rows.length) {
      box.innerHTML = '<div class="empty"><div>' + (p.tracks.length ? 'No matches.' : 'This playlist is empty.<br>Add files or drop a folder here.') + '</div></div>';
      return;
    }
    box.innerHTML = rows
      .map(([t, i]) => {
        const now = cur && cur.pl === p.id && cur.i === i;
        return (
          '<div class="row' + (now ? ' now' : '') + (sel === t.id ? ' sel' : '') + '" data-i="' + i + '">' +
          '<span class="i">' + (now ? (audio.paused ? IC.play : IC.bars) : i + 1) + '</span>' +
          '<span class="t"><b>' + esc(t.title) + '</b><span>' + esc(t.artist || 'Unknown artist') + '</span></span>' +
          '<span class="al">' + esc(t.album) + '</span>' +
          '<span class="d">' + (t.dur ? fmt(t.dur) : '') + '</span>' +
          '<button class="rm" title="Remove">' + IC.trash + '</button></div>'
        );
      })
      .join('');
  }

  function renderAll() {
    renderSide();
    renderList();
  }

  function updateBar() {
    $('#bplay').innerHTML = audio.paused ? IC.play : IC.pause;
    $('#bshuf').innerHTML = IC.shuffle;
    $('#bshuf').classList.toggle('on', S.shuffle);
    $('#brep').innerHTML = S.repeat === 'one' ? IC.repeat1 : IC.repeat;
    $('#brep').classList.toggle('on', S.repeat !== 'off');
    $('#bmute').innerHTML = muted || S.volume === 0 ? IC.mute : IC.vol;
    $('#btheme').innerHTML = S.theme === 'dark' ? IC.sun : IC.moon;
    const mini = document.body.classList.contains('mini');
    $('#bmini').innerHTML = mini ? IC.full : IC.mini;
    $('#bmini').title = mini ? 'Full player' : 'Mini player';
    const v = $('#vol');
    v.value = Math.round((muted ? 0 : S.volume) * 100);
    v.style.setProperty('--p', v.value + '%');
  }

  async function getArt(t) {
    if (artCache.has(t.path)) return artCache.get(t.path);
    const tg = await window.pmp.tags(t.path);
    artCache.set(t.path, tg.art || '');
    return tg.art || '';
  }

  async function showNow(t) {
    $('#nt').textContent = t.title;
    $('#na').textContent = [t.artist, t.album].filter(Boolean).join(' · ');
    const art = $('#art');
    art.style.backgroundImage = '';
    art.innerHTML = IC.music;
    document.title = t.title + ' · Presslay Media Player';
    const a = await getArt(t);
    if (curTrack() !== t) return;
    if (a) {
      art.style.backgroundImage = 'url("' + a + '")';
      art.innerHTML = '';
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album,
        artwork: a ? [{ src: a }] : []
      });
    }
  }

  function play(plId, i, fromHist) {
    const pl = plById(plId);
    if (!pl || !pl.tracks[i]) return;
    if (!fromHist && cur) {
      hist.push(cur);
      if (hist.length > 200) hist.shift();
    }
    cur = { pl: plId, i };
    const t = pl.tracks[i];
    audio.src = url(t.path);
    ensureCtx();
    audio.play().catch(() => {});
    showNow(t);
    renderAll();
    updateBar();
  }

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    cur = null;
    $('#nt').textContent = 'Nothing playing';
    $('#na').textContent = '';
    $('#art').style.backgroundImage = '';
    $('#art').innerHTML = IC.music;
    $('#seek').value = 0;
    $('#seek').style.setProperty('--p', '0%');
    $('#tc').textContent = '0:00';
    $('#td').textContent = '0:00';
    document.title = 'Presslay Media Player';
    renderAll();
    updateBar();
  }

  function toggle() {
    if (!cur) {
      const p = view();
      if (!p.tracks.length) return;
      const i = sel ? Math.max(0, p.tracks.findIndex((t) => t.id === sel)) : 0;
      play(p.id, i);
      return;
    }
    if (audio.paused) {
      ensureCtx();
      audio.play().catch(() => {});
    } else audio.pause();
  }

  function next(auto) {
    if (!cur) return;
    const pl = curPl();
    if (!pl) return;
    const n = pl.tracks.length;
    if (auto && S.repeat === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    let i;
    if (S.shuffle && n > 1) {
      do i = Math.floor(Math.random() * n);
      while (i === cur.i);
    } else {
      i = cur.i + 1;
      if (i >= n) {
        if (S.repeat === 'all' || !auto) i = 0;
        else {
          audio.pause();
          audio.currentTime = 0;
          renderList();
          updateBar();
          return;
        }
      }
    }
    play(cur.pl, i);
  }

  function prev() {
    if (!cur) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    while (hist.length) {
      const h = hist.pop();
      const p = plById(h.pl);
      if (p && p.tracks[h.i]) {
        play(h.pl, h.i, true);
        return;
      }
    }
    const n = curPl().tracks.length;
    play(cur.pl, (cur.i - 1 + n) % n, true);
  }

  function probe(p) {
    return new Promise((res) => {
      const a = new Audio();
      a.crossOrigin = 'anonymous';
      a.preload = 'metadata';
      let done = false;
      const fin = (d) => {
        if (done) return;
        done = true;
        a.removeAttribute('src');
        res(d);
      };
      a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => fin(0);
      setTimeout(() => fin(0), 5000);
      a.src = url(p);
    });
  }

  async function enrich(list) {
    let n = 0;
    for (const t of list) {
      const tg = await window.pmp.tags(t.path);
      if (tg.title) t.title = tg.title;
      if (tg.artist) t.artist = tg.artist;
      if (tg.album) t.album = tg.album;
      artCache.set(t.path, tg.art || '');
      t.dur = await probe(t.path);
      if (++n % 5 === 0) renderList();
    }
    renderAll();
    save();
  }

  async function addPaths(paths, playFirst) {
    const files = await window.pmp.expand(paths);
    if (!files.length) {
      toast('No audio files found');
      return;
    }
    const pl = view();
    const have = new Set(pl.tracks.map((t) => t.path));
    const added = [];
    for (const f of files) {
      if (have.has(f)) continue;
      have.add(f);
      const t = { id: uid(), path: f, title: base(f), artist: '', album: '', dur: 0 };
      pl.tracks.push(t);
      added.push(t);
    }
    renderAll();
    save();
    if (!added.length) {
      toast('Already in this playlist');
      if (playFirst) {
        const i = pl.tracks.findIndex((t) => t.path === files[0]);
        if (i >= 0) play(pl.id, i);
      }
      return;
    }
    toast(added.length + (added.length === 1 ? ' track added' : ' tracks added'));
    if (playFirst) play(pl.id, pl.tracks.indexOf(added[0]));
    enrich(added);
  }

  function removeTrack(i) {
    const p = view();
    const t = p.tracks[i];
    if (!t) return;
    if (cur && cur.pl === p.id) {
      if (cur.i === i) stop();
      else if (cur.i > i) cur.i--;
    }
    p.tracks.splice(i, 1);
    if (sel === t.id) sel = null;
    renderAll();
    save();
  }

  function setVolume(v) {
    S.volume = Math.min(1, Math.max(0, v));
    muted = false;
    audio.volume = S.volume;
    updateBar();
    save();
  }

  function setMini(on) {
    document.body.classList.toggle('mini', on);
    window.pmp.mini(on);
    updateBar();
  }

  function cmd(c) {
    if (c === 'toggle') toggle();
    else if (c === 'next') next(false);
    else if (c === 'prev') prev();
    else if (c === 'stop') stop();
  }

  $('#list').addEventListener('click', (e) => {
    const r = e.target.closest('.row');
    if (!r) return;
    const i = +r.dataset.i;
    if (e.target.closest('.rm')) {
      removeTrack(i);
      return;
    }
    sel = view().tracks[i].id;
    renderList();
  });
  $('#list').addEventListener('dblclick', (e) => {
    const r = e.target.closest('.row');
    if (r && !e.target.closest('.rm')) play(view().id, +r.dataset.i);
  });

  $('#newpl').addEventListener('click', async () => {
    const n = await ask('New playlist', 'Playlist ' + (S.playlists.length + 1), 'Create');
    if (!n) return;
    const p = { id: uid(), name: n.slice(0, 60), tracks: [] };
    S.playlists.push(p);
    S.view = p.id;
    renderAll();
    save();
  });
  $('#addf').addEventListener('click', async () => {
    const f = await window.pmp.pickFiles();
    if (f.length) addPaths(f, false);
  });
  $('#addd').addEventListener('click', async () => {
    const f = await window.pmp.pickFolder();
    if (f.length) addPaths(f, false);
  });
  $('#imp').addEventListener('click', async () => {
    const r = await window.pmp.importM3u();
    if (!r) return;
    if (!r.files.length) {
      toast('No playable tracks found in that playlist');
      return;
    }
    const p = { id: uid(), name: r.name.slice(0, 60), tracks: [] };
    S.playlists.push(p);
    S.view = p.id;
    await addPaths(r.files, false);
  });
  $('#exp').addEventListener('click', async () => {
    const p = view();
    if (!p.tracks.length) {
      toast('Nothing to export');
      return;
    }
    const ok = await window.pmp.exportM3u(p.name, p.tracks.map((t) => t.path));
    if (ok) toast('Playlist exported');
  });
  $('#q').addEventListener('input', (e) => {
    query = e.target.value.trim();
    renderList();
  });

  $('#bplay').addEventListener('click', toggle);
  $('#bnext').addEventListener('click', () => next(false));
  $('#bprev').addEventListener('click', prev);
  $('#bshuf').addEventListener('click', () => {
    S.shuffle = !S.shuffle;
    updateBar();
    save();
  });
  $('#brep').addEventListener('click', () => {
    S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
    updateBar();
    save();
  });
  $('#bmute').addEventListener('click', () => {
    muted = !muted;
    audio.volume = muted ? 0 : S.volume;
    updateBar();
  });
  $('#vol').addEventListener('input', (e) => setVolume(+e.target.value / 100));
  $('#btheme').addEventListener('click', () => {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = S.theme;
    updateBar();
    save();
  });
  $('#bmini').addEventListener('click', () => setMini(!document.body.classList.contains('mini')));
  $('#beq').addEventListener('click', () => {
    $('#eqp').hidden = false;
    ensureCtx();
    vizOn = true;
    viz();
  });
  const closeEq = () => {
    $('#eqp').hidden = true;
    vizOn = false;
  };
  $('#eqclose').addEventListener('click', closeEq);
  $('#eqp').addEventListener('click', (e) => {
    if (e.target.id === 'eqp') closeEq();
  });

  const sk = $('#seek');
  let seeking = false;
  sk.addEventListener('input', () => {
    seeking = true;
    sk.style.setProperty('--p', sk.value / 10 + '%');
    if (audio.duration) $('#tc').textContent = fmt((sk.value / 1000) * audio.duration);
  });
  sk.addEventListener('change', () => {
    if (audio.duration) audio.currentTime = (sk.value / 1000) * audio.duration;
    seeking = false;
  });

  audio.addEventListener('timeupdate', () => {
    if (seeking || !audio.duration) return;
    const v = (audio.currentTime / audio.duration) * 1000;
    sk.value = v;
    sk.style.setProperty('--p', v / 10 + '%');
    $('#tc').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => {
    $('#td').textContent = fmt(audio.duration);
    const t = curTrack();
    if (t && !t.dur && isFinite(audio.duration)) {
      t.dur = audio.duration;
      renderList();
      save();
    }
  });
  audio.addEventListener('play', () => {
    updateBar();
    renderList();
  });
  audio.addEventListener('pause', () => {
    updateBar();
    renderList();
  });
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('error', () => {
    if (!cur) return;
    toast('Could not play "' + (curTrack() ? curTrack().title : 'track') + '"');
    setTimeout(() => cur && next(true), 600);
  });

  document.addEventListener('keydown', (e) => {
    const tg = e.target.tagName;
    if (tg === 'INPUT' && e.target.type !== 'range') return;
    if (tg === 'TEXTAREA' || tg === 'SELECT' || $('#dlg').open) return;
    if (e.code === 'Space') {
      e.preventDefault();
      toggle();
    } else if (e.code === 'ArrowRight' && audio.duration) {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      setVolume(S.volume + 0.05);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      setVolume(S.volume - 0.05);
    } else if (e.code === 'Enter' && sel) {
      const i = view().tracks.findIndex((t) => t.id === sel);
      if (i >= 0) play(view().id, i);
    } else if (e.code === 'Delete' && sel) {
      const i = view().tracks.findIndex((t) => t.id === sel);
      if (i >= 0) removeTrack(i);
    } else if (e.code === 'KeyM') $('#bmute').click();
    else if (e.code === 'KeyS') $('#bshuf').click();
    else if (e.code === 'KeyR') $('#brep').click();
    else if (e.code === 'KeyN') next(false);
    else if (e.code === 'KeyP') prev();
  });

  let dragN = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragN++;
    $('#drop').classList.add('on');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', () => {
    dragN = Math.max(0, dragN - 1);
    if (!dragN) $('#drop').classList.remove('on');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragN = 0;
    $('#drop').classList.remove('on');
    const paths = [...e.dataTransfer.files].map((f) => window.pmp.pathFor(f)).filter(Boolean);
    if (paths.length) addPaths(paths, false);
  });

  window.pmp.onOpen((list) => addPaths(list, true));
  window.pmp.onCmd(cmd);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
    navigator.mediaSession.setActionHandler('previoustrack', prev);
  }

  $('#logo').innerHTML = IC.play;
  $('#newpl').innerHTML = IC.plus + 'New playlist';
  $('#addf').innerHTML = IC.plus + 'Add files';
  $('#addd').innerHTML = IC.folder + 'Add folder';
  $('#beq').innerHTML = IC.eq;
  $('#art').innerHTML = IC.music;

  (async function boot() {
    const saved = await window.pmp.loadState();
    if (saved && Array.isArray(saved.playlists)) {
      S = Object.assign(S, saved);
      S.eq = Object.assign({ preset: 'Flat', gains: PRESETS.Flat.slice() }, saved.eq || {});
      if (!Array.isArray(S.eq.gains) || S.eq.gains.length !== 10) S.eq.gains = PRESETS.Flat.slice();
    }
    if (!S.playlists.length) S.playlists.push({ id: uid(), name: 'My playlist', tracks: [] });
    if (!plById(S.view)) S.view = S.playlists[0].id;
    document.body.dataset.theme = S.theme;
    audio.volume = S.volume;
    buildEq();
    renderAll();
    updateBar();
    const start = await window.pmp.ready();
    if (start.length) addPaths(start, true);
  })();
})();
