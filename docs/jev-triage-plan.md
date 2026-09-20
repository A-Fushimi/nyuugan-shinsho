# Jev 情報トリアージ設計書（乳がん新書）

作成: 2026-09-20 / 設計: Claude（Fable）/ 実装: Claude（Opus）

## 1. 目的

乳がん新書の週次メンテナンスでは、ClinicalTrials.gov・openFDA・KEGG・oncolo.jp RSS などから
大量の情報が流入する。現状の取捨選択は正規表現とキーワードリスト
（`check-regulatory.mjs` の `/乳|breast|がん|承認|PMDA/`、`landscape_dedup.py` の除外語リスト）
に依存しており、ノイズ（乳がん以外・サポーティブケア・後発品）が混入する一方で、
言い換え表現の重要ニュースを取りこぼす。

本設計は TypeSafe AI の System One モデル **Jev** を「型付き判定エンジン」として使い、
流入情報を **採用 / 要確認 / 破棄** に振り分ける仕組み（トリアージ）を構築する。
Jev は文章を生成せず、定義済みの質問に対して型付きの答えと確率を返すため、
分類・スコアリングに特化した低コスト（約 $0.0004/判定）・低遅延の判定が可能。

## 2. Jev API 仕様（確認済み・SDK `@typesafe-ai/sdk` 0.6.0 の型定義より）

- エンドポイント: `POST https://api.typesafe.ai/v1/systemone`
- 認証: `Authorization: Bearer $TYPESAFE_API_KEY`
- リクエスト: `{ model: "jev-latest", state: <string|JSON>, questions: { <name>: Question } }`
  - `state`: 判定対象。複数の文脈がある場合は名前付き JSON フィールドを推奨
  - 質問は同じ state に対して **並列・独立** に評価される（互いの答えは見えない）
  - 質問名（キー）はモデルに渡されない。意味は `instructions` と `criteria` に完全に書く
- 質問の型（3種）
  | type | criteria | 応答 |
  |---|---|---|
  | `noul` | `{ true?: 説明, false?: 説明 }` 省略可 | `{ type:"noul", noul: 0〜1 }` yes の確率 |
  | `choice` | `{ ラベル: 説明 \| null, ... }` | `{ type:"choice", choice, confidence, probabilities:{ラベル:確率} }` |
  | `score` | 配列（index 0 から、2要素以上） | `{ type:"score", score(期待値・小数あり), confidence, probabilities:{"0":..}, legend }` |
- レスポンス共通: `{ model, answers:{...}, usage:{ input_tokens, output_tokens } }`
- SDK: `import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk"`（Node 20+）
  - 環境変数 `TYPESAFE_API_KEY` / `TYPESAFE_BASE_URL` / `TYPESAFE_DEFAULT_MODEL`
  - `fetch` オプションで HTTP 実装を差し替え可能 → テストではモック fetch を注入する
  - リトライ内蔵（408/429/5xx、デフォルト2回、Retry-After 尊重）、timeout 既定 10s
- 設計指針（公式スキルより）
  - 1質問 = 1つの狭い判断。独立した観点は別質問に分ける
  - 「該当なし」の選択肢を必ず用意する（該当しない場合に無理に選ばせない）
  - `noul` 0.5 付近は「yes/no 半々」であり「中程度」ではない
  - 判定（生データ）と方針（しきい値・重み）を分離し、しきい値変更で再推論しない
  - 公式ドキュメント https://docs.typesafe.ai/ （llms.txt あり）が正。本環境からは到達不可のため SDK 型定義を根拠とした

## 3. 全体アーキテクチャ

```
[収集: Collectors] → [正規化: TriageItem] → [既知チェック: seen.json/既知薬] → [判定: Jev] → [方針: policy] → [出力]
   oncolo.jp RSS         { id, source, title,      URL/NCTのハッシュで          1リクエスト/件      accept /      data/triage/<date>.json
   KEGG 新薬承認           body, url, date, ... }    重複を除外                    質問を並列送信       review /      .github/triage-result.md
   openFDA 承認                                                                                      discard       → GitHub Issue
   CT.gov 新規登録試験
   (landscape 候補)
```

- **Jev に任せる**: 意味的判断（乳がん薬物療法に関係するか、情報の種類、重要度、対象サブタイプ、新規作用機序か）
- **コードに残す**: 既知薬剤の照合（`drugs.json` の generic/エイリアス）、重複除外、日付、しきい値、レポート生成
- **人に回す**: しきい値未満 or 確信度が低いものは「要確認」として Issue に列挙する（破棄も件数と理由を残す）

## 4. ファイル構成（新規）

```
scripts/
  triage.mjs                     # エントリ: 収集→判定→方針→出力。CLI: --dry-run --offline --source=<name> --limit=N
  lib/
    jev.mjs                      # Jev クライアントの薄いラッパ（SDK生成、質問定義、1件判定、モック対応）
    triage-policy.mjs            # 純粋関数: Jev の answers → { decision, reasons, priority }
    triage-report.mjs            # 純粋関数: 判定結果 → Markdown（Issue 本文）
    triage-sources.mjs           # 各ソースの取得と TriageItem への正規化（oncolo/KEGG/openFDA/CT.gov）
    known-drugs.mjs              # drugs.json + エイリアスから既知薬剤セットを構築、照合
scripts/__tests__/
  triage-policy.test.mjs         # node:test
  triage-report.test.mjs
  jev.test.mjs                   # モック fetch で SDK の request/response 形を検証
  fixtures/
    items.sample.json            # 代表的な流入アイテム 10件程度（乳がん承認、他がん種、サポーティブケア、後発品…）
    jev.answers.sample.json      # 上記に対応する Jev 応答の固定データ（--offline で使用）
data/triage/
  seen.json                      # 判定済み ID とその決定（再通知防止）。コミット対象
  2026-09-20.json                # 実行ごとの判定ログ（生の answers を保存 → しきい値変更時に再推論不要）
docs/jev-triage.md               # 運用ドキュメント（セットアップ、質問の変え方、しきい値調整）
```

既存ファイルの変更:
- `package.json`: 依存 `@typesafe-ai/sdk` 追加、scripts に `"triage": "node scripts/triage.mjs"`, `"test": "node --test scripts/__tests__/"`
- `.github/workflows/update-data.yml`: `triage` ジョブ追加（毎週水曜 regulatory の後、または独立 cron）。`TYPESAFE_API_KEY` を secrets から渡す。結果ファイルがあれば Issue 起票。`data/triage/` の変更をコミット
- `check-regulatory.mjs`: 変更しない（後方互換）。トリアージが安定したら oncolo/KEGG 部分を削る判断は人が行う

## 5. TriageItem（正規化スキーマ）

```json
{
  "id": "oncolo:sha1(url)" ,
  "source": "oncolo" | "kegg" | "openfda" | "ctgov",
  "title": "…",
  "body": "本文抜粋・説明文（最大 ~2000 字）",
  "url": "https://…",
  "date": "2026-09-16",
  "meta": { "nct": "NCT…", "sponsor": "…", "phase": "PHASE2", "generic": "…", "brand": "…" },
  "knownDrugs": ["trastuzumab deruxtecan"]   // コードで照合した既知薬（空配列可）
}
```

## 6. Jev への質問（1件 = 1リクエスト、質問は並列）

state は JSON で渡す:
```json
{ "source": "oncolo.jp（日本のがん情報サイト）", "title": "…", "body": "…", "date": "…", "known_drugs_in_site": ["…"] }
```

| 質問名 | 型 | instructions（要旨） | criteria |
|---|---|---|---|
| `relevant` | noul | この情報は乳がんの薬物療法（新薬・適応拡大・臨床試験結果・承認/申請）に直接関係するか | true: 乳がん患者への薬剤治療に関する具体的情報 / false: 他がん種のみ、検診・手術・放射線のみ、サポーティブケア、一般啓発、企業財務 |
| `category` | choice | 情報の種類 | `approval_jp`(日本承認/薬価収載/発売), `approval_us`(FDA), `approval_eu`(EMA/CHMP), `filing`(申請・受理・審査中), `trial_result`(主要評価項目の達成/未達、学会発表), `trial_start`(新規試験登録・開始), `guideline`(ガイドライン改訂), `safety`(添付文書改訂・安全性情報), `other`(上記以外) |
| `impact` | score | 日本の乳がん診療・患者への影響度 | 0: 影響なし/情報価値なし, 1: 参考情報（早期試験の登録など）, 2: 注目（第III相結果・海外承認・申請）, 3: 実臨床を変える（日本承認、標準治療を変える結果、ガイドライン改訂） |
| `subtype` | choice | 主な対象サブタイプ | `hr_pos`, `her2_pos`, `tnbc`, `her2_low`, `multiple`, `unspecified` |
| `setting` | choice | 治療セッティング | `early`(周術期), `metastatic`(転移・再発), `both`, `unspecified` |
| `novel_agent` | noul（ctgov のみ） | 介入に新規の分子標的薬・ADC・免疫療法など「新薬候補」が含まれるか | true: 開発コード/新規MoA / false: 既存化学療法のみ、後発品、支持療法、機器、検査 |
| `moa` | choice（ctgov のみ） | 新薬候補の作用機序カテゴリ | `landscape_to_json.py` の MOA_KEYWORDS のキー（ADC, bispecific, PROTAC_degrader, oral_SERD_next, CDK_next, epigenetic, …）+ `other` + `none` |

`known_drugs_in_site` を state に含めるのは「既収録薬の新情報か（適応拡大など）」を判断させる文脈のため。
既知薬かどうかそのものはコードで判定する。

## 7. 方針（`triage-policy.mjs`、純粋関数、しきい値は定数オブジェクトで一元管理）

```
入力: item, answers
1. relevant.noul < 0.35                        → discard（理由: 乳がん薬物療法に非該当）
2. 0.35 ≤ relevant.noul < 0.65                 → review（理由: 関連性が不確実）
3. relevant ≥ 0.65 かつ impact.score ≥ 2.0     → accept（priority = impact.score）
4. relevant ≥ 0.65 かつ 1.0 ≤ impact < 2.0     → review（参考情報）
5. relevant ≥ 0.65 かつ impact < 1.0           → discard
6. category.confidence < 0.5 の accept          → review に格下げ（分類が曖昧）
ctgov 固有:
7. novel_agent.noul < 0.35                     → discard（既存化療・支持療法）
8. novel_agent 0.35〜0.65                      → review
9. novel_agent ≥ 0.65 かつ relevant ≥ 0.65     → accept（landscape 候補、moa.choice を付与）
```
出力: `{ decision: "accept"|"review"|"discard", priority: number, reasons: string[], tags: { category, subtype, setting, moa? } }`
しきい値は `THRESHOLDS` として export し、テストで境界値を検証する。

## 8. 出力

- `data/triage/<YYYY-MM-DD>.json`: `[{ item, answers, decision, priority, reasons, tags, usage }]`
- `data/triage/seen.json`: `{ "<id>": { "decision", "date" } }`。discard も記録（再通知防止）。
  ただし `review` は次回も再掲しない（人が Issue で見る）。
- `.github/triage-result.md`（accept/review が 1 件以上のとき生成）:
  ```
  # 📥 情報トリアージ結果 (2026-09-20)
  ## 🔴 採用候補（accept, N件）— 優先度順
  - [approval_jp][HER2+ / metastatic] ★3.0 エンハーツ＋ペルツズマブ … (oncolo, 9/16) <url>
      relevant 0.97 / impact 2.9 / category approval_jp (conf 0.88)
  ## 🟡 要確認（review, M件）
  - …（理由を併記）
  ## ⚪ 破棄（K件）
  <details> 内に一覧（title と主な理由のみ）
  ---
  Jev model: jev-1.x / 判定数 / 入力トークン合計 / 概算コスト
  ```
- ワークフローが `gh issue create --title "📥 情報トリアージ $(date)" --body-file …` で起票（既存の regulatory と同じ方式）

## 9. 実行モード

- 本番: `node scripts/triage.mjs`（TYPESAFE_API_KEY 必須。無ければ警告して exit 0、Issue は作らない）
- `--dry-run`: seen.json や data/triage を書かず、標準出力にレポート
- `--offline`: ネットワークもJevも使わず fixtures で全経路を通す（CI の test で使用）
- `--source=oncolo,kegg`: ソース限定
- `--limit=N`: 判定件数上限（コスト暴走防止、既定 200）
- 同時実行は `Promise` プールで 4 並列、SDK の内蔵リトライに任せる
- 1件の失敗（例外）はその件を `review` 扱い＋ `reasons: ["Jev error: …"]` にしてパイプラインを止めない

## 10. テスト（`node --test`、ネットワーク不要）

1. `triage-policy.test.mjs`: 上記 9 ルールの境界値（0.35/0.65/1.0/2.0/conf 0.5）、ctgov 分岐、reasons の内容
2. `triage-report.test.mjs`: 見出し・件数・優先度順・details 折りたたみ、0 件時に生成しない
3. `jev.test.mjs`: モック fetch で (a) `/v1/systemone` に POST されること (b) body に `model/state/questions` があり質問型が正しい (c) answers が返ること (d) 429 → SDK リトライ後成功
4. `triage.mjs --offline --dry-run` を smoke test として実行し exit 0 を確認

## 11. ワークフロー変更（`update-data.yml`）

```yaml
  triage:
    if: github.event_name == 'workflow_dispatch' && (task == 'triage' || task == 'both') || schedule == '0 1 * * 3'
    needs: []   # regulatory と独立
    steps: checkout / setup-node / npm ci / node scripts/triage.mjs (env TYPESAFE_API_KEY) /
           data/triage 変更をコミット / .github/triage-result.md があれば gh issue create
```
`workflow_dispatch.inputs.task.options` に `triage` を追加。

## 12. 段階と受け入れ基準

- Phase A（本PR）: §4〜§11 をすべて実装。`npm test` 緑、`node scripts/triage.mjs --offline --dry-run` がレポートを出力。
- Phase B（別PR・要 API キー）: 実データで 1 週分を走らせ、Issue の accept/review/discard を人が確認してしきい値を調整。
- Phase C（任意）: `landscape_dedup.py` のキーワード除外を `--source=ctgov` の判定結果（`data/triage`）に置き換える。

## 13. 非スコープ・注意

- UI（App.jsx）は変更しない。トリアージ結果は編集者向け Issue で消費する
- Supabase は使わない（JSON が唯一の正、という既存方針に従う）
- API キーはコードに書かない。ログに state 全文を出さない（SDK logLevel は既定 warn）
- Jev の答えは「型が保証される」だけで真実は保証しない。accept でも人が確認してから events.json / changelog.json に反映する

---

## 14. Phase B 初回実行の所見と調整（2026-09-20）

GitHub Actions で初めて実データを流した（200 件判定、model `jev-1.13.0`、概算 $0.018）。
そこで見えた 4 つの問題と、それに対する変更をここに残す。

### 所見

1. **oncolo.jp が HTTP 403**（0 件）。Actions ランナーからの既定 Node fetch の User-Agent が
   ボットとして弾かれたものと見られる。
2. **KEGG のパーサが壊れていた**。取れたのは 2 件だけで、タイトルは `2025/12/22` と
   `Last updated: August 26, 2026`。行ベースの「年が入っていれば拾う」条件が
   実際のページ構造と合っていない。
3. **CT.gov が流入を占拠**。ctgov 485 件に対し openFDA 29 件 / KEGG 2 件で、
   200 件の上限がほぼ ctgov で埋まり 316 件が持ち越しになった。さらに ctgov の 107 件が
   ルール9（`novel_agent ≥ 0.65`）で priority ≈ 1.0 の accept になり、
   Issue の「🔴 採用候補」が早期相の試験 107 件で埋まって実ニュースが埋もれた。
4. **openFDA が全件 review**。本文には `submission: SUPPL #24 (Efficacy)` のように
   submission class が入っているのに使っていなかった。Labeling / Manufacturing (CMC) などの
   臨床的に意味のない一部変更が多く、また同一ブランド・同一日の複数 SUPPL
   （例: enhertu の #41 と #43、どちらも 2026-05-15）が別項目として並んでいた。

### 変更

- **A. HTTP ヘッダ**: 外向きの取得を `fetchWithHeaders()`（`triage-sources.mjs`）に一本化し、
  ブラウザ風の `User-Agent` / `Accept` / `Accept-Language` を付ける。`fetchImpl` は差し替え可能のまま。
- **B. KEGG の頑健化と診断**: 「日付を含み、かつ日付以外に 8 文字以上（文字を含む）の中身がある行」
  だけを採用し、`Last updated` などはデニーリストで落とす。加えて BRITE の `/entry/Dxxxxx`
  アンカーからも項目を作る。抽出が 3 件未満のときだけ、総行数と
  `乳` / `/entry/D` / `承認` を含む行を最大 15 行（各 160 字）標準出力に出す
  （読み取りのみ。kegg.jp に接続できない環境で構造を確かめるため、次回の CI ログに残す）。
- **C. ソース優先度とソース別上限**: 判定順を oncolo → KEGG → openFDA → CT.gov に固定し、
  `--ctgov-limit=N`（既定 80）を `--limit` より先に適用する。持ち越しはソース別の件数で表示。
  並べ替えと上限は `scripts/triage.mjs` の純粋関数 `orderAndCap()` に切り出してテストしている。
- **D. openFDA の事前フィルタとマージ**: `submission_class_code` /
  `submission_class_code_description` を見て、`EFFICACY` / `Efficacy…` / `New Indication` /
  `Original` / `TYPE 1`〜`TYPE 10` と区分不明のものだけを残し、`LABELING` /
  `MANUFACTURING (CMC)` / `REMS` / `BIOEQUIV` などは落とす。
  同一ブランド・同一日のレコードは 1 件にまとめ、body に全 submission 番号と `class:` 行を、
  `meta.submissionClass` に区分の説明を入れる。
- **E. レポートの組み替え**（`triage-report.mjs`）:
  「🔴 採用候補」は CT.gov 以外の accept のみ（優先度降順）。
  CT.gov の accept は新セクション「🧪 ランドスケープ候補（CT.gov 新規作用機序の試験, N件）」に
  `tags.moa` ごとの件数付きで集め、N > 15 なら `<details>` に畳む
  （各行: タイトル / phase / sponsor / NCT リンク / `novel_agent`）。
  「🟡 要確認」はソース別にまとめ、1 ソースが 15 件を超えたらそのソースだけ `<details>`。
  セクション順は 採用候補 → 要確認 → ランドスケープ候補 → 破棄。
  レポートは accept + review ≥ 1 **または** CT.gov の accept ≥ 1 で生成する。
- **F. ワークフロー**: `workflow_dispatch` に `dry_run`（boolean、既定 false）を追加。
  true のとき `node scripts/triage.mjs --dry-run` で走らせ、コミットと Issue 起票の
  両ステップを `if: ${{ github.event.inputs.dry_run != 'true' }}` でスキップする。

しきい値（`THRESHOLDS`）自体は今回変えていない。ルール9の accept を捨てるのではなく
置き場所を変えた（ランドスケープ候補）ので、`data/triage/<date>.json` からの再計算も従来どおり効く。

### 第2ラウンド（2026-09-20、`--collect-only` での実データ確認）

`workflow_dispatch` の `collect_only` を使って GitHub Actions 上で収集だけを走らせ
（Jev は呼ばない＝無料）、Phase B の変更 A・B が実際のページ構造に合っているかを確かめた。
ここで 2 つの事実が確定した。

#### 事実 1: KEGG は行ベースでは解けない（`br08318.html`、9,712 行 / 319KB）

実物は **1 行 1 `<td>` の HTML テーブル**で、承認 1 件が `<tr>` にまたがっている。

```html
      <td>2026/8/24</td>
      <td><a href="/entry/D12615" id="D12615">D12615</a></td>
      <td>(<a href="/brite/br08303/J05AX34">J05AX34</a>)</td>
      …（同じ <tr> 内に薬剤名・会社名・効能のセルが続く）
```

日付は `YYYY/M/D`（ゼロ埋めなし）。Phase B の行ベース実装（日付＋実体のある行／`/entry/D` アンカー）は
この構造では **タイトルが `D12615` だけの項目を 935 件**作り、そのすべてが Jev に投げられて
判定コストを無駄にしていた。

- **変更**: `parseKegg()` を `<tr>` ブロック単位に書き換えた。
  「`^\d{4}/\d{1,2}/\d{1,2}$` のセル」と「`/entry/D\d{5}` リンクを含むセル」の両方を持つ行を承認行とし、
  `date` / `meta.keggEntry` / `meta.atc`（`/brite/br08303/`）/ `url`（`https://www.kegg.jp/entry/<D番号>`）/
  `id`（`makeId('kegg', D番号+日付)`）を組み立てる。`title` は D 番号・ATC より後ろの
  最初の「コードだけではない」セル（無ければ `KEGG 新薬承認 D12615 (2026-08-24)`）、
  `body` は全セルを ` | ` で連結（2000 字）。
- **窓**: `KEGG_WINDOW_DAYS`（既定 120 日、export）で古い承認を落とす。テストでは `now` を注入する。
- 旧来の `keggLineHasSubstance()` / `KEGG_DENY_RE` / 行ベースのフォールバック、
  および `collectKegg()` の `TRIAGE_DEBUG_HTML` 生 HTML ダンプは削除した。
  `logKeggDiagnostics()` は残し、**承認行が 0 件のときだけ**先頭 5 つの `<tr>` のセルを出す。
- fixture `scripts/__tests__/fixtures/kegg.sample.html`（4 行: 乳がん関連の新しい 2 行 /
  乳がん以外の新しい 1 行 / 120 日より古い 1 行）で、件数・日付・D 番号・窓・タイトルをテストする。

#### 事実 2: oncolo.jp は GitHub Actions を遮断している

`/feed` `/feed/` `/?feed=rss2` `/news` のいずれも、ブラウザ完全一致の Chrome UA を付けても
`awselb/2.0` から **403 Forbidden**。Phase B で疑った User-Agent の問題ではなく **IP レベルの遮断**で、
ヘッダでは回避できない。

- **変更**: oncolo の収集器は残す（ローカル実行では取れる）が、`TRIAGE_DEBUG_HTML` の再試行ブロックは削除し、
  非 OK なら
  `⚠ oncolo.jp RSS: HTTP 403（GitHub Actions からは遮断されるため Google ニュースで代替）`
  と 1 行だけ警告して `[]` を返す。
- **新ソース `gnews`（Google ニュース RSS・日本語）**: データセンターからも取得できる。
  `GNEWS_QUERIES = ['乳がん 承認', '乳がん 申請 承認 薬', '乳がん 臨床試験 結果', '乳癌 新薬']` の
  各クエリで `https://news.google.com/rss/search?q=…&hl=ja&gl=JP&ceid=JP:ja` を叩き、
  `<item>` の title / link / pubDate / description / `<source>`（→ `meta.publisher`）を拾う。
  クエリ間の重複は記事リンク（`https://news.google.com/rss/articles/…`）で除き、
  `GNEWS_WINDOW_DAYS`（既定 30 日、export）以内のものだけを残す。
  タイトル末尾の ` - 媒体名` は落とす。`id = makeId('gnews', link)`。HTTP は同じ `fetchWithHeaders()`。
- `SOURCE_NAMES`（`triage-sources.mjs`）と `SOURCE_LABELS`（`jev.mjs`、
  `'Google ニュース（日本語、乳がん関連の検索結果）'`）に `gnews` を追加し、
  `SOURCE_PRIORITY`（`triage.mjs`）は **gnews → oncolo → kegg → openfda → ctgov** に変更した。
- `--offline` でも新ソースを通すため、`items.sample.json` に gnews を 2 件
  （accept 相当の国内承認ニュース / discard 相当の一般記事）と、対応する答えを
  `jev.answers.sample.json` に追加した（fixtures は 12 件 → 14 件）。

#### 運用面

`workflow_dispatch` の `collect_only` 入力（＝`node scripts/triage.mjs --collect-only`）は
Jev を呼ばずに収集結果だけをログに出すので、パーサを直したあとの確認はこれで行う。
運用ガイド（`docs/jev-triage.md`）にソース一覧・oncolo の 403・KEGG の窓・`collect_only` を追記した。

### 第3ラウンド（2026-09-20）実データでの最終調整

本番実行（125件、$0.010）の結果:
- gnews 19件 → accept 10（日本承認・適応拡大・安全性情報）/ review 6 / discard 3（凍結療法・市場レポートなど）。すべて妥当
- kegg 13件 → accept 1（カミゼストラント）/ discard 12（他領域の新薬）。すべて妥当
- openfda 13件 → review 13（効能追加の補足申請。適応内容が本文に無いため人の確認が必要）
- ctgov 80件 → accept 55（ランドスケープ候補）/ review 3 / discard 22

調整: FDA/EU 承認のニュースに Jev が impact 1.8〜2.0 を付けるため（ルーブリック「2: 海外承認」の少し下）、
`THRESHOLDS.impactAccept` を 2.0 → 1.8 に下げた。これで海外承認は accept、
薬価収載・申請などの参考情報（1.0〜1.8）は review のまま。
