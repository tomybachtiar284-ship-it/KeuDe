/***** KeuLite Pro – Supabase (Shared Workspace) *****/
(async function(){
  /* ---------- Utils ---------- */
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const esc = (x)=>String(x??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const rupiah = (n)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
  const today = ()=> new Date().toISOString().slice(0,10);
  const thisMonth = ()=> new Date().toISOString().slice(0,7);
  const prevMonthEnd = (ym)=>{ const [y,m]=ym.split('-').map(Number); const d=new Date(y, m-1, 1); d.setDate(0); return d.toISOString().slice(0,10); };
  const num = (v)=>Number(v||0);

  /* ---------- Supabase ---------- */
  const SUPABASE_URL = 'https://jllomycpshgbhppipyaj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9teWNwc2hnYmhwcGlweWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzg2OTcsImV4cCI6MjA3NTg1NDY5N30.DQYcB25G6blGpQnxyLlaqsX8OTXWMc7q51EtJN35vY4';
  const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;

  /* ---------- Auth (status saja) ---------- */
  async function initAuth(){
    const { data:{ user } } = await supa.auth.getUser();
    currentUser = user || null;
    updateAuthUI();
    supa.auth.onAuthStateChange((_e, session)=>{
      currentUser = session?.user || null;
      updateAuthUI();
      if(currentUser) bootAfterLogin();
    });
  }
  function updateAuthUI(){
    const s = $('#authStatus');
    if (s) s.textContent = currentUser ? 'Masuk: '+(currentUser.email||currentUser.id) : 'Belum login';
    if($('#btnSignOut')) $('#btnSignOut').style.display = currentUser ? '' : 'none';
  }
  async function signOut(){ await supa.auth.signOut(); location.reload(); }

  /* ---------- Transactions (tanpa user_id / journal) ---------- */
  const labelType = t => t==='income' ? 'Pemasukan' : t==='expense' ? 'Pengeluaran' : 'Pajak';

  async function addTransaction(tx){
    const payload = { ...tx, amount: num(tx.amount) };
    const { data, error } = await supa.from('transactions').insert(payload).select().single();
    if(error) throw error;
    return data;
  }
  async function updateTransaction(id, patch){
    const { data, error } = await supa.from('transactions')
      .update({ ...patch, amount: patch.amount!=null? num(patch.amount): undefined })
      .eq('id', id).select().single();
    if(error) throw error;
    return data;
  }
  async function removeTransaction(id){
    const { error } = await supa.from('transactions').delete().eq('id', id);
    if(error) throw error;
  }
  async function listTransactions(limit=10){
    const { data, error } = await supa.from('transactions').select('*').order('date',{ascending:false}).limit(limit);
    if(error) throw error; return data||[];
  }
  async function listTransactionsByMonth(ym){
    const { data, error } = await supa.from('transactions')
      .select('*').gte('date', ym+'-01').lte('date', ym+'-31').order('date',{ascending:false});
    if(error) throw error; return data||[];
  }
  async function sumByType(ym, type){
    const rows = await listTransactionsByMonth(ym);
    return rows.filter(r=>r.type===type).reduce((a,b)=>a+num(b.amount),0);
  }
  async function cashBalance(untilDate){
    const { data, error } = await supa.from('transactions').select('type,amount,date').lte('date', untilDate);
    if(error) throw error;
    let inc=0, exp=0, tax=0;
    (data||[]).forEach(t=>{
      if(t.type==='income') inc+=num(t.amount);
      if(t.type==='expense') exp+=num(t.amount);
      if(t.type==='tax') tax+=num(t.amount);
    });
    return inc - exp - tax;
  }

  /* ---------- Documents (Receipts / Quotation / Invoice) ---------- */
  const computeDocTotal = (items=[], discountPct=0, taxPct=0)=>{
    const sub = items.reduce((a,b)=>a + num(b.qty)*num(b.price),0);
    const disc = sub * (num(discountPct)/100);
    const dpp  = sub - disc;
    const tax  = dpp * (num(taxPct)/100);
    return Math.max(0, dpp + tax);
  };

  /* ===== Receipts ===== */
  function newReceiptNumber(seq){ return 'RC-'+String(seq).padStart(4,'0'); }
  async function nextReceiptNumber(){
    const { data } = await supa.from('receipts').select('id');
    const n = (data?.length||0)+1; return newReceiptNumber(n);
  }
  async function saveReceipt(rc){
    const base = { ...rc, amount: num(rc.amount) };
    if(rc.id){
      const { data, error } = await supa.from('receipts').update(base).eq('id', rc.id).select().single();
      if(error) throw error; return data;
    }else{
      const { data, error } = await supa.from('receipts').insert(base).select().single();
      if(error) throw error; return data;
    }
  }
  async function listReceipts(){
    const { data, error } = await supa.from('receipts').select('*').order('date',{ascending:false});
    if(error) throw error; return data||[];
  }
  async function deleteReceipt(id){
    const { error } = await supa.from('receipts').delete().eq('id', id);
    if(error) throw error;
  }

  /* ===== Quotations (pakai quotation_items) ===== */
  function newQuoteNumber(seq){ return 'QT-'+String(seq).padStart(4,'0'); }
  async function nextQuoteNumber(){
    const { data } = await supa.from('quotations').select('id');
    const n = (data?.length||0)+1; return newQuoteNumber(n);
  }

  // Ambil quotation + items (embedded)
  async function listQuotes(){
    const { data, error } = await supa
      .from('quotations')
      .select('id,date,number,client,contact,discount_pct,tax_pct,notes, quotation_items(description,qty,price)')
      .order('date',{ascending:false});
    if (error) throw error;
    return (data||[]).map(q=>({
      ...q,
      items: (q.quotation_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
    }));
  }

  async function saveQuote(qt){
    // simpan header
    let row;
    const header = {
      number: qt.number, date: qt.date, client: qt.client, contact: qt.contact,
      discount_pct: qt.discount_pct ?? qt.discountPct ?? 0,
      tax_pct: qt.tax_pct ?? qt.taxPct ?? 0, notes: qt.notes||''
    };
    if(qt.id){
      const { data, error } = await supa.from('quotations').update(header).eq('id', qt.id).select().single();
      if(error) throw error; row = data;
      await supa.from('quotation_items').delete().eq('quotation_id', row.id);
    }else{
      const { data, error } = await supa.from('quotations').insert(header).select().single();
      if(error) throw error; row = data;
    }
    // simpan items
    const items = (qt.items||[]).map(i=>({
      quotation_id: row.id, description: i.desc||'', qty: num(i.qty), price: num(i.price)
    }));
    if(items.length) {
      const { error: e2 } = await supa.from('quotation_items').insert(items);
      if(e2) throw e2;
    }
    return row;
  }

  async function deleteQuote(id){
    await supa.from('quotation_items').delete().eq('quotation_id', id);
    const { error } = await supa.from('quotations').delete().eq('id', id);
    if(error) throw error;
  }

  /* ===== Invoices (pakai invoice_items) ===== */
  function newInvNumber(seq){ return 'INV-'+String(seq).padStart(4,'0'); }
  async function nextInvNumber(){
    const { data } = await supa.from('invoices').select('id');
    const n = (data?.length||0)+1; return newInvNumber(n);
  }

  async function listInvoices(){
    const { data, error } = await supa
      .from('invoices')
      .select('id,date,number,client,status,discount_pct,tax_pct,notes, due_date, invoice_items(description,qty,price)')
      .order('date',{ascending:false});
    if (error) throw error;
    return (data||[]).map(inv=>({
      ...inv,
      items: (inv.invoice_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
    }));
  }

  async function saveInvoice(inv){
    // simpan header
    let row;
    const header = {
      number: inv.number, date: inv.date, due_date: inv.due_date || inv.dueDate,
      client: inv.client, discount_pct: inv.discount_pct ?? inv.discountPct ?? 0,
      tax_pct: inv.tax_pct ?? inv.taxPct ?? 0, status: inv.status||'Draft', notes: inv.notes||''
    };
    if(inv.id){
      const { data, error } = await supa.from('invoices').update(header).eq('id', inv.id).select().single();
      if(error) throw error; row = data;
      await supa.from('invoice_items').delete().eq('invoice_id', row.id);
    }else{
      const { data, error } = await supa.from('invoices').insert(header).select().single();
      if(error) throw error; row = data;
    }
    // simpan items
    const items = (inv.items||[]).map(i=>({
      invoice_id: row.id, description: i.desc||'', qty: num(i.qty), price: num(i.price)
    }));
    if(items.length) {
      const { error: e2 } = await supa.from('invoice_items').insert(items);
      if(e2) throw e2;
    }
    return row;
  }

  async function deleteInvoice(id){
    await supa.from('invoice_items').delete().eq('invoice_id', id);
    const { error } = await supa.from('invoices').delete().eq('id', id);
    if(error) throw error;
  }

  /* ---------- Rendering: Dashboard & Reports ---------- */
  async function renderDashboard(){
    const m = $('#dashMonth').value || thisMonth();
    const [inc, exp, tax, cash, recents] = await Promise.all([
      sumByType(m,'income'), sumByType(m,'expense'), sumByType(m,'tax'),
      cashBalance(today()), listTransactions(10)
    ]);
    $('#statIncome').textContent = rupiah(inc);
    $('#statExpense').textContent = rupiah(exp);
    $('#statTax').textContent = rupiah(tax);
    $('#statCash').textContent = rupiah(cash);
    $('#tblRecent').innerHTML = (recents||[]).map(t=>`
      <tr>
        <td>${t.date}</td>
        <td>${labelType(t.type)}</td>
        <td>${esc(t.category||'-')}</td>
        <td>${esc(t.description||'-')}</td>
        <td class="num">${rupiah(t.amount)}</td>
        <td>
          <button class="btn tiny" data-edit-tx="${t.id}">Edit</button>
          <button class="btn tiny danger" data-del-tx="${t.id}">Hapus</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="6">Belum ada transaksi.</td></tr>`;
  }

  async function runIncomeReport(){
    const m=$('#riMonth').value||thisMonth();
    const rows = (await listTransactionsByMonth(m)).filter(r=>r.type==='income');
    $('#riBody').innerHTML = rows.length? rows.map(t=>`<tr><td>${t.date}</td><td>${esc(t.category||'-')}</td><td>${esc(t.description||'-')}</td><td class="num">${rupiah(t.amount)}</td></tr>`).join('') : `<tr><td colspan="4">Tidak ada data.</td></tr>`;
    $('#riTotal').textContent = rupiah(rows.reduce((a,b)=>a+num(b.amount),0));
  }
  async function runExpenseReport(){
    const m=$('#reMonth').value||thisMonth();
    const rows = (await listTransactionsByMonth(m)).filter(r=>r.type==='expense');
    $('#reBody').innerHTML = rows.length? rows.map(t=>`<tr><td>${t.date}</td><td>${esc(t.category||'-')}</td><td>${esc(t.description||'-')}</td><td class="num">${rupiah(t.amount)}</td></tr>`).join('') : `<tr><td colspan="4">Tidak ada data.</td></tr>`;
    $('#reTotal').textContent = rupiah(rows.reduce((a,b)=>a+num(b.amount),0));
  }
  async function runTaxReport(){
    const m=$('#rtMonth').value||thisMonth();
    const rows = (await listTransactionsByMonth(m)).filter(r=>r.type==='tax');
    $('#rtBody').innerHTML = rows.length? rows.map(t=>`<tr><td>${t.date}</td><td>${esc(t.category||'-')}</td><td>${esc(t.description||'-')}</td><td class="num">${rupiah(t.amount)}</td></tr>`).join('') : `<tr><td colspan="4">Tidak ada data.</td></tr>`;
    $('#rtTotal').textContent = rupiah(rows.reduce((a,b)=>a+num(b.amount),0));
  }
  async function runIncomeStatement(){
    const m=$('#isMonth').value||thisMonth();
    const rows = await listTransactionsByMonth(m);
    const inc = rows.filter(r=>r.type==='income').reduce((a,b)=>a+num(b.amount),0);
    const exp = rows.filter(r=>r.type==='expense').reduce((a,b)=>a+num(b.amount),0);
    const tax = rows.filter(r=>r.type==='tax').reduce((a,b)=>a+num(b.amount),0);
    const beban = exp + tax, laba = inc - beban;
    $('#isResult').innerHTML = `
      <table class="table"><tbody>
        <tr><th>Pendapatan</th><td class="num">${rupiah(inc)}</td></tr>
        <tr><th>Beban (termasuk pajak)</th><td class="num">(${rupiah(beban)})</td></tr>
        <tr><th>Laba/Rugi Bersih</th><td class="num"><strong>${laba>=0? rupiah(laba): '('+rupiah(Math.abs(laba))+')'}</strong></td></tr>
      </tbody></table>`;
  }
  async function runCashFlow(){
    const ym=$('#cfMonth').value||thisMonth();
    const kasAwal = await cashBalance(prevMonthEnd(ym));
    const rows = await listTransactionsByMonth(ym);
    const inc = rows.filter(r=>r.type==='income').reduce((a,b)=>a+num(b.amount),0);
    const exp = rows.filter(r=>r.type==='expense').reduce((a,b)=>a+num(b.amount),0);
    const tax = rows.filter(r=>r.type==='tax').reduce((a,b)=>a+num(b.amount),0);
    const operasi = inc - (exp + tax);
    const kasAkhir = kasAwal + operasi;
    $('#cfResult').innerHTML = `
      <table class="table"><tbody>
        <tr><th>Saldo Kas Awal</th><td class="num">${rupiah(kasAwal)}</td></tr>
        <tr><th>Arus Kas dari Operasi</th><td class="num">${operasi>=0? rupiah(operasi): '('+rupiah(Math.abs(operasi))+')'}</td></tr>
        <tr><th>Saldo Kas Akhir</th><td class="num"><strong>${rupiah(kasAkhir)}</strong></td></tr>
      </tbody></table>`;
  }
  async function runBalanceSheet(){
    const dt=$('#bsDate').value||today();
    const kas = await cashBalance(dt);
    $('#bsResult').innerHTML = `
      <table class="table">
        <thead><tr><th>Aset</th><th class="num">Jumlah</th></tr></thead>
        <tbody><tr><td>Kas</td><td class="num">${rupiah(kas)}</td></tr></tbody>
      </table><br/>
      <table class="table">
        <thead><tr><th>Liabilitas</th><th class="num">Jumlah</th></tr></thead>
        <tbody><tr><td>(Tidak dimodelkan)</td><td class="num">Rp 0</td></tr></tbody>
      </table><br/>
      <table class="table">
        <thead><tr><th>Ekuitas</th><th class="num">Jumlah</th></tr></thead>
        <tbody><tr><td>Ekuitas (Saldo Kas)</td><td class="num">${rupiah(kas)}</td></tr></tbody>
      </table>
      <p><small>Dapat dikembangkan ke modul modal awal, piutang/hutang, persediaan.</small></p>`;
  }

  /* ---------- Receipts UI ---------- */
  function loadReceiptToForm(r){
    const f = $('#formReceipt');
    f.number.value = r?.number || '';
    f.date.value = r?.date || today();
    f.from.value = r?.from || r?.received_from || '';
    f.for.value = r?.for || r?.purpose || '';
    f.amount.value = r?.amount || '';
    f.method.value = r?.method || '';
    f.notes.value = r?.notes || '';
    f.dataset.id = r?.id || '';
  }
  function renderReceiptsTable(list){
    $('#receiptList').innerHTML = (list||[]).map(r=>`
      <tr>
        <td>${r.date}</td>
        <td>${esc(r.number)}</td>
        <td>${esc(r.received_from)}</td>
        <td class="num">${rupiah(r.amount)}</td>
        <td>
          <button class="btn tiny" data-edit-rc="${r.id}">Edit</button>
          <button class="btn tiny" data-print-rc="${r.id}">Cetak</button>
          <button class="btn tiny danger" data-del-rc="${r.id}">Hapus</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5">Belum ada kwitansi.</td></tr>`;
  }
  function printReceipt(r){
    const wrap = $('#printAreaReceipt');
    wrap.innerHTML = `
      <h2 style="text-align:center">KWITANSI</h2>
      <p><strong>No:</strong> ${esc(r.number)} &nbsp;&nbsp; <strong>Tanggal:</strong> ${r.date}</p>
      <p>Telah diterima dari: <strong>${esc(r.received_from)}</strong></p>
      <p>Untuk pembayaran: <strong>${esc(r.purpose)}</strong></p>
      <p>Jumlah: <strong>${rupiah(r.amount)}</strong></p>
      <p>Metode: ${esc(r.method||'-')}</p>
      <p>Keterangan: ${esc(r.notes||'-')}</p>
      <br><br>
      <p style="text-align:right">Disetujui oleh, <br> Diruktur Utama PT DKE</p>`;
    window.print();
  }
  async function renderReceipts(){ renderReceiptsTable(await listReceipts()); }

  /* ---------- Quotation UI ---------- */
  function addItemRow(containerSel){
    const t = $('#tmplItemRow'); const node = t.content.firstElementChild.cloneNode(true);
    $(containerSel).appendChild(node);
    node.querySelectorAll('input').forEach(i=>i.addEventListener('input', ()=>calcItemsTotal(containerSel)));
    $('.it-del',node).addEventListener('click', ()=>{ node.remove(); calcItemsTotal(containerSel); });
    calcItemsTotal(containerSel);
  }
  function calcItemsTotal(containerSel){
    const rows = $$('.item-row', $(containerSel));
    let total=0; rows.forEach(r=>{
      const qty=num($('.it-qty',r).value); const price=num($('.it-price',r).value);
      const sub=qty*price; total+=sub; $('.it-subtotal',r).textContent=rupiah(sub);
    });
    return total;
  }
  function loadQuoteToForm(q){
    const f = $('#formQuote');
    f.number.value = q?.number || '';
    f.date.value = q?.date || today();
    f.client.value = q?.client || '';
    f.contact.value = q?.contact || '';
    f.discountPct.value = q?.discount_pct ?? q?.discountPct ?? 0;
    f.taxPct.value = q?.tax_pct ?? q?.taxPct ?? 0;
    $('#quoteItems').innerHTML = '';
    const items = q?.items || [];
    if(items.length===0) addItemRow('#quoteItems');
    else {
      for(let i=0;i<items.length;i++) addItemRow('#quoteItems');
      const rows = $$('#quoteItems .item-row');
      items.forEach((it,idx)=>{ const r=rows[idx]; $('.it-desc',r).value=it.desc||''; $('.it-qty',r).value=it.qty||1; $('.it-price',r).value=it.price||0; });
      calcItemsTotal('#quoteItems');
    }
    f.notes.value = q?.notes || '';
    f.dataset.id = q?.id || '';
  }
  function renderQuotesTable(list){
    $('#quoteList').innerHTML = (list||[]).map(q=>{
      const total = computeDocTotal(q.items, q.discount_pct ?? 0, q.tax_pct ?? 0);
      return `<tr>
        <td>${q.date}</td>
        <td>${esc(q.number)}</td>
        <td>${esc(q.client)}</td>
        <td class="num">${rupiah(total)}</td>
        <td>
          <button class="btn tiny" data-edit-qt="${q.id}">Edit</button>
          <button class="btn tiny" data-print-qt="${q.id}">Cetak</button>
          <button class="btn tiny danger" data-del-qt="${q.id}">Hapus</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="5">Belum ada penawaran.</td></tr>`;
  }
  function printQuote(q){
    const total = computeDocTotal(q.items, q.discount_pct ?? 0, q.tax_pct ?? 0);
    const rows = (q.items||[]).map(i=>`<tr><td>${esc(i.desc)}</td><td class="num">${i.qty}</td><td class="num">${rupiah(i.price)}</td><td class="num">${rupiah(i.qty*i.price)}</td></tr>`).join('');
    $('#printAreaQuote').innerHTML = `
      <h2 style="text-align:center">PENAWARAN HARGA</h2>
      <p><strong>No:</strong> ${esc(q.number)} &nbsp;&nbsp; <strong>Tanggal:</strong> ${q.date}</p>
      <p>Kepada Yth: <strong>${esc(q.client)}</strong> (${esc(q.contact||'-')})</p>
      <table class="table" style="margin-top:10px">
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Diskon: ${q.discount_pct||0}% &nbsp; | &nbsp; PPN: ${q.tax_pct||0}%</p>
      <h3 style="text-align:right">Total: ${rupiah(total)}</h3>
      <p>Catatan: ${esc(q.notes||'-')}</p>`;
    window.print();
  }
  async function renderQuotes(){ renderQuotesTable(await listQuotes()); }

  /* ---------- Invoice UI ---------- */
  function loadInvToForm(inv){
    const f = $('#formInv');
    f.number.value = inv?.number || '';
    f.date.value = inv?.date || today();
    f.dueDate.value = inv?.due_date || inv?.dueDate || today();
    f.client.value = inv?.client || '';
    f.discountPct.value = inv?.discount_pct ?? inv?.discountPct ?? 0;
    f.taxPct.value = inv?.tax_pct ?? inv?.taxPct ?? 0;
    f.status.value = inv?.status || 'Draft';
    f.notes.value = inv?.notes || '';
    $('#invItems').innerHTML = '';
    const items = inv?.items || [];
    if(items.length===0) addItemRow('#invItems');
    else {
      for(let i=0;i<items.length;i++) addItemRow('#invItems');
      const rows = $$('#invItems .item-row');
      items.forEach((it,idx)=>{ const r=rows[idx]; $('.it-desc',r).value=it.desc||''; $('.it-qty',r).value=it.qty||1; $('.it-price',r).value=it.price||0; });
      calcItemsTotal('#invItems');
    }
    f.dataset.id = inv?.id || '';
  }
  function renderInvoicesTable(list){
    $('#invList').innerHTML = (list||[]).map(inv=>{
      const total = computeDocTotal(inv.items, inv.discount_pct ?? 0, inv.tax_pct ?? 0);
      return `<tr>
        <td>${inv.date}</td>
        <td>${esc(inv.number)}</td>
        <td>${esc(inv.client)}</td>
        <td>${esc(inv.status)}</td>
        <td class="num">${rupiah(total)}</td>
        <td>
          <button class="btn tiny" data-edit-inv="${inv.id}">Edit</button>
          <button class="btn tiny" data-print-inv="${inv.id}">Cetak</button>
          <button class="btn tiny danger" data-del-inv="${inv.id}">Hapus</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6">Belum ada invoice.</td></tr>`;
  }
  function printInv(inv){
    const total = computeDocTotal(inv.items, inv.discount_pct ?? 0, inv.tax_pct ?? 0);
    const rows = (inv.items||[]).map(i=>`<tr><td>${esc(i.desc)}</td><td class="num">${i.qty}</td><td class="num">${rupiah(i.price)}</td><td class="num">${rupiah(i.qty*i.price)}</td></tr>`).join('');
    $('#printAreaInv').innerHTML = `
      <h2 style="text-align:center">INVOICE</h2>
      <p><strong>No:</strong> ${esc(inv.number)} &nbsp;&nbsp; <strong>Tanggal:</strong> ${inv.date} &nbsp; <strong>Jatuh Tempo:</strong> ${inv.due_date||inv.dueDate}</p>
      <p>Kepada: <strong>${esc(inv.client)}</strong></p>
      <table class="table" style="margin-top:10px">
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Diskon: ${inv.discount_pct||0}% &nbsp; | &nbsp; PPN: ${inv.tax_pct||0}%</p>
      <h3 style="text-align:right">Total: ${rupiah(total)}</h3>
      <p>Catatan: ${esc(inv.notes||'-')}</p>`;
    window.print();
  }
  async function renderInvoices(){ renderInvoicesTable(await listInvoices()); }

  /* ---------- Export / Import JSON (4 tabel saja) ---------- */
  async function doExport(){
    const [tx, rc, qt, iv] = await Promise.all([
      supa.from('transactions').select('*'),
      supa.from('receipts').select('*'),
      supa.from('quotations').select('*, quotation_items(*)'),
      supa.from('invoices').select('*, invoice_items(*)'),
    ]);
    // Bentuk data seragam
    const data = {
      transactions: tx.data||[],
      receipts: rc.data||[],
      quotations: (qt.data||[]).map(q=>({...q, quotation_items: q.quotation_items||[]})),
      invoices: (iv.data||[]).map(v=>({...v, invoice_items: v.invoice_items||[]})),
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'keulite-supabase-backup.json';
    a.click(); URL.revokeObjectURL(a.href);
  }
  async function doImport(file){
    const text = await file.text();
    const data = JSON.parse(text||'{}');
    if(!data) return;
    if(!confirm('Import akan menimpa data yang ada (transactions/receipts/quotations/invoices). Lanjutkan?')) return;

    // bersihkan
    await supa.from('invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supa.from('quotation_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await Promise.all([
      supa.from('transactions').delete().neq('id','00000000-0000-0000-0000-000000000000'),
      supa.from('receipts').delete().neq('id','00000000-0000-0000-0000-000000000000'),
      supa.from('quotations').delete().neq('id','00000000-0000-0000-0000-000000000000'),
      supa.from('invoices').delete().neq('id','00000000-0000-0000-0000-000000000000'),
    ]);

    // isi lagi
    if(data.transactions?.length) await supa.from('transactions').insert(data.transactions);
    if(data.receipts?.length) await supa.from('receipts').insert(data.receipts);
    if(data.quotations?.length){
      const headers = data.quotations.map(({quotation_items, ...h})=>h);
      const { data: qs } = await supa.from('quotations').insert(headers).select('id,number');
      for (let i=0;i<data.quotations.length;i++){
        const id = qs[i].id;
        const items = (data.quotations[i].quotation_items||[]).map(it=>({quotation_id:id, description:it.description, qty:it.qty, price:it.price}));
        if(items.length) await supa.from('quotation_items').insert(items);
      }
    }
    if(data.invoices?.length){
      const headers = data.invoices.map(({invoice_items, ...h})=>h);
      const { data: ivs } = await supa.from('invoices').insert(headers).select('id,number');
      for (let i=0;i<data.invoices.length;i++){
        const id = ivs[i].id;
        const items = (data.invoices[i].invoice_items||[]).map(it=>({invoice_id:id, description:it.description, qty:it.qty, price:it.price}));
        if(items.length) await supa.from('invoice_items').insert(items);
      }
    }
    alert('Import selesai.');
    const view = $('.nav-link.active')?.dataset.view || 'dashboard';
    setView(view);
  }

  /* ---------- Navigation & Buttons ---------- */
  function setYear(){ $('#year') && ($('#year').textContent = new Date().getFullYear()); }
  let currentView = 'dashboard';
  let lastView = 'dashboard';

  function setView(view){
    const active = document.querySelector('.nav-link.active')?.dataset.view || currentView;
    lastView = active || lastView;

    $$('.nav-link').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
    $$('.view').forEach(v=>v.classList.add('hidden'));
    const el = $('#view-'+view); if(el) el.classList.remove('hidden');
    $('#viewTitle') && ($('#viewTitle').textContent = el?.querySelector('h3')?.textContent || ({
      'dashboard':'Dashboard','balance-sheet':'Laporan Neraca','cash-flow':'Laporan Arus Kas','income-statement':'Laporan Laba Rugi',
      'report-income':'Laporan Pemasukan','report-expense':'Laporan Pengeluaran','report-tax':'Laporan Pembayaran Pajak',
      'receipt':'Form Kwitansi','quotation':'Penawaran Harga','invoice':'Invoice','settings':'Export / Import'
    }[view]||'Dashboard'));

    currentView = view;
    if(view==='dashboard') renderDashboard();
    if(view==='report-income') runIncomeReport();
    if(view==='report-expense') runExpenseReport();
    if(view==='report-tax') runTaxReport();
    if(view==='income-statement') runIncomeStatement();
    if(view==='cash-flow') runCashFlow();
    if(view==='balance-sheet') runBalanceSheet();
    if(view==='receipt') renderReceipts();
    if(view==='quotation') renderQuotes();
    if(view==='invoice') renderInvoices();
  }

  function bindNav(){
    $$('.nav-link').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
    $$('#view-dashboard [data-view-jump]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewJump)));
  }
  function bindTopbar(){
    $('#btnAddIncome') && $('#btnAddIncome').addEventListener('click',()=>openTxDialog('income'));
    $('#btnAddExpense') && $('#btnAddExpense').addEventListener('click',()=>openTxDialog('expense'));
    $('#btnAddTax') && $('#btnAddTax').addEventListener('click',()=>openTxDialog('tax'));
    $('#btnDashFilter') && $('#btnDashFilter').addEventListener('click',renderDashboard);
  }
  function openTxDialog(type){
    const dlg=$('#txDialog'), f=$('#formTx');
    if(!dlg||!f) return;
    $('#txTitle').textContent='Tambah Transaksi';
    f.reset(); f.date.value=today(); f.type.value=type||'income';

    if(!f.querySelector('.close-x')){
      const x=document.createElement('button');
      x.type='button';
      x.className='close-x';
      x.textContent='×';
      x.title='Tutup';
      Object.assign(x.style,{position:'absolute',top:'8px',right:'8px',width:'28px',height:'28px',
        border:'1px solid var(--line)',borderRadius:'50%',background:'transparent',color:'var(--text)',fontWeight:'800',cursor:'pointer'});
      x.addEventListener('click',()=>dlg.close());
      f.prepend(x);
    }

    dlg.showModal();
    $('#btnTxSave').onclick = async (e)=>{
      e.preventDefault();
      const fd=new FormData(f);
    await addTransaction({
      date: fd.get('date'),
      type: fd.get('type'),
      category: fd.get('category'),
      description: fd.get('description'),
      amount: fd.get('amount')
    });

      dlg.close(); renderDashboard();
    };
  }
  function bindDashTable(){
    $('#view-dashboard')?.addEventListener('click', async e=>{
      const ed=e.target.closest('[data-edit-tx]'); const del=e.target.closest('[data-del-tx]');
      if(del){ if(confirm('Hapus transaksi ini?')){ await removeTransaction(del.dataset.delTx); renderDashboard(); } }
      if(ed){
        const id=ed.dataset.editTx;
        const { data } = await supa.from('transactions').select('*').eq('id', id).single();
        const dlg=$('#txDialog'), f=$('#formTx'); if(!dlg||!f) return;
        $('#txTitle').textContent='Edit Transaksi';
        f.date.value=data.date; f.type.value=data.type; f.category.value=data.category||''; f.description.value=data.description||''; f.amount.value=data.amount;

        if(!f.querySelector('.close-x')){
          const x=document.createElement('button');
          x.type='button'; x.className='close-x'; x.textContent='×'; x.title='Tutup';
          Object.assign(x.style,{position:'absolute',top:'8px',right:'8px',width:'28px',height:'28px',
            border:'1px solid var(--line)',borderRadius:'50%',background:'transparent',color:'var(--text)',fontWeight:'800',cursor:'pointer'});
          x.addEventListener('click',()=>dlg.close());
          f.prepend(x);
        }

        dlg.showModal();
        $('#btnTxSave').onclick = async (ev)=>{
          ev.preventDefault();
          const fd=new FormData(f);
          await updateTransaction(id,{
            date: fd.get('date'),
            type: fd.get('type'),
            category: fd.get('category'),
            description: fd.get('description'),
            amount: num(fd.get('amount'))
          });
          dlg.close(); renderDashboard();
        };
      }
    });
  }

  /* ---------- Tombol × (kembali) di panel header ---------- */
  function injectCloseButtonsForPanels(){
    const views = [
      'receipt','quotation','invoice',
      'balance-sheet','cash-flow','income-statement',
      'report-income','report-expense','report-tax',
      'settings'
    ];
    for (const vid of views){
      const viewEl = document.getElementById('view-' + vid);
      if(!viewEl) continue;
      const header = viewEl.querySelector('.panel .panel-header');
      if(!header || header.querySelector('.close-x')) continue;

      const btn=document.createElement('button');
      btn.type='button'; btn.className='close-x'; btn.textContent='×'; btn.title='Kembali';
      Object.assign(btn.style,{marginLeft:'8px',width:'28px',height:'28px',border:'1px solid var(--line)',
        borderRadius:'50%',background:'transparent',color:'var(--text)',fontWeight:'800',cursor:'pointer'});
      btn.addEventListener('click', ()=> setView(lastView || 'dashboard'));
      header.appendChild(btn);
    }
  }

  /* ---------- Receipt bindings ---------- */
  function bindReceipt(){
    $('#btnReceiptNew')?.addEventListener('click', async ()=>{
      loadReceiptToForm({
        number: await nextReceiptNumber(),
        date: today(), received_from:'', purpose:'', amount:'', method:'', notes:''
      });
    });
    $('#btnReceiptPrint')?.addEventListener('click', async ()=>{
      const id = $('#formReceipt')?.dataset.id;
      if(!id) return alert('Simpan dulu sebelum cetak.');
      const { data: r } = await supa.from('receipts').select('*').eq('id', id).single();
      if(r) printReceipt(r); else alert('Kwitansi tidak ditemukan.');
    });
    $('#formReceipt')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const f = e.currentTarget; const fd = new FormData(f);
      const rc = {
        id: f.dataset.id || undefined,
        number: fd.get('number') || await nextReceiptNumber(),
        date: fd.get('date') || today(),
        received_from: fd.get('from'),
        purpose: fd.get('for'),
        amount: num(fd.get('amount')),
        method: fd.get('method')||'',
        notes: fd.get('notes')||''
      };
      const row = await saveReceipt(rc);
      f.dataset.id = row.id;
      alert('Kwitansi disimpan.');
      renderReceipts();
    });
    $('#view-receipt')?.addEventListener('click', async e=>{
      const ed = e.target.closest('[data-edit-rc]'); const del = e.target.closest('[data-del-rc]'); const pr = e.target.closest('[data-print-rc]');
      if(ed){ const { data:r } = await supa.from('receipts').select('*').eq('id', ed.dataset.editRc).single(); loadReceiptToForm(r); }
      if(pr){ const { data:r } = await supa.from('receipts').select('*').eq('id', pr.dataset.printRc).single(); if(r) printReceipt(r); }
      if(del){ if(confirm('Hapus kwitansi?')){ await deleteReceipt(del.dataset.delRc); renderReceipts(); } }
    });
  }

  /* ---------- Quote bindings ---------- */
  function bindQuote(){
    $('#btnQuoteNew')?.addEventListener('click', async ()=>{
      loadQuoteToForm({ number: await nextQuoteNumber(), date: today(), client:'', contact:'', items:[], discountPct:0, taxPct:0, notes:'' });
    });
    $('#btnQuoteAddItem')?.addEventListener('click', ()=>addItemRow('#quoteItems'));
    $('#formQuote')?.addEventListener('input', ()=>calcItemsTotal('#quoteItems'));
    $('#formQuote')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const f = e.currentTarget; const fd = new FormData(f);
      const items = $$('#quoteItems .item-row').map(r=>({
        desc: $('.it-desc',r).value, qty: num($('.it-qty',r).value), price: num($('.it-price',r).value)
      }));
      const qt = {
        id: f.dataset.id || undefined,
        number: fd.get('number') || await nextQuoteNumber(),
        date: fd.get('date') || today(),
        client: fd.get('client')||'',
        contact: fd.get('contact')||'',
        discount_pct: num(fd.get('discountPct')||0),
        tax_pct: num(fd.get('taxPct')||0),
        items, notes: fd.get('notes')||''
      };
      const row = await saveQuote(qt);
      f.dataset.id = row.id;
      alert('Penawaran disimpan.');
      renderQuotes();
    });
    $('#btnQuotePrint')?.addEventListener('click', async ()=>{
      const id = $('#formQuote')?.dataset.id; if(!id) return alert('Simpan dulu sebelum cetak.');
      // ambil bersama items
      const { data } = await supa.from('quotations')
        .select('*, quotation_items(description,qty,price)').eq('id', id).single();
      const q = data ? {
        ...data,
        items: (data.quotation_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
      } : null;
      if(q) printQuote(q);
    });
    $('#view-quotation')?.addEventListener('click', async e=>{
      const ed=e.target.closest('[data-edit-qt]'); const del=e.target.closest('[data-del-qt]'); const pr=e.target.closest('[data-print-qt]');
      if(ed){
        const { data } = await supa.from('quotations')
          .select('*, quotation_items(description,qty,price)').eq('id', ed.dataset.editQt).single();
        const q = data ? {
          ...data,
          items: (data.quotation_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
        } : null;
        if(q) loadQuoteToForm(q);
      }
      if(pr){
        const { data } = await supa.from('quotations')
          .select('*, quotation_items(description,qty,price)').eq('id', pr.dataset.printQt).single();
        const q = data ? {
          ...data,
          items: (data.quotation_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
        } : null;
        if(q) printQuote(q);
      }
      if(del){ if(confirm('Hapus penawaran?')){ await deleteQuote(del.dataset.delQt); renderQuotes(); } }
    });
  }

  /* ---------- Invoice bindings ---------- */
  function bindInvoice(){
    $('#btnInvNew')?.addEventListener('click', async ()=>{
      loadInvToForm({ number: await nextInvNumber(), date: today(), dueDate: today(), client:'', items:[], discountPct:0, taxPct:0, status:'Draft', notes:'' });
    });
    $('#btnInvAddItem')?.addEventListener('click', ()=>addItemRow('#invItems'));
    $('#formInv')?.addEventListener('input', ()=>calcItemsTotal('#invItems'));
    $('#formInv')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const f = e.currentTarget; const fd = new FormData(f);
      const items = $$('#invItems .item-row').map(r=>({
        desc: $('.it-desc',r).value, qty: num($('.it-qty',r).value), price: num($('.it-price',r).value)
      }));
      const inv = {
        id: f.dataset.id || undefined,
        number: fd.get('number') || await nextInvNumber(),
        date: fd.get('date') || today(),
        due_date: fd.get('dueDate') || today(),
        client: fd.get('client')||'',
        discount_pct: num(fd.get('discountPct')||0),
        tax_pct: num(fd.get('taxPct')||0),
        items,
        status: fd.get('status') || 'Draft',
        notes: fd.get('notes')||'',
      };
      const row = await saveInvoice(inv);
      f.dataset.id = row.id;
      alert('Invoice disimpan.');
      renderInvoices();
    });
    $('#btnInvPrint')?.addEventListener('click', async ()=>{
      const id = $('#formInv')?.dataset.id; if(!id) return alert('Simpan dulu sebelum cetak.');
      const { data } = await supa.from('invoices')
        .select('*, invoice_items(description,qty,price)').eq('id', id).single();
      const inv = data ? {
        ...data,
        items: (data.invoice_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
      } : null;
      if(inv) printInv(inv);
    });
    $('#view-invoice')?.addEventListener('click', async e=>{
      const ed=e.target.closest('[data-edit-inv]'); const del=e.target.closest('[data-del-inv]'); const pr=e.target.closest('[data-print-inv]');
      if(ed){
        const { data } = await supa.from('invoices')
          .select('*, invoice_items(description,qty,price)').eq('id', ed.dataset.editInv).single();
        const inv = data ? {
          ...data,
          items: (data.invoice_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
        } : null;
        if(inv) loadInvToForm(inv);
      }
      if(pr){
        const { data } = await supa.from('invoices')
          .select('*, invoice_items(description,qty,price)').eq('id', pr.dataset.printInv).single();
        const inv = data ? {
          ...data,
          items: (data.invoice_items||[]).map(i=>({desc:i.description, qty:i.qty, price:i.price}))
        } : null;
        if(inv) printInv(inv);
      }
      if(del){
        if(confirm('Hapus invoice?')){ await deleteInvoice(del.dataset.delInv); renderInvoices(); }
      }
    });
  }

  /* ---------- Settings bindings ---------- */
  function bindSettings(){
    $('#btnExport')?.addEventListener('click', doExport);
    $('#btnImport')?.addEventListener('click', ()=>{
      const f = $('#fileImport'); if(!f?.files?.[0]) return alert('Pilih file JSON dulu.');
      doImport(f.files[0]);
    });
  }

  /* ---------- Realtime ---------- */
  function initRealtime(){
    supa.channel('rt-transactions')
      .on('postgres_changes', { event:'*', schema:'public', table:'transactions' },
        ()=> renderDashboard())
      .subscribe();
  }

  /* ---------- Init ---------- */
  async function bootAfterLogin(){
    $('#dashMonth') && ($('#dashMonth').value=thisMonth());
    $('#riMonth') && ($('#riMonth').value=thisMonth());
    $('#reMonth') && ($('#reMonth').value=thisMonth());
    $('#rtMonth') && ($('#rtMonth').value=thisMonth());
    $('#cfMonth') && ($('#cfMonth').value=thisMonth());
    $('#isMonth') && ($('#isMonth').value=thisMonth());
    $('#bsDate') && ($('#bsDate').value=today());

    setView('dashboard');
    renderDashboard();
    initRealtime();
    injectCloseButtonsForPanels();
  }
  function bindAuthButtons(){
    $('#btnSignOut')?.addEventListener('click', signOut);
  }
  function bindReports(){
    $('#btnRiRun')?.addEventListener('click', runIncomeReport);
    $('#btnReRun')?.addEventListener('click', runExpenseReport);
    $('#btnRtRun')?.addEventListener('click', runTaxReport);
    $('#btnIsRun')?.addEventListener('click', runIncomeStatement);
    $('#btnCfRun')?.addEventListener('click', runCashFlow);
    $('#btnBsRun')?.addEventListener('click', runBalanceSheet);

    $('#btnRiPrint')?.addEventListener('click', ()=>window.print());
    $('#btnRePrint')?.addEventListener('click', ()=>window.print());
    $('#btnRtPrint')?.addEventListener('click', ()=>window.print());
    $('#btnIsPrint')?.addEventListener('click', ()=>window.print());
    $('#btnCfPrint')?.addEventListener('click', ()=>window.print());
    $('#btnBsPrint')?.addEventListener('click', ()=>window.print());

    const exportCSV = (rows, headers)=>{
      const csv = [headers.join(',')].concat(rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='report.csv'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#btnRiExport')?.addEventListener('click', async ()=>{
      const m=$('#riMonth').value||thisMonth(), data=(await listTransactionsByMonth(m)).filter(r=>r.type==='income');
      exportCSV(data, ['date','category','description','amount']);
    });
    $('#btnReExport')?.addEventListener('click', async ()=>{
      const m=$('#reMonth').value||thisMonth(), data=(await listTransactionsByMonth(m)).filter(r=>r.type==='expense');
      exportCSV(data, ['date','category','description','amount']);
    });
    $('#btnRtExport')?.addEventListener('click', async ()=>{
      const m=$('#rtMonth').value||thisMonth(), data=(await listTransactionsByMonth(m)).filter(r=>r.type==='tax');
      exportCSV(data, ['date','category','description','amount']);
    });
  }

  function init(){
    setYear();
    bindNav(); bindTopbar(); bindDashTable();
    bindReceipt(); bindQuote(); bindInvoice(); bindSettings(); bindReports();
    bindAuthButtons();
    injectCloseButtonsForPanels();
    initAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
