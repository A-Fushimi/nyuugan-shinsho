# FDA 承認チェック 運用ガイド

対象: `scripts/check-regulatory.mjs` と `scripts/lib/regulatory.mjs`

openFDA の承認レコードを取り、**`src/data/drugs.json` の米国ステータスにまだ書かれていないもの**
だけを GitHub Issue にまとめる。サイトのデータと FDA の記録がずれていないかを見る突き合わせで、
「このニュースは重要か」を判定する [Jev 情報トリアージ](./jev-triage.md) とは役割が違う。

---

## 1. 同じ承認を二度報告しない仕組み

報告するかどうかは 3 段階で絞る。

1. **期間と区分** — 収集は `scripts/lib/triage-sources.mjs` と共用で、
   直近 180 日（`OPENFDA_WINDOW_DAYS`）以内かつ臨床的に意味のある submission class
   （`isMeaningfulSubmissionClass`）のレコードだけが候補になる。
   Labeling / Manufacturing (CMC) / REMS などの一部変更や、何年も前の承認はここで落ちる。
2. **サイトへの反映** — 承認日の**年月**が `drugs.json` の米国ステータス文字列に含まれていれば反映済みとみなす。
   適応ごとの表を持つ薬は上位の `us.t` が空文字なので、`indications[].us.t` も見る
   （ここを見落としていたのが、同じ承認を毎週報告し続けていた原因）。
   日ではなく年月で見るのは、発表日と FDA の action date が数日ずれることがあるため。
3. **報告済み記録** — 1 と 2 を通った（＝報告した）承認と、2 で反映済みと判定した承認の両方を
   `data/regulatory/seen.json` に記録する。以後は照合せず読み飛ばす。

```json
{
  "openfda:3d7640de01141279": { "decision": "reported", "date": "2026-09-23" },
  "openfda:4cef872e36cad88d": { "decision": "reflected", "date": "2026-09-23" }
}
```

ID は `triage-sources.mjs` の `makeId()`（application 番号・ブランド・承認日・submission 番号の sha1）で、
実行のたびに同じ値になる。

**報告すべき承認が 0 件なら `.github/regulatory-check-result.md` を書かない**ので、Issue も起票されない。

`seen.json` を消せば、窓の中の承認をもう一度ゼロから照合し直せる。

---

## 2. 実行モード

```bash
# 本番: data/regulatory/seen.json と .github/regulatory-check-result.md を書く
npm run check-regulatory

# 取得と判定はするが、何も書かない（Issue 本文を標準出力で確認するだけ）
node scripts/check-regulatory.mjs --dry-run

# テスト
npm test
```

---

## 3. GitHub Actions

`.github/workflows/update-data.yml` の `check-regulatory` ジョブ。

- 起動: 毎週水曜 UTC 1:00（`0 1 * * 3`）の cron、または `workflow_dispatch` で
  `task` に `regulatory` か `both` を選ぶ。
- `data/regulatory/` に変更があればコミット＆プッシュ。**この記録が残らないと毎週同じ Issue が立つ。**
- `.github/regulatory-check-result.md` があれば `gh issue create` で
  「🏛 FDA承認とサイトの差分 YYYY-MM-DD」という Issue を起票する。
- `triage` ジョブと同じ水曜に走り、どちらも main に push するので、
  `concurrency: data-push-<ref>` で直列化している。

---

## 4. Issue が来たら

表の「サイトの現状」列に、その薬について `drugs.json` が今持っている米国ステータスが出る。
FDA の承認内容を一次情報（Drugs@FDA のリンクが表に入っている）で確認したうえで、
`src/data/drugs.json` の `us`（適応ごとの表がある薬は `indications[].us`）を直し、
必要なら `src/data/events.json` / `changelog.json` にも反映して Issue を閉じる。

一度報告した承認は記録されるので、**Issue を閉じても再び立つことはない**。
逆に言えば、直し忘れたまま閉じると次からは出てこない。
