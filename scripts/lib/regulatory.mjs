/**
 * 乳がん新書 — FDA 承認記録と drugs.json の突き合わせ
 *
 * `scripts/check-regulatory.mjs` の判定部分。副作用を持たない純関数だけを置き、
 * 取得（openFDA へのアクセス）と書き込みは呼び出し側で行う。
 *
 * ここでの問いは「サイトの米国ステータスに、この承認が書かれているか」であって、
 * 「このニュースは重要か」ではない。後者は scripts/triage.mjs（Jev 判定）の担当。
 */

/** 一度報告した承認を再び出さないための状態ファイル */
export const SEEN_PATH = 'data/regulatory/seen.json';

/**
 * その薬について、サイトが持っている米国ステータスの文字列をすべて集める。
 *
 * 適応ごとの表を持つ薬（indications あり）は上位の `us.t` が空文字なので、
 * ここを見落とすと「サイトに何も書かれていない」と誤判定し、
 * 同じ承認を毎週報告し続けることになる。
 */
export function siteUsStatusTexts(drug) {
  if (!drug) return [];
  const texts = [drug.us?.t];
  for (const ind of drug.indications || []) {
    texts.push(ind.us?.t);
  }
  return texts.map((t) => String(t || '')).filter(Boolean);
}

/**
 * ISO 日付（YYYY-MM-DD）を、サイト本文で使われる年月の表記ゆれに展開する。
 * 日まで一致させると「発表日」と「FDA の action date」が数日ずれた時に取りこぼすので、年月で見る。
 */
export function yearMonthTokens(isoDate) {
  const m = /^(\d{4})-(\d{2})/.exec(String(isoDate || ''));
  if (!m) return [];
  const [, year, mm] = m;
  const short = String(Number(mm));
  return [
    `${year}/${mm}`,
    `${year}/${short}`,
    `${year}-${mm}`,
    `${year}-${short}`,
    `${year}年${mm}月`,
    `${year}年${short}月`,
  ];
}

/** その承認がすでにサイトの米国ステータスに書かれているか */
export function isReflectedInSite(drug, isoDate) {
  const tokens = yearMonthTokens(isoDate);
  if (tokens.length === 0) return false;
  const texts = siteUsStatusTexts(drug);
  return texts.some((text) => tokens.some((token) => text.includes(token)));
}

/**
 * openFDA の承認レコード（triage-sources の openfda アイテム）から、報告すべきものを選ぶ。
 *
 * 除外するのは次の2つ。
 *   1. すでに seen.json にある（前回までに報告済み、または反映済みと判定済み）
 *   2. drugs.json の米国ステータスに同じ年月が書かれている（＝反映済み）
 *
 * @returns {{findings: Array, seen: Object, skipped: {seen: number, reflected: number}}}
 *   seen は入力を破壊しない新しいオブジェクト。
 */
export function selectFindings({ items = [], drugs = [], seen = {}, today }) {
  const byGeneric = new Map(drugs.map((d) => [d.generic, d]));
  const nextSeen = { ...seen };
  const findings = [];
  const skipped = { seen: 0, reflected: 0 };

  for (const item of items) {
    if (!item?.id) continue;
    if (nextSeen[item.id]) {
      skipped.seen += 1;
      continue;
    }
    const generic = item.meta?.generic || '';
    const drug = byGeneric.get(generic);
    if (isReflectedInSite(drug, item.date)) {
      nextSeen[item.id] = { decision: 'reflected', date: today };
      skipped.reflected += 1;
      continue;
    }
    nextSeen[item.id] = { decision: 'reported', date: today };
    findings.push({
      id: item.id,
      generic,
      brand: item.meta?.brand || '',
      approvalDate: item.date,
      submissions: item.meta?.submissions || [],
      submissionClass: item.meta?.submissionClass || '',
      url: item.url || '',
      siteStatus: siteUsStatusTexts(drug).join(' / '),
      known: Boolean(drug),
    });
  }

  findings.sort((a, b) => String(b.approvalDate).localeCompare(String(a.approvalDate)));
  return { findings, seen: nextSeen, skipped };
}

/** Markdown の表を壊さないように整える（サイト本文は自由記述なので `|` が入りうる） */
function escapeCell(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
}

/** GitHub Issue の本文。findings が空なら null（＝Issue を立てない） */
export function buildIssueBody(findings, today) {
  if (!findings || findings.length === 0) return null;
  const lines = [
    `# FDA 承認記録とサイトの突き合わせ (${today})`,
    '',
    `openFDA の承認レコードのうち、\`src/data/drugs.json\` の米国ステータスに`,
    `まだ書かれていないものが ${findings.length}件 見つかりました。確認・反映をお願いします。`,
    '',
    '| 承認日 | 一般名 | ブランド | submission | 区分 | サイトの現状 |',
    '|---|---|---|---|---|---|',
  ];
  for (const f of findings) {
    const subs = escapeCell(f.submissions.join(', ')) || '—';
    const cls = escapeCell(f.submissionClass) || '—';
    const site = f.known
      ? escapeCell(f.siteStatus) || '（米国ステータスの記載なし）'
      : '⚠ drugs.json に未収録';
    const brand = f.url ? `[${escapeCell(f.brand)}](${f.url})` : escapeCell(f.brand);
    lines.push(`| ${f.approvalDate} | ${escapeCell(f.generic)} | ${brand} | ${subs} | ${cls} | ${site} |`);
  }
  lines.push(
    '',
    '---',
    `*\`scripts/check-regulatory.mjs\` が自動作成。一度報告した承認は \`${SEEN_PATH}\` に記録し、次回以降は報告しません。*`
  );
  return lines.join('\n');
}
