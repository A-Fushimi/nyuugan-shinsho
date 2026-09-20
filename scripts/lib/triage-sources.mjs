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
    const resp = await fetchImpl(ONCOLO_FEED);
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

/** KEGG の HTML から新薬承認らしき行を拾う */
export function parseKegg(html, knownDrugs) {
  const year = new Date().getFullYear();
  const yearRe = new RegExp(`(${year}|${year - 1})`);
  const seen = new Set();
  const items = [];
  for (const raw of String(html).split('\n')) {
    const line = stripTags(raw);
    if (!line || line.length < 10 || !yearRe.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    items.push({
      id: makeId('kegg', line),
      source: 'kegg',
      title: line.slice(0, 200),
      body: line.slice(0, 2000),
      url: KEGG_URL,
      date: toISODate(line.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] || '') || '',
      meta: {},
      knownDrugs: matchKnownDrugs([line], knownDrugs),
    });
  }
  return items;
}

async function collectKegg({ knownDrugs, fetchImpl }) {
  try {
    const resp = await fetchImpl(KEGG_URL);
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

export function openfdaItemsFromResults(generic, brand, results, knownDrugs, windowDays = OPENFDA_WINDOW_DAYS) {
  const limitDate = new Date(Date.now() - windowDays * 86400000).toISOString().split('T')[0].replace(/-/g, '');
  const items = [];
  for (const result of results || []) {
    const appNo = result.application_number || '';
    for (const sub of result.submissions || []) {
      if (sub.submission_status !== 'AP') continue;
      const date = sub.submission_status_date || '';
      if (!date || date < limitDate) continue;
      const iso = toISODate(date);
      const title = `FDA ${sub.submission_type} #${sub.submission_number} 承認: ${brand}（${generic}）${iso}`;
      const body = [
        `application: ${appNo}`,
        `sponsor: ${result.sponsor_name || ''}`,
        `submission: ${sub.submission_type} #${sub.submission_number} (${sub.submission_class_code_description || sub.submission_class_code || ''})`,
        `products: ${(result.products || []).map((p) => `${p.brand_name || ''} ${p.dosage_form || ''}`).join(', ')}`,
      ].join('\n');
      items.push({
        id: makeId('openfda', `${appNo}:${sub.submission_type}:${sub.submission_number}:${date}`),
        source: 'openfda',
        title,
        body,
        url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${String(appNo).replace(/\D/g, '')}`,
        date: iso,
        meta: { generic, brand, application: appNo },
        knownDrugs: matchKnownDrugs([generic, brand, title], knownDrugs),
      });
    }
  }
  return items;
}

async function collectOpenFDA({ knownDrugs, fetchImpl }) {
  const items = [];
  for (const [generic, brand] of Object.entries(FDA_BRAND_MAP)) {
    try {
      await sleep(300);
      const url = `${OPENFDA_API}?search=openfda.brand_name:"${brand}"&limit=5`;
      const resp = await fetchImpl(url);
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
