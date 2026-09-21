/** triage-report.mjs のテスト（設計書 §8） */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReport } from '../lib/triage-report.mjs';

function result(over = {}) {
  return {
    item: {
      id: 'oncolo:a',
      source: 'oncolo',
      title: 'エンハーツ＋ペルツズマブ 国内承認',
      url: 'https://oncolo.jp/news/a',
      date: '2026-09-16',
    },
    answers: {
      relevant: { type: 'noul', noul: 0.97 },
      category: { type: 'choice', choice: 'approval_jp', confidence: 0.88 },
      impact: { type: 'score', score: 2.9 },
    },
    decision: 'accept',
    priority: 2.9,
    reasons: ['影響度が高い (impact 2.90)'],
    tags: { category: 'approval_jp', subtype: 'her2_pos', setting: 'metastatic' },
    usage: { input_tokens: 1000, output_tokens: 0 },
    ...over,
  };
}

test('accept / review が 0 件なら null（Issue を作らせない）', () => {
  assert.equal(buildReport([], { date: '2026-09-20' }), null);
  const discards = [result({ decision: 'discard', priority: 0 })];
  assert.equal(buildReport(discards, { date: '2026-09-20' }), null);
});

test('見出しと件数が出力される', () => {
  const md = buildReport(
    [result(), result({ decision: 'review', priority: 1.5, item: { ...result().item, id: 'b', title: '申請' } })],
    { date: '2026-09-20', model: 'jev-1.2', inputTokens: 2000 }
  );
  assert.match(md, /^# 📥 情報トリアージ結果 \(2026-09-20\)/);
  assert.match(md, /## 🔴 採用候補（accept, 1件）— 優先度順/);
  assert.match(md, /## 🟡 要確認（review, 1件）/);
  assert.match(md, /## ⚪ 破棄（0件）/);
});

test('accept は優先度の降順に並ぶ', () => {
  const low = result({ priority: 2.1, item: { ...result().item, id: 'low', title: 'LOW' } });
  const high = result({ priority: 2.9, item: { ...result().item, id: 'high', title: 'HIGH' } });
  const md = buildReport([low, high], { date: '2026-09-20' });
  assert.ok(md.indexOf('HIGH') < md.indexOf('LOW'));
});

test('見出し行にタグ・優先度・ソース・日付・URL が含まれる', () => {
  const md = buildReport([result()], { date: '2026-09-20' });
  assert.match(md, /- \[approval_jp\]\[HER2\+ \/ metastatic\] ★2\.9 エンハーツ＋ペルツズマブ 国内承認 \(oncolo, 9\/16\) https:\/\/oncolo\.jp\/news\/a/);
  assert.match(md, /relevant 0\.97 \/ impact 2\.90 \/ category approval_jp \(conf 0\.88\)/);
});

function ctgovResult(over = {}) {
  return result({
    item: {
      id: 'ctgov:a',
      source: 'ctgov',
      title: 'Novel ADC study',
      url: 'https://clinicaltrials.gov/study/NCT1',
      date: '2026-09-03',
      meta: { nct: 'NCT1', sponsor: 'XYZ Therapeutics', phase: 'PHASE2' },
    },
    tags: { category: 'trial_start', subtype: 'tnbc', setting: 'metastatic', moa: 'ADC' },
    answers: { ...result().answers, novel_agent: { type: 'noul', noul: 0.93 } },
    ...over,
  });
}

test('ctgov の accept はランドスケープ候補にだけ出る（採用候補には出ない）', () => {
  const md = buildReport([ctgovResult(), result()], { date: '2026-09-20' });
  assert.match(md, /## 🔴 採用候補（accept, 1件）/);
  assert.match(md, /## 🧪 ランドスケープ候補（CT\.gov 新規作用機序の試験, 1件）/);
  // 採用候補セクションに ctgov のタイトルが無いこと
  const acceptSection = md.slice(md.indexOf('## 🔴'), md.indexOf('## 🟡'));
  assert.ok(!acceptSection.includes('Novel ADC study'));
  const landscapeSection = md.slice(md.indexOf('## 🧪'), md.indexOf('## ⚪'));
  assert.ok(landscapeSection.includes('Novel ADC study'));
});

test('ランドスケープ候補は moa ごとに件数付きで並び、phase / sponsor / NCT / novel_agent を出す', () => {
  const md = buildReport(
    [
      ctgovResult(),
      ctgovResult({ item: { ...ctgovResult().item, id: 'ctgov:b', title: 'Second ADC study' } }),
    ],
    { date: '2026-09-20' }
  );
  assert.match(md, /\*\*ADC\*\*（2件）/);
  assert.match(
    md,
    /- Novel ADC study — PHASE2 \/ XYZ Therapeutics \/ novel_agent 0\.93 https:\/\/clinicaltrials\.gov\/study\/NCT1/
  );
});

test('ランドスケープ候補は 15件以下なら details で包まない / 16件以上なら包む', () => {
  const mk = (n) =>
    Array.from({ length: n }, (_, i) =>
      ctgovResult({ item: { ...ctgovResult().item, id: `ctgov:${i}`, title: `Study ${i}` } })
    );
  const small = buildReport(mk(15), { date: '2026-09-20' });
  assert.ok(!/ランドスケープ候補 15件/.test(small));
  const big = buildReport(mk(16), { date: '2026-09-20' });
  assert.match(big, /<details><summary>ランドスケープ候補 16件（作用機序別）<\/summary>/);
});

test('要確認はソース別に分かれ、16件以上のソースは details で包まれる', () => {
  const reviews = [
    result({ decision: 'review', priority: 1.2 }),
    ...Array.from({ length: 16 }, (_, i) =>
      result({
        decision: 'review',
        priority: 1.1,
        item: { id: `kegg:${i}`, source: 'kegg', title: `KEGG ${i}`, url: '', date: '2026-09-10' },
      })
    ),
  ];
  const md = buildReport(reviews, { date: '2026-09-20' });
  assert.match(md, /### oncolo（1件）/);
  assert.match(md, /### KEGG（16件）/);
  assert.match(md, /<details><summary>KEGG の 16件<\/summary>/);
  // oncolo は 1件なので折りたたまない
  assert.ok(!/<details><summary>oncolo の 1件<\/summary>/.test(md));
});

test('セクション順は 採用候補 → 要確認 → ランドスケープ候補 → 破棄', () => {
  const md = buildReport(
    [result(), result({ decision: 'review', priority: 1.5 }), ctgovResult(), result({ decision: 'discard', priority: 0 })],
    { date: '2026-09-20' }
  );
  assert.ok(md.indexOf('## 🔴') < md.indexOf('## 🟡'));
  assert.ok(md.indexOf('## 🟡') < md.indexOf('## 🧪'));
  assert.ok(md.indexOf('## 🧪') < md.indexOf('## ⚪'));
});

test('ctgov の accept だけでもレポートは生成される', () => {
  const md = buildReport([ctgovResult()], { date: '2026-09-20' });
  assert.ok(md);
  assert.match(md, /## 🧪 ランドスケープ候補（CT\.gov 新規作用機序の試験, 1件）/);
});

test('破棄は details に折りたたまれ、理由が併記される', () => {
  const md = buildReport(
    [
      result(),
      result({
        decision: 'discard',
        priority: 0,
        reasons: ['乳がん薬物療法に非該当 (relevant 0.04)'],
        item: { ...result().item, id: 'd', title: '肺がんの記事' },
      }),
    ],
    { date: '2026-09-20' }
  );
  assert.match(md, /<details><summary>破棄した情報の一覧<\/summary>/);
  assert.match(md, /- 肺がんの記事 — 乳がん薬物療法に非該当 \(relevant 0\.04\)/);
  assert.match(md, /<\/details>/);
});

test('review には理由行が付く', () => {
  const md = buildReport(
    [result({ decision: 'review', priority: 1.5, reasons: ['関連性が不確実 (relevant 0.48)'] })],
    { date: '2026-09-20' }
  );
  assert.match(md, /理由: 関連性が不確実 \(relevant 0\.48\)/);
});

test('フッターにモデル・判定数・入力トークン・概算コストが出る', () => {
  const md = buildReport([result(), result({ decision: 'discard', priority: 0 })], {
    date: '2026-09-20',
    model: 'jev-1.2',
    inputTokens: 1_000_000,
  });
  assert.match(md, /Jev model: jev-1\.2 \/ 判定数 2件 \/ 入力トークン 1,000,000 \/ 概算コスト \$0\.0420/);
});
