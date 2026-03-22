---
name: bc-pipeline-dashboard
description: "「乳がん新書」— 乳癌の標準治療・治療開発パイプライン・臨床試験タイムラインを網羅するインタラクティブダッシュボード。GitHub Pagesで「乳がん新書{YYYY}」として年次公開。5つの専門リサーチエージェントが体系的にWeb検索を行い、3極（FDA/EMA/PMDA）承認状況・臨床試験データ・学会発表・日本承認見通しを網羅的に収集。週次メンテナンス（情報収集・連携チェック・誤情報チェック）で継続的に更新。「乳がん新書」「パイプライン」「新薬開発状況」「pipeline」「開発品」「承認状況」「ダッシュボード」「新薬一覧」「breast cancer pipeline」「薬の開発どうなってる」「承認見通し」「ドラッグラグ」「週次更新」「Task 1」「Task 2」「Task 3」などのキーワードで発動。"
---

# 乳がん新書 — 乳癌治療パイプライン調査＋ダッシュボード生成

## 概要

**プロジェクト名**: 乳がん新書
**ホームページ名**: 乳がん新書{YYYY}（例: 乳がん新書2026）— 毎年1月に年号を更新

5つのリサーチエージェントが**体系的にWeb検索**を行い、乳癌治療薬の全開発段階を網羅的に調査。収集データをインタラクティブなReactダッシュボード（.jsx）として出力し、GitHub Pagesで一般公開する。

**4タブ構成**:
1. **乳癌の標準治療（日本）** — サブタイプ×EBC/MBC別の現在の標準治療レジメン。ガイドライン（JBCS GL 2022 + WEB改訂）＋最新の新薬承認を反映。
2. **治療開発パイプライン** — 薬剤カード。標準治療で使用される先発品（後発品未発売）＋開発中の新薬（Phase III以降 or 基準Dを満たすPhase II）を収録。
3. **臨床試験タイムライン** — ガントチャート。進行中＋直近2年に結果発表の試験を時系列で表示。
4. **開発初期ランドスケープ** — パイプライン収録基準未達の早期開発品（前臨床IND済み〜Phase II）を作用機序カテゴリ別にマッピング。ClinicalTrials.gov API＋Web検索＋レビュー論文の組み合わせで収集。

**タブ間の接続ロジック**: 「標準治療」の先発品（後発品なし）→「パイプライン」に薬剤カード → 各薬剤の試験が「タイムライン」にガント表示。「ランドスケープ」の薬剤が基準Dを満たした時点で「パイプライン」に昇格。

**出力物**: `/mnt/user-data/outputs/` にReact .jsx ファイルを生成・present_files
**ファイル命名規則**: `nyuugan_shinsho_{YYYY}_{MM}.jsx`（例: `nyuugan_shinsho_2026_03.jsx`）

---

## ⚠️ 過去のミスから学んだ絶対ルール（MUST READ）

以下は実際に発生したエラーから抽出した教訓。**すべてのPhaseでこのルールを遵守すること。**

### ルール1: 「LLMの知識で既承認薬の日本ステータスを埋めてはならない」
- **事例**: リボシクリブ（キスカリ）を「日本承認済 2019/3」と記載したが、実際は2017年に日本開発断念済み。
- **原因**: 英語圏では3剤とも承認済みという文脈がLLM訓練データに強く、日本固有の開発断念情報が反映されなかった。
- **対策**: **既承認薬（jp: "ok"と記載する薬剤）こそ最低1回は日本語Web検索で確認する**。「海外承認済み＝日本承認済み」は乳癌領域では危険な仮定。

### ルール2: 「既承認薬の新剤型を必ず収録する」
- **事例**: Keytruda Qlex（ペムブロリズマブ皮下注）がFDA承認済み（2025/9）だったが漏れた。
- **原因**: IV製剤を収録した時点で「対応済み」と判断し、皮下注製剤の検索をスキップした。
- **対策**: 全既承認薬について「皮下注/配合剤/バイオシミラー/新剤型」の有無を個別検索で確認する。

### ルール3: 「申請中ステータスは1ヶ月で変わりうる」
- **事例**: ツカチニブを「日本申請中（2025/3）」と記載したが、2026/2/19に承認取得済みだった。
- **原因**: 申請から承認までの期間が11ヶ月と比較的短く、LLMの知識カットオフ後に承認されていた。
- **対策**: `rev`（申請中）ステータスの薬剤は**毎回必ず最新の日本語検索で確認**する。特に「薬事審議会 第二部会 承認」で検索。

### ルール4: 「Agent 5（日本市場専門）のスキップは致命的」
- Agent 5の検索は**全薬剤に対して**実行する。「既承認で知っている」薬剤ほど検索を省略しがちだが、これが最大のリスク。
- 検索回数の制約がある場合は、**jp欄を「ok」「rev」にする薬剤を優先的に検索**する（誤りが致命的なため）。

---

## Phase 1: スコープと選定基準

### 収録範囲（デフォルト）

「治療開発パイプライン」タブ（薬剤カード）に収録する薬剤の定義。冒頭に収録基準を表示する。

| 区分 | 説明 | 例 |
|------|------|-----|
| **A. 標準治療に使用される先発品（後発品/BS未発売）** | 「乳癌の標準治療（日本）」タブに掲載のレジメンで使用される薬剤のうち、後発品・バイオシミラーが上市されていないもの。特許/独占権情報とライフサイクルを掲載 | palbociclib, abemaciclib, T-DXd, T-DM1, pembrolizumab, olaparib, talazoparib, capivasertib, Phesgo 等 |
| **B. 承認申請中** | 3極いずれかで承認申請中の薬剤 | Camizestrant, Vepdegestrant, Gedatolisib 等 |
| **C. Phase III** | 結果発表済み or 進行中のPhase III試験がある薬剤。既承認薬の新適応・新剤型を含む | Atirmociclib, Sac-TMT, pumitamig 等 |
| **D. Phase II（客観的条件を満たすもののみ）** | 以下の条件を**1つ以上**満たすPhase II薬剤: ① Phase III試験がClinicalTrials.govに登録済み ② 企業がPhase III開始を公式に発表 ③ FDA BTD（Breakthrough Therapy Designation）を取得 ④ 規制当局へのPre-NDA相談/科学的助言が公表済み | HER3-DXd 等 |

**除外対象**:
- 後発品・バイオシミラーが上市済みの古典的薬剤（tamoxifen, AI類, trastuzumab BS, everolimus GE, fulvestrant GE等）
- 化学療法レジメン（AC, taxane等）
- LHRH作動薬等の古典的薬剤

### 薬剤カード必須収録リスト（漏れ防止）

以下のカテゴリごとに**最低限これらの薬剤が含まれるか**を確認する。このリストに載っていない薬剤もリサーチで発見したら追加する。後発品/BS上市済みの薬剤（everolimus GE、fulvestrant GE、trastuzumab BS等）はパイプラインから除外するが、標準治療タブには記載する。

**⚠️ 注意: このリストの日本承認ステータスはLLM知識に頼らず、必ずWeb検索で最新状態を確認すること。**

#### HR+/HER2-
- CDK4/6阻害薬: palbociclib (Ibrance/イブランス), ribociclib (Kisqali/**日本未承認・開発断念**), abemaciclib (Verzenio/ベージニオ)
- SERD: fulvestrant (Faslodex), elacestrant (Orserdu/**日本未申請**), imlunestrant (Inluriyo/イムルリオ)
- PI3K/AKT: alpelisib (Piqray/ピキレイ), inavolisib (Itovebi), capivasertib (Truqap/トルカップ)
- mTOR: everolimus (Afinitor/アフィニトール/**GE上市済**)
- ADC: T-DXd (Enhertu/エンハーツ), Dato-DXd (Datroway/ダトロウェイ)
- AI: letrozole, anastrozole, exemestane（既承認だが新規情報なければ省略可）
- LHRH作動薬, tamoxifen等の古典的薬剤は省略可

#### HER2+
- 抗体: trastuzumab (Herceptin/バイオシミラー), pertuzumab (Perjeta), margetuximab (Margenza)
- ADC: T-DXd (Enhertu/エンハーツ), T-DM1 (Kadcyla/カドサイラ)
- TKI: tucatinib (Tukysa/ツカイザ), neratinib (Nerlynx), lapatinib (Tykerb)
- 皮下注: trastuzumab+pertuzumab+hyaluronidase (Phesgo/フェスゴ)

#### TNBC
- IO: pembrolizumab (Keytruda/キイトルーダ) ※**皮下注 (Keytruda Qlex) も別エントリで収録**
- ADC: sacituzumab govitecan (Trodelvy/トロデルビ), T-DXd (Enhertu/エンハーツ)
- PARP: olaparib (Lynparza/リムパーザ), talazoparib (Talzenna/ターゼナ)

#### サブタイプ横断
- 化学療法（古典的レジメン）は省略可
- バイオシミラーは代表1つのみ記載

### 新剤型チェックリスト（ルール2対応）

全既承認薬について以下を確認する:

- [ ] **皮下注製剤**: Keytruda Qlex（承認済）、Opdivo SC、Tecentriq SC等がないか
- [ ] **配合剤**: Phesgo（HP SC配合）等
- [ ] **バイオシミラー**: trastuzumab BS（複数上市済）、T-DM1 BS（開発中）等
- [ ] **新剤型・新用法**: 6週間ごと投与、高用量製剤等

### 適応レベルのデータ管理

**同一薬剤で適応（サブタイプ×ライン×EBC/MBC）ごとに承認状況が異なる場合、適応ごとに3極ステータスを管理する。**

データスキーマ:

```javascript
{
  // ... (基本フィールドは従来通り)
  
  // 適応ごとのステータス（indications配列）
  indications: [
    {
      label: "HR+/HER2- MBC 2L+",
      us: { s:"ok", t:"承認済 2025/1" },
      eu: { s:"rev", t:"申請中" },
      jp: { s:"rev", t:"第一三共が申請済" },
    },
    {
      label: "TNBC 1L MBC",
      us: { s:"rev", t:"Priority Review中（PDUFA 2026 Q2）" },
      eu: { s:"p3", t:"Phase III positive" },
      jp: { s:"p3", t:"Phase III（日本参加見込み）" },
    }
  ],
}
```

**適応が1つだけの薬剤**は、従来の `us/eu/jp` フラットフィールドで管理してもよい（後方互換）。複数適応がある薬剤は `indications` 配列を使用する。

---

## Phase 2: 体系的リサーチ（5エージェント）

### リサーチの網羅性チェックリスト

以下の**全軸**をカバーするまでリサーチを終了しない。

#### A. サブタイプ軸（最低1検索/サブタイプ）
- [ ] HR+/HER2- （SERD, CDK4/6i, PI3K, AKT, mTOR, PROTAC, ADC）
- [ ] HER2+ （抗体, ADC, TKI, bispecific, 皮下注製剤）
- [ ] TNBC （ADC, IO, ADC+IO, PARP, bispecific）
- [ ] HER2-low/ultralow （ADC）

#### B. 薬剤クラス軸（最低1検索/クラス）
- [ ] ADC（TROP2, HER2, HER3, B7-H4 等）
- [ ] 経口SERD / CERAN / PROTAC
- [ ] CDK阻害薬（CDK4/6i既承認群, 次世代CDK4, CDK7, CDK2）
- [ ] PI3K/AKT/mTOR経路阻害薬（既承認+新規）
- [ ] 免疫チェックポイント阻害薬・併用（IV + **皮下注**）
- [ ] HER2 TKI（ツカチニブ, ネラチニブ等）
- [ ] PARP阻害薬
- [ ] Bispecific Ab / Bispecific ADC
- [ ] その他の新規メカニズム（KAT6阻害薬等）

#### C. 開発段階軸
- [ ] 既承認（3極全適応を確認）
- [ ] **既承認薬の新剤型（皮下注、配合剤、バイオシミラー）** ← 漏れやすいので注意
- [ ] 既承認薬の適応拡大（新サブタイプ、新ライン、EBC追加）
- [ ] 承認申請中（NDA/MAA/PMDA）
- [ ] Phase III（Positive結果あり）
- [ ] Phase III（進行中・結果待ち）
- [ ] Phase II（有望データあり→Phase III移行予定のみ）

#### D. 地域軸（3極）
- [ ] 米国（FDA）承認・申請状況
- [ ] 欧州（EMA）承認・申請状況
- [ ] 日本（PMDA）承認・申請状況 + ドラッグ・ラグ評価

---

### Agent 1: 🏢 Big Pharma Scanner（大手パイプライン調査）

**担当**: 主要製薬企業のパイプラインを網羅的にスキャン

**必須検索リスト**（各社1回以上。**全社スキップ不可**）:

| 企業 | 検索クエリ例 |
|------|-------------|
| AstraZeneca | `AstraZeneca breast cancer pipeline 2026` |
| Daiichi Sankyo | `Daiichi Sankyo breast cancer pipeline ADC 2026` |
| Roche/Genentech | `Roche giredestrant inavolisib breast cancer 2026` |
| Pfizer | `Pfizer breast cancer pipeline atirmociclib vepdegestrant 2026` |
| Eli Lilly | `Eli Lilly imlunestrant breast cancer 2026` |
| **Merck/MSD** | `Merck breast cancer pembrolizumab Keytruda Qlex 2026` ← **皮下注を含めて検索** |
| Gilead | `Gilead sacituzumab govitecan breast cancer 2026` |
| Novartis | `Novartis breast cancer pipeline ribociclib 2026` |
| BioNTech | `BioNTech DB-1303 breast cancer 2026` |
| Arvinas | `Arvinas vepdegestrant breast cancer 2026` |

**出力**: 企業別の開発品リスト（薬剤名、Phase、対象サブタイプ）

---

### Agent 2: 📋 Regulatory Tracker（3極承認状況調査）

**担当**: FDA, EMA, PMDA の承認・申請状況を正確に追跡

**必須検索**:

| 対象 | 検索クエリ例 |
|------|-------------|
| FDA承認一覧 | `FDA novel drug approvals 2025 2026 breast cancer` |
| FDA申請中 | `FDA PDUFA breast cancer 2026` |
| ODAC予定 | `ODAC oncology advisory committee 2026 breast cancer` |
| EMA承認 | `EMA breast cancer approval 2025 2026` |
| EMA申請中 | `EMA CHMP breast cancer opinion 2026` |
| PMDA承認 | `PMDA 乳癌 新薬 承認 2025 2026` |
| PMDA申請 | `PMDA 乳癌 承認申請 2026` / `中外製薬 乳癌 申請` / `第一三共 乳癌 申請` |
| **薬事審議会** | `薬事審議会 医薬品第二部会 承認 乳癌 2026` ← **部会了承→承認の流れを確認** |

**薬剤ごとの確認項目**:

```
各薬剤について以下8項目を必ず埋める:
1. 🇺🇸 FDA: 承認済(日付) / 申請中(PDUFA日) / 未申請
2. 🇪🇺 EMA: 承認済(日付) / 申請中(CHMP意見日) / 未申請
3. 🇯🇵 PMDA: 承認済(日付+商品名) / 申請中 / 開発中(日本参加試験あり) / 開発断念 / 未開発
4. 承認適応の詳細テキスト（サブタイプ、ライン、バイオマーカー）
5. 日本承認見通し（時期予測 + 根拠）
6. ドラッグ・ラグリスク評価
7. 🆕 特許/独占権満了情報（米国主要特許の満了年、GE/BS参入見込み）
8. 🆕 日本での開発断念の有無と理由（該当する場合）
```

**日本承認見通しの判断基準**:

| 状態 | 見通し | 色コード |
|------|--------|---------|
| 日本企業が申請済 | 「20XX年中の承認が有力」 | 🟢 |
| 日本企業が申請準備中 | 「20XX年後半〜20XX年初」 | 🟢 |
| グローバル試験に日本参加あり | 「米国承認後→日本申請（20XX年以降）」 | 🟡 |
| 日本開発不明 | 「ドラッグ・ラグ懸念あり」 | ⚫ |
| **日本開発断念** | 「ドラッグ・ロス（開発断念済み）」 | 🔴 |

---

### Agent 3: 🔬 Clinical Trial Investigator（臨床試験データ調査）

**担当**: 各薬剤の主要臨床試験データを収集

**検索戦略**:

1. **Phase III結果**: `[薬剤名] phase 3 breast cancer results 2025 2026`
2. **進行中試験**: `[薬剤名] breast cancer clinical trial recruiting`
3. **学会発表**: `[薬剤名] ASCO 2025` / `SABCS 2025` / `ESMO 2025`
4. **論文掲載**: `[薬剤名] breast cancer NEJM Lancet 2025 2026`

**各試験について収集する項目（拡張スキーマ）**:

```javascript
{
  n: "試験名（例: DESTINY-Breast09）",
  ph: "相（例: III）",
  pop: "対象集団（サブタイプ + ライン + バイオマーカー）",
  arm: "試験治療（併用薬を含む完全なレジメン名）",   // 🆕
  ctrl: "対照治療（比較対象の完全なレジメン名）",     // 🆕
  res: "結果サマリー（HR, mPFS等の数値を含む）",
  st: "pos / run / neg",
  pr: "発表学会・論文（例: ASCO 2025 LBA）"
}
```

**⚠️ arm/ctrlは必須フィールド**。臨床試験の結果を正しく解釈するには「何と何を比較したか」が不可欠。「有意改善」だけでなく「何に対して改善したか」を明記する。単群試験の場合は `ctrl: "なし（単群）"` と記載。

**品質チェック**: 結果のres欄には可能な限り**数値データ（HR, mPFS, ORR等）**を含める。「有意改善」だけでは不十分。

---

### Agent 3b: 💊 Safety & Patent Profiler（有害事象・特許情報調査）🆕

**担当**: 各承認薬の有害事象プロファイルと特許/独占権情報を収集

**有害事象（ae）の収集項目**:

```javascript
ae: {
  freq: "高頻度AE（発現率20%以上のもの、頻度%付き）",
  severe: "重篤AE（Grade 3/4以上の注意すべきAE、頻度%付き）",
  note: "その薬剤に特徴的な臨床上のポイント（管理方法、モニタリング、禁忌等）"
}
```

**検索戦略**:
- `[薬剤名] adverse events safety profile breast cancer`
- `[薬剤名] prescribing information safety` / `[日本語薬剤名] 添付文書 副作用`
- CDK4/6i 3剤比較: `CDK4/6 inhibitor toxicity comparison neutropenia diarrhea QTc`

**有害事象のnoteに含めるべき特徴的ポイント（例）**:
- CDK4/6i: 好中球減少（palbociclib/ribociclib）vs 下痢（abemaciclib）の使い分け
- T-DXd: ILD/肺臓炎が最重要AE→定期画像モニタリング
- Keytruda: irAE（免疫関連有害事象）→遅発性・治療後も発症しうる
- alpelisib: 高血糖管理が最大の課題
- ribociclib: QTc延長→ECGモニタリング必須、タモキシフェン併用不可

**特許情報（pat）の収集項目**:

```javascript
pat: "🇺🇸 主要特許満了年（PTE含む）。ジェネリック/BS参入見込み時期"
```

**検索戦略**:
- `[薬剤名] patent expiry expiration date`
- `[薬剤名] generic biosimilar entry`
- `pharma patent cliff 2026 2027 2028 breast cancer`
- DrugPatentWatch (drugpatentwatch.com) が有用な情報源

**ライフサイクルタイムライン（lc）の収集項目**:

```javascript
lc: [
  { s: 開始年, e: 終了年, c: "色コード", tc: "テキスト色", t: "フェーズ名" },
  // 前臨床 → Ph I-III → 上市・成長期 → パテントクリフ → GE/BS時代
]
```

承認薬に対して、物質特許出願年〜ジェネリック/BS参入年までのタイムラインを作成する。

---

### Agent 4: 📅 Conference & Milestone Forecaster（学会・マイルストーン予測）

**担当**: 今後12ヶ月の学会発表予定と重要イベントを整理

**必須検索**:

| イベント | 検索クエリ例 |
|---------|-------------|
| ASCO | `ASCO 2026 breast cancer abstract` |
| ESMO | `ESMO 2026 breast cancer` |
| SABCS | `SABCS 2026` |
| ESMO Breast | `ESMO Breast Cancer 2026` |
| AACR | `AACR 2026 breast cancer` |
| 日本乳癌学会 | `日本乳癌学会 学術総会 2026` |
| Phase III readout | `[薬剤名] phase 3 readout 2026 expected` |

**出力**: 四半期ごとの学会イベント＋予想されるデータ発表を整理

---

### Agent 5: 🇯🇵 Japan Market Specialist（日本市場専門調査）

**担当**: 日本固有の承認・薬価・開発状況を深掘り

**⚠️⚠️⚠️ 最重要ルール: 全薬剤に対して日本語個別検索を必ず実行する ⚠️⚠️⚠️**

**「既承認薬だから検索不要」は絶対に禁止。** リボシクリブの日本開発断念、ツカチニブの最近の承認など、LLM知識では正しく反映できない事例が繰り返し発生している。

他のAgentが収集した**全薬剤リスト**に対して、**1薬剤ずつ**以下の日本語検索を実行すること。

```
必須検索パターン（全薬剤に対して実行。省略不可）:
1. "[日本語薬剤名] 承認" （例: 「イムルリオ 承認」「ツカイザ 承認」）
2. "[一般名] 日本 承認申請" （例: 「imlunestrant 日本 承認申請」）
3. "[日本開発企業名] [薬剤名] 乳癌" （例: 「日本イーライリリー イムルリオ 乳癌」）
```

**特に以下のケースは見落としリスクが高い（過去のエラー事例）**:
- ❌ CDK4/6i 3剤すべて日本承認済みと仮定 → **ribociclibは日本開発断念**
- ❌ FDAで数年前に承認された薬剤は日本でも承認済みと仮定 → **ツカチニブは日本で5年遅れの2026/2承認**
- ❌ IV製剤の承認のみ確認 → **皮下注製剤（Keytruda Qlex等）の承認状況も別途確認**

**日本の商品名が不明な場合の調べ方**:
- `[一般名/開発コード] 日本 乳癌 承認 2025 2026` で検索
- oncolo.jp、新薬情報オンライン（passmed.co.jp）、医薬通信社（iyakutsushinsha.com）、日経メディカル、日本がん対策図鑑（gantaisaku.net）が情報源として有用

**必須検索（全体）**:

| 対象 | 検索クエリ例 |
|------|-------------|
| 新薬承認 | `PMDA 乳癌 新薬 承認 2025 2026` / `厚生労働省 薬事審議会 抗がん剤` |
| **第二部会** | `薬事審議会 第二部会 承認了承 乳癌 2026` ← **部会→承認の流れを確認** |
| 申請中 | `第一三共 承認申請 2026` / `中外製薬 承認申請 2026` / `ファイザー 乳癌 2026` / `日本イーライリリー 乳癌 2026` |
| 薬価収載 | `薬価収載 抗がん剤 2026` |
| 日本参加試験 | `jRCT 乳癌 Phase III` |
| ドラッグ・ラグ | `ドラッグラグ 乳癌 2026` / `drug loss 日本 breast cancer` |
| KEGG承認一覧 | KEGG DRUG New Drug Approvals ページを **必ず** web_fetch で取得 |
| oncolo.jp | `site:oncolo.jp 乳癌 承認 2025 2026` で日本の最新承認を網羅的に確認 |
| 新薬情報オンライン | `site:passmed.co.jp 乳がん 承認 2025 2026` |
| **医薬通信社** | `site:iyakutsushinsha.com 乳がん 承認 2026` ← **最新承認ニュースに有用** |

**クロスチェック義務**:
- FDA/EMAで承認済の薬剤は、**日本法人が存在する場合、日本でも承認申請されている可能性が高い**。「未申請」とする前に必ず日本語で個別検索する。
- 逆に、**日本法人が存在しても開発断念している場合がある（例: ribociclib）**。「承認済み」とする前にも必ず確認。
- 国際共同試験に日本サイトが参加している薬剤は、日本申請が近い可能性がある。jRCTで確認する。

**各薬剤について**:
- 日本の開発企業（ライセンス先）を特定
- 日本での商品名を確認（承認済の場合）
- グローバル試験への日本サイト参加状況
- 承認時期の具体的予測（根拠付き）
- EBC / MBC / 両方の区別
- 対象サブタイプ・バイオマーカーの明記
- **日本での開発断念歴の有無** ← 🆕

---

## Phase 3: データ統合・品質チェック

### 統合データスキーマ（拡張版）

5エージェント+Agent 3bの調査結果を以下のスキーマに統合する:

```javascript
{
  id: Number,
  name: "表示名（日本語商品名があれば併記）",
  generic: "一般名",
  co: "開発企業",
  cls: "薬剤クラス",
  tgt: "標的分子",
  sub: ["対象サブタイプ配列"],  // "HR+/HER2-", "HER2+", "TNBC", "HER2-low"
  moa: "作用機序の簡潔な説明",
  pat: "特許/独占権満了情報（承認薬のみ）",
  ae: {
    freq: "高頻度AE（%付き）",
    severe: "重篤AE（G3/4、%付き）",
    note: "特徴的な臨床上のポイント"
  },
  lc: [{ s, e, c, tc, t }],  // ライフサイクルタイムライン（承認薬のみ）

  // 承認状況（各極にURLを紐付け）
  us: { s: "ok|rev|p3|p2|dev|no", t: "詳細テキスト", url: "FDA情報源URL" },
  eu: { s: "ok|rev|p3|p2|dev|no", t: "詳細テキスト", url: "EMA情報源URL" },
  jp: { s: "ok|rev|p3|p2|dev|no", t: "詳細テキスト", url: "PMDA情報源URL" },
  // 複数適応の場合:
  indications: [{ label, us:{s,t,url}, eu:{s,t,url}, jp:{s,t,url} }],

  // 主要な研究（前臨床〜Phase III全てを収録）
  // ※ 旧名: trials → studies に変更
  studies: [{
    n: "研究名/試験名",
    ph: "前臨床|I|I/II|II|III",   // 前臨床を含む全相
    pop: "対象（前臨床の場合はモデル系を記載。例: 'MCF-7 xenograft', 'PDX model'）",
    arm: "試験治療/介入",
    ctrl: "対照（前臨床の場合は 'vehicle' 等。単群試験の場合は '-'）",
    res: "結果（数値含む）",
    st: "pos|run|neg|na",          // na = 前臨床/Phase I（有効性評価なし）
    pr: "発表媒体（学会名 or 雑誌名 + 年）",
    url: "論文DOI/PubMed/学会抄録/ClinicalTrials.gov/プレスリリースのURL"
  }],
  next: "次のマイルストーン"
}
```

#### `studies` 配列の収録範囲

| 研究の相 | 収録基準 | url例 |
|---------|---------|-------|
| **前臨床** | 作用機序の根拠となる代表的論文（1-2本） | PubMed DOI |
| **Phase I** | 薬物動態/安全性の代表的論文。RP2D決定の根拠 | PubMed DOI / ASCO abstract |
| **Phase I/II** | 有効性シグナルを示した初期試験 | PubMed DOI / 学会抄録 |
| **Phase II** | Registrational Phase IIまたはPhase III移行根拠となった試験 | PubMed DOI / 学会抄録 |
| **Phase III** | 全件収録（結果発表済み＋進行中） | PubMed DOI / 学会抄録 / ClinicalTrials.gov |

**配列の並び順**: 前臨床 → Phase I → Phase I/II → Phase II → Phase III（開発の時系列順）。Phase III同士は発表年順。

### ステータスコード定義

| コード | 意味 | ダッシュボード表示 |
|--------|------|------------------|
| `ok` | 承認済 | 緑「承認済」 |
| `rev` | 承認申請中（審査中） | 青「申請中」 |
| `p3` | Phase III | 紫「Ph III」 |
| `p2` | Phase I-II | 橙「Ph I-II」 |
| `dev` | 開発中（日本参加試験あり等） | グレー「開発中」 |
| `no` | 未申請・未開発・開発断念 | 薄グレー「未申請」 |

### 引用文献URL添付ルール（MUST）

公開ダッシュボードとしての信頼性を担保するため、全データに出典URLを紐付ける。URLのない主張はダッシュボードに載せない。

#### 1. 承認状況の `url` フィールド（us/eu/jp 各極に必須）

| 極 | ステータス | 必須URL |
|----|-----------|---------|
| 🇺🇸 us | `ok`（承認済） | FDA label（accessdata.fda.gov）or FDA承認プレスリリース |
| 🇺🇸 us | `rev`（申請中） | 企業プレスリリース（NDA/BLA提出発表）or FDA PDUFA通知 |
| 🇺🇸 us | `p3`以下 | ClinicalTrials.gov（最も進んだ試験）or 企業パイプラインページ |
| 🇪🇺 eu | `ok` | EMA EPAR（europa.eu）or EC承認決定 |
| 🇪🇺 eu | `rev`以下 | EMA CHMP opinion or 企業プレスリリース |
| 🇯🇵 jp | `ok` | PMDA添付文書（kegg.jp電子添文 or pmda.go.jp） |
| 🇯🇵 jp | `rev` | 企業プレスリリース（承認申請発表）or 薬事審議会部会報告 |
| 🇯🇵 jp | `no` | 「未申請」の根拠（企業IR、日本語ニュース記事等） |

**複数適応（indications配列）の場合**: 各indicationのus/eu/jp.urlにも同様にURLを付与。

#### 2. 主要な研究の `url` フィールド（studies配列の各エントリに必須）

全研究エントリにURLを付与する。優先順位:

| 優先度 | URL種別 | 用途 |
|--------|---------|------|
| 1 | **PubMed DOI** （`doi.org/10.xxxx` or `pubmed.ncbi.nlm.nih.gov/PMID`） | 査読付き論文（最優先） |
| 2 | **学会公式抄録** （ASCO: meetinglibrary.asco.org、ESMO: oncologypro.esmo.org、SABCS: sabcs.org） | 論文化前の学会発表 |
| 3 | **企業プレスリリース** | トップライン結果速報 |
| 4 | **ClinicalTrials.gov** （`clinicaltrials.gov/study/NCTxxxxxxxx`） | 進行中試験、結果未発表 |
| 5 | **bioRxiv/medRxiv DOI** | 前臨床プレプリント（査読前） |

**Phase別のURL付与ガイド**:
- **前臨床**: PubMed DOI（作用機序論文）
- **Phase I**: PubMed DOI or ASCO/ESMO first-in-human abstract
- **Phase I/II〜II**: PubMed DOI or 学会抄録
- **Phase III（結果あり）**: PubMed DOI（最優先）、なければ学会抄録
- **Phase III（進行中）**: ClinicalTrials.gov NCT URL

#### 3. ダッシュボード上の表示

- **承認状況セクション**: 各極（🇺🇸🇪🇺🇯🇵）のステータステキストをURLへのリンクとして表示
- **主要な研究テーブル**: pr（発表媒体）カラムのテキストをURLリンクとして表示。urlがない場合はプレーンテキスト
- **フッター**: 「各データの出典リンクは薬剤カード内に記載。リンク切れを発見された場合はGitHub Issueでご報告ください。」の注記

#### 4. URL収集のタイミング

- **初回生成時**: Phase 2のエージェント調査で取得したURLをそのまま格納
- **週次更新時（Task 1）**: 新たに検索した情報のURLを追加
- **週次監査時（Task 3）**: 既存URLのリンク切れをチェック、より新しい出典（学会発表→論文化）があれば更新

### 品質チェック（統合後に必ず実行。全項目チェックを明示的に行う）

- [ ] **網羅性**: サブタイプ軸・薬剤クラス軸で漏れがないか
- [ ] **3極完備**: 全薬剤でus/eu/jpの3つが埋まっているか
- [ ] **数値精度**: HR, mPFS等の数値は検索結果と一致しているか
- [ ] **⚠️ 日本情報クロスチェック（最重要）**: **全薬剤のjp欄について**、Web検索結果に基づく根拠があるか確認する。「ok」「rev」の薬剤も含め、LLM知識のみで埋めた欄がないか。
  - jp: "ok" → 承認日と商品名の検索結果URLを内部で確認
  - jp: "rev" → 申請日の検索結果URLを内部で確認
  - jp: "no" → 本当に未申請か、開発断念か、日本語で最低1回検索して確認
- [ ] **日本商品名**: 日本で承認済の薬剤には日本語商品名を必ず併記（例: イムルリオ、エンハーツ、ツカイザ）
- [ ] **🆕 開発断念チェック**: 海外で承認済みかつ日本未承認の薬剤について、「未申請」なのか「開発断念」なのかを区別。ribociclibのように日本法人が存在するのに開発断念したケースを見逃さない。
- [ ] **研究データ**: studies配列が空の薬剤がないか。arm/ctrlフィールドが埋まっているか。前臨床・Phase I研究が含まれているか。
- [ ] **🆕 新剤型チェック**: 既承認薬の皮下注/配合剤/BSが漏れていないか
- [ ] **🆕 有害事象**: 承認薬のae欄が埋まっているか
- [ ] **🆕 特許情報**: 承認薬のpat欄が埋まっているか
- [ ] **🆕 ライフサイクル**: 主要承認薬のlc配列が作成されているか
- [ ] **重複チェック**: 同一薬剤が別名で重複登録されていないか
- [ ] **⚠️ 引用URL完備チェック（MUST）**: ① 全薬剤のus/eu/jp.urlが埋まっているか（indications配列も含む） ② studies配列の全エントリにurlが付与されているか（進行中試験はClinicalTrials.gov NCT URLでも可） ③ 前臨床・Phase I研究にもPubMed DOI等のURLがあるか
- [ ] **⚠️ 収録基準チェック**: DRUGS配列の全薬剤がA/B/C/Dのいずれかの区分に該当するか確認。後発品上市済みの薬剤が混入していないか。
- [ ] **⚠️ タイムライン突き合わせ（MUST）**: TIMELINE配列の全trial値がDRUGS配列のstudies内のn値に存在するか。差分0件であることを確認。
- [ ] **⚠️ タイムライン収録基準チェック**: TIMELINE配列にreadoutが2年以上前の完了済み試験が混入していないか。

---

## Phase 4: ダッシュボード生成

### ダッシュボードの構成（3タブ）

```
┌─────────────────────────────────────────────┐
│ ヘッダー（タイトル + 更新日 + 薬剤数）      │
├─────────────────────────────────────────────┤
│ [タブ1] [タブ2] [タブ3]                      │
├─────────────────────────────────────────────┤
│                                             │
│ ■ タブ1: 乳癌の標準治療（日本）【デフォルト】│
│  JBCS GL 2022 + WEB改訂 + 新薬承認反映     │
│  サブタイプ × EBC/MBC別                     │
│   ┌──────────────────────────────────┐      │
│   │ HR+/HER2-: EBC / MBC             │      │
│   │ HER2+:     EBC / MBC             │      │
│   │ TNBC:      EBC / MBC             │      │
│   └──────────────────────────────────┘      │
│  各レジメン・注意事項・保険適用外情報       │
│  → 後発品未発売の薬剤は「パイプライン」へ   │
│                                             │
│ ■ タブ2: 治療開発パイプライン               │
│  冒頭: 収録基準（A/B/C/D + 除外対象）      │
│  フィルター（サブタイプ・テキスト検索）     │
│  薬剤カード一覧                             │
│   ┌─ 閉じた状態 ──────────────────────┐    │
│   │ 薬剤名 | 企業 | クラス |          │    │
│   │ サブタイプ | 🇺🇸🇪🇺🇯🇵チップ           │    │
│   └─────────────────────────────────┘      │
│   ┌─ 展開した状態 ────────────────────┐    │
│   │ [作用機序]                        │    │
│   │ [特許/独占権情報]                 │    │
│   │ [ライフサイクルバー]              │    │
│   │ [有害事象パネル]                  │    │
│   │ [承認状況セクション] 🇺🇸🇪🇺🇯🇵詳細   │    │
│   │ [臨床試験テーブル（arm/ctrl含む）] │    │
│   │ [次のマイルストーン]              │    │
│   └─────────────────────────────────┘      │
│                                             │
│ ■ タブ3: 臨床試験タイムライン（ガントチャート）│
│  収録基準: 進行中＋直近2年に結果発表の試験  │
│  フィルター（サブタイプ・ステータス）       │
│  ガントバー: FPI→LPI→readout 色分け        │
│  現在時点を赤線で表示                       │
│  ※ readout < 2年前の完了済み試験は省略     │
│                                             │
├─────────────────────────────────────────────┤
│ フッター（出典・免責・特許免責）            │
└─────────────────────────────────────────────┘
```

### 日本承認見通しセクションの必須記載項目

各薬剤について以下を**必ず**含める:
1. **薬剤名**（日本語商品名があれば併記）
2. **対象集団チップ**: `サブタイプ + EBC/MBC` を明記（例: `HR+/HER2- ESR1m MBC`、`HR+/HER2- EBC（術後補助）/ MBC`）
3. **現在の開発状態**（承認済✅/申請済/準備中/試験参加中/開発断念/不明）
4. **承認時期予測**（根拠付き）
5. **色コード**（緑=承認済or近い / 橙=やや先 / グレー=懸念 / 赤=開発断念）

### 生成ルール

#### 全般
1. React (.jsx) で生成。**単一ファイル・データ埋め込み型**。GitHub Pagesデプロイ時に `src/App.jsx` としてそのまま使用可能な構成とする。
2. `/mnt/user-data/outputs/` に出力し `present_files` で提示。
3. ファイル名: `nyuugan_shinsho_{YYYY}_{MM}.jsx`（例: `nyuugan_shinsho_2026_03.jsx`）
4. 4タブ構成: 「乳癌の標準治療（日本）」「治療開発パイプライン」「臨床試験タイムライン」「開発初期ランドスケープ」
5. デフォルト表示タブ: 「乳癌の標準治療（日本）」
6. 外部依存は最小限（Tailwind CDN、lucide-react等のみ）。npm installなしでも動作するようCDNフォールバックを考慮。

#### タブ1: 乳癌の標準治療（日本）
6. データは `const SOC_DATA = [...]` としてファイル冒頭に埋め込む。
7. JBCS GL 2022 + WEB改訂 + 最新の新薬承認を反映。
8. サブタイプ（HR+/HER2-、HER2+、TNBC）× EBC/MBC別に整理。
9. 各ラインのレジメン・注意事項・保険適用外情報を含む。
10. 説明文に「後発品未発売の薬剤は『治療開発パイプライン』タブに詳細カードあり」と明記。

#### タブ2: 治療開発パイプライン（薬剤カード）
11. データは `const DRUGS = [...]` としてファイル冒頭に埋め込む。
12. **冒頭に収録基準（A/B/C/D + 除外対象）を表示する。**
13. フィルター機能（サブタイプ、テキスト検索）を必ず含める。
14. ソート: 承認段階が進んでいる順（ok → rev → p3 → p2 → dev → no）
15. ライフサイクルバー: 承認薬に対して、前臨床〜GE/BS時代までの色分けバーを表示。現在時点を赤線で表示。
16. 有害事象パネル: 高頻度AE・重篤AE・注意点を赤系ボックスで表示。
17. 主要な研究テーブル: 前臨床→Phase I→Phase II→Phase IIIの時系列順。arm（試験治療）とctrl（対照治療）のカラムを含める。pr（発表媒体）はurl付きリンクとして表示。
18. 特許情報: オレンジ系ボックスで特許満了情報を表示。
19. フッターに「特許情報は概算であり訴訟等により変動する可能性があります」の免責を追加。

#### タブ3: 臨床試験タイムライン（ガントチャート）
20. データは `const TIMELINE = [...]` としてファイル冒頭に埋め込む。
21. **収録基準: 進行中の試験＋直近2年以内に結果発表された試験**。readoutが2年以上前の完了済み試験は省略。
22. フィルター: サブタイプ別、ステータス別（進行中/Positive/Negative）。
23. ガントバー: FPI→LPI→readoutを色分け表示、現在時点を赤線で表示。
24. 説明文に「{N}試験を収録（進行中＋直近2年に結果発表の試験）。readoutが2年以上前の完了済み試験は省略。」と明記。

#### ⚠️ 試験名統一ルール（MUST）
25. **DRUGS配列のstudies内のPhase II/III試験名と、TIMELINE配列のtrial名は完全に一致させる。**（前臨床・Phase Iはタイムラインに載せないため突き合わせ対象外）
26. 表記揺れを防ぐため、略称ルールを統一する:
    - DESTINY-Breast → `DB-` （例: DB-03, DB-06, DB-09）
    - TROPION-Breast → `TB-` （例: TB-01, TB-02, TB-04）
    - OptiTROP-Breast → `OptiTROP-Breast` （正式名。略さない）
    - その他: 試験の正式略称を使用（SERENA-4, EMBER-3, HER2CLIMB等）
27. **生成後にDRUGS.studies内のPhase II/III全n値とTIMELINEの全trial値を突き合わせ**、タイムラインにあって薬剤カードにない試験が0件であることを確認する。差分がある場合は修正してから提示する。

#### タブ4: 開発初期ランドスケープ

##### 収録基準（パイプラインタブとの境界定義）

| 収録する | 収録しない |
|---------|-----------|
| 前臨床（IND申請済みかつ乳癌適応を明示） | 前臨床（IND未申請 or 乳癌適応が不明） |
| FIH（First-in-Human）完了済み | パイプラインタブ基準A-Dに該当する薬剤 |
| Phase I 進行中 or 完了 | 他癌腫のみでPhase I実施中（乳癌コホートなし） |
| Phase Ib/II expansion中 | — |
| Phase II（基準D未達：Phase III未登録 かつ BTDなし かつ 企業がPhase III開始未発表 かつ Pre-NDA未公表） | Phase II（基準Dを1つ以上満たす）→ パイプラインタブへ |

**昇格ルール**: ランドスケープの薬剤が基準Dを1つ以上満たした時点で、パイプラインタブに移動する。移動時にstudies配列・承認URL等をパイプライン水準まで充実させる。

##### データスキーマ（`const LANDSCAPE = [...]`）

```javascript
{
  id: "開発コード（例: ARX788）",
  name: "薬剤名/開発コード",
  co: "開発企業",
  moa_cat: "作用機序カテゴリ",  // グループ化キー（下記カテゴリ一覧参照）
  tgt: "標的分子",
  sub: ["HR+/HER2-","HER2+","TNBC"],  // 対象サブタイプ
  stage: "IND|FIH|PhI|PhIb/II|PhII",  // 最も進んだ段階
  nct: "NCT番号",                       // ClinicalTrials.gov ID
  nct_url: "https://clinicaltrials.gov/study/NCTxxxxxxxx",
  status: "recruiting|active|completed|terminated",
  fih_date: "YYYY-MM or null",          // FIH開始日（わかる場合）
  n_enrolled: Number or null,           // 登録症例数（わかる場合）
  early_result: "ORR 35%, DLT 0/6 at RP2D 等（あれば）",
  source_url: "出典URL（論文/学会/プレスリリース）",
  source_label: "出典ラベル（例: ASCO 2025 poster, AACR 2026 abstract）",
  note: "備考（日本参加試験あり、等）",
  updated: "YYYY-MM-DD"  // 最終確認日
}
```

##### 作用機序カテゴリ一覧（`moa_cat` のマスター値）

| カテゴリ | 説明 | 例 |
|---------|------|-----|
| `ADC` | 抗体薬物複合体（次世代ペイロード・リンカー含む） | ARX788, RC48, MRG002 |
| `ADC_novel_target` | 新規標的ADC（TROP2/HER2以外） | Nectin-4 ADC, B7-H3 ADC, FRα ADC |
| `bispecific` | 二重特異性抗体 | zanidatamab, KN026 |
| `PROTAC_degrader` | タンパク分解薬（PROTAC, molecular glue） | ARV-471以外のER degrader |
| `oral_SERD_next` | 次世代経口SERD（パイプライン未収録） | rintodestrant, D-0502 |
| `CDK_next` | 次世代CDK阻害薬（CDK2, CDK7, CDK4選択的等） | CDK2i, CDK7i |
| `epigenetic` | エピジェネティクス（KAT6以外のHDAC, BET, EZH2等） | tazemetostat, BETi |
| `IO_next` | 次世代IO（LAG-3, TIGIT, STING, mRNA vaccine等） | relatilmab combo, mRNA-4157 |
| `cell_therapy` | 細胞治療（CAR-T, TIL, NK） | HER2 CAR-T |
| `RDC` | 放射性医薬品（RI標識抗体） | HER2 RDC |
| `small_mol_other` | その他低分子（SHP2, KRAS, MEK, ERK等） | SHP2i, ERK1/2i |
| `Ab_other` | その他抗体治療 | anti-Nectin-4, anti-CLDN18.2 |
| `combination_novel` | 新規併用戦略（既存薬の新しい組み合わせ） | IO+ADC early combo |

**カテゴリの追加・統合**: 薬剤数が3未満のカテゴリは`small_mol_other`等に統合。逆に10以上のカテゴリはサブカテゴリに分割を検討。

##### UI仕様

28. データは `const LANDSCAPE = [...]` としてファイル冒頭に埋め込む。
29. **作用機序カテゴリごとのアコーディオン**で表示。パイプラインタブの薬剤カードと統一感のあるデザイン。
30. 各アコーディオンヘッダー: カテゴリ名 + 薬剤数バッジ + 代表的な標的分子
31. 展開時: テーブル形式で薬剤一覧を表示。カラム:

| カラム | 内容 |
|--------|------|
| 薬剤名 | 開発コード + 企業名 |
| 標的 | 標的分子 |
| 段階 | IND/FIH/PhI/PhIb-II/PhII を色分けチップで表示 |
| サブタイプ | HR+/HER2+/TNBC チップ |
| 登録数 | N enrolled（あれば） |
| 初期結果 | ORR等（あれば。なければ「—」） |
| 出典 | source_urlへのリンク |

32. **フィルター**: サブタイプ別、段階別（IND〜PhII）、テキスト検索。
33. **冒頭に収録基準を表示**: 「治療開発パイプラインの収録基準（A-D）を満たさない早期開発品を収録。基準Dを満たした時点でパイプラインタブに昇格。」
34. 段階の色分け:
    - `IND` — グレー
    - `FIH` — 薄紫
    - `PhI` — 薄青
    - `PhIb/II` — 薄オレンジ
    - `PhII` — オレンジ
35. 説明文に「{N}薬剤を{M}カテゴリに分類。ClinicalTrials.gov + 学会発表 + 企業パイプラインから収集（最終更新: {date}）」と明記。

##### リストアップ方法（3ソース組み合わせ）

**ソース1: ClinicalTrials.gov API**（主力。網羅的な自動収集）

```
検索条件:
- condition: "breast cancer" OR "breast neoplasm"
- phase: Phase 1, Phase 2
- status: RECRUITING, ACTIVE_NOT_RECRUITING, ENROLLING_BY_INVITATION
- intervention type: DRUG, BIOLOGICAL
- first posted: 直近3年以内（古すぎる試験を除外）
```

結果から以下を除外:
- 既にDRUGS配列（パイプライン）に含まれる薬剤
- 化学療法レジメンのみの試験
- 支持療法・QOL試験
- バイオシミラー試験

**ソース2: レビュー論文＋学会発表**
- ASCO/ESMO/SABCS/AACR直近2年のearly drug development oral/poster
- Nature Reviews Drug Discovery, Lancet Oncology等の乳癌パイプラインレビュー
- 「breast cancer novel agents pipeline review {current_year}」で検索

**ソース3: Web検索（企業パイプライン）**
- 主要バイオファーマのパイプラインページ（Daiichi Sankyo, AZ, Roche, Merck, Pfizer, BMS, Gilead, Seagen等）
- 中国バイオテック（Kelun-Biotech, Hengrui, BeiGene, CSPC, Zymeworks等）のIR/パイプライン
- 「breast cancer Phase 1 IND {current_year}」「乳癌 新規薬剤 Phase I {current_year}」で検索

---

### Claude Code自動実行スクリプト仕様

本タブのデータ収集はClaude Codeのタスクとしてスクリプト化し、自動実行可能にする。

#### スクリプト構成

```
scripts/
├── landscape_collector.py       ← メイン収集スクリプト
├── ctgov_api.py                 ← ClinicalTrials.gov APIラッパー
├── landscape_dedup.py           ← DRUGS配列との重複排除
├── landscape_to_json.py         ← 収集結果をLANDSCAPE JSON形式に変換
└── landscape_inject.py          ← JSONをJSXのconst LANDSCAPEに注入
```

#### `landscape_collector.py` のワークフロー

```
Step 1: ClinicalTrials.gov APIで候補取得
  └→ breast cancer + Phase 1/2 + recruiting/active + 直近3年
  └→ 各試験からNCT, 薬剤名, 企業, phase, status, enrollment, start_dateを抽出

Step 2: DRUGS配列との重複排除
  └→ 現在のJSXからDRUGS[].generic, DRUGS[].nameを抽出
  └→ ClinicalTrials.gov結果から既知薬剤を除外

Step 3: 作用機序カテゴリ分類
  └→ intervention description + brief titleからmoa_catを推定
  └→ Claude API呼び出しで分類精度を向上（任意）

Step 4: 初期結果・出典URLの補完（Web検索）
  └→ 各候補薬剤について「{drug_name} breast cancer Phase 1 results」で検索
  └→ PubMed/ASCO/ESMO abstractのURLを取得
  └→ early_result（ORR等）を抽出

Step 5: JSON出力
  └→ LANDSCAPE配列形式のJSONを生成
  └→ updatedフィールドに実行日を記録

Step 6: JSX注入
  └→ 既存JSXのconst LANDSCAPE = [...]を新データで置換
```

#### Claude Code実行プロンプト例

```
乳がん新書2026 ランドスケープデータを収集・更新してください
```

または手動でスクリプト実行:
```bash
cd /path/to/nyuugan-shinsho
python scripts/landscape_collector.py --jsx src/App.jsx --output data/landscape.json
python scripts/landscape_inject.py --jsx src/App.jsx --data data/landscape.json
```

#### 週次メンテナンスとの統合

- **Task 1（情報収集）** に「1e. ランドスケープ更新」を追加
  - `landscape_collector.py` を実行
  - 新規薬剤の追加、terminated試験の除外
  - 基準Dを満たした薬剤のパイプラインへの昇格チェック
- **Task 2（連携チェック）** に「2c. パイプライン⇔ランドスケープ連携」を追加
  - DRUGS配列とLANDSCAPE配列の重複がないか確認
  - ランドスケープの薬剤で基準D該当のものがないか確認
- **Task 3（誤情報チェック）** のローテーションに第5週を追加

| 週 | 監査対象 |
|----|---------|
| 第1週 | HR+/HER2- |
| 第2週 | HER2+ |
| 第3週 | TNBC |
| 第4週 | サブタイプ横断 + タイムライン + URL |
| **第5週** | **開発初期ランドスケープ全体**（terminated試験の除外、stage更新、新規追加）|

---

## Phase 5: ユーザーレビュー・反復改善

生成したダッシュボードをユーザーに提示し、以下の観点でフィードバックを求める:

1. **標準治療タブの正確性** — ガイドラインとの整合、最新承認薬の反映漏れ
2. **漏れている薬剤**がないか — 収録基準A/B/C/Dに該当するのに未収録の薬剤
3. **承認状況の正確性**（特に日本）← **最優先確認事項**
4. **臨床試験データの正確性**（数値の確認、併用薬/対照群の確認）
5. **有害事象プロファイルの正確性**
6. **特許情報の正確性**
7. **タイムラインの整合性** — 薬剤カードとの試験名一致、収録基準（進行中＋直近2年）の遵守
8. **タブ間の接続ロジック** — 標準治療の先発品がパイプラインに入っているか、パイプラインの試験がタイムラインに反映されているか
9. **ランドスケープの網羅性** — 注目すべき早期開発品が漏れていないか、作用機序カテゴリの分類は妥当か、基準D該当で昇格すべき薬剤がないか
10. **表示の見やすさ**
11. **追加したい情報**

フィードバックに基づいてデータ修正→再生成を行う。

---

## 運用ガイド: 週次メンテナンス＋GitHub Pages公開

### プロジェクト名と年次更新

- **プロジェクト名**: 乳がん新書
- **ホームページ名**: 乳がん新書{YYYY}（例: 乳がん新書2026、乳がん新書2027）
- **年次更新**: 毎年1月に年号を更新。前年のデータはアーカイブとして保持。
  - `乳がん新書2026` → 2026年中の全データ・更新ログを含む
  - `乳がん新書2027` → 2027年1月にフォーク・リセット。前年データを引き継ぎつつ新年の基盤とする
  - 過去年のページは `/{YYYY}/` サブパスでアーカイブ閲覧可能にする

### 公開アーキテクチャ

本ダッシュボードはGitHub Pagesで「乳がん新書{YYYY}」として一般公開する。

#### デプロイ方式: JSXそのままReactアプリとしてデプロイ（推奨）

現在のJSXファイル（`nyuugan_shinsho_2026_03.jsx`）は**データ＋UI一体型の単一ファイル**であり、そのままReactアプリとしてGitHub Pagesにデプロイする。これが最速パス。

```
リポジトリ構成:
nyuugan-shinsho/
├── index.html              ← GitHub Pages エントリーポイント
├── src/
│   └── App.jsx             ← 本スキルの出力JSXをそのまま配置
├── package.json            ← React + Vite (or CRA) の最小構成
├── vite.config.js          ← GitHub Pages用のbase設定
├── logs/
│   ├── YYYY-MM-DD_update.md    ← 週次更新ログ
│   └── YYYY-MM-DD_audit.md     ← 週次誤情報チェックログ
├── archive/                ← 過去年のスナップショット
│   └── 2026/
├── CHANGELOG.md            ← ユーザー向け更新履歴
└── README.md
```

**デプロイ手順（初回）**:
1. `npm create vite@latest nyuugan-shinsho -- --template react` でプロジェクト作成
2. 本スキルの出力JSX（`nyuugan_shinsho_YYYY_MM.jsx`）を `src/App.jsx` にコピー
3. `vite.config.js` に `base: '/nyuugan-shinsho/'` を設定
4. `npm run build` → `dist/` フォルダをGitHub Pagesにデプロイ（`gh-pages`ブランチ or GitHub Actions）

**週次更新時の手順**:
1. Claudeで週次メンテナンス（Task 1/2/3）を実行し、更新済みJSXを取得
2. `src/App.jsx` を新しいJSXで上書き
3. `git diff` で変更内容を確認
4. コミット＋プッシュ → GitHub Actions or `npm run deploy` で自動デプロイ
5. 更新ログを `logs/` に追加

**Claudeとの連携**: 別スレッドで「乳がん新書2026のJSXを更新してください」と依頼する際、**現在のJSXファイルをアップロード**するだけでClaudeが既存データを読み取り、差分更新を実行できる。スキルファイルのPhase 2-5がそのまま適用される。

#### 将来の進化パス: データJSON分離

サイトの規模が大きくなり、複数人での編集やCI/CDパイプラインでのバリデーションが必要になった場合、データをJSONに分離する:

```
data/
├── soc.json            ← SOC_DATAを外部化
├── drugs.json          ← DRUGSを外部化（sources含む）
├── timeline.json       ← TIMELINEを外部化
└── meta.json           ← バージョン・更新日
```

この移行は、現JSXの `const SOC_DATA`, `const DRUGS`, `const TIMELINE` をそのままJSON.stringify→ファイル化し、React側で `fetch()` で読み込むだけ。データ構造の変更は不要。

`meta.json` の構造:
```json
{
  "projectName": "乳がん新書",
  "edition": "乳がん新書2026",
  "year": 2026,
  "version": "1.0.0",
  "lastUpdated": "2026-03-22",
  "author": "BC TUBE / 伏見淳",
  "description": "乳癌の標準治療・治療開発パイプライン・臨床試験タイムラインを網羅するインタラクティブダッシュボード"
}
```

### 週次メンテナンスサイクル

**頻度**: 週1回（推奨: 日曜日）
**所要時間目安**: Task 1（30-45分）、Task 2（10分）、Task 3（45-60分）

#### ⏱ Task 1: 新たな情報の収集（週次更新）

プロンプト例:
```
乳がん新書2026 週次更新 Task 1 を実行してください
```

**手順**:

##### 1a. ガイドライン更新チェック
- 日本乳癌学会GL WEB改訂の有無を検索（`乳癌診療ガイドライン 改訂 {current_year}`）
- NCCN Guidelines更新の有無を検索（`NCCN breast cancer guidelines update {current_year}`）
- 更新があった場合: SOC_DATA（標準治療タブ）を修正

##### 1b. 新薬承認・適応拡大チェック
以下を**全件検索**:
- `乳癌 承認 PMDA {current_month}` — 日本の新規承認
- `breast cancer FDA approval {current_month}` — FDA新規承認
- `breast cancer EMA approval {current_month}` — EMA新規承認
- 既存の`rev`（申請中）ステータスの薬剤を全件再検索 — 承認に変わっている可能性
- 新たにPhase III結果が発表され収録基準B/Cに該当する新薬がないか

##### 1c. 個別薬剤・臨床試験の情報更新
DRUGS配列の全薬剤について以下を確認:
- 新たな臨床試験結果の発表（学会/論文）→ studies配列を更新
- PDUFA日・ODAC日の変更
- 新たな適応での承認申請
- 重要な安全性情報（FDA boxed warning追加、PMDA添付文書改訂等）
- 特許訴訟の進展

TIMELINE配列について:
- 進行中試験のステータス変更（enrollment完了、readout時期変更）
- 新たにPhase III開始された試験の追加
- readoutが2年以上前になった試験の削除

##### 1d. データ更新の実行
- 変更が必要な箇所をリストアップし、ユーザーに報告
- 承認後 → ユーザー確認を得て更新を実行
- **更新した全データに出典URLを付与**（us/eu/jp.url、studies.url）
- 更新ログ（`logs/YYYY-MM-DD_update.md`）を生成

**更新ログのフォーマット**:
```markdown
# 週次更新ログ YYYY-MM-DD

## 検索実行
- ガイドライン更新: ☑ 確認済 / 変更なし
- 新薬承認: ☑ 確認済 / {件数}件の変更
- 個別薬剤更新: ☑ 確認済 / {件数}件の変更

## 変更内容
| # | 対象 | タブ | 変更種別 | 変更前 | 変更後 | 出典URL |
|---|------|------|---------|--------|--------|---------|
| 1 | T-DXd DB-05 | パイプライン | ステータス更新 | PDUFA 2026 Q3 | FDA承認済 YYYY/M/D | https://... |

## 変更なし確認
- rev（申請中）ステータスの全件再検索: 変更なし
```

---

#### 🔗 Task 2: タブ間連携チェック

プロンプト例:
```
乳がん新書2026 週次更新 Task 2 を実行してください
```

**手順**:

##### 2a. 標準治療 ⇔ パイプライン連携
- SOC_DATA内のレジメンで使用される全薬剤を抽出
- そのうち後発品/BS未発売のものがDRUGS配列に存在するか確認
- **不一致リスト**: 標準治療にあるがパイプラインにない薬剤 → 追加が必要
- **逆方向チェック**: パイプラインに「区分A」で入っている薬剤が標準治療のどのレジメンに対応するか確認

##### 2b. パイプライン ⇔ タイムライン連携
- DRUGS配列のstudies内のPhase II/III試験名を抽出
- TIMELINE配列の全trial値を抽出
- **差分チェック**: TIMELINE → DRUGSの方向で差分0件であることを確認
- readout基準チェック: TIMELINEにreadoutが2年以上前の試験がないか

##### 出力
連携チェック結果をユーザーに報告。不一致がある場合は修正案を提示。

---

#### 🔍 Task 3: 誤情報チェック（ゼロベース監査）

プロンプト例:
```
乳がん新書2026 週次更新 Task 3 を実行してください
```

**目的**: 既存データに含まれる誤情報を**ゼロベースで**発見・修正する。Task 1が「新しい情報の追加」であるのに対し、Task 3は「既存情報の正しさの検証」。

**手順**:

##### 3a. 全面監査（ローテーション方式）

全薬剤を1回で監査するのは非現実的なため、**サブタイプ×週のローテーション**で実行:

| 週 | 監査対象 |
|----|---------|
| 第1週 | HR+/HER2- の全薬剤 + 標準治療タブ HR+/HER2- |
| 第2週 | HER2+ の全薬剤 + 標準治療タブ HER2+ |
| 第3週 | TNBC の全薬剤 + 標準治療タブ TNBC |
| 第4週 | サブタイプ横断（pumitamig等）+ タイムライン全体 + 引用URLリンク切れ |

各薬剤について以下を**Web検索で再確認**:
1. **承認ステータス**: 3極（特にjp）の承認日・申請ステータスが正しいか
2. **臨床試験データ**: mPFS/mOS/HR等の数値が正しいか。arm/ctrlの記載が正しいか
3. **有害事象プロファイル**: 頻度の数値が正しいか。重篤AEの記載に漏れがないか
4. **特許情報**: 満了年が正しいか。新たな訴訟・PTE申請がないか
5. **ライフサイクル**: 新たにGE/BS申請がないか
6. **引用URL**: リンク切れがないか。より新しい出典がないか

##### 3b. 誤情報のリストアップ

発見した誤りを以下のフォーマットで報告:

```markdown
# 誤情報監査ログ YYYY-MM-DD

## 監査対象: {サブタイプ}（第{N}週ローテーション）

| # | 薬剤/試験 | 項目 | 現在の記載 | 正しい情報 | 出典URL | 重要度 |
|---|----------|------|-----------|-----------|---------|--------|
| 1 | T-DXd | DB-09 mPFS | 40.7m | 42.0m (updated) | https://... | 中 |

## 重要度の定義
- **高**: 承認ステータスの誤り、数値の大幅な誤り、存在しない薬剤の記載
- **中**: 数値の軽微な誤り（例: mPFS 1ヶ月未満の差）、出典URLのリンク切れ
- **低**: 表記揺れ、表現の改善
```

##### 3c. 修正案の提示と実行

- 誤情報リストの各項目について、修正案（修正前→修正後）を提示
- ユーザー承認後に修正を実行
- 監査ログ（`logs/YYYY-MM-DD_audit.md`）を生成

---

### 週次メンテナンスの一括実行

3タスクを一括で実行するプロンプト:
```
乳がん新書2026 週次メンテナンスを全タスク実行してください
```

実行順序: Task 1 → Task 2 → Task 3
- Task 1で更新したデータを基にTask 2の連携チェックを実行
- Task 2で整合性を確認した後にTask 3の誤情報チェックを実行
- 最終的な変更点を一括でユーザーに報告し、承認後に反映

### バージョン管理ルール

- **更新日**: `meta.json`の`lastUpdated`フィールドと、ダッシュボードヘッダーの更新日を同時に更新
- **バージョン番号**: セマンティックバージョニング（MAJOR.MINOR.PATCH）
  - MAJOR: タブ構成の変更、収録基準の変更
  - MINOR: 薬剤の追加/削除、承認ステータスの変更
  - PATCH: 数値修正、URL更新、表記修正
- **CHANGELOG.md**: ユーザー向けに主要な変更を日本語で記載
- **Gitコミットメッセージ**: `update(YYYY-MM-DD): Task1+2+3 summary` の形式

### 年次更新プロセス（毎年1月実行）

1. **アーカイブ作成**: 現在年のdata/ディレクトリをarchive/{YYYY}/にコピー
2. **meta.json更新**: `year`を新年に、`edition`を「乳がん新書{新年}」に、`version`を`{新MAJOR}.0.0`にリセット
3. **ダッシュボードヘッダー更新**: 「乳がん新書{新年}」に変更
4. **全面監査の実行**: Task 3を全サブタイプで一括実行（年始の棚卸し）
5. **ガイドライン反映**: 年末〜年始に発表された国内外ガイドライン改訂を反映
6. **タイムライン整理**: readoutが2年以上前になった試験を削除
7. **README.md更新**: 年号を新年に、アーカイブリンクを追加

---

## トリガーキーワード

以下のいずれかが出たら必ずこのスキルを使う:

**ダッシュボード生成**:
- 乳がん新書、nyuugan shinsho
- パイプライン、pipeline、新薬開発状況、開発品、新薬一覧
- 承認状況、ダッシュボード、dashboard
- 乳癌 新薬、breast cancer pipeline
- 日本で使えるようになる薬、承認見通し、ドラッグラグ、drug lag
- 新薬まとめ、開発中の薬、薬の開発どうなってる
- 特許クリフ、パテントクリフ、patent cliff、ジェネリック参入
- 有害事象比較、副作用プロファイル

**週次メンテナンス**:
- 週次更新、weekly update、週次メンテナンス
- Task 1、Task 2、Task 3、情報収集、連携チェック、誤情報チェック
- パイプライン更新、ダッシュボード更新、乳がん新書更新
- 全タスク実行、一括メンテナンス

**GitHub Pages公開・年次更新**:
- GitHub、GitHub Pages、ホームページ、公開
- リポジトリ構成、デプロイ
- 年次更新、アーカイブ、乳がん新書{YYYY}

**開発初期ランドスケープ**:
- ランドスケープ、landscape、早期開発、early development
- Phase I、FIH、first-in-human、IND
- 次世代薬剤、novel agents、新規標的
- ランドスケープ更新、ランドスケープ収集

---

## 別スレッドへの引き継ぎ手順

本スキルで生成したJSXを別のClaudeスレッドで活用する際の手順:

### GitHub Pages構築の場合

**別スレッドへの持ち込みアイテム**:
1. **JSXファイル**（`nyuugan_shinsho_YYYY_MM.jsx`）— アップロードするだけでClaudeが全データを読み取れる
2. **このスキルファイル**（`SKILL.md`）— Claudeが構成・運用ルールを理解するために参照（Claudeのスキルとして自動読み込みされる）

**別スレッドでの最初のプロンプト例**:
```
乳がん新書2026のGitHub Pagesを構築したいです。
添付のJSXファイルをそのままReactアプリとしてデプロイする方針です。
Vite + GitHub Pagesの構成でセットアップをお願いします。
```

**Claudeが自動で理解する内容**（スキルファイル経由）:
- 3タブ構成と各タブの役割
- 収録基準（A/B/C/D）
- 試験名統一ルール
- 週次メンテナンスの3タスク構成
- バージョン管理ルール
- 引用文献URL添付ルール

### 週次メンテナンスの場合

**別スレッドでの最初のプロンプト例**:
```
乳がん新書2026 週次メンテナンスを全タスク実行してください
（JSXファイル添付）
```

Claudeは添付されたJSXから現在のデータを読み取り、Task 1→2→3を順に実行し、更新済みJSXと更新ログを出力する。
