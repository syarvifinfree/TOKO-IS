// ===== STATE =====
let items = [];
let txLog = [];
let BIN_ITEMS = localStorage.getItem(LS_BIN_ITEMS) || null;
let BIN_TX = localStorage.getItem(LS_BIN_TX) || null;
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
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){
  if(!iso) return '-';
  const d = new Date(iso+'T00:00:00');
  const months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();
}
function uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function findItem(id){ return items.find(i => i.id === id); }
function setSyncDot(state){
  const dot = document.getElementById('syncDot');
  if(!dot) return;
  dot.className = 'sync-dot ' + state;
}
function showToast(msg, type){
  const host = document.getElementById('toastHost');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  t.innerHTML = (type==='success'?'✓ ':type==='error'?'⚠ ':'') + escapeHtml(msg);
  host.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// stok status: returns {level: 'danger'|'warning'|'success', pct}
function stokStatus(item){
  const idle = item.stokIdle || 1;
  const pct = Math.min(100, (item.stokSaatIni / idle) * 100);
  let level = 'success';
  if(item.stokSaatIni <= 0) level = 'danger';
  else if(pct < 30) level = 'danger';
  else if(pct < 70) level = 'warning';
  return {level, pct};
}

// ===== JSONBIN STORAGE LAYER =====
async function ensureBins(){
  setSyncDot('busy');
  try{
    if(!BIN_ITEMS){
      const res = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Master-Key':MK,'X-Bin-Name':'stokis_items'},
        body: JSON.stringify({items: INITIAL_ITEMS})
      });
      if(!res.ok) throw new Error('Gagal bikin bin items');
      const data = await res.json();
      BIN_ITEMS = data.metadata.id;
      localStorage.setItem(LS_BIN_ITEMS, BIN_ITEMS);
    }
    if(!BIN_TX){
      const res = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Master-Key':MK,'X-Bin-Name':'stokis_tx'},
        body: JSON.stringify({tx: []})
      });
      if(!res.ok) throw new Error('Gagal bikin bin tx');
      const data = await res.json();
      BIN_TX = data.metadata.id;
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
      fetch(`${API}/${BIN_ITEMS}/latest`, {headers:{'X-Master-Key':MK}}),
      fetch(`${API}/${BIN_TX}/latest`, {headers:{'X-Master-Key':MK}})
    ]);
    if(!r1.ok || !r2.ok) throw new Error('Gagal load data');
    const d1 = await r1.json();
    const d2 = await r2.json();
    items = d1.record.items || [];
    txLog = d2.record.tx || [];
    setSyncDot('ok');
    return true;
  }catch(e){
    console.error(e);
    setSyncDot('err');
    showToast('Gagal memuat data, cek koneksi', 'error');
    return false;
  }
}

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveAll, 500);
}

async function saveAll(){
  setSyncDot('busy');
  try{
    const [r1, r2] = await Promise.all([
      fetch(`${API}/${BIN_ITEMS}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Master-Key':MK},
        body: JSON.stringify({items})
      }),
      fetch(`${API}/${BIN_TX}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Master-Key':MK},
        body: JSON.stringify({tx: txLog})
      })
    ]);
    if(!r1.ok || !r2.ok) throw new Error('Gagal simpan');
    setSyncDot('ok');
  }catch(e){
    console.error(e);
    setSyncDot('err');
    showToast('Gagal nyimpen ke server', 'error');
  }
}

// ===== PIN AUTH =====
let pinInput = '';
function initPin(){
  const pad = document.getElementById('pinPad');
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  pad.innerHTML = keys.map(k => {
    if(k==='') return '<div></div>';
    return `<button data-k="${k}">${k}</button>`;
  }).join('');
  pad.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => onPinKey(b.dataset.k));
  });
  renderPinDots();
}
function renderPinDots(){
  const dots = document.getElementById('pinDots');
  dots.innerHTML = [0,1,2,3].map(i => `<div class="d ${i<pinInput.length?'fill':''}"></div>`).join('');
}
function onPinKey(k){
  const err = document.getElementById('pinErr');
  if(k === '⌫'){ pinInput = pinInput.slice(0,-1); err.textContent=''; renderPinDots(); return; }
  if(pinInput.length >= 4) return;
  pinInput += k;
  renderPinDots();
  if(pinInput.length === 4){
    if(pinInput === PIN){
      sessionStorage.setItem(LS_AUTH, '1');
      unlockApp();
    } else {
      err.textContent = 'PIN salah, coba lagi';
      setTimeout(() => { pinInput=''; renderPinDots(); }, 400);
    }
  }
}
function unlockApp(){
  document.getElementById('pinOverlay').classList.add('hidden');
  document.getElementById('mainWrap').classList.remove('hidden');
  boot();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  initPin();
  if(sessionStorage.getItem(LS_AUTH) === '1'){
    unlockApp();
  } else {
    document.getElementById('pinOverlay').classList.remove('hidden');
  }
  document.querySelectorAll('.nbtn').forEach(btn => {
    btn.addEventListener('click', () => goTab(btn.dataset.tab));
  });
});

async function boot(){
  const ok = await ensureBins();
  if(!ok){
    document.getElementById('content').innerHTML = `<div class="empty-state"><div class="ic">⚠️</div><div class="t">Gagal konek ke server</div><div class="s">Cek koneksi internet, lalu refresh halaman</div></div>`;
    return;
  }
  await loadAll();
  goTab('dashboard');
}

function goTab(tab){
  currentTab = tab;
  document.querySelectorAll('.nbtn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const subMap = {dashboard:'Toko IS Tracker', restock:'Catat nota masuk', opname:'Stock opname mingguan', riwayat:'Riwayat transaksi', setup:'Master data item'};
  document.getElementById('topbarSub').textContent = subMap[tab] || '';
  render();
}

// ===== CALC HELPERS =====
function calcTotalUtang(){
  let total = 0;
  txLog.forEach(tx => {
    if(tx.type === 'restock') total += tx.totalBayar;
    else if(tx.type === 'opname') total -= tx.wajibBayar;
  });
  return total;
}
function groupedStokStatus(){
  const danger = [], warning = [], success = [];
  items.forEach(it => {
    const st = stokStatus(it);
    if(st.level==='danger') danger.push(it);
    else if(st.level==='warning') warning.push(it);
    else success.push(it);
  });
  danger.sort((a,b) => (a.stokSaatIni/(a.stokIdle||1)) - (b.stokSaatIni/(b.stokIdle||1)));
  warning.sort((a,b) => (a.stokSaatIni/(a.stokIdle||1)) - (b.stokSaatIni/(b.stokIdle||1)));
  return {danger, warning, success};
}

function render(){
  const c = document.getElementById('content');
  const ab = document.getElementById('actionBar');
  ab.classList.add('hidden');
  ab.innerHTML = '';
  if(currentTab==='dashboard') renderDashboard(c);
  else if(currentTab==='restock') renderRestock(c);
  else if(currentTab==='opname') renderOpname(c);
  else if(currentTab==='riwayat') renderRiwayat(c);
  else if(currentTab==='setup') renderSetup(c);
}

// ===== DASHBOARD =====
function renderDashboard(c){
  const totalUtang = calcTotalUtang();
  const {danger, warning, success} = groupedStokStatus();
  const lastTx = txLog.slice().sort((a,b) => (b.date+b.id).localeCompare(a.date+a.id))[0];

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
    <div class="hero-debt">
      <div class="lbl">Total Utang ke Toko IS</div>
      <div class="val">${fmtRp(totalUtang)}</div>
      <div class="sub">${lastTx ? 'Transaksi terakhir: '+fmtDate(lastTx.date)+' \u00b7 '+(lastTx.type==='restock'?'Restock':'Opname') : 'Belum ada transaksi'}</div>
    </div>

    <div class="stat-row">
      <div class="stat-box danger"><div class="n">${danger.length}</div><div class="l">Kritis</div></div>
      <div class="stat-box warning"><div class="n">${warning.length}</div><div class="l">Menipis</div></div>
      <div class="stat-box success"><div class="n">${success.length}</div><div class="l">Aman</div></div>
    </div>

    ${danger.length ? `
    <div class="card">
      <div class="card-title">⚠️ Stok Kritis \u2014 Perlu Direstock</div>
      ${danger.map(itemRowHtml).join('')}
    </div>` : ''}

    ${warning.length ? `
    <div class="card">
      <div class="card-title">Mulai Menipis</div>
      ${warning.map(itemRowHtml).join('')}
    </div>` : ''}

    ${(!danger.length && !warning.length) ? `
    <div class="card">
      <div class="empty-state">
        <div class="ic">✅</div>
        <div class="t">Semua stok aman</div>
        <div class="s">Gak ada item yang kritis atau menipis</div>
      </div>
    </div>` : ''}
  `;
}

// ===== RESTOCK TAB =====
let restockDate = todayISO();
let restockBatch = []; // {itemId, qty, totalBayar}
let restockPickerOpen = false;
let restockSearch = '';

function setRestockDate(v){ restockDate = v; }

function openRestockPicker(){
  restockPickerOpen = true;
  restockSearch = '';
  render();
}
function closeRestockPicker(){
  restockPickerOpen = false;
  render();
}
function setRestockSearch(v){
  restockSearch = v;
  renderRestockPickerList();
}
function addToRestockBatch(itemId){
  if(restockBatch.find(r => r.itemId === itemId)) { restockPickerOpen=false; render(); return; }
  restockBatch.push({itemId, qty:'', totalBayar:''});
  restockPickerOpen = false;
  render();
}
function removeFromRestockBatch(itemId){
  restockBatch = restockBatch.filter(r => r.itemId !== itemId);
  render();
}
function updateRestockField(itemId, field, val){
  const row = restockBatch.find(r => r.itemId === itemId);
  if(!row) return;
  row[field] = val;
  renderRestockPreview(itemId);
  renderActionBarRestock();
}

function renderRestockPreview(itemId){
  const el = document.getElementById('restockPrev_'+itemId);
  if(!el) return;
  const row = restockBatch.find(r => r.itemId === itemId);
  const it = findItem(itemId);
  if(!row || !it){ el.innerHTML=''; return; }
  const qty = parseFloat(row.qty);
  const total = parseFloat(row.totalBayar);
  const validCalc = qty > 0 && total >= 0 && !isNaN(qty) && !isNaN(total);
  if(!validCalc){ el.innerHTML=''; return; }
  const modalBaru = total/qty;
  el.innerHTML = `Modal satuan: ${fmtRp(modalBaru)} / pcs ${it.modalSatuan ? '(sebelumnya '+fmtRp(it.modalSatuan)+')' : ''}`;
}

function renderRestockPickerList(){
  const wrap = document.getElementById('restockPickerList');
  if(!wrap) return;
  const q = restockSearch.toLowerCase().trim();
  let list = items.filter(i => !restockBatch.find(r => r.itemId===i.id));
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b) => a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => `
    <div class="picker-item" onclick="addToRestockBatch('${it.id}')">
      <span class="nm">${escapeHtml(it.nama)} <span class="cat-tag cat-${it.kategori}">${it.kategori}</span></span>
      <span class="meta">stok ${fmtNum(it.stokSaatIni)}</span>
    </div>
  `).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
}

function renderRestockBatchList(){
  const wrap = document.getElementById('restockBatchList');
  if(!wrap) return;
  if(!restockBatch.length){
    wrap.innerHTML = `<div class="empty-state"><div class="ic">📦</div><div class="t">Belum ada item</div><div class="s">Tap "+ Tambah Item" buat mulai catat nota</div></div>`;
    return;
  }
  wrap.innerHTML = restockBatch.map(row => {
    const it = findItem(row.itemId);
    return `
    <div class="batch-row">
      <div class="batch-row-head">
        <div class="nm">${escapeHtml(it.nama)}</div>
        <div class="rm" onclick="removeFromRestockBatch('${it.id}')">&times;</div>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;">
          <label>Jumlah</label>
          <input type="number" inputmode="numeric" placeholder="0" value="${row.qty}" oninput="updateRestockField('${it.id}','qty',this.value)"/>
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Total Bayar</label>
          <input type="number" inputmode="numeric" placeholder="0" value="${row.totalBayar}" oninput="updateRestockField('${it.id}','totalBayar',this.value)"/>
        </div>
      </div>
      <div class="calc-preview" id="restockPrev_${it.id}"></div>
    </div>`;
  }).join('');
  restockBatch.forEach(row => renderRestockPreview(row.itemId));
}

function renderActionBarRestock(){
  const ab = document.getElementById('actionBar');
  const validRows = restockBatch.filter(r => parseFloat(r.qty) > 0 && parseFloat(r.totalBayar) >= 0 && !isNaN(parseFloat(r.qty)) && !isNaN(parseFloat(r.totalBayar)));
  if(!validRows.length){ ab.classList.add('hidden'); ab.innerHTML=''; return; }
  const total = validRows.reduce((s,r) => s + parseFloat(r.totalBayar), 0);
  ab.classList.remove('hidden');
  ab.innerHTML = `
    <div class="ab-inner">
      <div class="ab-summary"><span>${validRows.length} item siap disimpan</span><b>${fmtRp(total)}</b></div>
      <button class="btn btn-primary" onclick="submitRestock()">Simpan Restock</button>
    </div>`;
}

function renderRestock(c){
  c.innerHTML = `
    <div class="card">
      <div class="field" style="margin-bottom:0;">
        <label>Tanggal Nota</label>
        <input type="date" value="${restockDate}" onchange="setRestockDate(this.value)"/>
      </div>
    </div>

    ${restockPickerOpen ? `
    <div class="card">
      <div class="card-title">Pilih Item</div>
      <div class="search-box"><span class="ic">🔎</span><input id="restockSearchInput" placeholder="Cari item..." oninput="setRestockSearch(this.value)" autofocus/></div>
      <div class="picker-list" id="restockPickerList"></div>
      <div style="margin-top:10px;"><button class="btn btn-secondary" onclick="closeRestockPicker()">Batal</button></div>
    </div>
    ` : `
    <button class="btn btn-secondary" onclick="openRestockPicker()" style="margin-bottom:14px;">+ Tambah Item</button>
    <div id="restockBatchList"></div>
    <div style="height:90px"></div>
    `}
  `;
  if(restockPickerOpen) renderRestockPickerList();
  else { renderRestockBatchList(); renderActionBarRestock(); }
}

async function submitRestock(){
  const validRows = restockBatch.filter(r => parseFloat(r.qty) > 0 && parseFloat(r.totalBayar) >= 0 && !isNaN(parseFloat(r.qty)) && !isNaN(parseFloat(r.totalBayar)));
  if(!validRows.length) return;
  validRows.forEach(row => {
    const it = findItem(row.itemId);
    const qty = parseFloat(row.qty);
    const totalBayar = parseFloat(row.totalBayar);
    const modalSatuanBaru = totalBayar / qty;
    const modalSatuanLama = it.modalSatuan;
    it.modalSatuan = modalSatuanBaru;
    it.stokSaatIni += qty;
    it.lastRestockDate = restockDate;
    txLog.push({
      id: uid('tx'), type:'restock', date: restockDate,
      itemId: it.id, itemNama: it.nama,
      qty, totalBayar, modalSatuanBaru, modalSatuanLama
    });
  });
  const grandTotal = validRows.reduce((s,r) => s + parseFloat(r.totalBayar), 0);
  restockBatch = [];
  await saveAll();
  showToast(`Restock tersimpan \u00b7 ${fmtRp(grandTotal)}`, 'success');
  goTab('dashboard');
}

// ===== OPNAME TAB =====
let opnameDate = todayISO();
let opnameDraft = {}; // itemId -> value (string from input)
let opnameFilter = 'ALL';
let opnameSearch = '';

function setOpnameDate(v){ opnameDate = v; }
function setOpnameFilter(v){ opnameFilter = v; renderOpnameList(); }
function setOpnameSearch(v){ opnameSearch = v; renderOpnameList(); }

function setOpnameDraft(itemId, val){
  opnameDraft[itemId] = val;
  renderOpnamePreview(itemId);
  renderActionBarOpname();
}

function calcRefill(it, stokFisikBaru){
  if(it.stokIdle <= stokFisikBaru) return 0;
  const pack = it.packSize || 1;
  return Math.ceil((it.stokIdle - stokFisikBaru) / pack) * pack;
}

function renderOpnamePreview(itemId){
  const el = document.getElementById('prev_'+itemId);
  if(!el) return;
  const it = findItem(itemId);
  const raw = opnameDraft[itemId];
  const val = parseFloat(raw);
  if(raw === undefined || raw === '' || isNaN(val)){ el.innerHTML=''; return; }
  const laku = Math.max(0, it.stokSaatIni - val);
  const bayar = laku * it.modalSatuan;
  const refill = calcRefill(it, val);
  el.innerHTML = `<div class="calc-preview">Laku: ${fmtNum(laku)} \u00b7 Wajib bayar: ${fmtRp(bayar)}${refill>0?' \u00b7 Refill: '+fmtNum(refill):''}</div>`;
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
    const hasVal = draftVal !== undefined && draftVal !== '';
    return `
    <div class="batch-row">
      <div class="batch-row-head">
        <div class="nm">${escapeHtml(it.nama)} <span class="cat-tag cat-${it.kategori}">${it.kategori}</span></div>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;">
          <label>Stok tercatat</label>
          <input value="${fmtNum(it.stokSaatIni)}" disabled style="opacity:.55"/>
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Stok fisik (SO)</label>
          <input type="number" inputmode="numeric" placeholder="Hitung..." value="${hasVal?draftVal:''}" oninput="setOpnameDraft('${it.id}',this.value)"/>
        </div>
      </div>
      <div id="prev_${it.id}"></div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
  // re-render previews for filled ones
  Object.keys(opnameDraft).forEach(id => renderOpnamePreview(id));
}

function renderActionBarOpname(){
  const ab = document.getElementById('actionBar');
  let count = 0, totalBayar = 0;
  Object.keys(opnameDraft).forEach(id => {
    const raw = opnameDraft[id];
    const val = parseFloat(raw);
    if(raw === undefined || raw === '' || isNaN(val)) return;
    const it = findItem(id);
    if(!it) return;
    count++;
    const laku = Math.max(0, it.stokSaatIni - val);
    totalBayar += laku * it.modalSatuan;
  });
  if(!count){ ab.classList.add('hidden'); ab.innerHTML=''; return; }
  ab.classList.remove('hidden');
  ab.innerHTML = `
    <div class="ab-inner">
      <div class="ab-summary"><span>${count} item di-opname</span><b>${fmtRp(totalBayar)}</b></div>
      <button class="btn btn-primary" onclick="submitOpname()">Simpan Opname</button>
    </div>`;
}

function renderOpname(c){
  c.innerHTML = `
    <div class="card">
      <div class="field" style="margin-bottom:0;">
        <label>Tanggal Opname</label>
        <input type="date" value="${opnameDate}" onchange="setOpnameDate(this.value)"/>
      </div>
    </div>
    <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." value="${escapeHtml(opnameSearch)}" oninput="setOpnameSearch(this.value)"/></div>
    <div class="filter-chips">
      ${['ALL',...KATEGORI_LIST].map(k => `<div class="chip ${opnameFilter===k?'active':''}" onclick="setOpnameFilter('${k}')">${k==='ALL'?'Semua':k}</div>`).join('')}
    </div>
    <div id="opnameList"></div>
    <div style="height:90px"></div>
  `;
  renderOpnameList();
  renderActionBarOpname();
}

async function submitOpname(){
  const entries = [];
  Object.keys(opnameDraft).forEach(id => {
    const raw = opnameDraft[id];
    const val = parseFloat(raw);
    if(raw === undefined || raw === '' || isNaN(val)) return;
    const it = findItem(id);
    if(!it) return;
    entries.push({it, val});
  });
  if(!entries.length) return;

  let totalBayar = 0, refillCount = 0;
  const computed = entries.map(({it, val}) => {
    const stokSebelum = it.stokSaatIni;
    const laku = Math.max(0, stokSebelum - val);
    const wajibBayar = laku * it.modalSatuan;
    const refill = calcRefill(it, val);
    if(refill > 0) refillCount++;
    totalBayar += wajibBayar;
    return {it, val, stokSebelum, laku, wajibBayar, refill};
  });

  const ok = confirm(`Simpan opname ${entries.length} item?\n\nTotal wajib bayar ke Toko IS: ${fmtRp(totalBayar)}\n${refillCount} item perlu direstock minggu ini.`);
  if(!ok) return;

  computed.forEach(({it, val, stokSebelum, laku, wajibBayar, refill}) => {
    txLog.push({
      id: uid('tx'), type:'opname', date: opnameDate,
      itemId: it.id, itemNama: it.nama,
      stokSebelum, stokSisa: val, laku, wajibBayar,
      kebutuhanRefill: refill
    });
    it.stokSaatIni = val;
    it.lastOpnameDate = opnameDate;
  });

  opnameDraft = {};
  await saveAll();
  showToast(`Opname tersimpan \u00b7 Bayar ${fmtRp(totalBayar)}`, 'success');
  goTab('dashboard');
}

// ===== RIWAYAT TAB =====
let riwayatSubTab = 'transaksi'; // 'transaksi' | 'harga'
let riwayatTypeFilter = 'ALL'; // ALL/restock/opname
let riwayatHargaItemId = null;
let riwayatHargaSearch = '';

function setRiwayatSubTab(v){ riwayatSubTab = v; renderRiwayat(document.getElementById('content')); }
function setRiwayatTypeFilter(v){ riwayatTypeFilter = v; renderRiwayatList(); }
function setRiwayatHargaItem(id){ riwayatHargaItemId = id; renderRiwayatHargaBody(); }
function setRiwayatHargaSearch(v){ riwayatHargaSearch = v; renderRiwayatHargaItemPicker(); }

function renderRiwayatList(){
  const wrap = document.getElementById('riwayatTxList');
  if(!wrap) return;
  let list = txLog.filter(tx => riwayatTypeFilter==='ALL' || tx.type===riwayatTypeFilter);
  list = list.slice().sort((a,b) => (b.date+b.id).localeCompare(a.date+a.id));
  wrap.innerHTML = list.length ? list.map(tx => {
    if(tx.type==='restock'){
      return `<div class="tx-item">
        <div class="tx-ic restock">📦</div>
        <div class="tx-body">
          <div class="t1"><span>${escapeHtml(tx.itemNama)}</span><span class="amt">${fmtRp(tx.totalBayar)}</span></div>
          <div class="t2">Restock \u00b7 ${fmtNum(tx.qty)} pcs \u00b7 ${fmtDate(tx.date)} \u00b7 ${fmtRp(tx.modalSatuanBaru)}/pcs</div>
        </div>
      </div>`;
    } else {
      return `<div class="tx-item">
        <div class="tx-ic opname">📋</div>
        <div class="tx-body">
          <div class="t1"><span>${escapeHtml(tx.itemNama)}</span><span class="amt">${fmtRp(tx.wajibBayar)}</span></div>
          <div class="t2">Opname \u00b7 laku ${fmtNum(tx.laku)} \u00b7 sisa ${fmtNum(tx.stokSisa)} \u00b7 ${fmtDate(tx.date)}${tx.kebutuhanRefill>0?' \u00b7 refill '+fmtNum(tx.kebutuhanRefill):''}</div>
        </div>
      </div>`;
    }
  }).join('') : `<div class="empty-state"><div class="ic">🗂️</div><div class="t">Belum ada riwayat</div></div>`;
}

function renderRiwayatHargaItemPicker(){
  const wrap = document.getElementById('riwayatHargaPicker');
  if(!wrap) return;
  const q = riwayatHargaSearch.toLowerCase().trim();
  let list = items.filter(i => i.modalSatuan > 0);
  if(q) list = list.filter(i => i.nama.toLowerCase().includes(q));
  list.sort((a,b) => a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => `
    <div class="picker-item" onclick="setRiwayatHargaItem('${it.id}')">
      <span class="nm">${escapeHtml(it.nama)}</span>
      <span class="meta">${fmtRp(it.modalSatuan)}</span>
    </div>`).join('') : `<div class="empty-state"><div class="s">Belum ada item dengan histori harga</div></div>`;
}

function renderRiwayatHargaBody(){
  const wrap = document.getElementById('riwayatHargaBody');
  if(!wrap) return;
  if(!riwayatHargaItemId){ wrap.innerHTML=''; return; }
  const it = findItem(riwayatHargaItemId);
  const hist = txLog.filter(tx => tx.type==='restock' && tx.itemId===riwayatHargaItemId)
    .slice().sort((a,b) => (a.date+a.id).localeCompare(b.date+b.id));
  if(!hist.length){ wrap.innerHTML = `<div class="empty-state"><div class="s">Belum ada histori restock</div></div>`; return; }
  let rows = '';
  hist.forEach((tx, idx) => {
    const prev = idx>0 ? hist[idx-1].modalSatuanBaru : null;
    let trend = '';
    if(prev !== null){
      if(tx.modalSatuanBaru > prev) trend = `<span class="v-danger">▲ ${fmtRp(tx.modalSatuanBaru-prev)}</span>`;
      else if(tx.modalSatuanBaru < prev) trend = `<span class="v-success">▼ ${fmtRp(prev-tx.modalSatuanBaru)}</span>`;
      else trend = `<span style="color:var(--text3)">\u2014 tetap</span>`;
    }
    rows += `<div class="result-row"><span>${fmtDate(tx.date)}</span><span class="v">${fmtRp(tx.modalSatuanBaru)} ${trend}</span></div>`;
  });
  wrap.innerHTML = `
    <div class="card">
      <div class="card-title">${escapeHtml(it.nama)} \u2014 Tren Modal Satuan</div>
      ${rows}
    </div>`;
}

function renderRiwayat(c){
  c.innerHTML = `
    <div class="filter-chips">
      <div class="chip ${riwayatSubTab==='transaksi'?'active':''}" onclick="setRiwayatSubTab('transaksi')">Transaksi</div>
      <div class="chip ${riwayatSubTab==='harga'?'active':''}" onclick="setRiwayatSubTab('harga')">Tren Harga</div>
    </div>
    ${riwayatSubTab==='transaksi' ? `
      <div class="filter-chips">
        <div class="chip ${riwayatTypeFilter==='ALL'?'active':''}" onclick="setRiwayatTypeFilter('ALL')">Semua</div>
        <div class="chip ${riwayatTypeFilter==='restock'?'active':''}" onclick="setRiwayatTypeFilter('restock')">Restock</div>
        <div class="chip ${riwayatTypeFilter==='opname'?'active':''}" onclick="setRiwayatTypeFilter('opname')">Opname</div>
      </div>
      <div class="card"><div id="riwayatTxList"></div></div>
    ` : `
      <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." oninput="setRiwayatHargaSearch(this.value)"/></div>
      <div class="picker-list" id="riwayatHargaPicker" style="margin-bottom:14px;"></div>
      <div id="riwayatHargaBody"></div>
    `}
  `;
  if(riwayatSubTab==='transaksi') renderRiwayatList();
  else { renderRiwayatHargaItemPicker(); renderRiwayatHargaBody(); }
}

// ===== SETUP TAB =====
let setupSearch = '';
let setupFilter = 'ALL';

function setSetupSearch(v){ setupSearch = v; renderSetupList(); }
function setSetupFilter(v){ setupFilter = v; renderSetupList(); }

function updateItemField(itemId, field, val){
  const it = findItem(itemId);
  if(!it) return;
  if(field === 'nama' || field === 'kategori'){
    it[field] = val;
  } else {
    const num = parseFloat(val);
    it[field] = isNaN(num) ? 0 : num;
  }
  scheduleSave();
  showToast('Tersimpan', 'success');
}

function deleteItem(itemId){
  const it = findItem(itemId);
  if(!it) return;
  if(!confirm(`Hapus "${it.nama}" dari master data? Riwayat transaksinya tetap ada di Riwayat.`)) return;
  items = items.filter(i => i.id !== itemId);
  scheduleSave();
  renderSetupList();
  showToast('Item dihapus', 'success');
}

function addNewItem(){
  const nama = prompt('Nama barang baru:');
  if(!nama || !nama.trim()) return;
  const it = {
    id: uid('i'), nama: nama.trim().toUpperCase(), kategori: 'MINUMAN',
    stokIdle: 0, packSize: 1, modalSatuan: 0, stokSaatIni: 0
  };
  items.push(it);
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
  list.sort((a,b) => a.nama.localeCompare(b.nama));
  wrap.innerHTML = list.length ? list.map(it => `
    <div class="setup-item">
      <div class="setup-item-head">
        <div class="nm">${escapeHtml(it.nama)}</div>
        <div class="rm" style="color:var(--danger);font-size:13px;cursor:pointer;" onclick="deleteItem('${it.id}')">Hapus</div>
      </div>
      <div class="setup-grid" style="margin-bottom:8px;">
        <div class="field">
          <label>Kategori</label>
          <select onchange="updateItemField('${it.id}','kategori',this.value)">
            ${KATEGORI_LIST.map(k => `<option value="${k}" ${it.kategori===k?'selected':''}>${k}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Satuan Kemasan</label>
          <input type="number" value="${it.packSize}" onchange="updateItemField('${it.id}','packSize',this.value)"/>
        </div>
      </div>
      <div class="setup-grid" style="margin-bottom:8px;">
        <div class="field">
          <label>Stok Idle</label>
          <input type="number" value="${it.stokIdle}" onchange="updateItemField('${it.id}','stokIdle',this.value)"/>
        </div>
        <div class="field">
          <label>Stok Saat Ini</label>
          <input type="number" value="${it.stokSaatIni}" onchange="updateItemField('${it.id}','stokSaatIni',this.value)"/>
        </div>
      </div>
      <div class="field" style="margin-bottom:0;">
        <label>Modal Satuan</label>
        <input type="number" value="${it.modalSatuan}" onchange="updateItemField('${it.id}','modalSatuan',this.value)"/>
      </div>
    </div>
  `).join('') : `<div class="empty-state"><div class="s">Item gak ketemu</div></div>`;
}

function renderSetup(c){
  c.innerHTML = `
    <button class="btn btn-secondary" onclick="addNewItem()" style="margin-bottom:14px;">+ Tambah Item Baru</button>
    <div class="search-box"><span class="ic">🔎</span><input placeholder="Cari item..." oninput="setSetupSearch(this.value)"/></div>
    <div class="filter-chips">
      ${['ALL',...KATEGORI_LIST].map(k => `<div class="chip ${setupFilter===k?'active':''}" onclick="setSetupFilter('${k}')">${k==='ALL'?'Semua':k}</div>`).join('')}
    </div>
    <div id="setupList"></div>
    <div style="height:20px"></div>
  `;
  renderSetupList();
}
