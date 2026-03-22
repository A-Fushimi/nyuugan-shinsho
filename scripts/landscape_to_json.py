"""Convert filtered ClinicalTrials.gov studies to LANDSCAPE JSON format."""

import json
import re
import sys
from datetime import date


MOA_KEYWORDS = {
    "ADC": [
        "antibody drug conjugate",
        "antibody-drug conjugate",
        "adc",
        "conjugate",
        "payload",
        "deruxtecan",
        "vedotin",
        "emtansine",
        "ravtansine",
        "maytansinoid",
        "mmae",
        "mmaf",
        "sn-38",
        "dxd",
        "topoisomerase",
    ],
    "bispecific": [
        "bispecific",
        "bi-specific",
        "biparatopic",
        "dual targeting",
        "bifunctional",
    ],
    "PROTAC_degrader": [
        "protac",
        "degrader",
        "molecular glue",
        "protein degradation",
        "cereblon",
        "ubiquitin",
    ],
    "oral_SERD_next": [
        "serd",
        "estrogen receptor degrader",
        "selective estrogen",
        "er degrader",
    ],
    "CDK_next": [
        "cdk2",
        "cdk4",
        "cdk7",
        "cdk9",
        "cdk12",
        "cyclin-dependent kinase",
        "cyclin dependent kinase",
    ],
    "epigenetic": [
        "hdac",
        "bet ",
        "bet-",
        "ezh2",
        "histone",
        "epigenetic",
        "methyltransferase",
        "demethylase",
        "bromodomain",
    ],
    "IO_next": [
        "lag-3",
        "lag3",
        "tigit",
        "sting",
        "mrna vaccine",
        "neoantigen",
        "til ",
        "tumor-infiltrating",
        "bispecific.*pd",
        "pd.*bispecific",
        "car-nk",
    ],
    "cell_therapy": [
        "car-t",
        "car t",
        "chimeric antigen",
        "cell therapy",
        "adoptive cell",
        "til therapy",
        "nk cell",
    ],
    "RDC": [
        "radioligand",
        "radiopharmaceutical",
        "radiolabeled",
        "lutetium",
        "actinium",
        "177lu",
        "225ac",
        "radioimmunotherapy",
    ],
    "small_mol_other": [
        "shp2",
        "kras",
        "mek",
        "erk",
        "raf",
        "fgfr",
        "src ",
        "src-",
        "pi3k",
        "akt",
        "mtor",
        "wee1",
        "chk1",
        "atr ",
        "atr-",
        "aurora",
        "plk",
    ],
    "Ab_other": [
        "monoclonal antibody",
        "anti-",
        "nectin",
        "claudin",
        "trop2",
    ],
}

# Novel ADC targets (separate from standard HER2/TROP2)
NOVEL_ADC_TARGETS = [
    "b7-h4",
    "b7h4",
    "nectin-4",
    "nectin4",
    "fra",
    "folate receptor",
    "her3",
    "ceacam",
    "mesothelin",
    "gpnmb",
    "liv-1",
    "ptk7",
    "ror1",
    "ror2",
    "dll3",
    "flt3",
    "cldn",
    "claudin",
    "egfr",
]


def classify_moa(study):
    """Classify study into moa_cat based on intervention text."""
    text = " ".join(
        [
            study.get("title", ""),
            " ".join(study.get("interventions", [])),
            " ".join(study.get("intervention_descs", [])),
        ]
    ).lower()

    # Check ADC with novel target first
    is_adc = any(kw in text for kw in MOA_KEYWORDS["ADC"])
    if is_adc:
        is_novel_target = any(t in text for t in NOVEL_ADC_TARGETS)
        if is_novel_target:
            return "ADC_novel_target"
        return "ADC"

    # Check other categories in priority order
    for cat in [
        "bispecific",
        "PROTAC_degrader",
        "cell_therapy",
        "RDC",
        "IO_next",
        "CDK_next",
        "oral_SERD_next",
        "epigenetic",
        "small_mol_other",
    ]:
        for kw in MOA_KEYWORDS[cat]:
            if kw in text:
                return cat

    return "small_mol_other"


def extract_target(study):
    """Extract likely molecular target from study text."""
    text = " ".join(
        [
            " ".join(study.get("interventions", [])),
            " ".join(study.get("intervention_descs", [])),
            study.get("title", ""),
        ]
    ).lower()

    target_patterns = [
        (r"her2|erbb2", "HER2"),
        (r"her3|erbb3", "HER3"),
        (r"trop-?2", "TROP2"),
        (r"b7-?h4", "B7-H4"),
        (r"pd-?l?1", "PD-1/PD-L1"),
        (r"lag-?3", "LAG-3"),
        (r"tigit", "TIGIT"),
        (r"cdk ?2[^0-9]", "CDK2"),
        (r"cdk ?4", "CDK4"),
        (r"cdk ?7", "CDK7"),
        (r"pi3k", "PI3K"),
        (r"akt", "AKT"),
        (r"mtor", "mTOR"),
        (r"kras", "KRAS"),
        (r"shp-?2", "SHP2"),
        (r"fgfr", "FGFR"),
        (r"er |estrogen receptor", "ER"),
        (r"parp", "PARP"),
        (r"folate receptor|fr.alpha|fra", "FRα"),
        (r"nectin-?4", "Nectin-4"),
        (r"vegf", "VEGF"),
        (r"sting", "STING"),
    ]
    for pattern, label in target_patterns:
        if re.search(pattern, text):
            return label
    return "Unknown"


def map_phase(phase_str):
    """Map ClinicalTrials.gov phase string to LANDSCAPE stage."""
    p = phase_str.lower()
    if "phase2" in p or "phase 2" in p:
        if "phase1" in p or "phase 1" in p:
            return "PhIb/II"
        return "PhII"
    if "phase1" in p or "phase 1" in p:
        return "PhI"
    return "PhI"


def infer_subtypes(study):
    """Infer breast cancer subtypes from study text."""
    text = (
        study.get("title", "")
        + " "
        + " ".join(study.get("conditions", []))
        + " "
        + " ".join(study.get("intervention_descs", []))
    ).lower()

    subs = []
    if any(
        t in text
        for t in [
            "hr+",
            "hr-positive",
            "hormone receptor",
            "er+",
            "er-positive",
            "luminal",
        ]
    ):
        subs.append("HR+/HER2-")
    if any(t in text for t in ["her2+", "her2-positive", "her2 positive", "erbb2+"]):
        subs.append("HER2+")
    if any(
        t in text
        for t in [
            "triple negative",
            "triple-negative",
            "tnbc",
            "basal",
        ]
    ):
        subs.append("TNBC")
    if any(t in text for t in ["her2-low", "her2 low"]):
        subs.append("HER2-low")

    # Default to broad if none detected
    if not subs:
        subs = ["HR+/HER2-", "HER2+", "TNBC"]

    return subs


def convert_study(study):
    """Convert a filtered ClinicalTrials.gov study to LANDSCAPE format."""
    drug_name = study["interventions"][0] if study.get("interventions") else "Unknown"

    return {
        "id": study["nct"],
        "name": drug_name,
        "co": study.get("sponsor", ""),
        "moa_cat": classify_moa(study),
        "tgt": extract_target(study),
        "sub": infer_subtypes(study),
        "stage": map_phase(study.get("phase", "")),
        "nct": study["nct"],
        "nct_url": f"https://clinicaltrials.gov/study/{study['nct']}",
        "status": study.get("status", "").lower().replace("_", " "),
        "fih_date": study.get("start_date", ""),
        "n_enrolled": study.get("enrollment"),
        "early_result": "",
        "source_url": f"https://clinicaltrials.gov/study/{study['nct']}",
        "source_label": "ClinicalTrials.gov",
        "note": "",
        "updated": date.today().isoformat(),
    }


def convert_all(studies):
    """Convert all filtered studies to LANDSCAPE format."""
    results = []
    seen_drugs = set()

    for s in studies:
        if not s.get("interventions"):
            continue

        # Deduplicate by primary intervention name
        drug_key = s["interventions"][0].lower().strip()
        if drug_key in seen_drugs:
            continue
        seen_drugs.add(drug_key)

        results.append(convert_study(s))

    # Sort by moa_cat, then stage
    stage_order = {"PhII": 0, "PhIb/II": 1, "PhI": 2, "FIH": 3, "IND": 4}
    results.sort(
        key=lambda x: (x["moa_cat"], stage_order.get(x["stage"], 5))
    )

    return results


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "data/ctgov_filtered.json"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "data/landscape.json"

    with open(input_path, "r", encoding="utf-8") as f:
        studies = json.load(f)

    landscape = convert_all(studies)
    print(f"Converted {len(landscape)} unique drugs")

    # Category summary
    cats = {}
    for d in landscape:
        cats[d["moa_cat"]] = cats.get(d["moa_cat"], 0) + 1
    print("Categories:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(landscape, f, ensure_ascii=False, indent=2)
    print(f"Saved to {output_path}")
