/** regulatory.mjs — 同じ承認を二度報告しないことの確認 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SEEN_PATH,
  buildIssueBody,
  isReflectedInSite,
  selectFindings,
  siteUsStatusTexts,
  yearMonthTokens,
} from '../lib/regulatory.mjs';

/** openFDA アイテム（triage-sources の形）を作るヘルパ */
function item({ id = 'openfda:aaa', generic = 'tucatinib', brand = 'tukysa', date = '2026-09-04' } = {}) {
  return {
    id,
    source: 'openfda',
    title: `FDA SUPPL #4 承認: ${brand}（${generic}）${date}`,
    url: 'https://example.invalid/daf',
    date,
    meta: { generic, brand, submissions: ['SUPPL #4'], submissionClass: 'Efficacy' },
  };
}

test('適応ごとの表を持つ薬は indications の米国ステータスも拾う', () => {
  const drug = {
    generic: 'trastuzumab deruxtecan',
    us: { s: 'ok', t: '' }, // indications がある薬は上位が空文字
    indications: [
      { label: 'HER2+ MBC 2L+', us: { s: 'ok', t: '承認済' } },
      { label: 'HER2+ MBC 1L', us: { s: 'ok', t: '承認済 2025/12' } },
    ],
  };
  assert.deepEqual(siteUsStatusTexts(drug), ['承認済', '承認済 2025/12']);
});

test('yearMonthTokens が年月の表記ゆれを展開する', () => {
  assert.deepEqual(yearMonthTokens('2026-09-04'), [
    '2026/09',
    '2026/9',
    '2026-09',
    '2026-9',
    '2026年09月',
    '2026年9月',
  ]);
  assert.deepEqual(yearMonthTokens(''), []);
  assert.deepEqual(yearMonthTokens('20260904'), []);
});

test('isReflectedInSite は年月が一致すれば反映済みとみなす', () => {
  const drug = { generic: 'x', us: { t: '承認済 2026/9（SERENA-6）' } };
  assert.equal(isReflectedInSite(drug, '2026-09-04'), true);
  assert.equal(isReflectedInSite(drug, '2026-10-04'), false);
  assert.equal(isReflectedInSite(undefined, '2026-09-04'), false);
});

test('上位が空文字でも indications 側に書かれていれば反映済み', () => {
  const drug = {
    generic: 'trastuzumab deruxtecan',
    us: { t: '' },
    indications: [{ us: { t: '承認済 2026/5（DB-05）' } }],
  };
  // 旧実装は上位の '' だけを見て毎週報告し続けていた
  assert.equal(isReflectedInSite(drug, '2026-05-15'), true);
});

test('未反映の承認だけを報告し、seen に記録する', () => {
  const drugs = [{ generic: 'tucatinib', us: { t: '承認済 2023/1' } }];
  const items = [item({ id: 'openfda:new', date: '2026-09-04' })];
  const { findings, seen, skipped } = selectFindings({ items, drugs, seen: {}, today: '2026-09-23' });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].generic, 'tucatinib');
  assert.equal(findings[0].siteStatus, '承認済 2023/1');
  assert.deepEqual(seen['openfda:new'], { decision: 'reported', date: '2026-09-23' });
  assert.deepEqual(skipped, { seen: 0, reflected: 0 });
});

test('二度目の実行では同じ承認を報告しない', () => {
  const drugs = [{ generic: 'tucatinib', us: { t: '承認済 2023/1' } }];
  const items = [item({ id: 'openfda:new', date: '2026-09-04' })];

  const first = selectFindings({ items, drugs, seen: {}, today: '2026-09-23' });
  assert.equal(first.findings.length, 1);

  // 翌週：drugs.json も openFDA も変わっていない
  const second = selectFindings({ items, drugs, seen: first.seen, today: '2026-09-30' });
  assert.equal(second.findings.length, 0);
  assert.equal(second.skipped.seen, 1);
  // 記録は最初の報告日のまま
  assert.equal(second.seen['openfda:new'].date, '2026-09-23');
});

test('サイトに反映済みの承認も seen に残し、次回の照合を繰り返さない', () => {
  const drugs = [{ generic: 'tucatinib', us: { t: '承認済 2026/9' } }];
  const items = [item({ id: 'openfda:known', date: '2026-09-04' })];

  const { findings, seen, skipped } = selectFindings({ items, drugs, seen: {}, today: '2026-09-23' });
  assert.equal(findings.length, 0);
  assert.equal(skipped.reflected, 1);
  assert.deepEqual(seen['openfda:known'], { decision: 'reflected', date: '2026-09-23' });
});

test('selectFindings は渡された seen を破壊しない', () => {
  const seen = {};
  selectFindings({ items: [item()], drugs: [], seen, today: '2026-09-23' });
  assert.deepEqual(seen, {});
});

test('drugs.json に無い一般名は未収録として報告する', () => {
  const items = [item({ id: 'openfda:unknown', generic: 'newdrug' })];
  const { findings } = selectFindings({ items, drugs: [], seen: {}, today: '2026-09-23' });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].known, false);
});

test('報告が 0 件なら Issue 本文を作らない', () => {
  assert.equal(buildIssueBody([], '2026-09-23'), null);
  assert.equal(buildIssueBody(undefined, '2026-09-23'), null);
});

test('Issue 本文に承認日・一般名・サイトの現状と seen.json の場所が入る', () => {
  const drugs = [{ generic: 'tucatinib', us: { t: '承認済 2023/1' } }];
  const { findings } = selectFindings({
    items: [item({ id: 'openfda:new' })],
    drugs,
    seen: {},
    today: '2026-09-23',
  });
  const body = buildIssueBody(findings, '2026-09-23');
  assert.match(body, /2026-09-04/);
  assert.match(body, /tucatinib/);
  assert.match(body, /SUPPL #4/);
  assert.match(body, /承認済 2023\/1/);
  assert.match(body, new RegExp(SEEN_PATH.replace('/', '\\/')));
});

test('新しい順に並べる', () => {
  const items = [
    item({ id: 'openfda:a', date: '2026-05-15' }),
    item({ id: 'openfda:b', date: '2026-09-04' }),
    item({ id: 'openfda:c', date: '2026-07-01' }),
  ];
  const { findings } = selectFindings({ items, drugs: [], seen: {}, today: '2026-09-23' });
  assert.deepEqual(
    findings.map((f) => f.approvalDate),
    ['2026-09-04', '2026-07-01', '2026-05-15']
  );
});

test('サイト本文に | が入っていても表が崩れない', () => {
  const drugs = [{ generic: 'tucatinib', us: { t: '承認済 2023/1 | 脳転移' } }];
  const { findings } = selectFindings({
    items: [item({ id: 'openfda:pipe' })],
    drugs,
    seen: {},
    today: '2026-09-23',
  });
  const row = buildIssueBody(findings, '2026-09-23')
    .split('\n')
    .find((l) => l.includes('tucatinib'));
  assert.match(row, /承認済 2023\/1 \\\| 脳転移/);
  // 区切りの | は先頭・末尾を含めて 7 本（列は 6 つ）
  assert.equal(row.split('|').length - 1 - (row.match(/\\\|/g) || []).length, 7);
});
