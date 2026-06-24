// ===== STATE =====
let items = [];
let txLog = [];
// Baked values selalu jadi default — kalau sudah ada BAKED_*, pakai itu langsung
let ACCESS_KEY = (typeof BAKED_KEY !== 'undefined' && BAKED_KEY) ? BAKED_KEY : (localStorage.getItem(LS_KEY) || null);
let BIN_ITEMS  = (typeof BAKED_BIN_ITEMS !== 'undefined' && BAKED_BIN_ITEMS) ? BAKED_BIN_ITEMS : (localStorage.getItem(LS_BIN_ITEMS) || null);
let BIN_TX     = (typeof BAKED_BIN_TX !== 'undefined' && BAKED_BIN_TX) ? BAKED_BIN_TX : (localStorage.getItem(LS_BIN_TX) || null);
// Simpan ke localStorage biar offline cache tetap nyambung ke bin yang bener
if(ACCESS_KEY) localStorage.setItem(LS_KEY, ACCESS_KEY);
if(BIN_ITEMS)  localStorage.setItem(LS_BIN_ITEMS, BIN_ITEMS);
if(BIN_TX)     localStorage.setItem(LS_BIN_TX, BIN_TX);
let currentTab = 'dashboard';
let saveTimer = null;

// ===== HELPERS =====
function fmtRp(n){
  n = Math.round(n||0);
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString('id-ID');
  return (neg?'-':'') + 'Rp' + s;
}
function fmtNum(n){ return Math.round(n||0).toLocaleString('id-ID'); }
function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0,10);
}
function daysBetween(isoA, isoB){
  const a = new Date(isoA+'T00:00:00'), b = new Date(isoB+'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function fmtDate(iso){
  if(!iso) return '-';
  const d = new Date(iso+'T00:00:00');
  const months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();
}
function uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
let _seqCounter = 0;
function nextTs(){ return Date.now()*1000 + (_seqCounter++ % 1000); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function findItem(id){ return items.find(i => i.id === id); }
function findTx(id){ return txLog.find(t => t.id === id); }
function setSyncDot(state){
  const dot = document.getElementById('syncDot');
  if(dot) dot.className = 'sync-dot ' + state;
}
function showOffline(on){
  const b = document.getElementById('offlineBanner');
  if(b) b.classList.toggle('hidden', !on);
}
function showToast(msg, type){
  const host = document.getElementById('toastHost');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  t.innerHTML = (type==='success'?'✓ ':type==='error'?'⚠ ':'') + escapeHtml(msg);
  host.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function stokStatus(item){
  const idle = item.stokIdle || 1;
  const pct = Math.min(100, (item.stokSaatIni / idle) * 100);
  let level = 'success';
  if(item.stokSaatIni <= 0) level = 'danger';
  else if(pct < 30) level = 'danger';
  else if(pct < 70) level = 'warning';
  return {level, pct};
}
function isIncomplete(item){ return !(item.modalSatuan > 0); } // modal belum diisi = wajib bayar gak bisa dihitung

// ===== MODEL: migrate + recompute (derived stock) =====
// Data lama dianggap "baseline" (sudah baked ke stokAwal/modalAwal).
// Transaksi baru ditandai gen:2 dan di-replay untuk menurunkan stok & modal terkini.
function migrateModel(){
  items.forEach(it => {
    if(it.stokAwal === undefined) it.stokAwal = (it.stokSaatIni || 0);
    if(it.modalAwal === undefined) it.modalAwal = (it.modalSatuan || 0);
  });
  txLog.forEach(tx => {
    if(tx.gen === undefined) tx.gen = 1; // historis, sudah baked di baseline
    if(tx.ts === undefined) tx.ts = nextTs();
  });
}

function recompute(){
  // mulai dari baseline
  const state = {};
  items.forEach(it => { state[it.id] = {stok: it.stokAwal||0, modal: it.modalAwal||0, lastOpname: null}; });
  // replay hanya transaksi gen 2, kronologis (ts, lalu urutan asli sebagai tiebreak biar stabil)
  const g2 = txLog
    .map((t, idx) => ({t, idx}))
    .filter(x => x.t.gen === 2)
    .sort((a,b) => (a.t.ts||0) - (b.t.ts||0) || a.idx - b.idx)
    .map(x => x.t);
  g2.forEach(tx => {
    const s = state[tx.itemId];
    if(!s) return;
    if(tx.type === 'restock'){
      s.stok += tx.qty;
      if(tx.qty > 0) s.modal = tx.totalBayar / tx.qty;
      tx.modalSatuanBaru = tx.qty > 0 ? tx.totalBayar / tx.qty : 0;
    } else if(tx.type === 'opname'){
      const sebelum = s.stok;
      const laku = Math.max(0, sebelum - tx.stokSisa);
      tx.stokSebelum = sebelum;
      tx.laku = laku;
      tx.modalDipakai = s.modal;
      tx.wajibBayar = laku * s.modal;
      tx.kebutuhanRefill = calcRefill({stokIdle: (findItem(tx.itemId)||{}).stokIdle||0, packSize:(findItem(tx.itemId)||{}).packSize||1}, tx.stokSisa);
      s.stok = tx.stokSisa;
      s.lastOpname = tx.date;
    } else if(tx.type === 'retur'){
      s.stok -= tx.qty;
    }
  });
  // tulis balik ke item
  items.forEach(it => {
    const s = state[it.id];
    it.stokSaatIni = s.stok;
    it.modalSatuan = s.modal;
    // lastOpnameDate = max dari opname gen1(stored) & gen2
    let last = s.lastOpname;
    txLog.forEach(tx => {
      if(tx.itemId===it.id && tx.type==='opname'){
        if(!last || tx.date > last) last = tx.date;
      }
    });
    it.lastOpnameDate = last;
  });
}

function calcRefill(it, stokFisikBaru){
  const idle = it.stokIdle || 0;
  if(idle <= stokFisikBaru) return 0;
  const pack = it.packSize || 1;
  return Math.ceil((idle - stokFisikBaru) / pack) * pack;
}

// ===== DEBT / CASHFLOW METRICS =====
function sumWajibBayar(){
  return txLog.filter(t => t.type==='opname').reduce((s,t) => s + (t.wajibBayar||0), 0);
}
function sumPembayaran(){
  return txLog.filter(t => t.type==='payment').reduce((s,t) => s + (t.amount||0), 0);
}
function utangBelumDibayar(){ return sumWajibBayar() - sumPembayaran(); }
function nilaiStokTitipan(){
  return items.reduce((s,it) => s + (it.stokSaatIni||0) * (it.modalSatuan||0), 0);
}
function latestOpnameDate(){
  let d = null;
  txLog.forEach(t => { if(t.type==='opname' && (!d || t.date > d)) d = t.date; });
  return d;
}
function tagihanOpnameTerakhir(){
  const d = latestOpnameDate();
  if(!d) return 0;
  return txLog.filter(t => t.type==='opname' && t.date===d).reduce((s,t)=>s+(t.wajibBayar||0),0);
}
function belumDiopnameList(){
  const t = todayISO();
  return items.filter(it => !it.lastOpnameDate || daysBetween(it.lastOpnameDate, t) >= 7);
}

// ===== OFFLINE-FIRST STORAGE =====
function cacheLocal(){
  try{
    localStorage.setItem(LS_CACHE_ITEMS, JSON.stringify(items));
    localStorage.setItem(LS_CACHE_TX, JSON.stringify(txLog));
  }catch(e){}
}
function markPending(){ localStorage.setItem(LS_PENDING, '1'); }
function clearPending(){ localStorage.removeItem(LS_PENDING); }
function hasPending(){ return localStorage.getItem(LS_PENDING) === '1'; }

async function ensureBins(){
  setSyncDot('busy');
  try{
    if(!BIN_ITEMS){
      const res = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Master-Key':ACCESS_KEY,'X-Bin-Name':'stokis_items'},
        body: JSON.stringify({items: INITIAL_ITEMS})
      });
      if(!res.ok) throw new Error('Gagal bikin bin items');
      BIN_ITEMS = (await res.json()).metadata.id;
      localStorage.setItem(LS_BIN_ITEMS, BIN_ITEMS);
    }
    if(!BIN_TX){
      const res = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Master-Key':ACCESS_KEY,'X-Bin-Name':'stokis_tx'},
        body: JSON.stringify({tx: []})
      });
      if(!res.ok) throw new Error('Gagal bikin bin tx');
      BIN_TX = (await res.json()).metadata.id;
      localStorage.setItem(LS_BIN_TX, BIN_TX);
    }
    setSyncDot('ok');
    return true;
  }catch(e){
    console.error(e);
    setSyncDot('err');
    return false;
  }
}

async function loadAll(){
  setSyncDot('busy');
  try{
    const [r1, r2] = await Promise.all([
      fetch(`${API}/${BIN_ITEMS}/latest`, {headers:{'X-Master-Key':ACCESS_KEY}}),
      fetch(`${API}/${BIN_TX}/latest`, {headers:{'X-Master-Key':ACCESS_KEY}})
    ]);
    if(!r1.ok || !r2.ok) throw new Error('Gagal load');
    const d1 = await r1.json(), d2 = await r2.json();
    items = d1.record.items || [];
    txLog = d2.record.tx || [];
    migrateModel();
    recompute();
    cacheLocal();
    setSyncDot('ok');
    showOffline(false);
    return true;
  }catch(e){
    console.error(e);
    const ci = localStorage.getItem(LS_CACHE_ITEMS), ct = localStorage.getItem(LS_CACHE_TX);
    if(ci && ct){
      items = JSON.parse(ci); txLog = JSON.parse(ct);
      migrateModel(); recompute();
      setSyncDot('err'); showOffline(true);
      showToast('Pakai data tersimpan di HP (offline)', 'error');
      return true;
    }
    setSyncDot('err');
    return false;
  }
}

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveAll, 400);
}

async function saveAll(){
  cacheLocal(); // selalu simpan lokal dulu — gak akan ilang
  if(!navigator.onLine){ markPending(); setSyncDot('err'); showOffline(true); return; }
  setSyncDot('busy');
  try{
    const [r1, r2] = await Promise.all([
      fetch(`${API}/${BIN_ITEMS}`, {method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':ACCESS_KEY},body: JSON.stringify({items})}),
      fetch(`${API}/${BIN_TX}`, {method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':ACCESS_KEY},body: JSON.stringify({tx: txLog})})
    ]);
    if(!r1.ok || !r2.ok) throw new Error('Gagal simpan');
    clearPending();
    setSyncDot('ok'); showOffline(false);
  }catch(e){
    console.error(e);
    markPending();
    setSyncDot('err'); showOffline(true);
    showToast('Belum tersimpan ke server, nanti otomatis sync', 'error');
  }
}

async function trySync(){
  if(hasPending() && ACCESS_KEY && BIN_ITEMS && BIN_TX){
    await saveAll();
    if(!hasPending()) showToast('Data tersinkron', 'success');
  }
}
window.addEventListener('online', () => { showOffline(false); trySync(); });
window.addEventListener('offline', () => showOffline(true));

// ===== CONFIG / ACCESS KEY =====
function initConfig(){
  document.getElementById('cfgToggleAdv').addEventListener('click', () => {
    document.getElementById('cfgAdvanced').classList.toggle('hidden');
  });
  document.getElementById('cfgSubmit').addEventListener('click', submitConfig);
}
async function submitConfig(){
  const key = document.getElementById('cfgKey').value.trim();
  const err = document.getElementById('cfgErr');
  if(!key){ err.textContent = 'Key wajib diisi'; return; }
  const binI = document.getElementById('cfgBinItems').value.trim();
  const binT = document.getElementById('cfgBinTx').value.trim();
  ACCESS_KEY = key;
  localStorage.setItem(LS_KEY, key);
  if(binI){ BIN_ITEMS = binI; localStorage.setItem(LS_BIN_ITEMS, binI); }
  if(binT){ BIN_TX = binT; localStorage.setItem(LS_BIN_TX, binT); }
  document.getElementById('configOverlay').classList.add('hidden');
  boot();
}

// ===== PIN AUTH =====
let pinInput = '';
function initPin(){
  const pad = document.getElementById('pinPad');
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  pad.innerHTML = keys.map(k => k==='' ? '<div></div>' : `<button data-k="${k}">${k}</button>`).join('');
  pad.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onPinKey(b.dataset.k)));
  renderPinDots();
}
function renderPinDots(){
  document.getElementById('pinDots').innerHTML = [0,1,2,3].map(i => `<div class="d ${i<pinInput.length?'fill':''}"></div>`).join('');
}
function onPinKey(k){
  const err = document.getElementById('pinErr');
  if(k === '⌫'){ pinInput = pinInput.slice(0,-1); err.textContent=''; renderPinDots(); return; }
  if(pinInput.length >= 4) return;
  pinInput += k; renderPinDots();
  if(pinInput.length === 4){
    if(pinInput === PIN){ sessionStorage.setItem(LS_AUTH, '1'); unlockApp(); }
    else { err.textContent = 'PIN salah, coba lagi'; setTimeout(() => { pinInput=''; renderPinDots(); }, 400); }
  }
}
function unlockApp(){
  document.getElementById('pinOverlay').classList.add('hidden');
  document.getElementById('mainWrap').classList.remove('hidden');
  boot();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  initPin();
  initConfig();
  if(sessionStorage.getItem(LS_AUTH) === '1') unlockApp();
  else document.getElementById('pinOverlay').classList.remove('hidden');
  document.querySelectorAll('.nbtn').forEach(btn => btn.addEventListener('click', () => goTab(btn.dataset.tab)));
});

async function boot(){
  // Key & Bin ID udah di-bake di data.js, langsung boot tanpa config screen
  if(!ACCESS_KEY || !BIN_ITEMS || !BIN_TX){
    document.getElementById('content').innerHTML = `<div class="empty-state"><div class="ic">⚠️</div><div class="t">Konfigurasi error</div><div class="s">BAKED_KEY tidak ditemukan di data.js</div></div>`;
    return;
  }
  const ok = await ensureBins();
  if(!ok){
    // coba pakai cache offline
    const ci = localStorage.getItem(LS_CACHE_ITEMS), ct = localStorage.getItem(LS_CACHE_TX);
    if(ci && ct){
      items = JSON.parse(ci); txLog = JSON.parse(ct); migrateModel(); recompute();
      showOffline(true); goTab('dashboard');
      return;
    }
    document.getElementById('content').innerHTML = `<div class="empty-state"><div class="ic">⚠️</div><div class="t">Gagal konek ke server</div><div class="s">Cek koneksi atau Access Key, lalu refresh.</div></div>`;
    return;
  }
  await loadAll();
  goTab('dashboard');
}

function goTab(tab){
  currentTab = tab;
  document.querySelectorAll('.nbtn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const subMap = {dashboard:'Toko IS Tracker', restock:'Catat nota masuk', opname:'Stock opname mingguan', riwayat:'Riwayat & pembayaran', setup:'Master data & pengaturan'};
  document.getElementById('topbarSub').textContent = subMap[tab] || '';
  render();
}

function render(){
  const ab = document.getElementById('actionBar');
  ab.classList.add('hidden'); ab.innerHTML = '';
  const c = document.getElementById('content');
  if(currentTab==='dashboard') renderDashboard(c);
  else if(currentTab==='restock') renderRestock(c);
  else if(currentTab==='opname') renderOpname(c);
  else if(currentTab==='riwayat') renderRiwayat(c);
  else if(currentTab==='setup') renderSetup(c);
}

// ===== DASHBOARD =====
function groupedStokStatus(){
  const danger = [], warning = [], success = [];
  items.forEach(it => {
    const st = stokStatus(it);
    if(st.level==='danger') danger.push(it);
    else if(st.level==='warning') warning.push(it);
    else success.push(it);
  });
  const ratio = x => x.stokSaatIni/(x.stokIdle||1);
  danger.sort((a,b)=>ratio(a)-ratio(b));
  warning.sort((a,b)=>ratio(a)-ratio(b));
  return {danger, warning, success};
}

function renderDashboard(c){
  const {danger, warning, success} = groupedStokStatus();
  const utang = utangBelumDibayar();
  const titipan = nilaiStokTitipan();
  const tagihanAkhir = tagihanOpnameTerakhir();
  const lastOpD = latestOpnameDate();
  const incomplete = items.filter(isIncomplete);
  const belumSO = belumDiopnameList();

  function itemRowHtml(it){
    const st = stokStatus(it);
    return `<div class="item-row">
      <div class="item-bar-wrap">
        <div class="nm">
          <span>${escapeHtml(it.nama)} <span class="cat-tag cat-${it.kategori}">${it.kategori}</span></span>
          <span class="cnt">${fmtNum(it.stokSaatIni)}/${fmtNum(it.stokIdle)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${st.level}" style="width:${Math.max(4,st.pct)}%"></div></div>
      </div>
    </div>`;
  }

  c.innerHTML = `
    <div class="metric-grid">
      <div class="metric accent">
        <div class="lbl">Utang belum dibayar</div>
        <div class="val">${fmtRp(utang)}</div>
        <div class="sub">Σ wajib bayar − pembayaran</div>
      </div>
      <div class="metric">
        <div class="lbl">Nilai Stok</div>
        <div class="val">${fmtRp(titipan)}</div>
        <div class="sub">stok sekarang × modal</div>
      </div>
    </div>

    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:12px;color:var(--text2);">Tagihan opname terakhir${lastOpD?' ('+fmtDate(lastOpD)+')':''}</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:700;">${fmtRp(tagihanAkhir)}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openPaymentDialog()">+ Catat Bayar</button>
    </div>

    ${incomplete.length ? `
    <div class="alert-card danger-tone">
      <div class="t">⚠️ ${incomplete.length} item belum ada modal satuan</div>
      <div class="s">Selama modal masih 0, barang yang laku dihitung Rp0 alias dikira gratis. Isi di tab Setup biar tagihan akurat.</div>
    </div>` : ''}

    ${belumSO.length ? `
    <div class="alert-card warn">
      <div class="t">${belumSO.length} item belum di-opname 7+ hari</div>
      <div class="s">Item yang lama gak diopname → lakunya gak kehitung & gak ketagih. Cek di tab Opname.</div>
    </div>` : ''}

    <div class="stat-row">
      <div class="stat-box danger"><div class="n">${danger.length}</div><div class="l">Kritis</div></div>
      <div class="stat-box warning"><div class="n">${warning.length}</div><div class="l">Menipis</div></div>
      <div class="stat-box success"><div class="n">${success.length}</div><div class="l">Aman</div></div>
    </div>

    ${danger.length ? `<div class="card"><div class="card-title">⚠️ Stok Kritis — Perlu Direstock</div>${danger.map(itemRowHtml).join('')}</div>` : ''}
    ${warning.length ? `<div class="card"><div class="card-title">Mulai Menipis</div>${warning.map(itemRowHtml).join('')}</div>` : ''}
    ${(!danger.length && !warning.length) ? `<div class="card"><div class="empty-state"><div class="ic">✅</div><div class="t">Semua stok aman</div><div class="s">Gak ada item kritis atau menipis</div></div></div>` : ''}
    <div style="height:20px"></div>
  `;
}

// ===== PEMBAYARAN =====
function openPaymentDialog(){
  const utang = utangBelumDibayar();
  const host = document.getElementById('modalHost');
  host.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="dialog">
        <h3>Catat Pembayaran</h3>
        <div class="dsub">Sisa utang belum dibayar: <b>${fmtRp(utang)}</b></div>
        <div class="field"><label>Tanggal</label><input type="date" id="payDate" value="${todayISO()}"/></div>
        <div class="field"><label>Jumlah dibayar</label><input type="number" inputmode="numeric" id="payAmount" placeholder="0"/></div>
        <div class="field"><label>Catatan (opsional)</label><input type="text" id="payNote" placeholder="misal: transfer BCA"/></div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="submitPayment()">Simpan</button>
        </div>
      </div>
    </div>`;
}
function closeModal(){ document.getElementById('modalHost').innerHTML = ''; }

async function submitPayment(){
  const date = document.getElementById('payDate').value || todayISO();
  const amount = parseFloat(document.getElementById('payAmount').value);
  const note = document.getElementById('payNote').value.trim();
  if(!(amount > 0)){ showToast('Jumlah gak valid', 'error'); return; }
  txLog.push({id: uid('tx'), type:'payment', gen:2, ts:nextTs(), date, amount, note});
  closeModal();
  await saveAll();
  showToast(`Pembayaran ${fmtRp(amount)} dicatat`, 'success');
  goTab('dashboard');
}

// ===== RESTOCK TAB =====
let restockDate = todayISO();
let restockDraft = {}; // itemId -> {qty, totalBayar}
let restockFilter = 'ALL';
let restockSearch = '';

function setRestockDate(v){ restockDate = v; }
function setRestockFilter(v){ restockFilter = v; renderRestockList(); }
function setRestockSearch(v){ restockSearch = v; renderRestockList(); }

function setRestockField(itemId, field, val){
  if(!restockDraft[itemId]) restockDraft[itemId] = {qty:'', totalBayar:''};
  restockDraft[itemId][field] = val;
  renderRestockPreview(itemId);
  renderActionBarRestock();
}

function renderRestockPreview(itemId){
  const el = document.getElementById('restockPrev_'+itemId);
  if(!el) return;
  const draft = restockDraft[itemId]; const it = findItem(itemId);
  if(!draft || !it){ el.innerHTML=''; return; }
  const qty = parseFloat(draft.qty), total = parseFloat(draft.totalBayar);
  if(!(qty>0 && total>=0 && !isNaN(qty) && !isNaN(total))){ el.innerHTML=''; return; }
  const modalBaru = total/qty;
  el.innerHTML = `Modal satuan: ${fmtRp(modalBaru)} / pcs ${it.modalSatuan ? '(skrg '+fmtRp(it.modalSatuan)+')' : ''}`;
}

function renderRestockList(){
  const wrap = document.getElementById('restockList');
  if(!wrap) return;
  let list = items.filter(i => restockFilter==='ALL' || i.kategori===restockFilter);
  const q = restockSearch.toLowerCase().trim();
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b) => a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => {
    const draft = restockDraft[it.id] || {qty:'', totalBayar:''};
    return `
    <div class="batch-row">
      <div class="batch-row-head">
        <div class="nm">${escapeHtml(it.nama)} <span class="cat-tag cat-${it.kategori}">${it.kategori}</span></div>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;"><label>Jumlah</label>
          <input type="number" inputmode="numeric" placeholder="0" value="${draft.qty}" oninput="setRestockField('${it.id}','qty',this.value)"/></div>
        <div class="field" style="margin-bottom:0;"><label>Total Bayar</label>
          <input type="number" inputmode="numeric" placeholder="0" value="${draft.totalBayar}" oninput="setRestockField('${it.id}','totalBayar',this.value)"/></div>
      </div>
      <div class="calc-preview" id="restockPrev_${it.id}"></div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
  Object.keys(restockDraft).forEach(id => renderRestockPreview(id));
}

function renderActionBarRestock(){
  const ab = document.getElementById('actionBar');
  let count=0, total=0;
  Object.keys(restockDraft).forEach(id => {
    const d = restockDraft[id]; const qty=parseFloat(d.qty), tot=parseFloat(d.totalBayar);
    if(qty>0 && tot>=0 && !isNaN(qty) && !isNaN(tot)){ count++; total+=tot; }
  });
  if(!count){ ab.classList.add('hidden'); ab.innerHTML=''; return; }
  ab.classList.remove('hidden');
  ab.innerHTML = `<div class="ab-inner">
    <div class="ab-summary"><span>${count} item siap disimpan</span><b>${fmtRp(total)}</b></div>
    <button class="btn btn-primary" onclick="submitRestock()">Simpan Restock</button></div>`;
}

function renderRestock(c){
  const draftCount = Object.keys(restockDraft).filter(id => {
    const d = restockDraft[id]; return parseFloat(d.qty)>0;
  }).length;
  c.innerHTML = `
    <div class="card"><div class="field" style="margin-bottom:0;"><label>Tanggal Nota</label>
      <input type="date" value="${restockDate}" onchange="setRestockDate(this.value)"/></div></div>
    ${draftCount ? `<div class="progress-pill">📝 <b>${draftCount}</b> item sudah diisi (termasuk saran dari opname)</div>` : ''}
    <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." value="${escapeHtml(restockSearch)}" oninput="setRestockSearch(this.value)"/></div>
    <div class="filter-chips">
      ${['ALL',...KATEGORI_LIST].map(k => `<div class="chip ${restockFilter===k?'active':''}" onclick="setRestockFilter('${k}')">${k==='ALL'?'Semua':k}</div>`).join('')}
    </div>
    <div id="restockList"></div>
    <div style="height:90px"></div>`;
  renderRestockList();
  renderActionBarRestock();
}

async function submitRestock(){
  const entries = [];
  Object.keys(restockDraft).forEach(id => {
    const d = restockDraft[id]; const qty=parseFloat(d.qty), totalBayar=parseFloat(d.totalBayar);
    if(qty>0 && totalBayar>=0 && !isNaN(qty) && !isNaN(totalBayar)){
      const it = findItem(id); if(it) entries.push({it, qty, totalBayar});
    }
  });
  if(!entries.length) return;
  const grandTotal = entries.reduce((s,e)=>s+e.totalBayar,0);
  if(!confirm(`Simpan restock ${entries.length} item?\n\nTotal nota: ${fmtRp(grandTotal)}`)) return;
  entries.forEach(({it, qty, totalBayar}) => {
    txLog.push({id:uid('tx'), type:'restock', gen:2, ts:nextTs(), date:restockDate,
      itemId:it.id, itemNama:it.nama, qty, totalBayar, modalSatuanBaru: totalBayar/qty});
  });
  restockDraft = {};
  recompute();
  await saveAll();
  showToast(`Restock tersimpan · ${fmtRp(grandTotal)}`, 'success');
  goTab('dashboard');
}

// ===== OPNAME TAB =====
let opnameDate = todayISO();
let opnameDraft = {};
let opnameFilter = 'ALL';
let opnameSearch = '';

function setOpnameDate(v){ opnameDate = v; }
function setOpnameFilter(v){ opnameFilter = v; renderOpnameList(); }
function setOpnameSearch(v){ opnameSearch = v; renderOpnameList(); }
function setOpnameDraft(itemId, val){
  opnameDraft[itemId] = val;
  renderOpnamePreview(itemId);
  renderActionBarOpname();
  updateOpnameProgress();
}

function renderOpnamePreview(itemId){
  const el = document.getElementById('prev_'+itemId);
  if(!el) return;
  const it = findItem(itemId); const raw = opnameDraft[itemId]; const val = parseFloat(raw);
  if(raw===undefined || raw==='' || isNaN(val)){ el.innerHTML=''; return; }
  const laku = Math.max(0, it.stokSaatIni - val);
  const refill = calcRefill(it, val);
  if(isIncomplete(it)){
    el.innerHTML = `<div class="calc-preview" style="color:var(--danger)">Laku: ${fmtNum(laku)} · ⚠ modal belum diisi, wajib bayar = Rp0${refill>0?' · Refill: '+fmtNum(refill):''}</div>`;
  } else {
    const bayar = laku * it.modalSatuan;
    el.innerHTML = `<div class="calc-preview">Laku: ${fmtNum(laku)} · Wajib bayar: ${fmtRp(bayar)}${refill>0?' · Refill: '+fmtNum(refill):''}</div>`;
  }
}

function updateOpnameProgress(){
  const el = document.getElementById('opnameProgress');
  if(!el) return;
  const filled = Object.keys(opnameDraft).filter(id => opnameDraft[id]!=='' && opnameDraft[id]!==undefined).length;
  el.innerHTML = `📋 <b>${filled}</b> / ${items.length} item diisi`;
}

function renderOpnameList(){
  const wrap = document.getElementById('opnameList');
  if(!wrap) return;
  let list = items.filter(i => opnameFilter==='ALL' || i.kategori===opnameFilter);
  const q = opnameSearch.toLowerCase().trim();
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b) => a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => {
    const draftVal = opnameDraft[it.id];
    const hasVal = draftVal!==undefined && draftVal!=='';
    const t = todayISO();
    const stale = !it.lastOpnameDate || daysBetween(it.lastOpnameDate, t) >= 7;
    return `
    <div class="batch-row ${hasVal?'':''}">
      <div class="batch-row-head">
        <div class="nm">${escapeHtml(it.nama)} <span class="cat-tag cat-${it.kategori}">${it.kategori}</span>
          ${isIncomplete(it)?'<span class="badge-warn">modal 0</span>':''}
          ${stale && !hasVal?'<span class="badge-warn">belum SO</span>':''}
          ${hasVal?'<span class="badge-ok">✓</span>':''}
        </div>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;"><label>Stok tercatat</label>
          <input value="${fmtNum(it.stokSaatIni)}" disabled style="opacity:.55"/></div>
        <div class="field" style="margin-bottom:0;"><label>Stok fisik (SO)</label>
          <input type="number" inputmode="numeric" placeholder="Hitung..." value="${hasVal?draftVal:''}" oninput="setOpnameDraft('${it.id}',this.value)"/></div>
      </div>
      <div id="prev_${it.id}"></div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
  Object.keys(opnameDraft).forEach(id => renderOpnamePreview(id));
}

function renderActionBarOpname(){
  const ab = document.getElementById('actionBar');
  let count=0, totalBayar=0;
  Object.keys(opnameDraft).forEach(id => {
    const raw = opnameDraft[id]; const val = parseFloat(raw);
    if(raw===undefined || raw==='' || isNaN(val)) return;
    const it = findItem(id); if(!it) return;
    count++; totalBayar += Math.max(0, it.stokSaatIni - val) * (it.modalSatuan||0);
  });
  if(!count){ ab.classList.add('hidden'); ab.innerHTML=''; return; }
  ab.classList.remove('hidden');
  ab.innerHTML = `<div class="ab-inner">
    <div class="ab-summary"><span>${count} item di-opname</span><b>${fmtRp(totalBayar)}</b></div>
    <button class="btn btn-primary" onclick="submitOpname()">Simpan Opname</button></div>`;
}

function renderOpname(c){
  c.innerHTML = `
    <div class="card"><div class="field" style="margin-bottom:0;"><label>Tanggal Opname</label>
      <input type="date" value="${opnameDate}" onchange="setOpnameDate(this.value)"/></div></div>
    <div class="progress-pill" id="opnameProgress"></div>
    <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." value="${escapeHtml(opnameSearch)}" oninput="setOpnameSearch(this.value)"/></div>
    <div class="filter-chips">
      ${['ALL',...KATEGORI_LIST].map(k => `<div class="chip ${opnameFilter===k?'active':''}" onclick="setOpnameFilter('${k}')">${k==='ALL'?'Semua':k}</div>`).join('')}
    </div>
    <div id="opnameList"></div>
    <div style="height:90px"></div>`;
  renderOpnameList();
  renderActionBarOpname();
  updateOpnameProgress();
}

async function submitOpname(){
  const entries = [];
  Object.keys(opnameDraft).forEach(id => {
    const raw = opnameDraft[id]; const val = parseFloat(raw);
    if(raw===undefined || raw==='' || isNaN(val)) return;
    const it = findItem(id); if(!it) return;
    entries.push({it, val});
  });
  if(!entries.length) return;

  let totalBayar=0, refillCount=0, modalKosong=0;
  const computed = entries.map(({it, val}) => {
    const laku = Math.max(0, it.stokSaatIni - val);
    const wajibBayar = laku * (it.modalSatuan||0);
    const refill = calcRefill(it, val);
    if(refill>0) refillCount++;
    if(isIncomplete(it) && laku>0) modalKosong++;
    totalBayar += wajibBayar;
    return {it, val, refill};
  });

  let msg = `Simpan opname ${entries.length} item?\n\nTotal wajib bayar: ${fmtRp(totalBayar)}\n${refillCount} item perlu direstock.`;
  if(modalKosong>0) msg += `\n\n⚠ ${modalKosong} item laku tapi modal masih 0 (dihitung Rp0). Lanjut?`;
  if(!confirm(msg)) return;

  computed.forEach(({it, val}) => {
    txLog.push({id:uid('tx'), type:'opname', gen:2, ts:nextTs(), date:opnameDate,
      itemId:it.id, itemNama:it.nama, stokSisa: val});
  });
  recompute();

  // auto-bikin draft belanja dari kebutuhan refill
  let draftMade = 0;
  restockDraft = {};
  computed.forEach(({it, val, refill}) => {
    if(refill>0){ restockDraft[it.id] = {qty:String(refill), totalBayar:''}; draftMade++; }
  });
  restockDate = todayISO();

  opnameDraft = {};
  await saveAll();
  showToast(`Opname tersimpan · ${draftMade?'Draft belanja '+draftMade+' item dibuat':'Bayar '+fmtRp(totalBayar)}`, 'success');
  goTab(draftMade ? 'restock' : 'dashboard');
}

// ===== RIWAYAT TAB =====
let riwayatSubTab = 'transaksi'; // transaksi | pembayaran | harga
let riwayatTypeFilter = 'ALL';
let riwayatHargaItemId = null;
let riwayatHargaSearch = '';

function setRiwayatSubTab(v){ riwayatSubTab = v; renderRiwayat(document.getElementById('content')); }
function setRiwayatTypeFilter(v){ riwayatTypeFilter = v; renderRiwayatList(); }
function setRiwayatHargaItem(id){ riwayatHargaItemId = id; renderRiwayatHargaBody(); }
function setRiwayatHargaSearch(v){ riwayatHargaSearch = v; renderRiwayatHargaItemPicker(); }

function renderRiwayatList(){
  const wrap = document.getElementById('riwayatTxList');
  if(!wrap) return;
  let list = txLog.filter(tx => tx.type!=='payment').filter(tx => riwayatTypeFilter==='ALL' || tx.type===riwayatTypeFilter);
  list = list.slice().sort((a,b) => (b.ts||0)-(a.ts||0));
  wrap.innerHTML = list.length ? list.map(tx => {
    const editable = tx.gen===2;
    const actions = editable ? `<div class="inline-actions">
        <span class="mini-btn accent" onclick="openEditTx('${tx.id}')">Edit</span>
        <span class="mini-btn danger" onclick="deleteTx('${tx.id}')">Hapus</span>
      </div>` : `<div class="inline-actions"><span class="mini-btn" style="opacity:.5">historis</span></div>`;
    if(tx.type==='restock'){
      return `<div class="tx-item"><div class="tx-ic restock">📦</div><div class="tx-body">
        <div class="t1"><span>${escapeHtml(tx.itemNama)}</span><span class="amt">${fmtRp(tx.totalBayar)}</span></div>
        <div class="t2">Restock · ${fmtNum(tx.qty)} pcs · ${fmtDate(tx.date)} · ${fmtRp(tx.modalSatuanBaru)}/pcs</div>
        ${actions}</div></div>`;
    } else {
      return `<div class="tx-item"><div class="tx-ic opname">📋</div><div class="tx-body">
        <div class="t1"><span>${escapeHtml(tx.itemNama)}</span><span class="amt">${fmtRp(tx.wajibBayar)}</span></div>
        <div class="t2">Opname · laku ${fmtNum(tx.laku)} · sisa ${fmtNum(tx.stokSisa)} · ${fmtDate(tx.date)}${tx.kebutuhanRefill>0?' · refill '+fmtNum(tx.kebutuhanRefill):''}</div>
        ${actions}</div></div>`;
    }
  }).join('') : `<div class="empty-state"><div class="ic">🗂️</div><div class="t">Belum ada riwayat</div></div>`;
}

function renderPembayaranList(){
  const wrap = document.getElementById('pembayaranList');
  if(!wrap) return;
  const list = txLog.filter(t => t.type==='payment').slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  const totalBayar = sumPembayaran();
  const totalWajib = sumWajibBayar();
  wrap.innerHTML = `
    <div class="metric-grid">
      <div class="metric"><div class="lbl">Total wajib bayar</div><div class="val">${fmtRp(totalWajib)}</div></div>
      <div class="metric accent"><div class="lbl">Total dibayar</div><div class="val">${fmtRp(totalBayar)}</div></div>
    </div>
    <button class="btn btn-primary" onclick="openPaymentDialog()" style="margin-bottom:14px;">+ Catat Pembayaran</button>
    <div class="card">
    ${list.length ? list.map(tx => `<div class="tx-item"><div class="tx-ic opname">💵</div><div class="tx-body">
      <div class="t1"><span>${tx.note?escapeHtml(tx.note):'Pembayaran'}</span><span class="amt">${fmtRp(tx.amount)}</span></div>
      <div class="t2">${fmtDate(tx.date)}</div>
      <div class="inline-actions"><span class="mini-btn danger" onclick="deleteTx('${tx.id}')">Hapus</span></div>
      </div></div>`).join('') : `<div class="empty-state"><div class="s">Belum ada pembayaran</div></div>`}
    </div>`;
}

function renderRiwayatHargaItemPicker(){
  const wrap = document.getElementById('riwayatHargaPicker');
  if(!wrap) return;
  const q = riwayatHargaSearch.toLowerCase().trim();
  let list = items.filter(i => i.modalSatuan > 0);
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b)=>a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => `
    <div class="picker-item" onclick="setRiwayatHargaItem('${it.id}')">
      <span class="nm">${escapeHtml(it.nama)}</span><span class="meta">${fmtRp(it.modalSatuan)}</span></div>`).join('')
    : `<div class="empty-state"><div class="s">Belum ada item dengan histori harga</div></div>`;
}

function renderRiwayatHargaBody(){
  const wrap = document.getElementById('riwayatHargaBody');
  if(!wrap) return;
  if(!riwayatHargaItemId){ wrap.innerHTML=''; return; }
  const it = findItem(riwayatHargaItemId);
  const hist = txLog.filter(tx => tx.type==='restock' && tx.itemId===riwayatHargaItemId).slice().sort((a,b)=>(a.ts||0)-(b.ts||0));
  if(!hist.length){ wrap.innerHTML = `<div class="empty-state"><div class="s">Belum ada histori restock</div></div>`; return; }
  let rows='';
  hist.forEach((tx, idx) => {
    const prev = idx>0 ? hist[idx-1].modalSatuanBaru : null;
    let trend='';
    if(prev!==null){
      if(tx.modalSatuanBaru>prev) trend = `<span class="v-danger">▲ ${fmtRp(tx.modalSatuanBaru-prev)}</span>`;
      else if(tx.modalSatuanBaru<prev) trend = `<span class="v-success">▼ ${fmtRp(prev-tx.modalSatuanBaru)}</span>`;
      else trend = `<span style="color:var(--text3)">— tetap</span>`;
    }
    rows += `<div class="result-row"><span>${fmtDate(tx.date)}</span><span class="v">${fmtRp(tx.modalSatuanBaru)} ${trend}</span></div>`;
  });
  wrap.innerHTML = `<div class="card"><div class="card-title">${escapeHtml(it.nama)} — Tren Modal Satuan</div>${rows}</div>`;
}

function renderRiwayat(c){
  c.innerHTML = `
    <div class="filter-chips">
      <div class="chip ${riwayatSubTab==='transaksi'?'active':''}" onclick="setRiwayatSubTab('transaksi')">Transaksi</div>
      <div class="chip ${riwayatSubTab==='pembayaran'?'active':''}" onclick="setRiwayatSubTab('pembayaran')">Pembayaran</div>
      <div class="chip ${riwayatSubTab==='harga'?'active':''}" onclick="setRiwayatSubTab('harga')">Tren Harga</div>
    </div>
    ${riwayatSubTab==='transaksi' ? `
      <div class="filter-chips">
        <div class="chip ${riwayatTypeFilter==='ALL'?'active':''}" onclick="setRiwayatTypeFilter('ALL')">Semua</div>
        <div class="chip ${riwayatTypeFilter==='restock'?'active':''}" onclick="setRiwayatTypeFilter('restock')">Restock</div>
        <div class="chip ${riwayatTypeFilter==='opname'?'active':''}" onclick="setRiwayatTypeFilter('opname')">Opname</div>
      </div>
      <div class="card"><div id="riwayatTxList"></div></div>
    ` : riwayatSubTab==='pembayaran' ? `
      <div id="pembayaranList"></div>
    ` : `
      <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." oninput="setRiwayatHargaSearch(this.value)"/></div>
      <div class="picker-list" id="riwayatHargaPicker" style="margin-bottom:14px;"></div>
      <div id="riwayatHargaBody"></div>
    `}`;
  if(riwayatSubTab==='transaksi') renderRiwayatList();
  else if(riwayatSubTab==='pembayaran') renderPembayaranList();
  else { renderRiwayatHargaItemPicker(); renderRiwayatHargaBody(); }
}

// ===== EDIT / DELETE TRANSAKSI =====
function openEditTx(txId){
  const tx = findTx(txId);
  if(!tx || tx.gen!==2) return;
  const host = document.getElementById('modalHost');
  let body = '';
  if(tx.type==='restock'){
    body = `
      <div class="field"><label>Tanggal</label><input type="date" id="etDate" value="${tx.date}"/></div>
      <div class="field"><label>Jumlah</label><input type="number" id="etQty" value="${tx.qty}"/></div>
      <div class="field"><label>Total Bayar</label><input type="number" id="etTotal" value="${tx.totalBayar}"/></div>`;
  } else if(tx.type==='opname'){
    body = `
      <div class="field"><label>Tanggal</label><input type="date" id="etDate" value="${tx.date}"/></div>
      <div class="field"><label>Stok fisik (sisa)</label><input type="number" id="etSisa" value="${tx.stokSisa}"/></div>`;
  }
  host.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="dialog">
        <h3>Edit ${tx.type==='restock'?'Restock':'Opname'}</h3>
        <div class="dsub">${escapeHtml(tx.itemNama||'')}</div>
        ${body}
        <div class="dialog-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="saveEditTx('${tx.id}')">Simpan</button>
        </div>
      </div>
    </div>`;
}

async function saveEditTx(txId){
  const tx = findTx(txId);
  if(!tx) return;
  if(tx.type==='restock'){
    const qty = parseFloat(document.getElementById('etQty').value);
    const total = parseFloat(document.getElementById('etTotal').value);
    const date = document.getElementById('etDate').value || tx.date;
    if(!(qty>0 && total>=0)){ showToast('Angka gak valid', 'error'); return; }
    tx.qty = qty; tx.totalBayar = total; tx.date = date; tx.modalSatuanBaru = total/qty;
  } else if(tx.type==='opname'){
    const sisa = parseFloat(document.getElementById('etSisa').value);
    const date = document.getElementById('etDate').value || tx.date;
    if(isNaN(sisa) || sisa<0){ showToast('Angka gak valid', 'error'); return; }
    tx.stokSisa = sisa; tx.date = date;
  }
  recompute();
  closeModal();
  await saveAll();
  showToast('Transaksi diperbarui', 'success');
  render();
}

async function deleteTx(txId){
  const tx = findTx(txId);
  if(!tx) return;
  const label = tx.type==='payment' ? 'pembayaran' : tx.type;
  if(!confirm(`Hapus ${label} ini? Stok & utang otomatis dihitung ulang.`)) return;
  txLog = txLog.filter(t => t.id !== txId);
  recompute();
  await saveAll();
  showToast('Transaksi dihapus', 'success');
  render();
}

// ===== SETUP TAB =====
let setupSearch = '';
let setupFilter = 'ALL';

function setSetupSearch(v){ setupSearch = v; renderSetupList(); }
function setSetupFilter(v){ setupFilter = v; renderSetupList(); }

function updateItemField(itemId, field, val){
  const it = findItem(itemId);
  if(!it) return;
  if(field==='nama' || field==='kategori'){ it[field] = val; }
  else if(field==='modalSatuan'){
    const num = parseFloat(val); it.modalAwal = isNaN(num)?0:num; recompute();
  } else if(field==='stokSaatIni'){
    const num = parseFloat(val); const target = isNaN(num)?0:num;
    it.stokAwal = (it.stokAwal||0) + (target - it.stokSaatIni); recompute();
  } else {
    const num = parseFloat(val); it[field] = isNaN(num)?0:num;
  }
  scheduleSave();
  showToast('Tersimpan', 'success');
  if(field==='modalSatuan' || field==='stokSaatIni') renderSetupList();
}

function deleteItem(itemId){
  const it = findItem(itemId);
  if(!it) return;
  if(!confirm(`Hapus "${it.nama}" dari master data? Riwayat transaksinya tetap ada.`)) return;
  items = items.filter(i => i.id !== itemId);
  scheduleSave();
  renderSetupList();
  showToast('Item dihapus', 'success');
}

function addNewItem(){
  const nama = prompt('Nama barang baru:');
  if(!nama || !nama.trim()) return;
  items.push({id:uid('i'), nama:nama.trim().toUpperCase(), kategori:'MINUMAN',
    stokIdle:0, packSize:1, modalSatuan:0, modalAwal:0, stokSaatIni:0, stokAwal:0});
  scheduleSave();
  renderSetupList();
  showToast('Item ditambahkan', 'success');
}

function renderSetupList(){
  const wrap = document.getElementById('setupList');
  if(!wrap) return;
  let list = items.filter(i => setupFilter==='ALL' || i.kategori===setupFilter);
  const q = setupSearch.toLowerCase().trim();
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b)=>a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => `
    <div class="setup-item">
      <div class="setup-item-head">
        <div class="nm">${escapeHtml(it.nama)} ${isIncomplete(it)?'<span class="badge-warn">belum lengkap</span>':''}</div>
        <div class="rm" style="color:var(--danger);font-size:13px;cursor:pointer;" onclick="deleteItem('${it.id}')">Hapus</div>
      </div>
      <div class="setup-grid" style="margin-bottom:8px;">
        <div class="field"><label>Kategori</label>
          <select onchange="updateItemField('${it.id}','kategori',this.value)">
            ${KATEGORI_LIST.map(k => `<option value="${k}" ${it.kategori===k?'selected':''}>${k}</option>`).join('')}
          </select></div>
        <div class="field"><label>Satuan Kemasan (isi/dus)</label>
          <input type="number" value="${it.packSize}" onchange="updateItemField('${it.id}','packSize',this.value)"/></div>
      </div>
      <div class="setup-grid" style="margin-bottom:8px;">
        <div class="field"><label>Stok Idle</label>
          <input type="number" value="${it.stokIdle}" onchange="updateItemField('${it.id}','stokIdle',this.value)"/></div>
        <div class="field"><label>Stok Saat Ini</label>
          <input type="number" value="${it.stokSaatIni}" onchange="updateItemField('${it.id}','stokSaatIni',this.value)"/></div>
      </div>
      <div class="field" style="margin-bottom:0;"><label>Modal Satuan</label>
        <input type="number" value="${it.modalSatuan}" onchange="updateItemField('${it.id}','modalSatuan',this.value)"/></div>
    </div>
  `).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
}

function renderSetup(c){
  const incomplete = items.filter(isIncomplete).length;
  c.innerHTML = `
    <button class="btn btn-secondary" onclick="addNewItem()" style="margin-bottom:14px;">+ Tambah Item Baru</button>
    ${incomplete ? `<div class="alert-card warn"><div class="t">${incomplete} item belum lengkap</div><div class="s">Item bertanda "belum lengkap" modalnya masih 0 — isi dulu biar wajib bayar akurat.</div></div>` : ''}
    <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." oninput="setSetupSearch(this.value)"/></div>
    <div class="filter-chips">
      ${['ALL',...KATEGORI_LIST].map(k => `<div class="chip ${setupFilter===k?'active':''}" onclick="setSetupFilter('${k}')">${k==='ALL'?'Semua':k}</div>`).join('')}
    </div>
    <div id="setupList"></div>

    <div class="section-gap"></div>
    <div class="card">
      <div class="card-title">Backup & Export</div>
      <button class="btn btn-secondary" onclick="exportCSV('items')" style="margin-bottom:8px;">⬇ Export Master Item (CSV)</button>
      <button class="btn btn-secondary" onclick="exportCSV('tx')" style="margin-bottom:8px;">⬇ Export Transaksi (CSV)</button>
      <button class="btn btn-secondary" onclick="exportBackup()">⬇ Backup Semua Data (JSON)</button>
    </div>

    <div class="card">
      <div class="card-title">Pengaturan Sinkron</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">Buat sambungin HP/laptop lain ke data yang sama, masukin Access Key yang sama + Bin ID di bawah ini pas setup.</div>
      <label style="font-size:11px;color:var(--text2);">Bin ID Items</label>
      <div class="config-input" style="margin-bottom:6px;cursor:pointer;" onclick="copyText('${BIN_ITEMS||''}')">${BIN_ITEMS||'-'}</div>
      <label style="font-size:11px;color:var(--text2);">Bin ID Transaksi</label>
      <div class="config-input" style="margin-bottom:10px;cursor:pointer;" onclick="copyText('${BIN_TX||''}')">${BIN_TX||'-'}</div>
      <button class="btn btn-secondary" onclick="changeKey()" style="margin-bottom:8px;">Ganti Access Key</button>
      <button class="btn btn-danger-outline" onclick="resetLocal()">Reset koneksi di HP ini</button>
    </div>
    <div style="height:20px"></div>`;
  renderSetupList();
}

// ===== EXPORT / BACKUP / SETTINGS =====
function downloadFile(filename, content, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function csvCell(v){
  v = (v===undefined||v===null)?'':String(v);
  if(/[",\n]/.test(v)) return '"'+v.replace(/"/g,'""')+'"';
  return v;
}
function exportCSV(kind){
  let rows = [];
  if(kind==='items'){
    rows.push(['nama','kategori','stokIdle','packSize','modalSatuan','stokSaatIni','lastOpnameDate']);
    items.forEach(it => rows.push([it.nama,it.kategori,it.stokIdle,it.packSize,it.modalSatuan,it.stokSaatIni,it.lastOpnameDate||'']));
  } else {
    rows.push(['tanggal','tipe','item','qty','totalBayar','stokSisa','laku','wajibBayar','amount','note']);
    txLog.slice().sort((a,b)=>(a.ts||0)-(b.ts||0)).forEach(t => rows.push([
      t.date,t.type,t.itemNama||'',t.qty||'',t.totalBayar||'',t.stokSisa||'',t.laku||'',t.wajibBayar||'',t.amount||'',t.note||'']));
  }
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  downloadFile(`stokis_${kind}_${todayISO()}.csv`, csv, 'text/csv');
  showToast('File CSV diunduh', 'success');
}
function exportBackup(){
  const backup = {exportedAt: new Date().toISOString(), items, tx: txLog};
  downloadFile(`stokis_backup_${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  showToast('Backup JSON diunduh', 'success');
}
function copyText(t){
  if(!t) return;
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>showToast('Disalin','success'));
}
function changeKey(){
  const k = prompt('Tempel Access Key baru:');
  if(!k || !k.trim()) return;
  ACCESS_KEY = k.trim();
  localStorage.setItem(LS_KEY, ACCESS_KEY);
  showToast('Access Key diganti', 'success');
  saveAll();
}
function resetLocal(){
  if(!confirm('Reset koneksi di HP ini? Access Key & Bin ID dihapus dari alat ini (data di server tetap ada). Lo perlu setup ulang.')) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_BIN_ITEMS);
  localStorage.removeItem(LS_BIN_TX);
  localStorage.removeItem(LS_CACHE_ITEMS);
  localStorage.removeItem(LS_CACHE_TX);
  localStorage.removeItem(LS_PENDING);
  location.reload();
}
