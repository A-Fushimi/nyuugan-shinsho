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

/**
 * Markdown レポートを生成する。
 *
 * @param {Array<object>} results [{ item, answers, decision, priority, reasons, tags, usage }]
 * @param {{date?:string, model?:string, inputTokens?:number, costPerMillion?:number}} [meta]
 * @returns {string|null} accept + review が 0 件なら null
 */
export function buildReport(results = [], meta = {}) {
  const accepts = results
    .filter((r) => r.decision === 'accept')
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const reviews = results
    .filter((r) => r.decision === 'review')
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const discards = results.filter((r) => r.decision === 'discard');

  if (accepts.length + reviews.length === 0) return null;

  const date = meta.date || new Date().toISOString().split('T')[0];
  const lines = [`# 📥 情報トリアージ結果 (${date})`, ''];

  lines.push(`## 🔴 採用候補（accept, ${accepts.length}件）— 優先度順`, '');
  if (accepts.length === 0) {
    lines.push('（なし）', '');
  } else {
    for (const r of accepts) {
      lines.push(headLine(r), metricsLine(r));
    }
    lines.push('');
  }

  lines.push(`## 🟡 要確認（review, ${reviews.length}件）`, '');
  if (reviews.length === 0) {
    lines.push('（なし）', '');
  } else {
    for (const r of reviews) {
      lines.push(headLine(r), metricsLine(r));
      const rl = reasonsLine(r);
      if (rl) lines.push(rl);
    }
    lines.push('');
  }

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
