/** triage-sources.mjs のテスト（HTTP ヘッダ / KEGG パーサ / Google ニュース / openFDA 事前フィルタと統合） */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  GNEWS_QUERIES,
  GNEWS_WINDOW_DAYS,
  HTTP_HEADERS,
  KEGG_WINDOW_DAYS,
  fetchWithHeaders,
  gnewsUrl,
  isKeggCodeCell,
  isMeaningfulSubmissionClass,
  logKeggDiagnostics,
  makeId,
  openfdaItemsFromResults,
  parseGnewsFeed,
  parseGnewsFeeds,
  parseKegg,
  stripGnewsPublisher,
} from '../lib/triage-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// ── B. KEGG パーサ（<tr> ベース） ──

const keggHtml = readFileSync(join(__dirname, 'fixtures/kegg.sample.html'), 'utf-8');
/** fixture の日付を基準にした「今日」。窓（120日）の内側に 3 行、外側に 1 行ある */
const keggNow = new Date('2026-09-20T00:00:00Z');

test('KEGG: <tr> ベースで承認行だけを拾う（窓 120 日）', () => {
  const items = parseKegg(keggHtml, known, { now: keggNow });
  assert.equal(items.length, 4); // 2026/2/10 の行は 120 日より前なので落ちる
  assert.ok(items.every((i) => i.source === 'kegg'));
  assert.ok(!items.some((i) => i.meta.keggEntry === 'D09996'));
});

test('KEGG: 日付は YYYY/M/D を ISO に変換する', () => {
  const [first] = parseKegg(keggHtml, known, { now: keggNow });
  assert.equal(first.date, '2026-09-16');
  assert.equal(parseKegg(keggHtml, known, { now: keggNow })[2].date, '2026-08-03');
});

test('KEGG: D 番号・ATC・URL・ID を meta に入れる', () => {
  const [first] = parseKegg(keggHtml, known, { now: keggNow });
  assert.equal(first.meta.keggEntry, 'D11529');
  assert.equal(first.meta.atc, 'L01FD04');
  assert.equal(first.url, 'https://www.kegg.jp/entry/D11529');
  assert.equal(first.id, makeId('kegg', 'D115292026-09-16'));
});

test('KEGG: タイトルは D 番号だけのコードにならない（薬剤名を採る）', () => {
  const items = parseKegg(keggHtml, known, { now: keggNow });
  for (const it of items) {
    assert.ok(!/^D\d{5}$/.test(it.title), `タイトルが D 番号のまま: ${it.title}`);
  }
  assert.match(items[0].title, /エンハーツ点滴静注用100mg/);
  assert.match(items[0].title, /Trastuzumab deruxtecan & HER2/); // &amp; はデコードされる
  assert.match(items[1].title, /イトベビー錠/);
});

test('KEGG: body は行の全セルを | で連結する', () => {
  const [first] = parseKegg(keggHtml, known, { now: keggNow });
  assert.match(first.body, /2026\/9\/16 \| D11529 \| \( L01FD04 \) \| エンハーツ/);
  assert.match(first.body, /第一三共 \| HER2低発現の手術不能又は再発乳癌$/);
  assert.ok(first.body.length <= 2000);
});

test('KEGG: 窓（KEGG_WINDOW_DAYS）を動かせば古い行も入る', () => {
  assert.equal(KEGG_WINDOW_DAYS, 120);
  const items = parseKegg(keggHtml, known, { now: keggNow, windowDays: 400 });
  assert.equal(items.length, 5);
  assert.equal(items[3].meta.keggEntry, 'D09996');
});

test('KEGG: タイトルになる列が無ければ D 番号と日付のフォールバック', () => {
  const html =
    '<tr><td>2026/9/1</td><td><a href="/entry/D99999">D99999</a></td><td>(<a href="/brite/br08303/L01XX99">L01XX99</a>)</td><td>&nbsp;</td></tr>';
  const [it] = parseKegg(html, known, { now: keggNow });
  assert.equal(it.title, 'KEGG 新薬承認 D99999 (2026-09-01)');
});

test('KEGG: 日付だけ・D 番号だけの行は承認行ではない', () => {
  const html = [
    '<tr><td>2026/9/1</td><td>Last updated</td></tr>',
    '<tr><td><a href="/entry/D12345">D12345</a></td><td>名前だけ</td></tr>',
  ].join('\n');
  assert.deepEqual(parseKegg(html, known, { now: keggNow, logger: () => {} }), []);
});

test('KEGG: 承認行が 0 件なら先頭 5 つの <tr> のセルを診断出力する', () => {
  const out = [];
  parseKegg('<tr><td>2026/9/1</td><td>Last updated</td></tr>', known, {
    now: keggNow,
    logger: (m) => out.push(m),
  });
  assert.match(out[0], /KEGG 診断: 抽出 0件 \/ <tr> 1個/);
  assert.ok(out.some((l) => l.includes('2026/9/1 | Last updated')));
});

test('logKeggDiagnostics は先頭 5 行・各 160 字まで', () => {
  const rows = Array.from(
    { length: 8 },
    (_, i) => `<tr><td>row${i}</td><td>${'あ'.repeat(400)}</td></tr>`
  ).join('\n');
  const out = [];
  logKeggDiagnostics(rows, 0, (m) => out.push(m));
  assert.equal(out.length, 6); // ヘッダ + 5 行
  assert.equal(out[1].length, '    | '.length + 160);
});

test('isKeggCodeCell: コードだけのセルを見分ける', () => {
  assert.equal(isKeggCodeCell('D12615'), true);
  assert.equal(isKeggCodeCell('(L01FD04)'), true);
  assert.equal(isKeggCodeCell(''), true);
  assert.equal(isKeggCodeCell('エンハーツ点滴静注用100mg'), false);
  assert.equal(isKeggCodeCell('第一三共'), false);
  assert.equal(isKeggCodeCell('4291'), true); // 薬効分類番号
  assert.equal(isKeggCodeCell('NME'), true);
  assert.equal(isKeggCodeCell('Camizestrant'), false);
});

test('KEGG: 実ページの列構成（一般名｜販売名｜会社）からタイトルを組み立てる', () => {
  const items = parseKegg(keggHtml, known, { now: keggNow });
  const cami = items.find((it) => it.meta.keggEntry === 'D12049');
  assert.ok(cami, 'D12049 が抽出される');
  assert.equal(cami.title, 'Camizestrant（Etcamah） AstraZeneca');
  assert.equal(cami.meta.atc, 'L02BA05');
  assert.ok(cami.knownDrugs.includes('camizestrant'));
});

  assert.equal(items.length, 1);
  assert.ok(!items[0].body.includes('<a'), items[0].body);
  assert.ok(!items[0].body.includes('href='), items[0].body);
});

// ── C. Google ニュース RSS ──

/** Google ニュース RSS に近い作り物（1 クエリぶん） */
function gnewsXml(entries) {
  const items = entries
    .map(
      (e) => `<item><title>${e.title} - ${e.publisher}</title>` +
        `<link>${e.link}</link><guid isPermaLink="false">${e.link}</guid>` +
        `<pubDate>${e.pubDate}</pubDate>` +
        `<description>&lt;a href="${e.link}"&gt;${e.title}&lt;/a&gt;&nbsp;&nbsp;${e.publisher}</description>` +
        `<source url="https://example.test">${e.publisher}</source></item>`
    )
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>乳がん 承認 - Google ニュース</title>${items}</channel></rss>`;
}

const GN_LINK_A = 'https://news.google.com/rss/articles/CBMiAAAA-shared';
const GN_LINK_B = 'https://news.google.com/rss/articles/CBMiBBBB-only-in-2nd';
const GN_LINK_OLD = 'https://news.google.com/rss/articles/CBMiCCCC-old';
const gnewsNow = new Date('2026-09-20T00:00:00Z');

test('gnews: description のエスケープ済み HTML はタグごと落ちる', () => {
  const items = parseGnewsFeed(gnewsXml([
    { title: 'テスト記事', publisher: 'テスト社', link: 'https://news.google.com/rss/articles/x1', pubDate: 'Fri, 18 Sep 2026 00:00:00 GMT' },
  ]), known, { now: new Date('2026-09-20T00:00:00Z') });

test('gnewsUrl: 日本語版の検索 RSS URL を組み立てる', () => {
  assert.equal(
    gnewsUrl('乳がん 承認'),
    `https://news.google.com/rss/search?q=${encodeURIComponent('乳がん 承認')}&hl=ja&gl=JP&ceid=JP:ja`
  );
  assert.deepEqual(GNEWS_QUERIES[0], '乳がん 承認');
  assert.equal(GNEWS_QUERIES.length, 4);
  assert.equal(GNEWS_WINDOW_DAYS, 30);
});

test('gnews: 2 クエリで重複したリンクは 1 件にまとめ、古い記事は落とす', () => {
  const feedA = gnewsXml([
    {
      title: 'エンハーツ、HER2低発現乳がんに国内承認',
      publisher: '日経バイオテク',
      link: GN_LINK_A,
      pubDate: 'Wed, 16 Sep 2026 03:00:00 GMT',
    },
    {
      title: '【2025年回顧】乳がん薬物療法の歩み',
      publisher: 'ミクスOnline',
      link: GN_LINK_OLD,
      pubDate: 'Mon, 01 Jun 2026 01:00:00 GMT',
    },
  ]);
  const feedB = gnewsXml([
    {
      title: 'エンハーツ、HER2低発現乳がんに国内承認',
      publisher: '日経バイオテク',
      link: GN_LINK_A,
      pubDate: 'Wed, 16 Sep 2026 03:00:00 GMT',
    },
    {
      title: '新規経口SERD、国内で承認申請',
      publisher: 'Answers News',
      link: GN_LINK_B,
      pubDate: 'Thu, 10 Sep 2026 02:00:00 GMT',
    },
  ]);
  const items = parseGnewsFeeds(
    [
      { xml: feedA, query: '乳がん 承認' },
      { xml: feedB, query: '乳癌 新薬' },
    ],
    known,
    { now: gnewsNow }
  );
  assert.equal(items.length, 2); // 重複 1 件 + 30 日より前の 1 件を除外
  assert.deepEqual(items.map((i) => i.url), [GN_LINK_A, GN_LINK_B]);
});

test('gnews: publisher を meta に入れ、タイトル末尾の媒体名を落とす', () => {
  const xml = gnewsXml([
    {
      title: 'エンハーツ、HER2低発現乳がんに国内承認',
      publisher: '日経バイオテク',
      link: GN_LINK_A,
      pubDate: 'Wed, 16 Sep 2026 03:00:00 GMT',
    },
  ]);
  const [it] = parseGnewsFeed(xml, known, { now: gnewsNow, query: '乳がん 承認' });
  assert.equal(it.source, 'gnews');
  assert.equal(it.title, 'エンハーツ、HER2低発現乳がんに国内承認');
  assert.equal(it.meta.publisher, '日経バイオテク');
  assert.equal(it.meta.query, '乳がん 承認');
  assert.equal(it.date, '2026-09-16');
  assert.equal(it.url, GN_LINK_A);
  assert.equal(it.id, makeId('gnews', GN_LINK_A));
});

test('stripGnewsPublisher: 媒体名が分からなくても末尾の ` - …` を落とす', () => {
  assert.equal(stripGnewsPublisher('見出し - 媒体名', '媒体名'), '見出し');
  assert.equal(stripGnewsPublisher('見出し - 媒体名', ''), '見出し');
  assert.equal(stripGnewsPublisher('見出しだけ', ''), '見出しだけ');
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
