"""Deduplicate ClinicalTrials.gov results against DRUGS array in App.jsx."""

import re
import json
import sys


def extract_known_drugs(jsx_path):
    """Extract drug generic names and display names from DRUGS array in JSX."""
    with open(jsx_path, "r", encoding="utf-8") as f:
        content = f.read()

    known = set()

    # Extract generic field values
    for m in re.finditer(r'generic:"([^"]+)"', content):
        known.add(m.group(1).lower().strip())

    # Extract name field values (Japanese + generic)
    for m in re.finditer(r'name:"([^"]+)"', content):
        name = m.group(1).lower().strip()
        known.add(name)
        # Also extract parts in parentheses
        for part in re.findall(r"[（(]([^）)]+)[）)]", name):
            known.add(part.strip())

    # Common aliases to add manually
    aliases = {
        "trastuzumab deruxtecan": ["t-dxd", "ds-8201", "enhertu"],
        "trastuzumab emtansine": ["t-dm1", "kadcyla"],
        "sacituzumab govitecan": ["trodelvy", "sac-gov"],
        "datopotamab deruxtecan": ["dato-dxd", "datroway"],
        "sacituzumab tirumotecan": ["sac-tmt", "shr-a1921"],
        "pembrolizumab": ["keytruda", "mk-3475"],
        "palbociclib": ["ibrance"],
        "abemaciclib": ["verzenio"],
        "ribociclib": ["kisqali"],
        "olaparib": ["lynparza"],
        "talazoparib": ["talzenna"],
        "tucatinib": ["tukysa"],
        "camizestrant": ["azd9833"],
        "vepdegestrant": ["arv-471"],
        "imlunestrant": ["ly3484356"],
        "elacestrant": ["rad1901"],
        "giredestrant": ["gdc-9545"],
        "alpelisib": ["piqray", "byl719"],
        "inavolisib": ["gdc-0077", "itovebi"],
        "capivasertib": ["azd5363", "truqap"],
        "atirmociclib": ["pf-07264090"],
        "gedatolisib": ["pf-05212384"],
        "prifetrastat": ["pf-07934312"],
        "pumitamig": ["bnt327", "pm8002"],
        "patritumab deruxtecan": ["her3-dxd", "u3-1402"],
    }
    for base, als in aliases.items():
        known.add(base.lower())
        for a in als:
            known.add(a.lower())

    return known


def is_known_drug(study, known_drugs):
    """Check if any intervention in the study matches a known drug."""
    for iv in study.get("interventions", []):
        iv_lower = iv.lower().strip()
        for kd in known_drugs:
            if kd in iv_lower or iv_lower in kd:
                return True
    return False


def is_chemo_or_supportive(study):
    """Filter out pure chemo, supportive care, or biosimilar studies."""
    title_lower = study.get("title", "").lower()
    ivs = " ".join(study.get("interventions", [])).lower()
    combined = title_lower + " " + ivs

    exclude_terms = [
        "biosimilar",
        "supportive care",
        "quality of life",
        "qol",
        "palliative",
        "exercise",
        "diet",
        "yoga",
        "meditation",
        "acupuncture",
        "counseling",
        "screening",
        "diagnostic",
        "imaging",
        "biomarker only",
        "registry",
        "observational",
        "survey",
    ]
    for term in exclude_terms:
        if term in combined:
            return True

    # Pure chemo regimens (no novel agent)
    chemo_only_terms = [
        "doxorubicin",
        "cyclophosphamide",
        "paclitaxel",
        "docetaxel",
        "carboplatin",
        "cisplatin",
        "capecitabine",
        "gemcitabine",
        "vinorelbine",
        "eribulin",
        "fluorouracil",
        "methotrexate",
    ]
    interventions_are_chemo = all(
        any(ct in iv.lower() for ct in chemo_only_terms)
        for iv in study.get("interventions", [])
        if iv.strip()
    )
    if interventions_are_chemo and study.get("interventions"):
        return True

    return False


def deduplicate(studies, jsx_path):
    """Remove known drugs and non-novel studies. Returns filtered list."""
    known = extract_known_drugs(jsx_path)
    print(f"  Known drugs/aliases: {len(known)}")

    filtered = []
    for s in studies:
        if is_known_drug(s, known):
            continue
        if is_chemo_or_supportive(s):
            continue
        filtered.append(s)

    print(f"  After dedup: {len(filtered)} / {len(studies)} studies remain")
    return filtered


if __name__ == "__main__":
    jsx_path = sys.argv[1] if len(sys.argv) > 1 else "src/App.jsx"
    input_path = sys.argv[2] if len(sys.argv) > 2 else "data/ctgov_raw.json"

    with open(input_path, "r", encoding="utf-8") as f:
        studies = json.load(f)

    filtered = deduplicate(studies, jsx_path)

    output_path = "data/ctgov_filtered.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)
    print(f"Saved to {output_path}")
