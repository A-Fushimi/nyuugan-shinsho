#!/usr/bin/env node
/**
 * 乳がん新書 — Jev 情報トリアージ
 *
 * 収集（oncolo/KEGG/openFDA/CT.gov）→ 正規化 → 既知チェック → Jev 判定 → 方針 → 出力。
 * 設計書: docs/jev-triage-plan.md / 運用: docs/jev-triage.md
 *
 * Usage:
 *   node scripts/triage.mjs                       # 本番実行（TYPESAFE_API_KEY 必須）
 *   node scripts/triage.mjs --dry-run             # 書き込みなし、レポートを標準出力へ
 *   node scripts/triage.mjs --offline --dry-run   # ネットワーク/Jev を使わず fixtures で全経路を通す
 *   node scripts/triage.mjs --source=oncolo,kegg  # ソース限定
 *   node scripts/triage.mjs --collect-only     # 収集結果だけを表示（Jev は呼ばない）
 *   node scripts/triage.mjs --limit=50            # 判定件数の上限（既定 200）
 *   node scripts/triage.mjs --ctgov-limit=30      # CT.gov だけの上限（既定 80、--limit より先に適用）
 *
 * 判定するソースの順序は oncolo → kegg → openfda → ctgov。
 * CT.gov は件数が桁違いに多いので、先に --ctgov-limit で絞ってから全体の --limit を掛ける。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { createJevClient, judgeItem, COST_PER_MILLION_INPUT_TOKENS } from './lib/jev.mjs';
import { decide } from './lib/triage-policy.mjs';
import { buildReport } from './lib/triage-report.mjs';
import { collect, SOURCE_NAMES } from './lib/triage-sources.mjs';
import { loadKnownDrugs } from './lib/known-drugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', ...p);

const DEFAULT_LIMIT = 200;
const DEFAULT_CTGOV_LIMIT = 80;
const CONCURRENCY = 4;

/** 判定する順序。CT.gov は最後（数が多く、埋もれさせないため） */
export const SOURCE_PRIORITY = ['oncolo', 'kegg', 'openfda', 'ctgov'];

// ── CLI 引数 ──

function parseArgs(argv) {
  const opts = {
    dryRun: argv.includes('--dry-run'),
    offline: argv.includes('--offline'),
    collectOnly: argv.includes('--collect-only'),
    sources: SOURCE_NAMES,
    limit: DEFAULT_LIMIT,
    ctgovLimit: DEFAULT_CTGOV_LIMIT,
  };
  const src = argv.find((a) => a.startsWith('--source='));
  if (src) {
    opts.sources = src
      .slice('--source='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const lim = argv.find((a) => a.startsWith('--limit='));
  if (lim) {
    const n = Number.parseInt(lim.slice('--limit='.length), 10);
    if (Number.isFinite(n) && n > 0) opts.limit = n;
  }
  const clim = argv.find((a) => a.startsWith('--ctgov-limit='));
  if (clim) {
    const n = Number.parseInt(clim.slice('--ctgov-limit='.length), 10);
    if (Number.isFinite(n) && n >= 0) opts.ctgovLimit = n;
  }
  return opts;
}

// ── ソース優先度と上限（純粋関数） ──

/**
 * ソース別の上限を掛けたうえで SOURCE_PRIORITY の順に並べ、最後に全体の上限で切る。
 *
 * @param {Array<{source:string}>} items
 * @param {{limit?:number, caps?:Record<string,number>, order?:string[]}} opts
 * @returns {{targets:Array, carry:Array, carryBySource:Record<string,number>}}
 */
export function orderAndCap(items = [], { limit = Infinity, caps = {}, order = SOURCE_PRIORITY } = {}) {
  const bySource = new Map();
  for (const it of items) {
    const key = it?.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(it);
  }
  // 既知の順序 → それ以外は出現順
  const names = [
    ...order.filter((n) => bySource.has(n)),
    ...[...bySource.keys()].filter((n) => !order.includes(n)),
  ];

  const carry = [];
  const carryBySource = {};
  const bump = (name, n) => {
    if (n > 0) carryBySource[name] = (carryBySource[name] || 0) + n;
  };

  const ordered = [];
  for (const name of names) {
    const group = bySource.get(name);
    const cap = Number.isFinite(caps[name]) ? Math.max(0, caps[name]) : Infinity;
    const kept = group.slice(0, cap);
    const dropped = group.slice(cap);
    ordered.push(...kept);
    carry.push(...dropped);
    bump(name, dropped.length);
  }

  const max = Number.isFinite(limit) ? Math.max(0, limit) : ordered.length;
  const targets = ordered.slice(0, max);
  for (const it of ordered.slice(max)) {
    carry.push(it);
    bump(it?.source || 'unknown', 1);
  }

  return { targets, carry, carryBySource };
}

// ── seen.json ──

const SEEN_PATH = resolve('data/triage/seen.json');

function loadSeen() {
  try {
    if (!existsSync(SEEN_PATH)) return {};
    return JSON.parse(readFileSync(SEEN_PATH, 'utf-8')) || {};
  } catch (e) {
    console.warn(`  ⚠ seen.json を読めませんでした (${e.message})。空として扱います`);
    return {};
  }
}

// ── 並列実行プール ──

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// ── 判定 ──

/** --offline 用: fixtures の固定 answers を返す */
function offlineJudge(fixtures, item) {
  const rec = fixtures[item.id];
  if (!rec) throw new Error(`fixtures に ${item.id} の答えがありません`);
  return {
    model: rec.model || 'jev-offline-fixture',
    answers: rec.answers || {},
    usage: rec.usage || { input_tokens: 0, output_tokens: 0 },
  };
}

function errorResult(item, message) {
  return {
    item,
    answers: {},
    decision: 'review',
    priority: 0,
    reasons: [`Jev error: ${message}`],
    tags: { category: 'other', subtype: 'unspecified', setting: 'unspecified' },
    usage: { input_tokens: 0, output_tokens: 0 },
    model: null,
  };
}

// ── main ──

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().split('T')[0];

  console.log('\n📥 乳がん新書 — Jev 情報トリアージ');
  console.log(
    `   モード: ${opts.offline ? '🧪 OFFLINE（fixtures）' : '🌐 オンライン'} / ${opts.dryRun ? '🔍 DRY RUN' : '✏️  本番実行'}`
  );
  console.log(
    `   ソース: ${opts.sources.join(', ')} / 上限: ${opts.limit}件 (ctgov ${opts.ctgovLimit}件)`
  );
  console.log(`   日時: ${new Date().toISOString()}\n`);

  // ── Jev クライアント（API キーが無ければ収集する前に終了）──
  let fixtures = null;
  let client = null;
  if (opts.offline) {
    fixtures = JSON.parse(
      readFileSync(resolve('scripts/__tests__/fixtures/jev.answers.sample.json'), 'utf-8')
    );
  } else {
    client = createJevClient();
    if (!client) {
      console.warn('⚠ TYPESAFE_API_KEY が設定されていません。判定をスキップして終了します（Issue も作成しません）');
      console.warn('  オフラインで動作確認する場合は --offline を付けてください\n');
      return;
    }
  }

  // ── 収集 ──
  const knownDrugs = loadKnownDrugs();
  console.log(`🔎 収集...`);
  let items;
  if (opts.offline) {
    items = JSON.parse(readFileSync(resolve('scripts/__tests__/fixtures/items.sample.json'), 'utf-8'));
    for (const name of opts.sources) {
      console.log(`  - ${name}: ${items.filter((i) => i.source === name).length}件（fixtures）`);
    }
  } else {
    items = await collect({ sources: opts.sources, knownDrugs });
  }
  items = items.filter((i) => opts.sources.includes(i.source));
  console.log(`  合計 ${items.length}件\n`);

  // ── 既知チェック（重複除外）──
  const seen = loadSeen();
  if (opts.collectOnly) {
    // 収集結果の確認用（Jev は呼ばない）。ソース別に先頭 12 件のタイトル・日付・本文冒頭を出す
    for (const name of opts.sources) {
      const its = items.filter((i) => i.source === name);
      console.log(`\n── ${name}: ${its.length}件（先頭12件） ──`);
      for (const it of its.slice(0, 12)) {
        console.log(`  [${it.date || '----'}] ${String(it.title).slice(0, 120)}`);
        const body = String(it.body || '').replace(/\s+/g, ' ').slice(0, 160);
        if (body && body !== it.title) console.log(`      ${body}`);
      }
    }
    console.log('\n✅ 完了（COLLECT ONLY）\n');
    return;
  }

  const fresh = items.filter((i) => !seen[i.id]);
  const skipped = items.length - fresh.length;
  if (skipped > 0) console.log(`⏭  判定済みのため除外: ${skipped}件`);

  const { targets, carry, carryBySource } = orderAndCap(fresh, {
    limit: opts.limit,
    caps: { ctgov: opts.ctgovLimit },
  });
  if (carry.length > 0) {
    const detail = Object.entries(carryBySource)
      .map(([name, n]) => `${name} ${n}件`)
      .join(' / ');
    console.log(
      `⚠ 上限（全体 ${opts.limit}件 / ctgov ${opts.ctgovLimit}件）を超えたため ${carry.length}件は次回に持ち越します: ${detail}`
    );
  }
  if (targets.length === 0) {
    console.log('\n✅ 新規の判定対象はありません\n');
    return;
  }
  console.log(`🧠 Jev 判定: ${targets.length}件（並列 ${CONCURRENCY}）\n`);

  // ── Jev 判定 ──
  const results = await mapPool(targets, CONCURRENCY, async (item) => {
    try {
      const { model, answers, usage } = opts.offline
        ? offlineJudge(fixtures, item)
        : await judgeItem(client, item);
      const d = decide(item, answers);
      return { item, answers, ...d, usage, model };
    } catch (e) {
      // 1件の失敗でパイプラインを止めない（要確認に回す）
      console.warn(`  ⚠ ${item.id}: ${e.message}`);
      return errorResult(item, e.message);
    }
  });

  // ── 集計 ──
  const counts = { accept: 0, review: 0, discard: 0 };
  let inputTokens = 0;
  let model = null;
  for (const r of results) {
    counts[r.decision] = (counts[r.decision] || 0) + 1;
    inputTokens += r.usage?.input_tokens || 0;
    if (!model && r.model) model = r.model;
  }
  const cost = (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS;

  console.log(`${'='.repeat(60)}`);
  console.log(`📊 結果: accept ${counts.accept} / review ${counts.review} / discard ${counts.discard}`);
  console.log(`   model ${model || '—'} / 入力トークン ${inputTokens} / 概算コスト $${cost.toFixed(4)}`);

  const report = buildReport(results, { date: today, model, inputTokens });

  // ── 出力 ──
  if (opts.dryRun) {
    console.log('\n--- DRY RUN: 以下のレポートは書き出しません ---\n');
    console.log(report || '（accept / review が 0 件のためレポートは生成されません）');
    console.log('\n✅ 完了（DRY RUN）\n');
    return;
  }

  const dir = resolve('data/triage');
  mkdirSync(dir, { recursive: true });
  const logPath = join(dir, `${today}.json`);
  writeFileSync(logPath, `${JSON.stringify(results, null, 2)}\n`, 'utf-8');
  console.log(`\n📝 判定ログ: data/triage/${today}.json`);

  for (const r of results) {
    seen[r.item.id] = { decision: r.decision, date: today };
  }
  writeFileSync(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`, 'utf-8');
  console.log(`📝 seen.json を更新（${Object.keys(seen).length}件）`);

  if (report) {
    writeFileSync(resolve('.github/triage-result.md'), report, 'utf-8');
    console.log('📝 Issue 本文を .github/triage-result.md に出力');
  } else {
    console.log('ℹ accept / review が 0 件のため Issue 本文は作成しません');
  }

  console.log('\n✅ 完了\n');
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
