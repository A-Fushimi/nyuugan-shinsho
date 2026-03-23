# Claude Code 指示書：臨床試験タイムラインの日程データ拡充・整理

## 概要

shinsho.bctube.org の臨床試験タイムラインに、試験の進行マイルストーンと規制当局の日程を体系的に追加し、ガントチャートのUI表示を改善してください。

## 背景

現在のtimeline.jsonには `fpi`（試験開始）、`lpi`（登録完了推定）、`readout`（結果発表時期）が小数年で入っています。しかし、「結果がいつ出そうか」「承認はいつか」を知るために必要な日程が不足しています。

## 作業1: timeline.json のスキーマ拡張

各試験エントリに以下のフィールドを追加してください。既存の `fpi`, `lpi`, `readout` はそのまま維持します。

### 追加フィールド定義

```jsonc
{
  // === 既存フィールド（変更なし） ===
  "id": "SERENA-4",
  "drug": "camizestrant",
  "phase": "III",
  "st": "ongoing",        // "pos" | "neg" | "ongoing"
  "sub": ["HR+/HER2-"],
  "fpi": 2021.417,         // First Patient In（小数年）
  "lpi": 2025.5,           // Last Patient In 推定（小数年）
  "readout": null,         // 結果発表時期（小数年、未発表はnull）
  "nct": "NCT04711252",
  "resultUrl": null,

  // === 新規追加フィールド ===

  // ── 試験側マイルストーン ──
  "pcd": "2026-09",        // Primary Completion Date（YYYY-MM）
                           // ClinicalTrials.gov の "Primary Completion Date (Estimated)" から取得
                           // 進行中試験で「結果見込み時期」の推定に使う
                           // 結果発表済み試験では実際のPCD（available な場合）

  "enrollment": "RECRUITING",  // 登録状況
                               // "RECRUITING" | "ACTIVE_NOT_RECRUITING" | "COMPLETED" | "NOT_YET_RECRUITING"
                               // ClinicalTrials.gov の overallStatus から取得

  "enrollmentTarget": 900,     // 目標登録数
                               // ClinicalTrials.gov の enrollmentInfo.count から取得

  "primaryEndpoint": "PFS",    // 主要評価項目（略称）
                               // "PFS" | "OS" | "pCR" | "iDFS" | "EFS" | "ORR" 等

  "scd": "2028-12",        // Study Completion Date（YYYY-MM）
                           // ClinicalTrials.gov の "Study Completion Date (Estimated)"
                           // OS等の長期評価項目の最終データ取得見込み

  // ── 規制側マイルストーン ──
  "regulatory": {
    "fda": {
      "submission": "2025-12",   // NDA/BLA/sNDA 申請日（YYYY-MM）。null = 未申請
      "pdufa": "2026-06-05",     // PDUFA date（YYYY-MM-DD）。null = 未設定
      "adcom": "2026-04-30",     // Advisory Committee 日程（YYYY-MM-DD）。null = 未設定/不要
      "approval": null            // 承認日（YYYY-MM-DD）。null = 未承認
    },
    "pmda": {
      "submission": null,         // 日本の申請日（YYYY-MM）。null = 未申請
      "approval": null            // 日本の承認日（YYYY-MM-DD）。null = 未承認
    },
    "ema": {
      "submission": null,         // EU申請日（YYYY-MM）。null = 未申請
      "approval": null            // EU承認日（YYYY-MM-DD）。null = 未承認
    }
  }
}
```

### フィールド取得方法

| フィールド | 取得元 | 方法 |
|-----------|--------|------|
| `pcd` | ClinicalTrials.gov API | `protocolSection.statusModule.primaryCompletionDateStruct.date` |
| `enrollment` | ClinicalTrials.gov API | `protocolSection.statusModule.overallStatus` |
| `enrollmentTarget` | ClinicalTrials.gov API | `protocolSection.designModule.enrollmentInfo.count` |
| `primaryEndpoint` | ClinicalTrials.gov API + 手動 | `protocolSection.outcomesModule.primaryOutcomes[0].measure` から略称抽出 |
| `scd` | ClinicalTrials.gov API | `protocolSection.statusModule.completionDateStruct.date` |
| `regulatory.fda.*` | Web検索 | 企業プレスリリース、FDA.gov |
| `regulatory.pmda.*` | Web検索 | PMDA審査報告書、企業IR |
| `regulatory.ema.*` | Web検索 | EMA.europa.eu、企業プレスリリース |

**ClinicalTrials.gov API の呼び出し例:**
```
https://clinicaltrials.gov/api/v2/studies/{NCT番号}?fields=protocolSection.statusModule,protocolSection.designModule.enrollmentInfo,protocolSection.outcomesModule.primaryOutcomes
```

NCT番号は既存の `nct` フィールドから取得可能。全37試験を一括取得してください。

### 規制側日程の既知データ（2026年3月時点）

以下は既にサイトの注目イベントや drugs.json に記載のある情報です。timeline.json の該当試験に紐付けてください。Web検索で補完・更新すること。

**FDA PDUFA date / 承認判断:**
- Camizestrant: AdCom 2026/4/30 → PDUFA確認要
- Vepdegestrant: PDUFA 2026/6/5
- Giredestrant (evERA): PDUFA 2026/12/18
- Dato-DXd (TNBC): FDA承認判断 2026 Q2
- T-DXd (post-NAC): FDA承認判断 2026 Q3
- Gedatolisib: FDA申請中（PDUFA確認要）
- Sac-TMT: FDA申請中（PDUFA確認要）

**日本（PMDA）:**
- ツカチニブ: 2026/2/19 承認済。薬価収載待ち
- イムルネストラント: 2025/12/22 承認済
- イナボリシブ: 中外製薬が日本開発中、2026年以降申請見込み

**nullの使い方:**
- 情報が見つからないフィールドは `null` とする
- 空文字列 `""` は使わない
- 該当しない場合（Phase II試験で規制当局日程がない等）は `regulatory` オブジェクト自体を `null`

---

## 作業2: ガントチャートUIの改善

### 2-A: バー上のマイルストーン表示

現在のガントチャートのバーに以下のマーカーを追加してください：

```
FPI                    LPI           PCD        Readout
 ├────登録期間────┤····追跡期間····│···▼·····│
 [============灰色破線=====|====色付き====▼========]
```

**進行中試験（st: "ongoing"）の場合：**
- バー全体: FPI → PCD（or SCD、PCDがない場合）
- 登録期間部分（FPI → LPI）: やや濃い色
- 追跡期間部分（LPI → PCD）: やや薄い色
- **◆ マーカー**: PCD位置に「結果見込み」を示すダイヤ型マーカー（半透明）
- 現在位置（赤線）との位置関係で、あとどれくらいで結果が出るか視覚的にわかる

**結果発表済み試験（st: "pos" | "neg"）の場合：**
- 現状のまま（FPI → readout、▼マーカー）

### 2-B: 試験カードの詳細パネル（ホバー/クリック時）

既存のツールチップまたは詳細パネルに以下を追加表示：

```
SERENA-4 | camizestrant | Phase III ⏳ 進行中
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
主要評価項目: PFS
目標登録数:   900人
登録状況:     RECRUITING

📅 試験日程
  試験開始 (FPI):      2021年6月
  登録完了 (LPI):      2025年6月（推定）
  主要評価完了 (PCD):  2026年9月（推定）
  試験完了 (SCD):      2028年12月（推定）

🏛 規制当局
  FDA:  AdCom 2026/4/30 → PDUFA確認中
  PMDA: 開発中
  EMA:  申請中

🔗 NCT04711252 | 📄 結果論文（あれば）
```

### 2-C: 凡例の更新

凡例に以下を追加：
- ◆ = 結果見込み時期（Primary Completion Date）
- バーの濃淡 = 登録期間 / 追跡期間

### 2-D: フィルター追加（任意・優先度低）

もし実装が容易であれば、「結果見込み時期」でソートするオプションを追加：
- 現在の並び順（FPI順）に加えて、「結果見込みが近い順」で並べ替えできると、今後の注目試験が分かりやすい

---

## 作業3: drugs.json との連携（任意・優先度低）

drugs.json の各薬剤カードの試験情報に、timeline.json から規制当局日程を動的に参照する仕組みがあれば理想的です。ただし、現在の単一ファイルSPA構成では複雑になりすぎる可能性があるため、以下の簡易方式でOK：

- drugs.json の各薬剤の `studies` 配列内に `timelineId` フィールドを追加し、timeline.json の試験IDと紐付ける
- パイプラインタブの薬剤カード展開時に、紐付いた試験のPCDやPDUFA dateを表示

これは必須ではありません。作業1・2が完了してから余裕があれば対応してください。

---

## 技術的制約

- **外部ライブラリ追加不可**（React / ReactDOM のみ）
- **インラインCSS** で統一
- 既存の COLORS 定義を再利用
- ClinicalTrials.gov API は `https://clinicaltrials.gov/api/v2/studies/` を使用
- ビルド: `npm run build` で確認
- デプロイ: git push で Netlify 自動デプロイ

## 作業順序

1. **ClinicalTrials.gov APIから全37試験のデータを一括取得**（pcd, scd, enrollment, enrollmentTarget, primaryEndpoint）
2. **Web検索で規制当局日程を収集**（FDA PDUFA, AdCom, PMDA申請/承認, EMA）
3. **timeline.json を更新**（新フィールド追加）
4. **App.jsx のガントチャートUI改善**（マーカー追加、詳細パネル拡充、凡例更新）
5. **ビルド・デプロイ**
6. **（余裕があれば）drugs.json連携、ソートオプション**

---

## 参考: 現在のtimeline.jsonの構造（1試験分の例）

```json
{
  "id": "SERENA-6",
  "drug": "camizestrant",
  "phase": "III",
  "st": "pos",
  "sub": ["HR+/HER2-"],
  "fpi": 2021.417,
  "lpi": 2023.75,
  "readout": 2025.167,
  "nct": "NCT04964934",
  "resultUrl": "https://doi.org/10.1056/NEJMoa2503053",
  "moa": "SERD"
}
```

更新後の目標構造：

```json
{
  "id": "SERENA-4",
  "drug": "camizestrant",
  "phase": "III",
  "st": "ongoing",
  "sub": ["HR+/HER2-"],
  "fpi": 2021.417,
  "lpi": 2025.5,
  "readout": null,
  "nct": "NCT04711252",
  "resultUrl": null,
  "moa": "SERD",
  "pcd": "2026-09",
  "enrollment": "RECRUITING",
  "enrollmentTarget": 900,
  "primaryEndpoint": "PFS",
  "scd": "2028-12",
  "regulatory": {
    "fda": {
      "submission": null,
      "pdufa": null,
      "adcom": "2026-04-30",
      "approval": null
    },
    "pmda": {
      "submission": null,
      "approval": null
    },
    "ema": {
      "submission": "2025-06",
      "approval": null
    }
  }
}
```
