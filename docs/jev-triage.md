# Jev 情報トリアージ 運用ガイド

対象: `scripts/triage.mjs` と `scripts/lib/*`（設計は [jev-triage-plan.md](./jev-triage-plan.md)）

oncolo.jp RSS / KEGG 新薬承認 / openFDA / ClinicalTrials.gov から流入する情報を、
TypeSafe AI の System One モデル **Jev** に型付きで判定させ、
**採用（accept） / 要確認（review） / 破棄（discard）** に振り分けて GitHub Issue にまとめる。

Jev は文章を生成しない。定義済みの質問に対して確率付きの型付きの答えを返すだけなので、
「正しいかどうか」は保証されない。**accept でも必ず人が確認してから** `events.json` /
`changelog.json` に反映すること。

---

## 1. セットアップ（TYPESAFE_API_KEY）

1. TypeSafe AI のダッシュボードで API キーを発行する。
2. GitHub リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で
   - Name: `TYPESAFE_API_KEY`
   - Secret: 発行したキー
   を登録する。`.github/workflows/update-data.yml` の `triage` ジョブがこれを環境変数として渡す。
3. ローカルで本番実行する場合はシェルの環境変数に入れる（`.env` やコードには書かない）。

```bash
export TYPESAFE_API_KEY="sk-..."
```

補助的な環境変数（通常は不要）:

| 変数 | 既定値 | 用途 |
|---|---|---|
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | エンドポイントの差し替え |
| `TYPESAFE_DEFAULT_MODEL` | `jev-latest` | モデルを固定したいとき（例: `jev-1.2`） |
| `TYPESAFE_LOG_LEVEL` | `warn` | `info` / `debug` で SDK のリクエストログ。`debug` は state 全文を出すので取り扱い注意 |

API キーが未設定でオンラインモードのときは、**警告を出して exit 0** する（収集も判定も行わず、
ファイルも Issue も作らない）。CI が赤くならないのは意図的な挙動。

---

## 2. 実行モード

```bash
# 本番（TYPESAFE_API_KEY 必須）: data/triage/<date>.json・seen.json・.github/triage-result.md を書く
npm run triage

# 書き込みなし。レポートを標準出力に出すだけ
node scripts/triage.mjs --dry-run

# ネットワークも Jev も使わず、fixtures だけで全経路を通す（動作確認・CI 用）
node scripts/triage.mjs --offline --dry-run

# ソースを限定（oncolo / kegg / openfda / ctgov）
node scripts/triage.mjs --source=oncolo,kegg

# 判定件数の上限（コスト暴走防止。既定 200 件）
node scripts/triage.mjs --limit=50

# CT.gov だけの上限（既定 80 件）。--limit より先に適用される
node scripts/triage.mjs --ctgov-limit=30

# テスト
npm test
```

### ソースの優先順位と上限

判定は **oncolo → KEGG → openFDA → CT.gov** の順に行う。
CT.gov は登録数が桁違いに多く（初回実行では 485 件 / 全 516 件）、
放っておくと `--limit` を CT.gov だけで使い切ってしまうため、

1. まず `--ctgov-limit`（既定 80）で CT.gov を絞る
2. 次にソース優先順で並べ、`--limit`（既定 200）で全体を切る

という二段構えにしてある。あふれた分は持ち越しとしてソース別の件数がログに出る
（`⚠ 上限（全体 200件 / ctgov 80件）を超えたため … ctgov 405件`）。
並べ替えと上限の適用は `scripts/triage.mjs` の `orderAndCap()`（純粋関数、テスト済み）。

### 取得時の HTTP ヘッダ

oncolo / KEGG / openFDA への取得はすべて `fetchWithHeaders()`（`triage-sources.mjs`）を通し、
ブラウザに近い `User-Agent` / `Accept` / `Accept-Language` を付ける。
既定の Node fetch の UA では oncolo.jp が GitHub Actions ランナーから **HTTP 403** を返した。

### openFDA の事前フィルタ

openFDA の submission は大半が Labeling / Manufacturing (CMC) / REMS などの一部変更で、
臨床的な意味がない。`isMeaningfulSubmissionClass()` が
`submission_class_code` / `submission_class_code_description` を見て、

- 残す: `EFFICACY`、`Efficacy…`、`New Indication`、`Original`、`TYPE 1`〜`TYPE 10`、区分が空のもの
- 落とす: `LABELING`、`MANUFACTURING (CMC)`、`REMS`、`BIOEQUIV`、`MEDGUIDE` など

さらに **同一ブランド・同一日** の複数 SUPPL は 1 件にまとめ、
body に全 submission 番号（`SUPPL #41 (Efficacy) / SUPPL #43 (Efficacy-New Indication)`）と
`class:` 行を、`meta.submissionClass` に区分の説明を入れる。

### KEGG パーサ

- 日付を含み、かつ **日付以外に 8 文字以上（英字・かな・漢字を含む）** の中身がある行だけを拾う
  （`2025/12/22` のような日付だけの行と `Last updated: …` は落とす）
- BRITE の `/entry/Dxxxxx` へのリンクからも項目を作る（アンカー文字列＋その行）
- 抽出が 3 件未満のときだけ、総行数と `乳` / `/entry/D` / `承認` を含む行を最大 15 行
  （各 160 字）標準出力に出す。次回の CI ログでページ構造を確かめるための診断で、書き込みはしない

- 判定は **1 アイテム = 1 リクエスト**、**4 並列**。HTTP のリトライ（408/429/5xx）は SDK 内蔵。
- 1 件が例外で落ちても全体は止まらず、その件は `review` ＋ `reasons: ["Jev error: …"]` になる。
- `data/triage/seen.json` に載っている ID は再判定も再掲もしない。`review` も同じで、
  一度 Issue に出たものは次回以降は出ない（Issue 側で追うため）。
  もう一度出したいときは `seen.json` から該当 ID を削除する。

### 出力ファイル

| パス | 内容 |
|---|---|
| `data/triage/<YYYY-MM-DD>.json` | その回の全判定（item / answers / decision / priority / reasons / tags / usage）。**生の answers を残してある**ので、しきい値を変えても再推論せず再計算できる |
| `data/triage/seen.json` | `{ "<id>": { "decision", "date" } }`。discard も含めて再通知を防ぐ |
| `.github/triage-result.md` | Issue 本文。accept + review が 1 件以上、または CT.gov の accept が 1 件以上のときだけ生成される。セクションは 🔴 採用候補 → 🟡 要確認 → 🧪 ランドスケープ候補 → ⚪ 破棄 の順 |

---

## 3. しきい値（THRESHOLDS）の調整

すべて `scripts/lib/triage-policy.mjs` の `THRESHOLDS` に集約してある。

```js
export const THRESHOLDS = {
  relevantLow: 0.35,        // これ未満は破棄
  relevantHigh: 0.65,       // これ以上で「乳がん薬物療法に関係あり」と確定
  impactAccept: 2.0,        // これ以上で採用
  impactReview: 1.0,        // これ以上で要確認（未満は破棄）
  categoryConfidence: 0.5,  // これ未満の accept は要確認に格下げ
  novelLow: 0.35,           // ctgov: これ未満は破棄（既存化療・支持療法）
  novelHigh: 0.65,          // ctgov: これ以上で新薬候補と確定
};
```

調整の手順:

1. `data/triage/<date>.json` を開き、accept/review/discard それぞれの `answers` の分布を見る。
   - 取りこぼし（discard に重要なものが混じる）が多い → `impactAccept` や `relevantLow` を下げる
   - ノイズ（accept にどうでもいいものが混じる）が多い → `impactAccept` を上げる
   - review が多すぎる → `relevantHigh` を下げる、`categoryConfidence` を下げる
2. `THRESHOLDS` を書き換える。
3. **再推論は不要**。保存済みの `answers` に `decide()` を掛け直せば新しい決定が得られる。
   ```bash
   node -e "const {decide}=await import('./scripts/lib/triage-policy.mjs');\
     const rs=JSON.parse(require('fs').readFileSync('data/triage/2026-09-20.json'));\
     for (const r of rs) console.log(decide(r.item, r.answers).decision, r.item.title);"
   ```
4. `scripts/__tests__/triage-policy.test.mjs` の境界値テストも合わせて更新し、`npm test` を通す。

`noul` の 0.5 付近は「yes/no が半々」であって「中くらい」ではない。
中間値は「迷っている」と読み、しきい値ではなく review に流すのが安全。

---

## 4. 質問（questions）の変え方

質問の定義は `scripts/lib/jev.mjs` の `BASE_QUESTIONS`（全ソース共通）と
`CTGOV_QUESTIONS`（ClinicalTrials.gov 専用）にある。

- **質問名（キー）はモデルに渡らない**。意味は `instructions` と `criteria` に全部書く。
- 1 質問 = 1 つの狭い判断。観点が増えたら質問を足す（質問は並列・独立に評価され、
  互いの答えは見えない）。
- choice には必ず「該当なし」にあたる選択肢を置く（`other` / `unspecified` / `none`）。
- `moa` の選択肢は `scripts/landscape_to_json.py` の `MOA_KEYWORDS` のキーと揃えてある。
  片方を変えたらもう片方も合わせること。
- 質問を足したら、`triage-policy.mjs` で使うかどうか、`triage-report.mjs` に出すかどうかを決め、
  `scripts/__tests__/fixtures/jev.answers.sample.json` にもその答えを足す（`--offline` が通らなくなる）。

state に載せる情報は `buildState()`（`jev.mjs`）。本文は 2000 字で切っている。
`known_drugs_in_site` は「サイトに既収録の薬か」という文脈を与えるためのもので、
既知薬かどうかの判定自体はコード（`scripts/lib/known-drugs.mjs`）が行う。

---

## 5. コスト

- 単価は **入力 100 万トークンあたり $0.042**（`COST_PER_MILLION_INPUT_TOKENS`）。
- 1 件あたりの state + 質問はおよそ 700〜1,400 入力トークンなので、**約 $0.0004 / 判定**。
- 週次で 100 件判定しても **約 $0.04 / 週**、年間で $2 程度。
- `--limit`（既定 200）が 1 回あたりの上限。想定外の流入があっても
  1 回 $0.1 を超えないようになっている。`--ctgov-limit`（既定 80）はその内訳の上限。
- 実測: 初回実行（2026-09-20、200 件、jev-1.13.0）で **$0.018**。
- 実測値は毎回のレポート末尾（`入力トークン … / 概算コスト …`）と
  `data/triage/<date>.json` の `usage` に残る。

---

## 6. GitHub Actions

`.github/workflows/update-data.yml` の `triage` ジョブ。

- 起動: 毎週水曜 UTC 1:00（`0 1 * * 3`）の cron、または `workflow_dispatch` で
  `task` に `triage` か `both` を選ぶ。
- `workflow_dispatch` には **`dry_run`（boolean、既定 false）** がある。
  `true` にすると `node scripts/triage.mjs --dry-run` で走り、
  **コミットも Issue 起票もしない**（ログでレポートを確認するだけ）。
  しきい値や収集を変えたあとの確認に使う。
- `node scripts/triage.mjs` を `TYPESAFE_API_KEY` 付きで実行。
- `data/triage/` に変更（新規ファイル含む）があればコミット＆プッシュ（dry_run のときはスキップ）。
- `.github/triage-result.md` があれば `gh issue create` で
  「📥 情報トリアージ YYYY-MM-DD」という Issue を起票する（dry_run のときはスキップ）。

---

## 7. 結果を events.json / changelog.json に反映する（手作業）

トリアージは**編集者への提案**であって、自動反映はしない。手順:

1. Issue「📥 情報トリアージ」を開く。
2. 🔴 **採用候補** を上から確認する。`★` は impact スコア（優先度）。
   ここには **CT.gov 以外**（oncolo / KEGG / openFDA）の accept だけが優先度順に並ぶ。
   - 一次情報（プレスリリース、PMDA / FDA、学会抄録、ClinicalTrials.gov）にあたって裏を取る。
3. 裏が取れたものを手で反映する。
   - 承認・申請・試験結果などの出来事 → `src/data/events.json` に 1 件追加
     （日付・薬剤・種別・出典 URL を既存エントリの書式に合わせる）。
   - サイトの記載を書き換えたら → `src/data/changelog.json` に更新内容を 1 行追加。
   - 開発品そのものが新規なら `src/data/drugs.json` / `timeline.json` 側の追加を検討する
     （`scripts/landscape_*.py` の出力と突き合わせる）。
4. 🟡 **要確認** は判断が割れたもの。ソース別に並ぶ（1 ソースで 15 件を超えると `<details>` に畳まれる）。
   反映するか捨てるかを人が決める。
   捨てる場合は何もしなくてよい（`seen.json` に記録済みなので再掲されない）。
5. 🧪 **ランドスケープ候補** は CT.gov の accept（新規作用機序の試験）。作用機序（`moa`）ごとに
   件数付きでまとめてある（15 件を超えると `<details>`）。各行は タイトル / phase / sponsor /
   NCT リンク / `novel_agent` の確率。ここは「今すぐ events.json に書くもの」ではなく、
   `src/data/drugs.json` / `timeline.json` の開発品リストを見直すための材料として使う。
6. ⚪ **破棄** は `<details>` の中。取りこぼしがないか流し読みし、
   誤って捨てられていたらしきい値か質問文を直す（§3・§4）。
7. 反映が終わったら Issue を閉じる。

> 注意: Jev の答えは「型が保証される」だけで、内容の真偽は保証されない。
> 出典を確認せずに events.json へ書かないこと。
