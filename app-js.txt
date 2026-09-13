const STORAGE_KEY = "portmonka:v1";

const SOURCES = {
  "Pro-Factor": { split: true, firstPct: 75, delayMonths: 4, triggerLabel: "uzavření města" },
  "GOORN": { split: true, firstPct: 50, delayMonths: 12, triggerLabel: "instalace přístroje" },
  "Domoveo.cz": { split: false, firstPct: 100, delayMonths: 0, triggerLabel: "obchodní případ" },
  "Grafika": { split: false, firstPct: 100, delayMonths: 0, triggerLabel: "zakázka" }
};

let state = loadState();
let incomePeriod = "month";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function parseDate(s) {
  return new Date(`${s}T12:00:00`);
}
function addMonths(dateString, months) {
  const d = parseDate(dateString);
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0,10);
}
function fmtDate(s) {
  if (!s) return "—";
  return parseDate(s).toLocaleDateString("cs-CZ", {day:"numeric", month:"numeric", year:"numeric"});
}
function fmtMoney(n) {
  return new Intl.NumberFormat("cs-CZ", {style:"currency", currency:"CZK", maximumFractionDigits:0}).format(Math.round(n || 0));
}
function monthKey(s) { return s ? s.slice(0,7) : ""; }
function monthLabel(key) {
  const [y,m] = key.split("-").map(Number);
  return new Date(y,m-1,1).toLocaleDateString("cs-CZ",{month:"short"}).replace(".","");
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { cases: [] };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function deriveStatus(inst) {
  if (inst.paymentDate) return "proplaceno";
  if (inst.invoicedDate) return "vyfakturovano";
  if (todayISO() >= inst.dueDate) return "lze fakturovat";
  return "ceka";
}
function statusLabel(status) {
  return {ceka:"Čeká", "lze fakturovat":"Lze fakturovat", vyfakturovano:"Vyfakturováno", proplaceno:"Proplaceno"}[status] || status;
}
function statusClass(status) {
  return {ceka:"", "lze fakturovat":"warning", vyfakturovano:"", proplaceno:"good"}[status] || "";
}
function allInstallments() {
  return state.cases.flatMap(c => c.installments.map(i => ({...i, caseId:c.id, title:c.title, source:c.source})));
}
function refreshStatuses() {
  // Stav "lze fakturovat" je odvozený z data nároku, nikoli uložen jako pevný stav.
  // Ostatní kroky jsou ruční akce.
}
function openModal() {
  document.getElementById("caseForm").reset();
  document.getElementById("fTriggerDate").value = todayISO();
  document.getElementById("fSplit").value = 50;
  document.getElementById("fDelay").value = 12;
  updateFormHelp();
  document.getElementById("modalBackdrop").hidden = false;
  setTimeout(()=>document.getElementById("fTitle").focus(),50);
}
function closeModal() { document.getElementById("modalBackdrop").hidden = true; }
function showToast(text) {
  const el=document.getElementById("toast");
  el.textContent=text; el.classList.add("show");
  clearTimeout(showToast.t); showToast.t=setTimeout(()=>el.classList.remove("show"),2200);
}
function empty(text) { return `<div class="empty">${text}</div>`; }

function renderNow() {
  const items = allInstallments();
  const billable = items.filter(i=>deriveStatus(i)==="lze fakturovat");
  const future = items.filter(i=>deriveStatus(i)==="ceka").sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  document.getElementById("nowBillable").textContent = fmtMoney(billable.reduce((s,i)=>s+i.amount,0));
  document.getElementById("nowBillableCount").textContent = `${billable.length} ${billable.length===1?"splátka":"splátky/splátek"}`;
  document.getElementById("nowUpcoming").textContent = fmtMoney(future.slice(0,5).reduce((s,i)=>s+i.amount,0));
  document.getElementById("nowUpcomingText").textContent = future[0] ? `nejdříve ${fmtDate(future[0].dueDate)}` : "nic naplánováno";
  document.getElementById("actionCount").textContent = billable.length;

  const actions = document.getElementById("actionList");
  actions.innerHTML = billable.length ? billable.map(i => `
    <article class="action-card">
      <div class="card-main">
        <div class="card-title">${esc(i.title)}</div>
        <div class="card-meta">${esc(i.source)} · nárok od ${fmtDate(i.dueDate)}</div>
        <div class="card-actions">
          <button class="small-btn primary" onclick="markInvoiced('${i.caseId}','${i.id}')">Označit vyfakturováno</button>
          <button class="small-btn" onclick="openDetail('${i.caseId}')">Detail</button>
        </div>
      </div>
      <div class="amount">${fmtMoney(i.amount)}</div>
    </article>
  `).join("") : empty("Momentálně není nic, co by bylo potřeba fakturovat.");

  const months = [];
  const base = new Date();
  for(let n=0;n<6;n++){
    const d = new Date(base.getFullYear(), base.getMonth()+n,1);
    months.push(d.toISOString().slice(0,7));
  }
  const forecast = months.map(m => {
    const sum = future.filter(i=>monthKey(i.dueDate)===m).reduce((s,i)=>s+i.amount,0);
    return `<div class="forecast-item"><div class="forecast-month">${monthLabel(m)} ${m.slice(0,4)}</div><div class="forecast-value">${fmtMoney(sum)}</div></div>`;
  }).join("");
  document.getElementById("forecastList").innerHTML = forecast;
}

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  if(period==="week"){
    const day = (now.getDay()+6)%7;
    start.setDate(now.getDate()-day);
  } else start.setDate(1);
  start.setHours(0,0,0,0);
  return {start, end:now};
}
function renderIncome() {
  const {start,end}=getPeriodRange(incomePeriod);
  const paid = allInstallments().filter(i=>{
    if(!i.paymentDate) return false;
    const d=parseDate(i.paymentDate);
    return d>=start && d<=end;
  });
  document.getElementById("incomeTotal").textContent=fmtMoney(paid.reduce((s,i)=>s+i.amount,0));
  const bySource=Object.keys(SOURCES).map(source=>{
    const sum=paid.filter(i=>i.source===source).reduce((s,i)=>s+i.amount,0);
    return `<article class="source-card"><div class="card-meta">${source}</div><strong>${fmtMoney(sum)}</strong></article>`;
  }).join("");
  document.getElementById("incomeBySource").innerHTML=bySource;

  const now=new Date(), periods=[];
  for(let n=5;n>=0;n--){
    const d=new Date(now.getFullYear(),now.getMonth()-n,1);
    periods.push(d.toISOString().slice(0,7));
  }
  const vals=periods.map(k=>allInstallments().filter(i=>i.paymentDate && monthKey(i.paymentDate)===k).reduce((s,i)=>s+i.amount,0));
  const max=Math.max(...vals,1);
  document.getElementById("trendChart").innerHTML=periods.map((k,idx)=>`
    <div class="bar-wrap">
      <div class="bar-value">${vals[idx]?fmtMoney(vals[idx]):""}</div>
      <div class="bar" style="height:${Math.max(3,Math.round(vals[idx]/max*120))}px"></div>
      <div class="bar-label">${monthLabel(k)}</div>
    </div>`).join("");

  const recent=allInstallments().filter(i=>i.paymentDate).sort((a,b)=>b.paymentDate.localeCompare(a.paymentDate));
  document.getElementById("paymentList").innerHTML=recent.length ? recent.slice(0,12).map(i=>`
    <article class="payment-card">
      <div class="card-main">
        <div class="card-title">${esc(i.title)}</div>
        <div class="card-meta">${esc(i.source)} · ${fmtDate(i.paymentDate)}</div>
      </div>
      <div class="amount good">${fmtMoney(i.amount)}</div>
    </article>`).join("") : empty("Zatím není evidována žádná skutečně proplacená splátka.");
}
function renderCases() {
  const q=document.getElementById("caseSearch").value.trim().toLowerCase();
  const source=document.getElementById("sourceFilter").value;
  const filtered=state.cases.filter(c=>
    (source==="all" || c.source===source) &&
    (!q || `${c.title} ${c.source} ${c.note||""}`.toLowerCase().includes(q))
  );
  document.getElementById("caseList").innerHTML=filtered.length ? filtered.map(c=>{
    const total=c.installments.reduce((s,i)=>s+i.amount,0);
    return `<article class="case-card">
      <div>
        <div class="case-source">${esc(c.source)}</div>
        <div class="case-title">${esc(c.title)}</div>
        <div class="card-meta">spouštěč ${fmtDate(c.triggerDate)} · celkem ${fmtMoney(total)}</div>
        <div class="installments">${c.installments.map(i=>{
          const st=deriveStatus(i);
          return `<div class="installment">
            <div class="i-label">${esc(i.label)}</div>
            <div class="i-value">${fmtMoney(i.amount)} <span class="pill ${statusClass(st)}">${statusLabel(st)}</span></div>
            <div class="i-date">${st==="proplaceno" ? `placeno ${fmtDate(i.paymentDate)}` : `nárok ${fmtDate(i.dueDate)}`}</div>
          </div>`;
        }).join("")}</div>
        <div class="card-actions"><button class="small-btn" onclick="openDetail('${c.id}')">Otevřít detail</button></div>
      </div>
      <div class="amount">${fmtMoney(total)}</div>
    </article>`;
  }).join("") : empty("Žádné případy neodpovídají filtru.");
}
function renderSummary() {
  const items=allInstallments();
  const total=items.reduce((s,i)=>s+i.amount,0);
  const paid=items.filter(i=>i.paymentDate).reduce((s,i)=>s+i.amount,0);
  document.getElementById("summaryTotal").textContent=fmtMoney(total);
  document.getElementById("summaryPaid").textContent=fmtMoney(paid);
  document.getElementById("summaryRemaining").textContent=fmtMoney(total-paid);
  document.getElementById("summarySources").innerHTML=`
    <div class="summary-row head"><div>Zdroj</div><div>Celkem</div><div>Proplaceno</div><div>Zbývá</div></div>
    ${Object.keys(SOURCES).map(source=>{
      const a=items.filter(i=>i.source===source);
      const t=a.reduce((s,i)=>s+i.amount,0), p=a.filter(i=>i.paymentDate).reduce((s,i)=>s+i.amount,0);
      return `<div class="summary-row"><div>${source}</div><strong>${fmtMoney(t)}</strong><strong class="good">${fmtMoney(p)}</strong><strong>${fmtMoney(t-p)}</strong></div>`;
    }).join("")}`;
}
function renderAll(){renderNow();renderIncome();renderCases();renderSummary();}

function createCase(e){
  e.preventDefault();
  const source=document.getElementById("fSource").value;
  const title=document.getElementById("fTitle").value.trim();
  const triggerDate=document.getElementById("fTriggerDate").value;
  const amount=Number(document.getElementById("fAmount").value);
  if(!title || !triggerDate || !amount) return;
  let split=100, delay=0;
  if(source==="Pro-Factor"){split=75;delay=4}
  if(source==="GOORN"){split=Number(document.getElementById("fSplit").value);delay=Number(document.getElementById("fDelay").value)}
  const installments=[];
  const firstAmount=Math.round(amount*split/100);
  installments.push({id:uid(),label:source==="Pro-Factor"?"75 % – 1. část":"1. část",amount:firstAmount,dueDate:triggerDate});
  if(split<100){
    installments.push({id:uid(),label:source==="Pro-Factor"?"25 % – 2. část":"2. část",amount:amount-firstAmount,dueDate:addMonths(triggerDate,delay)});
  }
  state.cases.unshift({id:uid(),source,title,triggerDate,totalAmount:amount,installments});
  saveState(); closeModal(); renderAll(); showToast("Případ byl přidán.");
}
function markInvoiced(caseId,instId){
  const c=state.cases.find(x=>x.id===caseId), i=c?.installments.find(x=>x.id===instId);
  if(!i)return;
  i.invoicedDate=todayISO();
  saveState();renderAll();showToast("Splátka označena jako vyfakturovaná.");
}
function markPaid(caseId,instId){
  const c=state.cases.find(x=>x.id===caseId), i=c?.installments.find(x=>x.id===instId);
  if(!i)return;
  i.paymentDate=todayISO();
  i.invoicedDate=i.invoicedDate||todayISO();
  saveState();renderAll();openDetail(caseId);showToast("Platba označena jako proplacená.");
}
function deleteCase(id){
  if(!confirm("Opravdu odstranit tento případ?"))return;
  state.cases=state.cases.filter(c=>c.id!==id);saveState();renderAll();document.getElementById("detailBackdrop").hidden=true;showToast("Případ odstraněn.");
}
function openDetail(id){
  const c=state.cases.find(x=>x.id===id);if(!c)return;
  document.getElementById("detailSource").textContent=c.source;
  document.getElementById("detailTitle").textContent=c.title;
  document.getElementById("detailBody").innerHTML=`
    <div class="detail-block"><div class="detail-grid">
      <div><span>Spouštěcí datum</span><br><strong>${fmtDate(c.triggerDate)}</strong></div>
      <div><span>Celková provize</span><br><strong>${fmtMoney(c.totalAmount)}</strong></div>
    </div></div>
    ${c.installments.map(i=>{
      const st=deriveStatus(i);
      return `<div class="detail-block">
        <div class="card-title">${esc(i.label)} · ${fmtMoney(i.amount)}</div>
        <div class="card-meta">Nárok: ${fmtDate(i.dueDate)} · stav: ${statusLabel(st)}</div>
        <div class="card-actions">
          ${st==="lze fakturovat"?`<button class="small-btn primary" onclick="markInvoiced('${c.id}','${i.id}');openDetail('${c.id}')">Označit vyfakturováno</button>`:""}
          ${st==="vyfakturovano"?`<button class="small-btn primary" onclick="markPaid('${c.id}','${i.id}')">Označit proplaceno dnes</button>`:""}
          ${st==="proplaceno"?`<span class="pill good">Proplaceno ${fmtDate(i.paymentDate)}</span>`:""}
        </div>
      </div>`;
    }).join("")}
    <button class="small-btn" onclick="deleteCase('${c.id}')">Odstranit případ</button>`;
  document.getElementById("detailBackdrop").hidden=false;
}

function updateFormHelp(){
  const source=document.getElementById("fSource").value;
  const wrap=document.getElementById("goornSplitWrap");
  const help=document.getElementById("formHelp");
  if(source==="Pro-Factor"){
    wrap.classList.remove("show");
    help.textContent="Pro-Factor: 75 % vzniká při uzavření města, druhých 25 % po 4 měsících.";
  } else if(source==="GOORN"){
    wrap.classList.add("show");
    help.textContent="GOORN: poměr je zatím nastavitelný pro každý případ zvlášť. Výchozí hodnota je 50/50 a druhá část je standardně za 12 měsíců.";
  } else {
    wrap.classList.remove("show");
    help.textContent=source==="Domoveo.cz" ? "Domoveo.cz: jedna provize bez časového rozdělení." : "Grafika: jednorázová ruční odměna.";
  }
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
  const name=btn.dataset.view;
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b===btn));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  window.scrollTo({top:0,behavior:"smooth"});
}));
document.getElementById("addBtn").onclick=openModal;
document.getElementById("addBtn2").onclick=openModal;
document.getElementById("closeModal").onclick=closeModal;
document.getElementById("closeDetail").onclick=()=>document.getElementById("detailBackdrop").hidden=true;
document.getElementById("caseForm").addEventListener("submit",createCase);
document.getElementById("fSource").addEventListener("change",updateFormHelp);
document.getElementById("caseSearch").addEventListener("input",renderCases);
document.getElementById("sourceFilter").addEventListener("change",renderCases);
document.querySelectorAll(".period-switch button").forEach(btn=>btn.addEventListener("click",()=>{
  incomePeriod=btn.dataset.period;
  document.querySelectorAll(".period-switch button").forEach(b=>b.classList.toggle("active",b===btn));
  renderIncome();
}));
document.getElementById("modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
document.getElementById("detailBackdrop").addEventListener("click",e=>{if(e.target.id==="detailBackdrop")e.currentTarget.hidden=true});
document.getElementById("settingsBtn").onclick=()=>{
  const choice=prompt("Portmonka – nastavení\n\n1 = načíst ukázková data\n2 = smazat všechna lokální data\n\nZadej 1 nebo 2:");
  if(choice==="1"){state=demoState();saveState();renderAll();showToast("Ukázková data načtena.");}
  if(choice==="2" && confirm("Smazat všechna lokální data Portmonky?")){state={cases:[]};saveState();renderAll();showToast("Lokální data smazána.");}
};
function demoState(){
  const d=(offset)=>{const x=new Date();x.setDate(x.getDate()+offset);return x.toISOString().slice(0,10)};
  const p1={id:uid(),label:"75 % – 1. část",amount:18750,dueDate:d(-5),invoicedDate:d(-4)};
  const p2={id:uid(),label:"25 % – 2. část",amount:6250,dueDate:d(120)};
  const g1={id:uid(),label:"1. část",amount:21000,dueDate:d(-12),invoicedDate:d(-10),paymentDate:d(-3)};
  const g2={id:uid(),label:"2. část",amount:21000,dueDate:d(350)};
  const dom={id:uid(),label:"Provize",amount:14500,dueDate:d(-20),invoicedDate:d(-18),paymentDate:d(-12)};
  const graf={id:uid(),label:"Zakázka",amount:8500,dueDate:d(-2),invoicedDate:d(-1)};
  return {cases:[
    {id:uid(),source:"Pro-Factor",title:"Dvůr Králové – plakáty",triggerDate:d(-5),totalAmount:25000,installments:[p1,p2]},
    {id:uid(),source:"GOORN",title:"Novák – instalace",triggerDate:d(-12),totalAmount:42000,installments:[g1,g2]},
    {id:uid(),source:"Domoveo.cz",title:"Reference – servis oken",triggerDate:d(-20),totalAmount:14500,installments:[dom]},
    {id:uid(),source:"Grafika",title:"A5 leták",triggerDate:d(-2),totalAmount:8500,installments:[graf]}
  ]};
}
renderAll();
