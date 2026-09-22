#!/usr/bin/env node
/**
 * 乳がん新書 — FDA 承認記録とサイトの突き合わせ
 *
 * openFDA の承認レコードのうち、src/data/drugs.json の米国ステータスに
 * まだ書かれていないものだけを拾い、GitHub Issue の本文を作る。
 *
 * 一度報告した承認は data/regulatory/seen.json に記録し、次回以降は報告しない。
 * KEGG / oncolo / ニュースの収集と「重要かどうか」の判定は scripts/triage.mjs が担当する
 * （以前はこのスクリプトでも拾っていたが、同じ内容が2つの Issue に並ぶので取りやめた）。
 *
 * Usage:
 *   node scripts/check-regulatory.mjs              # 本番実行
 *   node scripts/check-regulatory.mjs --dry-run    # 取得はするが seen.json も Issue 本文も書かない
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { collect } from './lib/triage-sources.mjs';
import { loadKnownDrugs } from './lib/known-drugs.mjs';
import { SEEN_PATH, buildIssueBody, selectFindings } from './lib/regulatory.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', ...p);

const DRY_RUN = process.argv.includes('--dry-run');
const RESULT_PATH = '.github/regulatory-check-result.md';

function loadSeen() {
  try {
    const path = resolve(SEEN_PATH);
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8')) || {};
  } catch (e) {
    console.warn(`  ⚠ ${SEEN_PATH} を読めませんでした (${e.message})。空として扱います`);
    return {};
  }
}

function saveSeen(seen) {
  const path = resolve(SEEN_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(seen, null, 2)}\n`, 'utf-8');
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n🏛 乳がん新書 — FDA 承認記録とサイトの突き合わせ`);
  console.log(`   モード: ${DRY_RUN ? '🔍 DRY RUN' : '✏️  本番実行'}`);
  console.log(`   日時: ${new Date().toISOString()}\n`);

  const drugs = JSON.parse(readFileSync(resolve('src/data/drugs.json'), 'utf-8'));
  const knownDrugs = loadKnownDrugs();

  console.log('🇺🇸 openFDA 取得...');
  const items = await collect({ sources: ['openfda'], knownDrugs });

  const seenBefore = loadSeen();
  const { findings, seen, skipped } = selectFindings({ items, drugs, seen: seenBefore, today });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 承認レコード ${items.length}件`);
  console.log(`   ⏭ 報告済み: ${skipped.seen}件 / ✓ サイトに反映済み: ${skipped.reflected}件`);
  console.log(`   🆕 未反映: ${findings.length}件`);
  for (const f of findings) {
    console.log(`   - ${f.approvalDate} ${f.generic}（${f.brand}）${f.submissions.join(', ')}`);
  }

  const body = buildIssueBody(findings, today);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: 以下は書き出しません ---\n');
    console.log(body || '（未反映の承認がないため Issue 本文は作成されません）');
    console.log('\n✅ 完了（DRY RUN）\n');
    return;
  }

  saveSeen(seen);
  console.log(`\n📝 ${SEEN_PATH} を更新（${Object.keys(seen).length}件）`);

  if (body) {
    writeFileSync(resolve(RESULT_PATH), body, 'utf-8');
    console.log(`📝 Issue 本文を ${RESULT_PATH} に出力`);
  } else {
    console.log('ℹ 未反映の承認がないため Issue 本文は作成しません');
  }

  console.log(`\n✅ 完了\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
