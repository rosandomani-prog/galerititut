(() => {
  const $ = s => document.querySelector(s);
  const board = $('#board'), dlgUnggah = $('#dlgUnggah'), dlgLihat = $('#dlgLihat');
  let urls = [];

  /* ---------- penyimpanan lokal (IndexedDB) ---------- */
  const openDB = () => new Promise((res, rej) => {
    const r = indexedDB.open('galeri-titut', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('foto', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => {
    const d = await openDB();
    return new Promise((res, rej) => {
      const t = d.transaction('foto', mode);
      const q = fn(t.objectStore('foto'));
      t.oncomplete = () => res(q && q.result);
      t.onerror = () => rej(t.error);
    });
  };

  /* ---------- foto bersama (photos.json di repo) ---------- */
  async function muatBersama() {
    try {
      const r = await fetch('photos.json', { cache: 'no-cache' });
      if (!r.ok) return [];
      const list = await r.json();
      return list.map(p => ({ id: 's:' + p.src, src: p.src, caption: p.caption || '', by: p.by || '', time: Date.parse(p.date) || 0, shared: true }));
    } catch { return []; }
  }

  /* ---------- acak yang konsisten per foto ---------- */
  function rng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  const between = (r, a, b) => a + r() * (b - a);

  /* ---------- tampilan kolase ---------- */
  async function render() {
    urls.forEach(URL.revokeObjectURL); urls = [];
    let lokal = [];
    try { lokal = await run('readonly', s => s.getAll()); } catch {}
    const semua = [...await muatBersama(), ...lokal].sort((a, b) => b.time - a.time);
    board.textContent = '';
    if (!semua.length) {
      board.innerHTML = '<div class="kosong"><b>Papan masih kosong</b>Tempel foto pertama kalian lewat tombol di atas.</div>';
      return;
    }
    semua.forEach(p => {
      const r = rng(p.id);
      const jenis = ['polaroid', 'kertas', 'polos'][Math.floor(r() * 3)];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `item ${jenis} t${1 + Math.floor(r() * 3)}`;
      el.style.cssText = `--w:${Math.round(between(r, 190, 300))};--r:${between(r, -6, 6).toFixed(2)};--mx:${Math.round(between(r, -12, 14))};--my:${Math.round(between(r, -8, 16))};--ty:${Math.round(between(r, -10, 22))};--tape:${between(r, -8, 8).toFixed(1)}deg`;
      const src = p.shared ? p.src : (urls[urls.push(URL.createObjectURL(p.blob)) - 1]);
      const frame = document.createElement('div'); frame.className = 'frame';
      const img = new Image(); img.src = src; img.loading = 'lazy'; img.alt = p.caption || 'Foto Galeri Titut';
      const cap = document.createElement('div'); cap.className = 'cap';
      cap.textContent = p.caption || '';
      if (p.by) { const s = document.createElement('small'); s.textContent = '— ' + p.by; cap.appendChild(s); }
      frame.append(img);
      if (jenis === 'polos') { el.append(frame, cap); } else { frame.append(cap); el.append(frame); }
      el.addEventListener('click', () => lihat(p, src));
      board.appendChild(el);
    });
  }

  function lihat(p, src) {
    $('#besar').src = src; $('#besar').alt = p.caption || 'Foto';
    $('#ket').textContent = [p.caption, p.by && '— ' + p.by].filter(Boolean).join(' ');
    const h = $('#hapus'); h.hidden = !!p.shared;
    h.onclick = async () => {
      if (!confirm('Hapus foto ini dari peramban ini?')) return;
      await run('readwrite', s => s.delete(p.id)); dlgLihat.close(); render();
    };
    dlgLihat.showModal();
  }

  /* ---------- unggah ---------- */
  async function kecilkan(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', .82));
  }

  $('#btnTambah').onclick = () => { $('#form').reset(); $('#status').textContent = ''; dlgUnggah.showModal(); };
  $('#batal').onclick = () => dlgUnggah.close();
  $('#tutup').onclick = () => dlgLihat.close();
  [dlgUnggah, dlgLihat].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    const files = [...$('#file').files], st = $('#status'), btn = $('#simpan');
    if (!files.length) return;
    btn.disabled = true; let gagal = 0;
    for (let i = 0; i < files.length; i++) {
      st.textContent = `Menyimpan ${i + 1} dari ${files.length}…`;
      try {
        const blob = await kecilkan(files[i]);
        await run('readwrite', s => s.put({
          id: crypto.randomUUID(), blob, time: Date.now() + i,
          caption: $('#caption').value.trim(), by: $('#by').value.trim()
        }));
      } catch { gagal++; }
    }
    btn.disabled = false;
    if (gagal) { st.textContent = `${gagal} foto gagal disimpan. Coba format JPG atau PNG.`; }
    else dlgUnggah.close();
    render();
  });

  render();
})();
