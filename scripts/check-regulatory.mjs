#!/usr/bin/env node
/**
 * 乳がん新書 — FDA/PMDA 承認ステータス自動チェック
 *
 * openFDA API + KEGG/RSS で承認情報を取得し、
 * 変更があればGitHub Issueとして起票 + Supabase更新
 *
 * Usage:
 *   node scripts/check-regulatory.mjs              # 本番実行
 *   node scripts/check-regulatory.mjs --dry-run    # 確認のみ
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', ...p);

const DRY_RUN = process.argv.includes('--dry-run');
const OPENFDA_API = 'https://api.fda.gov/drug/drugsfda.json';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lafldhrcafebghijmjbv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── FDA: openFDA API ──

const FDA_BRAND_MAP = {
  'palbociclib': 'ibrance',
  'ribociclib': 'kisqali',
  'abemaciclib': 'verzenio',
  'imlunestrant': 'imlunestrant',
  'elacestrant': 'orserdu',
  'alpelisib': 'piqray',
  'inavolisib': 'itovebi',
  'capivasertib': 'truqap',
  'everolimus': 'afinitor',
  'trastuzumab deruxtecan': 'enhertu',
  'trastuzumab emtansine': 'kadcyla',
  'tucatinib': 'tukysa',
  'sacituzumab govitecan': 'trodelvy',
  'datopotamab deruxtecan': 'datroway',
  'olaparib': 'lynparza',
  'talazoparib': 'talzenna',
  'pembrolizumab': 'keytruda',
  'lapatinib': 'tykerb',
  'neratinib': 'nerlynx',
  'margetuximab': 'margenza',
  'gedatolisib': 'gedatolisib',
  'vepdegestrant': 'vepdegestrant',
  'camizestrant': 'camizestrant',
  'giredestrant': 'giredestrant',
};

async function checkFDA(brandName) {
  try {
    const url = `${OPENFDA_API}?search=openfda.brand_name:"${brandName}"&limit=5`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return null;

    const approvals = [];
    for (const result of data.results) {
      for (const sub of (result.submissions || [])) {
        if (sub.submission_type === 'ORIG' || sub.submission_type === 'SUPPL') {
          approvals.push({
            type: sub.submission_type,
            number: sub.submission_number,
            date: sub.submission_status_date,
            status: sub.submission_status,
          });
        }
      }
    }
    return approvals.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (e) {
    console.warn(`  ⚠ openFDA error for ${brandName}: ${e.message}`);
    return null;
  }
}

// ── PMDA: KEGG + RSS ──

async function checkKEGG() {
  try {
    const url = 'https://www.kegg.jp/kegg/drug/br08318.html';
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const html = await resp.text();
    // Extract recent approvals mentioning breast cancer keywords
    const lines = html.split('\n').filter(l =>
      /乳|breast|cancer|がん/.test(l) &&
      /202[5-6]/.test(l)
    );
    return lines.map(l => l.trim()).slice(0, 20);
  } catch (e) {
    console.warn(`  ⚠ KEGG fetch error: ${e.message}`);
    return [];
  }
}

async function checkOncoloRSS() {
  try {
    const resp = await fetch('https://oncolo.jp/feed');
    if (!resp.ok) return [];
    const xml = await resp.text();
    // Simple RSS parse for breast cancer items
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = re.exec(xml))) {
      const item = match[1];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      if (/乳|breast|がん|承認|PMDA/.test(title)) {
        items.push({ title, link });
      }
    }
    return items.slice(0, 10);
  } catch (e) {
    console.warn(`  ⚠ oncolo.jp RSS error: ${e.message}`);
    return [];
  }
}

// ── Main ──

async function main() {
  console.log(`\n🏛 乳がん新書 — 承認ステータス自動チェック`);
  console.log(`   モード: ${DRY_RUN ? '🔍 DRY RUN' : '✏️  本番実行'}`);
  console.log(`   日時: ${new Date().toISOString()}\n`);

  // drugs.json読み込み
  const drugsPath = resolve('src/data/drugs.json');
  const drugs = JSON.parse(readFileSync(drugsPath, 'utf-8'));

  const findings = [];

  // ── FDA チェック ──
  console.log('🇺🇸 FDA チェック（openFDA API）...\n');
  for (const [generic, brand] of Object.entries(FDA_BRAND_MAP)) {
    await sleep(500);
    const approvals = await checkFDA(brand);
    if (!approvals || approvals.length === 0) {
      console.log(`  - ${brand}: データなし`);
      continue;
    }

    const drug = drugs.find(d => d.generic === generic);
    if (!drug) continue;

    // 最新の承認日を確認
    const latestApproval = approvals.find(a => a.status === 'AP');
    if (latestApproval) {
      const approvalDate = latestApproval.date;
      const knownStatus = drug.us?.t || '';
      if (approvalDate && !knownStatus.includes(approvalDate.substring(0, 4))) {
        findings.push({
          type: 'FDA',
          drug: generic,
          brand,
          detail: `新規承認/sNDA: ${approvalDate} (${latestApproval.type} #${latestApproval.number})`,
          approvalDate,
        });
        console.log(`  🆕 ${brand}: 承認 ${approvalDate} (${latestApproval.type})`);
      } else {
        console.log(`  ✓ ${brand}: 変更なし`);
      }
    } else {
      console.log(`  - ${brand}: 承認レコードなし`);
    }
  }

  // ── PMDA チェック ──
  console.log('\n🇯🇵 PMDA チェック...\n');

  console.log('  KEGG New Drug Approvals:');
  const keggItems = await checkKEGG();
  if (keggItems.length > 0) {
    keggItems.forEach(l => console.log(`    ${l}`));
    findings.push({ type: 'KEGG', detail: `${keggItems.length}件の関連エントリを検出` });
  } else {
    console.log('    乳がん関連の新規エントリなし');
  }

  console.log('\n  oncolo.jp RSS:');
  const oncoloItems = await checkOncoloRSS();
  if (oncoloItems.length > 0) {
    oncoloItems.forEach(i => console.log(`    📰 ${i.title}`));
    findings.push({ type: 'oncolo.jp', items: oncoloItems });
  } else {
    console.log('    乳がん関連の新規記事なし');
  }

  // ── サマリー ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 結果: ${findings.length}件の検出事項${DRY_RUN ? '（DRY RUN）' : ''}`);
  findings.forEach(f => console.log(`  - [${f.type}] ${f.drug || ''} ${f.detail || f.items?.length + '件'}`));

  // GitHub Issue本文を生成（CI環境で使用）
  if (findings.length > 0 && !DRY_RUN) {
    const issueBody = [
      `# 承認ステータス自動チェック結果 (${new Date().toISOString().split('T')[0]})`,
      '',
      '以下の変更が検出されました。確認・反映をお願いします。',
      '',
      ...findings.map(f => `- **[${f.type}]** ${f.drug || ''}: ${f.detail || JSON.stringify(f.items?.map(i => i.title))}`),
      '',
      '---',
      '*This issue was automatically created by `check-regulatory.mjs`*'
    ].join('\n');

    const issuePath = resolve('.github/regulatory-check-result.md');
    writeFileSync(issuePath, issueBody, 'utf-8');
    console.log(`\n📝 Issue本文を .github/regulatory-check-result.md に出力`);
  }

  console.log(`\n✅ 完了\n`);
  return findings.length;
}

main().catch(e => { console.error(e); process.exit(1); });
