# Claude Code 指示書：「治療費シミュレーター」タブの新規追加

## 概要

shinsho.bctube.org（乳がん新書2026）に「治療費シミュレーター」タブを新規追加してください。
乳癌の各レジメン（薬剤の組み合わせ）について、年齢・年収・治療期間を選択すると、高額療養費制度を反映した自己負担額を一覧表示するツールです。

**既存タブに一切の変更を加えないでください。** 治療費タブは独立したコンポーネントとして追加します。

---

## 技術スタック（既存サイトに準拠）

- Vite + React（SPA）
- UI: React JSX（`src/App.jsx` が全タブを統合）
- データ: JSON分離済み（`src/data/*.json`）
- スタイリング: インラインCSS（既存サイトのダークテーマ・COLORS定義を踏襲）
- ホスティング: Netlify（`shinsho.bctube.org`）
- 外部ライブラリ: React / ReactDOM のみ（追加不可）

---

## 作業一覧

1. `src/data/regimens.json` を作成（レジメンデータ）
2. `src/data/kougaku.json` を作成（高額療養費制度パラメータ）
3. `src/components/CostSimulator.jsx` を作成（メインUIコンポーネント）
4. `src/App.jsx` のタブナビゲーションに「治療費」タブを追加
5. ヘッダーの統計情報に「収録レジメン: 42」を追加
6. ビルド確認

---

## 作業1: `src/data/regimens.json`

以下の全42レジメンを収録してください。

### データスキーマ

```json
{
  "id": "ec",
  "name": "EC療法",
  "sub": "エピルビシン＋シクロホスファミド",
  "group": "化学療法",
  "cycle": "3週毎×4",
  "drugIds": ["epirubicin", "cyclophosphamide"],
  "monthlyBrand": 80000,
  "monthlyGeneric": 45000,
  "genericType": "GE",
  "genericNote": "エピルビシンGE＋エンドキサンGE",
  "approved": true,
  "lastChecked": "2025-04-01",
  "source": "厚労省薬価基準R7.4",
  "sourceUrl": [
    "https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html",
    "https://www.ganchiryohi.com/cost/28"
  ]
}
```

### フィールド定義

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | 一意ID。薬剤単体は一般名英語小文字、レジメンは略称（drug-master準拠） |
| `name` | string | 表示名（日本語商品名含む） |
| `sub` | string | 説明テキスト |
| `group` | string | グループ: "化学療法" / "HER2標的" / "CDK4/6" / "ホルモン" / "免疫/他" / "支持療法" |
| `cycle` | string | 投与サイクル |
| `drugIds` | string[] | 構成薬剤のID配列（将来のdrug-master接続用） |
| `monthlyBrand` | number | 先発品使用時の月間総医療費（10割）概算（円） |
| `monthlyGeneric` | number\|null | 後発品/BS使用時。null = 後発品なし |
| `genericType` | string\|null | "GE" / "BS" / "BS+GE" / null |
| `genericNote` | string\|null | 後発品名等の補足 |
| `approved` | boolean | 日本で保険適用されているか |
| `lastChecked` | string | 薬価の最終確認日 (YYYY-MM-DD) |
| `source` | string | 出典テキスト |
| `sourceUrl` | string[] | 根拠URLの配列 |

### 全42レジメンのデータ

```json
[
  {"id":"ec","name":"EC療法","sub":"エピルビシン＋シクロホスファミド","group":"化学療法","cycle":"3週毎×4","drugIds":["epirubicin","cyclophosphamide"],"monthlyBrand":80000,"monthlyGeneric":45000,"genericType":"GE","genericNote":"エピルビシンGE＋エンドキサンGE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.ganchiryohi.com/cost/28"]},
  {"id":"ac","name":"AC療法","sub":"ドキソルビシン＋シクロホスファミド","group":"化学療法","cycle":"3週毎×4","drugIds":["doxorubicin","cyclophosphamide"],"monthlyBrand":70000,"monthlyGeneric":40000,"genericType":"GE","genericNote":"ドキソルビシンGE＋エンドキサンGE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.ganchiryohi.com/cost/28"]},
  {"id":"fec","name":"FEC療法","sub":"5-FU＋エピルビシン＋シクロホスファミド","group":"化学療法","cycle":"3週毎×6","drugIds":["fluorouracil","epirubicin","cyclophosphamide"],"monthlyBrand":90000,"monthlyGeneric":50000,"genericType":"GE","genericNote":"全成分GEあり","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"tc","name":"TC療法","sub":"ドセタキセル＋シクロホスファミド","group":"化学療法","cycle":"3週毎×4","drugIds":["docetaxel","cyclophosphamide"],"monthlyBrand":180000,"monthlyGeneric":100000,"genericType":"GE","genericNote":"ドセタキセルGE（EE/NK/サワイ等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.kegg.jp/medicus-bin/similar_product?kegg_drug=DG01763"]},
  {"id":"ptx-weekly","name":"パクリタキセル毎週","sub":"パクリタキセル 80mg/m²","group":"化学療法","cycle":"毎週×12","drugIds":["paclitaxel"],"monthlyBrand":120000,"monthlyGeneric":55000,"genericType":"GE","genericNote":"パクリタキセル注（NK/サワイ等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4 / KEGG","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.kegg.jp/medicus-bin/similar_product?kegg_drug=DG01430"]},
  {"id":"docetaxel","name":"ドセタキセル","sub":"ドセタキセル 75mg/m²","group":"化学療法","cycle":"3週毎×4","drugIds":["docetaxel"],"monthlyBrand":150000,"monthlyGeneric":75000,"genericType":"GE","genericNote":"ドセタキセル注（EE/NK/サワイ等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4 / KEGG","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.kegg.jp/medicus-bin/similar_product?kegg_drug=DG01763"]},
  {"id":"capecitabine","name":"カペシタビン（ゼローダ）","sub":"経口フッ化ピリミジン","group":"化学療法","cycle":"3週サイクル","drugIds":["capecitabine"],"monthlyBrand":100000,"monthlyGeneric":45000,"genericType":"GE","genericNote":"カペシタビン錠（サワイ/NK等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"eribulin","name":"エリブリン（ハラヴェン）","sub":"微小管阻害薬","group":"化学療法","cycle":"3週毎","drugIds":["eribulin"],"monthlyBrand":250000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"gemcitabine","name":"ゲムシタビン","sub":"代謝拮抗薬","group":"化学療法","cycle":"3〜4週毎","drugIds":["gemcitabine"],"monthlyBrand":130000,"monthlyGeneric":50000,"genericType":"GE","genericNote":"ゲムシタビン注（NK/サワイ/ヤクルト等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"vinorelbine","name":"ビノレルビン（ナベルビン）","sub":"ビンカアルカロイド系","group":"化学療法","cycle":"毎週","drugIds":["vinorelbine"],"monthlyBrand":110000,"monthlyGeneric":55000,"genericType":"GE","genericNote":"ビノレルビン注（サワイ等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"nab-paclitaxel","name":"nab-パクリタキセル（アブラキサン）","sub":"アルブミン懸濁型","group":"化学療法","cycle":"3週毎","drugIds":["nab-paclitaxel"],"monthlyBrand":350000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"s-1","name":"S-1（ティーエスワン）","sub":"経口フッ化ピリミジン配合剤","group":"化学療法","cycle":"4週投薬2週休薬","drugIds":["s-1"],"monthlyBrand":60000,"monthlyGeneric":25000,"genericType":"GE","genericNote":"テガフール・ギメラシル・オテラシルGE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},

  {"id":"trastuzumab","name":"トラスツズマブ（ハーセプチン）","sub":"HER2陽性 分子標的薬 点滴","group":"HER2標的","cycle":"3週毎","drugIds":["trastuzumab"],"monthlyBrand":250000,"monthlyGeneric":175000,"genericType":"BS","genericNote":"トラスツズマブBS（NK/CTH/第一三共/ファイザー）","approved":true,"lastChecked":"2025-04-01","source":"バイオシミラー協議会 / KEGG","sourceUrl":["https://www.biosimilar.jp/pdf/biosimilar_list.pdf","https://www.kegg.jp/medicus-bin/similar_product?kegg_drug=DG02060"]},
  {"id":"phesgo","name":"フェスゴ配合皮下注","sub":"ペルツズマブ＋トラスツズマブ＋VHA 皮下注","group":"HER2標的","cycle":"3週毎","drugIds":["pertuzumab","trastuzumab"],"monthlyBrand":520000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"中外製薬プレスリリース / KEGG","sourceUrl":["https://www.chugai-pharm.co.jp/news/detail/20231122113000_1346.html","https://www.kegg.jp/medicus-bin/japic_med?japic_code=00071051"]},
  {"id":"hp-iv","name":"HP療法（パージェタ＋ハーセプチン点滴）","sub":"HER2陽性 二重阻害 点滴版","group":"HER2標的","cycle":"3週毎","drugIds":["pertuzumab","trastuzumab"],"monthlyBrand":550000,"monthlyGeneric":475000,"genericType":"BS","genericNote":"トラスツズマブ部分のみBS化可","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準 / BS協議会","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html","https://www.biosimilar.jp/pdf/biosimilar_list.pdf"]},
  {"id":"trastuzumab-emtansine","name":"T-DM1（カドサイラ）","sub":"抗体薬物複合体 ADC","group":"HER2標的","cycle":"3週毎","drugIds":["trastuzumab-emtansine"],"monthlyBrand":650000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"trastuzumab-deruxtecan","name":"T-DXd（エンハーツ）","sub":"HER2陽性/低発現 ADC","group":"HER2標的","cycle":"3週毎","drugIds":["trastuzumab-deruxtecan"],"monthlyBrand":700000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"tucatinib","name":"ツカチニブ（ツキシ）","sub":"HER2-TKI 経口","group":"HER2標的","cycle":"連日内服","drugIds":["tucatinib"],"monthlyBrand":580000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"lapatinib","name":"ラパチニブ（タイケルブ）","sub":"HER1/HER2 TKI 経口","group":"HER2標的","cycle":"連日内服","drugIds":["lapatinib"],"monthlyBrand":280000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"neratinib","name":"ネラチニブ（ナーリンクス）","sub":"pan-HER TKI 経口 術後延長","group":"HER2標的","cycle":"連日内服×1年","drugIds":["neratinib"],"monthlyBrand":450000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},

  {"id":"abemaciclib","name":"アベマシクリブ（ベージニオ）","sub":"CDK4/6阻害薬","group":"CDK4/6","cycle":"連日内服","drugIds":["abemaciclib"],"monthlyBrand":420000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"palbociclib","name":"パルボシクリブ（イブランス）","sub":"CDK4/6阻害薬","group":"CDK4/6","cycle":"3週+1週休","drugIds":["palbociclib"],"monthlyBrand":480000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"ribociclib","name":"リボシクリブ（キスカリ）","sub":"CDK4/6阻害薬","group":"CDK4/6","cycle":"3週+1週休","drugIds":["ribociclib"],"monthlyBrand":450000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},

  {"id":"letrozole","name":"レトロゾール（フェマーラ）","sub":"AI アロマターゼ阻害薬 閉経後","group":"ホルモン","cycle":"連日内服","drugIds":["letrozole"],"monthlyBrand":15000,"monthlyGeneric":5000,"genericType":"GE","genericNote":"レトロゾール錠（サワイ/NK等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"anastrozole","name":"アナストロゾール（アリミデックス）","sub":"AI アロマターゼ阻害薬 閉経後","group":"ホルモン","cycle":"連日内服","drugIds":["anastrozole"],"monthlyBrand":12000,"monthlyGeneric":4000,"genericType":"GE","genericNote":"アナストロゾール錠（サワイ/NK等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"exemestane","name":"エキセメスタン（アロマシン）","sub":"AI アロマターゼ阻害薬 閉経後","group":"ホルモン","cycle":"連日内服","drugIds":["exemestane"],"monthlyBrand":18000,"monthlyGeneric":7000,"genericType":"GE","genericNote":"エキセメスタン錠（NK等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"tamoxifen","name":"タモキシフェン（ノルバデックス）","sub":"SERM 抗エストロゲン","group":"ホルモン","cycle":"連日5-10年","drugIds":["tamoxifen"],"monthlyBrand":5000,"monthlyGeneric":2000,"genericType":"GE","genericNote":"タモキシフェン錠（サワイ等）多数あり","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"toremifene","name":"トレミフェン（フェアストン）","sub":"SERM 抗エストロゲン 閉経後","group":"ホルモン","cycle":"連日内服","drugIds":["toremifene"],"monthlyBrand":8000,"monthlyGeneric":3500,"genericType":"GE","genericNote":"トレミフェン錠GE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"fulvestrant","name":"フルベストラント（フェソロデックス）","sub":"SERD 筋注","group":"ホルモン","cycle":"4週毎","drugIds":["fulvestrant"],"monthlyBrand":120000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"goserelin","name":"ゴセレリン（ゾラデックス）","sub":"LH-RH アゴニスト 閉経前","group":"ホルモン","cycle":"4週毎 皮下注","drugIds":["goserelin"],"monthlyBrand":35000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"leuprorelin","name":"リュープロレリン（リュープリン）","sub":"LH-RH アゴニスト 閉経前","group":"ホルモン","cycle":"4週/12週/24週毎","drugIds":["leuprorelin"],"monthlyBrand":30000,"monthlyGeneric":20000,"genericType":"GE","genericNote":"リュープロレリン注GE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"medroxyprogesterone","name":"MPA（ヒスロン）","sub":"プロゲステロン製剤","group":"ホルモン","cycle":"連日内服","drugIds":["medroxyprogesterone"],"monthlyBrand":6000,"monthlyGeneric":3000,"genericType":"GE","genericNote":"メドロキシプロゲステロンGE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},

  {"id":"pembrolizumab","name":"ペムブロリズマブ（キイトルーダ）","sub":"免疫CP阻害薬 TNBC","group":"免疫/他","cycle":"3週毎","drugIds":["pembrolizumab"],"monthlyBrand":550000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"atezolizumab","name":"アテゾリズマブ（テセントリク）","sub":"免疫CP阻害薬 PD-L1+TNBC","group":"免疫/他","cycle":"2-3週毎","drugIds":["atezolizumab"],"monthlyBrand":500000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"olaparib","name":"オラパリブ（リムパーザ）","sub":"PARP阻害薬 BRCA変異陽性","group":"免疫/他","cycle":"連日内服","drugIds":["olaparib"],"monthlyBrand":600000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"talazoparib","name":"タラゾパリブ（ターゼナ）","sub":"PARP阻害薬 BRCA変異陽性","group":"免疫/他","cycle":"連日内服","drugIds":["talazoparib"],"monthlyBrand":550000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"everolimus","name":"エベロリムス（アフィニトール）","sub":"mTOR阻害薬 AI耐性HR+","group":"免疫/他","cycle":"連日内服","drugIds":["everolimus"],"monthlyBrand":350000,"monthlyGeneric":180000,"genericType":"GE","genericNote":"エベロリムス錠（サワイ等）","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"sacituzumab-govitecan","name":"サシツズマブ ゴビテカン（トロデルヴィ）","sub":"Trop-2 ADC","group":"免疫/他","cycle":"3週毎","drugIds":["sacituzumab-govitecan"],"monthlyBrand":800000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"bev-ptx","name":"ベバシズマブ＋パクリタキセル","sub":"VEGF阻害＋タキサン","group":"免疫/他","cycle":"4週毎","drugIds":["bevacizumab","paclitaxel"],"monthlyBrand":400000,"monthlyGeneric":250000,"genericType":"BS+GE","genericNote":"ベバシズマブBS＋パクリタキセルGE","approved":true,"lastChecked":"2025-04-01","source":"バイオシミラー協議会 / 厚労省薬価基準","sourceUrl":["https://www.biosimilar.jp/pdf/biosimilar_list.pdf","https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},

  {"id":"denosumab","name":"デノスマブ（ランマーク）","sub":"骨転移 抗RANKL抗体","group":"支持療法","cycle":"4週毎 皮下注","drugIds":["denosumab"],"monthlyBrand":120000,"monthlyGeneric":null,"genericType":null,"genericNote":null,"approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"zoledronic-acid","name":"ゾレドロン酸（ゾメタ）","sub":"骨転移 ビスホスホネート","group":"支持療法","cycle":"3-4週毎 点滴","drugIds":["zoledronic-acid"],"monthlyBrand":45000,"monthlyGeneric":20000,"genericType":"GE","genericNote":"ゾレドロン酸注GE","approved":true,"lastChecked":"2025-04-01","source":"厚労省薬価基準R7.4","sourceUrl":["https://www.mhlw.go.jp/topics/2025/04/tp20250401-01.html"]},
  {"id":"pegfilgrastim","name":"ペグフィルグラスチム（ジーラスタ）","sub":"G-CSF 好中球減少予防","group":"支持療法","cycle":"化学療法毎","drugIds":["pegfilgrastim"],"monthlyBrand":108000,"monthlyGeneric":75000,"genericType":"BS","genericNote":"ペグフィルグラスチムBS","approved":true,"lastChecked":"2025-04-01","source":"バイオシミラー協議会","sourceUrl":["https://www.biosimilar.jp/pdf/biosimilar_list.pdf"]}
]
```

---

## 作業2: `src/data/kougaku.json`

高額療養費制度のパラメータを外部JSONとして管理。制度改正時にここだけ更新する。

```json
{
  "systemName": "高額療養費制度",
  "effectiveDate": "2018-08-01",
  "note": "2025年8月以降の改正は2025年3月に見送り決定",
  "sourceUrls": [
    {"label": "厚労省 高額療養費制度パンフレット（H30.8〜）", "url": "https://www.mhlw.go.jp/content/000333280.pdf"},
    {"label": "厚労省 高額療養費制度の見直し（R7.12.25）", "url": "https://www.mhlw.go.jp/content/12401000/001621844.pdf"},
    {"label": "協会けんぽ 高額療養費", "url": "https://www.kyoukaikenpo.or.jp/g3/cat320/sb3170/sbb31709/1945-268/"}
  ],
  "lastChecked": "2025-04-01",
  "categories69under": [
    {"id": "ア", "label": "年収約1,160万円〜",     "base": 252600, "threshold": 842000, "rate": 0.01, "multi": 140100, "fixed": false},
    {"id": "イ", "label": "年収約770〜1,160万円",  "base": 167400, "threshold": 558000, "rate": 0.01, "multi": 93000,  "fixed": false},
    {"id": "ウ", "label": "年収約370〜770万円",    "base": 80100,  "threshold": 267000, "rate": 0.01, "multi": 44400,  "fixed": false},
    {"id": "エ", "label": "〜年収約370万円",       "base": 57600,  "threshold": 0,      "rate": 0,    "multi": 44400,  "fixed": true},
    {"id": "オ", "label": "住民税非課税",           "base": 35400,  "threshold": 0,      "rate": 0,    "multi": 24600,  "fixed": true}
  ],
  "copayRates": [
    {"ageGroup": "〜6歳",     "rate": 0.2},
    {"ageGroup": "6〜69歳",   "rate": 0.3},
    {"ageGroup": "70〜74歳",  "rate": 0.2},
    {"ageGroup": "75歳〜",    "rate": 0.1}
  ]
}
```

---

## 作業3: `src/components/CostSimulator.jsx`

### 機能要件

1. **フィルタタブ（sticky、ページ上部に固定）**
   - 年齢層: 4択（〜6歳 / 6〜69歳 / 70〜74歳 / 75歳〜）
   - 年収区分: 5択（住民税非課税 / 〜370万 / 370〜770万 / 770〜1,160万 / 1,160万〜）
   - 治療期間: 5択（1 / 3 / 6 / 12 / 24ヶ月）
   - タブを切り替えると全レジメンの価格が即座に再計算される

2. **グループフィルタ**
   - 全て / 化学療法 / HER2標的 / CDK4/6 / ホルモン / 免疫/他 / 支持療法

3. **後発品/BS列の表示切替ボタン**

4. **テーブル列構成**
   | 列 | 内容 |
   |---|---|
   | レジメン名 | 名前 + GE/BSバッジ + 🔗出典リンク |
   | 周期 | cycle |
   | **A** 先発品 医療費 | 自己負担割合 × 月額 × 期間（取り消し線） |
   | **B** 先発品 制度適用後 | 高額療養費適用後の累計（メイン表示） |
   | **C** 後発品/BS 医療費 | （後発品列ON時のみ） |
   | **D** 後発品/BS 制度後 | （後発品列ON時のみ） |
   | 差額 | B - D の差額（後発品列ON時のみ） |
   | 比較バー | 先発(青)/後発(緑) 2段バー |

5. **各列ヘッダーはクリックでソート可能**

6. **🔗アイコン**: レジメン名の右に表示。クリックで sourceUrl[0] を新規タブで開く。ホバーで全URL表示。

7. **テーブル下部**:
   - 高額療養費の計算式（区分ア〜オ）
   - 多数回該当の金額
   - 📎 主要参考URL一覧（薬価・制度の公式URLをリンク付きで掲載）
   - ⚠ 注意書き

### 高額療養費の計算ロジック

```javascript
// 自己負担限度額の計算
function calcLimit(totalMedical, category, isMultipleOccurrence) {
  const rules = {
    "ア": { base: 252600, threshold: 842000, rate: 0.01, multi: 140100 },
    "イ": { base: 167400, threshold: 558000, rate: 0.01, multi: 93000 },
    "ウ": { base: 80100,  threshold: 267000, rate: 0.01, multi: 44400 },
    "エ": { base: 57600,  threshold: 0,      rate: 0,    multi: 44400, fixed: true },
    "オ": { base: 35400,  threshold: 0,      rate: 0,    multi: 24600, fixed: true },
  };
  const r = rules[category];
  if (isMultipleOccurrence) return r.multi;
  if (r.fixed) return r.base;
  return r.base + Math.max(totalMedical - r.threshold, 0) * r.rate;
}

// 多数回該当: 直近12ヶ月で3回以上限度額に達した場合、4回目以降は multi の金額
function simulate(monthlyMedical, category, copayRate, months) {
  let multiCount = 0, totalActual = 0, firstPay = 0, multiPay = 0;
  for (let m = 1; m <= months; m++) {
    const rawCopay = monthlyMedical * copayRate;
    const isMulti = multiCount >= 3;
    const limit = calcLimit(monthlyMedical, category, isMulti);
    const actual = Math.min(rawCopay, limit);
    totalActual += actual;
    if (m === 1) firstPay = actual;
    if (isMulti && multiPay === 0) multiPay = actual;
    if (rawCopay >= limit) multiCount++;
  }
  return { total: Math.round(totalActual), first: Math.round(firstPay), multi: Math.round(multiPay) };
}
```

### デザイン要件

- **既存サイトのダークテーマを完全踏襲**
- 既存サイトの `COLORS` 定義、フィルタUI、テーブルスタイルを参照して統一
- フィルタボタンのスタイル: パイプラインタブのサブタイプフィルターと同じパターン
- ステータスバッジ: GE=緑系、BS=紫系
- 金額表示: tabular-nums、等幅表示

---

## 作業4: タブナビゲーション統合

`src/App.jsx` のタブ配列に追加：

```javascript
// 既存タブの末尾に追加
{ id: "cost", label: "治療費", icon: "💊" }
```

タブ描画部分で:
```javascript
{activeTab === "cost" && <CostSimulator />}
```

**注意: 既存の他タブのコードには一切触れないこと。**

---

## 作業5: ヘッダー更新

ヘッダーの統計表示に追加:
```
収録薬剤: 32 ｜ 収録試験: 32 ｜ 収録レジメン: 42
```

---

## 注意事項

- **外部ライブラリ追加不可**（React / ReactDOM のみ）
- **インラインCSS**で統一（styled-components等は使用しない）
- **既存タブの機能・データ・UIに変更を加えない**
- `regimens.json` と `kougaku.json` のデータは上記の内容をそのまま使用（値の変更不可）
- 薬価は概算値であることをフッターに明記
- フッターに「各レジメンの🔗から薬価の根拠URLを参照できます」を記載
- `kougaku.json` の `sourceUrls` を参考URL一覧セクションにリンク表示

---

## 作業順序

1. `src/data/regimens.json` 作成
2. `src/data/kougaku.json` 作成
3. `src/components/CostSimulator.jsx` 作成
4. `src/App.jsx` にタブ追加
5. ヘッダー統計更新
6. `npm run build` で確認
7. コミット・プッシュ

---

## ID命名規則（参考: drug-master設計書より）

将来的にプロジェクト全体のデータベースを統合する際、この `regimens.json` の `id` と `drugIds` が接続点になる。

| 種類 | 命名規則 | 例 |
|---|---|---|
| 薬剤ID (drugIds内) | 一般名英語小文字 | `trastuzumab`, `paclitaxel` |
| レジメンID | 略称小文字、ハイフン区切り | `ec`, `hp-iv`, `bev-ptx` |
| 単剤レジメン | 薬剤IDと同一 | `docetaxel`, `eribulin` |
