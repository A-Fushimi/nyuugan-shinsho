/**
 * 乳がん新書 — 収集（Collectors）と TriageItem への正規化
 *
 * oncolo.jp RSS / KEGG 新薬承認 / openFDA / ClinicalTrials.gov から情報を集め、
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

export const SOURCE_NAMES = ['oncolo', 'kegg', 'openfda', 'ctgov'];

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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
      console.warn(`  ⚠ oncolo.jp RSS: HTTP ${resp.status}`);
      return [];
    }
    return parseOncoloFeed(await resp.text(), knownDrugs);
  } catch (e) {
    console.warn(`  ⚠ oncolo.jp RSS 取得エラー: ${e.message}`);
    return [];
  }
}

// ── KEGG 新薬承認 ──

/** 明らかに新薬承認ではない行（ページのフッタ等） */
const KEGG_DENY_RE = /last\s+updated|copyright|all\s+rights\s+reserved|kegg\s+drug\s+database/i;

/** 日付らしきトークン（除去して「日付以外の中身」を数えるために使う） */
const KEGG_DATE_TOKEN_RE =
  /\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{4}\s*[-/.]\s*\d{1,2}|\d{4}\s*年|\d{4}/g;

/** 文字（英字・かな・漢字）を含むか */
const KEGG_LETTER_RE = /[A-Za-z぀-ゟ゠-ヿ一-鿿]/;

/** 「日付以外の中身」が 8 文字以上あり、かつ文字を含むか */
export function keggLineHasSubstance(line, minChars = 8) {
  const rest = String(line || '')
    .replace(KEGG_DATE_TOKEN_RE, ' ')
    .replace(/[\s\d.,:;/()\[\]|+-]+/g, '');
  return rest.length >= minChars && KEGG_LETTER_RE.test(rest);
}

/** KEGG BRITE の薬剤エントリへのリンク（D 番号） */
const KEGG_ENTRY_RE = /<a[^>]+href="[^"]*\/entry\/(D\d{5})"[^>]*>([\s\S]*?)<\/a>/gi;

function keggItem(key, title, body, knownDrugs, meta = {}) {
  return {
    id: makeId('kegg', key),
    source: 'kegg',
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 2000),
    url: KEGG_URL,
    date: toISODate(String(body).match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] || '') || '',
    meta,
    knownDrugs: matchKnownDrugs([title, body], knownDrugs),
  };
}

/**
 * KEGG の HTML から新薬承認らしき行を拾う。
 *
 * 2026-09-20 の初回実行では「2025/12/22」「Last updated: August 26, 2026」のような
 * 日付だけの行を拾ってしまっていたので、
 *   (1) 日付を含み、かつ日付以外に 8 文字以上（文字を含む）の中身がある行
 *   (2) BRITE の /entry/Dxxxxx へのリンク（アンカー文字列＋その行）
 * の 2 通りで候補を作る。
 */
export function parseKegg(html, knownDrugs) {
  const year = new Date().getFullYear();
  const yearRe = new RegExp(`(${year}|${year - 1})`);
  const seenKeys = new Set();
  const items = [];
  const lines = String(html).split('\n');

  for (const raw of lines) {
    const line = stripTags(raw);

    // (2) BRITE: /entry/Dxxxxx へのアンカー
    KEGG_ENTRY_RE.lastIndex = 0;
    let m;
    while ((m = KEGG_ENTRY_RE.exec(raw))) {
      const dNo = m[1];
      const anchor = stripTags(m[2]);
      if (!anchor) continue;
      const key = `${dNo}:${anchor}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const body = line && line !== anchor ? `${anchor} — ${line}` : anchor;
      items.push(keggItem(key, anchor, body, knownDrugs, { keggEntry: dNo }));
    }

    // (1) 日付を含む実体のある行
    if (!line || line.length < 10 || !yearRe.test(line)) continue;
    if (KEGG_DENY_RE.test(line)) continue;
    if (!keggLineHasSubstance(line)) continue;
    if (seenKeys.has(line)) continue;
    seenKeys.add(line);
    items.push(keggItem(line, line, line, knownDrugs));
  }

  if (items.length < 3) logKeggDiagnostics(lines, items.length);
  return items;
}

/**
 * 収穫が少ないときだけ、次回 CI でページ構造が分かるように手掛かりを出す（読み取りのみ）。
 */
export function logKeggDiagnostics(lines, found, logger = console.log) {
  logger(`  ⓘ KEGG 診断: 抽出 ${found}件 / 総行数 ${lines.length}`);
  let shown = 0;
  for (const raw of lines) {
    if (shown >= 15) break;
    const line = stripTags(raw);
    const hit = raw.includes('/entry/D') || line.includes('乳') || line.includes('承認');
    if (!hit || !line) continue;
    logger(`    | ${line.slice(0, 160)}`);
    shown += 1;
  }
  if (shown === 0) logger('    | （乳 / /entry/D / 承認 を含む行はありませんでした）');
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
