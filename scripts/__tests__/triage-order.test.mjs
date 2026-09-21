/** triage.mjs の orderAndCap（ソース優先度とソース別上限）のテスト */

import test from 'node:test';
import assert from 'node:assert/strict';

import { orderAndCap, SOURCE_PRIORITY } from '../triage.mjs';

const mk = (source, n) => Array.from({ length: n }, (_, i) => ({ source, id: `${source}:${i}` }));

test('SOURCE_PRIORITY は gnews → oncolo → kegg → openfda → ctgov', () => {
  assert.deepEqual(SOURCE_PRIORITY, ['gnews', 'oncolo', 'kegg', 'openfda', 'ctgov']);
});

test('収集順に関わらずソース優先度の順に並べ替える', () => {
  const items = [
    ...mk('ctgov', 2),
    ...mk('oncolo', 1),
    ...mk('openfda', 1),
    ...mk('kegg', 1),
    ...mk('gnews', 1),
  ];
  const { targets } = orderAndCap(items);
  assert.deepEqual(
    targets.map((t) => t.source),
    ['gnews', 'oncolo', 'kegg', 'openfda', 'ctgov', 'ctgov']
  );
});

test('ctgov の上限は全体の上限より先に適用される', () => {
  const items = [...mk('ctgov', 500), ...mk('oncolo', 5), ...mk('openfda', 10)];
  const { targets, carry, carryBySource } = orderAndCap(items, { limit: 200, caps: { ctgov: 80 } });
  assert.equal(targets.length, 95); // oncolo 5 + openfda 10 + ctgov 80
  assert.equal(targets.filter((t) => t.source === 'ctgov').length, 80);
  assert.equal(carry.length, 420);
  assert.deepEqual(carryBySource, { ctgov: 420 });
});

test('全体の上限を超えた分も持ち越しに数える（ソース別に集計）', () => {
  const items = [...mk('oncolo', 10), ...mk('ctgov', 10)];
  const { targets, carry, carryBySource } = orderAndCap(items, { limit: 12, caps: { ctgov: 8 } });
  assert.equal(targets.length, 12);
  // oncolo 10 は全部残り、ctgov は 8 に絞られたあと 2 件しか入らない
  assert.equal(targets.filter((t) => t.source === 'ctgov').length, 2);
  assert.equal(carry.length, 8); // cap で 2 + limit で 6
  assert.deepEqual(carryBySource, { ctgov: 8 });
});

test('上限に収まるなら持ち越しは空', () => {
  const { targets, carry, carryBySource } = orderAndCap(mk('oncolo', 3), { limit: 200, caps: { ctgov: 80 } });
  assert.equal(targets.length, 3);
  assert.deepEqual(carry, []);
  assert.deepEqual(carryBySource, {});
});

test('未知のソースは既知のソースの後ろに回る', () => {
  const items = [{ source: 'mystery', id: 'm' }, ...mk('oncolo', 1)];
  const { targets } = orderAndCap(items);
  assert.deepEqual(
    targets.map((t) => t.source),
    ['oncolo', 'mystery']
  );
});

test('空配列でも落ちない', () => {
  const { targets, carry } = orderAndCap([], { limit: 10 });
  assert.deepEqual(targets, []);
  assert.deepEqual(carry, []);
});
