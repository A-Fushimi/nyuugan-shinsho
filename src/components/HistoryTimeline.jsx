import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import HDATA from "../data/history-timeline.json";

const CAT_COLORS={
  "HR+":{bg:"#D97706",light:"#FEF3C7",text:"#92400E"},
  "HER2+":{bg:"#DB2777",light:"#FCE7F3",text:"#9D174D"},
  "TNBC":{bg:"#0891B2",light:"#CFFAFE",text:"#155E75"},
};
const GREY={bg:"#6B7280",light:"#F3F4F6",text:"#374151"};
const catColor=c=>CAT_COLORS[c]||GREY;

const TYPE_ICON={"FDA承認":"◆","日本承認":"●","試験結果":"▲","発見":"★"};

const ERAS=[
  {id:"pre1960",label:"黎明期",sub:"〜1959",range:[0,1959],
   lanes:[{id:"surg",name:"手術",accept:["rad"]},{id:"other",name:"基礎発見・化学療法",accept:["tam","dx","her2ab","io","brca","cdk","adc"]}]},
  {id:"1960s70s",label:"化学療法の時代",sub:"1960–1979",range:[1960,1979],
   lanes:[{id:"tam",name:"ホルモン療法",accept:[]},{id:"surg",name:"手術",accept:["rad"]},{id:"dx",name:"診断・基礎研究",accept:["other","her2ab","io","brca","cdk","adc"]}]},
  {id:"1980s90s",label:"分子生物学の時代",sub:"1980–1999",range:[1980,1999],
   lanes:[{id:"tam",name:"タモキシフェン/AI",accept:[]},{id:"her2ab",name:"HER2研究→ハーセプチン",accept:["adc"]},{id:"surg",name:"手術",accept:["rad"]},{id:"dx",name:"診断・検査",accept:["brca"]},{id:"other",name:"化学療法・その他",accept:["io","cdk"]}]},
  {id:"2000s",label:"分子標的治療",sub:"2000–2012",range:[2000,2012],
   lanes:[{id:"tam",name:"内分泌療法",accept:[]},{id:"her2ab",name:"抗HER2療法",accept:["adc"]},{id:"surg",name:"手術",accept:[]},{id:"rad",name:"放射線",accept:[]},{id:"dx",name:"診断・検査",accept:["brca"]},{id:"other",name:"化学療法・その他",accept:["io","cdk"]}]},
  {id:"2013s",label:"精密医療",sub:"2013–2019",range:[2013,2019],
   lanes:[{id:"tam",name:"内分泌療法",accept:[]},{id:"cdk",name:"CDK4/6阻害薬",accept:[]},{id:"her2ab",name:"抗HER2抗体",accept:[]},{id:"adc",name:"ADC",accept:[]},{id:"brca",name:"BRCA/PARP",accept:[]},{id:"io",name:"免疫療法",accept:[]},{id:"dx",name:"診断・検査",accept:[]},{id:"other",name:"手術・放射線・他",accept:["surg","rad"]}]},
  {id:"2020s",label:"ADC・免疫療法の時代",sub:"2020–2025",range:[2020,2025],
   lanes:[{id:"tam",name:"内分泌療法",accept:[]},{id:"cdk",name:"CDK4/6阻害薬",accept:[]},{id:"adc",name:"ADC",accept:[]},{id:"io",name:"免疫療法",accept:[]},{id:"her2ab",name:"抗HER2抗体",accept:[]},{id:"brca",name:"BRCA/PARP",accept:[]},{id:"rad",name:"放射線",accept:[]},{id:"dx",name:"診断・検査",accept:[]},{id:"surg",name:"手術",accept:[]},{id:"other",name:"その他",accept:[]}]},
];

function findLaneCol(item,eraLanes){
  for(const ln of eraLanes)if(ln.id===item.ln)return ln.id;
  for(const ln of eraLanes)if(ln.accept&&ln.accept.includes(item.ln))return ln.id;
  return eraLanes[eraLanes.length-1].id;
}

const ALL_CATS=["すべて","HR+","HER2+","TNBC","手術","放射線","化学療法","基礎発見","診断検査","ガイドライン","疫学政策","横断的"];

export default function HistoryTimeline(){
  const [filter,setFilter]=useState("すべて");
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState(null);
  const endRef=useRef(null);
  const didScroll=useRef(false);

  useEffect(()=>{
    if(!didScroll.current&&endRef.current){
      endRef.current.scrollIntoView({behavior:"auto"});
      didScroll.current=true;
    }
  },[]);

  const filtered=useMemo(()=>{
    let d=HDATA;
    if(filter!=="すべて")d=d.filter(i=>i.c===filter);
    if(search.trim()){
      const q=search.toLowerCase();
      d=d.filter(i=>(i.n+i.d+(i.c||"")).toLowerCase().includes(q));
    }
    return d;
  },[filter,search]);

  const toggle=useCallback((idx)=>setExpanded(p=>p===idx?null:idx),[]);

  return (
    <div style={{padding:"16px 0"}}>
      {/* Header */}
      <div style={{textAlign:"center",marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,color:"#0f172a",margin:0}}>乳癌治療の歴史</h2>
        <div style={{fontSize:12,color:"#64748b",marginTop:4}}>{filtered.length} / {HDATA.length} MILESTONES · 1894→2025</div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8,justifyContent:"center"}}>
        {ALL_CATS.map(c=>{
          const cc=catColor(c);
          const active=filter===c;
          const isSub=["HR+","HER2+","TNBC"].includes(c);
          return <button key={c} onClick={()=>setFilter(c)} style={{
            fontSize:11,padding:"3px 10px",borderRadius:999,cursor:"pointer",border:"1px solid",fontWeight:active?700:400,
            background:active?(isSub?cc.bg:"#374151"):"#fff",
            color:active?"#fff":(isSub?cc.bg:"#64748b"),
            borderColor:active?(isSub?cc.bg:"#374151"):"#e2e8f0"
          }}>{c}</button>;
        })}
      </div>
      <div style={{maxWidth:320,margin:"0 auto 16px",position:"relative"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="薬剤名・試験名で検索…"
          style={{width:"100%",padding:"6px 12px",fontSize:13,border:"1px solid #e2e8f0",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
      </div>

      {/* Timeline */}
      <div style={{position:"relative"}}>
        {ERAS.map((era,ei)=>{
          const eraItems=filtered.filter(i=>i.y>=era.range[0]&&i.y<=era.range[1]).sort((a,b)=>a.y-b.y);
          if(eraItems.length===0)return null;

          // Group by year
          const byYear={};
          eraItems.forEach(i=>{
            const laneId=findLaneCol(i,era.lanes);
            if(!byYear[i.y])byYear[i.y]={};
            if(!byYear[i.y][laneId])byYear[i.y][laneId]=[];
            byYear[i.y][laneId].push(i);
          });
          const years=Object.keys(byYear).map(Number).sort((a,b)=>a-b);

          return (
            <div key={era.id} style={{marginBottom:24}}>
              {/* Era header */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 0",borderBottom:"2px solid #e2e8f0",position:"sticky",top:0,background:"#fff",zIndex:10}}>
                <div style={{width:4,height:32,background:"#2563eb",borderRadius:2}}/>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{era.label}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{era.sub}</div>
                </div>
              </div>

              {/* Lane headers */}
              <div style={{display:"grid",gridTemplateColumns:`56px repeat(${era.lanes.length}, 1fr)`,gap:2,marginBottom:4}}>
                <div style={{fontSize:10,color:"#94a3b8",textAlign:"center"}}>年</div>
                {era.lanes.map(ln=>(
                  <div key={ln.id} style={{fontSize:10,fontWeight:600,color:"#64748b",textAlign:"center",padding:"2px 4px",background:"#f8fafc",borderRadius:4}}>{ln.name}</div>
                ))}
              </div>

              {/* Year rows */}
              {years.map(yr=>(
                <div key={yr} style={{display:"grid",gridTemplateColumns:`56px repeat(${era.lanes.length}, 1fr)`,gap:2,minHeight:28,alignItems:"start",marginBottom:2}}>
                  {/* Year label */}
                  <div style={{fontSize:12,fontWeight:600,color:"#374151",textAlign:"right",paddingRight:8,paddingTop:4,position:"sticky",left:0}}>{yr}</div>
                  {/* Lanes */}
                  {era.lanes.map(ln=>{
                    const items=byYear[yr]?.[ln.id]||[];
                    return (
                      <div key={ln.id} style={{display:"flex",flexDirection:"column",gap:2}}>
                        {items.map((item,ii)=>{
                          const cc=catColor(item.c);
                          const isApproval=item.t==="FDA承認"||item.t==="日本承認";
                          const isA=item.tier==="A";
                          const isC=item.tier==="C";
                          const globalIdx=HDATA.indexOf(item);
                          const isExpanded=expanded===globalIdx;
                          const icon=TYPE_ICON[item.t]||"";
                          const isJpApproval=item.t==="日本承認";

                          return (
                            <div key={ii}>
                              <div onClick={()=>toggle(globalIdx)} style={{
                                padding:isA?"6px 6px":"4px 6px",
                                borderRadius:4,cursor:"pointer",
                                background:isApproval?cc.bg:cc.light,
                                color:isApproval?"#fff":cc.text,
                                border:isJpApproval?`2px dashed ${cc.bg}`:isA?`2px solid ${cc.bg}`:`1px solid ${isApproval?cc.bg:"#e2e8f0"}`,
                                fontSize:isC?10:11,
                                fontWeight:isA?700:400,
                                lineHeight:1.3,
                                opacity:isC?0.85:1,
                                transition:"all 0.15s",
                              }}>
                                <span style={{marginRight:3,fontSize:isC?9:10}}>{icon}</span>
                                {item.n.length>40&&!isA?item.n.slice(0,38)+"…":item.n}
                              </div>
                              {/* Expanded detail */}
                              {isExpanded && (
                                <div style={{padding:8,background:"#f8fafc",borderRadius:4,border:"1px solid #e2e8f0",fontSize:11,lineHeight:1.6,marginTop:2}}>
                                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                                    <span style={{fontSize:10,fontWeight:600,color:cc.bg,background:cc.light,padding:"1px 6px",borderRadius:999}}>{item.c}</span>
                                    <span style={{fontSize:10,color:"#64748b",background:"#f1f5f9",padding:"1px 6px",borderRadius:999}}>{item.t}</span>
                                    <span style={{fontSize:10,color:"#64748b",background:item.tier==="A"?"#FEF3C7":item.tier==="B"?"#E0E7FF":"#F3F4F6",padding:"1px 6px",borderRadius:999,fontWeight:item.tier==="A"?700:400}}>Tier {item.tier}</span>
                                  </div>
                                  <div style={{color:"#334155",marginBottom:4}}>{item.d}</div>
                                  {item.f && <div style={{fontSize:10,color:"#64748b"}}>◆ FDA: {item.f}</div>}
                                  {item.j && <div style={{fontSize:10,color:"#64748b"}}>● 日本: {item.j}</div>}
                                  {item.u && <a href={item.u} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#2563eb",textDecoration:"none"}}>📄 根拠文献</a>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>

      {/* Legend */}
      <div style={{marginTop:16,padding:12,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
        <div style={{fontSize:11,color:"#64748b",display:"flex",flexWrap:"wrap",gap:12}}>
          <span>◆ FDA承認（濃色）</span>
          <span>● 日本承認（破線枠）</span>
          <span>▲ 試験結果</span>
          <span>★ 発見</span>
          <span style={{marginLeft:12}}>太枠 = Tier A（パラダイムシフト）</span>
        </div>
      </div>
    </div>
  );
}
