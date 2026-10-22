const { app, BrowserWindow, ipcMain, dialog, globalShortcut, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');

const AUDIO = /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus)$/i;

protocol.registerSchemesAsPrivileged([
  { scheme: 'pmp', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true } }
]);

let win = null;
let ready = false;
let pending = [];
let normalBounds = null;

const stateFile = () => path.join(app.getPath('userData'), 'library.json');

function argFiles(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter((a) => AUDIO.test(a) && fs.existsSync(a));
}

function send(ch, payload) {
  if (win && ready) win.webContents.send(ch, payload);
  else if (ch === 'open-files') pending.push(...payload);
}

async function walk(p, out, depth) {
  let st;
  try { st = await fsp.stat(p); } catch { return; }
  if (st.isDirectory()) {
    if (depth > 8) return;
    let names;
    try { names = await fsp.readdir(p); } catch { return; }
    names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const n of names) await walk(path.join(p, n), out, depth + 1);
  } else if (AUDIO.test(p)) {
    out.push(p);
  }
}

async function scan(list) {
  const out = [];
  for (const p of list) await walk(p, out, 0);
  return out;
}

function synch(b, o) {
  return (b[o] & 127) * 2097152 + (b[o + 1] & 127) * 16384 + (b[o + 2] & 127) * 128 + (b[o + 3] & 127);
}

function dec(buf, enc) {
  if (!buf.length) return '';
  let s;
  if (enc === 1) {
    if (buf[0] === 0xff && buf[1] === 0xfe) s = buf.subarray(2).toString('utf16le');
    else if (buf[0] === 0xfe && buf[1] === 0xff) {
      const c = Buffer.from(buf.subarray(2, 2 + ((buf.length - 2) & ~1)));
      c.swap16();
      s = c.toString('utf16le');
    } else s = buf.toString('utf16le');
  } else if (enc === 2) {
    const c = Buffer.from(buf.subarray(0, buf.length & ~1));
    c.swap16();
    s = c.toString('utf16le');
  } else if (enc === 3) s = buf.toString('utf8');
  else s = buf.toString('latin1');
  return s.split('\0')[0].trim();
}

function pic(d, v22) {
  const enc = d[0];
  let o = 1;
  let mime;
  if (v22) {
    mime = 'image/' + d.subarray(1, 4).toString('latin1').toLowerCase();
    o = 4;
  } else {
    const e = d.indexOf(0, o);
    if (e < 0) return null;
    mime = d.subarray(o, e).toString('latin1');
    o = e + 1;
  }
  o += 1;
  if (enc === 1 || enc === 2) {
    while (o + 1 < d.length && !(d[o] === 0 && d[o + 1] === 0)) o += 2;
    o += 2;
  } else {
    while (o < d.length && d[o] !== 0) o++;
    o += 1;
  }
  if (o >= d.length) return null;
  if (!/^image\//.test(mime) || mime === 'image/') mime = 'image/jpeg';
  if (mime === 'image/jpg') mime = 'image/jpeg';
  return 'data:' + mime + ';base64,' + d.subarray(o).toString('base64');
}

async function readTags(p) {
  const r = { title: '', artist: '', album: '', art: '' };
  let fh;
  try {
    fh = await fsp.open(p, 'r');
    const h = Buffer.alloc(10);
    await fh.read(h, 0, 10, 0);
    if (h.toString('latin1', 0, 3) === 'ID3') {
      const ver = h[3];
      const flags = h[5];
      const size = Math.min(synch(h, 6), 12 * 1024 * 1024);
      const buf = Buffer.alloc(size);
      await fh.read(buf, 0, size, 10);
      let o = 0;
      if (flags & 0x40) o = ver === 4 ? synch(buf, 0) : buf.readUInt32BE(0) + 4;
      const idl = ver === 2 ? 3 : 4;
      const hl = ver === 2 ? 6 : 10;
      while (o + hl <= size) {
        const id = buf.toString('latin1', o, o + idl);
        if (!/^[A-Z0-9]+$/.test(id)) break;
        let len;
        if (ver === 2) len = (buf[o + 3] << 16) | (buf[o + 4] << 8) | buf[o + 5];
        else if (ver === 4) len = synch(buf, o + 4);
        else len = buf.readUInt32BE(o + 4);
        const ds = o + hl;
        const de = ds + len;
        if (len <= 0 || de > size) break;
        const d = buf.subarray(ds, de);
        if (id === 'TIT2' || id === 'TT2') r.title = dec(d.subarray(1), d[0]);
        else if (id === 'TPE1' || id === 'TP1') r.artist = dec(d.subarray(1), d[0]);
        else if (id === 'TALB' || id === 'TAL') r.album = dec(d.subarray(1), d[0]);
        else if ((id === 'APIC' || id === 'PIC') && !r.art) r.art = pic(d, ver === 2) || '';
        o = de;
      }
    }
    if (!r.title && !r.artist) {
      const st = await fh.stat();
      if (st.size > 128) {
        const t = Buffer.alloc(128);
        await fh.read(t, 0, 128, st.size - 128);
        if (t.toString('latin1', 0, 3) === 'TAG') {
          const f = (a, b) => t.toString('latin1', a, b).replace(/\0.*$/s, '').trim();
          r.title = f(3, 33);
          r.artist = f(33, 63);
          r.album = f(63, 93);
        }
      }
    }
  } catch (e) {
  } finally {
    if (fh) await fh.close();
  }
  return r;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#0e1116',
    title: 'Presslay Media Player',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => {
    win = null;
    ready = false;
  });
}

function start() {
  Menu.setApplicationMenu(null);
  pending = argFiles(process.argv);

  protocol.handle('pmp', async (req) => {
    try {
      const p = new URL(req.url).searchParams.get('p');
      const r = await net.fetch(pathToFileURL(p).toString(), { headers: req.headers });
      const h = new Headers(r.headers);
      h.set('access-control-allow-origin', '*');
      return new Response(r.body, { status: r.status, headers: h });
    } catch (e) {
      return new Response('', { status: 404 });
    }
  });

  ipcMain.handle('ready', () => {
    ready = true;
    const p = pending;
    pending = [];
    return p;
  });

  ipcMain.handle('pick-files', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Add music',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac', 'opus'] }]
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('pick-folder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Add a music folder', properties: ['openDirectory'] });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('expand', (e, list) => scan(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []));

  ipcMain.handle('load-state', async () => {
    try { return JSON.parse(await fsp.readFile(stateFile(), 'utf8')); } catch { return null; }
  });

  ipcMain.on('save-state', (e, s) => {
    try {
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
      fs.writeFileSync(stateFile(), JSON.stringify(s));
    } catch (err) {}
  });

  ipcMain.handle('tags', (e, p) => readTags(String(p)));

  ipcMain.on('mini', (e, on) => {
    if (!win) return;
    if (on) {
      normalBounds = win.getBounds();
      win.setResizable(true);
      win.setMinimumSize(380, 150);
      win.setSize(430, 170);
      win.setResizable(false);
      win.setAlwaysOnTop(true);
    } else {
      win.setAlwaysOnTop(false);
      win.setResizable(true);
      win.setMinimumSize(760, 520);
      if (normalBounds) win.setBounds(normalBounds);
    }
  });

  ipcMain.handle('export-m3u', async (e, name, files) => {
    const r = await dialog.showSaveDialog(win, {
      title: 'Export playlist',
      defaultPath: String(name || 'playlist').replace(/[\\/:*?"<>|]/g, '_') + '.m3u8',
      filters: [{ name: 'Playlist', extensions: ['m3u8', 'm3u'] }]
    });
    if (r.canceled || !r.filePath) return false;
    await fsp.writeFile(r.filePath, '#EXTM3U\n' + files.join('\n') + '\n', 'utf8');
    return true;
  });

  ipcMain.handle('import-m3u', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Import playlist',
      properties: ['openFile'],
      filters: [{ name: 'Playlist', extensions: ['m3u8', 'm3u'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0];
    const text = await fsp.readFile(f, 'utf8');
    const dir = path.dirname(f);
    const files = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => (path.isAbsolute(l) ? l : path.join(dir, l)))
      .filter((l) => AUDIO.test(l) && fs.existsSync(l));
    return { name: path.basename(f).replace(/\.[^.]+$/, ''), files };
  });

  ipcMain.on('reveal', (e, p) => shell.showItemInFolder(String(p)));

  [['MediaPlayPause', 'toggle'], ['MediaNextTrack', 'next'], ['MediaPreviousTrack', 'prev'], ['MediaStop', 'stop']].forEach(([key, cmd]) => {
    try { globalShortcut.register(key, () => send('cmd', cmd)); } catch (err) {}
  });

  createWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = argFiles(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    if (f.length) send('open-files', f);
  });
  app.whenReady().then(start);
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
