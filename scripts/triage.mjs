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
 *   node scripts/triage.mjs --limit=50            # 判定件数の上限（既定 200）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { createJevClient, judgeItem, COST_PER_MILLION_INPUT_TOKENS } from './lib/jev.mjs';
import { decide } from './lib/triage-policy.mjs';
import { buildReport } from './lib/triage-report.mjs';
import { collect, SOURCE_NAMES } from './lib/triage-sources.mjs';
import { loadKnownDrugs } from './lib/known-drugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', ...p);

const DEFAULT_LIMIT = 200;
const CONCURRENCY = 4;

// ── CLI 引数 ──

function parseArgs(argv) {
  const opts = {
    dryRun: argv.includes('--dry-run'),
    offline: argv.includes('--offline'),
    sources: SOURCE_NAMES,
    limit: DEFAULT_LIMIT,
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
  return opts;
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
  console.log(`   ソース: ${opts.sources.join(', ')} / 上限: ${opts.limit}件`);
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
  const fresh = items.filter((i) => !seen[i.id]);
  const skipped = items.length - fresh.length;
  if (skipped > 0) console.log(`⏭  判定済みのため除外: ${skipped}件`);

  const targets = fresh.slice(0, opts.limit);
  if (targets.length < fresh.length) {
    console.log(`⚠ 上限 ${opts.limit}件を超えたため ${fresh.length - targets.length}件は次回に持ち越します`);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
