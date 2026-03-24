import { useState, useMemo, useRef, useEffect, createContext, useContext, useCallback } from "react";
import SoC from "./data/standard-treatments.json";
import DRUGS from "./data/drugs.json";
import EVENTS from "./data/events.json";
import JP_OUTLOOK from "./data/jp-outlook.json";
import LANDSCAPE from "./data/landscape.json";
import TIMELINE from "./data/timeline.json";
import CHANGELOG from "./data/changelog.json";
import ALGO from "./data/treatment-algorithm.json";
import _constants from "./data/constants.json";
import GLOSSARY from "./data/glossary.json";
import CostSimulator from "./components/CostSimulator.jsx";
import HistoryTimeline from "./components/HistoryTimeline.jsx";
import REGIMENS from "./data/regimens.json";

const { S, SC, SB, MOA_CAT_LABELS, STAGE_STYLE, stColors, subColors } = _constants;
const NavContext = createContext(null);
const UPDATED = "2026年3月25日";

function Chip({text,color,bg}){return <span style={{fontSize:11,fontWeight:600,color,background:bg,padding:"2px 8px",borderRadius:999,whiteSpace:"nowrap",display:"inline-block"}}>{text}</span>}
function StatusChip({s}){return <Chip text={S[s]||s} color={s==="ok"?"#15803d":s==="rev"?"#1d4ed8":s==="no"?"#94a3b8":"#374151"} bg={SB[s]||"#f1f5f9"}/>}
function SubChip({t}){
  const c={"HR+/HER2-":{c:"#9333ea",b:"#f3e8ff"},"HER2+":{c:"#0369a1",b:"#e0f2fe"},"TNBC":{c:"#dc2626",b:"#fee2e2"},"HER2-low":{c:"#b45309",b:"#fef3c7"}};
  const x=c[t]||{c:"#374151",b:"#f3f4f6"};
  return <Chip text={t} color={x.c} bg={x.b}/>
}

function DrugLink({generic,label,subtle}){
  const nav=useContext(NavContext);
  if(!nav)return <span>{label||generic}</span>;
  const drug=DRUGS.find(d=>d.generic===generic);
  const display=label||(drug?drug.name:generic);
  const st=subtle?{cursor:"pointer"}:{color:"#2563eb",cursor:"pointer",borderBottom:"1px dashed #93c5fd",fontWeight:500};
  return <span onClick={(e)=>{e.stopPropagation();nav.goToDrug(generic);}} style={st} title={drug?`${drug.name} (${drug.generic}) — クリックで詳細`:""}>{display}</span>;
}

function TrialLink({trial,label}){
  const nav=useContext(NavContext);
  if(!nav)return <span>{label||trial}</span>;
  const t=TIMELINE.find(t=>t.trial===trial);
  const display=label||trial;
  return <span onClick={(e)=>{e.stopPropagation();nav.goToTrial(trial);}} style={{color:"#7c3aed",cursor:"pointer",borderBottom:"1px dashed #c4b5fd",fontWeight:500}} title={t?`${t.trial}: ${t.pop}`:""}>{display}</span>;
}

function LifecycleBar({lc}){
  if(!lc||!lc.length)return null;
  const mn=Math.min(...lc.map(p=>p.s));
  const mx=Math.max(...lc.map(p=>p.e));
  const span=mx-mn;
  const now=2026.22;
  const pct=v=>((v-mn)/span*100);
  return(
    <div style={{margin:"8px 0 4px",position:"relative"}}>
      <div style={{fontSize:11,fontWeight:600,color:"#334155",marginBottom:4}}>ライフサイクル</div>
      <div style={{position:"relative",height:26,background:"#f8fafc",borderRadius:4,overflow:"visible"}}>
        {lc.map((p,i)=>(
          <div key={i} title={p.t} style={{position:"absolute",left:pct(p.s)+"%",width:(pct(p.e)-pct(p.s))+"%",height:"100%",background:p.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,color:p.tc,overflow:"hidden",whiteSpace:"nowrap",borderRight:"1px solid rgba(255,255,255,0.5)",borderRadius:i===0?"4px 0 0 4px":i===lc.length-1?"0 4px 4px 0":"0"}}>{(pct(p.e)-pct(p.s))>10?p.t:""}</div>
        ))}
        {now>=mn&&now<=mx&&(
          <div style={{position:"absolute",left:pct(now)+"%",top:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",transform:"translateX(-50%)"}}>
            <div style={{width:2,height:26,background:"#dc2626"}}/>
            <span style={{fontSize:9,fontWeight:700,color:"#dc2626",marginTop:1,whiteSpace:"nowrap"}}>現在</span>
          </div>
        )}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#94a3b8",marginTop:10}}>
        <span>{Math.floor(mn)}</span>
        <span>{Math.floor(mx)}</span>
      </div>
    </div>
  );
}

function DrugCard({d,focusDrug,onFocusClear}){
  const [open,setOpen]=useState(false);
  const cardRef=useRef(null);
  const isFocused=focusDrug&&d.generic===focusDrug;
  useEffect(()=>{
    if(isFocused){
      setOpen(true);
      setTimeout(()=>cardRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
      if(onFocusClear)setTimeout(()=>onFocusClear(),1500);
    }
  },[isFocused]);
  return (
    <div ref={cardRef} data-drug={d.generic} style={{background:"#fff",borderRadius:12,border:isFocused?"2px solid #2563eb":"1px solid #e2e8f0",marginBottom:10,overflow:"hidden",boxShadow:open?"0 4px 12px rgba(0,0,0,0.08)":"0 1px 3px rgba(0,0,0,0.04)",transition:"box-shadow .2s, border .3s"}}>
      <div onClick={()=>setOpen(!open)} style={{padding:"14px 18px",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span><span style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{d.name}</span>{d.generic&&<span style={{fontSize:11,color:"#94a3b8",marginLeft:6}}>({d.generic})</span>}{d.isNew&&<span style={{fontSize:10,fontWeight:700,color:"#fff",background:"#ef4444",borderRadius:4,padding:"1px 5px",marginLeft:6,animation:"pulse 2s infinite"}}>NEW</span>}</span>
          <span style={{fontSize:12,color:"#64748b"}}>{d.co}</span>
          <span style={{fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>{d.cls}</span>
          <span style={{display:"flex",gap:4,marginLeft:"auto",alignItems:"center",flexWrap:"wrap"}}>
            {!d.indications&&<><span style={{fontSize:10}}>🇺🇸</span><StatusChip s={d.us.s}/><span style={{fontSize:10}}>🇪🇺</span><StatusChip s={d.eu.s}/><span style={{fontSize:10}}>🇯🇵</span><StatusChip s={d.jp.s}/></>}
            {d.indications&&<span style={{fontSize:11,color:"#64748b"}}>適応{d.indications.length}件</span>}
          </span>
          <span style={{fontSize:18,color:"#94a3b8",transform:open?"rotate(180deg)":"rotate(0)",transition:"transform .2s"}}>▾</span>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>{d.sub.map((s,i)=><SubChip key={i} t={s}/>)}</div>
      </div>
      {open&&(
        <div style={{padding:"0 18px 16px",borderTop:"1px solid #f1f5f9"}}>
          <p style={{fontSize:12,color:"#475569",margin:"10px 0 6px"}}><strong>作用機序:</strong> {d.moa}</p>
          {d.pat&&<div style={{fontSize:12,color:"#7c2d12",margin:"4px 0 8px",padding:"5px 10px",background:"#fff7ed",borderRadius:6,border:"1px solid #fed7aa"}}><strong>特許/独占権:</strong> {d.pat}</div>}

          <LifecycleBar lc={d.lc}/>

          {/* 有害事象 */}
          {d.ae&&(
            <div style={{margin:"8px 0",padding:"8px 12px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#991b1b",marginBottom:4}}>主な有害事象</div>
              <div style={{fontSize:11,color:"#7f1d1d",lineHeight:1.7}}>
                <div><strong>高頻度:</strong> {d.ae.freq}</div>
                <div><strong>重篤:</strong> {d.ae.severe}</div>
                <div style={{color:"#92400e",marginTop:2}}><strong>注意点:</strong> {d.ae.note}</div>
              </div>
            </div>
          )}

          {/* 承認状況 */}
          {d.indications?(
            <div style={{margin:"8px 0",overflowX:"auto"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#334155",marginBottom:4}}>承認状況（適応別）</div>
              <table style={{width:"100%",fontSize:11,borderCollapse:"collapse",minWidth:500}}>
                <thead><tr style={{background:"#f8fafc"}}><th style={{textAlign:"left",padding:"4px 8px",color:"#64748b"}}>適応</th><th style={{padding:"4px 8px"}}>🇺🇸 FDA</th><th style={{padding:"4px 8px"}}>🇪🇺 EMA</th><th style={{padding:"4px 8px"}}>🇯🇵 PMDA</th></tr></thead>
                <tbody>{d.indications.map((ind,i)=>(
                  <tr key={i} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"4px 8px",fontWeight:600}}>{ind.label}</td>
                    {[ind.us,ind.eu,ind.jp].map((x,j)=>(
                      <td key={j} style={{padding:"4px 8px",textAlign:"center"}}><StatusChip s={x.s}/><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{x.url?<a href={x.url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",textDecoration:"underline"}}>{x.t}</a>:x.t}</div></td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"8px 0"}}>
              {[{k:"us",l:"🇺🇸 FDA"},{k:"eu",l:"🇪🇺 EMA"},{k:"jp",l:"🇯🇵 PMDA"}].map(({k,l})=>(
                <div key={k} style={{background:SB[d[k].s],borderRadius:8,padding:"8px 12px",borderLeft:`3px solid ${SC[d[k].s]}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#475569"}}>{l}</div>
                  <StatusChip s={d[k].s}/>
                  <div style={{fontSize:11,color:"#334155",marginTop:4}}>{d[k].url?<a href={d[k].url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",textDecoration:"underline"}}>{d[k].t}</a>:d[k].t}</div>
                </div>
              ))}
            </div>
          )}

          {/* 主要な研究（前臨床〜Phase III） */}
          {d.studies.length>0&&(
            <div style={{margin:"8px 0",overflowX:"auto"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#334155",marginBottom:4}}>主要な研究</div>
              <table style={{width:"100%",fontSize:11,borderCollapse:"collapse",minWidth:800}}>
                <thead><tr style={{background:"#f8fafc"}}>{["研究名","相","対象","試験治療","対照","結果","状態","出典"].map((h,i)=><th key={i} style={{textAlign:"left",padding:"3px 6px",color:"#64748b"}}>{h}</th>)}</tr></thead>
                <tbody>{d.studies.map((t,i)=>(
                  <tr key={i} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"3px 6px",fontWeight:600}}>{TIMELINE.some(tl=>tl.trial===t.n)?<TrialLink trial={t.n}/>:t.n}</td>
                    <td style={{padding:"3px 6px"}}>{t.ph}</td>
                    <td style={{padding:"3px 6px"}}>{t.pop}</td>
                    <td style={{padding:"3px 6px",color:"#1d4ed8"}}>{t.arm||"-"}</td>
                    <td style={{padding:"3px 6px",color:"#64748b"}}>{t.ctrl||"-"}</td>
                    <td style={{padding:"3px 6px"}}>{t.res}</td>
                    <td style={{padding:"3px 6px"}}><span style={{color:t.st==="pos"?"#16a34a":t.st==="neg"?"#dc2626":t.st==="na"?"#9ca3af":"#2563eb",fontWeight:600}}>{t.st==="pos"?"✓ Pos":t.st==="neg"?"✗ Neg":t.st==="na"?"—":"⏳"}</span></td>
                    <td style={{padding:"3px 6px"}}>{t.url?<a href={t.url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",textDecoration:"underline"}}>{t.pr||"Link"}</a>:(t.pr||"-")}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div style={{fontSize:12,color:"#0f172a",marginTop:8,padding:"6px 10px",background:"#fffbeb",borderRadius:6,border:"1px solid #fde68a"}}>
            <strong>次のマイルストーン:</strong> {d.next}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 標準治療タブ全体 =====
function SocTabContent(){
  const [socView,setSocView]=useState("algo");
  return(
    <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
      <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#0f172a"}}>日本の標準治療　2026年3月時点</h2>
      <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>日本乳癌学会GL 2022 + WEB改訂 + 2024-2026年新薬承認を反映</p>
      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content",marginBottom:20}}>
        <button onClick={()=>setSocView("algo")} style={{padding:"6px 16px",borderRadius:6,border:"none",background:socView==="algo"?"#fff":"transparent",color:socView==="algo"?"#0f172a":"#64748b",cursor:"pointer",fontSize:12,fontWeight:socView==="algo"?700:400,boxShadow:socView==="algo"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>治療アルゴリズム</button>
        <button onClick={()=>setSocView("list")} style={{padding:"6px 16px",borderRadius:6,border:"none",background:socView==="list"?"#fff":"transparent",color:socView==="list"?"#0f172a":"#64748b",cursor:"pointer",fontSize:12,fontWeight:socView==="list"?700:400,boxShadow:socView==="list"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>レジメン一覧</button>
      </div>
      {socView==="algo"?<TreatmentAlgorithm/>:<StandardOfCare/>}
    </div>
  );
}

// ===== 治療アルゴリズム =====
const ALGO_COLORS={green:"#22c55e",amber:"#f59e0b",pink:"#ec4899",purple:"#a78bfa",cyan:"#06b6d4"};
const ALGO_SUB_STYLE={
  hr_her2neg:{color:ALGO_COLORS.green,bg:"rgba(34,197,94,0.1)",border:"rgba(34,197,94,0.3)"},
  her2pos:{color:ALGO_COLORS.amber,bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.3)"},
  tnbc:{color:ALGO_COLORS.pink,bg:"rgba(236,72,153,0.1)",border:"rgba(236,72,153,0.3)"},
  her2low:{color:ALGO_COLORS.purple,bg:"rgba(167,139,250,0.1)",border:"rgba(167,139,250,0.3)"}
};
const PHASE_COLOR_MAP={green:ALGO_COLORS.green,amber:ALGO_COLORS.amber,cyan:ALGO_COLORS.cyan};

function AlgoStepCard({step,sc}){
  const [open,setOpen]=useState(false);
  const bl=step.highlight?sc:step.standard?"#cbd5e1":"#06b6d4";
  const bg=step.highlight?`${sc}08`:"transparent";
  return(
    <div onClick={()=>setOpen(!open)} style={{padding:"10px 14px",borderLeft:`3px solid ${bl}`,background:bg,borderRadius:"0 6px 6px 0",cursor:"pointer",marginBottom:6}} onMouseEnter={e=>{e.currentTarget.style.background=`${sc}0a`}} onMouseLeave={e=>{e.currentTarget.style.background=bg}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {step.standard?<span style={{color:ALGO_COLORS.green,fontSize:11,fontWeight:700}}>標準</span>:<span style={{color:ALGO_COLORS.cyan,fontSize:11,fontWeight:700}}>開発中</span>}
        {step.optional&&<span style={{color:"#94a3b8",fontSize:10}}>（選択的）</span>}
        {step.highlight&&<span style={{fontSize:10,color:sc}}>★</span>}
        <span style={{fontSize:13,fontWeight:600,color:"#0f172a",lineHeight:1.4}}>{step.name}</span>
        <span style={{color:"#94a3b8",fontSize:11,marginLeft:"auto",flexShrink:0}}>{open?"▲":"▼"}</span>
      </div>
      {open&&<div style={{marginTop:8,padding:"8px 10px",background:"#f1f5f9",borderRadius:4,color:"#475569",fontSize:12,lineHeight:1.6}}>{step.detail}</div>}
    </div>
  );
}

function TreatmentAlgorithm(){
  const nav=useContext(NavContext);
  const [activeSubtype,setActiveSubtype]=useState("hr_her2neg");
  const [activeSetting,setActiveSetting]=useState("periop");
  const st=ALGO_SUB_STYLE[activeSubtype];
  const stInfo=ALGO.subtypes.find(s=>s.id===activeSubtype);
  const data=ALGO.treatments[activeSubtype]?.[activeSetting];

  return(
    <div>
      {/* Subtype selector */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"#64748b",marginBottom:8,fontWeight:600}}>サブタイプ選択</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ALGO.subtypes.map(s=>{
            const ss=ALGO_SUB_STYLE[s.id];
            const active=activeSubtype===s.id;
            return(<button key={s.id} onClick={()=>setActiveSubtype(s.id)} style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${active?ss.color:"#e2e8f0"}`,background:active?ss.bg:"#fff",color:active?ss.color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:active?700:500,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2}}>
              <span>{s.label}</span><span style={{fontSize:10,opacity:0.7}}>{s.pct}</span>
            </button>);
          })}
        </div>
      </div>

      {/* Setting selector */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
          {ALGO.settings.map(s=>(
            <button key={s.id} onClick={()=>setActiveSetting(s.id)} style={{padding:"7px 16px",borderRadius:6,border:"none",background:activeSetting===s.id?st.bg:"transparent",color:activeSetting===s.id?st.color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:activeSetting===s.id?700:500}}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* HER2-low note */}
      {activeSubtype==="her2low"&&(
        <div style={{padding:"12px 16px",background:ALGO_SUB_STYLE.her2low.bg,border:`1px solid ${ALGO_SUB_STYLE.her2low.border}`,borderRadius:8,marginBottom:16,fontSize:12,color:ALGO_COLORS.purple,lineHeight:1.6}}>
          <strong>※ HER2低発現（HER2-low）</strong>はHR+/HER2−やTNBCに横断的に存在するカテゴリーです（全乳癌の約50-60%）。IHC 1+ または IHC 2+/ISH− で定義されます。T-DXdの有効性が示されたことで治療選択に重要な意味を持つようになりました。
        </div>
      )}

      {data&&(
        <div>
          {/* Title card */}
          <div style={{padding:16,background:st.bg,border:`1px solid ${st.border}`,borderRadius:8,marginBottom:20}}>
            <h3 style={{fontSize:16,fontWeight:800,color:st.color,margin:"0 0 6px"}}>{data.title}</h3>
            <p style={{fontSize:12,color:"#64748b",margin:0,lineHeight:1.6}}>{data.desc}</p>
          </div>

          {/* Flow */}
          {data.flow.map((block,i)=>(
            <div key={i} style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`${st.color}20`,border:`2px solid ${st.color}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:st.color,flexShrink:0}}>{i+1}</div>
                <span style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{block.phase}</span>
              </div>
              <div style={{marginLeft:14,borderLeft:`1px dashed #e2e8f0`,paddingLeft:20}}>
                {block.steps.map((s,j)=><AlgoStepCard key={j} step={s} sc={st.color}/>)}
              </div>
            </div>
          ))}

          {/* Pipeline */}
          {data.pipeline&&data.pipeline.length>0&&(
            <div style={{marginTop:24,padding:16,background:"rgba(6,182,212,0.06)",border:"1px solid rgba(6,182,212,0.2)",borderRadius:8}}>
              <div style={{fontSize:13,fontWeight:700,color:ALGO_COLORS.cyan,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14}}>🔬</span>ここに新薬が入る可能性（開発中パイプライン）
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.pipeline.map((d,i)=>{
                  const pc=PHASE_COLOR_MAP[d.color]||"#94a3b8";
                  return(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 10px",background:"#f8fafc",borderRadius:6,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,color:pc,background:`${pc}18`,border:`1px solid ${pc}40`}}>{d.phase}</span>
                        {(()=>{const dr=DRUGS.find(x=>x.name.includes(d.drug)||x.generic===d.drug);return dr?<span onClick={e=>{e.stopPropagation();nav.goToDrug(dr.generic)}} style={{fontSize:13,fontWeight:700,color:"#0f172a",cursor:"pointer"}}>{d.drug}</span>:<span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{d.drug}</span>})()}
                      </div>
                      {(()=>{const tl=TIMELINE.find(x=>x.trial===d.trial.split("/")[0]);return tl?<span onClick={e=>{e.stopPropagation();nav.goToTrial(tl.trial)}} style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",cursor:"pointer"}}>{d.trial}</span>:<span style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace"}}>{d.trial}</span>})()}
                      {d.resultUrl&&<a href={d.resultUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#059669",textDecoration:"none"}}>📄{d.resultRef||"結果"}</a>}
                      <span style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>{d.note}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{marginTop:20,padding:"10px 16px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",display:"flex",flexWrap:"wrap",gap:16,fontSize:11,color:"#64748b"}}>
            <span><span style={{color:ALGO_COLORS.green}}>■ 標準</span> = GL推奨</span>
            <span><span style={{color:ALGO_COLORS.cyan}}>■ 開発中</span> = 未承認（日本）</span>
            <span><span style={{color:st.color}}>★</span> = 近年の重要な変化</span>
            <span>▼ クリックで詳細</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{marginTop:24,paddingTop:12,borderTop:"1px solid #e2e8f0",fontSize:10,color:"#94a3b8",lineHeight:1.7}}>
        <p style={{margin:"0 0 4px"}}>出典: 乳癌診療ガイドライン2022年版（2024年3月Web改訂）、NCCN Guidelines Breast Cancer v1.2026、各薬剤添付文書、ASCO/ESMO/SABCS 2025-2026</p>
        <p style={{margin:0}}>本アルゴリズムは教育・情報提供目的です。治療方針決定には必ず担当医にご相談ください。</p>
      </div>
    </div>
  );
}

// ===== 標準治療タブ =====
function StandardOfCare(){
  const [subFilter,setSubFilter]=useState("ALL");
  const subs=["ALL","HR+/HER2-","HER2+","TNBC"];
  const filtered=subFilter==="ALL"?SoC:SoC.filter(s=>s.sub===subFilter);
  const subColors={"HR+/HER2-":"#7c3aed","HER2+":"#0369a1","TNBC":"#dc2626"};
  return(
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {subs.map(s=>(
          <button key={s} onClick={()=>setSubFilter(s)} style={{fontSize:12,padding:"4px 14px",borderRadius:999,border:subFilter===s?"2px solid #7c3aed":"1px solid #e2e8f0",background:subFilter===s?"#ede9fe":"#fff",color:subFilter===s?"#7c3aed":"#475569",cursor:"pointer",fontWeight:subFilter===s?700:400}}>{s}</button>
        ))}
      </div>
      {filtered.map((block,bi)=>(
        <div key={bi} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:14,fontWeight:700,color:subColors[block.sub]||"#0f172a"}}>{block.sub}</span>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a",padding:"2px 10px",background:block.setting.includes("EBC")?"#dcfce7":"#dbeafe",borderRadius:999}}>{block.setting}</span>
          </div>
          {block.lines.map((ln,li)=>(
            <div key={li} style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 16px",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:6}}>{ln.line}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
                {ln.regimens.map((r,ri)=>(
                  <span key={ri} style={{fontSize:11,padding:"4px 10px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,color:"#334155",lineHeight:1.4}}>{r}</span>
                ))}
              </div>
              {ln.note&&<div style={{fontSize:11,color:"#64748b",lineHeight:1.6,paddingLeft:4}}>{ln.note}</div>}
            </div>
          ))}
        </div>
      ))}
      <div style={{padding:"12px 16px",background:"#fffbeb",borderRadius:8,border:"1px solid #fde68a",fontSize:11,color:"#92400e",lineHeight:1.7}}>
        <strong>出典:</strong> 日本乳癌学会 診療ガイドライン2022年版（WEB改訂2024/3含む）+ 2024-2026年の新薬承認を反映。保険適用外のレジメンにはその旨を記載。実際の治療選択は担当医とのShared Decision Makingに基づいてください。
      </div>
    </div>
  );
}

// ===== 開発初期ランドスケープ（パイプライン収録基準A-D未達の早期開発品） =====
// ClinicalTrials.gov API + 学会発表 + 企業パイプラインから収集
// scripts/landscape_collector.py で自動更新可能

// MOA category mapping for timeline filter
const DRUG_MOA={
  camizestrant:"SERD",giredestrant:"SERD",imlunestrant:"SERD",vepdegestrant:"SERD",
  atirmociclib:"CDK4/6i",palbociclib:"CDK4/6i",abemaciclib:"CDK4/6i",prifetrastat:"KAT6i",
  inavolisib:"PI3K/AKT",gedatolisib:"PI3K/AKT",capivasertib:"PI3K/AKT",
  "T-DXd":"ADC","Dato-DXd":"ADC","Sac-Gov":"ADC","Sac-TMT":"ADC",
  tucatinib:"TKI",pumitamig:"BsAb/IO"
};
function GanttChart({focusTrial,onFocusClear}){
  const [subFilter,setSubFilter]=useState("ALL");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const [moaFilter,setMoaFilter]=useState("ALL");
  const [selectedTrial,setSelectedTrial]=useState(null);
  const subs=["ALL","HR+/HER2-","HER2+","TNBC","HER2-low"];
  const sts=["ALL","run","pos","neg"];
  const stLabels={ALL:"すべて",run:"進行中",pos:"Positive",neg:"Negative"};
  const moas=["ALL","SERD","CDK4/6i","ADC","PI3K/AKT","TKI","KAT6i","BsAb/IO"];

  const filtered=useMemo(()=>{
    let list=TIMELINE;
    if(subFilter!=="ALL")list=list.filter(t=>t.sub===subFilter);
    if(statusFilter!=="ALL")list=list.filter(t=>t.st===statusFilter);
    if(moaFilter!=="ALL")list=list.filter(t=>(DRUG_MOA[t.drug]||"")=== moaFilter);
    return list.sort((a,b)=>a.readout-b.readout);
  },[subFilter,statusFilter,moaFilter]);

  // focusTrial from external navigation
  useEffect(()=>{
    if(focusTrial){
      setSelectedTrial(focusTrial);
      setTimeout(()=>{
        const el=document.querySelector(`[data-trial="${focusTrial}"]`);
        if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
      },100);
      if(onFocusClear)setTimeout(()=>onFocusClear(),2000);
    }
  },[focusTrial]);

  const minY=2020;
  const maxY=2029;
  const span=maxY-minY;
  const pct=v=>Math.max(0,Math.min(100,(v-minY)/span*100));
  const now=2026.22;

  return(
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>サブタイプ:</span>
        {subs.map(s=>(
          <button key={s} onClick={()=>setSubFilter(s)} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:subFilter===s?"2px solid #7c3aed":"1px solid #e2e8f0",background:subFilter===s?"#ede9fe":"#fff",color:subFilter===s?"#7c3aed":"#475569",cursor:"pointer",fontWeight:subFilter===s?700:400}}>{s}</button>
        ))}
        <span style={{fontSize:12,color:"#64748b",fontWeight:600,marginLeft:16}}>ステータス:</span>
        {sts.map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:statusFilter===s?"2px solid #334155":"1px solid #e2e8f0",background:statusFilter===s?"#f1f5f9":"#fff",color:statusFilter===s?"#0f172a":"#475569",cursor:"pointer",fontWeight:statusFilter===s?700:400}}>{stLabels[s]}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>MOA:</span>
        {moas.map(m=>(
          <button key={m} onClick={()=>setMoaFilter(m)} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:moaFilter===m?"2px solid #0369a1":"1px solid #e2e8f0",background:moaFilter===m?"#e0f2fe":"#fff",color:moaFilter===m?"#0369a1":"#475569",cursor:"pointer",fontWeight:moaFilter===m?700:400}}>{m==="ALL"?"すべて":m}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{padding:"8px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",marginBottom:14}}>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"#475569",alignItems:"center"}}>
          <span style={{fontWeight:600,color:"#334155",fontSize:11}}>ステータス:</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:"#16a34a"}}/>Positive</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:"#2563eb"}}/>進行中</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:"#dc2626"}}/>Negative</span>
          <span style={{borderLeft:"1px solid #cbd5e1",paddingLeft:16,fontWeight:600,color:"#334155"}}>バー:</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",width:24,height:10,borderRadius:2,background:"linear-gradient(to right, #2563eb30 0%, #2563eb30 60%, #dbeafe 60%, #dbeafe 100%)",border:"1px solid #2563eb40"}}/>
            <span>濃色=Active / 薄色=Follow-up</span>
          </span>
          <span style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",width:16,height:3,borderRadius:1,background:"#9ca3af",opacity:0.6}}/>
            登録期間
          </span>
        </div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"#475569",alignItems:"center",marginTop:4}}>
          <span style={{fontWeight:600,color:"#334155"}}>マーカー:</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:"#16a34a",fontWeight:700,fontSize:11}}>▼</span> 結果発表</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:"#2563eb",fontWeight:700,fontSize:10}}>◆</span> 結果見込み（PCD: 主要評価項目完了予定日）</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:2,height:10,background:"#dc2626"}}/>現在</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",width:16,height:10,borderRadius:2,background:"#f8fafc",border:"1px solid #e2e8f0"}}/>未来（推定）</span>
        </div>
      </div>

      {/* Year axis */}
      <div style={{position:"relative",marginLeft:220,height:24,borderBottom:"1px solid #e2e8f0",marginBottom:4}}>
        {/* Future area indicator - subtle top border only */}
        {Array.from({length:maxY-minY+1},(_,i)=>minY+i).map(y=>(
          <span key={y} style={{position:"absolute",left:pct(y)+"%",transform:"translateX(-50%)",fontSize:10,color:"#94a3b8",top:4,zIndex:1}}>{y}</span>
        ))}
        <div style={{position:"absolute",left:pct(now)+"%",top:0,bottom:-4,width:2,background:"#dc2626",zIndex:5}}/>
        <span style={{position:"absolute",left:pct(now)+"%",top:-10,transform:"translateX(-50%)",fontSize:8,color:"#dc2626",fontWeight:700,zIndex:6}}>現在</span>
      </div>

      {/* Rows */}
      {filtered.map((t,i)=>{
        // PCD as decimal year for bar rendering
        const pcdDec=t.pcd?(() => {const p=t.pcd.split("-");return parseInt(p[0])+(parseInt(p[1])-1)/12})():null;
        const endPt=t.readout||pcdDec||(t.st==="run"?maxY:t.lpi);
        const isSelected=selectedTrial===t.trial;
        const sc=stColors[t.st]||"#64748b";
        const bgMap={pos:"#dcfce7",neg:"#fee2e2",run:"#dbeafe"};
        const barBg=bgMap[t.st]||"#f1f5f9";
        const enrollLabels={RECRUITING:"登録中",ACTIVE_NOT_RECRUITING:"登録完了",COMPLETED:"完了",NOT_YET_RECRUITING:"開始前"};
        const fmtYM=d=>{if(!d)return"—";const p=d.split("-");return `${p[0]}年${parseInt(p[1])}月`};
        return(
          <div key={i} data-trial={t.trial}>
          <div style={{display:"flex",alignItems:"center",marginBottom:isSelected?0:2,minHeight:28,cursor:"pointer",background:isSelected?"#eff6ff":"transparent",borderRadius:4}} onClick={()=>setSelectedTrial(isSelected?null:t.trial)}>
            {/* Label */}
            <div style={{width:220,flexShrink:0,display:"flex",alignItems:"center",gap:6,paddingRight:8}}>
              <span style={{width:6,height:6,borderRadius:3,background:subColors[t.sub]||"#64748b",flexShrink:0}}/>
              <span style={{fontSize:11,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{t.trial}</span>
              <span style={{fontSize:9,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drug}</span>
            </div>
            {/* Gantt bar area */}
            <div style={{flex:1,position:"relative",height:28}}>
              {/* SCD bar (full trial duration, light color = follow-up) */}
              {(()=>{const scdDec=t.scd?(()=>{const p=t.scd.split("-");return parseInt(p[0])+(parseInt(p[1]||1)-1)/12})():null;
                const barEnd=scdDec||endPt;
                const barW=pct(barEnd)-pct(t.fpi);
                const activeW=pcdDec?(pct(pcdDec)-pct(t.fpi)):barW;
                const activeRatio=barW>0?Math.min(activeW/barW*100,100):100;
                // Bar text
                const barText=t.st==="pos"?`✓ ${t.res||"Positive"}`:t.st==="neg"?`✗ ${t.res||"Negative"}`:"進行中";
                return barW>0?(
                  <div style={{position:"absolute",left:pct(t.fpi)+"%",width:barW+"%",height:20,top:2,borderRadius:4,overflow:"visible",cursor:"pointer"}}>
                    {/* Follow-up portion (full bar, light) */}
                    <div style={{position:"absolute",left:0,top:0,right:0,bottom:0,background:barBg,borderRadius:4,border:`1px solid ${sc}40`}}/>
                    {/* Active portion (FPI → PCD, solid) */}
                    <div style={{position:"absolute",left:0,top:0,bottom:0,width:activeRatio+"%",background:sc+"20",borderRadius:"4px 0 0 4px"}}/>
                    {/* PCD divider line */}
                    {pcdDec&&activeRatio<100&&<div style={{position:"absolute",left:activeRatio+"%",top:0,bottom:0,width:1.5,background:sc+"50"}}/>}
                    {/* Bar text (result or status) */}
                    <span style={{position:"absolute",left:4,top:0,fontSize:9,fontWeight:600,color:sc,lineHeight:"20px",whiteSpace:"nowrap",zIndex:1,overflow:"visible"}}>{barText.length>60?barText.slice(0,57)+"…":barText}</span>
                  </div>
                ):null;
              })()}
              {/* Enrollment bar (thin gray at bottom) */}
              <div style={{position:"absolute",left:pct(t.fpi)+"%",width:(pct(t.lpi)-pct(t.fpi))+"%",height:3,top:23,background:"#9ca3af",opacity:0.5,borderRadius:2}}/>
              {/* Readout marker ▼ */}
              {t.readout&&<div style={{position:"absolute",left:pct(t.readout)+"%",top:-2,fontSize:9,color:sc,transform:"translateX(-50%)",lineHeight:1,fontWeight:700}}>▼</div>}
              {/* PCD marker ◆ (ongoing only) */}
              {t.st==="run"&&pcdDec&&pcdDec<=maxY&&<div style={{position:"absolute",left:pct(pcdDec)+"%",top:-2,fontSize:8,color:sc+"90",transform:"translateX(-50%)",lineHeight:1}}>◆</div>}
              {/* Now line */}
              <div style={{position:"absolute",left:pct(now)+"%",top:0,bottom:0,width:1.5,background:"#dc262640",zIndex:2}}/>
            </div>
          </div>
          {/* Trial detail panel */}
          {isSelected&&(
            <div style={{marginLeft:220,marginBottom:8,padding:"10px 14px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12}}>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"baseline",marginBottom:6}}>
                <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{t.trial}</span>
                <span style={{fontSize:11,color:"#475569"}}>Phase {t.ph}</span>
                <SubChip t={t.sub}/>
                <span style={{color:stColors[t.st],fontWeight:600,fontSize:11}}>{t.st==="pos"?"Positive":t.st==="neg"?"Negative":"進行中"}</span>
                {t.enrollment&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:t.enrollment==="RECRUITING"?"#dbeafe":"#f1f5f9",color:t.enrollment==="RECRUITING"?"#2563eb":"#64748b",fontWeight:600}}>{enrollLabels[t.enrollment]||t.enrollment}</span>}
              </div>
              <div style={{color:"#334155",lineHeight:1.7}}>
                <div><strong>薬剤:</strong> <DrugLink generic={DRUGS.find(d=>d.generic===t.drug||d.name.includes(t.drug))?.generic||""} label={t.drug}/></div>
                <div><strong>対象:</strong> {t.pop}</div>
                {t.arm&&<div><strong>治療群:</strong> {t.arm}</div>}
                {t.ctrl&&<div><strong>対照群:</strong> {t.ctrl}</div>}
                <div><strong>主要評価項目:</strong> {t.primaryEndpoint||t.ep||"—"}{t.enrollmentTarget&&<span style={{color:"#64748b",marginLeft:8}}>（目標 {t.enrollmentTarget}人）</span>}{t.res&&<span style={{color:t.st==="pos"?"#059669":t.st==="neg"?"#dc2626":"#2563eb",fontWeight:600,marginLeft:8}}>→ {t.res}</span>}</div>
                {t.ep2&&<div><strong>副次評価項目:</strong> {t.ep2}{t.res2&&<span style={{color:"#475569",marginLeft:8}}>→ {t.res2}</span>}</div>}

                {/* Timeline milestones */}
                <div style={{marginTop:6,padding:"6px 10px",background:"#fff",borderRadius:6,border:"1px solid #e2e8f0"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:4}}>📅 試験日程</div>
                  <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"2px 12px",fontSize:11,color:"#334155"}}>
                    <span style={{color:"#64748b"}}>試験開始 (FPI):</span><span>{Math.floor(t.fpi)}年{Math.round((t.fpi-Math.floor(t.fpi))*12)+1}月</span>
                    <span style={{color:"#64748b"}}>登録完了 (LPI):</span><span>{Math.floor(t.lpi)}年{Math.round((t.lpi-Math.floor(t.lpi))*12)+1}月{t.enrollment==="RECRUITING"?" （推定）":""}</span>
                    {t.pcd&&<><span style={{color:"#64748b"}}>主要評価完了 (PCD):</span><span>{fmtYM(t.pcd)}{t.st==="run"?" （推定）":""}</span></>}
                    {t.scd&&<><span style={{color:"#64748b"}}>試験完了 (SCD):</span><span>{fmtYM(t.scd)} （推定）</span></>}
                    {t.readout&&<><span style={{color:"#64748b"}}>結果発表:</span><span style={{fontWeight:600}}>{Math.floor(t.readout)}年</span></>}
                  </div>
                </div>

                {/* Regulatory milestones */}
                {t.regulatory&&(
                  <div style={{marginTop:4,padding:"6px 10px",background:"#fff",borderRadius:6,border:"1px solid #e2e8f0"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:4}}>🏛 規制当局</div>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"2px 12px",fontSize:11,color:"#334155"}}>
                      {t.regulatory.fda&&<><span style={{color:"#64748b"}}>FDA:</span><span>{[t.regulatory.fda.approval&&`承認 ${t.regulatory.fda.approval}`,t.regulatory.fda.pdufa&&`PDUFA ${t.regulatory.fda.pdufa}`,t.regulatory.fda.adcom&&`AdCom ${t.regulatory.fda.adcom}`,t.regulatory.fda.submission&&`申請 ${t.regulatory.fda.submission}`].filter(Boolean).join(" / ")||"—"}</span></>}
                      {t.regulatory.pmda&&<><span style={{color:"#64748b"}}>PMDA:</span><span>{[t.regulatory.pmda.approval&&`承認 ${t.regulatory.pmda.approval}`,t.regulatory.pmda.submission&&`申請 ${t.regulatory.pmda.submission}`].filter(Boolean).join(" / ")||"—"}</span></>}
                      {t.regulatory.ema&&<><span style={{color:"#64748b"}}>EMA:</span><span>{[t.regulatory.ema.approval&&`承認 ${t.regulatory.ema.approval}`,t.regulatory.ema.submission&&`申請 ${t.regulatory.ema.submission}`].filter(Boolean).join(" / ")||"—"}</span></>}
                    </div>
                  </div>
                )}

                {t.note&&<div style={{marginTop:4}}><strong>備考:</strong> {t.note}</div>}
                <div style={{marginTop:6,display:"flex",gap:12,flexWrap:"wrap"}}>
                  <a href={t.nct?`https://clinicaltrials.gov/study/${t.nct}`:`https://clinicaltrials.gov/search?term=${encodeURIComponent(t.trial+" breast cancer")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#2563eb",textDecoration:"underline"}}>{t.nct||"ClinicalTrials.gov で検索"}</a>
                  {t.resultUrl&&<a href={t.resultUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#059669",textDecoration:"underline"}}>📄 {t.resultRef||"結果論文"}</a>}
                </div>
              </div>
            </div>
          )}
          </div>
        );
      })}

    </div>
  );
}

// ===== 用語集タブ =====
function GlossaryTab(){
  const [catFilter,setCatFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  const [highlight,setHighlight]=useState(null);
  const [expanded,setExpanded]=useState(null);
  const cats=GLOSSARY.categories;
  const terms=GLOSSARY.terms;

  const filtered=useMemo(()=>{
    let list=terms;
    if(catFilter!=="ALL")list=list.filter(t=>t.category===catFilter);
    if(search){
      const q=search.toLowerCase();
      list=list.filter(t=>
        t.term.toLowerCase().includes(q)||
        (t.termJa&&t.termJa.toLowerCase().includes(q))||
        t.reading.toLowerCase().includes(q)||
        t.definition.toLowerCase().includes(q)
      );
    }
    return list.sort((a,b)=>a.term.localeCompare(b.term,"en",{sensitivity:"base"}));
  },[catFilter,search]);

  const scrollTo=(id)=>{
    setCatFilter("ALL");setSearch("");
    setExpanded(id);setHighlight(id);
    setTimeout(()=>{
      const el=document.querySelector(`[data-glossary="${id}"]`);
      if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    },100);
    setTimeout(()=>setHighlight(null),3000);
  };

  return(
    <div>
      <h3 style={{fontSize:18,fontWeight:700,color:"#0f172a",margin:"0 0 12px"}}>用語集 <span style={{fontSize:13,fontWeight:400,color:"#64748b"}}>— {terms.length}語収録</span></h3>
      {/* Category filter */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        <button onClick={()=>setCatFilter("ALL")} style={{fontSize:11,padding:"4px 12px",borderRadius:999,border:catFilter==="ALL"?"2px solid #7c3aed":"1px solid #e2e8f0",background:catFilter==="ALL"?"#ede9fe":"#fff",color:catFilter==="ALL"?"#7c3aed":"#475569",cursor:"pointer",fontWeight:catFilter==="ALL"?700:400}}>すべて</button>
        {cats.map(c=>(
          <button key={c.id} onClick={()=>setCatFilter(c.id)} style={{fontSize:11,padding:"4px 12px",borderRadius:999,border:catFilter===c.id?"2px solid #7c3aed":"1px solid #e2e8f0",background:catFilter===c.id?"#ede9fe":"#fff",color:catFilter===c.id?"#7c3aed":"#475569",cursor:"pointer",fontWeight:catFilter===c.id?700:400}}>{c.icon} {c.label}</button>
        ))}
      </div>
      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="用語を検索…" style={{width:"100%",maxWidth:400,padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",color:"#0f172a",fontSize:13,marginBottom:16,outline:"none",boxSizing:"border-box"}}/>
      {/* Cards list */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {filtered.map(t=>{
          const cat=cats.find(c=>c.id===t.category);
          const isHL=highlight===t.id;
          const isOpen=expanded===t.id;
          return(
            <div key={t.id} data-glossary={t.id} style={{background:isHL?"#ede9fe":isOpen?"#f8fafc":"#fff",border:isHL?"2px solid #7c3aed":"1px solid #e2e8f0",borderRadius:8,transition:"border-color 0.5s, background 0.5s",overflow:"hidden"}}>
              {/* Collapsed header - always visible */}
              <div onClick={()=>setExpanded(isOpen?null:t.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer"}}>
                <span style={{fontSize:10,color:"#64748b",minWidth:16}}>{cat?.icon}</span>
                <span style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{t.term}</span>
                {t.termJa&&t.termJa!==t.term&&<span style={{fontSize:12,color:"#475569"}}>{t.termJa}</span>}
                <span style={{fontSize:10,color:"#94a3b8"}}>{t.reading}</span>
                <span style={{marginLeft:"auto",fontSize:10,color:"#94a3b8",transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
              </div>
              {/* Expanded content */}
              {isOpen&&(
                <div style={{padding:"0 14px 14px",borderTop:"1px solid #e2e8f0"}}>
                  <div style={{fontSize:10,color:"#64748b",marginTop:8,marginBottom:6}}>{cat?.icon} {cat?.label}</div>
                  {/* Image */}
                  {t.image&&<img src={`/images/glossary/${t.image}`} alt={`${t.term}のイラスト`} onError={e=>{e.target.style.display="none"}} style={{display:"block",maxWidth:300,width:"100%",borderRadius:8,margin:"0 auto 10px",background:"#f8fafc"}}/>}
                  {/* Definition */}
                  <p style={{fontSize:13,color:"#334155",lineHeight:1.7,margin:"0 0 10px"}}>{t.definition}</p>
                  {/* Related terms */}
                  {t.relatedTerms&&t.relatedTerms.length>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#64748b"}}>関連:</span>
                      {t.relatedTerms.map(rid=>{
                        const rt=terms.find(x=>x.id===rid);
                        return rt?(
                          <span key={rid} onClick={e=>{e.stopPropagation();scrollTo(rid)}} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#f1f5f9",color:"#475569",cursor:"pointer",border:"1px solid #e2e8f0"}}>{rt.term}</span>
                        ):null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length===0&&<p style={{color:"#64748b",textAlign:"center",padding:40}}>該当する用語がありません</p>}
      <p style={{fontSize:10,color:"#475569",marginTop:16,textAlign:"center"}}>用語の説明は一般向けに簡略化しています。正確な定義は乳癌診療ガイドライン等をご参照ください。</p>
    </div>
  );
}

function LandscapeTab(){
  const [subFilter,setSubFilter]=useState("ALL");
  const [stageFilter,setStageFilter]=useState("ALL");
  const [lsSearch,setLsSearch]=useState("");
  const [openCats,setOpenCats]=useState({});

  const subs=["ALL","HR+/HER2-","HER2+","TNBC","HER2-low"];
  const stages=["ALL","IND","FIH","PhI","PhIb/II","PhII"];

  const filtered=useMemo(()=>{
    let list=LANDSCAPE;
    if(subFilter!=="ALL")list=list.filter(d=>d.sub.includes(subFilter));
    if(stageFilter!=="ALL")list=list.filter(d=>d.stage===stageFilter);
    if(lsSearch.trim())list=list.filter(d=>(d.name+d.co+d.tgt+d.id+(d.note||"")).toLowerCase().includes(lsSearch.toLowerCase()));
    return list;
  },[subFilter,stageFilter,lsSearch]);

  const grouped=useMemo(()=>{
    const g={};
    filtered.forEach(d=>{
      if(!g[d.moa_cat])g[d.moa_cat]=[];
      g[d.moa_cat].push(d);
    });
    return Object.entries(g).sort((a,b)=>b[1].length-a[1].length);
  },[filtered]);

  const catCount=useMemo(()=>{const s=new Set();LANDSCAPE.forEach(d=>s.add(d.moa_cat));return s.size;},[]);

  const toggle=(cat)=>setOpenCats(prev=>({...prev,[cat]:!prev[cat]}));

  const StageBadge=({stage})=>{
    const st=STAGE_STYLE[stage]||{c:"#64748b",b:"#f1f5f9"};
    return <span style={{fontSize:10,fontWeight:700,color:st.c,background:st.b,padding:"2px 8px",borderRadius:999,whiteSpace:"nowrap"}}>{stage}</span>;
  };

  return(
    <div>
      <div style={{background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0",marginBottom:16}}>
        <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#0f172a"}}>開発初期ランドスケープ</h2>
        <p style={{margin:"0 0 8px",fontSize:12,color:"#64748b"}}>
          治療開発パイプラインの収録基準（A-D）を満たさない早期開発品を収録。基準Dを満たした時点でパイプラインタブに昇格。
        </p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"#475569"}}>
          {LANDSCAPE.length}薬剤を{catCount}カテゴリに分類。ClinicalTrials.gov + 学会発表 + 企業パイプラインから収集（最終更新: {UPDATED}）
        </p>

        {/* Filters */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>サブタイプ:</span>
          {subs.map(s=>(
            <button key={s} onClick={()=>setSubFilter(s)} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:subFilter===s?"2px solid #7c3aed":"1px solid #e2e8f0",background:subFilter===s?"#ede9fe":"#fff",color:subFilter===s?"#7c3aed":"#475569",cursor:"pointer",fontWeight:subFilter===s?700:400}}>{s}</button>
          ))}
          <span style={{fontSize:12,color:"#64748b",fontWeight:600,marginLeft:12}}>段階:</span>
          {stages.map(s=>(
            <button key={s} onClick={()=>setStageFilter(s)} style={{fontSize:11,padding:"3px 10px",borderRadius:999,border:stageFilter===s?"2px solid #334155":"1px solid #e2e8f0",background:stageFilter===s?"#f1f5f9":"#fff",color:stageFilter===s?"#0f172a":"#475569",cursor:"pointer",fontWeight:stageFilter===s?700:400}}>{s}</button>
          ))}
          <input placeholder="検索..." value={lsSearch} onChange={e=>setLsSearch(e.target.value)} style={{fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",outline:"none",width:140,marginLeft:"auto"}}/>
        </div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{filtered.length} 件表示中</div>
      </div>

      {/* Accordion by moa_cat */}
      {grouped.map(([cat,drugs])=>{
        const isOpen=openCats[cat]!==false;
        const label=MOA_CAT_LABELS[cat]||cat;
        const tgts=[...new Set(drugs.map(d=>d.tgt))].join(", ");
        return(
          <div key={cat} style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",marginBottom:10,overflow:"hidden"}}>
            <div onClick={()=>toggle(cat)} style={{padding:"12px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:"#fafbfc"}}>
              <span style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{label}</span>
              <span style={{fontSize:11,fontWeight:700,color:"#fff",background:"#475569",padding:"1px 8px",borderRadius:999}}>{drugs.length}</span>
              <span style={{fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>{tgts}</span>
              <span style={{fontSize:18,color:"#94a3b8",marginLeft:"auto",transform:isOpen?"rotate(180deg)":"rotate(0)",transition:"transform .2s"}}>▾</span>
            </div>
            {isOpen&&(
              <div style={{padding:"0 18px 14px",overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:11,borderCollapse:"collapse",minWidth:900}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    {["薬剤名","企業","標的","段階","サブタイプ","登録数","初期結果","出典"].map((h,i)=>(
                      <th key={i} style={{textAlign:"left",padding:"5px 8px",color:"#64748b",fontWeight:600,borderBottom:"1px solid #e2e8f0"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{drugs.map((d,i)=>(
                    <tr key={d.id} style={{borderTop:i?"1px solid #f1f5f9":"none"}}>
                      <td style={{padding:"6px 8px",fontWeight:700,color:"#0f172a"}}>
                        {d.name}
                        {d.note&&<div style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginTop:1}}>{d.note}</div>}
                      </td>
                      <td style={{padding:"6px 8px",color:"#475569"}}>{d.co}</td>
                      <td style={{padding:"6px 8px",color:"#334155",fontWeight:500}}>{d.tgt}</td>
                      <td style={{padding:"6px 8px"}}><StageBadge stage={d.stage}/></td>
                      <td style={{padding:"6px 8px"}}><span style={{display:"flex",gap:3,flexWrap:"wrap"}}>{d.sub.map((s,j)=><SubChip key={j} t={s}/>)}</span></td>
                      <td style={{padding:"6px 8px",color:"#475569",textAlign:"center"}}>{d.n_enrolled||"—"}</td>
                      <td style={{padding:"6px 8px",color:"#334155",maxWidth:200}}>{d.early_result||"—"}</td>
                      <td style={{padding:"6px 8px"}}><div style={{display:"flex",flexDirection:"column",gap:2}}>{d.source_url&&<a href={d.source_url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",textDecoration:"underline",fontSize:10}}>{d.source_label||"Link"}</a>}{d.nct&&<a href={`https://clinicaltrials.gov/study/${d.nct}`} target="_blank" rel="noopener noreferrer" style={{color:"#64748b",textDecoration:"underline",fontSize:9}}>{d.nct}</a>}{!d.source_url&&!d.nct&&"—"}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:14}}>該当する薬剤がありません</div>
      )}
    </div>
  );
}

export default function Dashboard(){
  const [tab,setTab]=useState("drugs");
  const [filter,setFilter]=useState("ALL");
  const [clsFilter,setClsFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  const [focusDrug,setFocusDrug]=useState(null);
  const [focusTrial,setFocusTrial]=useState(null);
  const subs=["ALL","HR+/HER2-","HER2+","TNBC","HER2-low"];
  const CLS_GROUPS={
    "ALL":"すべて",
    "CDK":"CDK阻害薬",
    "SERD":"SERD/PROTAC",
    "ADC":"ADC",
    "PI3K":"PI3K/AKT/mTOR",
    "TKI":"TKI",
    "IO":"免疫CPI",
    "PARP":"PARP阻害薬",
    "Ab":"抗体",
    "Other":"その他"
  };
  const clsMatch=(cls,g)=>{
    if(g==="ALL")return true;
    if(g==="CDK")return /CDK/.test(cls);
    if(g==="SERD")return /SERD|PROTAC/.test(cls);
    if(g==="ADC")return /ADC/.test(cls);
    if(g==="PI3K")return /PI3K|AKT|mTOR/.test(cls);
    if(g==="TKI")return /TKI|pan-HER/.test(cls);
    if(g==="IO")return /CPI|PD-1|PD-L1/.test(cls);
    if(g==="PARP")return /PARP/.test(cls);
    if(g==="Ab")return /抗体|Bispecific/.test(cls)&&!/ADC/.test(cls);
    return !(/CDK|SERD|PROTAC|ADC|PI3K|AKT|mTOR|TKI|pan-HER|CPI|PD-1|PD-L1|PARP|抗体|Bispecific/.test(cls));
  };
  const filtered=useMemo(()=>{
    let list=DRUGS;
    if(filter!=="ALL")list=list.filter(d=>d.sub.includes(filter));
    if(clsFilter!=="ALL")list=list.filter(d=>clsMatch(d.cls,clsFilter));
    if(search.trim())list=list.filter(d=>(d.name+d.generic+d.co+d.cls).toLowerCase().includes(search.toLowerCase()));
    return list;
  },[filter,clsFilter,search]);

  const goToDrug=useCallback((generic)=>{
    setFilter("ALL");setSearch("");setFocusDrug(generic);setTab("drugs");
  },[]);
  const goToTrial=useCallback((trial)=>{
    setFocusTrial(trial);setTab("gantt");
  },[]);
  const navValue=useMemo(()=>({goToDrug,goToTrial}),[goToDrug,goToTrial]);

  return(
    <NavContext.Provider value={navValue}>
    <div style={{fontFamily:'"Noto Sans JP","Helvetica Neue",Arial,sans-serif',maxWidth:960,margin:"0 auto",padding:"24px 16px",background:"#f8fafc",minHeight:"100vh"}}>
      <div style={{background:"linear-gradient(135deg,#1e293b 0%,#334155 100%)",borderRadius:16,padding:"20px 28px",marginBottom:20,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
          <h1 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:"0.02em"}}>乳がん新書 2026</h1>
          <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>Breast Cancer Drug Pipeline & Treatment Atlas</span>
        </div>
        <p style={{margin:"4px 0 0",fontSize:11,color:"#94a3b8"}}>治療開発パイプライン ・ 臨床試験タイムライン ・ 開発初期ランドスケープ ・ 日本の標準治療</p>
        <p style={{margin:"3px 0 0",fontSize:10,color:"#64748b"}}>2026年2.2版　｜　最終更新: {UPDATED}　｜　収録薬剤: {DRUGS.length}　｜　収録試験: {TIMELINE.length}　｜　収録レジメン: {REGIMENS.length}　｜　収録用語: {GLOSSARY.terms.length}</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20}}>
        {[{k:"drugs",l:["治療開発","パイプライン"]},{k:"gantt",l:["臨床試験","タイムライン"]},{k:"landscape",l:["開発初期","ランドスケープ"]},{k:"soc",l:["日本の","標準治療"]},{k:"cost",l:["治療費","概算"]},{k:"history",l:["治療の","歴史"]},{k:"glossary",l:["用語集",""]},{k:"changelog",l:["更新履歴",""]},{k:"about",l:["About Us",""]}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)} style={{fontSize:12,fontWeight:tab===k?700:400,padding:"8px 12px",background:tab===k?"#fff":"#f1f5f9",color:tab===k?"#0f172a":"#64748b",border:tab===k?"1px solid #e2e8f0":"1px solid transparent",borderBottom:tab===k?"1px solid #fff":"1px solid #e2e8f0",borderRadius:"8px 8px 0 0",cursor:"pointer",marginBottom:-1,position:"relative",zIndex:tab===k?2:1,lineHeight:1.3,textAlign:"center",flex:"1 1 0",minWidth:0}}>{l[0]}{l[1]&&<><br/>{l[1]}</>}</button>
        ))}
        <div style={{flex:1,borderBottom:"1px solid #e2e8f0"}}/>
      </div>

      {tab==="soc" && (
        <SocTabContent/>
      )}

      {tab==="drugs" && (
        <>
          <div style={{display:"flex",gap:14,marginBottom:20,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 440px",background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0"}}>
              <h2 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#0f172a"}}>2026年 注目イベント</h2>
              {EVENTS.map((e,i)=>(
                <div key={i} style={{marginBottom:12,opacity:e.done?0.85:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:e.done?"#64748b":"#7c3aed",marginBottom:3,display:"flex",alignItems:"center",gap:6}}>
                    {e.q}
                  </div>
                  {e.items.map((item,j)=>(
                    <div key={j} style={{fontSize:12,paddingLeft:12,lineHeight:1.5,marginBottom:item.result?4:0}}>
                      <div style={{color:e.done?"#64748b":"#334155"}}>{e.done?"✓":"•"} {item.generic?<DrugLink generic={item.generic} label={item.text} subtle/>:item.text}{item.isNew&&<span style={{fontSize:9,fontWeight:700,color:"#fff",background:"#ef4444",borderRadius:3,padding:"1px 4px",marginLeft:4}}>NEW</span>}</div>
                      {item.result&&<div style={{fontSize:11,color:"#059669",paddingLeft:14,fontWeight:500}}>→ {item.result}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{flex:"1 1 440px",background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0"}}>
              <h2 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#0f172a"}}>🇯🇵 日本承認見通し</h2>
              {JP_OUTLOOK.map((j,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12}}>
                  <span style={{width:8,height:8,borderRadius:4,background:j.color,flexShrink:0}}/>
                  <span style={{fontWeight:700,minWidth:130}}>{j.generic?<DrugLink generic={j.generic} label={j.name} subtle/>:j.name}</span>
                  <span style={{color:"#64748b",fontSize:11,flex:"1 1 160px"}}>{j.sub}</span>
                  <span style={{fontSize:11,color:"#334155",textAlign:"right"}}>{j.status}{j.isNew&&<span style={{fontSize:9,fontWeight:700,color:"#fff",background:"#ef4444",borderRadius:3,padding:"1px 4px",marginLeft:4}}>NEW</span>}</span>
                </div>
              ))}
              <div style={{fontSize:10,color:"#94a3b8",marginTop:8,display:"flex",gap:12,flexWrap:"wrap"}}>
                <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:4,background:"#16a34a"}}/>新規承認済</span>
                <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:4,background:"#2563eb"}}/>適応拡大・新剤形</span>
                <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:4,background:"#eab308"}}/>海外承認済・国内開発中</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",borderRadius:12,padding:"12px 20px",border:"1px solid #e2e8f0",marginBottom:16,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(S).map(([k,v])=>(
                <span key={k} style={{fontSize:10,display:"flex",alignItems:"center",gap:3}}>
                  <span style={{width:10,height:10,borderRadius:3,background:SC[k]}}/>
                  {v}
                </span>
              ))}
            </div>
            <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>サブタイプ:</span>
              {subs.map(s=>(
                <button key={s} onClick={()=>setFilter(s)} style={{fontSize:11,fontWeight:filter===s?700:400,padding:"4px 12px",borderRadius:999,border:filter===s?"2px solid #7c3aed":"1px solid #e2e8f0",background:filter===s?"#ede9fe":"#fff",color:filter===s?"#7c3aed":"#475569",cursor:"pointer"}}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:12,padding:"8px 20px",border:"1px solid #e2e8f0",marginBottom:16,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>薬剤クラス:</span>
            {Object.entries(CLS_GROUPS).map(([k,v])=>(
              <button key={k} onClick={()=>setClsFilter(k)} style={{fontSize:11,fontWeight:clsFilter===k?700:400,padding:"4px 10px",borderRadius:999,border:clsFilter===k?"2px solid #0369a1":"1px solid #e2e8f0",background:clsFilter===k?"#e0f2fe":"#fff",color:clsFilter===k?"#0369a1":"#475569",cursor:"pointer"}}>{v}</button>
            ))}
            <input placeholder="検索..." value={search} onChange={e=>setSearch(e.target.value)} style={{fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",outline:"none",width:140,marginLeft:"auto"}}/>
          </div>

          <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{filtered.length} 件表示中</div>
          {filtered.map(d=><DrugCard key={d.generic} d={d} focusDrug={focusDrug} onFocusClear={()=>setFocusDrug(null)}/>)}

          {/* 収録基準（タブ下部） */}
          <div style={{background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0",marginTop:20}}>
            <h2 style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:"#0f172a"}}>収録基準</h2>
            <div style={{fontSize:12,color:"#334155",lineHeight:1.8}}>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#16a34a",minWidth:20}}>A.</span><span><strong>標準治療に使用される先発品（後発品未発売）</strong> — 「日本の標準治療」タブに掲載のレジメンで使用される薬剤のうち、後発品・バイオシミラーが上市されていないもの。特許/独占権情報とライフサイクルを掲載。</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#2563eb",minWidth:20}}>B.</span><span><strong>承認申請中の薬剤</strong> — FDA/EMA/PMDAのいずれかで承認申請中。FDA承認判断予定日等を記載。</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#7c3aed",minWidth:20}}>C.</span><span><strong>Phase III以降の新薬・適応拡大</strong> — Phase III結果発表済み or 進行中の薬剤。既承認薬の新適応・新剤型を含む。</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#ea580c",minWidth:20}}>D.</span><span><strong>Phase IIで以下の客観的条件を1つ以上満たす薬剤</strong> — ① Phase III試験がClinicalTrials.govに登録済み ② 企業がPhase III開始を公式に発表 ③ FDA BTD（Breakthrough Therapy Designation）を取得 ④ 規制当局へのPre-NDA相談/科学的助言が公表済み</span></div>
              <div style={{fontSize:11,color:"#64748b",marginTop:6}}>※ 後発品・バイオシミラーが上市済みの古典的薬剤（tamoxifen, AI, trastuzumab BS, everolimus GE等）は原則省略。化学療法レジメン（AC, taxane等）も省略。</div>
            </div>
          </div>
        </>
      )}

      {tab==="gantt" && (
        <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
          <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#0f172a"}}>臨床試験タイムライン</h2>
          <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>{TIMELINE.length} 試験を収録（進行中＋2024年以降に結果発表の試験）。readoutが2024年より前の完了済み試験は省略。</p>
          <GanttChart focusTrial={focusTrial} onFocusClear={()=>setFocusTrial(null)}/>
        </div>
      )}

      {tab==="landscape" && <LandscapeTab/>}
      {tab==="cost" && <CostSimulator/>}
      {tab==="history" && <HistoryTimeline/>}
      {tab==="glossary" && <GlossaryTab/>}

      {tab==="changelog" && (
        <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"#0f172a"}}>更新履歴</h2>
          {CHANGELOG.map((log,i)=>(
            <div key={i} style={{marginBottom:20,paddingBottom:16,borderBottom:i<0?"":"1px solid #f1f5f9"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:14,fontWeight:800,color:log.type==="major"?"#7c3aed":"#2563eb"}}>{log.ver}</span>
                <span style={{fontSize:11,color:"#64748b"}}>{log.date}</span>
                <span style={{fontSize:10,fontWeight:600,color:"#fff",background:log.type==="major"?"#7c3aed":"#2563eb",padding:"1px 8px",borderRadius:999}}>{log.type==="major"?"メジャー":"マイナー"}</span>
              </div>
              <ul style={{margin:0,paddingLeft:20,fontSize:12,color:"#334155",lineHeight:1.8}}>
                {log.items.map((item,j)=><li key={j}>{item}</li>)}
              </ul>
            </div>
          ))}
          <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>
            バージョン規則: メジャー（X.0）= 大幅な構成変更・薬剤追加、マイナー（X.Y）= データ更新・UI改善・バグ修正
          </div>
        </div>
      )}

      {tab==="about" && (
        <div style={{background:"#fff",borderRadius:12,padding:"24px 28px",border:"1px solid #e2e8f0"}}>
          <h2 style={{margin:"0 0 16px",fontSize:18,fontWeight:700,color:"#0f172a"}}>このサイトについて</h2>
          <div style={{fontSize:13,color:"#334155",lineHeight:2.0}}>
            <p style={{margin:"0 0 12px"}}>このサイトは、<strong>一般社団法人BC TUBE</strong>が運営しています。</p>
            <p style={{margin:"0 0 12px"}}>BC TUBEは、乳がんに関する正確でわかりやすい情報を、より多くの方に届けることを目的に活動している非営利団体です。</p>
            <p style={{margin:"0 0 12px"}}>本サイトの内容は、複数の乳腺科医が制作・監修し、科学的根拠に基づいた情報発信を行っています。</p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>※本サイトの一部コンテンツはAIを活用して作成されていますが、医療的内容については複数の医療従事者が確認し、正確性の担保に努めています。</p>
            <p style={{margin:"0 0 20px",fontSize:13}}>内容に誤りを見つけた場合は、<a href="https://forms.gle/yqFJZpmWK1DBmLmB6" target="_blank" rel="noopener noreferrer" style={{color:"#2563eb",textDecoration:"underline",fontWeight:600}}>こちらのフォーム</a>からご連絡ください。</p>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 300px",background:"#f8fafc",borderRadius:10,padding:"16px 20px",border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:6}}>運営団体</div>
                <div style={{fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:4}}>一般社団法人BC TUBE</div>
                <a href="https://bctube.org/" target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#2563eb",textDecoration:"underline"}}>https://bctube.org/</a>
              </div>
              <div style={{flex:"1 1 300px",background:"#f8fafc",borderRadius:10,padding:"16px 20px",border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:6}}>YouTubeチャンネル</div>
                <div style={{fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:4}}>乳がん大事典【BC Tube編集部】</div>
                <a href="https://www.youtube.com/@-BCTube" target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#2563eb",textDecoration:"underline"}}>https://www.youtube.com/@-BCTube</a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{marginTop:24,padding:"16px 20px",background:"#f1f5f9",borderRadius:12,fontSize:11,color:"#64748b"}}>
        <p style={{margin:0}}><strong>出典:</strong> FDA/EMA/PMDA公式、各製薬企業プレスリリース、ClinicalTrials.gov、oncolo.jp、passmed.co.jp、ASCO/ESMO/SABCS 2025-2026、各薬剤添付文書</p>
        <p style={{margin:"4px 0 0"}}>本ダッシュボードは教育・情報提供目的です。治療方針決定には必ず担当医にご相談ください。{UPDATED}時点の公開情報に基づきます。特許情報は概算であり訴訟等により変動する可能性があります。臨床試験タイムラインのFPI/LPI/readout時期は概算です。</p>
      </div>
    </div>
    </NavContext.Provider>
  );
}
