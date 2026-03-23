import React,{useState,useMemo} from "react";
import REGIMENS from "../data/regimens.json";
import KOUGAKU from "../data/kougaku.json";

/* ── ルールルックアップ ── */
function getRule(ageId,incId){
  return KOUGAKU.rules[ageId]?.[incId]||KOUGAKU.rules.under70.I3;
}

/* ── 高額療養費 計算ロジック ── */
function calcLimit(totalMedical,rule,isMulti){
  if(isMulti&&rule.multi!==null)return rule.multi;
  if(rule.fixed)return rule.base;
  return rule.base+Math.max(totalMedical-rule.threshold,0)*rule.rate;
}
function simulate(monthlyMedical,rule,months){
  const copayRate=rule.copay;
  let multiCount=0,total=0,first=0,multi=0,applied=false,rawTotal=0;
  for(let m=1;m<=months;m++){
    const raw=monthlyMedical*copayRate;
    rawTotal+=raw;
    const isM=multiCount>=3;
    let limit=calcLimit(monthlyMedical,rule,isM);
    if(rule.outpatientLimit!==null)limit=Math.min(limit,rule.outpatientLimit);
    const actual=Math.min(raw,limit);
    if(raw>limit)applied=true;
    total+=actual;
    if(m===1)first=actual;
    if(isM&&multi===0)multi=actual;
    if(raw>=limit)multiCount++;
  }
  return{total:Math.round(total),first:Math.round(first),multi:Math.round(multi),applied,rawTotal:Math.round(rawTotal)};
}

const fmt=n=>n==null?"—":"¥"+n.toLocaleString();
const GROUPS=["すべて","化学療法","HER2標的","CDK4/6","ホルモン","免疫/他","支持療法"];
const AGE_OPTS=KOUGAKU.ageGroups;
const INC_OPTS=KOUGAKU.incomeCategories;
const MONTH_OPTS=[1,3,6,12,24];

const Btn=({active,onClick,children})=>(
  <button onClick={onClick} style={{padding:"5px 12px",borderRadius:6,border:"none",background:active?"#fff":"transparent",color:active?"#0f172a":"#64748b",cursor:"pointer",fontSize:12,fontWeight:active?700:400,boxShadow:active?"0 1px 3px rgba(0,0,0,0.1)":"none",whiteSpace:"nowrap"}}>{children}</button>
);

const Badge=({type})=>{
  if(!type)return null;
  const c=type==="BS"?{bg:"#f3e8ff",color:"#7c3aed",border:"#ddd6fe"}:{bg:"#dcfce7",color:"#16a34a",border:"#bbf7d0"};
  return <span style={{fontSize:10,padding:"1px 5px",borderRadius:4,background:c.bg,color:c.color,border:`1px solid ${c.border}`,marginLeft:4,fontWeight:600}}>{type}</span>;
};

/* ── 計算式テーブル（年齢別） ── */
function FormulaTable({ageId,incId}){
  const rules=KOUGAKU.rules[ageId];
  if(!rules)return null;
  const is70plus=ageId!=="under70";
  const title=ageId==="under70"?"69歳以下":ageId==="70to74"?"70〜74歳":"75歳以上";
  // Deduplicate rules by label
  const seen=new Set();
  const rows=[];
  for(const[iid,r] of Object.entries(rules)){
    if(seen.has(r.label))continue;
    seen.add(r.label);
    rows.push({iid,r});
  }
  return(
    <>
      <h3 style={{fontSize:13,fontWeight:700,color:"#0f172a",margin:"0 0 8px"}}>📐 高額療養費の計算式（{title}）</h3>
      <table style={{fontSize:11,borderCollapse:"collapse",width:"100%",marginBottom:12}}>
        <thead><tr style={{borderBottom:"1px solid #e2e8f0"}}>
          <th style={{textAlign:"left",padding:"3px 6px",color:"#64748b"}}>区分</th>
          {is70plus&&<th style={{textAlign:"right",padding:"3px 6px",color:"#64748b"}}>外来(個人)</th>}
          <th style={{textAlign:"left",padding:"3px 6px",color:"#64748b"}}>{is70plus?"外来+入院(世帯)":"自己負担限度額（月額）"}</th>
          <th style={{textAlign:"right",padding:"3px 6px",color:"#64748b"}}>多数回該当</th>
        </tr></thead>
        <tbody>
          {rows.map(({iid,r})=>{
            const active=getRule(ageId,incId).label===r.label;
            return(
              <tr key={r.label} style={{borderBottom:"1px solid #f1f5f9",background:active?"#eff6ff":"transparent"}}>
                <td style={{padding:"3px 6px",fontWeight:active?700:400}}>{r.label}（{Math.round(r.copay*10)}割）</td>
                {is70plus&&<td style={{padding:"3px 6px",textAlign:"right"}}>{r.outpatientLimit!=null?fmt(r.outpatientLimit):"—"}</td>}
                <td style={{padding:"3px 6px"}}>{r.fixed?`${fmt(r.base)}（固定）`:`${fmt(r.base)} ＋（医療費 − ${fmt(r.threshold)}）× 1%`}</td>
                <td style={{padding:"3px 6px",textAlign:"right"}}>{r.multi!=null?fmt(r.multi):"—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{fontSize:10,color:"#64748b",margin:"0 0 4px"}}>※ 多数回該当: 直近12ヶ月で高額療養費の対象が3回以上ある場合、4回目以降はさらに低い限度額が適用されます。</p>
      {is70plus&&<p style={{fontSize:10,color:"#64748b",margin:"0 0 4px"}}>※ 本ツールは外来化学療法を想定し、外来上限のある区分には外来上限を適用しています。年間上限144,000円。</p>}
    </>
  );
}

export default function CostSimulator(){
  const[ageIdx,setAgeIdx]=useState(0);
  const[incId,setIncId]=useState("I3");
  const[months,setMonths]=useState(6);
  const[group,setGroup]=useState("すべて");
  const[showGE,setShowGE]=useState(true);
  const[sortKey,setSortKey]=useState("brand");
  const[sortDir,setSortDir]=useState(1);

  const ageId=AGE_OPTS[ageIdx].id;
  const rule=getRule(ageId,incId);

  const data=useMemo(()=>{
    let list=REGIMENS;
    if(group!=="すべて")list=list.filter(r=>r.group===group);
    return list.map(r=>{
      const brand=simulate(r.monthlyBrand,rule,months);
      const ge=r.monthlyGeneric!=null?simulate(r.monthlyGeneric,rule,months):null;
      return{...r,brand,ge,saving:ge?brand.total-ge.total:null};
    }).sort((a,b)=>{
      let va,vb;
      if(sortKey==="name"){va=a.name;vb=b.name;return sortDir*(va<vb?-1:va>vb?1:0)}
      if(sortKey==="brand"){va=a.brand.total;vb=b.brand.total}
      else if(sortKey==="ge"){va=a.ge?.total??9999999;vb=b.ge?.total??9999999}
      else if(sortKey==="saving"){va=a.saving??0;vb=b.saving??0}
      else if(sortKey==="monthly"){va=a.monthlyBrand;vb=b.monthlyBrand}
      else{va=0;vb=0}
      return sortDir*(vb-va);
    });
  },[ageIdx,incId,months,group,sortKey,sortDir]);

  const maxMedical=Math.max(...data.map(d=>d.monthlyBrand),1)*months;

  const doSort=key=>{
    if(sortKey===key)setSortDir(d=>-d);
    else{setSortKey(key);setSortDir(1);}
  };
  const SortH=({k,children})=>(
    <th onClick={()=>doSort(k)} style={{textAlign:"right",padding:"6px 8px",color:"#64748b",cursor:"pointer",userSelect:"none",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>
      {children}{sortKey===k?(sortDir>0?" ▼":" ▲"):""}
    </th>
  );

  return(
    <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
      <h2 style={{fontSize:18,fontWeight:800,color:"#0f172a",margin:"0 0 4px"}}>💊 治療費シミュレーター</h2>
      <p style={{fontSize:12,color:"#64748b",margin:"0 0 16px"}}>高額療養費制度を適用した自己負担額の概算を一覧表示します</p>

      {/* ── フィルタ ── */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"#fff",paddingBottom:12,borderBottom:"1px solid #e2e8f0",marginBottom:12}}>
        {/* 年齢 */}
        <div style={{marginBottom:8}}>
          <span style={{fontSize:11,color:"#64748b",marginRight:8,fontWeight:600}}>年齢</span>
          <div style={{display:"inline-flex",gap:2,background:"#f1f5f9",borderRadius:8,padding:2}}>
            {AGE_OPTS.map((a,i)=><Btn key={a.id} active={ageIdx===i} onClick={()=>setAgeIdx(i)}>{a.label}</Btn>)}
          </div>
        </div>
        {/* 年収区分 */}
        <div style={{marginBottom:8}}>
          <span style={{fontSize:11,color:"#64748b",marginRight:8,fontWeight:600}}>年収区分</span>
          <div style={{display:"inline-flex",gap:2,background:"#f1f5f9",borderRadius:8,padding:2,flexWrap:"wrap"}}>
            {INC_OPTS.map(c=><Btn key={c.id} active={incId===c.id} onClick={()=>setIncId(c.id)}>{c.label}</Btn>)}
          </div>
        </div>
        {/* 治療期間 */}
        <div style={{marginBottom:8}}>
          <span style={{fontSize:11,color:"#64748b",marginRight:8,fontWeight:600}}>治療期間</span>
          <div style={{display:"inline-flex",gap:2,background:"#f1f5f9",borderRadius:8,padding:2}}>
            {MONTH_OPTS.map(m=><Btn key={m} active={months===m} onClick={()=>setMonths(m)}>{m}ヶ月</Btn>)}
          </div>
        </div>
        {/* ステータスバッジ */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#dbeafe",color:"#1d4ed8",fontWeight:600}}>🔵 {AGE_OPTS[ageIdx].label}（{Math.round(rule.copay*10)}割負担）</span>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#f3e8ff",color:"#7c3aed",fontWeight:600}}>🟣 {rule.label}</span>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#dcfce7",color:"#16a34a",fontWeight:600}}>🟢 {months}ヶ月</span>
          {rule.outpatientLimit!=null&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#fef9c3",color:"#a16207",fontWeight:600}}>🟡 外来上限 {fmt(rule.outpatientLimit)}/月</span>}
        </div>
        {/* グループ + 後発品 */}
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:2,background:"#f1f5f9",borderRadius:8,padding:2,flexWrap:"wrap"}}>
            {GROUPS.map(g=><Btn key={g} active={group===g} onClick={()=>setGroup(g)}>{g}</Btn>)}
          </div>
          <label style={{fontSize:12,color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <input type="checkbox" checked={showGE} onChange={e=>setShowGE(e.target.checked)}/> 後発品/BS列を表示
          </label>
        </div>
      </div>

      {/* ── テーブル ── */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead style={{position:"sticky",top:0,zIndex:5}}>
            <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
              <th onClick={()=>doSort("name")} style={{textAlign:"left",padding:"6px 8px",color:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600,minWidth:180}}>レジメン{sortKey==="name"?(sortDir>0?" ▲":" ▼"):""}</th>
              <th style={{textAlign:"left",padding:"6px 8px",color:"#64748b",fontSize:11,fontWeight:600}}>周期</th>
              <SortH k="monthly">月額医療費(10割)</SortH>
              <SortH k="brand"><span style={{display:"block",fontSize:9,color:"#64748b",background:"#eff6ff",borderRadius:3,padding:"1px 4px",marginBottom:2,fontWeight:400}}>青背景は高額療養費適用</span>先発品 自己負担{months}ヶ月</SortH>
              {showGE&&<SortH k="ge">後発品/BS{months}ヶ月</SortH>}
              {showGE&&<SortH k="saving">差額</SortH>}
              <th style={{padding:"6px 8px",color:"#64748b",fontSize:11,fontWeight:600,width:160}}>医療費と負担</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r=>{
              return(
                <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                  <td style={{padding:"6px 8px"}}>
                    <div style={{fontWeight:600,color:"#0f172a"}}>{r.name}<Badge type={r.genericType}/>
                      {r.sourceUrl?.length>0&&<a href={r.sourceUrl[0]} target="_blank" rel="noopener noreferrer" title={r.source} style={{marginLeft:4,fontSize:10,color:"#94a3b8",textDecoration:"none"}}>🔗</a>}
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>{r.sub}</div>
                  </td>
                  <td style={{padding:"6px 8px",color:"#64748b",fontSize:11}}>{r.cycle}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:"#64748b"}}>{fmt(r.monthlyBrand)}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums",background:r.brand.applied?"#eff6ff":"transparent"}}>
                    <div style={{fontWeight:700,color:"#0f172a"}}>{fmt(r.brand.total)}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>初月{fmt(r.brand.first)}{r.brand.multi>0&&` → 多数回${fmt(r.brand.multi)}/月`}</div>
                  </td>
                  {showGE&&<td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums",background:r.ge?.applied?"#f0fdf4":"transparent"}}>
                    {r.ge?<>
                      <div style={{fontWeight:700,color:"#16a34a"}}>{fmt(r.ge.total)}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{r.genericNote}</div>
                    </>:<span style={{color:"#d1d5db"}}>—</span>}
                  </td>}
                  {showGE&&<td style={{padding:"6px 8px",textAlign:"right",fontVariantNumeric:"tabular-nums",fontWeight:600,color:r.saving>0?"#dc2626":"#94a3b8"}}>{r.saving!=null&&r.saving>0?`−${fmt(r.saving).slice(1)}`:"—"}</td>}
                  <td style={{padding:"6px 8px"}}>
                    {(()=>{
                      const tenB=r.monthlyBrand*months;
                      const barW=maxMedical>0?tenB/maxMedical*100:0;
                      const actB=r.brand.total;
                      const payPct=tenB>0?actB/tenB*100:100;
                      const saved=r.brand.rawTotal-actB;
                      const tipB=`10割 ${fmt(tenB)} → ${Math.round(rule.copay*10)}割 ${fmt(r.brand.rawTotal)} → 制度適用後 ${fmt(actB)}（${fmt(saved)} 軽減）`;
                      const tenG=r.monthlyGeneric!=null?r.monthlyGeneric*months:0;
                      const barWG=maxMedical>0?tenG/maxMedical*100:0;
                      const actG=r.ge?.total||0;
                      const payPctG=tenG>0?actG/tenG*100:100;
                      const savedG=r.ge?r.ge.rawTotal-actG:0;
                      const tipG=r.ge?`10割 ${fmt(tenG)} → ${Math.round(rule.copay*10)}割 ${fmt(r.ge.rawTotal)} → 制度適用後 ${fmt(actG)}（${fmt(savedG)} 軽減）`:"";
                      return(
                        <div style={{display:"flex",flexDirection:"column",gap:3}}>
                          <div title={tipB} style={{width:`${barW}%`,minWidth:4,height:14,borderRadius:4,background:"#bfdbfe",cursor:"default",overflow:"hidden"}}>
                            <div style={{width:`${payPct}%`,height:"100%",background:"#3b82f6",borderRadius:"4px 0 0 4px"}}/>
                          </div>
                          {showGE&&r.ge&&<div title={tipG} style={{width:`${barWG}%`,minWidth:4,height:14,borderRadius:4,background:"#bbf7d0",cursor:"default",overflow:"hidden"}}>
                            <div style={{width:`${payPctG}%`,height:"100%",background:"#22c55e",borderRadius:"4px 0 0 4px"}}/>
                          </div>}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── フッター ── */}
      <div style={{marginTop:20,padding:"16px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
        <FormulaTable ageId={ageId} incId={incId}/>

        <h3 style={{fontSize:13,fontWeight:700,color:"#0f172a",margin:"12px 0 8px"}}>📎 主要参考URL</h3>
        <ul style={{fontSize:11,color:"#64748b",margin:0,paddingLeft:16}}>
          {KOUGAKU.sourceUrls.map((s,i)=><li key={i} style={{marginBottom:2}}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{color:"#2563eb"}}>{s.label}</a></li>)}
        </ul>
        <p style={{fontSize:11,color:"#64748b",margin:"8px 0 0"}}>各レジメンの🔗から薬価の根拠URLを参照できます。</p>

        <div style={{marginTop:12,padding:"10px",background:"#fef2f2",borderRadius:6,border:"1px solid #fecaca"}}>
          <p style={{fontSize:10,color:"#991b1b",margin:0,lineHeight:1.6}}>
            <strong>⚠ 注意事項</strong><br/>
            ・本シミュレーターは概算です。実際の医療費は体重・体表面積・投与量調整・併用薬等により変動します。<br/>
            ・薬価は{KOUGAKU.lastChecked}時点の情報に基づいています。薬価改定により変更される場合があります。<br/>
            ・入院費・検査費・手術費は含まれていません。外来化学療法の薬剤費のみの概算です。<br/>
            ・<strong>支持療法費用について:</strong> 化学療法レジメンでは、制吐薬（アプレピタント等）・G-CSF（ジーラスタ等）・ステロイド等の支持療法が併用されるため、実際の総医療費は上記より＋1〜2万円/回程度高くなる場合があります。<br/>
            ・70歳以上の「一般」「住民税非課税」区分は外来のみの上限額を適用しています。入院がある場合は世帯ごとの上限額が適用されます。<br/>
            ・70歳以上の現役並み所得者は年齢に関わらず3割負担です。<br/>
            ・75歳以上の「一定以上所得」区分は2割負担です。<br/>
            ・限度額適用認定証の事前取得を推奨します。詳細は加入の健康保険にご確認ください。
          </p>
        </div>
      </div>
    </div>
  );
}
