# Claude Code 指示書：「日本の標準治療」タブに治療アルゴリズムを実装する

## 概要

shinsho.bctube.org（乳がん新書2026）の「日本の標準治療」タブに、サブタイプ別の治療アルゴリズム（インタラクティブフローチャート）を実装してください。

## 技術スタック（既存）

- Vite + React（単一ファイルSPA）
- UI: React JSX（`src/App.jsx`）
- データ: JSON分離済み（`src/data/*.json`）
- スタイリング: インラインCSS（既存サイトと同じ方式）
- 外部ライブラリ: React / ReactDOM のみ

## 作業内容

### 1. データファイル作成: `src/data/treatment-algorithm.json`

以下の構造でJSONファイルを作成してください。サイト既存のデータ分離パターンに従います。

```
{
  "subtypes": [
    { "id": "hr_her2neg", "label": "HR+/HER2−", "shortLabel": "HR+", "pct": "約70%" },
    { "id": "her2pos", "label": "HER2+", "shortLabel": "HER2+", "pct": "約15-20%" },
    { "id": "tnbc", "label": "トリプルネガティブ", "shortLabel": "TNBC", "pct": "約10-15%" },
    { "id": "her2low", "label": "HER2低発現", "shortLabel": "HER2-low", "pct": "約50-60%*" }
  ],
  "settings": [
    { "id": "periop", "label": "周術期（初期治療）" },
    { "id": "metastatic", "label": "転移・再発" }
  ],
  "treatments": { ... }  // 下記の治療データ
}
```

**治療データの全内容**（4サブタイプ × 2設定 = 8パターン）:

#### HR+/HER2− 周術期

```json
{
  "title": "HR+/HER2− 周術期治療",
  "desc": "ホルモン受容体陽性・HER2陰性乳癌は全体の約70%を占める最多サブタイプ。内分泌療法が治療の柱。",
  "flow": [
    {
      "phase": "術前",
      "steps": [
        { "name": "手術先行が基本", "detail": "多くの場合、手術を先行。腫瘍縮小目的で術前化学療法を行う場合もある", "standard": true },
        { "name": "術前化学療法", "detail": "AC/EC → タキサン（腫瘍縮小・温存目的）", "standard": true, "optional": true },
        { "name": "術前内分泌療法", "detail": "閉経後・高齢者でAI 6ヶ月間（手術までのブリッジ）", "standard": true, "optional": true }
      ]
    },
    {
      "phase": "手術",
      "steps": [
        { "name": "乳房温存術 or 全切除", "detail": "腫瘍径・広がりに応じて選択。乳房再建も選択肢", "standard": true },
        { "name": "センチネルリンパ節生検 ± 郭清", "detail": "cN0→SLN生検、cN+→腋窩郭清", "standard": true }
      ]
    },
    {
      "phase": "術後補助療法",
      "steps": [
        { "name": "放射線療法", "detail": "温存術後は必須。全切除後もリスクに応じて", "standard": true },
        { "name": "内分泌療法 5-10年", "detail": "閉経前：TAM±LHRHa / 閉経後：AI（レトロゾール/アナストロゾール）", "standard": true },
        { "name": "化学療法（リスクに応じて）", "detail": "AC/EC→タキサン。OncotypeDX等で化学療法省略を検討", "standard": true, "optional": true },
        { "name": "＋アベマシクリブ 2年", "detail": "再発高リスク（LN4+, or LN1-3+腫瘍径5cm+/G3）: monarchE", "standard": true, "highlight": true },
        { "name": "＋S-1 1年", "detail": "再発高リスク（POTENT基準）: 内分泌療法と併用", "standard": true, "highlight": true },
        { "name": "＋オラパリブ 1年", "detail": "BRCA変異陽性＋再発高リスク: OlympiA", "standard": true, "highlight": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "イナボリシブ", "trial": "INAVO120", "note": "PIK3CA変異＋NAC後non-pCR→術後治療への適応拡大検討中", "phase": "Ph III ✓" },
    { "drug": "カミゼストラント", "trial": "SERENA-6", "note": "CDK4/6i後の内分泌療法スイッチ（術後設定への展開可能性）", "phase": "Ph III ✓" },
    { "drug": "リボシクリブ", "trial": "NATALEE", "note": "術後CDK4/6i（FDA承認済）。日本未申請→ドラッグラグ", "phase": "承認済(海外)" }
  ]
}
```

#### HR+/HER2− 転移・再発

```json
{
  "title": "HR+/HER2− 転移・再発治療",
  "desc": "Visceral crisisがなければ内分泌療法ベースで逐次治療。バイオマーカーに応じた分子標的薬併用が重要。",
  "flow": [
    {
      "phase": "1次治療",
      "steps": [
        { "name": "CDK4/6i ＋ AI（±LHRHa）", "detail": "パルボシクリブ/アベマシクリブ ＋ レトロゾール等。PALOMA-2/MONARCH-3/MONALEESA", "standard": true },
        { "name": "AI単独（±LHRHa）", "detail": "CDK4/6i併用が困難な場合", "standard": true, "optional": true }
      ]
    },
    {
      "phase": "2次治療",
      "steps": [
        { "name": "イムルネストラント", "detail": "経口SERD。ESR1変異例に有効。EMBER-3（2025年日本承認）", "standard": true, "highlight": true },
        { "name": "フルベストラント ± CDK4/6i", "detail": "1次AI耐性後。アベマシクリブ併用（MONARCH-2）", "standard": true },
        { "name": "エベロリムス ＋ AI", "detail": "mTOR阻害。BOLERO-2", "standard": true },
        { "name": "＋カピバセルチブ（AKT経路変異時）", "detail": "PIK3CA/AKT1/PTEN変異: CAPItello-291", "standard": true, "highlight": true },
        { "name": "＋イナボリシブ（PIK3CA変異時）", "detail": "PIK3CA変異: INAVO120（FDA承認済、日本開発中）", "standard": false, "highlight": true }
      ]
    },
    {
      "phase": "3次治療以降",
      "steps": [
        { "name": "T-DXd エンハーツ（HER2-low時）", "detail": "HER2-low（IHC1+/2+ ISH-）: DESTINY-Breast04", "standard": true, "highlight": true },
        { "name": "Sac-Gov トロデルビ", "detail": "TROP2-ADC。2次以降の化学療法として", "standard": true },
        { "name": "化学療法（逐次単剤）", "detail": "エリブリン/カペシタビン/ビノレルビン等", "standard": true },
        { "name": "オラパリブ/タラゾパリブ", "detail": "BRCA変異陽性例: OlympiAD/EMBRACA", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "カミゼストラント", "trial": "SERENA-4/6", "note": "次世代SERD。1L/2Lで試験進行中。FDA申請中", "phase": "Ph III" },
    { "drug": "ベプデゲストラント", "trial": "VERITAC-2", "note": "PROTAC ER分解薬。新規MOA。FDA申請中", "phase": "Ph III ✓" },
    { "drug": "ギレデストラント", "trial": "evERA/lidERA", "note": "経口SERD。persevERA主要EP未達も他適応で申請継続", "phase": "申請中" },
    { "drug": "ゲダトリシブ", "trial": "VIKTORIA-1", "note": "PI3K/mTOR二重阻害。FDA申請中", "phase": "Ph III ✓" },
    { "drug": "Dato-DXd", "trial": "TB-02/04", "note": "TROP2-ADC。HR+2L以降。TNBC FDA承認判断Q2", "phase": "Ph III" },
    { "drug": "アチルモシクリブ", "trial": "FOURLIGHT-3", "note": "次世代CDK4i。CDK4/6i後の2Lで有意なPFS改善", "phase": "Ph II→III" },
    { "drug": "プリフェトラスタット", "trial": "KATSIS-1", "note": "KAT6阻害薬。新規標的", "phase": "Ph III" }
  ]
}
```

#### HER2+ 周術期

```json
{
  "title": "HER2+ 周術期治療",
  "desc": "抗HER2療法の導入で予後が劇的に改善。術前化学療法＋抗HER2療法→手術→術後抗HER2療法の流れが標準。",
  "flow": [
    {
      "phase": "術前化学療法＋抗HER2",
      "steps": [
        { "name": "AC/EC → DTX+HP", "detail": "アンスラサイクリン→ドセタキセル+トラスツズマブ+ペルツズマブ", "standard": true },
        { "name": "TCbHP（non-AC）", "detail": "ドセタキセル+カルボプラチン+HP（心毒性リスク回避）", "standard": true, "optional": true },
        { "name": "wPTX+HP", "detail": "パクリタキセル毎週＋HP", "standard": true, "optional": true }
      ]
    },
    {
      "phase": "手術",
      "steps": [
        { "name": "乳房温存術 or 全切除", "detail": "NAC後の腫瘍縮小効果を評価して術式決定", "standard": true }
      ]
    },
    {
      "phase": "術後補助療法（pCR達成時）",
      "steps": [
        { "name": "HP継続（計1年）", "detail": "トラスツズマブ±ペルツズマブ。フェスゴ（皮下注）も選択肢", "standard": true },
        { "name": "放射線療法", "detail": "温存術後/リスクに応じて", "standard": true }
      ]
    },
    {
      "phase": "術後補助療法（non-pCR時）",
      "steps": [
        { "name": "T-DM1 カドサイラ 14サイクル", "detail": "KATHERINE試験: iDFS HR 0.50。残存病変ありの場合の標準", "standard": true, "highlight": true },
        { "name": "放射線療法", "detail": "温存術後/リスクに応じて", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "T-DXd", "trial": "DESTINY-Breast05", "note": "non-pCR例でT-DM1 vs T-DXd。結果発表待ち（2026 Q3?）", "phase": "Ph III ⏳" },
    { "drug": "T-DXd", "trial": "DESTINY-Breast11", "note": "NAC設定でHP+chemo vs T-DXd+HP", "phase": "Ph III ⏳" }
  ]
}
```

#### HER2+ 転移・再発

```json
{
  "title": "HER2+ 転移・再発治療",
  "desc": "抗HER2療法の進歩により予後が大幅に改善（OS中央値58ヶ月）。治療ラインごとに薬剤を逐次使用。",
  "flow": [
    {
      "phase": "1次治療",
      "steps": [
        { "name": "HP＋ドセタキセル（CLEOPATRA）", "detail": "トラスツズマブ+ペルツズマブ+DTX。PFS 18.7m, OS 57.1m", "standard": true },
        { "name": "HP＋パクリタキセル", "detail": "DTX不耐時の代替。弱い推奨", "standard": true, "optional": true }
      ]
    },
    {
      "phase": "2次治療",
      "steps": [
        { "name": "T-DXd エンハーツ", "detail": "DESTINY-Breast03: PFS HR 0.33 vs T-DM1。圧倒的優越性", "standard": true, "highlight": true }
      ]
    },
    {
      "phase": "3次治療以降",
      "steps": [
        { "name": "T-DM1 カドサイラ", "detail": "T-DXdを2Lで使用済みの場合の3L選択肢", "standard": true },
        { "name": "ツカチニブ＋Tmab＋Cape", "detail": "HER2CLIMB: 脳転移にも有効。2026年2月日本承認", "standard": true, "highlight": true },
        { "name": "ラパチニブ＋カペシタビン", "detail": "HER2 TKI併用。古典的レジメン", "standard": true },
        { "name": "HP再投与＋化学療法", "detail": "PRECIOUS: PFS HR 0.76。ペルツズマブ再投与", "standard": true, "optional": true },
        { "name": "Tmab＋化学療法（逐次）", "detail": "エリブリン/ビノレルビン/ゲムシタビン等＋Tmab継続", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "DB-1303 (BNT323)", "trial": "Phase I/II", "note": "次世代HER2-ADC。DXd linker改良。BioNTech/第一三共", "phase": "Ph I-II" },
    { "drug": "T-DXd", "trial": "DB-09/12", "note": "1L設定でHP+chemo vs T-DXd。ゲームチェンジャー候補", "phase": "Ph III ⏳" },
    { "drug": "ツカチニブ", "trial": "HER2CLIMB-02", "note": "+T-DM1併用。2L設定。Ph III結果発表済み", "phase": "Ph III ✓" }
  ]
}
```

#### TNBC 周術期

```json
{
  "title": "TNBC 周術期治療",
  "desc": "化学療法感受性が高い一方で再発リスクも高い。免疫チェックポイント阻害薬の周術期導入が標準に。",
  "flow": [
    {
      "phase": "術前化学療法",
      "steps": [
        { "name": "ペムブロリズマブ＋化学療法", "detail": "KEYNOTE-522: AC/EC→PTX+CBDCA+Pembro。pCR率64.8% vs 51.2%", "standard": true, "highlight": true },
        { "name": "AC/EC → タキサン（±CBDCA）", "detail": "Pembro非使用の場合の標準NAC", "standard": true }
      ]
    },
    {
      "phase": "手術",
      "steps": [
        { "name": "乳房温存術 or 全切除", "detail": "NAC奏効に応じて術式決定", "standard": true }
      ]
    },
    {
      "phase": "術後補助療法（pCR達成時）",
      "steps": [
        { "name": "ペムブロリズマブ継続（計1年）", "detail": "KEYNOTE-522プロトコル。術後9サイクル", "standard": true, "highlight": true },
        { "name": "放射線療法", "detail": "リスクに応じて", "standard": true }
      ]
    },
    {
      "phase": "術後補助療法（non-pCR時）",
      "steps": [
        { "name": "カペシタビン 6-8サイクル", "detail": "CREATE-X: OS HR 0.59。残存病変ありの標準", "standard": true, "highlight": true },
        { "name": "＋オラパリブ 1年（BRCA変異時）", "detail": "OlympiA: iDFS HR 0.58。BRCA陽性+高リスク", "standard": true, "highlight": true },
        { "name": "ペムブロリズマブ継続", "detail": "non-pCRでも術後Pembro継続＋Cape併用を検討", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "Dato-DXd", "trial": "TROPION-Breast04", "note": "周術期TNBC設定。non-pCR例への適用検討", "phase": "Ph III ⏳" },
    { "drug": "Sac-TMT", "trial": "OptiTROP-Breast03", "note": "次世代TROP2-ADC。周術期設定", "phase": "Ph III ⏳" }
  ]
}
```

#### TNBC 転移・再発

```json
{
  "title": "TNBC 転移・再発治療",
  "desc": "予後不良（OS中央値14.2ヶ月）だが、免疫療法・ADC・PARP阻害薬など治療選択肢が急速に拡大。",
  "flow": [
    {
      "phase": "1次治療",
      "steps": [
        { "name": "ペムブロリズマブ＋化学療法（PD-L1+）", "detail": "KEYNOTE-355: CPS≥10でPFS/OS改善。nab-PTX/PTX/GEM+CBDCA併用", "standard": true, "highlight": true },
        { "name": "化学療法（PD-L1−）", "detail": "アンスラサイクリン/タキサン未使用→AC/EC→タキサン等", "standard": true }
      ]
    },
    {
      "phase": "2次治療以降",
      "steps": [
        { "name": "Sac-Gov トロデルビ", "detail": "TROP2-ADC。ASCENT: PFS 5.6m vs 1.7m (HR 0.41)", "standard": true, "highlight": true },
        { "name": "オラパリブ/タラゾパリブ（BRCA変異時）", "detail": "OlympiAD/EMBRACA: BRCA陽性例", "standard": true },
        { "name": "T-DXd エンハーツ（HER2-low時）", "detail": "HER2低発現の場合: DESTINY-Breast04", "standard": true, "highlight": true },
        { "name": "化学療法（逐次単剤）", "detail": "エリブリン/カペシタビン/ビノレルビン/ゲムシタビン等", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "Dato-DXd", "trial": "TB-02 (TROPION-B02)", "note": "TNBC 1L設定。FDA承認判断2026 Q2", "phase": "Ph III ✓" },
    { "drug": "Sac-TMT", "trial": "OptiTROP-Breast01/02", "note": "次世代TROP2-ADC。Sac-Govとのhead-to-head含む", "phase": "Ph III ✓" },
    { "drug": "プミタミグ", "trial": "ROSETTA-BREAST-01", "note": "PD-L1×VEGF-A二重特異性抗体。BioNTech/BMS", "phase": "Ph III ⏳" },
    { "drug": "Sac-Gov", "trial": "ASCENT-03/04", "note": "1L設定への前倒し。Pembro併用", "phase": "Ph III ✓" }
  ]
}
```

#### HER2低発現 周術期

```json
{
  "title": "HER2低発現 周術期治療",
  "desc": "HER2-lowは従来のサブタイプ分類に横断的なカテゴリー。周術期はHR状態に準じた治療を行い、HER2-low特有の標準治療はまだ確立していない。",
  "flow": [
    {
      "phase": "現在の治療方針",
      "steps": [
        { "name": "HR+の場合 → HR+/HER2−に準じる", "detail": "内分泌療法ベース＋リスクに応じた化学療法・分子標的薬", "standard": true },
        { "name": "HR−の場合 → TNBCに準じる", "detail": "化学療法＋ペムブロリズマブ（PD-L1状態に応じて）", "standard": true }
      ]
    },
    {
      "phase": "将来の変化",
      "steps": [
        { "name": "T-DXd術後設定の可能性", "detail": "DESTINY-Breast05等の結果次第で周術期にもHER2-low区別が重要に", "standard": false }
      ]
    }
  ],
  "pipeline": [
    { "drug": "T-DXd", "trial": "DB-05/11", "note": "HER2-low周術期設定。結果次第でパラダイムシフト", "phase": "Ph III ⏳" },
    { "drug": "DB-1303", "trial": "Phase I/II", "note": "次世代HER2-ADC。HER2-low/ultralowへの有効性検証", "phase": "Ph I-II" }
  ]
}
```

#### HER2低発現 転移・再発

```json
{
  "title": "HER2低発現 転移・再発治療",
  "desc": "DESTINY-Breast04の結果により、HER2-lowが治療選択に直結する新カテゴリーとして確立。T-DXdが標準治療に。",
  "flow": [
    {
      "phase": "バイオマーカー確認",
      "steps": [
        { "name": "HER2 IHC再検査", "detail": "IHC 1+ or IHC 2+/ISH− → HER2-low。治療歴のある転移・再発で確認必須", "standard": true, "highlight": true }
      ]
    },
    {
      "phase": "化学療法歴のある転移・再発",
      "steps": [
        { "name": "T-DXd エンハーツ", "detail": "DESTINY-Breast04: PFS 9.9m vs 5.1m (HR 0.50), OS 23.4m vs 16.8m (HR 0.64)", "standard": true, "highlight": true }
      ]
    },
    {
      "phase": "その他の治療",
      "steps": [
        { "name": "HR+の場合：HR+/HER2−アルゴリズムに準じる", "detail": "内分泌療法ベース→T-DXdを含むシークエンス", "standard": true },
        { "name": "HR−の場合：TNBCアルゴリズムに準じる", "detail": "免疫療法・ADC・化学療法", "standard": true }
      ]
    }
  ],
  "pipeline": [
    { "drug": "T-DXd", "trial": "DB-06", "note": "HER2-low 1L設定（内分泌耐性後）。Ph III結果positive", "phase": "Ph III ✓" },
    { "drug": "DB-1303", "trial": "Phase I/II", "note": "次世代ADC。HER2-ultralow (IHC 0 weak)にも有効の可能性", "phase": "Ph I-II" },
    { "drug": "Dato-DXd", "trial": "TB-04", "note": "TROP2-ADC。HER2-low/HR+設定", "phase": "Ph III ⏳" }
  ]
}
```

---

### 2. コンポーネント作成: `src/components/TreatmentAlgorithm.jsx`

以下の仕様でReactコンポーネントを作成してください：

**機能要件：**
- サブタイプ選択ボタン（4つ）: HR+/HER2−、HER2+、TNBC、HER2-low
- 設定切替（2つ）: 周術期 / 転移・再発
- 治療フロー表示: フェーズごとに番号付きセクション、各ステップはクリックで詳細展開（アコーディオン）
- パイプラインセクション: 「🔬 ここに新薬が入る可能性」として各パターンの開発中薬剤を表示
- HER2-low選択時: 横断的カテゴリーである旨の説明パネルを表示
- 凡例: 標準/開発中/★近年の変化/クリックで詳細

**デザイン要件：**
- 既存サイトのダークテーマ・インラインCSSパターンに完全に統一
- 既存サイトの色定義（COLORS オブジェクト）を再利用
- サブタイプごとの色分け:
  - HR+/HER2−: 緑系 (#22c55e)
  - HER2+: アンバー系 (#f59e0b)
  - TNBC: ピンク系 (#ec4899)
  - HER2-low: 紫系 (#a78bfa)
- パイプライン薬剤のPhaseバッジ色:
  - Ph III ✓ (positive): 緑
  - Ph III ⏳ (進行中)/申請中: アンバー
  - Ph I-II: シアン
- レスポンシブ: モバイルファーストで設計（ボタンはflex-wrap）

**UI詳細：**
- 各ステップの左ボーダーで標準治療かどうかを視覚的に区別
  - 標準治療: `standard: true` → 左ボーダーは通常色
  - ハイライト: `highlight: true` → 左ボーダーがサブタイプ色＋背景にかすかな色
  - 開発中: `standard: false` → シアンボーダー
- フェーズ間は点線の縦線で接続
- ステップカードはhover時にかすかに背景色変化

### 3. App.jsx への統合

`src/App.jsx` の「日本の標準治療」タブのコンテンツ部分に `<TreatmentAlgorithm />` を配置してください。

- データは `src/data/treatment-algorithm.json` からimport
- コンポーネントは `src/components/TreatmentAlgorithm.jsx` からimport
- 既存のタブ切替ロジックに統合（「日本の標準治療」タブ選択時にこのコンポーネントを表示）

### 4. 注意事項

- **外部ライブラリ追加不可**（React/ReactDOM のみ）
- **インラインCSS**で統一（CSS-in-JSライブラリ使用不可）
- 既存の COLORS 定義がある場合はそれを優先使用
- JSONデータのキー名はcamelCaseで統一
- 治療データの医学的内容は変更しないこと
- フッターに出典とdisclaimerを表示:
  - 「出典: 乳癌診療ガイドライン2022年版（2024年3月Web改訂）、NCCN Guidelines Breast Cancer v1.2026、各薬剤添付文書、ASCO/ESMO/SABCS 2025-2026」
  - 「本アルゴリズムは教育・情報提供目的です。治療方針決定には必ず担当医にご相談ください。」

---

## 完成イメージの参考

添付の `treatment-algorithm.jsx` ファイルが動作するプロトタイプです。このファイルのロジック・デザイン・データ構造を参考にしつつ、既存サイトのアーキテクチャ（データJSON分離、COLORS共有、インラインCSS）に適合させてください。
