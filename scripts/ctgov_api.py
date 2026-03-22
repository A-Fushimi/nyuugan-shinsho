"""ClinicalTrials.gov v2 API wrapper for breast cancer early-stage trials."""

import urllib.request
import urllib.parse
import json
import time
from datetime import datetime, timedelta


BASE_URL = "https://clinicaltrials.gov/api/v2/studies"


def search_studies(
    condition="breast cancer",
    phases=("PHASE1", "PHASE2"),
    statuses=("RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"),
    intervention_types=("DRUG", "BIOLOGICAL"),
    min_first_posted_date=None,
    page_size=100,
    max_pages=10,
):
    """Fetch studies from ClinicalTrials.gov v2 API.

    Returns list of study dicts with fields:
        nct, title, phase, status, conditions, interventions,
        sponsor, enrollment, start_date, first_posted
    """
    if min_first_posted_date is None:
        min_first_posted_date = (datetime.now() - timedelta(days=3 * 365)).strftime(
            "%Y-%m-%d"
        )

    phase_expr = " OR ".join(phases)
    params = {
        "query.cond": condition,
        "filter.overallStatus": ",".join(statuses),
        "filter.advanced": f"AREA[Phase]({phase_expr})",
        "pageSize": str(page_size),
    }

    all_studies = []
    next_page_token = None

    for page in range(max_pages):
        p = dict(params)
        if next_page_token:
            p["pageToken"] = next_page_token

        url = BASE_URL + "?" + urllib.parse.urlencode(p)
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  [WARN] API request failed (page {page}): {e}")
            break

        studies = data.get("studies", [])
        if not studies:
            break

        for s in studies:
            proto = s.get("protocolSection", {})
            ident = proto.get("identificationModule", {})
            status_mod = proto.get("statusModule", {})
            design = proto.get("designModule", {})
            sponsor_mod = proto.get("sponsorCollaboratorsModule", {})
            arms = proto.get("armsInterventionsModule", {})

            interventions = arms.get("interventions", [])
            # Filter: at least one DRUG or BIOLOGICAL intervention
            itypes = {iv.get("type", "") for iv in interventions}
            if not itypes.intersection(set(intervention_types)):
                continue

            iv_names = [iv.get("name", "") for iv in interventions]
            iv_descs = [iv.get("description", "") for iv in interventions]

            enrollment = design.get("enrollmentInfo", {})

            record = {
                "nct": ident.get("nctId", ""),
                "title": ident.get("briefTitle", ""),
                "phase": ",".join(design.get("phases", [])),
                "status": status_mod.get("overallStatus", ""),
                "conditions": proto.get("conditionsModule", {}).get("conditions", []),
                "interventions": iv_names,
                "intervention_descs": iv_descs,
                "sponsor": sponsor_mod.get("leadSponsor", {}).get("name", ""),
                "enrollment": enrollment.get("count"),
                "start_date": status_mod.get("startDateStruct", {}).get("date", ""),
                "first_posted": status_mod.get("studyFirstPostDateStruct", {}).get(
                    "date", ""
                ),
            }
            all_studies.append(record)

        next_page_token = data.get("nextPageToken")
        if not next_page_token:
            break

        total = data.get("totalCount", "?")
        print(f"  Page {page + 1}: fetched {len(studies)} studies (total ~{total})")
        time.sleep(0.5)  # Rate limiting

    return all_studies


if __name__ == "__main__":
    print("Fetching breast cancer Phase I/II studies from ClinicalTrials.gov...")
    results = search_studies()
    print(f"Total: {len(results)} studies")
    # Save raw results
    with open("data/ctgov_raw.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Saved to data/ctgov_raw.json")
