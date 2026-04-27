import { useState, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PROP_TYPES = [
  { v: "sfr",        label: "Single Family",       depYrs: 27.5 },
  { v: "small_mf",  label: "Small Multi (2–4)",    depYrs: 27.5 },
  { v: "large_mf",  label: "Large Multi (5+)",     depYrs: 27.5 },
  { v: "str",       label: "Short-Term Rental",    depYrs: 27.5 },
  { v: "commercial",label: "Commercial",           depYrs: 39   },
  { v: "mixed",     label: "Mixed Use",            depYrs: 39   },
];

const TAX_BRACKETS_MFJ = [
  { rate: 0.10, up: 23200  },{ rate: 0.12, up: 94300  },{ rate: 0.22, up: 201050 },
  { rate: 0.24, up: 383900 },{ rate: 0.32, up: 487450 },{ rate: 0.35, up: 731200 },
  { rate: 0.37, up: Infinity },
];
const TAX_BRACKETS_SINGLE = [
  { rate: 0.10, up: 11600  },{ rate: 0.12, up: 47150  },{ rate: 0.22, up: 100525 },
  { rate: 0.24, up: 191950 },{ rate: 0.32, up: 243725 },{ rate: 0.35, up: 365600 },
  { rate: 0.37, up: Infinity },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const YEAR_CALENDAR = [
  { month: "Jan–Mar", items: ["Gather prior-year receipts & 1099s","Review depreciation schedules with CPA","Plan repair projects for Q2–Q3"] },
  { month: "Apr",     items: ["File or extend taxes (April 15)","Start tracking REPS hours log","Commission cost seg study if buying this year"] },
  { month: "May–Jun", items: ["Execute planned repairs (fully deductible)","Review rent rolls — any adjustments needed?","Evaluate refinance opportunities"] },
  { month: "Jul–Sep", items: ["Mid-year tax projection with CPA","Complete major improvements before year-end","Review insurance coverage on appreciated properties"] },
  { month: "Oct",     items: ["Final cost seg study deadline (must be placed in service by Dec 31)","Accelerate repairs if short on deductions","Evaluate new property purchase — must close by Dec 31 for year-1 dep"] },
  { month: "Nov–Dec", items: ["Max out all deductible repairs & expenses","Purchase equipment/appliances (Sec 179 election)","Make 4th quarter estimated tax payment (Jan 15)","Confirm bonus dep election with CPA before filing"] },
];

const $f = (n, def="—") => {
  if (n === null || n === undefined || isNaN(n)) return def;
  const a = Math.abs(n);
  const s = a >= 1000000 ? (a/1000000).toFixed(1)+"M" : a >= 1000 ? a.toLocaleString("en-US",{maximumFractionDigits:0}) : a.toFixed(0);
  return (n < 0 ? "-$" : "$") + s;
};
const pct = n => isNaN(n)||!isFinite(n) ? "—" : (n*100).toFixed(1)+"%";
const num = (v, fb=0) => { const n=parseFloat(v); return isNaN(n)?fb:n; };

const calcTax = (income, filing) => {
  const brackets = filing==="mfj" ? TAX_BRACKETS_MFJ : TAX_BRACKETS_SINGLE;
  let tax=0, prev=0;
  for (const b of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, b.up) - prev) * b.rate;
    prev = b.up;
  }
  return tax;
};

const getBracket = (income, filing) => {
  const brackets = filing==="mfj" ? TAX_BRACKETS_MFJ : TAX_BRACKETS_SINGLE;
  let prev=0;
  for (const b of brackets) {
    if (income <= b.up) return { rate: b.rate, nextBracketAt: b.up, prev };
    prev = b.up;
  }
  return { rate: 0.37, nextBracketAt: Infinity, prev };
};

const BLANK = () => ({
  id: Math.random().toString(36).slice(2),
  name:"", type:"sfr", doors:1,
  purchasePrice:"", landPct:20,
  monthlyRent:"", vacancy:5,
  propTax:"", insurance:"", repairs:"", utilities:"", mgmtPct:8, other:"",
  capImprovement:"", capImprovLife:15,
  loanBalance:"", interestRate:6.5,
  priorPassiveLoss:"",
  equity:"",
  costSeg:false, costSegPct:25, bonusPct:60,
  sec179:"",
  strHours:"", materialPartic:false,
  qbiEligible:true,
});

// ─── UI primitives ─────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=Literata:ital,wght@0,400;0,500;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  input,select{font-family:inherit;}
  input[type=number]::-webkit-inner-spin-button{opacity:.3;}
  ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-thumb{background:#1e2d3a;}
  .hrow:hover{background:#0a1018 !important;}
  .tabmb{transition:color .15s,border-color .15s;}
  .card{background:#0b1219;border:1px solid #192530;border-radius:10px;padding:20px;margin-bottom:14px;}
  .inp{width:100%;background:#0f1820;border:1px solid #1e2d3a;border-radius:6px;padding:8px 10px;color:#cfe0ee;font-family:inherit;font-size:13px;outline:none;transition:border-color .2s;}
  .inp:focus{border-color:#3a7aaa;}
  .inp.ro{background:#0a1015;color:#3a7a5a;cursor:default;}
  select.inp{cursor:pointer;}
  .tag{display:inline-flex;align-items:center;font-size:9px;letter-spacing:1px;padding:2px 7px;border-radius:3px;text-transform:uppercase;font-weight:600;}
  .tog{width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
  .tog::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;top:3px;transition:left .2s;}
  .lbl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#4a7090;margin-bottom:5px;font-weight:500;}
  .sh{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#2a6a9a;margin:16px 0 8px;border-left:2px solid #2a6a9a;padding-left:8px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;}
  .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;}
  .statbox{background:#090e14;border:1px solid #192530;border-radius:7px;padding:13px 15px;}
  .statbox .sv{font-family:'Literata',serif;font-size:22px;font-weight:500;margin-top:3px;}
  .statbox .sl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#3a6080;}
  .alert{border-radius:6px;padding:10px 14px;font-size:11px;line-height:1.7;margin-bottom:10px;}
  .note{font-size:11px;color:#3a7060;line-height:1.7;margin-bottom:10px;}
`;

const Inp = ({v,on,ph,type="text",ro,sfx,w}) => (
  <div style={{position:"relative",width:w||"100%"}}>
    <input type={type} value={v} onChange={on} readOnly={ro} placeholder={ph}
      className={`inp${ro?" ro":""}`}
      style={{paddingRight:sfx?26:10,width:"100%"}}
      onFocus={e=>{if(!ro)e.target.style.borderColor="#3a7aaa"}}
      onBlur={e=>{if(!ro)e.target.style.borderColor="#1e2d3a"}}
    />
    {sfx&&<span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#2a5a7a",pointerEvents:"none"}}>{sfx}</span>}
  </div>
);

const Tog = ({on,click,label,badge,badgeColor}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
    <button className="tog" onClick={click}
      style={{background:on?"#1a5a3a":"#162030"}}
    >
      <span style={{position:"absolute",width:16,height:16,borderRadius:"50%",background:on?"#4af090":"#2a5a7a",top:3,left:on?21:3,transition:"left .2s"}}/>
    </button>
    <span style={{fontSize:12,color:"#a0c0d8"}}>{label}</span>
    {badge&&<span className="tag" style={{background:badgeColor?badgeColor+"20":"#0a2a1a",color:badgeColor||"#4af090",border:`1px solid ${badgeColor||"#4af090"}40`}}>{badge}</span>}
  </div>
);

const Lbl = ({c}) => <div className="lbl">{c}</div>;
const SH = ({c}) => <div className="sh">{c}</div>;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TaxZero() {
  const [tab, setTab] = useState(0);
  const [props, setProps] = useState([BLANK()]);
  const [w2, setW2] = useState("");
  const [otherInc, setOtherInc] = useState("");
  const [filing, setFiling] = useState("mfj");
  const [isREP, setIsREP] = useState(false);
  const [repHours, setRepHours] = useState("");
  const [simPrice, setSimPrice] = useState("");
  const [simLandPct, setSimLandPct] = useState(20);
  const [simCostSeg, setSimCostSeg] = useState(false);
  const [simCostSegPct, setSimCostSegPct] = useState(25);
  const [expandedProp, setExpandedProp] = useState(null);

  const upd = (id,f,v) => setProps(ps=>ps.map(p=>p.id===id?{...p,[f]:v}:p));
  const addProp = () => { const b=BLANK(); setProps(ps=>[...ps,b]); setExpandedProp(b.id); };
  const delProp = id => setProps(ps=>ps.filter(p=>p.id!==id));

  // ── Per-property calculations ──────────────────────────────────────────────
  const pCalcs = useMemo(() => props.map(p => {
    const pp    = num(p.purchasePrice);
    const land  = pp * num(p.landPct)/100;
    const bldg  = pp - land;
    const life  = PROP_TYPES.find(t=>t.v===p.type)?.depYrs||27.5;

    // Depreciation
    const slDep   = bldg>0 ? bldg/life : 0;
    let bonusDep=0, accelDep=0;
    if (p.costSeg && bldg>0) {
      const ppBasis = bldg * num(p.costSegPct)/100;
      bonusDep  = ppBasis * num(p.bonusPct)/100;
      accelDep  = (ppBasis - bonusDep) / 5;
    }
    const capImprovDep = num(p.capImprovement) / num(p.capImprovLife,15);
    const sec179Ded    = num(p.sec179);
    const totalDep     = slDep + bonusDep + accelDep + capImprovDep + sec179Ded;

    // Income
    const grossRent   = num(p.monthlyRent) * num(p.doors,1) * 12;
    const effRent     = grossRent * (1 - num(p.vacancy)/100);

    // Expenses
    const propTax  = num(p.propTax);
    const ins      = num(p.insurance);
    const repairs  = num(p.repairs);
    const utils    = num(p.utilities);
    const mgmt     = effRent * num(p.mgmtPct)/100;
    const otherExp = num(p.other);
    const totalOpEx = propTax + ins + repairs + utils + mgmt + otherExp;

    // Debt
    const interest = num(p.loanBalance) * num(p.interestRate)/100;

    // QBI (20% of net rental income, if eligible & positive)
    const netBeforeQBI = effRent - totalOpEx - interest - totalDep;
    const qbi = (p.qbiEligible && netBeforeQBI > 0) ? netBeforeQBI * 0.20 : 0;

    const taxableIncome  = netBeforeQBI - qbi;
    const NOI            = effRent - totalOpEx;
    const cashFlow       = NOI - interest;
    const capRate        = pp>0 ? NOI/pp : 0;
    const cocReturn      = pp>0 ? cashFlow/(pp*(1-num(p.loanBalance)/pp||0.25)) : 0;
    const totalDeductions = totalOpEx + interest + totalDep + qbi;

    const isSTR       = p.type==="str";
    const strQual     = isSTR && num(p.strHours)>=500;
    const activePartic = p.materialPartic;
    const priorLoss   = num(p.priorPassiveLoss);

    // Monthly cash flow array (simplified seasonal model)
    const monthlyCF = MONTHS.map((_,i) => {
      const seasonMult = isSTR
        ? [0.5,0.5,0.8,1.0,1.2,1.5,1.5,1.4,1.1,0.9,0.7,0.8][i]
        : 1.0;
      const mRent = effRent/12 * seasonMult;
      const mExp  = totalOpEx/12;
      const mInt  = interest/12;
      return mRent - mExp - mInt;
    });

    return {
      ...p, pp, land, bldg, life,
      slDep, bonusDep, accelDep, capImprovDep, sec179Ded, totalDep,
      grossRent, effRent, propTax, ins, repairs, utils, mgmt, otherExp,
      totalOpEx, interest, NOI, cashFlow, qbi, taxableIncome, totalDeductions,
      capRate, cocReturn, netBeforeQBI, priorLoss, isSTR, strQual, activePartic,
      monthlyCF,
    };
  }), [props]);

  // ── Portfolio totals ────────────────────────────────────────────────────────
  const T = useMemo(() => {
    const ordinary   = num(w2) + num(otherInc);
    let totRent=0,totOpEx=0,totInt=0,totDep=0,totQBI=0;
    let passiveLoss=0, nonPassive=0, activeAllowLoss=0, priorLosses=0;
    let totCF=0, monthlyCF=MONTHS.map(()=>0);

    pCalcs.forEach(c=>{
      totRent   += c.effRent;
      totOpEx   += c.totalOpEx;
      totInt    += c.interest;
      totDep    += c.totalDep;
      totQBI    += c.qbi;
      priorLosses += c.priorLoss;
      totCF     += c.cashFlow;
      c.monthlyCF.forEach((v,i)=>{ monthlyCF[i]+=v; });

      if (c.taxableIncome < 0) {
        const loss = Math.abs(c.taxableIncome);
        if (c.strQual)         nonPassive       += loss;
        else if (c.activePartic) activeAllowLoss += loss;
        else                   passiveLoss      += loss;
      }
    });

    const repQual = isREP && num(repHours)>=750;
    const magi = ordinary;
    let allowance = 0;
    if (magi<=100000)      allowance = Math.min(activeAllowLoss,25000);
    else if (magi<150000)  allowance = Math.min(activeAllowLoss,25000*(1-(magi-100000)/50000));

    let appliedOffset = nonPassive + allowance + priorLosses;
    if (repQual) appliedOffset = nonPassive + activeAllowLoss + passiveLoss + priorLosses;
    appliedOffset = Math.min(appliedOffset, ordinary);

    const taxableAfter  = Math.max(0, ordinary - appliedOffset);
    const taxBefore     = calcTax(ordinary, filing);
    const taxAfter      = calcTax(taxableAfter, filing);
    const taxSaved      = taxBefore - taxAfter;
    const effectiveRate = ordinary>0 ? taxAfter/ordinary : 0;
    const zeroPct       = ordinary>0 ? Math.min(100,appliedOffset/ordinary*100) : 0;
    const toZero        = Math.max(0, ordinary - appliedOffset);
    const bracket       = getBracket(taxableAfter, filing);
    const totalDeductions = totOpEx + totInt + totDep + totQBI;

    // New property sim
    const simPP   = num(simPrice);
    const simBldg = simPP * (1-num(simLandPct)/100);
    let simOffset = simBldg>0 ? simBldg/27.5 : 0;
    if (simCostSeg && simBldg>0) {
      const ppB = simBldg * num(simCostSegPct)/100;
      simOffset = ppB*0.60 + (simBldg-ppB)/27.5;
    }

    // Cumulative monthly CF
    let cumCF=0;
    const cumulativeCF = monthlyCF.map(v=>{ cumCF+=v; return cumCF; });

    return {
      ordinary, totRent, totOpEx, totInt, totDep, totQBI,
      passiveLoss, nonPassive, activeAllowLoss, allowance, priorLosses,
      repQual, appliedOffset, taxableAfter, taxBefore, taxAfter, taxSaved,
      effectiveRate, zeroPct, toZero, bracket, totalDeductions,
      simOffset, monthlyCF, cumulativeCF, totCF,
      totalLosses: passiveLoss+nonPassive+activeAllowLoss,
    };
  }, [pCalcs, w2, otherInc, filing, isREP, repHours, simPrice, simLandPct, simCostSeg, simCostSegPct]);

  const zColor = T.zeroPct>=100?"#4af090":T.zeroPct>=60?"#f0c840":"#e06050";
  const TABS = ["Properties","Income & REPS","What-If","Cash Flow","Tax Summary"];

  return (
    <div style={{fontFamily:"'Syne',sans-serif",background:"#070c11",minHeight:"100vh",color:"#b8d0e0"}}>
      <style>{css}</style>

      {/* ── Sticky header ── */}
      <div style={{background:"#08101a",borderBottom:"1px solid #162230",padding:"12px 22px",position:"sticky",top:0,zIndex:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <span style={{fontFamily:"'Literata',serif",fontSize:20,color:"#5ab8f0",letterSpacing:1,fontStyle:"italic"}}>TaxZero</span>
          <span style={{fontSize:9,color:"#2a5a7a",marginLeft:10,letterSpacing:3,textTransform:"uppercase"}}>Property Tax Offset Engine</span>
        </div>
        <div style={{display:"flex",gap:20,alignItems:"center"}}>
          {[
            {l:"Properties",v:props.length},
            {l:"Doors",v:pCalcs.reduce((s,c)=>s+num(c.doors,1),0)},
            {l:"Annual Cash Flow",v:$f(T.totCF),col:T.totCF>=0?"#4af090":"#e06050"},
            {l:"Tax Saved",v:$f(T.taxSaved),col:"#f0c840"},
            {l:"Zeroed",v:T.zeroPct.toFixed(0)+"%",col:zColor},
          ].map(m=>(
            <div key={m.l} style={{textAlign:"right"}}>
              <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#2a5a7a"}}>{m.l}</div>
              <div style={{fontSize:15,fontFamily:"'Literata',serif",color:m.col||"#cfe0ee",lineHeight:1.1}}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{height:3,background:"#0a1018"}}>
        <div style={{height:"100%",width:`${T.zeroPct}%`,background:`linear-gradient(90deg,#1a5a8a,${zColor})`,transition:"width .4s"}}/>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:"flex",borderBottom:"1px solid #162230",background:"#08101a",padding:"0 22px",overflowX:"auto"}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} className="tabmb" style={{
            background:"none",border:"none",padding:"11px 16px",cursor:"pointer",
            fontSize:10,letterSpacing:"2px",textTransform:"uppercase",
            color:tab===i?"#5ab8f0":"#3a6a8a",
            borderBottom:tab===i?"2px solid #5ab8f0":"2px solid transparent",
            fontFamily:"inherit",fontWeight:tab===i?700:500,whiteSpace:"nowrap",
          }}>{t}</button>
        ))}
      </div>

      <div style={{maxWidth:920,margin:"0 auto",padding:"22px 22px 60px"}}>

        {/* ══════ TAB 0: PROPERTIES ══════ */}
        {tab===0&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontSize:11,color:"#2a6a8a"}}>{props.length} propert{props.length!==1?"ies":"y"} · {pCalcs.reduce((s,c)=>s+num(c.doors,1),0)} total doors</div>
              <button onClick={addProp} style={{background:"#0f2a3a",border:"1px solid #2a6a9a",color:"#5ab8f0",padding:"8px 18px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:10,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600}}>+ Add Property</button>
            </div>

            {pCalcs.map((c,idx)=>{
              const isOpen = expandedProp===c.id || props.length===1;
              return (
              <div key={c.id} className="card" style={{borderColor:c.taxableIncome<0?"#1a3a2a":"#2a1a1a"}}>
                {/* Header row — always visible */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setExpandedProp(isOpen?null:c.id)}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"'Literata',serif",fontSize:16,color:"#5ab8f0",fontStyle:"italic"}}>{c.name||`Property ${idx+1}`}</span>
                    <span className="tag" style={{background:c.taxableIncome<0?"#0a2018":"#200a0a",color:c.taxableIncome<0?"#4af090":"#e06050",border:`1px solid ${c.taxableIncome<0?"#1a4028":"#4a1818"}`}}>
                      {c.taxableIncome<0?`Loss ${$f(c.taxableIncome)}`:`Gain ${$f(c.taxableIncome)}`}
                    </span>
                    <span className="tag" style={{background:"#0a1a2a",color:"#5ab8f0",border:"1px solid #1a3a5a"}}>CF {$f(c.cashFlow)}/yr</span>
                    <span className="tag" style={{background:"#1a1a0a",color:"#c0a840",border:"1px solid #3a3a1a"}}>Cap {pct(c.capRate)}</span>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {props.length>1&&<button onClick={e=>{e.stopPropagation();delProp(c.id)}} style={{background:"none",border:"1px solid #2a1a1a",color:"#804040",padding:"4px 10px",borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>×</button>}
                    <span style={{fontSize:16,color:"#2a6a8a"}}>{isOpen?"▲":"▼"}</span>
                  </div>
                </div>

                {/* Expanded form */}
                {isOpen&&(
                <div style={{marginTop:18}}>
                  <SH c="Identity"/>
                  <div className="grid3">
                    <div><Lbl c="Name / Address"/><Inp v={c.name} on={e=>upd(c.id,"name",e.target.value)} ph="123 Oak St"/></div>
                    <div><Lbl c="Property Type"/>
                      <select className="inp" value={c.type} onChange={e=>upd(c.id,"type",e.target.value)}>
                        {PROP_TYPES.map(t=><option key={t.v} value={t.v}>{t.label}</option>)}
                      </select>
                    </div>
                    <div><Lbl c="Units / Doors"/><Inp type="number" v={c.doors} on={e=>upd(c.id,"doors",e.target.value)} ph="1"/></div>
                  </div>

                  <SH c="Valuation & Depreciable Basis"/>
                  <div className="grid3">
                    <div><Lbl c="Purchase Price"/><Inp type="number" v={c.purchasePrice} on={e=>upd(c.id,"purchasePrice",e.target.value)} ph="350,000"/></div>
                    <div><Lbl c="Land Value %"/><Inp type="number" v={c.landPct} on={e=>upd(c.id,"landPct",e.target.value)} ph="20" sfx="%"/></div>
                    <div><Lbl c="Depreciable Basis"/><Inp ro v={c.pp>0?$f(c.bldg):""} ph="—"/></div>
                  </div>
                  <div className="grid3">
                    <div><Lbl c="Loan Balance"/><Inp type="number" v={c.loanBalance} on={e=>upd(c.id,"loanBalance",e.target.value)} ph="280,000"/></div>
                    <div><Lbl c="Interest Rate"/><Inp type="number" v={c.interestRate} on={e=>upd(c.id,"interestRate",e.target.value)} ph="6.5" sfx="%"/></div>
                    <div><Lbl c="Annual Interest Ded."/><Inp ro v={c.interest>0?$f(c.interest):""} ph="—"/></div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <Lbl c="Estimated Equity (for refi/HELOC planning)"/>
                    <Inp type="number" v={c.equity} on={e=>upd(c.id,"equity",e.target.value)} ph="e.g. 120,000" w="220px"/>
                    {num(c.equity)>0&&<span style={{fontSize:11,color:"#3a7060",marginLeft:10}}>Tax-free cash available via cash-out refi or HELOC · deductible interest</span>}
                  </div>

                  <SH c="Rental Income"/>
                  <div className="grid3">
                    <div><Lbl c="Monthly Rent / Unit"/><Inp type="number" v={c.monthlyRent} on={e=>upd(c.id,"monthlyRent",e.target.value)} ph="1,800"/></div>
                    <div><Lbl c="Vacancy Rate"/><Inp type="number" v={c.vacancy} on={e=>upd(c.id,"vacancy",e.target.value)} ph="5" sfx="%"/></div>
                    <div><Lbl c="Effective Annual Rent"/><Inp ro v={c.effRent>0?$f(c.effRent):""} ph="—"/></div>
                  </div>

                  <SH c="Operating Expenses (Annual — All Deductible)"/>
                  <div className="grid3">
                    <div><Lbl c="Property Tax"/><Inp type="number" v={c.propTax} on={e=>upd(c.id,"propTax",e.target.value)} ph="3,600"/></div>
                    <div><Lbl c="Insurance"/><Inp type="number" v={c.insurance} on={e=>upd(c.id,"insurance",e.target.value)} ph="1,200"/></div>
                    <div><Lbl c="Repairs & Maintenance"/><Inp type="number" v={c.repairs} on={e=>upd(c.id,"repairs",e.target.value)} ph="2,400"/></div>
                  </div>
                  <div className="grid3">
                    <div><Lbl c="Utilities"/><Inp type="number" v={c.utilities} on={e=>upd(c.id,"utilities",e.target.value)} ph="0"/></div>
                    <div><Lbl c="Mgmt Fee"/><Inp type="number" v={c.mgmtPct} on={e=>upd(c.id,"mgmtPct",e.target.value)} ph="8" sfx="%"/></div>
                    <div><Lbl c="Other (legal, acctg, misc)"/><Inp type="number" v={c.other} on={e=>upd(c.id,"other",e.target.value)} ph="500"/></div>
                  </div>
                  <div style={{background:"#0a1418",borderRadius:5,padding:"8px 12px",fontSize:10,color:"#2a7a5a",marginBottom:12,lineHeight:1.7}}>
                    💡 Repairs vs. Improvements: Fixing what's broken (repair, fully deductible now) vs. adding value or extending life (improvement, must be capitalized below). IRS Safe Harbor: items ≤$2,500 each can be expensed immediately.
                  </div>

                  <SH c="Capital Improvements (Depreciated Over Time)"/>
                  <div className="grid3">
                    <div><Lbl c="Improvement Cost"/><Inp type="number" v={c.capImprovement} on={e=>upd(c.id,"capImprovement",e.target.value)} ph="15,000"/></div>
                    <div><Lbl c="Useful Life (yrs)"/><Inp type="number" v={c.capImprovLife} on={e=>upd(c.id,"capImprovLife",e.target.value)} ph="15"/></div>
                    <div><Lbl c="Annual Dep. From Improvement"/><Inp ro v={c.capImprovDep>0?$f(c.capImprovDep):""} ph="—"/></div>
                  </div>

                  <SH c="Section 179 / Personal Property (Appliances, Furniture, Equipment)"/>
                  <div className="grid2">
                    <div>
                      <Lbl c="Sec. 179 / Bonus Dep. on Personal Property"/>
                      <Inp type="number" v={c.sec179} on={e=>upd(c.id,"sec179",e.target.value)} ph="e.g. 8,000 for appliances"/>
                    </div>
                    <div style={{paddingTop:20,fontSize:11,color:"#3a7060",lineHeight:1.7}}>
                      Appliances, HVAC units, carpet, furniture — deductible 100% in year purchased under Sec. 179 or bonus dep. Doesn't require a cost seg study.
                    </div>
                  </div>

                  <SH c="Depreciation Accelerator — Cost Segregation"/>
                  <Tog on={c.costSeg} click={()=>upd(c.id,"costSeg",!c.costSeg)} label="Commissioned a Cost Segregation Study" badge="Biggest Single Lever" badgeColor="#f0c840"/>
                  {c.costSeg&&(
                    <div style={{background:"#0a1520",border:"1px solid #1a3040",borderRadius:7,padding:14,marginBottom:12}}>
                      <div className="grid3">
                        <div><Lbl c="% to Personal Property"/><Inp type="number" v={c.costSegPct} on={e=>upd(c.id,"costSegPct",e.target.value)} ph="25" sfx="%"/></div>
                        <div><Lbl c="Bonus Dep. Rate"/><Inp type="number" v={c.bonusPct} on={e=>upd(c.id,"bonusPct",e.target.value)} ph="60" sfx="%"/></div>
                        <div><Lbl c="Year-1 Bonus Dep."/><Inp ro v={c.bonusDep>0?$f(c.bonusDep):""} ph="—"/></div>
                      </div>
                      <div style={{fontSize:10,color:"#3a6a8a",lineHeight:1.7}}>On a ${c.pp>0?(c.pp/1000).toFixed(0)+"k":""} property, reclassifying {c.costSegPct}% to personal property eligible for {c.bonusPct}% bonus dep generates a year-1 deduction of ~{$f(c.bonusDep)}. Study cost: $5k–$15k. Must be completed before Dec 31.</div>
                    </div>
                  )}

                  <SH c="Prior Year Passive Losses (Carry Forward)"/>
                  <div className="grid2">
                    <div>
                      <Lbl c="Undeployed Passive Loss Carryforward"/>
                      <Inp type="number" v={c.priorPassiveLoss} on={e=>upd(c.id,"priorPassiveLoss",e.target.value)} ph="e.g. 18,000"/>
                    </div>
                    <div style={{paddingTop:20,fontSize:11,color:"#3a7060",lineHeight:1.7}}>
                      Unused passive losses from prior years carry forward indefinitely. They can offset future rental income, or release 100% when you sell the property.
                    </div>
                  </div>

                  {/* STR participation */}
                  {c.type==="str"&&(
                    <>
                      <SH c="STR Participation (Bypasses Passive Rules)"/>
                      <div className="note">STR (avg stay ≤7 days) losses offset W-2 directly with 500+ hrs of participation — no REPS needed. Best single strategy for high W-2 earners.</div>
                      <div className="grid2">
                        <div><Lbl c="Your Annual Hours in This STR"/><Inp type="number" v={c.strHours} on={e=>upd(c.id,"strHours",e.target.value)} ph="500"/></div>
                        <div style={{paddingTop:20}}>
                          <Tog on={c.materialPartic} click={()=>upd(c.id,"materialPartic",!c.materialPartic)}
                            label="Materially Participating"
                            badge={c.strQual?"✓ Qualified — W-2 Offset Unlocked":"Need 500+ hrs"}
                            badgeColor={c.strQual?"#4af090":"#e06050"}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Long-term active participation */}
                  {c.type!=="str"&&(
                    <>
                      <SH c="Active Participation — $25k Allowance"/>
                      <div className="note">If you make management decisions (approve tenants, set rents, select contractors) and own ≥10%, you qualify. Allows up to $25k of losses vs. ordinary income if MAGI ≤$100k (phases to zero at $150k).</div>
                      <Tog on={c.materialPartic} click={()=>upd(c.id,"materialPartic",!c.materialPartic)} label="I actively participate in this property"/>
                    </>
                  )}

                  {/* QBI */}
                  <SH c="QBI Deduction (20% Pass-Through)"/>
                  <Tog on={c.qbiEligible} click={()=>upd(c.id,"qbiEligible",!c.qbiEligible)}
                    label="Eligible for QBI Deduction (Sec. 199A)"
                    badge="Often Overlooked"
                    badgeColor="#5ab8f0"
                  />
                  {c.qbiEligible&&<div style={{fontSize:11,color:"#3a6a8a",lineHeight:1.7,marginBottom:10}}>When this property shows net rental income, 20% is deducted automatically. Requires a written rental agreement and 250+ rental hours/yr (or REPS). QBI this year: <strong style={{color:"#5ab8f0"}}>{$f(c.qbi)}</strong></div>}

                  {/* Property results */}
                  <div style={{borderTop:"1px solid #162230",marginTop:16,paddingTop:14,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                    {[
                      {l:"Gross Rent",v:$f(c.grossRent),col:"#cfe0ee"},
                      {l:"Total OpEx",v:$f(c.totalOpEx),col:"#cfe0ee"},
                      {l:"Interest",v:$f(c.interest),col:"#cfe0ee"},
                      {l:"Total Dep.",v:$f(c.totalDep),col:"#5ab8f0"},
                      {l:"Cash Flow",v:$f(c.cashFlow),col:c.cashFlow>=0?"#4af090":"#e06050"},
                      {l:"Taxable",v:$f(c.taxableIncome),col:c.taxableIncome<0?"#4af090":"#e06050"},
                    ].map(m=>(
                      <div key={m.l} style={{background:"#070c11",border:"1px solid #162230",borderRadius:5,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#2a5a7a",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>{m.l}</div>
                        <div style={{fontSize:13,fontFamily:"'Literata',serif",color:m.col}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            );})}
          </div>
        )}

        {/* ══════ TAB 1: INCOME & REPS ══════ */}
        {tab===1&&(
          <div>
            <div className="card">
              <SH c="Ordinary Income"/>
              <div className="grid3">
                <div><Lbl c="W-2 / Self-Employment"/><Inp type="number" v={w2} on={e=>setW2(e.target.value)} ph="200,000"/></div>
                <div><Lbl c="Other Income (dividends, interest)"/><Inp type="number" v={otherInc} on={e=>setOtherInc(e.target.value)} ph="0"/></div>
                <div><Lbl c="Filing Status"/>
                  <select className="inp" value={filing} onChange={e=>setFiling(e.target.value)}>
                    <option value="mfj">Married Filing Jointly</option>
                    <option value="single">Single</option>
                    <option value="hoh">Head of Household</option>
                  </select>
                </div>
              </div>
              {T.ordinary>0&&(
                <div style={{background:"#0a1018",border:"1px solid #162230",borderRadius:6,padding:12,marginTop:4}}>
                  <span style={{fontSize:11,color:"#3a6a8a"}}>Current bracket: </span>
                  <span style={{fontSize:14,fontFamily:"'Literata',serif",color:"#e06050"}}>{(T.bracket.rate*100).toFixed(0)}%</span>
                  <span style={{fontSize:11,color:"#3a6a8a",marginLeft:8}}>· Tax before RE: </span>
                  <span style={{fontSize:13,color:"#cfe0ee"}}>{$f(T.taxBefore)}</span>
                  {T.bracket.nextBracketAt<Infinity&&<span style={{fontSize:11,color:"#3a7060",marginLeft:8}}>· Drop to next bracket by offsetting {$f(T.taxableAfter-T.bracket.prev)}</span>}
                </div>
              )}
            </div>

            <div className="card">
              <SH c="Real Estate Professional Status (REPS) — Full W-2 Offset"/>
              <Tog on={isREP} click={()=>setIsREP(!isREP)} label="I (or my spouse) qualify as a Real Estate Professional" badge="Unlocks Everything" badgeColor="#f0c840"/>
              <div style={{background:"#080f18",border:"1px solid #162230",borderRadius:6,padding:14,marginBottom:12,fontSize:11,color:"#5a8aaa",lineHeight:1.8}}>
                <strong style={{color:"#5ab8f0"}}>Requirements:</strong> (1) &gt;50% of all personal services are in real estate trades/businesses AND (2) &gt;750 hrs/year in those activities.<br/>
                <strong style={{color:"#5ab8f0"}}>Effect:</strong> Every dollar of rental paper loss offsets W-2 directly. Combined with cost segregation, one property can zero $200k+ of W-2.<br/>
                <strong style={{color:"#5ab8f0"}}>Documentation:</strong> Keep a daily log — calendar entries, mileage, receipts. IRS audits REPS claims closely.
              </div>
              {isREP&&(
                <div style={{maxWidth:280}}>
                  <Lbl c="Hours in RE Activities This Year"/>
                  <Inp type="number" v={repHours} on={e=>setRepHours(e.target.value)} ph="751"/>
                  {num(repHours)>0&&num(repHours)<750&&<div style={{fontSize:10,color:"#e06050",marginTop:5}}>⚠ Need 750+ hours. Currently {repHours} hrs — {750-num(repHours)} short.</div>}
                  {num(repHours)>=750&&<div style={{fontSize:10,color:"#4af090",marginTop:5}}>✓ Hour threshold met — all passive losses unlock</div>}
                </div>
              )}
            </div>

            <div className="card">
              <SH c="How Your Losses Offset Income (Without REPS)"/>
              {[
                {t:"STR + 500 hrs Material Participation",col:"#4af090",d:"Non-passive losses — offset W-2 directly, no MAGI limit. Best path for high earners. Requires avg stay ≤7 days and 500+ hours of your personal service time per property."},
                {t:"$25k Active Participation Allowance",col:"#f0c840",d:"Long-term rental losses offset ordinary income up to $25k/year if MAGI ≤$100k. Phases out completely at $150k. Requires active management decisions (not just passive ownership)."},
                {t:"Prior Year Passive Loss Carryforwards",col:"#5ab8f0",d:"Unused passive losses from prior years are tracked per property. They offset future rental income in any year — or release 100% when the property is sold (even in a 1031 exchange proceeds can reset the basis for new dep)."},
                {t:"Passive Losses → Suspend Until Offset or Sale",col:"#8a8aa0",d:"Losses not covered by the above rules are suspended. They offset passive income from other rentals, or discharge when the property is disposed of. Not wasted — just deferred."},
              ].map(s=>(
                <div key={s.t} style={{borderLeft:`3px solid ${s.col}`,paddingLeft:14,marginBottom:14,paddingBottom:14,borderBottom:"1px solid #0f1820"}}>
                  <div style={{fontSize:12,color:s.col,marginBottom:5,fontWeight:600}}>{s.t}</div>
                  <div style={{fontSize:11,color:"#5a8090",lineHeight:1.7}}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ TAB 2: WHAT-IF ══════ */}
        {tab===2&&(
          <div>
            <div className="card">
              <SH c="New Property Purchase Simulator"/>
              <div className="note">Buying a new property in the current tax year creates an immediate depreciable basis. With cost seg + bonus dep + REPS, a single acquisition can generate enough paper loss to zero remaining income.</div>
              <div className="grid3">
                <div><Lbl c="Purchase Price"/><Inp type="number" v={simPrice} on={e=>setSimPrice(e.target.value)} ph="400,000"/></div>
                <div><Lbl c="Land Value %"/><Inp type="number" v={simLandPct} on={e=>setSimLandPct(e.target.value)} ph="20" sfx="%"/></div>
                <div><Lbl c="Year-1 Offset Generated"/><Inp ro v={T.simOffset>0?$f(T.simOffset):""} ph="—"/></div>
              </div>
              <Tog on={simCostSeg} click={()=>setSimCostSeg(!simCostSeg)} label="Apply Cost Seg + 60% Bonus Depreciation" badge="Recommended" badgeColor="#4af090"/>
              {simCostSeg&&<div style={{maxWidth:260,marginBottom:12}}><Lbl c="% Reclassified to Personal Property"/><Inp type="number" v={simCostSegPct} on={e=>setSimCostSegPct(e.target.value)} ph="25" sfx="%"/></div>}
              {T.simOffset>0&&(
                <div style={{background:"#080f18",border:"1px solid #1a3040",borderRadius:7,padding:14,display:"flex",gap:20,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:9,letterSpacing:2,color:"#2a6a8a",textTransform:"uppercase",marginBottom:4}}>Year-1 Paper Loss</div>
                    <div style={{fontSize:28,fontFamily:"'Literata',serif",color:"#5ab8f0"}}>{$f(T.simOffset)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,letterSpacing:2,color:"#2a6a8a",textTransform:"uppercase",marginBottom:4}}>Remaining After This Purchase</div>
                    <div style={{fontSize:28,fontFamily:"'Literata',serif",color:T.toZero-T.simOffset<=0?"#4af090":"#e06050"}}>{$f(Math.max(0,T.toZero-T.simOffset))}</div>
                  </div>
                  <div style={{fontSize:11,color:"#3a7060",paddingTop:8,lineHeight:1.7,flex:1}}>
                    {T.repQual?"✓ REPS active — offsets W-2 directly":"⚠ Requires REPS or STR to offset W-2. Enable REPS in Income tab."}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <SH c="All Tax Levers — Ranked by Impact"/>
              {[
                {lever:"Cost Segregation + Bonus Depreciation",impact:"Extreme",col:"#f0c840",d:"Reclassify 20–40% of building to 5–15yr personal property. 60% bonus dep (2024) on that portion. On a $500k property: ~$50k–$80k year-1 loss. Costs $5k–$15k for the study. ROI immediate. MUST close/complete before Dec 31.",when:"Oct–Dec"},
                {lever:"REPS Status",impact:"Extreme",col:"#f0c840",d:"Unlocks ALL passive losses against W-2. Requires 750 hrs + >50% of your working time in RE. Log every hour. One spouse qualifying covers both. Game-changing for physicians, executives, and high-earners with RE side.",when:"Year-round"},
                {lever:"STR Material Participation",impact:"Very High",col:"#5ab8f0",d:"Convert a property to STR (Airbnb, VRBO). Participate 500+ hrs. Losses bypass passive rules completely — offset W-2 without REPS. Even one STR can generate $30k–$60k of non-passive loss.",when:"Year-round"},
                {lever:"Mortgage Interest",impact:"High",col:"#4af090",d:"100% deductible on rentals — no $750k cap like primary homes. Cash-out refi or HELOC on equity pulls tax-free cash AND increases your interest deduction. Best time: when rates allow positive spread.",when:"Any time"},
                {lever:"Repairs & Maintenance",impact:"High",col:"#4af090",d:"All repairs fully deductible in the year incurred. IRS Safe Harbor allows items ≤$2,500 each to be expensed (not capitalized). Plan major repairs before Dec 31 to maximize current-year deductions.",when:"Nov–Dec"},
                {lever:"Section 179 / Personal Property",impact:"High",col:"#4af090",d:"Appliances, HVAC, carpet, furniture — 100% deductible year of purchase. No cost seg study needed. Buy the new water heater, washer/dryer, or smart locks before Dec 31.",when:"Oct–Dec"},
                {lever:"Insurance Premiums",impact:"Medium",col:"#8ad080",d:"All property insurance is deductible — landlord policy, umbrella, flood, liability. Review annually. Increase coverage on appreciated properties (and get the deduction). Add umbrella policy ($300–$500/yr, very deductible).",when:"Renewal"},
                {lever:"QBI Deduction (Sec. 199A)",impact:"Medium",col:"#8ad080",d:"20% of net rental income is deductible if you have a written rental agreement and 250+ rental hours/year (or REPS). Often missed. Requires proper recordkeeping — log all hours.",when:"Tax filing"},
                {lever:"Prior Year Passive Loss Carryforward",impact:"Medium",col:"#8ad080",d:"Track and deploy prior unused passive losses. They offset rental income in profitable years. Release 100% on property sale. Make sure your CPA is tracking these on Form 8582.",when:"Any year"},
                {lever:"1031 Exchange on Sale",impact:"Extreme (on exit)",col:"#f0c840",d:"Sell appreciated property, defer ALL capital gains + depreciation recapture by rolling into like-kind property within 45/180 days. Stack cost seg on the new property for fresh year-1 losses.",when:"Before listing"},
                {lever:"Depreciation Recapture Planning",impact:"High (risk)",col:"#e06050",d:"When you sell, the IRS recaptures ALL depreciation taken at 25% (Sec. 1250). On a $300k building held 10 yrs, that's ~$110k taxed at 25% = $27k extra tax. Mitigate with: 1031 exchange, dying with it (step-up in basis), or installment sale."},
              ].map(s=>(
                <div key={s.lever} style={{display:"flex",gap:12,borderBottom:"1px solid #0f1820",paddingBottom:12,marginBottom:12}}>
                  <div style={{width:70,flexShrink:0,paddingTop:3,textAlign:"center"}}>
                    <span className="tag" style={{background:s.col+"15",color:s.col,border:`1px solid ${s.col}30`}}>{s.impact}</span>
                    {s.when&&<div style={{fontSize:9,color:"#2a5a7a",marginTop:5,letterSpacing:0.5}}>{s.when}</div>}
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#b0cce0",fontWeight:600,marginBottom:4}}>{s.lever}</div>
                    <div style={{fontSize:11,color:"#4a7080",lineHeight:1.7}}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ TAB 3: CASH FLOW TIMELINE ══════ */}
        {tab===3&&(
          <div>
            <div className="card">
              <SH c="Monthly Cash Flow — Portfolio"/>
              <div style={{display:"flex",gap:0,alignItems:"flex-end",height:140,marginBottom:8,borderBottom:"1px solid #162230",paddingBottom:4}}>
                {T.monthlyCF.map((v,i)=>{
                  const max=Math.max(...T.monthlyCF.map(Math.abs),1);
                  const h=Math.abs(v)/max*120;
                  const pos=v>=0;
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:3,position:"relative"}}>
                      <div style={{fontSize:9,color:pos?"#4af090":"#e06050",letterSpacing:0.5,fontFamily:"'Literata',serif"}}>{v>0?"+":""}{v>=1000||v<=-1000?(v/1000).toFixed(1)+"k":v.toFixed(0)}</div>
                      <div style={{width:"60%",height:h,background:pos?"#1a4a2a":"#3a1a1a",borderRadius:"3px 3px 0 0",border:`1px solid ${pos?"#2a6a3a":"#5a2a2a"}`,minHeight:2}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:0}}>
                {MONTHS.map(m=><div key={m} style={{flex:1,textAlign:"center",fontSize:9,color:"#2a5a7a"}}>{m}</div>)}
              </div>
            </div>

            <div className="card">
              <SH c="Cumulative Cash Flow — When Can You Fund Improvements?"/>
              <div style={{display:"flex",gap:0,alignItems:"flex-end",height:120,marginBottom:8,borderBottom:"1px solid #162230",paddingBottom:4}}>
                {T.cumulativeCF.map((v,i)=>{
                  const max=Math.max(...T.cumulativeCF.map(Math.abs),1);
                  const h=Math.abs(v)/max*100;
                  const pos=v>=0;
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                      <div style={{fontSize:9,color:pos?"#4af090":"#e06050"}}>{v>=1000||v<=-1000?(v/1000).toFixed(1)+"k":v.toFixed(0)}</div>
                      <div style={{width:"70%",height:Math.max(h,2),background:pos?"#0a2a1a":"#2a0a0a",borderRadius:"3px 3px 0 0",border:`1px solid ${pos?"#1a4a2a":"#4a1a1a"}`}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:0}}>
                {MONTHS.map(m=><div key={m} style={{flex:1,textAlign:"center",fontSize:9,color:"#2a5a7a"}}>{m}</div>)}
              </div>
              <div style={{marginTop:12,fontSize:11,color:"#3a7060",lineHeight:1.8,background:"#0a1418",padding:"10px 14px",borderRadius:5}}>
                📊 Fund repairs and improvements when cumulative cash flow is positive. Best window for large-cap improvements: <strong style={{color:"#5ab8f0"}}>Q3 (Aug–Sep)</strong> — cash has built up, and you have time to complete work before Dec 31 for the deduction.
              </div>
            </div>

            <div className="card">
              <SH c="Tax Action Calendar — What to Do and When"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {YEAR_CALENDAR.map(p=>(
                  <div key={p.month} style={{background:"#080f18",border:"1px solid #162230",borderRadius:7,padding:14}}>
                    <div style={{fontSize:11,color:"#5ab8f0",fontWeight:700,letterSpacing:1,marginBottom:10}}>{p.month}</div>
                    {p.items.map(item=>(
                      <div key={item} style={{display:"flex",gap:8,marginBottom:7,fontSize:11,color:"#5a8090",lineHeight:1.5}}>
                        <span style={{color:"#2a6a8a",flexShrink:0}}>→</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <SH c="Year-End Deadline Checklist"/>
              {[
                {d:"Dec 31",item:"Cost seg study placed in service",note:"Property must be in service in the tax year for bonus dep to apply"},
                {d:"Dec 31",item:"All repairs completed & invoiced",note:"Deductible in year incurred — not when paid if on accrual"},
                {d:"Dec 31",item:"Sec. 179 / personal property purchased",note:"Appliances, equipment must be placed in service (installed & operational)"},
                {d:"Dec 31",item:"New property closed",note:"Must close escrow by Dec 31 for year-1 depreciation"},
                {d:"Dec 31",item:"Maximize STR hours if close to 500",note:"Log every hour — cleaning, guest comms, maintenance coordination"},
                {d:"Jan 15",item:"Q4 estimated tax payment",note:"Avoid underpayment penalty — adjust if RE offsets reduce liability"},
                {d:"Apr 15",item:"File taxes or extend",note:"6-month extension available — use it if cost seg study not yet finalized"},
              ].map(r=>(
                <div key={r.item} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr",gap:12,borderBottom:"1px solid #0f1820",padding:"10px 0",alignItems:"start"}}>
                  <span className="tag" style={{background:"#1a1a0a",color:"#f0c840",border:"1px solid #3a3a1a",fontSize:9}}>{r.d}</span>
                  <div style={{fontSize:12,color:"#a0c0d0",fontWeight:500}}>{r.item}</div>
                  <div style={{fontSize:11,color:"#3a6070"}}>{r.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ TAB 4: TAX SUMMARY ══════ */}
        {tab===4&&(
          <div>
            {/* Zero meter */}
            <div style={{background:"linear-gradient(135deg,#0a1520,#080f14)",border:"1px solid #1a3040",borderRadius:10,padding:22,marginBottom:20}}>
              <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"#2a6a8a",marginBottom:14}}>Tax Zero Progress</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12,color:"#4a7a8a",flexWrap:"wrap",gap:8}}>
                <span>Ordinary income: <span style={{color:"#cfe0ee"}}>{$f(T.ordinary)}</span></span>
                <span>RE offsets: <span style={{color:"#4af090"}}>−{$f(T.appliedOffset)}</span></span>
                <span>Still taxable: <span style={{color:T.taxableAfter===0?"#4af090":"#e06050"}}>{$f(T.taxableAfter)}</span></span>
              </div>
              <div style={{background:"#070c10",borderRadius:5,height:12,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:`${T.zeroPct}%`,background:`linear-gradient(90deg,#1a5a8a,${zColor})`,borderRadius:5,transition:"width .5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#2a5a7a"}}>
                <span>0%</span>
                <span style={{fontSize:14,fontFamily:"'Literata',serif",color:zColor,fontWeight:600}}>{T.zeroPct.toFixed(1)}% zeroed</span>
                <span>100%</span>
              </div>
              {T.toZero>0&&(
                <div style={{marginTop:12,background:"#0a1018",borderRadius:5,padding:"10px 14px",fontSize:11,color:"#6a9ab8",lineHeight:1.7}}>
                  Need <strong style={{color:"#f0c840"}}>{$f(T.toZero)}</strong> more in deductions to reach Tax Zero.
                  {!T.repQual&&" Enabling REPS would unlock all passive losses immediately."}
                </div>
              )}
              {T.taxableAfter===0&&T.ordinary>0&&(
                <div style={{marginTop:12,background:"#0a1a10",border:"1px solid #1a3a20",borderRadius:5,padding:"10px 14px",fontSize:12,color:"#4af090"}}>
                  ✓ Tax Zero achieved — your real estate deductions fully offset your ordinary income.
                </div>
              )}
            </div>

            {/* Tax comparison */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:20}}>
              <div className="statbox"><div className="sl">Tax Without RE</div><div className="sv" style={{color:"#e06050"}}>{$f(T.taxBefore)}</div></div>
              <div className="statbox"><div className="sl">Tax With RE Offsets</div><div className="sv" style={{color:"#cfe0ee"}}>{$f(T.taxAfter)}</div></div>
              <div className="statbox"><div className="sl">Total Tax Saved</div><div className="sv" style={{color:"#f0c840"}}>{$f(T.taxSaved)}</div></div>
              <div className="statbox"><div className="sl">Effective Rate</div><div className="sv" style={{color:T.effectiveRate<0.15?"#4af090":T.effectiveRate<0.25?"#f0c840":"#e06050"}}>{pct(T.effectiveRate)}</div></div>
            </div>

            {/* Bracket visualizer */}
            {T.ordinary>0&&(
              <div className="card" style={{marginBottom:14}}>
                <SH c="Tax Bracket Visualizer"/>
                {(filing==="mfj"?TAX_BRACKETS_MFJ:TAX_BRACKETS_SINGLE).map((b,i,arr)=>{
                  const low = i===0?0:arr[i-1].up;
                  const high = b.up===Infinity?Math.max(T.ordinary,T.taxableAfter)+10000:b.up;
                  const incomeInBracket = Math.max(0,Math.min(T.ordinary,high)-low);
                  const afterInBracket  = Math.max(0,Math.min(T.taxableAfter,high)-low);
                  if (incomeInBracket<=0&&afterInBracket<=0) return null;
                  const maxW=Math.max(incomeInBracket,afterInBracket);
                  return (
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#3a6a8a",marginBottom:4}}>
                        <span style={{fontWeight:600,color:b.rate>=0.32?"#e06050":b.rate>=0.24?"#f0c840":"#4af090"}}>{(b.rate*100).toFixed(0)}% bracket</span>
                        <span>{$f(low)} – {b.up===Infinity?"∞":$f(b.up)}</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:9,color:"#4a7080",width:70}}>Before RE</div>
                          <div style={{height:14,width:`${(incomeInBracket/maxW)*100}%`,minWidth:2,background:"#3a1a1a",borderRadius:2,border:"1px solid #5a2a2a",transition:"width .4s"}}/>
                          <div style={{fontSize:10,color:"#e06050"}}>{$f(incomeInBracket)}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:9,color:"#4af090",width:70}}>After RE</div>
                          <div style={{height:14,width:`${(afterInBracket/maxW)*100}%`,minWidth:afterInBracket>0?2:0,background:"#0a2a1a",borderRadius:2,border:afterInBracket>0?"1px solid #1a4a2a":"none",transition:"width .4s"}}/>
                          <div style={{fontSize:10,color:"#4af090"}}>{$f(afterInBracket)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            )}

            {/* Deduction breakdown */}
            <div className="card">
              <SH c="Full Deduction Breakdown"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[
                  {l:"Effective Rent Collected",v:$f(T.totRent),c:"#cfe0ee",n:"After vacancy"},
                  {l:"Operating Expenses",v:$f(T.totOpEx),c:"#cfe0ee",n:"Tax, ins, repairs, mgmt"},
                  {l:"Mortgage Interest",v:$f(T.totInt),c:"#cfe0ee",n:"100% deductible"},
                  {l:"Total Depreciation",v:$f(T.totDep),c:"#5ab8f0",n:"Straight-line + bonus + Sec 179"},
                  {l:"QBI Deduction (20%)",v:$f(T.totQBI),c:"#5ab8f0",n:"Sec. 199A pass-through"},
                  {l:"Prior Passive Carryforwards",v:$f(pCalcs.reduce((s,c)=>s+c.priorLoss,0)),c:"#5ab8f0",n:"From prior years"},
                  {l:"Total Deductions",v:$f(T.totalDeductions),c:"#f0c840",n:"All categories combined"},
                  {l:"Portfolio Cash Flow",v:$f(T.totCF),c:T.totCF>=0?"#4af090":"#e06050",n:"Actual cash in pocket"},
                ].map(m=>(
                  <div key={m.l} style={{background:"#070c11",border:"1px solid #162230",borderRadius:6,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"#2a5a7a",letterSpacing:1.5,textTransform:"uppercase",marginBottom:2}}>{m.l}</div>
                    <div style={{fontSize:17,fontFamily:"'Literata',serif",color:m.c,marginBottom:2}}>{m.v}</div>
                    <div style={{fontSize:10,color:"#2a6a5a"}}>{m.n}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Depreciation recapture warning */}
            <div style={{background:"#160a0a",border:"1px solid #3a1a1a",borderRadius:8,padding:16,marginBottom:14}}>
              <div style={{fontSize:11,color:"#e06050",fontWeight:600,marginBottom:8}}>⚠ Depreciation Recapture — Plan Now, Not Later</div>
              <div style={{fontSize:11,color:"#7a4a4a",lineHeight:1.8}}>
                When you sell, the IRS taxes all depreciation taken at <strong style={{color:"#e08060"}}>25% (Sec. 1250 recapture)</strong> — regardless of your bracket.
                Total depreciation taken across portfolio: <strong style={{color:"#f0c840"}}>{$f(T.totDep)}</strong>/yr.
                <br/>Mitigation: <span style={{color:"#c07060"}}>1031 Exchange</span> (defer indefinitely) · <span style={{color:"#c07060"}}>Die holding it</span> (step-up in basis eliminates recapture) · <span style={{color:"#c07060"}}>Installment sale</span> (spread recapture over years).
              </div>
            </div>

            {/* Dynamic action items */}
            <div className="card">
              <SH c="Your Personalized Next Steps"/>
              {[
                T.toZero>0&&!T.repQual&&{step:"Enable REPS to unlock remaining "+$f(T.toZero)+" in offsets",urgent:true,d:"Track and document hours now. If you or your spouse can hit 750 hrs in RE activities this year, every pending passive loss deploys against your W-2."},
                T.toZero>0&&{step:"Commission a cost seg study on your highest-value property",urgent:true,d:`A study on your largest property could generate ${$f(T.toZero)} or more in year-1 deductions — eliminating your remaining taxable income. Must be ordered and completed before Dec 31.`},
                pCalcs.some(c=>c.type!=="str"&&!c.materialPartic)&&{step:"Enable active participation on all long-term rentals",urgent:false,d:"Check the 'actively participate' toggle on each long-term rental. If your MAGI is under $150k, this unlocks up to $25k/yr of losses against ordinary income."},
                !pCalcs.some(c=>c.type==="str")&&{step:"Evaluate converting or acquiring one STR",urgent:false,d:"A single short-term rental where you materially participate can produce $30k–$60k of non-passive losses that offset W-2 without REPS — the best option for high earners."},
                pCalcs.some(c=>c.qbiEligible&&c.qbi===0&&c.effRent>0)&&{step:"Verify QBI eligibility and hours documentation",urgent:false,d:"20% of net rental income is tax-free under Sec. 199A. Requires 250+ rental hours/year logged and a written lease. Often missed — worth $2k–$10k+ per property."},
                {step:"Review repairs vs. improvements before Dec 31",urgent:false,d:"Any repair under $2,500 can be expensed immediately. Plan and complete routine maintenance before year-end. Communicate Safe Harbor policy to your CPA."},
              ].filter(Boolean).map((s,i)=>(
                <div key={i} style={{display:"flex",gap:12,borderBottom:"1px solid #0f1820",paddingBottom:12,marginBottom:12}}>
                  <span style={{color:s.urgent?"#f0c840":"#2a7a5a",fontSize:14,flexShrink:0,marginTop:1}}>{s.urgent?"!":"→"}</span>
                  <div>
                    <div style={{fontSize:12,color:s.urgent?"#f0c840":"#a0c0d0",fontWeight:600,marginBottom:3}}>{s.step}</div>
                    <div style={{fontSize:11,color:"#3a6070",lineHeight:1.7}}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{fontSize:10,color:"#1e3a4a",lineHeight:1.8,padding:"12px 14px",background:"#070c10",borderRadius:6,border:"1px solid #162230"}}>
              ⚠ Educational tool — not tax advice. Actual tax calculations require Form 8582, Sec. 469, Sec. 199A, and state-specific rules. Depreciation recapture, AMT, NIIT (3.8% on passive income above thresholds), and carryforward rules are simplified. Consult a CPA or tax attorney specializing in real estate investors before implementing any strategy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
