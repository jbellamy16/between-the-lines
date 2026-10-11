"""Package existing, sanitized study receipts. Never performs inference or reads secrets."""
import collections
import hashlib
import html
import json
import math
import pathlib
import random
import statistics
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
STUDY = "pr18-intelligence-2026-10-10"
RAW = ROOT / "artifacts" / STUDY
OUT = ROOT / "docs/intelligence" / STUDY


def read(path):
    return json.loads(path.read_text())


def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def percentile(values, p):
    return sorted(values)[math.ceil(len(values) * p) - 1] if values else None


def main():
    matrix = read(RAW / "matrix.json")
    cases = matrix["cases"]
    supplement_path = RAW / "supplement-active-favorite.json"
    if supplement_path.exists():
        supplement = read(supplement_path)
        assert supplement["sourceHashes"] == matrix["sourceHashes"]
        cases = cases + supplement["cases"]
    if any(not (RAW / f"case-{c['id']}.json").exists() for c in cases):
        raise SystemExit("Study is incomplete; do not publish a partial run as complete")
    rows = [read(RAW / f"case-{c['id']}.json") for c in cases]
    attempts = [read(p) for p in sorted(RAW.glob("request-*.json"), key=lambda p: int(p.stem.split("-")[-1]))]
    journal = [json.loads(line) for line in (RAW / "ledger.jsonl").read_text().splitlines()]
    reserves = {r["id"]: r for r in journal if r["kind"] == "reserve"}
    settlements = {r["id"]: r for r in journal if r["kind"] == "settle"}
    assert set(reserves) == {a["id"] for a in attempts}, "Missing HTTP receipt: preserve journal and investigate"
    known_cost = sum(r.get("estimatedUsd", 0) for r in settlements.values())
    unresolved = sum(r["reservedUsd"] for i, r in reserves.items() if "estimatedUsd" not in settlements.get(i, {}))
    calls = [(a, o) for a in attempts for o in a.get("output", []) if o["type"] == "function_call"]
    for row in rows:
        requests = [a for a in attempts if a["id"] in row["requests"]]
        texts = [part["text"] for a in requests for item in a.get("output", []) if item["type"] == "message" for part in item.get("content", []) if part["type"] == "output_text"]
        row["editorialPlansReturned"] = []
        for text in texts:
            try:
                row["editorialPlansReturned"].append(json.loads(text))
            except ValueError:
                row["editorialPlansReturned"].append({"invalidJsonText": text})
        row["selectedClaimIds"] = [claim for story in row.get("result", {}).get("stories", []) for claim in story["claimIds"]]
        row["rejectedPlanClaimIds"] = [s["claimId"] for plan in row["editorialPlansReturned"] for s in plan.get("stories", [])] if row["outcome"] == "editorial-rejected" else []
        retrieved = {claim["id"] for a in requests for t in a.get("toolResults", []) for claim in t["output"].get("claims", [])}
        row["retrievedButUnselectedClaimIds"] = sorted(retrieved - set(row["selectedClaimIds"]))
        row["usage"] = {k: sum(a.get("usage", {}).get(k, 0) for a in requests) for k in ["input_tokens", "output_tokens"]}
        row["estimatedUsd"] = sum(settlements[a["id"]].get("estimatedUsd", 0) for a in requests)
        row["unresolvedReservedUsd"] = sum(reserves[a["id"]]["reservedUsd"] for a in requests if "estimatedUsd" not in settlements[a["id"]])
    counter_calls = [(a, o) for a, o in calls if o["name"] == "inspect_counter_evidence"]
    counter_received = []
    for a, call in counter_calls:
        results = [t["output"] for req in attempts for t in req.get("toolResults", []) if t["callId"] == call["call_id"]]
        if any(r.get("assessments") for r in results):
            counter_received.append({"case": a["caseId"], "request": a["id"], "call": call, "relevantAssessments": len(results[-1]["assessments"])})
    accepted = [r for r in rows if r["outcome"] == "accepted"]
    workflow_latencies = [r["latencyMs"] for r in rows if r["requestCount"]]
    scores = read(OUT / "assistant-scores.json")
    assert {r["id"] for r in scores["rows"]} == {c["id"] for c in cases}
    assert all(r["assessmentStatus"] == "reviewed" for r in scores["rows"]), "Finish the assistant review before packaging"
    summary = {
        "study": STUDY, "evaluatedRef": matrix["evaluatedRef"], "directorVersion": matrix["directorVersion"],
        "humanReview": {"status": "pending", "responses": 0, "intendedReviewers": 3},
        "outcomes": dict(collections.Counter(r["outcome"] for r in rows)),
        "primaryStates": len(matrix["cases"]), "supplementaryStates": len(cases) - len(matrix["cases"]),
        "acceptedInvestigations": len(accepted), "newHttpRequests": len(attempts),
        "rejectedEditorialPlans": sum(r["outcome"] == "editorial-rejected" for r in rows),
        "providerFailedInvestigations": sum(r["outcome"] == "provider-failed" for r in rows),
        "skippedInvestigations": sum(r["outcome"] == "skipped" for r in rows),
        "httpStatuses": dict(collections.Counter(str(a.get("status", "transport-failure")) for a in attempts)),
        "inputTokens": sum(a.get("usage", {}).get("input_tokens", 0) for a in attempts),
        "cachedInputTokens": sum(a.get("usage", {}).get("input_tokens_details", {}).get("cached_tokens", 0) for a in attempts),
        "outputTokens": sum(a.get("usage", {}).get("output_tokens", 0) for a in attempts),
        "returnedUsageEstimateUsd": known_cost, "unknownUsageReservedUsd": unresolved,
        "conservativelyAccountedUsd": known_cost + unresolved, "unusedEstimatedBudgetUsd": 2 - known_cost - unresolved,
        "unusedRequests": 60 - len(attempts),
        "knownCostPerAcceptedInvestigationUsd": known_cost / len(accepted) if accepted else None,
        "accountedCostPerAcceptedInvestigationUsd": (known_cost + unresolved) / len(accepted) if accepted else None,
        "workflowLatencySample": len(workflow_latencies), "workflowMedianMs": statistics.median(workflow_latencies) if workflow_latencies else None,
        "workflowObservedP95Ms": percentile(workflow_latencies, .95),
        "latencyCaveat": "Nearest-rank observed p95; small correlated sample. Includes request pacing, excludes 65-second inter-case cooldown. Not production p95.",
        "httpMedianMs": statistics.median(a["latencyMs"] for a in attempts) if attempts else None,
        "httpObservedP95Ms": percentile([a["latencyMs"] for a in attempts], .95),
        "toolCalls": dict(collections.Counter(o["name"] for _, o in calls)),
        "counterEvidenceRequests": len(counter_calls), "counterEvidenceWithAssessmentReturned": counter_received,
        "unsupportedClaimsPublishedAutomated": sum(r.get("automatedVerification") != "passed" for r in accepted),
        "unsupportedClaimCaveat": "Only the supplied synthetic record and implemented verification contract are checked; assistant review is separate.",
        "applicationFallbacksExecuted": 0, "offlineFallbacksPrepared": sum("fallback" in r for r in rows),
        "inappropriateAbstentionsPreliminary": sum(r.get("inappropriateAbstention", False) for r in scores["rows"]),
        "repetitiveSelectionsPreliminary": sum(r.get("repetitive", False) for r in scores["rows"]),
        "inappropriatePublicationsPreliminary": sum(r.get("shouldAbstain", False) for r in scores["rows"]),
        "modelRequestsPerInvestigation": {r["id"]: r["requestCount"] for r in rows},
    }
    assert summary["newHttpRequests"] <= 60 and summary["conservativelyAccountedUsd"] <= 2
    write("scorecard.json", summary)
    write("results.json", {"study": STUDY, "rows": rows})
    write("requests.json", {"study": STUDY, "attempts": attempts})
    write("preflight.json", read(RAW / "preflight.json"))
    (OUT / "ledger.jsonl").write_bytes((RAW / "ledger.jsonl").read_bytes())
    # Full raw matrices stay local. Retain enough canonical evidence to audit and
    # reproduce every case without carrying duplicated graphs/raw source blobs.
    fixtures = {}
    prepared = []
    for c in cases:
        match = c["match"]
        if match["id"] not in fixtures or len(match["events"]) > len(fixtures[match["id"]]["events"]):
            fixtures[match["id"]] = {k: v for k, v in match.items() if k != "events"}
            fixtures[match["id"]]["events"] = [{k: v for k, v in e.items() if k != "source"} for e in match["events"]]
        prepared.append({k: v for k, v in c.items() if k not in ["match", "offlineFallback"]} | {"matchId": match["id"], "scenarioSeed": match["provenance"]["raw"]})
    write("cases.json", {k: v for k, v in matrix.items() if k != "cases"} | {"cases": prepared})
    write("synthetic-evidence.json", {"notice": "Project-owned synthetic fixtures. Apply each case cutoff before review; full fixtures include later events for reproducibility.", "fixtures": fixtures})
    historic_old = read(ROOT / "artifacts/editorial-original-mini.json")
    historic_final = read(ROOT / "artifacts/editorial-revised-mini-final.json")
    histories = []
    for c in cases:
        if not c.get("historicalCase"):
            continue
        is_final = c["id"] == "unfamiliar-8911"
        source = historic_final if is_final else historic_old
        row = next(r for r in source["rows"] if r["name"] == c["historicalCase"])
        assert row["match"] == c["match"]["id"] and row["cutoff"] == c["cutoff"] and row["mode"] == c["mode"]
        events = {e["id"]: e for e in c["match"]["events"] if e["time"] <= c["cutoff"]}
        assert all(i in events for i in row["result"]["narrative"]["evidenceIds"])
        histories.append({"caseId": c["id"], "version": "director-1.1.2" if is_final else "director-1.0.2", "sourceFile": "editorial-revised-mini-final.json" if is_final else "editorial-original-mini.json", "kind": "previously recorded real model result", "inputHashAvailable": False, "sameStateCheck": "match/cutoff/mode and historical evidence membership checked; scenario/seed/preferences reconstructed from archived harness", "row": row})
    write("historical-comparison.json", {"limitations": "One matching recorded 1.1.2 result; other recorded results are 1.0.2 and must not be called the PR18 frozen model baseline.", "rows": histories})
    create_case_report(cases, rows, attempts, scores, summary)
    create_reviews(cases, rows, histories)
    create_demo(cases, rows)
    with zipfile.ZipFile(OUT / "reviewer-package.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for n in range(1, 4):
            archive.write(OUT / f"reviewer-{n}.html", f"reviewer-{n}.html")
        archive.writestr("START-HERE.txt", "Coordinator: assign reviewer-1 and reviewer-2 to knowledgeable football viewers/analysts, and reviewer-3 to a broadcast/content specialist. Send each person only their assigned HTML file. Open locally in a browser, work independently, download feedback, and return the JSON file to the coordinator. No network, login or automatic submission. Allow 25-40 minutes. Do not share the coordinator source key before reviews are complete.\n")
    receipts = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file() and p.name in ["results.json", "requests.json", "cases.json", "synthetic-evidence.json", "ledger.jsonl", "historical-comparison.json", "preflight.json"]}
    write("receipt-hashes.json", receipts)
    print(json.dumps(summary, indent=2))


DIMENSIONS = ["Football relevance", "Explanatory value", "Evidence grounding", "Editorial quality", "Narrative continuity", "Personalization relevance", "Broadcast usefulness"]
QUESTIONS = ["Which explanation is most useful?", "Which reveals something worth noticing?", "Which would you trust?", "Which is most appropriate for a broadcast?", "Which contains unnecessary information?", "Does any explanation overstate the evidence?", "Would you want to receive this insight during a match?"]


def create_case_report(cases, rows, attempts, scores, summary):
    assessments = {r["id"]: r for r in scores["rows"]}
    lines = ["# Complete live case outcomes", "", "All predeclared states are included. Estimates use returned usage; the separate reserve column retains unknown-usage attempts. No output is promoted to success merely because HTTP returned 200. Detailed plans, selected/rejected claims and public traces are in [results.json](results.json) and [requests.json](requests.json).", "", "| Case | Clock / mode | Outcome | Requests | Usage estimate | Unknown reserve | Workflow seconds |", "|---|---|---|---:|---:|---:|---:|"]
    for c, row in zip(cases, rows):
        sec = c["cutoff"]
        lines.append(f'| {c["id"]} | {sec//60}:{sec%60:02} / {c["mode"]} | {row["outcome"]} | {row["requestCount"]} | ${row["estimatedUsd"]:.6f} | ${row["unresolvedReservedUsd"]:.6f} | {row["latencyMs"]/1000:.3f} |')
    for c, row in zip(cases, rows):
        lines += ["", f'## {c["id"]}', "", f'**Question:** {c["question"]}', "", f'**State:** `{c["match"]["id"]}`, cutoff {c["cutoff"]} seconds; {c["mode"]}; preferences `{json.dumps(c["preferences"])}`. Scenario/seed: `{json.dumps(c["match"]["provenance"]["raw"])}`. Input digest `{c["inputDigest"]}`.', "", f'**Available shortlist:** {len(c["availableObservations"])} observations. Top three: ' + ' / '.join(x["brief"] for x in c["availableObservations"][:3]), ""]
        reqs = [a for a in attempts if a["id"] in row["requests"]]
        call_text = [f'{o["name"]} `{o["arguments"]}`' for a in reqs for o in a.get("output", []) if o["type"] == "function_call"]
        lines.append('**Actual model tool sequence:** ' + (' → '.join(call_text) or 'None (no model call).'))
        lines += ["", f'**Outcome:** {row["outcome"]}. Requests: {row["requests"]}. Tokens: {row["usage"]["input_tokens"]:,} input / {row["usage"]["output_tokens"]:,} output.']
        if row.get("error"):
            lines += ["", f'**Failure:** {row["error"]}. No verified model publication. A deterministic fallback is retained separately in the receipt.']
        result = row.get("result")
        if result:
            lines += ["", '**Published/returned explanation:** ' + result["narrative"]["explanation"], "", '**Why it matters:** ' + result["narrative"]["why"], "", '**Watch next:** ' + result["narrative"]["watch"]]
        lines += ["", '**Assistant preliminary assessment:** ' + assessments[c["id"]]["notes"], "", '**Human assessment:** pending.']
    (OUT / "CASE-OUTCOMES.md").write_text('\n'.join(lines) + '\n')
    dims = ["footballRelevance", "explanatoryValue", "evidenceGrounding", "editorialQuality", "narrativeContinuity", "personalizationRelevance", "broadcastUsefulness"]
    lines = ["# Model performance scorecard", "", "Human review is pending. The first table is objective measurement within this synthetic study. The ratings below are assistant preliminary assessments, not a human preference result.", "", "| Measurement | Observed |", "|---|---|"]
    measures = [("Primary predeclared states / supplementary diagnostic", f'{summary["primaryStates"]} / {summary["supplementaryStates"]}'), ("Accepted investigations", summary["acceptedInvestigations"]), ("Outcome breakdown", summary["outcomes"]), ("New HTTP requests", summary["newHttpRequests"]), ("HTTP outcomes", summary["httpStatuses"]), ("Explicit counter-evidence requests", summary["counterEvidenceRequests"]), ("Counter-evidence requests returning assessments", len(summary["counterEvidenceWithAssessmentReturned"])), ("Unsupported published claims identified by automated checks", summary["unsupportedClaimsPublishedAutomated"]), ("Actual application fallbacks executed", 0), ("Offline fallback packages prepared for failures", summary["offlineFallbacksPrepared"]), ("Input / cached input / output tokens", f'{summary["inputTokens"]:,} / {summary["cachedInputTokens"]:,} / {summary["outputTokens"]:,}'), ("Returned-usage estimate", f'${summary["returnedUsageEstimateUsd"]:.8f}'), ("Unknown-usage reserve", f'${summary["unknownUsageReservedUsd"]:.8f}'), ("Conservative accounted total", f'${summary["conservativelyAccountedUsd"]:.8f}'), ("Unused allowance", f'${summary["unusedEstimatedBudgetUsd"]:.8f}; {summary["unusedRequests"]} requests'), ("Cost per accepted investigation (failures included)", f'${summary["knownCostPerAcceptedInvestigationUsd"]:.6f} known; ${summary["accountedCostPerAcceptedInvestigationUsd"]:.6f} with reserves'), ("Workflow median / observed p95", f'{summary["workflowMedianMs"]/1000:.3f}s / {summary["workflowObservedP95Ms"]/1000:.3f}s, n={summary["workflowLatencySample"]}'), ("HTTP median / observed p95", f'{summary["httpMedianMs"]/1000:.3f}s / {summary["httpObservedP95Ms"]/1000:.3f}s'), ("Preliminary inappropriate abstentions", summary["inappropriateAbstentionsPreliminary"]), ("Preliminary repetitive outputs", summary["repetitiveSelectionsPreliminary"]), ("Preliminary outputs where silence was preferable", summary["inappropriatePublicationsPreliminary"])]
    lines += [f'| {k} | {v} |' for k, v in measures]
    lines += ["", summary["latencyCaveat"], "", "Unknown usage is not declared free. Reservations are headroom, not a claim that Azure actually billed that amount. The direct investigator was tested; failure-path fallback execution is not a measured application statistic. Correctly abstaining before inference is not model restraint.", "", "## Preliminary 1–5 ratings", "", "N/A means the dimension does not apply or no model explanation was published. Failed states are included with no fabricated ratings. A score of 5 for grounding is limited to the supplied synthetic record and verification contract.", "", "| Case | Relevance | Explanation | Grounding | Editorial | Continuity | Personalization | Broadcast |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in scores["rows"]:
        rating = r["systemC"] or {}
        lines.append('| ' + r["id"] + ' | ' + ' | '.join(str(rating.get(k)) if rating.get(k) is not None else 'N/A' for k in dims) + ' |')
    lines += ["", "## Available baseline-output ratings", "", "These are also assistant preliminary judgments. B is a genuine historical output, not a newly sampled or simulated answer. See the version and per-row rationale in `assistant-scores.json`.", "", "| Case / arm | Relevance | Explanation | Grounding | Editorial | Continuity | Personalization | Broadcast |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in scores["rows"]:
        for arm in ["systemA", "historicalB"]:
            if arm not in r:
                continue
            rating = r[arm] or {}
            version = "legacy detector" if arm == "systemA" else "historical 1.1.2" if r["id"] == "unfamiliar-8911" else "historical 1.0.2"
            lines.append('| ' + r["id"] + ' / ' + version + ' | ' + ' | '.join(str(rating.get(k)) if rating.get(k) is not None else 'N/A' for k in dims) + ' |')
    lines += ["", "Per-output reasons are in [the complete case report](CASE-OUTCOMES.md). Read these alongside the scores; an average would hide the quota failures and distinct evidence limitations. No overall 'intelligence accuracy' percentage is computed."]
    (OUT / "SCORECARD.md").write_text('\n'.join(lines) + '\n')


def create_reviews(cases, rows, histories):
    html_escape = lambda x: html.escape(str(x), quote=True)
    historical = {h["caseId"]: h for h in histories}
    current = {r["id"]: r for r in rows}
    selected = [c for c in cases if c["id"] in historical]
    key = {"warning": "Coordinator only. Send each reviewer only their assigned HTML file. Source identity can sometimes be inferred from writing style; this is blinded labelling, not perfect indistinguishability.", "reviews": []}
    for reviewer in range(1, 4):
        rng = random.Random(918271 + reviewer)
        order = list(selected)
        rng.shuffle(order)
        blocks = []
        for n, c in enumerate(order, 1):
            record = current[c["id"]]
            old = historical[c["id"]]["row"]["result"]
            live = record.get("result")
            originals = {
                "A": {"explanation": " ".join((x["headline"] + ". " + x["analyst"]) if c["mode"] == "analyst" else x["explanation"] for x in c["deterministicA"]) or "No new insight selected.", "why": " ".join(x["why"] for x in c["deterministicA"]), "watch": " ".join(x["watch"] for x in c["deterministicA"])},
                "B": old["narrative"],
                "C": live["narrative"] if live else {"explanation": "No verified explanation was returned for this attempt.", "why": "", "watch": ""},
            }
            arms = list(originals)
            rng.shuffle(arms)
            key["reviews"].append({"reviewer": reviewer, "caseNumber": n, "caseId": c["id"], "order": {str(i + 1): arm for i, arm in enumerate(arms)}, "BVersion": historical[c["id"]]["version"], "COutcome": record["outcome"]})
            pref = c["preferences"]
            player = next((p["name"] for p in c["match"]["players"] if p["id"] == pref.get("player")), None)
            pref_text = f"Favorite player: {player}. Favorite team: {pref.get('team', 'none')}." if player else "No favorite player or team specified."
            # Same independent context and the same visible evidence for all alternatives.
            context = c["matchContext"]["facts"][0]["text"]
            block = [f'<section><h2>Case {n} · {c["mode"].title()} audience</h2><p>{html_escape(context)} {html_escape(pref_text)}</p><p>Project-owned synthetic match and players. Judge only what was recorded by this timestamp.</p>']
            for i, arm in enumerate(arms, 1):
                narrative = originals[arm]
                block.append(f'<article><h3>Alternative {i}</h3>')
                for field, label in [("explanation", "Explanation"), ("why", "Why it matters"), ("watch", "Watch next")]:
                    if narrative.get(field):
                        block.append(f'<p><b>{label}:</b> {html_escape(narrative[field])}</p>')
                block.append('<div class="scores">')
                for dim, title in enumerate(DIMENSIONS):
                    block.append(f'<label>{title}<select name="c{n}_a{i}_d{dim}"><option value="">Unscored</option><option>N/A</option>' + ''.join(f'<option>{v}</option>' for v in range(1, 6)) + '</select></label>')
                block.append('</div></article>')
            events = [e for e in c["match"]["events"] if e["time"] <= c["cutoff"]]
            cited = set(old["narrative"]["evidenceIds"])
            if live:
                cited.update(live["narrative"]["evidenceIds"])
            for observation in c["deterministicA"]:
                cited.update(observation["evidenceIds"])
                cited.update(observation["baselineIds"])
            cited.update(c["matchContext"]["facts"][0]["evidenceIds"])
            names = {p["id"]: p["name"] for p in c["match"]["players"]}
            block.append(f'<details><summary>Recorded evidence up to this timestamp ({len(events)} events)</summary><p>Complete visible prefix, including ordinary and contrary events. Positions are normalized to the acting team, not physical stadium direction. Synthetic xG is an event-model value, not a real-match quality estimate.</p><label><input type="checkbox" data-evidence-filter checked style="display:inline;width:auto"> Show only events cited by an alternative or the shared score context (uncheck for the complete record)</label><table><tr><th>Time</th><th>Team</th><th>Player → recipient</th><th>Event</th><th>Recorded detail</th></tr>')
            for e in events:
                sec = int(e["time"])
                detail = {k: e[k] for k in ["position", "end", "success", "outcome", "xg", "possessionId", "outgoingId"] if k in e}
                attrs = 'data-cited="true"' if e["id"] in cited else 'data-cited="false" hidden'
                block.append(f'<tr {attrs}><td>{sec//60:02}:{sec%60:02}</td><td>{html_escape(e["team"])}</td><td>{html_escape(names.get(e.get("actorId"), "—"))} → {html_escape(names.get(e.get("recipientId"), "—"))}</td><td>{html_escape(e["type"])}</td><td>{html_escape(json.dumps(detail))}</td></tr>')
            block.append('</table></details><div class="questions">')
            for q, prompt in enumerate(QUESTIONS):
                block.append(f'<label>{prompt}<input name="c{n}_q{q}" placeholder="Alternative number, tie/none, and reason"></label>')
            block.append(f'<label>Written feedback, factual errors, missing developments and suggested edits<textarea name="c{n}_feedback" rows="4"></textarea></label></div></section>')
            blocks.append(''.join(block))
        page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Football intelligence review</title>
<style>body{font:17px/1.55 system-ui,sans-serif;color:#132d36;background:#f3f6f5;margin:0}main{max-width:1020px;margin:auto;padding:36px 24px}h1,h2{line-height:1.2}h1{font-size:40px}h2{font-size:27px}section{margin:36px 0;padding-top:24px;border-top:2px solid #aec2ba}article{background:white;border:1px solid #ccd8d2;border-radius:12px;padding:22px;margin:16px 0}label{display:block;font-size:15px;font-weight:600}input,select,textarea{display:block;box-sizing:border-box;width:100%;font:inherit;margin:6px 0 14px;padding:8px;border:1px solid #78948a;border-radius:5px;background:white}input,textarea{font-weight:400}.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 18px}table{width:100%;font-size:12px;border-collapse:collapse}td,th{text-align:left;padding:7px;border-bottom:1px solid #ddd;vertical-align:top}details{overflow:auto;margin:20px 0}summary{cursor:pointer;font-weight:700}button{padding:12px 20px;font:inherit;color:white;background:#174f42;border:0;border-radius:7px;cursor:pointer}.note{padding:16px;background:#e2ede6;border-radius:8px}.bar{position:sticky;top:0;padding:12px;background:#f3f6f5eF;border-bottom:1px solid #ccd8d2;z-index:2}@media print{.bar,button{display:none}article{break-inside:avoid}body{background:white}details{display:block}}</style>
<main><div class="bar"><button type="button" id="download">Download my feedback</button> <span id="status" role="status">Responses stay in this page until downloaded.</span></div><h1>Football intelligence review</h1>
<p class="note">Independent review — pending. Please work alone before discussing with others. All names and events are synthetic. Alternatives are anonymous and their order varies. No response has been filled in for you. Allow 25–40 minutes; use the evidence when checking claims.</p>
<form id="review"><label>Your name or reviewer code<input name="reviewer" autocomplete="off"></label><label>Your experience (football viewer, analyst, or broadcast/content production)<input name="experience"></label>
<h2>Scoring guide</h2><p>Metric guide: ball wins include recoveries, interceptions and successful tackles; recovery-only counts are narrower. Different comparisons can use different time windows. Check the stated bounds before treating different totals as a factual disagreement.</p><p>1 = misleading, irrelevant or unusable; 2 = weak; 3 = useful but needs editing; 4 = strong with minor edits; 5 = clear, relevant and ready to use. Use N/A where appropriate. Evidence grounding asks whether claims match the record. Continuity asks whether the explanation fairly describes development over time; N/A is reasonable when a single snapshot cannot answer it. Personalization asks whether a specified favorite adds useful context. More words or more statistics do not automatically deserve a higher score.</p><p>Judge the explanation, its significance and next observation together. A missing verified result is a real outcome, not an invitation to imagine a better answer. Written comments matter as much as scores.</p>
''' + ''.join(blocks) + '''</form><p>Download your feedback and return the file to the study coordinator. Closing this page before downloading loses unsaved entries. No network request or automated submission is made.</p></main>
<script>document.getElementById('download').addEventListener('click',()=>{const values=Object.fromEntries(new FormData(document.getElementById('review')));const response={reviewForm:FORM_ID,completedAt:new Date().toISOString(),values};const blob=new Blob([JSON.stringify(response,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=FORM_ID+'-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);document.getElementById('status').textContent='Feedback downloaded. Please return that file to the coordinator.';});</script></html>'''
        page = page.replace('FORM_ID', json.dumps(f"football-review-{reviewer}"))
        page = page.replace('</script>', '''document.querySelectorAll('[data-evidence-filter]').forEach(filter=>filter.addEventListener('change',()=>{filter.closest('details').querySelectorAll('tr[data-cited="false"]').forEach(row=>{row.hidden=filter.checked;});}));</script>''')
        assert all(name not in page.lower() for name in ["foundry", "gpt-", "director-", "provider", "system a", "system b", "system c"])
        (OUT / f"reviewer-{reviewer}.html").write_text(page)
    write("coordinator-key.json", key)


def create_demo(cases, rows):
    case = next(c for c in cases if c["id"] == "temporal-emerging")
    row = next(r for r in rows if r["id"] == case["id"])
    assert row["outcome"] == "accepted"
    result = row["result"]
    events = [e for e in case["match"]["events"] if e["id"] in result["narrative"]["evidenceIds"]]
    assert all(e["time"] <= case["cutoff"] for e in events)
    esc = lambda text: html.escape(str(text), quote=True)
    names = {p["id"]: p["name"] for p in case["match"]["players"]}
    cards = ''.join(f'<article><h2>{esc(s["headline"])}</h2><p>{esc(s["explanation"])}</p><p class="muted">{esc(s["whyItMatters"])}</p></article>' for s in result["stories"])
    table = ''.join(f'<tr><td>{int(e["time"])//60:02}:{int(e["time"])%60:02}</td><td>{esc(e["team"])}</td><td>{esc(names.get(e.get("actorId"), "—"))}</td><td>{esc(e["type"])}</td><td>{esc(e["id"])}</td></tr>' for e in events)
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recorded football intelligence</title><style>body{font:18px/1.55 system-ui,sans-serif;margin:0;color:#142d34;background:#f2f5f2}main{max-width:920px;padding:40px 24px;margin:auto}h1{font-size:44px;line-height:1.12}h2{font-size:23px;line-height:1.3}.label{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#1c604b}article,.panel{background:white;border:1px solid #c6d7cc;border-radius:12px;padding:24px;margin:20px 0}.muted{color:#435c60}summary{cursor:pointer;font-weight:700}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:8px;border-bottom:1px solid #d5dfda;text-align:left}details{overflow:auto}a{color:#165946}.watch{border-left:5px solid #286a51;padding-left:20px}</style><main><p class="label">Between the Lines · Recorded Foundry evaluation</p><h1>Four shots. One passage worth revisiting.</h1><p>Harbor Athletic 1–0 Riverside FC · 65:00<br>Project-owned synthetic match · Recorded October 10, 2026</p><p class="muted">Replay of an actual evaluated response. This page makes no model request.</p>''' + cards + f'<div class="watch"><h2>What to watch next</h2><p>{esc(result["narrative"]["watch"])}</p></div><div class="panel"><h2>What the model actually did</h2><p>One required event query, followed by a model-selected editorial plan. Two HTTP requests. No optional follow-up or counter-evidence tool call in this example. The application independently verified the claims and rendered the factual wording.</p><p>Measured workflow: {row["latencyMs"]/1000:.3f} seconds, including request pacing. Returned-usage estimate: ${row["estimatedUsd"]:.6f}.</p><details><summary>Inspect the supporting events</summary><table><tr><th>Clock</th><th>Team</th><th>Player</th><th>Event</th><th>Evidence ID</th></tr>{table}</table></details></div><p class="muted">The rewind repeat returned the same earlier explanation with future events removed. Later 70:00 and 75:00 live investigations hit the deployment token-rate limit. Independent football and broadcast review remains pending.</p><p><a href="REPORT.md">Full evaluation</a> · <a href="requests.json">Actual public request receipts</a> · <a href="results.json">Verified results</a></p></main></html>'
    (OUT / "demo-receipt.html").write_text(page)


if __name__ == "__main__":
    main()
