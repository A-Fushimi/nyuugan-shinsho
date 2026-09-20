/** triage-sources.mjs のテスト（HTTP ヘッダ / KEGG パーサ / openFDA 事前フィルタと統合） */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HTTP_HEADERS,
  fetchWithHeaders,
  parseKegg,
  keggLineHasSubstance,
  logKeggDiagnostics,
  isMeaningfulSubmissionClass,
  openfdaItemsFromResults,
} from '../lib/triage-sources.mjs';

const known = new Set();

// ── A. HTTP ヘッダ ──

test('fetchWithHeaders はブラウザ風の User-Agent / Accept / Accept-Language を付ける', async () => {
  let seen = null;
  const fake = async (url, init) => {
    seen = { url, init };
    return { ok: true, text: async () => '' };
  };
  await fetchWithHeaders(fake, 'https://example.test/feed');
  assert.equal(seen.url, 'https://example.test/feed');
  assert.match(seen.init.headers['User-Agent'], /^Mozilla\/5\.0 \(compatible; nyuugan-shinsho-triage\/1\.0;/);
  assert.match(seen.init.headers.Accept, /application\/rss\+xml/);
  assert.equal(seen.init.headers['Accept-Language'], 'ja,en;q=0.8');
  assert.equal(HTTP_HEADERS['Accept-Language'], 'ja,en;q=0.8');
});

// ── B. KEGG パーサ ──

test('日付だけの行と Last updated 行は落とす', () => {
  const year = new Date().getFullYear();
  const html = [`${year}/12/22`, `Last updated: August 26, ${year}`, '   '].join('\n');
  assert.deepEqual(parseKegg(html, known), []);
});

test('keggLineHasSubstance: 日付以外に 8 文字以上の中身と文字が必要', () => {
  const year = new Date().getFullYear();
  assert.equal(keggLineHasSubstance(`${year}/12/22`), false);
  assert.equal(keggLineHasSubstance(`${year}-12-22 123456789`), false); // 数字だけ
  assert.equal(keggLineHasSubstance(`${year}-12-22 トラスツズマブ製剤 承認`), true);
});

test('日付＋実体のある行は拾う', () => {
  const year = new Date().getFullYear();
  const html = `<td>${year}-09-05</td><td>トラスツズマブBS点滴静注用150mg 承認</td>`;
  const items = parseKegg(html, known);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'kegg');
  assert.match(items[0].title, /トラスツズマブBS/);
  assert.equal(items[0].date, `${year}-09-05`);
});

test('BRITE の /entry/Dxxxxx アンカーから項目を作る', () => {
  const year = new Date().getFullYear();
  const html =
    `<tr><td>${year}-08-15</td><td><a href="/entry/D12345">Inavolisib (JAN/USAN)</a> PI3K阻害薬 乳癌 承認</td></tr>`;
  const items = parseKegg(html, known);
  const anchorItem = items.find((i) => i.meta?.keggEntry === 'D12345');
  assert.ok(anchorItem, 'アンカー由来の項目があること');
  assert.equal(anchorItem.title, 'Inavolisib (JAN/USAN)');
  assert.match(anchorItem.body, /PI3K阻害薬/);
  assert.equal(anchorItem.date, `${year}-08-15`);
});

test('抽出が 3 件未満なら診断ログを出す（読み取りのみ）', () => {
  const lines = ['<a href="/entry/D00001">Foo</a>', '乳癌の承認一覧', 'noise'];
  const out = [];
  logKeggDiagnostics(lines, 1, (m) => out.push(m));
  assert.match(out[0], /KEGG 診断: 抽出 1件 \/ 総行数 3/);
  assert.equal(out.length, 3); // ヘッダ + 該当 2 行
  assert.ok(out.some((l) => l.includes('Foo')));
  assert.ok(out.some((l) => l.includes('乳癌の承認一覧')));
});

test('診断ログの各行は 160 字で切られる', () => {
  const long = `乳${'あ'.repeat(400)}`;
  const out = [];
  logKeggDiagnostics([long], 0, (m) => out.push(m));
  assert.equal(out[1].length, '    | '.length + 160);
});

// ── D. openFDA ──

test('isMeaningfulSubmissionClass: 臨床的に意味のある区分だけ true', () => {
  assert.equal(isMeaningfulSubmissionClass('EFFICACY', 'Efficacy'), true);
  assert.equal(isMeaningfulSubmissionClass('', 'Efficacy-New Indication'), true);
  assert.equal(isMeaningfulSubmissionClass('TYPE 1', 'Type 1 - New Molecular Entity'), true);
  assert.equal(isMeaningfulSubmissionClass('TYPE 10', 'Type 10 - New Indication'), true);
  assert.equal(isMeaningfulSubmissionClass('LABELING', 'Labeling'), false);
  assert.equal(isMeaningfulSubmissionClass('MANUFACTURING (CMC)', 'Manufacturing (CMC)'), false);
  assert.equal(isMeaningfulSubmissionClass('REMS', 'REMS'), false);
  assert.equal(isMeaningfulSubmissionClass('BIOEQUIV', 'Bioequivalence'), false);
  // 区分が取れないものは落とさない
  assert.equal(isMeaningfulSubmissionClass('', ''), true);
  assert.equal(isMeaningfulSubmissionClass(undefined, undefined), true);
});

/** 実際の openFDA レスポンスに近い形の作り物 */
function fakeOpenfdaResults(dateYmd) {
  return [
    {
      application_number: 'BLA761139',
      sponsor_name: 'DAIICHI SANKYO',
      products: [{ brand_name: 'ENHERTU', dosage_form: 'INJECTION' }],
      submissions: [
        {
          submission_type: 'SUPPL',
          submission_number: '41',
          submission_status: 'AP',
          submission_status_date: dateYmd,
          submission_class_code: 'EFFICACY',
          submission_class_code_description: 'Efficacy',
        },
        {
          submission_type: 'SUPPL',
          submission_number: '43',
          submission_status: 'AP',
          submission_status_date: dateYmd,
          submission_class_code: 'EFFICACY',
          submission_class_code_description: 'Efficacy-New Indication',
        },
        {
          submission_type: 'SUPPL',
          submission_number: '44',
          submission_status: 'AP',
          submission_status_date: dateYmd,
          submission_class_code: 'LABELING',
          submission_class_code_description: 'Labeling',
        },
        {
          submission_type: 'SUPPL',
          submission_number: '45',
          submission_status: 'AP',
          submission_status_date: dateYmd,
          submission_class_code: 'MANUFACTURING (CMC)',
          submission_class_code_description: 'Manufacturing (CMC)',
        },
        {
          // 未承認（AP でない）ものは従来どおり対象外
          submission_type: 'SUPPL',
          submission_number: '46',
          submission_status: 'TA',
          submission_status_date: dateYmd,
          submission_class_code: 'EFFICACY',
          submission_class_code_description: 'Efficacy',
        },
      ],
    },
  ];
}

const recentYmd = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0].replace(/-/g, '');
const recentIso = `${recentYmd.slice(0, 4)}-${recentYmd.slice(4, 6)}-${recentYmd.slice(6, 8)}`;

test('Labeling / Manufacturing の一部変更は事前に落とす', () => {
  const items = openfdaItemsFromResults(
    'trastuzumab deruxtecan',
    'enhertu',
    fakeOpenfdaResults(recentYmd),
    known
  );
  assert.equal(items.length, 1); // 同日なのでマージされて 1 件
  assert.ok(!items[0].body.includes('#44'));
  assert.ok(!items[0].body.includes('#45'));
  assert.ok(!items[0].body.includes('#46'));
});

test('同一ブランド・同一日の SUPPL は 1 件にまとめ、body に全ての submission 番号を載せる', () => {
  const items = openfdaItemsFromResults(
    'trastuzumab deruxtecan',
    'enhertu',
    fakeOpenfdaResults(recentYmd),
    known
  );
  const [it] = items;
  assert.equal(it.date, recentIso);
  assert.match(it.title, /#41, #43/);
  assert.match(it.body, /SUPPL #41 \(Efficacy\) \/ SUPPL #43 \(Efficacy-New Indication\)/);
  assert.match(it.body, /^class: /m);
  assert.equal(it.meta.submissionClass, 'Efficacy / Efficacy-New Indication');
  assert.deepEqual(it.meta.submissions, ['SUPPL #41', 'SUPPL #43']);
});

test('日付が違えば別項目のまま', () => {
  const otherYmd = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const results = fakeOpenfdaResults(recentYmd);
  results[0].submissions[1].submission_status_date = otherYmd;
  const items = openfdaItemsFromResults('trastuzumab deruxtecan', 'enhertu', results, known);
  assert.equal(items.length, 2);
});

test('期間外（180日より前）のレコードは対象外', () => {
  const oldYmd = new Date(Date.now() - 400 * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const items = openfdaItemsFromResults(
    'trastuzumab deruxtecan',
    'enhertu',
    fakeOpenfdaResults(oldYmd),
    known
  );
  assert.deepEqual(items, []);
});
