/**
 * 乳がん新書 — 既知薬剤セットの構築と照合
 *
 * `scripts/landscape_dedup.py` の extract_known_drugs / is_known_drug を JS に移植したもの。
 * src/data/drugs.json の generic / name（括弧内の英字名を含む）と、
 * 手書きのエイリアス表から既知薬剤の集合を作る。
 *
 * 判定（Jev）には渡さず、あくまでコード側の事実確認として使う。
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolve = (...p) => join(__dirname, '..', '..', ...p);

/** landscape_dedup.py と同じ手書きエイリアス表（開発コード・商品名） */
export const DRUG_ALIASES = {
  'trastuzumab deruxtecan': ['t-dxd', 'ds-8201', 'enhertu'],
  'trastuzumab emtansine': ['t-dm1', 'kadcyla'],
  'sacituzumab govitecan': ['trodelvy', 'sac-gov'],
  'datopotamab deruxtecan': ['dato-dxd', 'datroway'],
  'sacituzumab tirumotecan': ['sac-tmt', 'shr-a1921'],
  pembrolizumab: ['keytruda', 'mk-3475'],
  palbociclib: ['ibrance'],
  abemaciclib: ['verzenio'],
  ribociclib: ['kisqali'],
  olaparib: ['lynparza'],
  talazoparib: ['talzenna'],
  tucatinib: ['tukysa'],
  camizestrant: ['azd9833'],
  vepdegestrant: ['arv-471'],
  imlunestrant: ['ly3484356'],
  elacestrant: ['rad1901'],
  giredestrant: ['gdc-9545'],
  alpelisib: ['piqray', 'byl719'],
  inavolisib: ['gdc-0077', 'itovebi'],
  capivasertib: ['azd5363', 'truqap'],
  atirmociclib: ['pf-07264090'],
  gedatolisib: ['pf-05212384'],
  prifetrastat: ['pf-07934312'],
  pumitamig: ['bnt327', 'pm8002'],
  'patritumab deruxtecan': ['her3-dxd', 'u3-1402'],
};

/** 短すぎる語は誤マッチの温床なので除外する（"er" など） */
const MIN_TOKEN_LENGTH = 4;

/**
 * drugs.json（配列）から既知薬剤名の集合を作る。
 * @param {Array<object>} drugs drugs.json の中身
 * @returns {Set<string>} 小文字化した薬剤名・エイリアスの集合
 */
export function buildKnownDrugs(drugs = []) {
  const known = new Set();
  const add = (v) => {
    const s = String(v || '').toLowerCase().trim();
    if (s.length >= MIN_TOKEN_LENGTH) known.add(s);
  };

  for (const d of drugs) {
    add(d?.generic);
    const name = String(d?.name || '').toLowerCase().trim();
    if (name) {
      add(name);
      // 「パルボシクリブ（イブランス）」のような括弧内も拾う
      for (const m of name.matchAll(/[（(]([^）)]+)[）)]/g)) add(m[1]);
    }
  }

  for (const [base, aliases] of Object.entries(DRUG_ALIASES)) {
    add(base);
    for (const a of aliases) add(a);
  }

  return known;
}

/**
 * drugs.json を読み込んで既知薬剤セットを返す。
 * @param {string} [path] drugs.json のパス（既定: src/data/drugs.json）
 */
export function loadKnownDrugs(path = resolve('src/data/drugs.json')) {
  try {
    const drugs = JSON.parse(readFileSync(path, 'utf-8'));
    return buildKnownDrugs(Array.isArray(drugs) ? drugs : []);
  } catch (e) {
    console.warn(`  ⚠ drugs.json を読めませんでした (${e.message})。既知薬剤はエイリアスのみで構築します`);
    return buildKnownDrugs([]);
  }
}

/**
 * 任意のテキスト群から既知薬剤を拾う。
 * @param {string|string[]} texts 検索対象（タイトル・本文・介入名など）
 * @param {Set<string>} known buildKnownDrugs / loadKnownDrugs の戻り値
 * @returns {string[]} マッチした既知薬剤名（重複なし・出現順）
 */
export function matchKnownDrugs(texts, known) {
  const hay = (Array.isArray(texts) ? texts : [texts])
    .map((t) => String(t || '').toLowerCase())
    .join(' \n ');
  if (!hay.trim()) return [];

  const hits = [];
  for (const kd of known) {
    if (hay.includes(kd)) hits.push(kd);
  }
  // 長いものを優先して、他の薬剤名に完全に含まれる短い別名は落とす
  hits.sort((a, b) => b.length - a.length);
  const out = [];
  for (const h of hits) {
    if (!out.some((o) => o.includes(h))) out.push(h);
  }
  return out.sort();
}
