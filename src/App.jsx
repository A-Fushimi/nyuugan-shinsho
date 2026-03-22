import { useState, useMemo, useRef, useEffect, createContext, useContext, useCallback } from "react";

const NavContext = createContext(null);

const UPDATED = "2026年3月22日";

// ===== 日本の標準治療（JBCS GL 2022 + WEB改訂 + 2025-2026新薬承認反映） =====
const SoC = [
  {sub:"HR+/HER2-",setting:"EBC（術後補助療法）",lines:[
    {line:"術後内分泌療法",regimens:["閉経前: TAM ± LHRHa（5-10年）","閉経前高リスク: AI + LHRHa（5年）","閉経後: AI（5年）→TAM switch可","延長療法: AI追加5年を考慮（高リスク）"],note:"OncotypeDX等の多遺伝子アッセイで化学療法省略の判断が可能（保険適用）"},
    {line:"術後内分泌+CDK4/6i",regimens:["abemaciclib 2年 + ET（monarchE準拠、高リスク）"],note:"Ki67≥20%またはN≥4個等の再発高リスク。GL2022 CQ6で強く推奨"},
    {line:"術後内分泌+S-1",regimens:["S-1 1年 + ET（POTENT準拠）"],note:"abemaciclibより対象が広い。GL2022 CQ5で強く推奨"},
    {line:"術後化学療法",regimens:["AC/EC→taxane（dose-dense or q3w）","TC（アンスラサイクリン回避）"],note:"再発リスク・患者背景に応じてレジメン選択"},
    {line:"術後 PARP阻害薬",regimens:["olaparib 1年（gBRCA変異陽性、HER2-高リスク）"],note:"OlympiA試験準拠。BRCAm検査必須"},
  ]},
  {sub:"HR+/HER2-",setting:"MBC（転移・再発）",lines:[
    {line:"1L 内分泌+CDK4/6i",regimens:["palbociclib + AI（またはfulvestrant）","abemaciclib + AI（またはfulvestrant）"],note:"標準1L治療。※ribociclibは日本未承認"},
    {line:"2L+ ESR1m陽性",regimens:["imlunestrant（イムルリオ）mono（ESR1m）","fulvestrant + everolimus","fulvestrant + alpelisib（PIK3CAm）","fulvestrant + capivasertib（AKT pathway altered）"],note:"ESR1m検査（ctDNA）で治療選択。イムルリオは2025/12日本承認。camizestrant, vepdegestrant, giredestrantはFDA申請中→今後選択肢追加"},
    {line:"2L+ PIK3CAm陽性",regimens:["alpelisib + fulvestrant","inavolisib + palbociclib + fulvestrant（日本未承認）"],note:"PIK3CA変異検査必須。inavolisibは中外製薬が日本開発中"},
    {line:"ADC",regimens:["T-DXd（エンハーツ）（HER2-low含む）","Dato-DXd（ダトロウェイ）（化学療法歴あり）","sacituzumab govitecan（トロデルビ）（日本未承認: HR+適応）"],note:"HER2-lowはIHC 1+ or IHC 2+/ISH-。T-DXdが標準。Dato-DXdは日本2024/12世界初承認"},
    {line:"化学療法",regimens:["eribulin, capecitabine, vinorelbine, GEM等"],note:"ADC後のlater lineで使用"},
  ]},
  {sub:"HER2+",setting:"EBC（術前・術後）",lines:[
    {line:"術前（NAC）",regimens:["AC/EC → taxane + HP（トラスツズマブ+ペルツズマブ）","taxane + HP → AC/EC（逆順も可）"],note:"pCR達成が術後治療選択の基準。フェスゴ（皮下注HP）使用可"},
    {line:"術後（pCR達成）",regimens:["HP 計1年（術前+術後で合計）"],note:"pCR達成時はde-escalationの議論あり"},
    {line:"術後（non-pCR）",regimens:["T-DM1（カドサイラ）14サイクル"],note:"KATHERINE試験準拠。T-DXd post-NACはFDA Priority Review中（2026 Q3）→今後変更の可能性"},
    {line:"術後PARP阻害薬",regimens:["olaparib 1年（gBRCA変異陽性の場合）"],note:"OlympiA試験対象に含まれる"},
  ]},
  {sub:"HER2+",setting:"MBC（転移・再発）",lines:[
    {line:"1L",regimens:["taxane + HP（トラスツズマブ+ペルツズマブ）","T-DXd + pertuzumab（DESTINY-Breast09準拠、日本未承認）"],note:"THP標準。DB-09でT-DXd+Pの優越性が示されたが日本未承認"},
    {line:"2L",regimens:["T-DXd（エンハーツ）","T-DM1（カドサイラ）"],note:"DB-03でT-DXdがT-DM1に対し圧倒的優越性。T-DXdが標準"},
    {line:"3L+",regimens:["tucatinib + trastuzumab + capecitabine（ツカイザ 2026/2承認）","T-DM1（2Lで未使用なら）","lapatinib + capecitabine","化学療法 + trastuzumab"],note:"ツカイザは脳転移に有効（BBB通過）。2026/2/19日本承認"},
    {line:"脳転移",regimens:["tucatinib + trastuzumab + capecitabine","T-DXd","放射線治療（SRS/WBRT）"],note:"ツカチニブのBBB通過性が差別化ポイント。DB-12進行中"},
  ]},
  {sub:"TNBC",setting:"EBC（術前・術後）",lines:[
    {line:"術前（NAC）",regimens:["pembrolizumab + 化学療法（AC/EC→PTX+CBDCA+pembro）"],note:"KEYNOTE-522準拠。CPS不問。GL2022 CQ16で弱く推奨→現在は標準治療化"},
    {line:"術後（pCR達成）",regimens:["pembrolizumab（術後9サイクル）"],note:"KN-522では術後pembro継続。pCR後のpembro省略はOptimICE-pCR試験で検証中"},
    {line:"術後（non-pCR）",regimens:["capecitabine 8サイクル（CREATE-X準拠）","pembrolizumab継続 ± capecitabine"],note:"capecitabineは保険適用外。olaparib（gBRCAm）も選択肢"},
    {line:"術後 PARP阻害薬",regimens:["olaparib 1年（gBRCA変異陽性、non-pCR）"],note:"OlympiA試験準拠"},
  ]},
  {sub:"TNBC",setting:"MBC（転移・再発）",lines:[
    {line:"1L（PD-L1陽性 CPS≥10）",regimens:["pembrolizumab + 化学療法（nab-PTX/PTX/GC）"],note:"KEYNOTE-355準拠。PD-L1 CPS検査必須"},
    {line:"1L（PD-L1陰性/IO不適）",regimens:["化学療法（anthracycline, taxane, eribulin等）","Dato-DXd（日本未承認。FDA Priority Review中）"],note:"IO不適のTNBC 1LはアンメットニーズA大。ASCENT-03（SG mono）も今後選択肢に"},
    {line:"2L+",regimens:["sacituzumab govitecan（トロデルビ）","T-DXd（エンハーツ）（HER2-low該当時）","化学療法"],note:"トロデルビ2024/3日本承認（TNBC）。HER2-low判定でT-DXd使用可"},
    {line:"gBRCA変異陽性",regimens:["olaparib（リムパーザ）","talazoparib（ターゼナ）"],note:"BRCA検査必須。化学療法との使い分け"},
  ]},
];

const S = {ok:"承認済",rev:"申請中",p3:"Ph III",p2:"Ph I-II",dev:"開発中",no:"未申請"};
const SC = {ok:"#16a34a",rev:"#2563eb",p3:"#7c3aed",p2:"#ea580c",dev:"#64748b",no:"#cbd5e1"};
const SB = {ok:"#dcfce7",rev:"#dbeafe",p3:"#ede9fe",p2:"#fff7ed",dev:"#f1f5f9",no:"#f8fafc"};

const DRUGS = [
  // ===== HR+/HER2- =====
  {id:1,name:"パルボシクリブ（イブランス）",generic:"palbociclib",co:"Pfizer",cls:"CDK4/6阻害薬",tgt:"CDK4/6",sub:["HR+/HER2-"],
   moa:"CDK4/6を選択的に阻害し細胞周期G1/S移行を阻害",
   pat:"🇺🇸 2027/3（PTE延長済）。ジェネリック6社準備済",
   ae:{freq:"好中球減少(80%), 疲労(35%), 悪心(30%)",severe:"G3/4好中球減少(66%), 発熱性好中球減少(1.8%)",note:"好中球減少は化学療法と異なり感染リスク低い。21日投与/7日休薬サイクル"},
   lc:[{s:2003,e:2005,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2005,e:2009,c:"#F4C0D1",tc:"#72243E",t:"Ph I/II"},{s:2009,e:2015,c:"#ED93B1",tc:"#4B1528",t:"Ph II-III"},{s:2015,e:2026.2,c:"#5DCAA5",tc:"#04342C",t:"上市・成長期"},{s:2026.2,e:2027.3,c:"#FAC775",tc:"#633806",t:"クリフ"},{s:2027.3,e:2034,c:"#D3D1C7",tc:"#444441",t:"GE時代"}],
   us:{s:"ok",t:"承認済 2015/2",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=207103"},eu:{s:"ok",t:"承認済 2016/11",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/ibrance"},jp:{s:"ok",t:"承認済 2017/9 イブランス",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00067584"},
   studies:[{n:"PD0332991前臨床",ph:"Pre",pop:"ER+乳がん細胞株47系統",arm:"PD0332991",ctrl:"無処理",res:"Luminal ER+株に高感受性。Rb+/CyclinD1高発現が感受性予測因子",st:"pos",pr:"Breast Cancer Res 2009",url:"https://link.springer.com/article/10.1186/bcr2419"},{n:"PALOMA-1",ph:"I/II",pop:"HR+/HER2- 1L MBC 165例",arm:"palbociclib + letrozole",ctrl:"letrozole",res:"mPFS 20.2 vs 10.2m (HR 0.49)",st:"pos",pr:"Lancet Oncol 2015",url:"https://pubmed.ncbi.nlm.nih.gov/25524798/"},{n:"PALOMA-2",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"palbociclib + letrozole",ctrl:"placebo + letrozole",res:"mPFS 24.8 vs 14.5m (HR 0.58)",st:"pos",pr:"NEJM 2016",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1607303"},{n:"PALOMA-3",ph:"III",pop:"HR+/HER2- 2L+ MBC",arm:"palbociclib + fulvestrant",ctrl:"placebo + fulvestrant",res:"mPFS 9.5 vs 4.6m (HR 0.46)",st:"pos",pr:"NEJM 2016",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1505270"}],next:"2027年パテントクリフ。後続CDK4i atirmociclibへ"},
  {id:2,name:"リボシクリブ（キスカリ）",generic:"ribociclib",co:"Novartis",cls:"CDK4/6阻害薬",tgt:"CDK4/6",sub:["HR+/HER2-"],
   moa:"CDK4/6阻害",
   pat:"🇺🇸 2028-2029年頃",
   ae:{freq:"好中球減少(74%), 悪心(52%), 疲労(37%), 下痢(35%)",severe:"G3/4好中球減少(60%), QTc延長(3.3%), 肝酵素上昇G3/4(9%)",note:"QTc延長に注意→ECGモニタリング必須（開始前・2週後）。CYP3A4阻害薬との併用禁忌。タモキシフェン併用不可"},
   lc:[{s:2010,e:2014,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2014,e:2017,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2017,e:2028,c:"#5DCAA5",tc:"#04342C",t:"上市・成長期"},{s:2028,e:2030,c:"#FAC775",tc:"#633806",t:"クリフ"},{s:2030,e:2034,c:"#D3D1C7",tc:"#444441",t:"GE時代"}],
   us:{s:"ok",t:"承認済 2017/3",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=209092"},eu:{s:"ok",t:"承認済 2017/8",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/kisqali"},jp:{s:"no",t:"日本未承認（2017年開発断念。類薬palbociclib承認による）"},
   studies:[{n:"LEE011前臨床",ph:"Pre",pop:"ER+乳がんマウスモデル",arm:"LEE011単剤/ET併用",ctrl:"未治療",res:"単剤で腫瘍増殖抑制、ET併用で持続的腫瘍退縮",st:"pos",pr:"Mol Cancer Ther 2016",url:"https://pubmed.ncbi.nlm.nih.gov/27196776/"},{n:"MONALEESA-2",ph:"III",pop:"HR+/HER2- 閉経後 1L MBC",arm:"ribociclib + letrozole",ctrl:"placebo + letrozole",res:"mOS 63.9 vs 51.4m (HR 0.76)",st:"pos",pr:"NEJM 2022",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2114663"},{n:"MONALEESA-7",ph:"III",pop:"HR+/HER2- 閉経前 1L MBC",arm:"ribociclib + ET + goserelin",ctrl:"placebo + ET + goserelin",res:"mPFS 23.8 vs 13.0m",st:"pos",pr:"NEJM 2019",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1903765"},{n:"NATALEE",ph:"III",pop:"HR+/HER2- EBC術後",arm:"ribociclib 400mg + ET",ctrl:"ET alone",res:"3y iDFS 90.4% vs 87.1% (HR 0.75)",st:"pos",pr:"SABCS 2023",url:"https://pubmed.ncbi.nlm.nih.gov/38081202/"}],next:"日本未承認（ドラッグロス）。EBC術後データ成熟中"},
  {id:3,name:"アベマシクリブ（ベージニオ）",generic:"abemaciclib",co:"Eli Lilly",cls:"CDK4/6阻害薬",tgt:"CDK4/6",sub:["HR+/HER2-"],
   moa:"CDK4/6阻害（CDK4優位選択性）。連日投与（休薬なし）",
   pat:"🇺🇸 2031年頃（最早ジェネリック参入見込み）",
   ae:{freq:"下痢(81-90%), 好中球減少(41-46%), 疲労(40%), 悪心(39%)",severe:"G3/4下痢(8%), G3/4好中球減少(20%), 血栓塞栓症(5%), ILD(2.1%)",note:"下痢は早期から出現→ロペラミド早期介入が重要。IBDの患者は避けるべき。連日投与（休薬なし）"},
   lc:[{s:2009,e:2013,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2013,e:2017,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2017,e:2031,c:"#5DCAA5",tc:"#04342C",t:"上市・成長期"},{s:2031,e:2034,c:"#FAC775",tc:"#633806",t:"クリフ"}],
   us:{s:"ok",t:"承認済 2017/9",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=208855"},eu:{s:"ok",t:"承認済 2018/10",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/verzenios"},jp:{s:"ok",t:"承認済 2018/11 ベージニオ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00068498"},
   studies:[{n:"LY2835219前臨床",ph:"Pre",pop:"ER+乳がん異種移植モデル",arm:"LY2835219",ctrl:"未治療",res:"CDK4選択性高い。連続投与で抗腫瘍活性。BBB通過性あり",st:"pos",pr:"Invest New Drugs 2014",url:"https://pubmed.ncbi.nlm.nih.gov/24919854/"},{n:"MONARCH-1",ph:"II",pop:"HR+/HER2- MBC多治療歴後",arm:"abemaciclib 200mg mono",ctrl:"なし",res:"ORR 19.7%, CBR 42.4%, mPFS 6.0m",st:"pos",pr:"Clin Cancer Res 2017",url:"https://pubmed.ncbi.nlm.nih.gov/28874378/"},{n:"monarchE",ph:"III",pop:"HR+/HER2- 高リスクEBC術後",arm:"abemaciclib 2年 + ET",ctrl:"ET alone",res:"4y iDFS HR 0.664, 5y OS HR 0.903",st:"pos",pr:"ASCO 2023 / Lancet 2024",url:"https://pubmed.ncbi.nlm.nih.gov/37279509/"},{n:"MONARCH-2",ph:"III",pop:"HR+/HER2- 2L MBC",arm:"abemaciclib + fulvestrant",ctrl:"placebo + fulvestrant",res:"mPFS 16.4 vs 9.3m (HR 0.55)",st:"pos",pr:"JCO 2020",url:"https://pubmed.ncbi.nlm.nih.gov/31461380/"}],next:"monarchE長期OS追跡"},
  {id:4,name:"イムルネストラント（イムルリオ）",generic:"imlunestrant",co:"Eli Lilly",cls:"経口SERD",tgt:"ER",sub:["HR+/HER2-"],
   moa:"ERに結合し分解を促進する経口SERD。国内初の経口SERD",
   pat:"🇺🇸 2040年代（新薬、複数特許保護期間長い）",
   ae:{freq:"疲労(23%), 下痢(21%), 悪心(17%), 関節痛(14%)",severe:"G3以上は17%。重篤AE 10%",note:"フルベストラント（注射）と比較して経口投与の利便性。胚・胎児毒性あり→避妊必須"},
   lc:[{s:2017,e:2020,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2020,e:2025,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2025,e:2040,c:"#5DCAA5",tc:"#04342C",t:"上市・成長期"}],
   us:{s:"ok",t:"承認済 2025/9 Inluriyo",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=219060"},eu:{s:"ok",t:"承認済 2026/1",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/inluriyo"},jp:{s:"ok",t:"承認済 2025/12/22 イムルリオ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00072345"},
   studies:[{n:"LY3484356前臨床",ph:"Pre",pop:"ESR1変異ER+乳がんモデル",arm:"imlunestrant",ctrl:"fulvestrant",res:"ESR1 Y537S/D538G変異モデルでER完全分解。fulvestrant超える腫瘍退縮",st:"pos",pr:"Cancer Res 2021",url:"https://pubmed.ncbi.nlm.nih.gov/34162665/"},{n:"EMBER Phase I",ph:"I",pop:"HR+/HER2- MBC",arm:"imlunestrant単剤",ctrl:"なし",res:"CBR 40%、ESR1m群CBR 51%",st:"pos",pr:"JCO 2023",url:"https://pubmed.ncbi.nlm.nih.gov/36917510/"},{n:"EMBER-3",ph:"III",pop:"HR+/HER2- ESR1m MBC 2L+",arm:"imlunestrant mono / imlunestrant + abemaciclib",ctrl:"fulvestrant or exemestane（医師選択）",res:"ESR1m群 mPFS 5.5 vs 3.8m (HR 0.62)",st:"pos",pr:"NEJM 2025",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2412763"},{n:"EMBER-4",ph:"III",pop:"HR+/HER2- EBC 術後",arm:"imlunestrant",ctrl:"standard ET",res:"進行中 約8000例",st:"run",pr:"結果待ち"}],next:"EMBER-4（術後EBC）結果待ち"},
  {id:5,name:"エラセストラント（オルセルデュ）",generic:"elacestrant",co:"Menarini/Radius",cls:"経口SERD",tgt:"ER",sub:["HR+/HER2-"],
   moa:"ERに結合し分解する初の経口SERD",pat:"🇺🇸 2035年頃",
   ae:{freq:"悪心(35%), 筋骨格痛(30%), 疲労(26%)",severe:"G3以上 7%。良好な忍容性",note:"初の経口SERDとして承認されたが臨床効果は限定的"},
   us:{s:"ok",t:"承認済 2023/1 Orserdu",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=217639"},eu:{s:"ok",t:"承認済 2023/12",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/orserdu"},jp:{s:"no",t:"日本未申請（ドラッグラグ懸念）"},
   studies:[{n:"RAD1901前臨床",ph:"Pre",pop:"ESR1変異PDXモデル",arm:"RAD1901（elacestrant）",ctrl:"fulvestrant",res:"ESR1変異モデルでfulvestrantと同等以上の活性。経口BA良好",st:"pos",pr:"Clin Cancer Res 2017",url:"https://pubmed.ncbi.nlm.nih.gov/28468947/"},{n:"EMERALD",ph:"III",pop:"HR+/HER2- ESR1m MBC 2L+",arm:"elacestrant mono",ctrl:"fulvestrant or AI（医師選択）",res:"ESR1m群 mPFS 3.8 vs 1.9m (HR 0.55)",st:"pos",pr:"JCO 2022",url:"https://pubmed.ncbi.nlm.nih.gov/35944924/"}],next:"日本開発未定"},
  {id:6,name:"カミゼストラント",generic:"camizestrant",co:"AstraZeneca",cls:"経口SERD",tgt:"ER",sub:["HR+/HER2-"],
   moa:"次世代経口SERD、完全ERアンタゴニスト",
   ae:{freq:"光視症(photopsia)(32%), 疲労, 悪心",severe:"光視症はG1が90%。視力への影響なし。投与中断なし",note:"視覚系AEが特徴的。ESR1変異出現時の分子進行に基づくスイッチ戦略"},
   us:{s:"rev",t:"FDA NDA申請中、FDA諮問委員会 4/30、FDA承認予定 2026 H1"},eu:{s:"rev",t:"EMA申請中"},jp:{s:"dev",t:"SERENA-4に日本参加。FDA承認後申請見込み"},
   studies:[{n:"AZD9833前臨床",ph:"Pre",pop:"ESR1wt/m ER+乳がんPDXモデル",arm:"AZD9833（camizestrant）",ctrl:"fulvestrant",res:"ESR1変異モデルでfulvestrant超える活性。CDK4/6i併用で相乗効果。ET+CDK4/6i耐性克服",st:"pos",pr:"Cancer Discov 2023",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC10690091/"},{n:"SERENA-1",ph:"I",pop:"ER+/HER2- MBC 108例",arm:"camizestrant 25-450mg mono",ctrl:"なし（用量漸増+拡大）",res:"ORR 7.8%, CBR 34.3%。75mg以上で有効。光視症32%（G1主体）",st:"pos",pr:"Lancet Oncol 2024",url:"https://pubmed.ncbi.nlm.nih.gov/38729567/"},{n:"SERENA-6",ph:"III",pop:"HR+/HER2- ESR1m出現時 1L MBC",arm:"camizestrant + CDK4/6i（AI→スイッチ）",ctrl:"AI + CDK4/6i 継続",res:"mPFS 16.0 vs 9.2m (HR 0.44)",st:"pos",pr:"ASCO 2025 LBA"},{n:"SERENA-4",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"camizestrant + palbociclib",ctrl:"AI + palbociclib",res:"進行中",st:"run",pr:"2026 H2"}],next:"FDA諮問委員会 4/30→FDA承認判断"},
  {id:7,name:"ベプデゲストラント",generic:"vepdegestrant",co:"Arvinas/Pfizer",cls:"PROTAC ER分解薬",tgt:"ER",sub:["HR+/HER2-"],
   moa:"初のPROTAC技術によるER標的蛋白分解",
   ae:{freq:"疲労(27%), ALT/AST上昇(14%), 悪心(13%), 貧血(12%)",severe:"G3以上 23%。投与中止率3%",note:"初のPROTAC臨床応用。QTc延長は少ないが頻度低い"},
   us:{s:"rev",t:"FDA NDA申請中 FDA承認予定 6/5/2026"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本開発未定（out-license検討中）"},
   studies:[{n:"ARV-471前臨床",ph:"Pre",pop:"ER+乳がんモデル（ESR1m含む）",arm:"ARV-471（vepdegestrant）",ctrl:"fulvestrant",res:"PROTAC技術で>90% ER分解。CDK4/6i耐性モデルでも有効。初のPROTAC臨床候補",st:"pos",pr:"Cancer Discov 2022",url:"https://pubmed.ncbi.nlm.nih.gov/35045997/"},{n:"Phase I/Ib",ph:"I",pop:"ER+/HER2- MBC多治療歴後",arm:"ARV-471 30-700mg mono/palbociclib併用",ctrl:"なし",res:"ER分解62-89%。mono ORR 7%, CBR 39%",st:"pos",pr:"Nature 2023",url:"https://pubmed.ncbi.nlm.nih.gov/37821702/"},{n:"VERITAC-2",ph:"III",pop:"HR+/HER2- ESR1m MBC 2L+",arm:"vepdegestrant 200mg mono",ctrl:"fulvestrant 500mg IM",res:"ESR1m群 mPFS 5.0 vs 2.1m (HR 0.57)",st:"pos",pr:"ASCO 2025 LBA / NEJM"}],next:"FDA FDA承認予定 6/5/2026"},
  {id:8,name:"ギレデストラント",generic:"giredestrant",co:"Roche",cls:"経口SERD",tgt:"ER",sub:["HR+/HER2-"],
   moa:"次世代経口SERD・完全ERアンタゴニスト",
   ae:{freq:"関節痛, 疲労, 悪心（概ね既知SERDプロファイル）",severe:"evERA: G3以上はgiredestrant群とSoC群で同等",note:"光視症はcamizestrantと異なり報告なし"},
   us:{s:"rev",t:"FDA NDA受理 FDA承認予定 12/18/2026"},eu:{s:"rev",t:"EMA申請中"},jp:{s:"dev",t:"中外製薬開発中。FDA承認後日本申請見込み"},
   studies:[{n:"GDC-9545前臨床",ph:"Pre",pop:"ESR1変異ER+乳がんモデル",arm:"GDC-9545（giredestrant）",ctrl:"fulvestrant",res:"完全ERアンタゴニスト。ESR1 Y537S/D538G変異モデルで活性維持",st:"pos",pr:"Cancer Res 2021",url:"https://pubmed.ncbi.nlm.nih.gov/33903116/"},{n:"acelERA Phase I/II",ph:"I/II",pop:"ER+/HER2- MBC前治療歴あり",arm:"giredestrant 10-250mg mono",ctrl:"なし（用量漸増+拡大）",res:"推奨用量30mg。ORR 12%, CBR 44%",st:"pos",pr:"JCO 2022",url:"https://pubmed.ncbi.nlm.nih.gov/35925770/"},{n:"evERA",ph:"III",pop:"HR+/HER2- post-CDK4/6i MBC",arm:"giredestrant + everolimus",ctrl:"SoC ET + everolimus",res:"ESR1m群 mPFS 9.99 vs 5.45m (HR 0.38)。ITT HR 0.56",st:"pos",pr:"ESMO 2025"},{n:"lidERA",ph:"III",pop:"HR+/HER2- EBC 術後",arm:"giredestrant",ctrl:"SoC ET（AI or tamoxifen）",res:"3y iDFS 92.4% vs 89.6% (HR 0.70)",st:"pos",pr:"SABCS 2025"},{n:"persevERA",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"giredestrant + palbociclib",ctrl:"letrozole + palbociclib",res:"主要EP未達",st:"neg",pr:"2026/3/9"},{n:"pionERA",ph:"III",pop:"HR+/HER2- ET耐性 MBC",arm:"giredestrant + CDK4/6i（医師選択）",ctrl:"fulvestrant + CDK4/6i",res:"進行中",st:"run",pr:"readout 2027"}],next:"FDA FDA承認予定 12/18/2026。pionERA 2027年"},
  {id:9,name:"アルペリシブ（ピキレイ）",generic:"alpelisib",co:"Novartis",cls:"PI3Kα阻害薬",tgt:"PI3Kα",sub:["HR+/HER2-"],
   moa:"PIK3CA変異腫瘍のPI3Kαを選択的に阻害",pat:"🇺🇸 2030年頃",
   ae:{freq:"高血糖(65%), 下痢(58%), 悪心(45%), 発疹(36%)",severe:"G3/4高血糖(37%), G3発疹(10%)",note:"高血糖管理が最大の課題→HbA1c・FBS定期モニタリング必須。DM既往は要注意"},
   us:{s:"ok",t:"承認済 2019/5 Piqray",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=212526"},eu:{s:"ok",t:"承認済 2020/7",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/piqray"},jp:{s:"ok",t:"承認済 2022/3 ピキレイ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00070738"},
   studies:[{n:"BYL719前臨床",ph:"Pre",pop:"PIK3CA変異乳がんモデル",arm:"BYL719",ctrl:"非変異モデル",res:"PIK3CA変異選択的活性。ET併用で相乗効果",st:"pos",pr:"Mol Cancer Ther 2014",url:"https://pubmed.ncbi.nlm.nih.gov/24634412/"},{n:"SOLAR-1",ph:"III",pop:"HR+/HER2- PIK3CAm MBC",arm:"alpelisib + fulvestrant",ctrl:"placebo + fulvestrant",res:"mPFS 11.0 vs 5.7m (HR 0.65)",st:"pos",pr:"NEJM 2019",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1813904"}],next:"inavolisibとの棲み分け"},
  {id:10,name:"イナボリシブ（イトベビ）",generic:"inavolisib",co:"Roche",cls:"PI3Kα阻害薬",tgt:"PI3Kα",sub:["HR+/HER2-"],
   moa:"PIK3CA変異選択的PI3Kα阻害（変異選択性高くalpelisibより高血糖軽減）",pat:"🇺🇸 2035年頃（新薬）",
   ae:{freq:"口内炎(54%), 下痢(44%), 高血糖(40%)",severe:"G3高血糖はalpelisibより低い（約15%）",note:"alpelisibより忍容性改善が期待される次世代PI3Ki"},
   us:{s:"ok",t:"承認済 2024/10 Itovebi",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=218438"},eu:{s:"ok",t:"承認済 2025/2",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/itovebi"},jp:{s:"dev",t:"中外製薬開発中。2026年以降申請見込み"},
   studies:[{n:"GDC-0077前臨床",ph:"Pre",pop:"PIK3CA変異乳がんモデル",arm:"inavolisib",ctrl:"alpelisib",res:"変異選択性30倍。変異PI3Kα分解誘導→高血糖軽減",st:"pos",pr:"Cancer Cell 2021",url:"https://pubmed.ncbi.nlm.nih.gov/33689693/"},{n:"INAVO120",ph:"III",pop:"HR+/HER2- PIK3CAm 1L MBC",arm:"inavolisib + palbociclib + fulvestrant",ctrl:"placebo + palbociclib + fulvestrant",res:"mPFS 15.0 vs 7.3m (HR 0.43)",st:"pos",pr:"NEJM 2024",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2404625"}],next:"日本承認申請見込み 2026年以降"},
  {id:11,name:"カピバセルチブ（トルカップ）",generic:"capivasertib",co:"AstraZeneca",cls:"AKT阻害薬",tgt:"AKT",sub:["HR+/HER2-"],
   moa:"AKT1/2/3を阻害しPI3K/AKT経路を遮断",pat:"🇺🇸 2036年頃（新薬）",
   ae:{freq:"下痢(72%), 発疹(38%), 悪心(30%), 高血糖(16%)",severe:"G3/4下痢(9%), 発疹G3(12%)",note:"4日投与/3日休薬スケジュール。発疹は早期ステロイド介入で管理"},
   us:{s:"ok",t:"承認済 2023/11 Truqap",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=218197"},eu:{s:"ok",t:"承認済 2024/4",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/truqap"},jp:{s:"ok",t:"承認済 2024/9 トルカップ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00071880"},
   studies:[{n:"AZD5363前臨床",ph:"Pre",pop:"AKT pathway活性化乳がんモデル",arm:"AZD5363",ctrl:"未治療",res:"AKT1/2/3阻害。PIK3CA/PTEN変異モデルに選択的",st:"pos",pr:"Mol Cancer Ther 2012",url:"https://pubmed.ncbi.nlm.nih.gov/22246438/"},{n:"FAKTION",ph:"II",pop:"HR+/HER2- MBC AI耐性",arm:"capivasertib + fulvestrant",ctrl:"placebo + fulvestrant",res:"mPFS 10.3 vs 4.8m (HR 0.58)",st:"pos",pr:"Lancet Oncol 2020",url:"https://pubmed.ncbi.nlm.nih.gov/31806539/"},{n:"CAPItello-291",ph:"III",pop:"HR+/HER2- MBC 2L+",arm:"capivasertib + fulvestrant",ctrl:"placebo + fulvestrant",res:"AKT pathway altered群 mPFS 7.2 vs 3.6m (HR 0.50)",st:"pos",pr:"NEJM 2023",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2214131"},{n:"CAPItello-292",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"capivasertib + CDK4/6i + fulvestrant",ctrl:"placebo + CDK4/6i + fulvestrant",res:"進行中",st:"run",pr:"readout 2027"}],next:"CAPItello-292 1L試験進行中 2027年"},
  {id:12,name:"エベロリムス（アフィニトール）",generic:"everolimus",co:"Novartis",cls:"mTOR阻害薬",tgt:"mTOR",sub:["HR+/HER2-"],
   moa:"mTOR阻害によりPI3K/AKT/mTOR経路を遮断",pat:"🇺🇸 特許満了済み。ジェネリック上市済",
   ae:{freq:"口内炎(59%), 発疹(36%), 疲労(33%), 下痢(30%)",severe:"G3口内炎(8%), 肺臓炎(3-12%), 高血糖G3(5%)",note:"口内炎にはデキサメタゾン含嗽が有効。肺臓炎リスクあり→定期CT推奨"},
   us:{s:"ok",t:"承認済 2012/7",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=022334"},eu:{s:"ok",t:"承認済 2012/8",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/afinitor"},jp:{s:"ok",t:"承認済 2014/3 アフィニトール",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00065447"},
   studies:[{n:"RAD001前臨床",ph:"Pre",pop:"ET耐性ER+乳がんモデル",arm:"RAD001+letrozole",ctrl:"letrozole",res:"mTOR阻害によりET耐性克服。AI併用で腫瘍退縮",st:"pos",pr:"Clin Cancer Res 2008",url:"https://pubmed.ncbi.nlm.nih.gov/18519768/"},{n:"BOLERO-2",ph:"III",pop:"HR+/HER2- MBC 2L+",arm:"everolimus + exemestane",ctrl:"placebo + exemestane",res:"mPFS 6.9 vs 2.8m (HR 0.43)",st:"pos",pr:"NEJM 2012",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1109653"}],next:"giredestrant併用（evERA）で再注目"},
  {id:13,name:"アチルモシクリブ",generic:"atirmociclib",co:"Pfizer",cls:"次世代CDK4阻害薬",tgt:"CDK4",sub:["HR+/HER2-"],
   moa:"CDK4選択的阻害（CDK6非阻害→好中球減少軽減期待）",
   ae:{freq:"投与中止率6.4%。好中球減少はCDK4/6iより軽度の可能性",severe:"詳細未公表（Phase II）",note:"CDK6非阻害により好中球減少の大幅軽減が期待される"},
   us:{s:"p2",t:"Ph2 FOURLIGHT-1 positive。Ph3 FOURLIGHT-3進行中"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本開発未確認"},
   studies:[{n:"PF-07220060前臨床",ph:"Pre",pop:"ER+乳がん/CDK4/6i耐性モデル",arm:"atirmociclib",ctrl:"palbociclib",res:"CDK4選択的（CDK6 IC50>100倍差）。好中球減少理論的に軽減。palbo耐性モデルでも有効",st:"pos",pr:"Cancer Res 2023",url:"https://pubmed.ncbi.nlm.nih.gov/36649094/"},{n:"Phase I",ph:"I",pop:"HR+/HER2- MBC CDK4/6i後",arm:"atirmociclib mono/ET併用",ctrl:"なし",res:"G3/4好中球減少率が既存CDK4/6iより著明に低い",st:"pos",pr:"SABCS 2023",url:"https://pubmed.ncbi.nlm.nih.gov/37979755/"},{n:"FOURLIGHT-1",ph:"II",pop:"HR+/HER2- MBC 2L post-CDK4/6i",arm:"atirmociclib + fulvestrant",ctrl:"fulvestrant alone / everolimus + exemestane",res:"PFS HR 0.60 (p=0.0007)",st:"pos",pr:"2026/3/17"},{n:"FOURLIGHT-3",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"atirmociclib + AI",ctrl:"CDK4/6i + AI",res:"進行中",st:"run",pr:"readout 2027"}],next:"Ph3 FOURLIGHT-3 readout 2027"},
  {id:14,name:"ゲダトリシブ",generic:"gedatolisib",co:"Pfizer/Celcuity",cls:"PI3K/mTOR二重阻害薬",tgt:"PI3K/mTOR",sub:["HR+/HER2-"],
   moa:"PI3KとmTORを同時に阻害（IV製剤）",
   us:{s:"rev",t:"FDA NDA申請済"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本開発未定"},
   studies:[{n:"PF-05212384前臨床",ph:"Pre",pop:"PI3K/mTOR活性化乳がんモデル",arm:"gedatolisib+CDK4/6i",ctrl:"CDK4/6i",res:"PI3K/mTOR同時阻害でCDK4/6i耐性克服。バイオマーカー非依存",st:"pos",pr:"Mol Cancer Ther 2016",url:"https://pubmed.ncbi.nlm.nih.gov/27196767/"},{n:"Phase I",ph:"I",pop:"固形がん（乳がんコホート）",arm:"gedatolisib IV+palbociclib+fulvestrant",ctrl:"なし",res:"乳がんORR 33%。DLTは口内炎・高血糖",st:"pos",pr:"Clin Cancer Res 2020",url:"https://pubmed.ncbi.nlm.nih.gov/32238405/"},{n:"VIKTORIA-1",ph:"III",pop:"HR+/HER2- 1L MBC",arm:"gedatolisib + palbociclib + fulvestrant",ctrl:"palbociclib + fulvestrant",res:"PFS有意改善",st:"pos",pr:"SABCS 2024"}],next:"FDA承認判断 2026年"},
  {id:15,name:"プリフェトラスタット",generic:"prifetrastat",co:"Pfizer",cls:"KAT6阻害薬",tgt:"KAT6A/B",sub:["HR+/HER2-"],
   moa:"KAT6A/B阻害によるERシグナル抑制",
   us:{s:"p3",t:"Phase III KATSIS-1進行中"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本開発不明"},
   studies:[{n:"PF-07248144前臨床",ph:"Pre",pop:"ER+乳がん/CDK4/6i耐性モデル",arm:"prifetrastat",ctrl:"CDK4/6i",res:"KAT6A/B阻害→ER転写抑制。CDK4/6i耐性モデルでも有効",st:"pos",pr:"Cancer Res 2024",url:"https://aacrjournals.org/cancerres/article/84/6_Supplement/3986/738816"},{n:"Phase I/II",ph:"I/II",pop:"HR+/HER2- MBC post-CDK4/6i",arm:"prifetrastat+fulvestrant",ctrl:"なし",res:"予備的有効性確認。推奨Ph3用量決定",st:"pos",pr:"SABCS 2023",url:"https://pubmed.ncbi.nlm.nih.gov/38179693/"},{n:"KATSIS-1",ph:"III",pop:"HR+/HER2- MBC post-CDK4/6i",arm:"prifetrastat + fulvestrant",ctrl:"everolimus + ET（医師選択）",res:"進行中",st:"run",pr:"readout 2027"}],next:"KATSIS-1 readout 2027"},
  // ===== HER2+ =====
  {id:20,name:"T-DXd エンハーツ",generic:"trastuzumab deruxtecan",co:"Daiichi Sankyo/AZ",cls:"ADC（HER2）",tgt:"HER2",sub:["HER2+","HER2-low","HR+/HER2-"],
   moa:"HER2標的ADC、DXdペイロードによるバイスタンダー効果",
   pat:"🇺🇸 2033年（物質特許）、🇪🇺 2033-2035年",
   ae:{freq:"悪心(73%), 疲労(47%), 嘔吐(36%), 脱毛(36%), 好中球減少(34%)",severe:"ILD/肺臓炎(15.2%, G5含む)→最重要AE。G3以上好中球減少(16%)",note:"ILDは投与開始後中央値5ヶ月で発症。定期的な胸部画像・呼吸器症状モニタリング必須。Grade2以上は永続中止"},
   lc:[{s:2013,e:2016,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2016,e:2019.9,c:"#F4C0D1",tc:"#72243E",t:"Ph I-II"},{s:2019.9,e:2033,c:"#5DCAA5",tc:"#04342C",t:"上市・適応拡大"},{s:2033,e:2036,c:"#FAC775",tc:"#633806",t:"特許クリフ"}],
   indications:[
     {label:"HER2+ MBC 2L+",us:{s:"ok",t:"承認済"},eu:{s:"ok",t:"承認済"},jp:{s:"ok",t:"承認済 エンハーツ"}},
     {label:"HER2+ MBC 1L（+P）",us:{s:"ok",t:"承認済 2025/12"},eu:{s:"rev",t:"EMA申請中"},jp:{s:"dev",t:"第一三共開発中"}},
     {label:"HER2+ EBC post-NAC",us:{s:"rev",t:"Priority Review FDA承認予定 2026 Q3"},eu:{s:"dev",t:"申請予定"},jp:{s:"dev",t:"申請準備中"}},
     {label:"HER2-low MBC",us:{s:"ok",t:"承認済 2022/8"},eu:{s:"ok",t:"承認済"},jp:{s:"ok",t:"承認済"}},
   ],
   us:{s:"ok",t:""},eu:{s:"ok",t:""},jp:{s:"ok",t:""},
   studies:[{n:"DS-8201a前臨床",ph:"Pre",pop:"HER2+/HER2-low異種移植",arm:"DS-8201a",ctrl:"T-DM1",res:"DAR~8。バイスタンダー効果でHER2-low腫瘍にも有効。T-DM1を上回る抗腫瘍活性",st:"pos",pr:"Clin Cancer Res 2016",url:"https://pubmed.ncbi.nlm.nih.gov/27026201/"},{n:"Phase I (FIH)",ph:"I",pop:"HER2+固形がん（乳がん含む）24例",arm:"T-DXd 0.8-8.0mg/kg Q3W",ctrl:"なし（用量漸増）",res:"乳がんORR 59%。推奨用量5.4mg/kg決定",st:"pos",pr:"Lancet Oncol 2017",url:"https://pubmed.ncbi.nlm.nih.gov/29037983/"},{n:"DB-03",ph:"III",pop:"HER2+ MBC 2L",arm:"T-DXd 5.4mg/kg",ctrl:"T-DM1",res:"mPFS 28.8 vs 6.8m (HR 0.33)",st:"pos",pr:"Lancet 2023",url:"https://pubmed.ncbi.nlm.nih.gov/36828498/"},{n:"DB-09",ph:"III",pop:"HER2+ 1L MBC",arm:"T-DXd + pertuzumab",ctrl:"taxane + trastuzumab + pertuzumab (THP)",res:"mPFS 40.7 vs 26.9m (HR 0.63)",st:"pos",pr:"ESMO 2025 LBA"},{n:"DB-05",ph:"III",pop:"HER2+ EBC post-NAC residual",arm:"T-DXd",ctrl:"T-DM1",res:"iDFS有意改善",st:"pos",pr:"ESMO 2025 LBA"},{n:"DB-04",ph:"III",pop:"HER2-low MBC 2L+",arm:"T-DXd 5.4mg/kg",ctrl:"医師選択化学療法",res:"mPFS 9.9 vs 5.1m (HR 0.50)",st:"pos",pr:"NEJM 2022",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2203690"},{n:"DB-06",ph:"III",pop:"HER2-low MBC 1L",arm:"T-DXd 5.4mg/kg",ctrl:"医師選択化学療法",res:"mPFS 13.2 vs 8.1m (HR 0.62)",st:"pos",pr:"ASCO 2024",url:"https://pubmed.ncbi.nlm.nih.gov/38815179/"},{n:"DB-12",ph:"III",pop:"HER2+ MBC 脳転移",arm:"T-DXd",ctrl:"医師選択治療",res:"進行中",st:"run",pr:"readout 2027"}],next:"post-NAC FDA FDA承認予定 2026 Q3。DB-12脳転移試験進行中"},
  {id:21,name:"T-DM1 カドサイラ",generic:"trastuzumab emtansine",co:"Roche",cls:"ADC（HER2）",tgt:"HER2",sub:["HER2+"],
   moa:"HER2標的ADC（DM1ペイロード）",pat:"🇺🇸 2028年頃（バイオシミラー参入見込み）",
   ae:{freq:"疲労(36%), 悪心(34%), 血小板減少(28%)",severe:"G3/4血小板減少(13%), 肝毒性G3(4%)",note:"T-DXdと比較して忍容性良好で長期投与可能。血小板減少はT-DXdにない特徴的AE"},
   lc:[{s:2008,e:2013,c:"#F4C0D1",tc:"#72243E",t:"開発"},{s:2013,e:2028,c:"#5DCAA5",tc:"#04342C",t:"上市"},{s:2028,e:2032,c:"#FAC775",tc:"#633806",t:"クリフ"}],
   us:{s:"ok",t:"承認済 2013/2",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=125427"},eu:{s:"ok",t:"承認済 2013/11",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/kadcyla"},jp:{s:"ok",t:"承認済 2013/9 カドサイラ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00064747"},
   studies:[{n:"T-DM1前臨床",ph:"Pre",pop:"HER2+乳がん異種移植モデル",arm:"T-DM1",ctrl:"trastuzumab/DM1単独",res:"ADCがHER2+腫瘍に選択的に集積。トラスツズマブ単独を超える腫瘍退縮",st:"pos",pr:"Mol Cancer Ther 2008",url:"https://pubmed.ncbi.nlm.nih.gov/18566225/"},{n:"EMILIA",ph:"III",pop:"HER2+ MBC 2L",arm:"T-DM1",ctrl:"lapatinib+capecitabine",res:"mPFS 9.6 vs 6.4m (HR 0.65), mOS 30.9 vs 25.1m",st:"pos",pr:"NEJM 2012",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1209124"},{n:"KATHERINE",ph:"III",pop:"HER2+ EBC post-NAC non-pCR",arm:"T-DM1",ctrl:"trastuzumab",res:"3y iDFS 88.3% vs 77.0% (HR 0.50)",st:"pos",pr:"NEJM 2019",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1814017"}],next:"T-DXdに置換される可能性"},
  {id:22,name:"ツカチニブ（ツカイザ）",generic:"tucatinib",co:"Seagen/Pfizer",cls:"HER2 TKI",tgt:"HER2",sub:["HER2+"],
   moa:"HER2選択的TKI（BBB通過性高く脳転移に有効）",pat:"🇺🇸 2031年頃",
   ae:{freq:"下痢(63%), 手足症候群(PPE)(60%), 悪心(42%), ALT上昇(21%)",severe:"G3下痢(12%), G3 PPE(14%), G3 ALT上昇(5%)",note:"PPEはカペシタビン併用による。脳転移有効性が最大の差別化ポイント"},
   us:{s:"ok",t:"承認済 2020/4 Tukysa",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=213411"},eu:{s:"ok",t:"承認済 2021/2",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/tukysa"},jp:{s:"ok",t:"承認済 2026/2/19 ツカイザ",url:"https://www.pmda.go.jp/drugs/2026/P20260219001/index.html"},
   studies:[{n:"ONT-380前臨床",ph:"Pre",pop:"HER2+乳がん脳転移モデル",arm:"ONT-380（tucatinib）",ctrl:"lapatinib",res:"HER2選択的TKI（EGFR活性低い→皮膚毒性軽減）。BBB通過性良好。脳転移モデルで有効",st:"pos",pr:"Mol Cancer Ther 2018",url:"https://pubmed.ncbi.nlm.nih.gov/29891489/"},{n:"HER2CLIMB",ph:"II",pop:"HER2+ MBC 3L+（脳転移含む）",arm:"tucatinib + trastuzumab + capecitabine",ctrl:"placebo + trastuzumab + capecitabine",res:"mPFS 7.8 vs 5.6m (HR 0.54), mOS 21.9 vs 17.4m",st:"pos",pr:"NEJM 2020",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1914609"},{n:"HER2CLIMB-02",ph:"III",pop:"HER2+ MBC 2L",arm:"tucatinib + T-DM1",ctrl:"placebo + T-DM1",res:"mPFS 9.5 vs 7.4m (HR 0.76)",st:"pos",pr:"ASCO 2024"}],next:"日本薬価収載待ち。HER2CLIMB-02で2L使用も"},
  {id:23,name:"フェスゴ（HP皮下注）",generic:"pertuzumab+trastuzumab SC",co:"Roche",cls:"抗HER2抗体皮下注",tgt:"HER2",sub:["HER2+"],
   moa:"HP併用の皮下注製剤（ヒアルロニダーゼ配合）",pat:"🇺🇸 トラスツズマブ特許満了済み（BS上市済）。フェスゴ製剤特許2030年代前半",
   ae:{freq:"IV HPと同等。注射部位反応(12%)",severe:"心機能低下（HP共通）",note:"IV HPと比較して投与時間大幅短縮。忍容性はIV HPと同等"},
   us:{s:"ok",t:"承認済 2020/6 Phesgo",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=761170"},eu:{s:"ok",t:"承認済 2020/12",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/phesgo"},jp:{s:"ok",t:"承認済 2023/9 フェスゴ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00071387"},
   studies:[{n:"FeDeriCa",ph:"III",pop:"HER2+ EBC/MBC",arm:"pertuzumab+trastuzumab SC (Phesgo)",ctrl:"pertuzumab+trastuzumab IV",res:"PK非劣性確認",st:"pos",pr:"Lancet Oncol 2021",url:"https://pubmed.ncbi.nlm.nih.gov/33453765/"}],next:"利便性向上"},
  {id:24,name:"マージェツキシマブ（マージェンザ）",generic:"margetuximab",co:"MacroGenics",cls:"抗HER2抗体（Fc最適化）",tgt:"HER2",sub:["HER2+"],
   moa:"Fc領域を改変しADCC活性を増強した抗HER2抗体。CD16A 158F（低親和性）アレル保持者で有効性向上",
   pat:"🇺🇸 2032年頃",
   ae:{freq:"疲労/無力症(32%), 悪心(24%), 下痢(20%), 注入関連反応(IRR)(13%)",severe:"IRR G3(1.5%)",note:"トラスツズマブと比較してIRRがやや多い。CD16A遺伝子型でベネフィット差"},
   us:{s:"ok",t:"承認済 2020/12 Margenza",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=761150"},eu:{s:"no",t:"EU申請撤回（2022年）"},jp:{s:"no",t:"日本未承認"},
   studies:[{n:"SOPHIA",ph:"III",pop:"HER2+ MBC 3L+",arm:"margetuximab + chemo",ctrl:"trastuzumab + chemo",res:"mPFS 5.8 vs 4.9m (HR 0.76), OS有意差なし",st:"pos",pr:"JAMA Oncol 2021",url:"https://pubmed.ncbi.nlm.nih.gov/33480403/"}],next:"CD16A FF遺伝子型での効果検証。日本開発未定"},
  {id:25,name:"ネラチニブ（ナーリンクス）",generic:"neratinib",co:"Puma Biotechnology",cls:"pan-HER TKI",tgt:"HER1/HER2/HER4",sub:["HER2+"],
   moa:"HER1, HER2, HER4を不可逆的に阻害するpan-HER TKI",
   pat:"🇺🇸 2030年頃",
   ae:{freq:"下痢(95%), 悪心(43%), 腹痛(36%), 疲労(27%)",severe:"G3下痢(40%→ロペラミド予防で17%に軽減)",note:"下痢が最大の問題。投与開始時からのロペラミド予防投与が必須。2サイクル以降は軽減"},
   us:{s:"ok",t:"承認済 2017/7 Nerlynx（EBC延長）2020/2（MBC）",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=208051"},eu:{s:"ok",t:"承認済 2018/9（EBC延長）"},jp:{s:"no",t:"日本未承認"},
   studies:[{n:"ExteNET",ph:"III",pop:"HER2+ EBC 術後延長（trastuzumab後）",arm:"neratinib 1年",ctrl:"placebo",res:"5y iDFS 90.2% vs 87.7% (HR 0.73)",st:"pos",pr:"Lancet Oncol 2017",url:"https://pubmed.ncbi.nlm.nih.gov/28690010/"},{n:"NALA",ph:"III",pop:"HER2+ MBC 3L+",arm:"neratinib + capecitabine",ctrl:"lapatinib + capecitabine",res:"mPFS 8.8 vs 6.6m (HR 0.76)",st:"pos",pr:"JCO 2020",url:"https://pubmed.ncbi.nlm.nih.gov/32568634/"}],next:"日本開発未定。ツカチニブ承認でポジション限定的"},
  {id:26,name:"ラパチニブ（タイケルブ）",generic:"lapatinib",co:"Novartis(GSK)",cls:"HER2 TKI",tgt:"HER1/HER2",sub:["HER2+"],
   moa:"HER1（EGFR）とHER2を可逆的に阻害する経口TKI",
   pat:"🇺🇸 特許満了済み。後発品あり",
   ae:{freq:"下痢(65%), 手足症候群(PPE)(53%), 悪心(44%), 発疹(28%)",severe:"G3下痢(13%), G3 PPE(12%), 肝機能障害G3(3%)",note:"PPEはカペシタビン併用で増強。肝機能定期モニタリング推奨"},
   us:{s:"ok",t:"承認済 2007/3 Tykerb"},eu:{s:"ok",t:"承認済 2008/6"},jp:{s:"ok",t:"承認済 2009/4 タイケルブ"},
   studies:[{n:"EGF100151",ph:"III",pop:"HER2+ MBC 2L+",arm:"lapatinib + capecitabine",ctrl:"capecitabine alone",res:"mTTP 8.4 vs 4.4m (HR 0.49)",st:"pos",pr:"NEJM 2006",url:"https://pubmed.ncbi.nlm.nih.gov/17192538/"}],next:"後発品参入済み。ツカチニブに置換されつつあるが安価なオプション"},
  {id:27,name:"DB-1303",generic:"BNT323/DB-1303",co:"BioNTech/Daiichi Sankyo",cls:"ADC（HER2）次世代",tgt:"HER2",sub:["HER2+","HER2-low","HR+/HER2-"],
   moa:"次世代HER2標的ADC。新規トポイソメラーゼI阻害ペイロード+独自リンカー。T-DXdとの差別化を目指す",
   ae:{freq:"悪心, 疲労, 嘔吐（Phase I/II データ）",severe:"ILD報告あり（頻度はT-DXdより低い可能性）",note:"T-DXdとの直接比較データは未発表"},
   us:{s:"p2",t:"Phase I/II 進行中（乳癌コホート）"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"第一三共開発中。日本参加試験あり"},
   studies:[{n:"Phase I/II",ph:"I/II",pop:"HER2+/HER2-low 固形がん（乳癌コホート含む）",arm:"DB-1303 mono",ctrl:"なし（単群）",res:"乳癌コホート ORR有望（SABCS 2024 poster）",st:"run",pr:"SABCS 2024",url:"https://clinicaltrials.gov/study/NCT05150691"}],next:"Phase III設計検討中。BioNTech 2026年複数readout予定"},
  // ===== TNBC =====
  {id:30,name:"ペムブロリズマブ（キイトルーダ）",generic:"pembrolizumab",co:"Merck/MSD",cls:"免疫CPI（PD-1）",tgt:"PD-1",sub:["TNBC"],
   moa:"PD-1阻害による抗腫瘍免疫活性化",
   pat:"🇺🇸 2028/12（物質特許）。IRA薬価交渉 2028/1→バイオシミラー参入2029年頃",
   ae:{freq:"疲労(20-30%), 発疹(15%), 下痢(12%), 掻痒感(11%)",severe:"irAE（免疫関連有害事象）: 甲状腺機能障害(10-15%), 肺臓炎(3-5%), 大腸炎(1-2%), 肝炎(1-2%), 1型DM(<1%)",note:"irAEは遅発性で治療終了後も発症しうる。ステロイド早期介入が重要。化学療法併用時は骨髄抑制増強"},
   lc:[{s:2006,e:2010,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2010,e:2014,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2014,e:2028,c:"#5DCAA5",tc:"#04342C",t:"上市（38適応）"},{s:2028,e:2029.5,c:"#FAC775",tc:"#633806",t:"クリフ"},{s:2029.5,e:2034,c:"#D3D1C7",tc:"#444441",t:"BS時代"}],
   us:{s:"ok",t:"承認済（TNBC EBC+MBC）"},eu:{s:"ok",t:"承認済"},jp:{s:"ok",t:"承認済 キイトルーダ"},
   studies:[{n:"MK-3475前臨床/Phase I",ph:"I",pop:"進行固形がん（全がん種）",arm:"MK-3475（pembrolizumab）",ctrl:"なし（用量漸増）",res:"KEYNOTE-001: ORR 26%（全がん種）。T細胞PD-1遮断で抗腫瘍免疫活性化確認",st:"pos",pr:"NEJM 2015",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1501824"},{n:"KN-522",ph:"III",pop:"TNBC EBC周術期",arm:"pembrolizumab + 化学療法 → pembrolizumab mono術後",ctrl:"placebo + 化学療法 → placebo術後",res:"pCR 64.8% vs 51.2%, EFS HR 0.63",st:"pos",pr:"NEJM 2022",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2112651"},{n:"KN-355",ph:"III",pop:"TNBC 1L MBC CPS≥10",arm:"pembrolizumab + 化学療法（nab-PTX/PTX/GC）",ctrl:"placebo + 化学療法",res:"mOS 23.0 vs 16.1m (HR 0.73)",st:"pos",pr:"NEJM 2022",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2200674"}],next:"皮下注Qlex承認済→切替"},
  {id:35,name:"キイトルーダ Qlex（皮下注）",generic:"pembrolizumab+berahyaluronidase",co:"Merck/MSD",cls:"免疫CPI（PD-1）皮下注",tgt:"PD-1",sub:["TNBC"],
   moa:"ペムブロリズマブ+ヒアルロニダーゼの皮下注製剤（1-2分投与、IV 30分→大幅短縮）",
   pat:"🇺🇸 皮下注製剤特許により本体特許（2028）後もライフサイクル延長を企図",
   ae:{freq:"IV Keytrudaと同等。悪心(25%), 疲労(25%), 筋骨格痛(21%)",severe:"irAE: IV Keytrudaと同等。注射部位反応が追加",note:"PK非劣性確認済み。有効性・安全性ともIV Keytrudaと同等"},
   us:{s:"ok",t:"承認済 2025/9/19 Keytruda Qlex（38適応、TNBC含む）",url:"https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-pembrolizumab-and-berahyaluronidase-bnhf-subcutaneous-injection"},eu:{s:"rev",t:"EMA申請中"},jp:{s:"dev",t:"MSD日本で開発状況未確認"},
   studies:[{n:"MK-3475A-D77",ph:"III",pop:"NSCLC 1L（全固形がんに外挿）",arm:"Keytruda Qlex SC + 化学療法",ctrl:"Keytruda IV + 化学療法",res:"PK非劣性確認。ORR 45% vs 42%",st:"pos",pr:"ELCC 2025"}],next:"EU承認判断。日本申請時期未定"},
  {id:31,name:"トロデルビ（Sac-Gov）",generic:"sacituzumab govitecan",co:"Gilead",cls:"ADC（TROP2）",tgt:"TROP2",sub:["TNBC","HR+/HER2-"],
   moa:"TROP2標的ADC（SN-38ペイロード）",pat:"🇺🇸 2034年頃（ADC構造特許）",
   ae:{freq:"好中球減少(64%), 下痢(63%), 悪心(60%), 脱毛(38%)",severe:"G3/4好中球減少(51%), 発熱性好中球減少(6%), G3/4下痢(11%)",note:"化学療法様の骨髄抑制が強い。UGT1A1*28ホモはSN-38代謝低下→毒性増強リスク"},
   lc:[{s:2013,e:2017,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2017,e:2020,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2020,e:2034,c:"#5DCAA5",tc:"#04342C",t:"上市"},{s:2034,e:2037,c:"#FAC775",tc:"#633806",t:"クリフ"}],
   us:{s:"ok",t:"承認済 2020/4 Trodelvy（TNBC+HR+）",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=761115"},eu:{s:"ok",t:"承認済",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/trodelvy"},jp:{s:"ok",t:"承認済 2024/3 トロデルビ（TNBC）",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00071627"},
   studies:[{n:"ASCENT",ph:"III",pop:"TNBC MBC 2L+",arm:"sacituzumab govitecan",ctrl:"医師選択化学療法（単剤）",res:"mPFS 5.6 vs 1.7m (HR 0.41), mOS 12.1 vs 6.7m",st:"pos",pr:"NEJM 2021",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2028485"},{n:"TROPiCS-02",ph:"III",pop:"HR+/HER2- MBC 2L+",arm:"sacituzumab govitecan",ctrl:"医師選択化学療法（単剤）",res:"mOS 14.4 vs 11.2m (HR 0.79)",st:"pos",pr:"NEJM 2023",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2300882"},{n:"ASCENT-04/KN-D19",ph:"III",pop:"TNBC 1L MBC PD-L1+",arm:"sac-gov + pembrolizumab",ctrl:"化学療法 + pembrolizumab",res:"PFS有意改善",st:"pos",pr:"NEJM 2026"},{n:"ASCENT-03",ph:"III",pop:"TNBC 1L MBC IO不適",arm:"sac-gov mono",ctrl:"化学療法",res:"PFS/OS有意改善",st:"pos",pr:"2025"}],next:"ASCENT-04→FDA申請見込み。1L TNBC新SoC候補"},
  {id:32,name:"Dato-DXd ダトロウェイ",generic:"datopotamab deruxtecan",co:"Daiichi Sankyo/AZ",cls:"ADC（TROP2）",tgt:"TROP2",sub:["HR+/HER2-","TNBC"],
   moa:"TROP2標的DXd ADC",pat:"🇺🇸 2035年頃（DXd ADC技術特許群）",
   ae:{freq:"口内炎(56%), 悪心(48%), 脱毛(37%), 疲労(29%)",severe:"口内炎G3(7%), ILD(3-5%)",note:"SN-38系ADC（トロデルビ）と比較して骨髄抑制軽度だが口内炎が多い"},
   indications:[
     {label:"HR+/HER2- MBC",us:{s:"ok",t:"承認済 2025/1"},eu:{s:"rev",t:"EMA申請中"},jp:{s:"ok",t:"承認済 2024/12/27（世界初）"}},
     {label:"TNBC 1L MBC（IO不適）",us:{s:"rev",t:"Priority Review FDA承認予定 2026 Q2"},eu:{s:"p3",t:"Ph III"},jp:{s:"dev",t:"開発中"}},
   ],
   us:{s:"ok",t:""},eu:{s:"rev",t:""},jp:{s:"ok",t:""},
   studies:[{n:"Dato-DXd前臨床",ph:"Pre",pop:"TROP2+乳がん異種移植",arm:"DS-1062a（Dato-DXd）",ctrl:"sacituzumab govitecan",res:"TROP2標的DXdペイロードADC。バイスタンダー効果確認。SN-38系より口内炎型AEプロファイル",st:"pos",pr:"Clin Cancer Res 2021",url:"https://pubmed.ncbi.nlm.nih.gov/33504554/"},{n:"TROPION-PanTumor01",ph:"I",pop:"TROP2+固形がん（乳がんコホート）",arm:"Dato-DXd 4-8mg/kg",ctrl:"なし（用量漸増+拡大）",res:"HR+ BC ORR 27%, TNBC ORR 34%。推奨用量6mg/kg",st:"pos",pr:"JCO 2024",url:"https://pubmed.ncbi.nlm.nih.gov/38113430/"},{n:"TB-01",ph:"III",pop:"HR+/HER2- MBC",arm:"Dato-DXd",ctrl:"医師選択化学療法",res:"mPFS 6.9 vs 4.9m (HR 0.63)",st:"pos",pr:"NEJM 2024",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2400521"},{n:"TB-02",ph:"III",pop:"TNBC 1L MBC IO不適",arm:"Dato-DXd",ctrl:"医師選択化学療法",res:"mOS HR 0.79, mPFS HR 0.57",st:"pos",pr:"ESMO 2025"},{n:"TB-04",ph:"III",pop:"TNBC 1L MBC IO適格",arm:"Dato-DXd + durvalumab",ctrl:"化学療法 + pembrolizumab",res:"進行中",st:"run",pr:"readout 2027"}],next:"TNBC FDA FDA承認予定 2026 Q2。TB-04（ADC+IO）進行中"},
  {id:33,name:"オラパリブ（リムパーザ）",generic:"olaparib",co:"AstraZeneca",cls:"PARP阻害薬",tgt:"PARP",sub:["TNBC","HR+/HER2-"],
   moa:"PARP阻害によるDNA修復障害→合成致死",pat:"🇺🇸 2027/9頃（最早ジェネリック参入見込み）。小児適応PTE申請中",
   ae:{freq:"悪心(58%), 疲労(37%), 嘔吐(32%), 貧血(25%)",severe:"G3/4貧血(16%), 好中球減少G3(8%), MDS/AML(<1.5%)",note:"MDS/AMLの長期リスクに注意。貧血は輸血を要する場合あり"},
   lc:[{s:2005,e:2009,c:"#AFA9EC",tc:"#3C3489",t:"Preclinical"},{s:2009,e:2014,c:"#F4C0D1",tc:"#72243E",t:"Ph I-III"},{s:2014,e:2027,c:"#5DCAA5",tc:"#04342C",t:"上市"},{s:2027,e:2029,c:"#FAC775",tc:"#633806",t:"クリフ"},{s:2029,e:2034,c:"#D3D1C7",tc:"#444441",t:"GE時代"}],
   us:{s:"ok",t:"承認済 2018/1（gBRCA MBC）2022/3（EBC）",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=206995"},eu:{s:"ok",t:"承認済",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/lynparza"},jp:{s:"ok",t:"承認済 リムパーザ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00067012"},
   studies:[{n:"OlympiA",ph:"III",pop:"gBRCA HER2- EBC 術後",arm:"olaparib 1年",ctrl:"placebo",res:"4y iDFS 82.7% vs 75.4% (HR 0.63)",st:"pos",pr:"NEJM 2021",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa2105215"},{n:"OlympiAD",ph:"III",pop:"gBRCA HER2- MBC",arm:"olaparib",ctrl:"医師選択化学療法（単剤）",res:"mPFS 7.0 vs 4.2m (HR 0.58)",st:"pos",pr:"NEJM 2017",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1706450"}],next:"2027年パテントクリフ。長期OS追跡中"},
  {id:34,name:"タラゾパリブ（ターゼナ）",generic:"talazoparib",co:"Pfizer",cls:"PARP阻害薬",tgt:"PARP",sub:["TNBC","HR+/HER2-"],
   moa:"PARP trapping効果の高いPARP阻害薬",pat:"🇺🇸 2030年代前半",
   ae:{freq:"貧血(53%), 疲労(50%), 好中球減少(35%), 血小板減少(27%)",severe:"G3/4貧血(39%→olaparibより高い), G3/4好中球減少(21%)",note:"PARP trapping活性が強く骨髄抑制がolaparibより強い。用量調整が重要"},
   us:{s:"ok",t:"承認済 2018/10 Talzenna",url:"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=211651"},eu:{s:"ok",t:"承認済",url:"https://www.ema.europa.eu/en/medicines/human/EPAR/talzenna"},jp:{s:"ok",t:"承認済 ターゼナ",url:"https://www.kegg.jp/medicus-bin/japic_med?japic_code=00070115"},
   studies:[{n:"BMN673前臨床",ph:"Pre",pop:"BRCA変異乳がんモデル",arm:"BMN673（talazoparib）",ctrl:"olaparib",res:"PARP trapping活性がolaparibの約100倍。低用量で抗腫瘍効果。BRCA変異細胞に高感受性",st:"pos",pr:"Mol Cancer Ther 2014",url:"https://pubmed.ncbi.nlm.nih.gov/24435445/"},{n:"EMBRACA",ph:"III",pop:"gBRCA HER2- MBC",arm:"talazoparib",ctrl:"医師選択化学療法（単剤）",res:"mPFS 8.6 vs 5.6m (HR 0.54)",st:"pos",pr:"NEJM 2018",url:"https://www.nejm.org/doi/full/10.1056/NEJMoa1802905"}],next:"エンザルタミド併用データ"},
  // ===== 新規開発品 =====
  {id:40,name:"HER3-DXd",generic:"patritumab deruxtecan",co:"Daiichi Sankyo/Merck",cls:"ADC（HER3）",tgt:"HER3",sub:["HR+/HER2-","TNBC"],
   moa:"HER3標的DXd ADC",
   us:{s:"p2",t:"Phase I/II 乳がん進行中"},eu:{s:"p2",t:"開発中"},jp:{s:"dev",t:"第一三共開発中。日本参加試験あり"},
   studies:[{n:"U3-1402前臨床",ph:"Pre",pop:"HER3発現固形がんモデル",arm:"U3-1402（patritumab deruxtecan）",ctrl:"抗HER3抗体単独",res:"HER3標的DXd ADC。HER3発現腫瘍でバイスタンダー効果。HER2非依存の新標的",st:"pos",pr:"Mol Cancer Ther 2020",url:"https://pubmed.ncbi.nlm.nih.gov/32111697/"},{n:"Phase I/II",ph:"I/II",pop:"HER3+乳がん MBC",arm:"HER3-DXd mono",ctrl:"なし（単群）",res:"ORR有望",st:"run",pr:"SABCS 2024"}],next:"Phase III移行検討中（NSCLC先行）"},
  {id:41,name:"Sac-TMT（サシツズマブ チルモテカン）",generic:"sacituzumab tirumotecan",co:"Merck(Kelun-Biotech)/科倫博泰",cls:"ADC（TROP2）次世代",tgt:"TROP2",sub:["TNBC","HR+/HER2-"],
   moa:"次世代TROP2標的ADC。ベロテカン誘導体ペイロード+新規リンカー。DAR 7.4",
   ae:{freq:"好中球減少, 白血球減少, 口内炎, 悪心, 脱毛",severe:"G3/4好中球減少(主要AE), G3口内炎",note:"SN-38系（トロデルビ）と比較して下痢が軽度。骨髄抑制が主な毒性"},
   us:{s:"rev",t:"FDA申請中（TNBC 2L+ OptiTROP-Breast01ベース）"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本開発状況未確認。中国先行"},
   studies:[{n:"SKB264前臨床",ph:"Pre",pop:"TROP2+ 固形がんモデル",arm:"SKB264（sac-TMT）",ctrl:"sacituzumab govitecan",res:"新規belotecanペイロード+cleavableリンカー。DAR 7.4。SN-38系ADCより下痢軽度。骨髄抑制が主毒性",st:"pos",pr:"Cancer Res 2023",url:"https://pubmed.ncbi.nlm.nih.gov/36862487/"},{n:"Phase I/II",ph:"I/II",pop:"TROP2+固形がん（乳がんコホート）",arm:"sac-TMT 4-8mg/kg",ctrl:"なし",res:"TNBC ORR 55.6%, HR+ ORR 30.3%",st:"pos",pr:"ESMO 2024",url:"https://pubmed.ncbi.nlm.nih.gov/38944606/"},{n:"OptiTROP-Breast01",ph:"III",pop:"TNBC MBC 2L+",arm:"sac-TMT 5mg/kg Q2W",ctrl:"医師選択化学療法",res:"mPFS 6.7 vs 2.5m (HR 0.32), mOS NR vs 9.4m (HR 0.53)",st:"pos",pr:"Nat Med 2025",url:"https://pubmed.ncbi.nlm.nih.gov/39394505/"},
    {n:"OptiTROP-Breast02",ph:"III",pop:"HR+/HER2- MBC 2L+",arm:"sac-TMT 5mg/kg Q2W",ctrl:"医師選択化学療法",res:"mPFS 8.3 vs 4.1m (HR 0.35)",st:"pos",pr:"ESMO 2025"},
    {n:"OptiTROP-Breast03/TroFuse",ph:"III",pop:"TNBC 1L MBC PD-L1+",arm:"sac-TMT + pembrolizumab",ctrl:"化学療法 + pembrolizumab",res:"進行中",st:"run",pr:"readout 2027"},
    {n:"TroFuse-011",ph:"III",pop:"TNBC 1L MBC PD-L1 CPS<10",arm:"sac-TMT mono / sac-TMT + pembro",ctrl:"医師選択化学療法",res:"進行中",st:"run",pr:"readout 2027-28"},
    {n:"TroFuse-032",ph:"III",pop:"TNBC/HR-low EBC 周術期",arm:"pembro + sac-TMT → pembro + chemo",ctrl:"pembro + chemo → pembro + AC/EC",res:"進行中（FPI 2026）",st:"run",pr:"SABCS 2025 design"}],
   next:"FDA承認判断（TNBC 2L+）。1L・EBC試験が多数進行中"},
  {id:42,name:"BNT327/pumitamig",generic:"pumitamig",co:"BioNTech/BMS",cls:"Bispecific Ab（PD-L1×VEGF-A）",tgt:"PD-L1/VEGF-A",sub:["TNBC","HR+/HER2-"],
   moa:"PD-L1とVEGF-Aを同時に標的とする二重特異性抗体。免疫活性化+血管新生阻害",
   us:{s:"p3",t:"Phase III（TNBC 1L MBC）進行中"},eu:{s:"dev",t:"開発中"},jp:{s:"dev",t:"日本参加試験あり"},
   studies:[{n:"BNT327 Preclinical",ph:"Pre/Ph I",pop:"PD-L1+/VEGF-A+ 固形がん",arm:"BNT327（pumitamig）",ctrl:"単一標的抗体",res:"PD-L1+VEGF-A二重標的。免疫活性化+血管正常化の同時達成。Phase Ib/II TNBC ORR 54%",st:"pos",pr:"Nat Med 2024",url:"https://pubmed.ncbi.nlm.nih.gov/38769150/"},{n:"Phase III（TNBC 1L）",ph:"III",pop:"TNBC 1L MBC",arm:"pumitamig + chemo",ctrl:"pembrolizumab + chemo",res:"進行中",st:"run",pr:"2027年 readout見込み"},
    {n:"Phase III（HR+/HER2-）",ph:"III",pop:"HR+/HER2- MBC",arm:"pumitamig + 内分泌療法",ctrl:"TBD",res:"進行中",st:"run",pr:"2027-28年"}],
   next:"2026年に複数の併用試験データ更新予定。BioNTech 7 late-stage readouts"},
];

const EVENTS = [
  {q:"2026 Q1",done:true,items:[
    {text:"Giredestrant persevERA結果発表（3/9）",result:"主要EP未達（1L MBC PFS有意差なし）。evERA/lidERAの適応で申請継続"},
    {text:"Atirmociclib FOURLIGHT-1結果発表（3/17）",result:"PFS HR 0.60 (p=0.0007)。CDK4/6i後2LでPFS有意改善。Phase III FOURLIGHT-3へ"},
  ]},
  {q:"2026 Q2",done:false,items:[
    {text:"Camizestrant FDA諮問委員会（4/30）"},
    {text:"Vepdegestrant FDA承認判断（6/5）"},
    {text:"Dato-DXd TNBC FDA承認判断（Q2）"},
    {text:"ASCO 2026（6月）"},
  ]},
  {q:"2026 Q3",done:false,items:[
    {text:"T-DXd post-NAC FDA承認判断（Q3）"},
    {text:"Camizestrant SERENA-4 結果発表（H2）"},
  ]},
  {q:"2026 Q4",done:false,items:[
    {text:"ESMO 2026（10月）"},
    {text:"Giredestrant evERA FDA承認判断（12/18）"},
    {text:"SABCS 2026（12月）"},
    {text:"イナボリシブ日本申請見込み"},
  ]},
];

const JP_OUTLOOK = [
  // FDA承認済み → 日本での見通し
  {name:"ツカチニブ",sub:"HER2+ MBC 3L+（脳転移）",status:"✅ 2026/2/19 日本承認済。薬価収載待ち",color:"#16a34a"},
  {name:"イムルネストラント",sub:"HR+/HER2- ESR1m MBC",status:"✅ 2025/12/22 日本承認済",color:"#16a34a"},
  {name:"イナボリシブ",sub:"HR+/HER2- PIK3CAm 1L",status:"FDA承認済（2024/10）。中外製薬が日本開発中→2026年以降申請見込み",color:"#eab308"},
  {name:"エラセストラント",sub:"HR+/HER2- ESR1m MBC",status:"FDA承認済（2023/1）。日本未申請、ドラッグラグ大",color:"#64748b"},
  {name:"ネラチニブ",sub:"HER2+ EBC延長/MBC",status:"FDA承認済（2017/7）。日本未承認",color:"#64748b"},
  {name:"マージェツキシマブ",sub:"HER2+ MBC 3L+",status:"FDA承認済（2020/12）。日本未承認、EU申請撤回",color:"#64748b"},
];

function Chip({text,color,bg}){return <span style={{fontSize:11,fontWeight:600,color,background:bg,padding:"2px 8px",borderRadius:999,whiteSpace:"nowrap",display:"inline-block"}}>{text}</span>}
function StatusChip({s}){return <Chip text={S[s]||s} color={s==="ok"?"#15803d":s==="rev"?"#1d4ed8":s==="no"?"#94a3b8":"#374151"} bg={SB[s]||"#f1f5f9"}/>}
function SubChip({t}){
  const c={"HR+/HER2-":{c:"#9333ea",b:"#f3e8ff"},"HER2+":{c:"#0369a1",b:"#e0f2fe"},"TNBC":{c:"#dc2626",b:"#fee2e2"},"HER2-low":{c:"#b45309",b:"#fef3c7"}};
  const x=c[t]||{c:"#374151",b:"#f3f4f6"};
  return <Chip text={t} color={x.c} bg={x.b}/>
}

function DrugLink({generic,label}){
  const nav=useContext(NavContext);
  if(!nav)return <span>{label||generic}</span>;
  const drug=DRUGS.find(d=>d.generic===generic);
  const display=label||(drug?drug.name:generic);
  return <span onClick={(e)=>{e.stopPropagation();nav.goToDrug(generic);}} style={{color:"#2563eb",cursor:"pointer",borderBottom:"1px dashed #93c5fd",fontWeight:500}} title={drug?`${drug.name} (${drug.generic})`:""}>{display}</span>;
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
          <span><span style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{d.name}</span>{d.generic&&<span style={{fontSize:11,color:"#94a3b8",marginLeft:6}}>({d.generic})</span>}</span>
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
const LANDSCAPE = [
  // --- ADC ---
  {id:"ARX788",name:"ARX788",co:"Ambrx/J&J",moa_cat:"ADC",tgt:"HER2",sub:["HER2+"],stage:"PhII",nct:"NCT05041972",nct_url:"https://clinicaltrials.gov/study/NCT05041972",status:"active",fih_date:"2018-06",n_enrolled:268,early_result:"ORR 56% (HER2+ MBC 2L+)",source_url:"https://clinicaltrials.gov/study/NCT05041972",source_label:"ClinicalTrials.gov",note:"site-specific conjugation ADC",updated:"2026-03-22"},
  {id:"RC48",name:"RC48 (disitamab vedotin)",co:"RemeGen",moa_cat:"ADC",tgt:"HER2",sub:["HER2+","HER2-low"],stage:"PhII",nct:"NCT04400695",nct_url:"https://clinicaltrials.gov/study/NCT04400695",status:"active",fih_date:"2017-03",n_enrolled:null,early_result:"ORR 42.9% (HER2-low BC)",source_url:"https://doi.org/10.1002/cac2.12577",source_label:"Cancer Commun 2024",note:"中国承認済 (胃癌/UC)。乳癌はPhII",updated:"2026-03-22"},
  {id:"MRG002",name:"MRG002",co:"Shanghai Miracogen (LeadArt Bio)",moa_cat:"ADC",tgt:"HER2",sub:["HER2+"],stage:"PhII",nct:"NCT04924699",nct_url:"https://clinicaltrials.gov/study/NCT04924699",status:"recruiting",fih_date:"2020-01",n_enrolled:null,early_result:"ORR 50% (HER2+ MBC)",source_url:"https://doi.org/10.1200/JCO.2022.40.16_suppl.1102",source_label:"ASCO 2022",note:"MMAE payload ADC",updated:"2026-03-22"},
  // --- ADC (新規標的) ---
  {id:"AZD8205",name:"AZD8205",co:"AstraZeneca",moa_cat:"ADC_novel_target",tgt:"B7-H4",sub:["HR+/HER2-","TNBC"],stage:"PhI",nct:"NCT05123482",nct_url:"https://clinicaltrials.gov/study/NCT05123482",status:"recruiting",fih_date:"2022-01",n_enrolled:null,early_result:"初期データ待ち",source_url:"https://www.astrazeneca.com/our-therapy-areas/pipeline.html",source_label:"AZ pipeline",note:"B7-H4は乳癌で高発現の新規標的",updated:"2026-03-22"},
  {id:"SGN-B7H4V",name:"SGN-B7H4V",co:"Pfizer (Seagen)",moa_cat:"ADC_novel_target",tgt:"B7-H4",sub:["HR+/HER2-","TNBC"],stage:"PhI",nct:"NCT05194072",nct_url:"https://clinicaltrials.gov/study/NCT05194072",status:"recruiting",fih_date:"2022-06",n_enrolled:null,early_result:"ORR 40%+ (dose escalation)",source_url:"https://clinicaltrials.gov/study/NCT05194072",source_label:"ClinicalTrials.gov",note:"vcMMAE payload",updated:"2026-03-22"},
  {id:"STRO-002",name:"STRO-002 (luvelta)",co:"Sutro Biopharma",moa_cat:"ADC_novel_target",tgt:"FRα",sub:["TNBC"],stage:"PhI",nct:"NCT05174786",nct_url:"https://clinicaltrials.gov/study/NCT05174786",status:"recruiting",fih_date:"2022-03",n_enrolled:null,early_result:"初期安全性確認",source_url:"https://www.sutrobio.com",source_label:"Sutro pipeline",note:"FRα標的。卵巣癌先行",updated:"2026-03-22"},
  // --- Bispecific ---
  {id:"zanidatamab",name:"zanidatamab",co:"Zymeworks/Jazz",moa_cat:"bispecific",tgt:"HER2 biparatopic",sub:["HER2+"],stage:"PhII",nct:"NCT04276493",nct_url:"https://clinicaltrials.gov/study/NCT04276493",status:"active",fih_date:"2019-05",n_enrolled:null,early_result:"ORR 37% (HER2+ MBC 3L+)",source_url:"https://doi.org/10.1016/S1470-2045(22)00621-0",source_label:"Lancet Oncol 2022",note:"胆管癌承認済 (zanidatamab+chemo)。乳癌はPhII",updated:"2026-03-22"},
  {id:"KN026",name:"KN026",co:"Alphamab/Jiangsu Hengrui",moa_cat:"bispecific",tgt:"HER2 biparatopic",sub:["HER2+"],stage:"PhII",nct:"NCT04521179",nct_url:"https://clinicaltrials.gov/study/NCT04521179",status:"active",fih_date:"2019-01",n_enrolled:null,early_result:"ORR 27.2% (HER2+ MBC)",source_url:"https://doi.org/10.1158/1078-0432.CCR-21-2827",source_label:"Clin Cancer Res 2022",note:"中国Phase III開始",updated:"2026-03-22"},
  // --- PROTAC/degrader ---
  {id:"AC682",name:"AC682",co:"Accutar Biotech",moa_cat:"PROTAC_degrader",tgt:"ER (molecular glue)",sub:["HR+/HER2-"],stage:"PhI",nct:"NCT05489679",nct_url:"https://clinicaltrials.gov/study/NCT05489679",status:"recruiting",fih_date:"2022-09",n_enrolled:null,early_result:"Phase I dose escalation中",source_url:"https://clinicaltrials.gov/study/NCT05489679",source_label:"ClinicalTrials.gov",note:"molecular glue型ER degrader。vepdegestrant(PROTAC)と異なるメカニズム",updated:"2026-03-22"},
  // --- 次世代CDK ---
  {id:"PF-07220060",name:"PF-07220060",co:"Pfizer",moa_cat:"CDK_next",tgt:"CDK2",sub:["HR+/HER2-"],stage:"PhIb/II",nct:"NCT05757141",nct_url:"https://clinicaltrials.gov/study/NCT05757141",status:"recruiting",fih_date:"2023-04",n_enrolled:null,early_result:"CDK4/6i耐性後の活性示唆",source_url:"https://doi.org/10.1200/JCO.2024.42.16_suppl.TPS1129",source_label:"ASCO 2024 TPS",note:"CDK4/6i耐性克服の次世代CDK2阻害薬",updated:"2026-03-22"},
  {id:"INX315",name:"INX315",co:"Incyclix Bio",moa_cat:"CDK_next",tgt:"CDK2",sub:["HR+/HER2-"],stage:"PhI",nct:"NCT05735080",nct_url:"https://clinicaltrials.gov/study/NCT05735080",status:"recruiting",fih_date:"2023-06",n_enrolled:null,early_result:"Phase I escalation中",source_url:"https://incyclixbio.com/pipeline/",source_label:"Incyclix pipeline",note:"CDK2選択的阻害薬",updated:"2026-03-22"},
  {id:"SY-5609",name:"SY-5609",co:"Syros Pharmaceuticals",moa_cat:"CDK_next",tgt:"CDK7",sub:["HR+/HER2-","TNBC"],stage:"PhI",nct:"NCT04247126",nct_url:"https://clinicaltrials.gov/study/NCT04247126",status:"active",fih_date:"2020-12",n_enrolled:57,early_result:"単剤で限定的活性。併用試験移行",source_url:"https://doi.org/10.1200/JCO.2023.41.16_suppl.3081",source_label:"ASCO 2023",note:"CDK7阻害薬。転写制御メカニズム",updated:"2026-03-22"},
  // --- 次世代IO ---
  {id:"mRNA-4157",name:"mRNA-4157/V940 (individualized neoantigen therapy)",co:"Moderna/Merck",moa_cat:"IO_next",tgt:"neoantigen mRNA vaccine",sub:["TNBC"],stage:"PhII",nct:"NCT03897881",nct_url:"https://clinicaltrials.gov/study/NCT03897881",status:"active",fih_date:"2019-04",n_enrolled:null,early_result:"メラノーマでRFS HR 0.56。固形がん拡大中",source_url:"https://doi.org/10.1016/S0140-6736(23)02268-7",source_label:"Lancet 2024",note:"個別化ネオアンチゲンmRNAワクチン+pembro。乳癌コホート進行中",updated:"2026-03-22"},
  {id:"fianlimab",name:"fianlimab",co:"Regeneron",moa_cat:"IO_next",tgt:"LAG-3",sub:["TNBC"],stage:"PhI",nct:"NCT05767879",nct_url:"https://clinicaltrials.gov/study/NCT05767879",status:"recruiting",fih_date:"2023-05",n_enrolled:null,early_result:"メラノーマで有望。乳癌データ待ち",source_url:"https://www.regeneron.com/pipeline-medicines",source_label:"Regeneron pipeline",note:"LAG-3抗体。cemiplimab+fianlimab併用",updated:"2026-03-22"},
  // --- 細胞治療 ---
  {id:"CT041",name:"CT041",co:"CARsgen Therapeutics",moa_cat:"cell_therapy",tgt:"CLDN18.2 CAR-T",sub:["TNBC"],stage:"PhI",nct:"NCT04404595",nct_url:"https://clinicaltrials.gov/study/NCT04404595",status:"recruiting",fih_date:"2020-06",n_enrolled:null,early_result:"胃癌でORR 57.1%。乳癌コホート進行中",source_url:"https://doi.org/10.1038/s41591-022-01800-8",source_label:"Nat Med 2022",note:"固形がんCAR-T。CLDN18.2発現乳癌サブセット",updated:"2026-03-22"},
  // --- RDC ---
  {id:"HER2-TTC",name:"[177Lu]Lu-DOTA-trastuzumab",co:"Multiple (academic)",moa_cat:"RDC",tgt:"HER2 (radioligand)",sub:["HER2+"],stage:"PhI",nct:"NCT04842812",nct_url:"https://clinicaltrials.gov/study/NCT04842812",status:"active",fih_date:"2021-08",n_enrolled:null,early_result:"dose escalation中",source_url:"https://clinicaltrials.gov/study/NCT04842812",source_label:"ClinicalTrials.gov",note:"HER2標的放射性医薬品。前立腺癌RDCの成功を受け開発加速",updated:"2026-03-22"},
  // --- その他低分子 ---
  {id:"TNO155",name:"TNO155",co:"Novartis",moa_cat:"small_mol_other",tgt:"SHP2",sub:["HR+/HER2-","TNBC"],stage:"PhIb/II",nct:"NCT04330664",nct_url:"https://clinicaltrials.gov/study/NCT04330664",status:"active",fih_date:"2020-06",n_enrolled:null,early_result:"併用で安定した忍容性",source_url:"https://www.novartis.com/research-development/novartis-pipeline",source_label:"Novartis pipeline",note:"SHP2阻害薬。RAS/MAPK経路耐性メカニズムに対する新アプローチ",updated:"2026-03-22"},
  {id:"LY3537982",name:"LY3537982 (olomorasib)",co:"Eli Lilly",moa_cat:"small_mol_other",tgt:"KRAS G12C",sub:["TNBC"],stage:"PhI",nct:"NCT04956640",nct_url:"https://clinicaltrials.gov/study/NCT04956640",status:"recruiting",fih_date:"2021-08",n_enrolled:null,early_result:"NSCLC ORR 58%。乳癌KRAS G12Cは稀だがバスケット試験に含む",source_url:"https://doi.org/10.1200/JCO.2024.42.16_suppl.3007",source_label:"ASCO 2024",note:"KRAS G12C変異は乳癌で1-2%。バスケット試験で探索",updated:"2026-03-22"},
  // --- Bispecific ADC ---
  {id:"BL-B01D1",name:"イザロンタマブ ブレンギテカン (iza-bren)",co:"SystImmune/BMS",moa_cat:"bispecific",tgt:"EGFR×HER3 bispecific ADC",sub:["TNBC","HER2-low"],stage:"PhII",nct:"NCT06382142",nct_url:"https://clinicaltrials.gov/study/NCT06382142",status:"active",fih_date:"2021-06",n_enrolled:null,early_result:"Ph I 乳癌 ORR 36.4%。Ph III TNBC PFS+OS両主要EP達成（初のbispecific ADC）",source_url:"https://www.targetedonc.com/view/iza-bren-meets-pfs-and-os-end-points-in-phase-3-tnbc-trial",source_label:"Ph III TNBC 2025",note:"世界初bispecific ADCでPhase III OS達成。TNBC新治療候補",updated:"2026-03-22"},
  // --- ADC (B7-H4) ---
  {id:"XMT-1660",name:"emiltatug ledadotin (XMT-1660)",co:"Mersana Therapeutics",moa_cat:"ADC_novel_target",tgt:"B7-H4",sub:["TNBC","HR+/HER2-"],stage:"PhI",nct:"NCT05377996",nct_url:"https://clinicaltrials.gov/study/NCT05377996",status:"recruiting",fih_date:"2022-07",n_enrolled:null,early_result:"B7-H4高発現 ORR 23%。FDA Fast Track取得",source_url:"https://www.targetedonc.com/view/fda-fast-tracks-emiltatug-ledadotin-in-advanced-metastatic-breast-cancer",source_label:"FDA Fast Track 2025",note:"auristatin F-HPA payload。既存B7-H4 ADC(AZD8205,SGN-B7H4V)と異なるペイロード",updated:"2026-03-22"},
  // --- Bispecific IO ---
  {id:"AK112",name:"ivonescimab (AK112)",co:"Akeso/Summit",moa_cat:"bispecific",tgt:"PD-1×VEGF",sub:["TNBC"],stage:"PhII",nct:"NCT05227664",nct_url:"https://clinicaltrials.gov/study/NCT05227664",status:"active",fih_date:"2021-01",n_enrolled:null,early_result:"1L TNBC + chemo 有望なORR。中国CDE BTD取得",source_url:"https://www.akesobio.com/en/media/akeso-news/251103/",source_label:"Akeso 2025",note:"PD-1×VEGF bispecific。pumitamig(PD-L1×VEGF-A)と標的が異なる。Phase III開始",updated:"2026-03-22"},
  // --- CDK2 inhibitor ---
  {id:"BLU-222",name:"BLU-222",co:"Blueprint Medicines/Roche",moa_cat:"CDK_next",tgt:"CDK2",sub:["HR+/HER2-","TNBC"],stage:"PhI",nct:"NCT05252416",nct_url:"https://clinicaltrials.gov/study/NCT05252416",status:"recruiting",fih_date:"2022-04",n_enrolled:null,early_result:"CDK4/6i耐性 ER+/HER2- MBCでPR。ribociclib+fulvestrantとの併用で忍容性確認",source_url:"https://doi.org/10.1200/JCO.2024.42.16_suppl.1056",source_label:"ASCO 2024",note:"最も進んだ選択的CDK2i。CCNE1増幅TNBCにも活性。Roche買収で開発加速",updated:"2026-03-22"},
  // --- PI3Kα (next-gen) ---
  {id:"SNV4818",name:"SNV4818",co:"Synnovation/Novartis",moa_cat:"small_mol_other",tgt:"PI3Kα（変異選択的）",sub:["HR+/HER2-"],stage:"PhI",nct:"NCT06736704",nct_url:"https://clinicaltrials.gov/study/NCT06736704",status:"recruiting",fih_date:"2025-02",n_enrolled:null,early_result:"FIH 2025/2開始。H1047X+E545/542X両方をカバー",source_url:"https://www.synnovationtx.com/news/pi3ka-fip-pr",source_label:"Synnovation 2025",note:"pan-mutant選択的PI3Kα阻害薬（野生型非阻害）。Novartis $3B買収。alpelisib/inavolisibの次世代",updated:"2026-03-22"},
  // --- RDC ---
  {id:"Lu-NeoB",name:"[177Lu]Lu-NeoB",co:"Novartis (AAA)",moa_cat:"RDC",tgt:"GRPR (radioligand)",sub:["HR+/HER2-"],stage:"PhI",nct:"NCT05870579",nct_url:"https://clinicaltrials.gov/study/NCT05870579",status:"recruiting",fih_date:"2023-06",n_enrolled:null,early_result:"MTD 9.25 GBq確定。乳癌専用試験3本進行中",source_url:"https://www.cancernetwork.com/view/tps-25-phase-1-2-study-of-the-novel-radioligand-therapy-177lu-lu-neob-plus-capecitabine-in-patients-with-er-her2-advanced-breast-cancer-abc-with-grpr-expression-after-progression-on-prior-endocrine-therapy-plus-a-cdk4-6-inhibitor-for-abc",source_label:"TPS ASCO 2025",note:"GRPR標的RLT。ER+乳癌の大半でGRPR発現。ribociclib+fulvestrant併用試験も",updated:"2026-03-22"},
  // --- PROTAC ---
  {id:"HRS-1358",name:"HRS-1358",co:"Jiangsu Hengrui",moa_cat:"PROTAC_degrader",tgt:"ER (PROTAC)",sub:["HR+/HER2-"],stage:"PhI",nct:"",nct_url:"",status:"recruiting",fih_date:"2024-01",n_enrolled:null,early_result:"Phase I dose escalation中。dalpiciclib併用試験も",source_url:"https://www.hengrui.com/en/pipeline.html",source_label:"Hengrui pipeline",note:"vepdegestrant(Arvinas/Pfizer)に続く2番目の臨床段階ER PROTAC",updated:"2026-03-22"},
];

const MOA_CAT_LABELS = {
  ADC:"ADC（HER2標的 次世代）",
  ADC_novel_target:"ADC（新規標的: B7-H4, FRα等）",
  bispecific:"二重特異性抗体 / Bispecific ADC",
  PROTAC_degrader:"PROTAC / 分子糊（Molecular Glue）",
  oral_SERD_next:"次世代経口SERD",
  CDK_next:"次世代CDK阻害薬（CDK2, CDK7）",
  epigenetic:"エピジェネティクス",
  IO_next:"次世代IO（mRNAワクチン, LAG-3等）",
  cell_therapy:"細胞治療（CAR-T, TIL）",
  RDC:"放射性医薬品（RDC）",
  small_mol_other:"その他低分子（SHP2, KRAS等）",
  Ab_other:"その他抗体治療",
  combination_novel:"新規併用戦略",
};

const STAGE_STYLE = {
  IND:{c:"#64748b",b:"#f1f5f9"},
  FIH:{c:"#7c3aed",b:"#ede9fe"},
  PhI:{c:"#2563eb",b:"#dbeafe"},
  "PhIb/II":{c:"#ea580c",b:"#fff7ed"},
  PhII:{c:"#c2410c",b:"#ffedd5"},
};

// ===== 臨床試験タイムライン（ガントチャート用） =====
// 薬剤ごとに主要Phase II-III試験を網羅。薬剤カードのstudiesと照合し漏れがないことを確認済み
const TIMELINE = [
  // === HR+/HER2- : SERD ===
  {drug:"camizestrant",trial:"SERENA-6",ph:"III",sub:"HR+/HER2-",pop:"ESR1m出現時 1L MBC",arm:"camizestrant + CDK4/6i（AI→switch）",ctrl:"AI + CDK4/6i 継続",ep:"PFS（IRC）",ep2:"OS, ORR, CBR",res:"mPFS 16.0 vs 9.2m (HR 0.44)",res2:"OS immature",st:"pos",fpi:2021.5,lpi:2023.5,readout:2025.5,nct:"NCT04964934",note:"ASCO 2025 LBA。FDA諮問委員会 4/30/2026"},
  {drug:"camizestrant",trial:"SERENA-4",ph:"III",sub:"HR+/HER2-",pop:"1L MBC",arm:"camizestrant + palbociclib",ctrl:"AI + palbociclib",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2021.0,lpi:2024.0,readout:2026.8,nct:"NCT04711252",note:"2026 H2 readout予定"},
  {drug:"giredestrant",trial:"evERA",ph:"III",sub:"HR+/HER2-",pop:"post-CDK4/6i MBC",arm:"giredestrant + everolimus",ctrl:"SoC ET + everolimus",ep:"PFS（IRC）",ep2:"OS, ORR, CBR",res:"ESR1m群 mPFS 9.99 vs 5.45m (HR 0.38)。ITT HR 0.56",res2:"ORR改善傾向",st:"pos",fpi:2022.5,lpi:2024.0,readout:2025.8,nct:"NCT05306340",note:"ESMO 2025。FDA承認予定 12/18/2026"},
  {drug:"giredestrant",trial:"lidERA",ph:"III",sub:"HR+/HER2-",pop:"EBC 術後",arm:"giredestrant",ctrl:"SoC ET（AI or tamoxifen）",ep:"iDFS",ep2:"OS, DRFI",res:"3y iDFS 92.4% vs 89.6% (HR 0.70)",res2:"OS immature",st:"pos",fpi:2021.5,lpi:2023.5,readout:2025.9,nct:"NCT04961996",note:"SABCS 2025。iDFS HR 0.70"},
  {drug:"giredestrant",trial:"persevERA",ph:"III",sub:"HR+/HER2-",pop:"1L MBC",arm:"giredestrant + palbociclib",ctrl:"letrozole + palbociclib",ep:"PFS（IRC）",ep2:"OS, ORR",res:"主要EP未達（PFS有意差なし）",res2:"OS, ORR未報告",st:"neg",fpi:2020.5,lpi:2023.0,readout:2026.2,nct:"NCT04546009",note:"2026/3/9 主要EP未達"},
  {drug:"giredestrant",trial:"pionERA",ph:"III",sub:"HR+/HER2-",pop:"ET耐性 MBC",arm:"giredestrant + CDK4/6i（医師選択）",ctrl:"fulvestrant + CDK4/6i",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2023.5,lpi:2025.5,readout:2027.5,nct:"NCT06065748",note:"2027年 readout予定"},
  {drug:"vepdegestrant",trial:"VERITAC-2",ph:"III",sub:"HR+/HER2-",pop:"ESR1m MBC 2L+",arm:"vepdegestrant 200mg mono",ctrl:"fulvestrant 500mg IM",ep:"PFS（IRC）",ep2:"OS, ORR, CBR, DoR",res:"ESR1m群 mPFS 5.0 vs 2.1m (HR 0.57)",res2:"ORR 11.5% vs 5.0%",st:"pos",fpi:2023.5,lpi:2024.5,readout:2025.5,nct:"NCT05654623",note:"ASCO 2025 LBA。FDA承認予定 6/5/2026"},
  {drug:"imlunestrant",trial:"EMBER-3",ph:"III",sub:"HR+/HER2-",pop:"ESR1m MBC 2L+",arm:"imlunestrant mono / imlunestrant + abemaciclib",ctrl:"fulvestrant or exemestane（医師選択）",ep:"PFS（ESR1m群）",ep2:"OS, ORR, PFS（ITT）",res:"ESR1m群 mPFS 5.5 vs 3.8m (HR 0.62)",res2:"ITT PFS HR 0.87 (有意差なし)",st:"pos",fpi:2021.5,lpi:2023.0,readout:2024.5,nct:"NCT04975308",note:"NEJM 2025。3極承認済み"},
  {drug:"imlunestrant",trial:"EMBER-4",ph:"III",sub:"HR+/HER2-",pop:"EBC 術後",arm:"imlunestrant",ctrl:"standard ET",ep:"iDFS",ep2:"OS, DRFI",st:"run",fpi:2022.5,lpi:2026.0,readout:2028.0,nct:"NCT05514054",note:"約8000例。2028年頃"},
  // === HR+/HER2- : CDK / KAT6 ===
  {drug:"atirmociclib",trial:"FOURLIGHT-1",ph:"II",sub:"HR+/HER2-",pop:"MBC 2L post-CDK4/6i",arm:"atirmociclib + fulvestrant",ctrl:"fulvestrant alone / everolimus + exemestane",ep:"PFS（IRC）",ep2:"OS, ORR, CBR",res:"PFS HR 0.60 (p=0.0007)",res2:"ORR/CBR改善傾向",st:"pos",fpi:2024.0,lpi:2025.0,readout:2026.2,nct:"NCT06105632",note:"2026/3/17 PFS HR 0.60"},
  {drug:"atirmociclib",trial:"FOURLIGHT-3",ph:"III",sub:"HR+/HER2-",pop:"1L MBC",arm:"atirmociclib + AI",ctrl:"CDK4/6i（医師選択）+ AI",ep:"PFS（IRC）",ep2:"OS",st:"run",fpi:2024.5,lpi:2026.5,readout:2027.5,nct:"NCT06760637",note:"1L registrational。2027年"},
  {drug:"prifetrastat",trial:"KATSIS-1",ph:"III",sub:"HR+/HER2-",pop:"post-CDK4/6i MBC",arm:"prifetrastat + fulvestrant",ctrl:"everolimus + ET（医師選択）",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2024.0,lpi:2026.5,readout:2027.5,nct:"NCT07062965",note:"KAT6i vs EVE+ET。2027年"},
  // === HR+/HER2- : PI3K/AKT ===
  {drug:"inavolisib",trial:"INAVO120",ph:"III",sub:"HR+/HER2-",pop:"PIK3CAm 1L MBC",arm:"inavolisib + palbociclib + fulvestrant",ctrl:"placebo + palbociclib + fulvestrant",ep:"PFS（IRC）",ep2:"OS, ORR, CBR",res:"mPFS 15.0 vs 7.3m (HR 0.43)",res2:"ORR 58% vs 25%",st:"pos",fpi:2020.5,lpi:2022.5,readout:2024.0,nct:"NCT04191499",note:"NEJM 2024。FDA承認済"},
  {drug:"gedatolisib",trial:"VIKTORIA-1",ph:"III",sub:"HR+/HER2-",pop:"1L MBC",arm:"gedatolisib + palbociclib + fulvestrant",ctrl:"placebo + palbociclib + fulvestrant",ep:"PFS（IRC）",ep2:"OS, ORR",res:"PFS有意改善",res2:"ORR改善",st:"pos",fpi:2022.0,lpi:2024.5,readout:2024.9,nct:"NCT05501886",note:"SABCS 2024。FDA申請済"},
  {drug:"capivasertib",trial:"CAPItello-292",ph:"III",sub:"HR+/HER2-",pop:"1L MBC",arm:"capivasertib + CDK4/6i + fulvestrant",ctrl:"placebo + CDK4/6i + fulvestrant",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2023.0,lpi:2026.0,readout:2027.5,nct:"NCT04862663",note:"1L AKTi試験。2027年"},
  // === HER2+ ===
  {drug:"T-DXd",trial:"DB-09",ph:"III",sub:"HER2+",pop:"1L MBC",arm:"T-DXd + pertuzumab",ctrl:"taxane + trastuzumab + pertuzumab（THP）",ep:"PFS（IRC）",ep2:"OS, ORR, DoR",res:"mPFS 40.7 vs 26.9m (HR 0.63)",res2:"ORR 82% vs 75%",st:"pos",fpi:2022.0,lpi:2024.0,readout:2025.8,nct:"NCT04784715",note:"ESMO 2025。FDA承認済12/2025"},
  {drug:"T-DXd",trial:"DB-05",ph:"III",sub:"HER2+",pop:"EBC post-NAC non-pCR",arm:"T-DXd 5.4mg/kg",ctrl:"T-DM1",ep:"iDFS",ep2:"OS, DRFI",res:"iDFS有意改善",res2:"OS immature",st:"pos",fpi:2021.0,lpi:2023.5,readout:2025.8,nct:"NCT04622319",note:"ESMO 2025。FDA承認予定 2026 Q3"},
  {drug:"T-DXd",trial:"DB-06",ph:"III",sub:"HER2-low",pop:"HER2-low 1L MBC",arm:"T-DXd 5.4mg/kg",ctrl:"医師選択化学療法",ep:"PFS（IRC）",ep2:"OS, ORR",res:"mPFS 13.2 vs 8.1m (HR 0.62)",res2:"OS HR 0.83 (immature)",st:"pos",fpi:2021.5,lpi:2023.5,readout:2024.5,nct:"NCT04494425",note:"ASCO 2024。FDA承認"},
  {drug:"T-DXd",trial:"DB-11",ph:"III",sub:"HR+/HER2-",pop:"1L HR+/HER2- MBC",arm:"T-DXd + AI ± palbociclib",ctrl:"CDK4/6i + ET",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2023.0,lpi:2026.5,readout:2027.5,nct:"NCT04975997",note:"T-DXd 1L HR+/HER2-。重要な適応拡大試験"},
  {drug:"T-DXd",trial:"DB-12",ph:"III",sub:"HER2+",pop:"脳転移 MBC",arm:"T-DXd 5.4mg/kg",ctrl:"医師選択治療",ep:"ORR（脳転移）",ep2:"PFS, OS, CNS-PFS",st:"run",fpi:2022.5,lpi:2025.5,readout:2027.0,nct:"NCT04739761",note:"脳転移特化。2027年"},
  {drug:"tucatinib",trial:"HER2CLIMB-02",ph:"III",sub:"HER2+",pop:"2L MBC",arm:"tucatinib + T-DM1",ctrl:"placebo + T-DM1",ep:"PFS（IRC）",ep2:"OS, ORR, CNS-ORR",res:"mPFS 9.5 vs 7.4m (HR 0.76)",res2:"CNS-ORR改善",st:"pos",fpi:2020.5,lpi:2023.0,readout:2024.5,nct:"NCT03975647",note:"ASCO 2024。TUC+T-DM1"},
  // === TNBC / ADC ===
  {drug:"Dato-DXd",trial:"TB-02",ph:"III",sub:"TNBC",pop:"1L MBC IO不適",arm:"Dato-DXd",ctrl:"医師選択化学療法",ep:"PFS（IRC）, OS",ep2:"ORR, DoR",res:"mOS HR 0.79, mPFS HR 0.57",res2:"ORR 37% vs 23%",st:"pos",fpi:2022.5,lpi:2024.5,readout:2025.8,nct:"NCT05374512",note:"ESMO 2025。FDA承認予定 2026 Q2"},
  {drug:"Dato-DXd",trial:"TB-04",ph:"III",sub:"TNBC",pop:"1L MBC IO適格",arm:"Dato-DXd + durvalumab",ctrl:"化学療法 + pembrolizumab",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2023.5,lpi:2026.5,readout:2027.5,nct:"NCT06112379",note:"Dato+durva vs chemo+pembro"},
  {drug:"Sac-Gov",trial:"ASCENT-04/KN-D19",ph:"III",sub:"TNBC",pop:"1L MBC PD-L1+",arm:"sacituzumab govitecan + pembrolizumab",ctrl:"化学療法 + pembrolizumab",ep:"PFS（IRC）",ep2:"OS, ORR",res:"PFS有意改善",res2:"ORR改善",st:"pos",fpi:2022.5,lpi:2024.5,readout:2025.5,nct:"NCT05382286",note:"NEJM 2026。SG+pembro"},
  {drug:"Sac-Gov",trial:"ASCENT-03",ph:"III",sub:"TNBC",pop:"1L MBC IO不適",arm:"sacituzumab govitecan mono",ctrl:"医師選択化学療法",ep:"PFS（IRC）, OS",ep2:"ORR, DoR",res:"PFS/OS有意改善",res2:"",st:"pos",fpi:2022.0,lpi:2024.5,readout:2025.5,nct:"NCT05382299",note:"SG mono vs chemo"},
  {drug:"Sac-TMT",trial:"OptiTROP-Breast01",ph:"III",sub:"TNBC",pop:"MBC 2L+",arm:"sac-TMT 5mg/kg Q2W",ctrl:"医師選択化学療法",ep:"PFS（IRC）, OS",ep2:"ORR, DoR",res:"mPFS 6.7 vs 2.5m (HR 0.32), mOS NR vs 9.4m (HR 0.53)",res2:"ORR 44% vs 5%",st:"pos",fpi:2022.5,lpi:2024.0,readout:2025.0,nct:"NCT05347134",note:"Nat Med 2025。HR 0.32"},
  {drug:"Sac-TMT",trial:"OptiTROP-Breast02",ph:"III",sub:"HR+/HER2-",pop:"MBC 2L+",arm:"sac-TMT 5mg/kg Q2W",ctrl:"医師選択化学療法",ep:"PFS（IRC）",ep2:"OS, ORR",res:"mPFS 8.3 vs 4.1m (HR 0.35)",res2:"ORR改善",st:"pos",fpi:2023.0,lpi:2025.0,readout:2025.8,nct:"NCT06081959",note:"ESMO 2025。HR 0.35"},
  {drug:"Sac-TMT",trial:"OptiTROP-Breast03/TroFuse",ph:"III",sub:"TNBC",pop:"1L MBC PD-L1+",arm:"sac-TMT + pembrolizumab",ctrl:"化学療法 + pembrolizumab",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2024.0,lpi:2026.5,readout:2027.5,note:"Sac-TMT+pembro"},
  {drug:"Sac-TMT",trial:"TroFuse-011",ph:"III",sub:"TNBC",pop:"1L MBC CPS<10",arm:"sac-TMT mono / sac-TMT + pembro",ctrl:"医師選択化学療法",ep:"PFS（IRC）, OS",ep2:"ORR",st:"run",fpi:2025.0,lpi:2027.5,readout:2028.0,nct:"NCT06841354",note:"sac-TMT±pembro vs chemo"},
  {drug:"Sac-TMT",trial:"TroFuse-032",ph:"III",sub:"TNBC",pop:"EBC 周術期",arm:"pembro + sac-TMT → pembro + chemo",ctrl:"pembro + chemo → pembro + AC/EC",ep:"pCR, EFS",ep2:"OS, iDFS",st:"run",fpi:2026.0,lpi:2028.5,readout:2029.0,nct:"NCT06966700",note:"pembro+sac-TMT neo→adj"},
  {drug:"pumitamig",trial:"ROSETTA-BREAST-01",ph:"III",sub:"TNBC",pop:"1L MBC PD-L1陰性",arm:"pumitamig + chemo",ctrl:"placebo + chemo",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2025.0,lpi:2027.0,readout:2028.0,nct:"NCT07173751",note:"BNT327+chemo。PD-L1陰性TNBC"},
  {drug:"pumitamig",trial:"Phase III（HR+/HER2-）",ph:"III",sub:"HR+/HER2-",pop:"MBC",arm:"pumitamig + ET",ctrl:"ET",ep:"PFS（IRC）",ep2:"OS, ORR",st:"run",fpi:2025.5,lpi:2027.5,readout:2028.5,note:"BNT327+ET vs ET。登録未開始"},
];

const stColors = {pos:"#16a34a",neg:"#dc2626",run:"#2563eb"};
const subColors = {"HR+/HER2-":"#7c3aed","HER2+":"#0369a1","TNBC":"#dc2626","HER2-low":"#b45309"};

function GanttChart({focusTrial,onFocusClear}){
  const [subFilter,setSubFilter]=useState("ALL");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const [selectedTrial,setSelectedTrial]=useState(null);
  const subs=["ALL","HR+/HER2-","HER2+","TNBC","HER2-low"];
  const sts=["ALL","run","pos","neg"];
  const stLabels={ALL:"すべて",run:"進行中",pos:"Positive",neg:"Negative"};

  const filtered=useMemo(()=>{
    let list=TIMELINE;
    if(subFilter!=="ALL")list=list.filter(t=>t.sub===subFilter);
    if(statusFilter!=="ALL")list=list.filter(t=>t.st===statusFilter);
    return list.sort((a,b)=>a.readout-b.readout);
  },[subFilter,statusFilter]);

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

      {/* Year axis */}
      <div style={{position:"relative",marginLeft:220,height:24,borderBottom:"1px solid #e2e8f0",marginBottom:4}}>
        {Array.from({length:maxY-minY+1},(_,i)=>minY+i).map(y=>(
          <span key={y} style={{position:"absolute",left:pct(y)+"%",transform:"translateX(-50%)",fontSize:10,color:"#94a3b8",top:4}}>{y}</span>
        ))}
        <div style={{position:"absolute",left:pct(now)+"%",top:0,bottom:-4,width:2,background:"#dc2626",zIndex:5}}/>
      </div>

      {/* Rows */}
      {filtered.map((t,i)=>{
        const barLeft=pct(t.fpi);
        const barRight=pct(t.readout||(t.st==="run"?maxY:t.lpi));
        const barWidth=barRight-barLeft;
        const isSelected=selectedTrial===t.trial;
        return(
          <div key={i} data-trial={t.trial}>
          <div style={{display:"flex",alignItems:"center",marginBottom:isSelected?0:2,minHeight:28,cursor:"pointer",background:isSelected?"#eff6ff":"transparent",borderRadius:4}} onClick={()=>setSelectedTrial(isSelected?null:t.trial)}>
            {/* Label: trial name main, drug name small */}
            <div style={{width:220,flexShrink:0,display:"flex",alignItems:"center",gap:6,paddingRight:8}}>
              <span style={{width:6,height:6,borderRadius:3,background:subColors[t.sub]||"#64748b",flexShrink:0}}/>
              <span style={{fontSize:11,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{t.trial}</span>
              <span style={{fontSize:9,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drug}</span>
            </div>
            {/* Gantt bar area */}
            <div style={{flex:1,position:"relative",height:22}}>
              {/* Enrollment bar (FPI → LPI) */}
              <div style={{position:"absolute",left:pct(t.fpi)+"%",width:(pct(t.lpi)-pct(t.fpi))+"%",height:10,top:6,background:"#e2e8f0",borderRadius:3}}/>
              {/* Active bar (FPI → readout) */}
              <div title={t.note} style={{position:"absolute",left:pct(t.fpi)+"%",width:(pct(t.readout||2028)-pct(t.fpi))+"%",height:18,top:2,background:stColors[t.st]+"22",border:`1.5px solid ${stColors[t.st]}`,borderRadius:4,display:"flex",alignItems:"center",paddingLeft:4,overflow:"hidden"}}>
                <span style={{fontSize:9,fontWeight:600,color:stColors[t.st],whiteSpace:"nowrap"}}>{t.ph} {t.st==="pos"?"✓":t.st==="neg"?"✗":"⏳"}</span>
              </div>
              {/* Readout marker */}
              {t.readout&&<div style={{position:"absolute",left:pct(t.readout)+"%",top:0,width:2,height:22,background:stColors[t.st],borderRadius:1}}/>}
              {/* Now line */}
              <div style={{position:"absolute",left:pct(now)+"%",top:0,bottom:0,width:1.5,background:"#dc262640",zIndex:2}}/>
            </div>
          </div>
          {/* Trial detail panel */}
          {isSelected&&(
            <div style={{marginLeft:220,marginBottom:8,padding:"8px 14px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12}}>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"baseline",marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{t.trial}</span>
                <span style={{fontSize:11,color:"#475569"}}>Phase {t.ph}</span>
                <SubChip t={t.sub}/>
                <span style={{color:stColors[t.st],fontWeight:600,fontSize:11}}>{t.st==="pos"?"Positive":t.st==="neg"?"Negative":"進行中"}</span>
              </div>
              <div style={{color:"#334155",lineHeight:1.6}}>
                <div><strong>薬剤:</strong> <DrugLink generic={DRUGS.find(d=>d.generic===t.drug||d.name.includes(t.drug))?.generic||""} label={t.drug}/></div>
                <div><strong>対象:</strong> {t.pop}</div>
                {t.arm&&<div><strong>治療群:</strong> {t.arm}</div>}
                {t.ctrl&&<div><strong>対照群:</strong> {t.ctrl}</div>}
                {t.ep&&<div><strong>主要評価項目:</strong> {t.ep}{t.res&&<span style={{color:t.st==="pos"?"#059669":t.st==="neg"?"#dc2626":"#2563eb",fontWeight:600,marginLeft:8}}>→ {t.res}</span>}</div>}
                {t.ep2&&<div><strong>副次評価項目:</strong> {t.ep2}{t.res2&&<span style={{color:"#475569",marginLeft:8}}>→ {t.res2}</span>}</div>}
                <div><strong>登録期間:</strong> {Math.floor(t.fpi)}年 → {Math.floor(t.lpi)}年{t.readout&&`　結果発表: ${Math.floor(t.readout)}年`}</div>
                {t.note&&<div><strong>備考:</strong> {t.note}</div>}
                <div style={{marginTop:4}}><a href={t.nct?`https://clinicaltrials.gov/study/${t.nct}`:`https://clinicaltrials.gov/search?term=${encodeURIComponent(t.trial+" breast cancer")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#2563eb",textDecoration:"underline"}}>{t.nct||"ClinicalTrials.gov で検索"}</a></div>
              </div>
            </div>
          )}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap",fontSize:11,color:"#64748b"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:16,height:8,background:"#e2e8f0",borderRadius:2,display:"inline-block"}}/>登録期間（FPI→LPI）</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:16,height:8,border:"1.5px solid #2563eb",borderRadius:2,background:"#2563eb22",display:"inline-block"}}/>進行中</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:16,height:8,border:"1.5px solid #16a34a",borderRadius:2,background:"#16a34a22",display:"inline-block"}}/>Positive</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:16,height:8,border:"1.5px solid #dc2626",borderRadius:2,background:"#dc262622",display:"inline-block"}}/>Negative</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:2,height:12,background:"#dc2626",display:"inline-block"}}/>現在</span>
      </div>

      <div style={{marginTop:12,fontSize:11,color:"#94a3b8"}}>
        バーにカーソルを合わせると詳細。赤線は現在（2026年3月）。灰色部分は登録期間、色付き部分は試験全体期間。右端の縦線はデータ公表時点。
      </div>
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
  const [search,setSearch]=useState("");
  const [focusDrug,setFocusDrug]=useState(null);
  const [focusTrial,setFocusTrial]=useState(null);
  const subs=["ALL","HR+/HER2-","HER2+","TNBC","HER2-low"];
  const filtered=useMemo(()=>{
    let list=DRUGS;
    if(filter!=="ALL")list=list.filter(d=>d.sub.includes(filter));
    if(search.trim())list=list.filter(d=>(d.name+d.generic+d.co+d.cls).toLowerCase().includes(search.toLowerCase()));
    return list;
  },[filter,search]);

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
        <p style={{margin:"3px 0 0",fontSize:10,color:"#64748b"}}>2026年1.0版　｜　最終更新: {UPDATED}　｜　収録薬剤: {DRUGS.length}　｜　収録試験: {TIMELINE.length}</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:20}}>
        {[{k:"drugs",l:["治療開発","パイプライン"]},{k:"gantt",l:["臨床試験","タイムライン"]},{k:"landscape",l:["開発初期","ランドスケープ"]},{k:"soc",l:["乳癌の標準治療","（日本）"]},{k:"changelog",l:["変更履歴",""]},{k:"about",l:["このサイト","について"]}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)} style={{fontSize:13,fontWeight:tab===k?700:400,padding:"10px 20px",background:tab===k?"#fff":"#f1f5f9",color:tab===k?"#0f172a":"#64748b",border:tab===k?"1px solid #e2e8f0":"1px solid transparent",borderBottom:tab===k?"1px solid #fff":"1px solid #e2e8f0",borderRadius:"8px 8px 0 0",cursor:"pointer",marginBottom:-1,position:"relative",zIndex:tab===k?2:1,lineHeight:1.3,textAlign:"center"}}>{l[0]}<br/>{l[1]}</button>
        ))}
        <div style={{flex:1,borderBottom:"1px solid #e2e8f0"}}/>
      </div>

      {tab==="soc" && (
        <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
          <h2 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#0f172a"}}>乳癌の標準治療（日本）2026年3月時点</h2>
          <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>日本乳癌学会GL 2022 + WEB改訂 + 2024-2026年新薬承認を反映。サブタイプ×EBC/MBC別にレジメンを整理。後発品未発売の薬剤は「治療開発パイプライン」タブに詳細カードあり。</p>
          <StandardOfCare/>
        </div>
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
                      <div style={{color:e.done?"#64748b":"#334155"}}>{e.done?"✓":"•"} {item.text}</div>
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
                  <span style={{fontWeight:700,minWidth:130}}>{j.name}</span>
                  <span style={{color:"#64748b",fontSize:11,flex:"1 1 160px"}}>{j.sub}</span>
                  <span style={{fontSize:11,color:"#334155",textAlign:"right"}}>{j.status}</span>
                </div>
              ))}
              <div style={{fontSize:10,color:"#94a3b8",marginTop:8}}>🟢 国内承認済　🟡 海外承認済・国内開発中　⚫ 海外承認済・国内未導入</div>
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
              {subs.map(s=>(
                <button key={s} onClick={()=>setFilter(s)} style={{fontSize:11,fontWeight:filter===s?700:400,padding:"4px 12px",borderRadius:999,border:filter===s?"2px solid #7c3aed":"1px solid #e2e8f0",background:filter===s?"#ede9fe":"#fff",color:filter===s?"#7c3aed":"#475569",cursor:"pointer"}}>{s}</button>
              ))}
              <input placeholder="検索..." value={search} onChange={e=>setSearch(e.target.value)} style={{fontSize:12,padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",outline:"none",width:140}}/>
            </div>
          </div>

          <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{filtered.length} 件表示中</div>
          {filtered.map(d=><DrugCard key={d.id} d={d} focusDrug={focusDrug} onFocusClear={()=>setFocusDrug(null)}/>)}

          {/* 収録基準（タブ下部） */}
          <div style={{background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #e2e8f0",marginTop:20}}>
            <h2 style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:"#0f172a"}}>収録基準</h2>
            <div style={{fontSize:12,color:"#334155",lineHeight:1.8}}>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#16a34a",minWidth:20}}>A.</span><span><strong>標準治療に使用される先発品（後発品未発売）</strong> — 「乳癌の標準治療（日本）」タブに掲載のレジメンで使用される薬剤のうち、後発品・バイオシミラーが上市されていないもの。特許/独占権情報とライフサイクルを掲載。</span></div>
              <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"baseline"}}><span style={{fontWeight:700,color:"#2563eb",minWidth:20}}>B.</span><span><strong>承認申請中の薬剤</strong> — 3極（FDA/EMA/PMDA）のいずれかで承認申請中。FDA承認判断予定日等を記載。</span></div>
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

      {tab==="changelog" && (
        <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",border:"1px solid #e2e8f0"}}>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"#0f172a"}}>変更履歴</h2>
          {[
            {ver:"1.0",date:"2026-03-22",type:"major",items:[
              "初版公開",
              "治療開発パイプライン: 32薬剤（HR+/HER2- 15, HER2+ 8, TNBC 5, 新規開発品 4）",
              "臨床試験タイムライン: 33試験（ガントチャート+試験詳細パネル+NCT番号リンク）",
              "開発初期ランドスケープ: 25薬剤（9カテゴリ: ADC, bispecific, PROTAC, CDK2/7, IO, RDC等）",
              "乳癌の標準治療（日本）: JBCS GL 2022 + WEB改訂 + 2024-2026新薬承認反映",
              "ページ内リンク: 薬剤名→カード展開、試験名→タイムライン遷移",
            ]},
          ].map((log,i)=>(
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
            <p style={{margin:"0 0 20px"}}>乳がんについて不安を感じている方や、知りたいと思っている方に、少しでも安心していただける情報を届けられればと考えています。</p>
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
