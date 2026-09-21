/** jev.mjs のテスト。モック fetch を注入するのでネットワークは使わない（設計書 §10-3） */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  buildState,
  buildQuestions,
  createJevClient,
  judgeItem,
  MAX_BODY_CHARS,
  MOA_CATEGORIES,
} from '../lib/jev.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(__dirname, 'fixtures/items.sample.json'), 'utf-8'));
const fixtures = JSON.parse(readFileSync(join(__dirname, 'fixtures/jev.answers.sample.json'), 'utf-8'));

const newsItem = items.find((i) => i.id === 'oncolo:sample-jp-approval');
const trialItem = items.find((i) => i.id === 'ctgov:sample-novel-adc');

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** 応答を順番に返すモック fetch。呼び出しを記録する */
function mockFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return typeof next === 'function' ? next() : next();
  };
  fn.calls = calls;
  return fn;
}

test('buildState は state を JSON で組み立て、本文を切り詰める', () => {
  const state = buildState({ ...newsItem, body: 'あ'.repeat(5000) });
  assert.equal(state.source, 'oncolo.jp（日本のがん情報ニュースサイト）');
  assert.equal(state.title, newsItem.title);
  assert.equal(state.body.length, MAX_BODY_CHARS);
  assert.equal(state.date, '2026-09-16');
  assert.deepEqual(state.known_drugs_in_site, newsItem.knownDrugs);
});

test('buildQuestions は ctgov のときだけ novel_agent / moa を足す', () => {
  const base = buildQuestions(newsItem);
  assert.deepEqual(Object.keys(base), ['relevant', 'category', 'impact', 'subtype', 'setting']);
  const trial = buildQuestions(trialItem);
  assert.ok('novel_agent' in trial && 'moa' in trial);
  assert.deepEqual(Object.keys(trial.moa.criteria), Object.keys(MOA_CATEGORIES));
  // moa には「該当なし」の選択肢がある
  assert.ok('none' in trial.moa.criteria);
});

test('systemOne が /v1/systemone に POST され、body の型が正しく、answers が返る', async () => {
  const payload = {
    model: 'jev-1.2',
    answers: fixtures['oncolo:sample-jp-approval'].answers,
    usage: { input_tokens: 1180, output_tokens: 0 },
  };
  const fetchImpl = mockFetch([() => jsonResponse(payload)]);
  const client = createJevClient({ apiKey: 'test-key', fetch: fetchImpl });
  const out = await judgeItem(client, newsItem);

  assert.equal(fetchImpl.calls.length, 1);
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer test-key');

  const body = JSON.parse(init.body);
  assert.equal(body.model, 'jev-latest');
  assert.equal(typeof body.state, 'object');
  assert.equal(body.state.title, newsItem.title);
  assert.equal(body.questions.relevant.type, 'noul');
  assert.equal(body.questions.category.type, 'choice');
  assert.equal(body.questions.impact.type, 'score');
  assert.ok(Array.isArray(body.questions.impact.criteria));
  assert.equal(body.questions.impact.criteria.length, 4);
  assert.ok('approval_jp' in body.questions.category.criteria);
  assert.equal(body.questions.novel_agent, undefined);

  assert.equal(out.model, 'jev-1.2');
  assert.equal(out.answers.relevant.noul, 0.97);
  assert.equal(out.answers.category.choice, 'approval_jp');
  assert.equal(out.usage.input_tokens, 1180);
});

test('ctgov のリクエストには novel_agent / moa が含まれる', async () => {
  const payload = {
    model: 'jev-1.2',
    answers: fixtures['ctgov:sample-novel-adc'].answers,
    usage: { input_tokens: 1320, output_tokens: 0 },
  };
  const fetchImpl = mockFetch([() => jsonResponse(payload)]);
  const client = createJevClient({ apiKey: 'test-key', fetch: fetchImpl });
  const out = await judgeItem(client, trialItem);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.equal(body.questions.novel_agent.type, 'noul');
  assert.equal(body.questions.moa.type, 'choice');
  assert.equal(out.answers.moa.choice, 'ADC');
});

test('429 の後に 200 が返れば SDK のリトライで成功する', async () => {
  const payload = {
    model: 'jev-1.2',
    answers: fixtures['oncolo:sample-jp-approval'].answers,
    usage: { input_tokens: 1180, output_tokens: 0 },
  };
  const fetchImpl = mockFetch([
    () => jsonResponse({ error: 'rate limited' }, 429, { 'retry-after-ms': '1' }),
    () => jsonResponse(payload),
  ]);
  const client = createJevClient({
    apiKey: 'test-key',
    fetch: fetchImpl,
    retry: { maxRetries: 2, backoffInitialMs: 1, backoffJitter: 0 },
  });
  const out = await judgeItem(client, newsItem);
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(fetchImpl.calls[1].init.headers['X-TypeSafe-Retry-Count'], '1');
  assert.equal(out.answers.relevant.noul, 0.97);
});

test('API キーが無ければ createJevClient は null を返す', () => {
  const saved = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    assert.equal(createJevClient(), null);
  } finally {
    if (saved !== undefined) process.env.TYPESAFE_API_KEY = saved;
  }
});
