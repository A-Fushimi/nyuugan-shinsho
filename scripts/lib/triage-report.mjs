/**
 * 乳がん新書 — トリアージ結果 → Markdown（GitHub Issue 本文）
 *
 * 純粋関数。accept / review が 0 件のときは null を返し、Issue を起票させない。
 * 設計書 docs/jev-triage-plan.md §8 に対応する。
 */

import { COST_PER_MILLION_INPUT_TOKENS } from './jev.mjs';

/** タグの表示名 */
const SUBTYPE_LABELS = {
  hr_pos: 'HR+/HER2-',
  her2_pos: 'HER2+',
  tnbc: 'TNBC',
  her2_low: 'HER2-low',
  multiple: '複数サブタイプ',
  unspecified: 'サブタイプ不明',
};

const SETTING_LABELS = {
  early: 'early',
  metastatic: 'metastatic',
  both: 'early+metastatic',
  unspecified: 'setting不明',
};

const SOURCE_LABELS = {
  oncolo: 'oncolo',
  kegg: 'KEGG',
  openfda: 'openFDA',
  ctgov: 'CT.gov',
};

function shortDate(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d || '');
  return `${Number(m[2])}/${Number(m[3])}`;
}

const num = (n, digits = 2) => (typeof n === 'number' ? n.toFixed(digits) : '—');

/** 1件の見出し行 */
function headLine(r) {
  const tags = r.tags || {};
  const sub = SUBTYPE_LABELS[tags.subtype] || tags.subtype || '—';
  const set = SETTING_LABELS[tags.setting] || tags.setting || '—';
  const src = SOURCE_LABELS[r.item?.source] || r.item?.source || '—';
  const moa = tags.moa && tags.moa !== 'none' ? `[${tags.moa}]` : '';
  const title = String(r.item?.title || '（無題）').replace(/\s+/g, ' ').trim();
  const url = r.item?.url ? ` ${r.item.url}` : '';
  return `- [${tags.category || 'other'}][${sub} / ${set}]${moa} ★${num(r.priority, 1)} ${title} (${src}, ${shortDate(r.item?.date)})${url}`;
}

/** 1件の指標行（Jev の生の数値） */
function metricsLine(r) {
  const a = r.answers || {};
  const parts = [
    `relevant ${num(a.relevant?.noul)}`,
    `impact ${num(a.impact?.score)}`,
    `category ${a.category?.choice ?? '—'} (conf ${num(a.category?.confidence)})`,
  ];
  if (typeof a.novel_agent?.noul === 'number') parts.push(`novel_agent ${num(a.novel_agent.noul)}`);
  return `    ${parts.join(' / ')}`;
}

function reasonsLine(r) {
  const reasons = (r.reasons || []).join(' / ');
  return reasons ? `    理由: ${reasons}` : '';
}

/** details で折りたたむ件数のしきい値（これを超えたら折りたたむ） */
export const DETAILS_THRESHOLD = 15;

/** ランドスケープ候補（CT.gov accept）の 1 行 */
function landscapeLine(r) {
  const item = r.item || {};
  const meta = item.meta || {};
  const title = String(item.title || '（無題）').replace(/\s+/g, ' ').trim();
  const parts = [];
  if (meta.phase) parts.push(meta.phase);
  if (meta.sponsor) parts.push(meta.sponsor);
  const novel = r.answers?.novel_agent?.noul;
  if (typeof novel === 'number') parts.push(`novel_agent ${num(novel)}`);
  const url = item.url ? ` ${item.url}` : '';
  return `- ${title}${parts.length ? ` — ${parts.join(' / ')}` : ''}${url}`;
}

/** 行の配列を、件数がしきい値を超えていれば details で包む */
function wrapDetails(lines, count, summary) {
  if (count <= DETAILS_THRESHOLD) return lines;
  return ['<details><summary>' + summary + '</summary>', '', ...lines, '', '</details>'];
}

/**
 * Markdown レポートを生成する。
 *
 * セクションの順序: 採用候補 → 要確認 → ランドスケープ候補 → 破棄。
 * CT.gov の accept は「採用候補」ではなく「ランドスケープ候補」にだけ出す
 * （早期相の試験が採用候補を埋め尽くして実ニュースが埋もれるのを防ぐ）。
 *
 * @param {Array<object>} results [{ item, answers, decision, priority, reasons, tags, usage }]
 * @param {{date?:string, model?:string, inputTokens?:number, costPerMillion?:number}} [meta]
 * @returns {string|null} accept + review が 0 件（かつ CT.gov accept も 0 件）なら null
 */
export function buildReport(results = [], meta = {}) {
  const byPriority = (a, b) => (b.priority || 0) - (a.priority || 0);
  const allAccepts = results.filter((r) => r.decision === 'accept');
  const accepts = allAccepts.filter((r) => r.item?.source !== 'ctgov').sort(byPriority);
  const landscape = allAccepts.filter((r) => r.item?.source === 'ctgov').sort(byPriority);
  const reviews = results.filter((r) => r.decision === 'review').sort(byPriority);
  const discards = results.filter((r) => r.decision === 'discard');

  if (accepts.length + reviews.length === 0 && landscape.length === 0) return null;

  const date = meta.date || new Date().toISOString().split('T')[0];
  const lines = [`# 📥 情報トリアージ結果 (${date})`, ''];

  // ── 🔴 採用候補（CT.gov 以外）──
  lines.push(`## 🔴 採用候補（accept, ${accepts.length}件）— 優先度順`, '');
  if (accepts.length === 0) {
    lines.push('（なし）', '');
  } else {
    for (const r of accepts) {
      lines.push(headLine(r), metricsLine(r));
    }
    lines.push('');
  }

  // ── 🟡 要確認（ソース別）──
  lines.push(`## 🟡 要確認（review, ${reviews.length}件）`, '');
  if (reviews.length === 0) {
    lines.push('（なし）', '');
  } else {
    const groups = new Map();
    for (const r of reviews) {
      const src = r.item?.source || 'other';
      if (!groups.has(src)) groups.set(src, []);
      groups.get(src).push(r);
    }
    for (const [src, group] of groups) {
      const label = SOURCE_LABELS[src] || src;
      const body = [];
      for (const r of group) {
        body.push(headLine(r), metricsLine(r));
        const rl = reasonsLine(r);
        if (rl) body.push(rl);
      }
      lines.push(`### ${label}（${group.length}件）`, '');
      lines.push(...wrapDetails(body, group.length, `${label} の ${group.length}件`));
      lines.push('');
    }
  }

  // ── 🧪 ランドスケープ候補（CT.gov accept）──
  lines.push(
    `## 🧪 ランドスケープ候補（CT.gov 新規作用機序の試験, ${landscape.length}件）`,
    ''
  );
  if (landscape.length === 0) {
    lines.push('（なし）', '');
  } else {
    const moaGroups = new Map();
    for (const r of landscape) {
      const moa = r.tags?.moa && r.tags.moa !== 'none' ? r.tags.moa : 'その他';
      if (!moaGroups.has(moa)) moaGroups.set(moa, []);
      moaGroups.get(moa).push(r);
    }
    const body = [];
    for (const [moa, group] of [...moaGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      body.push(`**${moa}**（${group.length}件）`, '');
      for (const r of group) body.push(landscapeLine(r));
      body.push('');
    }
    lines.push(
      ...wrapDetails(body, landscape.length, `ランドスケープ候補 ${landscape.length}件（作用機序別）`)
    );
    lines.push('');
  }

  // ── ⚪ 破棄 ──
  lines.push(`## ⚪ 破棄（${discards.length}件）`, '');
  if (discards.length === 0) {
    lines.push('（なし）', '');
  } else {
    lines.push('<details><summary>破棄した情報の一覧</summary>', '');
    for (const r of discards) {
      const title = String(r.item?.title || '（無題）').replace(/\s+/g, ' ').trim();
      lines.push(`- ${title} — ${(r.reasons || []).join(' / ')}`);
    }
    lines.push('', '</details>', '');
  }

  const inputTokens = meta.inputTokens || 0;
  const perMillion = meta.costPerMillion ?? COST_PER_MILLION_INPUT_TOKENS;
  const cost = (inputTokens / 1_000_000) * perMillion;
  lines.push(
    '---',
    '',
    `Jev model: ${meta.model || '—'} / 判定数 ${results.length}件 / 入力トークン ${inputTokens.toLocaleString('en-US')} / 概算コスト $${cost.toFixed(4)}（$${perMillion}/1M 入力トークン）`,
    '',
    '*このIssueは `scripts/triage.mjs` により自動生成されました。accept でも内容を確認してから events.json / changelog.json に反映してください。*'
  );

  return lines.join('\n');
}

export default { buildReport };
