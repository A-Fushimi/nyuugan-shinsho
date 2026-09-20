/**
 * 乳がん新書 — 収集（Collectors）と TriageItem への正規化
 *
 * Google ニュース RSS / oncolo.jp RSS / KEGG 新薬承認 / openFDA / ClinicalTrials.gov から情報を集め、
 * 共通スキーマ（設計書 §5 の TriageItem）に整える。
 * ここではキーワードによる取捨選択はしない（意味的判断は Jev に任せる）。
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { matchKnownDrugs } from './known-drugs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', '..', ...p);

export const SOURCE_NAMES = ['gnews', 'oncolo', 'kegg', 'openfda', 'ctgov'];

const OPENFDA_API = 'https://api.fda.gov/drug/drugsfda.json';
const ONCOLO_FEED = 'https://oncolo.jp/feed';
const KEGG_URL = 'https://www.kegg.jp/kegg/drug/br08318.html';

/** check-regulatory.mjs と同じ generic → brand 対応表 */
export const FDA_BRAND_MAP = {
  palbociclib: 'ibrance',
  ribociclib: 'kisqali',
  abemaciclib: 'verzenio',
  imlunestrant: 'imlunestrant',
  elacestrant: 'orserdu',
  alpelisib: 'piqray',
  inavolisib: 'itovebi',
  capivasertib: 'truqap',
  everolimus: 'afinitor',
  'trastuzumab deruxtecan': 'enhertu',
  'trastuzumab emtansine': 'kadcyla',
  tucatinib: 'tukysa',
  'sacituzumab govitecan': 'trodelvy',
  'datopotamab deruxtecan': 'datroway',
  olaparib: 'lynparza',
  talazoparib: 'talzenna',
  pembrolizumab: 'keytruda',
  lapatinib: 'tykerb',
  neratinib: 'nerlynx',
  margetuximab: 'margenza',
  gedatolisib: 'gedatolisib',
  vepdegestrant: 'vepdegestrant',
  camizestrant: 'camizestrant',
  giredestrant: 'giredestrant',
};

/** 安定した ID（URL や NCT 番号の sha1） */
export function makeId(source, key) {
  return `${source}:${createHash('sha1').update(String(key)).digest('hex').slice(0, 16)}`;
}

function stripTags(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // RSS の description は HTML がエスケープされていることが多いので、デコード後にもう一度タグを落とす
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toISODate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  const m = String(v).match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 共通 HTTP ──

/**
 * 外向きの取得はすべてここを通す。
 * 既定の Node fetch の User-Agent はボット判定されやすく、
 * 実際に oncolo.jp が GitHub Actions ランナーから HTTP 403 を返した（2026-09-20 の初回実行）。
 * ブラウザに近いヘッダを付けて取得する。
 */
export const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; nyuugan-shinsho-triage/1.0; +https://shinsho.bctube.org)',
  Accept: 'application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'ja,en;q=0.8',
};

/** fetchImpl は差し替え可能（テスト用）。第2引数のヘッダは HTTP_HEADERS に上書きされない */
export function fetchWithHeaders(fetchImpl, url, init = {}) {
  return fetchImpl(url, {
    ...init,
    headers: { ...HTTP_HEADERS, ...(init.headers || {}) },
  });
}

// ── oncolo.jp RSS ──

/** RSS の XML を TriageItem 配列に変換する（テストしやすいよう分離） */
export function parseOncoloFeed(xml, knownDrugs) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = re.exec(xml))) {
    const chunk = match[1];
    const title = stripTags(
      chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
    );
    const link = stripTags(chunk.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
    const body = stripTags(
      chunk.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1] ||
        chunk.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
        ''
    ).slice(0, 2000);
    const date = toISODate(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '');
    if (!title && !link) continue;
    items.push({
      id: makeId('oncolo', link || title),
      source: 'oncolo',
      title,
      body,
      url: link,
      date,
      meta: {},
      knownDrugs: matchKnownDrugs([title, body], knownDrugs),
    });
  }
  return items;
}

async function collectOncolo({ knownDrugs, fetchImpl }) {
  try {
    const resp = await fetchWithHeaders(fetchImpl, ONCOLO_FEED);
    if (!resp.ok) {
      // 2026-09-20 の調査: /feed /feed/ /?feed=rss2 /news のどれも、ブラウザ完全一致の UA でも
      // awselb/2.0 から 403 が返る。UA ではなく IP レベルの遮断なので、ここでは黙って諦め、
      // 日本語ニュースは gnews（Google ニュース RSS）で代替する。
      console.warn(
        `  ⚠ oncolo.jp RSS: HTTP ${resp.status}（GitHub Actions からは遮断されるため Google ニュースで代替）`
      );
      return [];
    }
    return parseOncoloFeed(await resp.text(), knownDrugs);
  } catch (e) {
    console.warn(`  ⚠ oncolo.jp RSS 取得エラー: ${e.message}`);
    return [];
  }
}

// ── Google ニュース RSS（日本語） ──

/**
 * oncolo.jp がデータセンターから遮断されているため、日本語ニュースの主経路はこちら。
 * news.google.com は GitHub Actions からも取得できる。
 */
export const GNEWS_QUERIES = [
  '乳がん 承認',
  '乳がん 申請 承認 薬',
  '乳がん 臨床試験 結果',
  '乳癌 新薬',
];

/** 直近 GNEWS_WINDOW_DAYS 日以内の記事だけを対象にする */
export const GNEWS_WINDOW_DAYS = 30;

/** クエリ 1 本ぶんの RSS URL */
export function gnewsUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
}

/** Google ニュースのタイトル末尾の ` - 媒体名` を落とす */
export function stripGnewsPublisher(title, publisher) {
  const t = String(title || '').trim();
  if (publisher && t.endsWith(` - ${publisher}`)) {
    return t.slice(0, -(publisher.length + 3)).trim();
  }
  return t.replace(/\s+-\s+[^-]{1,60}$/, '').trim();
}

/**
 * Google ニュース RSS を TriageItem 配列に変換する（1 クエリぶん）。
 * @param {string} xml
 * @param {Set<string>} knownDrugs
 * @param {{now?:Date, windowDays?:number, query?:string}} [opts]
 */
export function parseGnewsFeed(xml, knownDrugs, opts = {}) {
  const { now = new Date(), windowDays = GNEWS_WINDOW_DAYS, query = '' } = opts;
  const limitIso = new Date(now.getTime() - windowDays * 86400000)
    .toISOString()
    .split('T')[0];
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = re.exec(String(xml)))) {
    const chunk = match[1];
    const publisher = stripTags(
      chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || ''
    );
    const rawTitle = stripTags(chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
    const title = stripGnewsPublisher(rawTitle, publisher);
    const link = stripTags(chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
    const body = stripTags(
      chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || ''
    ).slice(0, 2000);
    const date = toISODate(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '');
    if (!link || !title) continue;
    if (!date || date < limitIso) continue;
    const meta = {};
    if (publisher) meta.publisher = publisher;
    if (query) meta.query = query;
    items.push({
      id: makeId('gnews', link),
      source: 'gnews',
      title,
      body,
      url: link,
      date,
      meta,
      knownDrugs: matchKnownDrugs([title, body], knownDrugs),
    });
  }
  return items;
}

/**
 * 複数クエリの RSS をまとめ、リンク（Google ニュースの記事 URL）で重複を除く。
 * @param {Array<string|{xml:string, query?:string}>} feeds
 */
export function parseGnewsFeeds(feeds, knownDrugs, opts = {}) {
  const seen = new Set();
  const out = [];
  for (const feed of feeds || []) {
    const xml = typeof feed === 'string' ? feed : feed?.xml;
    const query = typeof feed === 'string' ? '' : feed?.query || '';
    for (const item of parseGnewsFeed(xml, knownDrugs, { ...opts, query })) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item);
    }
  }
  return out;
}

async function collectGnews({ knownDrugs, fetchImpl }) {
  const feeds = [];
  for (const query of GNEWS_QUERIES) {
    try {
      await sleep(300);
      const resp = await fetchWithHeaders(fetchImpl, gnewsUrl(query));
      if (!resp.ok) {
        console.warn(`  ⚠ Google ニュース（${query}）: HTTP ${resp.status}`);
        continue;
      }
      feeds.push({ xml: await resp.text(), query });
    } catch (e) {
      console.warn(`  ⚠ Google ニュース（${query}）取得エラー: ${e.message}`);
    }
  }
  return parseGnewsFeeds(feeds, knownDrugs);
}

// ── KEGG 新薬承認 ──

/** 直近 KEGG_WINDOW_DAYS 日以内の承認だけを対象にする */
export const KEGG_WINDOW_DAYS = 120;

/** 日付セル（YYYY/M/D、ゼロ埋めなし） */
const KEGG_DATE_CELL_RE = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

/** KEGG BRITE の薬剤エントリへのリンク（D 番号） */
const KEGG_ENTRY_HREF_RE = /\/entry\/(D\d{5})/i;

/** ATC コードへのリンク（br08303） */
const KEGG_ATC_HREF_RE = /\/brite\/br08303\/([A-Z0-9]+)/i;

/** D 番号・ATC コード・日付だけで構成されたセルか（タイトルには使えない） */
export function isKeggCodeCell(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const compact = t.replace(/[\s(),/]/g, '');
  if (!compact) return true;
  // D番号 / ATC / 日付 / 4桁の薬効分類番号 / NME・BLA などの区分
  return /^(?:D\d{5}|[A-Z]\d{2}[A-Z]{2}\d{2}|\d{4}\d{1,2}\d{1,2}|\d{4}|NME|BLA|NCE)+$/i.test(compact);
}

/** HTML から `<tr>` ブロックごとの `<td>` セル（生 HTML と整形テキスト）を取り出す */
export function keggRows(html) {
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(String(html)))) {
    const cells = [];
    const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1]))) {
      cells.push({ raw: td[1], text: stripTags(td[1]) });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** YYYY/M/D → YYYY-MM-DD */
function keggIsoDate(text) {
  const m = String(text).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/**
 * KEGG 新薬承認リスト（br08318.html）の表を TriageItem 配列にする。
 *
 * 実物は 1 行 1 `<td>` の HTML テーブル（9712 行 / 319KB）で、
 * 「日付セル（YYYY/M/D）」と「/entry/Dxxxxx へのリンクを含むセル」の両方を持つ `<tr>` が承認行。
 *
 * @param {string} html
 * @param {Set<string>} knownDrugs
 * @param {{now?:Date, windowDays?:number, logger?:Function}} [opts]
 */
export function parseKegg(html, knownDrugs, opts = {}) {
  const { now = new Date(), windowDays = KEGG_WINDOW_DAYS, logger = console.log } = opts;
  const limitIso = new Date(now.getTime() - windowDays * 86400000)
    .toISOString()
    .split('T')[0];
  const rows = keggRows(html);
  const items = [];
  const seen = new Set();
  let approvalRows = 0;

  for (const cells of rows) {
    const dateIdx = cells.findIndex((c) => KEGG_DATE_CELL_RE.test(c.text));
    const entryIdx = cells.findIndex((c) => KEGG_ENTRY_HREF_RE.test(c.raw));
    if (dateIdx < 0 || entryIdx < 0) continue;
    const dNo = cells[entryIdx].raw.match(KEGG_ENTRY_HREF_RE)[1].toUpperCase();
    approvalRows += 1;

    const iso = keggIsoDate(cells[dateIdx].text);
    if (!iso || iso < limitIso) continue;

    const atcIdx = cells.findIndex((c) => KEGG_ATC_HREF_RE.test(c.raw));
    const atc = atcIdx >= 0 ? cells[atcIdx].raw.match(KEGG_ATC_HREF_RE)[1].toUpperCase() : '';

    const after = Math.max(dateIdx, entryIdx, atcIdx) + 1;
    // 実ページの列: 日付 | D番号 | (ATC) | 薬効分類 | 一般名 | 販売名 | 会社 | NME/BLA
    const textCells = cells.slice(after).map((c) => c.text).filter((t) => t && !isKeggCodeCell(t));
    const [nameCell, brandCell, companyCell] = textCells;
    let title = nameCell || '';
    if (brandCell) title += `（${brandCell}）`;
    if (companyCell) title += ` ${companyCell}`;
    if (!title) title = `KEGG 新薬承認 ${dNo} (${iso})`;

    const key = `${dNo}:${iso}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const body = cells
      .map((c) => c.text)
      .filter(Boolean)
      .join(' | ')
      .slice(0, 2000);
    const meta = { keggEntry: dNo };
    if (atc) meta.atc = atc;

    items.push({
      id: makeId('kegg', `${dNo}${iso}`),
      source: 'kegg',
      title: title.slice(0, 200),
      body,
      url: `https://www.kegg.jp/entry/${dNo}`,
      date: iso,
      meta,
      knownDrugs: matchKnownDrugs([title, body], knownDrugs),
    });
  }

  if (approvalRows < 1) logKeggDiagnostics(html, items.length, logger);
  return items;
}

/**
 * 承認行が 1 件も取れなかったときだけ、先頭 5 つの `<tr>` のセルを出す（読み取りのみ）。
 */
export function logKeggDiagnostics(html, found, logger = console.log) {
  const rows = keggRows(html);
  logger(`  ⓘ KEGG 診断: 抽出 ${found}件 / <tr> ${rows.length}個`);
  if (rows.length === 0) {
    logger('    | （<tr> が 1 つも見つかりませんでした）');
    return;
  }
  for (const cells of rows.slice(0, 5)) {
    logger(`    | ${cells.map((c) => c.text).join(' | ').slice(0, 160)}`);
  }
}

async function collectKegg({ knownDrugs, fetchImpl }) {
  try {
    const resp = await fetchWithHeaders(fetchImpl, KEGG_URL);
    if (!resp.ok) {
      console.warn(`  ⚠ KEGG: HTTP ${resp.status}`);
      return [];
    }
    return parseKegg(await resp.text(), knownDrugs);
  } catch (e) {
    console.warn(`  ⚠ KEGG 取得エラー: ${e.message}`);
    return [];
  }
}

// ── openFDA ──

/** 直近 openfdaWindowDays 日以内の承認レコードのみを対象にする */
export const OPENFDA_WINDOW_DAYS = 180;

/**
 * submission class（submission_class_code / submission_class_code_description）が
 * 臨床的に意味のある区分かどうか。
 * Labeling / Manufacturing (CMC) / REMS / 生物学的同等性などの一部変更は落とす。
 * 区分が取れないレコードは落とさない（安全側）。
 */
export function isMeaningfulSubmissionClass(code, description) {
  const text = `${code || ''} ${description || ''}`.trim();
  if (!text) return true; // 区分不明 → 残す
  const upper = text.toUpperCase();
  // 効能・効果に関わるもの、新規 NDA/BLA（TYPE 1〜10）は残す
  if (/EFFICACY|NEW INDICATION|ORIGINAL/.test(upper)) return true;
  if (/\bTYPE\s*(10|[1-9])\b/.test(upper)) return true;
  // 臨床的な意味を持たない一部変更は落とす
  if (
    /LABELING|LABEL CHANGE|MANUFACTUR|CMC|CHEMISTRY|REMS|BIOEQUIV|MEDGUIDE|PACKAG|WITHDRAW|ANNUAL REPORT|SAFETY UPDATE|PRODUCT LABELING/.test(
      upper
    )
  ) {
    return false;
  }
  return true; // 未知の区分 → 残す
}

/**
 * 同一ブランド・同一日の複数 SUPPL を 1 件にまとめる。
 * （初回実行で enhertu の #41 と #43 が同じ 2026-05-15 に別項目として並んだ）
 */
export function mergeOpenfdaRecords(records, generic, brand, knownDrugs) {
  const groups = new Map();
  for (const rec of records) {
    const key = `${brand}|${rec.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }
  const items = [];
  for (const [, group] of groups) {
    group.sort((a, b) => String(a.number).localeCompare(String(b.number), 'en', { numeric: true }));
    const first = group[0];
    const iso = first.date;
    const numbers = group.map((r) => `#${r.number}`).join(', ');
    const types = [...new Set(group.map((r) => r.type))].join('/');
    const classes = [...new Set(group.map((r) => r.classDesc).filter(Boolean))];
    const title = `FDA ${types} ${numbers} 承認: ${brand}（${generic}）${iso}`;
    const body = [
      `application: ${first.application}`,
      `sponsor: ${first.sponsor}`,
      `submissions: ${group.map((r) => `${r.type} #${r.number} (${r.classDesc || r.classCode || '—'})`).join(' / ')}`,
      `class: ${classes.join(' / ') || '—'}`,
      `products: ${first.products}`,
    ].join('\n');
    items.push({
      id: makeId('openfda', `${first.application}:${brand}:${iso}:${group.map((r) => r.number).join(',')}`),
      source: 'openfda',
      title,
      body,
      url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${String(first.application).replace(/\D/g, '')}`,
      date: iso,
      meta: {
        generic,
        brand,
        application: first.application,
        submissionClass: classes.join(' / ') || first.classCode || '',
        submissions: group.map((r) => `${r.type} #${r.number}`),
      },
      knownDrugs: matchKnownDrugs([generic, brand, title], knownDrugs),
    });
  }
  return items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function openfdaItemsFromResults(generic, brand, results, knownDrugs, windowDays = OPENFDA_WINDOW_DAYS) {
  const limitDate = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const records = [];
  for (const result of results || []) {
    const appNo = result.application_number || '';
    for (const sub of result.submissions || []) {
      if (sub.submission_status !== 'AP') continue;
      const date = sub.submission_status_date || '';
      if (!date || date < limitDate) continue;
      if (!isMeaningfulSubmissionClass(sub.submission_class_code, sub.submission_class_code_description)) {
        continue;
      }
      records.push({
        application: appNo,
        sponsor: result.sponsor_name || '',
        type: sub.submission_type || '',
        number: sub.submission_number || '',
        classCode: sub.submission_class_code || '',
        classDesc: sub.submission_class_code_description || '',
        date: toISODate(date),
        products: (result.products || []).map((p) => `${p.brand_name || ''} ${p.dosage_form || ''}`).join(', '),
      });
    }
  }
  return mergeOpenfdaRecords(records, generic, brand, knownDrugs);
}

async function collectOpenFDA({ knownDrugs, fetchImpl }) {
  const items = [];
  for (const [generic, brand] of Object.entries(FDA_BRAND_MAP)) {
    try {
      await sleep(300);
      const url = `${OPENFDA_API}?search=openfda.brand_name:"${brand}"&limit=5`;
      const resp = await fetchWithHeaders(fetchImpl, url);
      if (!resp.ok) continue;
      const data = await resp.json();
      items.push(...openfdaItemsFromResults(generic, brand, data.results, knownDrugs));
    } catch (e) {
      console.warn(`  ⚠ openFDA (${brand}) 取得エラー: ${e.message}`);
    }
  }
  return items;
}

// ── ClinicalTrials.gov（ローカルのスナップショットを使う） ──

export function ctgovItemsFromStudies(studies, knownDrugs) {
  const items = [];
  for (const s of studies || []) {
    if (!s?.nct) continue;
    const interventions = (s.interventions || []).join(', ');
    const body = [
      `conditions: ${(s.conditions || []).join(', ')}`,
      `interventions: ${interventions}`,
      `phase: ${s.phase || ''} / status: ${s.status || ''} / enrollment: ${s.enrollment ?? ''}`,
      (s.intervention_descs || []).join(' '),
    ]
      .join('\n')
      .slice(0, 2000);
    items.push({
      id: makeId('ctgov', s.nct),
      source: 'ctgov',
      title: s.title || s.nct,
      body,
      url: `https://clinicaltrials.gov/study/${s.nct}`,
      date: s.first_posted || s.start_date || '',
      meta: {
        nct: s.nct,
        sponsor: s.sponsor || '',
        phase: s.phase || '',
        status: s.status || '',
      },
      knownDrugs: matchKnownDrugs([s.title, interventions], knownDrugs),
    });
  }
  // 新しい登録から順に
  return items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function collectCtgov({ knownDrugs }) {
  const filtered = resolve('data/ctgov_filtered.json');
  const raw = resolve('data/ctgov_raw.json');
  const path = existsSync(filtered) ? filtered : raw;
  if (!existsSync(path)) {
    console.warn('  ⚠ ctgov: data/ctgov_filtered.json も data/ctgov_raw.json も見つかりません');
    return [];
  }
  try {
    const studies = JSON.parse(readFileSync(path, 'utf-8'));
    return ctgovItemsFromStudies(Array.isArray(studies) ? studies : [], knownDrugs);
  } catch (e) {
    console.warn(`  ⚠ ctgov: ${path} を読めませんでした (${e.message})`);
    return [];
  }
}

/**
 * 指定ソースから収集して TriageItem 配列を返す。
 * @param {{sources?:string[], knownDrugs:Set<string>, fetchImpl?:Function}} opts
 */
export async function collect({ sources = SOURCE_NAMES, knownDrugs, fetchImpl = fetch } = {}) {
  const out = [];
  for (const name of sources) {
    let items = [];
    switch (name) {
      case 'gnews':
        items = await collectGnews({ knownDrugs, fetchImpl });
        break;
      case 'oncolo':
        items = await collectOncolo({ knownDrugs, fetchImpl });
        break;
      case 'kegg':
        items = await collectKegg({ knownDrugs, fetchImpl });
        break;
      case 'openfda':
        items = await collectOpenFDA({ knownDrugs, fetchImpl });
        break;
      case 'ctgov':
        items = collectCtgov({ knownDrugs });
        break;
      default:
        console.warn(`  ⚠ 未知のソース: ${name}`);
    }
    console.log(`  - ${name}: ${items.length}件`);
    out.push(...items);
  }
  return out;
}

export default { collect, SOURCE_NAMES, makeId };
