/** triage-policy.mjs の境界値テスト（設計書 §7 のルール1〜9） */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { THRESHOLDS, decide } from '../lib/triage-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NEWS = { id: 'x', source: 'oncolo' };
const TRIAL = { id: 'y', source: 'ctgov' };

/** answers を組み立てるヘルパ */
function answers({ relevant = 0.9, impact = 2.5, conf = 0.9, novel, moa } = {}) {
  const a = {
    relevant: { type: 'noul', noul: relevant },
    category: { type: 'choice', choice: 'approval_jp', confidence: conf, probabilities: {} },
    impact: { type: 'score', score: impact, confidence: 0.8, probabilities: {}, legend: {} },
    subtype: { type: 'choice', choice: 'hr_pos', confidence: 0.9, probabilities: {} },
    setting: { type: 'choice', choice: 'metastatic', confidence: 0.9, probabilities: {} },
  };
  if (typeof novel === 'number') a.novel_agent = { type: 'noul', noul: novel };
  if (moa) a.moa = { type: 'choice', choice: moa, confidence: 0.9, probabilities: {} };
  return a;
}

test('THRESHOLDS が設計書の値で公開されている', () => {
  assert.equal(THRESHOLDS.relevantLow, 0.35);
  assert.equal(THRESHOLDS.relevantHigh, 0.65);
  assert.equal(THRESHOLDS.impactAccept, 1.8);
  assert.equal(THRESHOLDS.impactReview, 1.0);
  assert.equal(THRESHOLDS.categoryConfidence, 0.5);
  assert.equal(THRESHOLDS.novelLow, 0.35);
  assert.equal(THRESHOLDS.novelHigh, 0.65);
});

test('ルール1: relevant < 0.35 は破棄', () => {
  const r = decide(NEWS, answers({ relevant: 0.34 }));
  assert.equal(r.decision, 'discard');
  assert.match(r.reasons.join(' '), /非該当/);
});

test('ルール2: relevant が 0.35 ちょうど〜0.65 未満は要確認', () => {
  assert.equal(decide(NEWS, answers({ relevant: 0.35 })).decision, 'review');
  assert.equal(decide(NEWS, answers({ relevant: 0.64 })).decision, 'review');
  assert.match(decide(NEWS, answers({ relevant: 0.5 })).reasons.join(' '), /関連性が不確実/);
});

test('ルール3: relevant 0.65 以上 かつ impact 2.0 以上は採用、priority は impact', () => {
  const r = decide(NEWS, answers({ relevant: 0.65, impact: 2.0 }));
  assert.equal(r.decision, 'accept');
  assert.equal(r.priority, 2.0);
  const r2 = decide(NEWS, answers({ relevant: 0.99, impact: 2.9 }));
  assert.equal(r2.priority, 2.9);
});

test('ルール4: impact 1.0 以上 1.8 未満は要確認', () => {
  assert.equal(decide(NEWS, answers({ impact: 1.0 })).decision, 'review');
  assert.equal(decide(NEWS, answers({ impact: 1.79 })).decision, 'review');
  assert.match(decide(NEWS, answers({ impact: 1.5 })).reasons.join(' '), /参考情報/);
});

test('ルール5: impact 1.0 未満は破棄', () => {
  const r = decide(NEWS, answers({ impact: 0.99 }));
  assert.equal(r.decision, 'discard');
  assert.match(r.reasons.join(' '), /影響度が低い/);
});

test('ルール6: category.confidence < 0.5 の accept は review に格下げ', () => {
  assert.equal(decide(NEWS, answers({ impact: 2.5, conf: 0.49 })).decision, 'review');
  assert.equal(decide(NEWS, answers({ impact: 2.5, conf: 0.5 })).decision, 'accept');
  assert.match(decide(NEWS, answers({ impact: 2.5, conf: 0.1 })).reasons.join(' '), /分類が曖昧/);
});

test('ルール7: ctgov で novel_agent < 0.35 は破棄', () => {
  const r = decide(TRIAL, answers({ relevant: 0.9, impact: 2.5, novel: 0.34 }));
  assert.equal(r.decision, 'discard');
  assert.equal(r.priority, 0);
  assert.match(r.reasons.join(' '), /新薬候補を含まない/);
});

test('ルール8: ctgov で novel_agent 0.35〜0.65 未満は要確認', () => {
  assert.equal(decide(TRIAL, answers({ impact: 2.8, novel: 0.35 })).decision, 'review');
  assert.equal(decide(TRIAL, answers({ impact: 0.2, novel: 0.64 })).decision, 'review');
  // 乳がんに非該当（ルール1）のものは破棄のまま
  assert.equal(decide(TRIAL, answers({ relevant: 0.1, novel: 0.5 })).decision, 'discard');
});

test('ルール9: ctgov で novel_agent 0.65 以上 かつ relevant 0.65 以上は採用', () => {
  const r = decide(TRIAL, answers({ relevant: 0.65, impact: 0.5, novel: 0.65, moa: 'ADC' }));
  assert.equal(r.decision, 'accept');
  assert.equal(r.tags.moa, 'ADC');
  assert.ok(r.priority >= THRESHOLDS.impactReview);
  // relevant が低ければ採用に昇格しない
  assert.notEqual(decide(TRIAL, answers({ relevant: 0.5, novel: 0.9 })).decision, 'accept');
});

test('ctgov 以外では novel_agent を見ない', () => {
  const r = decide(NEWS, answers({ impact: 2.5, novel: 0.01 }));
  assert.equal(r.decision, 'accept');
});

test('tags は answers の選択肢をそのまま反映し、欠落時は既定値', () => {
  const r = decide(NEWS, answers({}));
  assert.deepEqual(r.tags, { category: 'approval_jp', subtype: 'hr_pos', setting: 'metastatic' });
  const empty = decide(NEWS, { relevant: { type: 'noul', noul: 0.9 } });
  assert.deepEqual(empty.tags, { category: 'other', subtype: 'unspecified', setting: 'unspecified' });
});

test('relevant が欠落していれば要確認', () => {
  const r = decide(NEWS, {});
  assert.equal(r.decision, 'review');
  assert.match(r.reasons.join(' '), /欠落/);
});

test('fixtures の14件が期待どおりに振り分けられる', () => {
  const items = JSON.parse(readFileSync(join(__dirname, 'fixtures/items.sample.json'), 'utf-8'));
  const fx = JSON.parse(readFileSync(join(__dirname, 'fixtures/jev.answers.sample.json'), 'utf-8'));
  const expected = {
    'gnews:sample-jp-approval': 'accept',
    'gnews:sample-general-article': 'discard',
    'oncolo:sample-jp-approval': 'accept',
    'openfda:sample-us-approval': 'accept',
    'oncolo:sample-ph3-result': 'accept',
    'oncolo:sample-other-cancer': 'discard',
    'oncolo:sample-supportive': 'discard',
    'kegg:sample-biosimilar': 'discard',
    'kegg:sample-pricing-ambiguous': 'review',
    'oncolo:sample-filing': 'review',
    'oncolo:sample-uncertain': 'review',
    'ctgov:sample-novel-adc': 'accept',
    'ctgov:sample-chemo-only': 'discard',
    'ctgov:sample-unclear-novelty': 'review',
  };
  assert.equal(items.length, 14);
  for (const item of items) {
    const rec = fx[item.id];
    assert.ok(rec, `${item.id} の答えが fixtures にある`);
    assert.equal(decide(item, rec.answers).decision, expected[item.id], item.id);
  }
});
