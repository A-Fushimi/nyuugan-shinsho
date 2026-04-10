#!/usr/bin/env node
/**
 * 乳がん新書 — ClinicalTrials.gov 自動ステータス更新スクリプト
 *
 * timeline.jsonの全NCT番号についてCT.gov API v2からステータスを取得し、
 * 変更があればtimeline.json + Supabase trialsテーブルを更新する。
 *
 * Usage:
 *   node scripts/update-trials.mjs              # 本番実行（Supabase + JSON更新）
 *   node scripts/update-trials.mjs --dry-run    # 変更内容の確認のみ（書き込みなし）
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', ...p);

const DRY_RUN = process.argv.includes('--dry-run');
const CTGOV_API = 'https://clinicaltrials.gov/api/v2/studies';
const CTGOV_FIELDS = 'protocolSection.statusModule,protocolSection.designModule.enrollmentInfo,protocolSection.outcomesModule.primaryOutcomes';

// Supabase (環境変数 or ハードコード)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lafldhrcafebghijmjbv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ── Helpers ──

function dateToDecimal(d) {
  if (!d) return null;
  const parts = d.split('-');
  const y = parseInt(parts[0]);
  const m = parts.length > 1 ? parseInt(parts[1]) : 1;
  return Math.round((y + (m - 1) / 12) * 1000) / 1000;
}

function decimalToYM(d) {
  if (!d) return null;
  const y = Math.floor(d);
  const m = Math.round((d - y) * 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchTrial(nct) {
  const url = `${CTGOV_API}/${nct}?fields=${CTGOV_FIELDS}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    console.warn(`  ⚠ ${nct}: HTTP ${resp.status}`);
    return null;
  }
  return resp.json();
}

// ── Main ──

async function main() {
  console.log(`\n🔄 乳がん新書 — 試験ステータス自動更新`);
  console.log(`   モード: ${DRY_RUN ? '🔍 DRY RUN（書き込みなし）' : '✏️  本番実行'}`);
  console.log(`   日時: ${new Date().toISOString()}\n`);

  // 1. timeline.json読み込み
  const timelinePath = resolve('src/data/timeline.json');
  const timeline = JSON.parse(readFileSync(timelinePath, 'utf-8'));
  const nctTrials = timeline.filter(t => t.nct && t.nct.startsWith('NCT'));
  console.log(`📋 ${nctTrials.length}/${timeline.length} 試験にNCT番号あり\n`);

  const changes = [];

  // 2. CT.gov APIから一括取得
  for (const trial of nctTrials) {
    await sleep(300); // Rate limiting
    try {
      const data = await fetchTrial(trial.nct);
      if (!data) continue;

      const sm = data.protocolSection?.statusModule || {};
      const ei = data.protocolSection?.designModule?.enrollmentInfo || {};
      const po = data.protocolSection?.outcomesModule?.primaryOutcomes?.[0] || {};

      const apiStatus = sm.overallStatus || '';
      const apiPcd = sm.primaryCompletionDateStruct?.date || '';
      const apiScd = sm.completionDateStruct?.date || '';
      const apiStart = sm.startDateStruct?.date || '';
      const apiEnrollment = ei.count || null;
      const apiPrimaryEP = po.measure || '';

      // 比較: fpi
      const newFpi = dateToDecimal(apiStart);
      const fpiChanged = newFpi && Math.abs((trial.fpi || 0) - newFpi) > 0.05;

      // 比較: enrollment status
      const statusMap = {
        'RECRUITING': 'run',
        'ACTIVE_NOT_RECRUITING': trial.st === 'pos' || trial.st === 'neg' ? trial.st : 'run',
        'COMPLETED': trial.st === 'pos' || trial.st === 'neg' ? trial.st : 'run',
        'NOT_YET_RECRUITING': 'run',
        'TERMINATED': 'neg',
        'SUSPENDED': 'run',
        'WITHDRAWN': 'neg'
      };

      // 比較: pcd
      const newPcd = apiPcd ? apiPcd.substring(0, 7) : null; // YYYY-MM

      // 比較: enrollmentTarget
      const enrollChanged = apiEnrollment && trial.enrollmentTarget !== apiEnrollment;

      // 比較: enrollment status
      const enrollStatusChanged = apiStatus && trial.enrollment !== apiStatus;

      const trialChanges = [];
      if (fpiChanged) trialChanges.push(`fpi: ${decimalToYM(trial.fpi)} → ${apiStart.substring(0, 7)}`);
      if (enrollStatusChanged) trialChanges.push(`enrollment: ${trial.enrollment || '?'} → ${apiStatus}`);
      if (enrollChanged) trialChanges.push(`enrollmentTarget: ${trial.enrollmentTarget || '?'} → ${apiEnrollment}`);
      if (newPcd && trial.pcd !== newPcd) trialChanges.push(`pcd: ${trial.pcd || '?'} → ${newPcd}`);

      if (trialChanges.length > 0) {
        changes.push({ trial: trial.trial, nct: trial.nct, changes: trialChanges });
        console.log(`  ✏️  ${trial.trial} (${trial.nct})`);
        trialChanges.forEach(c => console.log(`      ${c}`));

        if (!DRY_RUN) {
          // Update timeline.json entry
          if (fpiChanged) trial.fpi = newFpi;
          if (enrollStatusChanged) trial.enrollment = apiStatus;
          if (enrollChanged) trial.enrollmentTarget = apiEnrollment;
          if (newPcd && trial.pcd !== newPcd) trial.pcd = newPcd;
          if (apiScd) trial.scd = apiScd.substring(0, 7);
        }
      } else {
        console.log(`  ✓ ${trial.trial} — 変更なし`);
      }

      // Supabase更新
      if (!DRY_RUN && supabase && trialChanges.length > 0) {
        const { error } = await supabase
          .from('trials')
          .update({
            status: apiStatus === 'ACTIVE_NOT_RECRUITING' ? 'Active' :
                    apiStatus === 'RECRUITING' ? 'Recruiting' :
                    apiStatus === 'COMPLETED' ? 'Completed' : apiStatus,
            target_enrollment: apiEnrollment,
          })
          .eq('nct_id', trial.nct);
        if (error) console.warn(`  ⚠ Supabase update failed for ${trial.nct}: ${error.message}`);
      }
    } catch (e) {
      console.warn(`  ❌ ${trial.trial} (${trial.nct}): ${e.message}`);
    }
  }

  // 3. サマリー
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 結果サマリー: ${changes.length}件の変更${DRY_RUN ? '（DRY RUN）' : ''}`);
  if (changes.length > 0) {
    changes.forEach(c => console.log(`  - ${c.trial}: ${c.changes.join(', ')}`));
  }

  // 4. JSON書き込み
  if (!DRY_RUN && changes.length > 0) {
    writeFileSync(timelinePath, JSON.stringify(timeline, null, 2), 'utf-8');
    console.log(`\n✅ timeline.json 更新完了`);

    // 5. changelog.json に自動エントリ追加
    const changelogPath = resolve('src/data/changelog.json');
    const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));
    const today = new Date().toISOString().split('T')[0];
    const summaryItems = changes.slice(0, 5).map(c => `${c.trial}: ${c.changes[0]}`);
    if (changes.length > 5) summaryItems.push(`他${changes.length - 5}件`);

    // 直近のautoエントリがあれば追記、なければ新規
    const lastEntry = changelog[0];
    if (lastEntry && lastEntry.ver === 'auto' && lastEntry.date === today) {
      lastEntry.items.push(...summaryItems);
    } else {
      changelog.unshift({
        ver: 'auto',
        date: today,
        type: 'auto',
        items: [`試験ステータス自動更新（${changes.length}件変更: ${summaryItems.join('、')}）`]
      });
    }
    writeFileSync(changelogPath, JSON.stringify(changelog, null, 2), 'utf-8');
    console.log(`✅ changelog.json 更新完了`);

    // 6. App.jsx UPDATED日付を更新
    const appPath = resolve('src/App.jsx');
    let appContent = readFileSync(appPath, 'utf-8');
    const dateStr = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日`;
    appContent = appContent.replace(/const UPDATED = "[^"]*"/, `const UPDATED = "${dateStr}"`);
    writeFileSync(appPath, appContent, 'utf-8');
    console.log(`✅ App.jsx UPDATED日付 → ${dateStr}`);
  }

  console.log(`\n✅ 完了${DRY_RUN ? '（DRY RUN — 変更は適用されていません）' : ''}\n`);
  return changes.length;
}

main().catch(e => { console.error(e); process.exit(1); });
