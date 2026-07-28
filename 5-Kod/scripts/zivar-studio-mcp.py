from __future__ import annotations

import argparse
import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP


def _args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Zivar Graph Studio MCP")
    parser.add_argument("--port", type=int, default=8767)
    parser.add_argument("--events", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--branch-impact", type=Path, required=True)
    return parser.parse_args()


ARGS = _args()
ARGS.events.parent.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()
LAST_FOCUS: dict[tuple[str, str], dict[str, Any]] = {}
MCP = FastMCP(
    "zivar-graph-studio",
    instructions=(
        "Use graphify-corevo query/path/explain before broad source reads. Focus the "
        "small relevant graph area here, then read only the returned source locations. "
        "Record structural actions, never hidden reasoning, prompts, credentials, or customer data."
    ),
    host="127.0.0.1",
    port=ARGS.port,
    streamable_http_path="/mcp",
    json_response=True,
)


def _text(value: Any, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]


def _event(kind: str, **payload: Any) -> dict[str, Any]:
    item = {
        "id": f"{datetime.now(timezone.utc).timestamp():.6f}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        **payload,
    }
    with LOCK:
        with ARGS.events.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    return item


@MCP.tool()
def studio_status() -> dict[str, Any]:
    """Return the current projects, view, filters, selection, and comparison summary."""
    if not ARGS.state.exists():
        return {"connected": True, "open": False, "message": "Studio has not published state yet."}
    try:
        return {"connected": True, "open": True, **json.loads(ARGS.state.read_text(encoding="utf-8"))}
    except (OSError, json.JSONDecodeError) as exc:
        return {"connected": True, "open": False, "error": _text(exc)}


@MCP.tool()
def studio_focus(
    agent: str,
    label: str,
    project: str = "A",
    action: str = "inspect",
    summary: str = "",
    duration_ms: int = 0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    status: str = "ok",
) -> dict[str, Any]:
    """Focus a real graph node. Repeated focus renews at most once per minute; summary is never hidden reasoning."""
    clean_agent = _text(agent, 80) or "Agent"
    clean_label = _text(label, 300)
    clean_project = "B" if project.upper() == "B" else "A"
    key = (clean_agent, clean_project)
    now = datetime.now(timezone.utc)
    previous = LAST_FOCUS.get(key)
    if (
        previous
        and previous["label"] == clean_label
        and (now - previous["written_at"]).total_seconds() < 60
    ):
        return {
            **previous["event"],
            "suppressed": True,
            "message": "Samma fokus är redan aktivt; ingen ny skrivning behövdes.",
        }
    renewal = bool(previous and previous["label"] == clean_label)
    event = _event(
        "focus",
        agent=clean_agent,
        label=clean_label,
        project=clean_project,
        action=_text(action, 100),
        summary=_text(summary),
        duration_ms=max(0, int(duration_ms)),
        tokens_in=max(0, int(tokens_in)),
        tokens_out=max(0, int(tokens_out)),
        status=status if status in {"ok", "running", "warning", "error"} else "ok",
        renewal=renewal,
        lease_expires_at=(now + timedelta(seconds=75)).isoformat(),
    )
    LAST_FOCUS[key] = {
        "label": clean_label,
        "written_at": now,
        "event": event,
    }
    return event


@MCP.tool()
def studio_set_view(
    agent: str,
    project: str = "A",
    view: str = "overview",
    search: str = "",
    relation: str = "ALL",
    confidence: str = "ALL",
    layout: str = "orbit",
    summary: str = "",
) -> dict[str, Any]:
    """Set project, semantic view, search, edge filters, and layout in the open desktop app."""
    return _event(
        "view",
        agent=_text(agent, 80),
        project="B" if project.upper() == "B" else "A",
        view=view if view in {"overview", "community", "file", "neighborhood", "comparison"} else "overview",
        search=_text(search, 300),
        relation=_text(relation, 100) or "ALL",
        confidence=_text(confidence, 40) or "ALL",
        layout=layout if layout in {"constellation", "flow", "orbit", "grid"} else "constellation",
        summary=_text(summary),
        status="ok",
    )


@MCP.tool()
def studio_record_change(
    agent: str,
    files: list[str],
    summary: str,
    project: str = "A",
    duration_ms: int = 0,
    tokens_in: int = 0,
    tokens_out: int = 0,
) -> dict[str, Any]:
    """Show a completed code change as an activity pulse without storing code or private reasoning."""
    return _event(
        "change",
        agent=_text(agent, 80),
        project="B" if project.upper() == "B" else "A",
        files=[_text(item, 300) for item in files[:50]],
        summary=_text(summary),
        duration_ms=max(0, int(duration_ms)),
        tokens_in=max(0, int(tokens_in)),
        tokens_out=max(0, int(tokens_out)),
        status="ok",
    )


@MCP.tool()
def studio_record_error(
    agent: str,
    message: str,
    project: str = "A",
    file: str = "",
    label: str = "",
) -> dict[str, Any]:
    """Show a structural agent error in the graph activity timeline."""
    return _event(
        "error",
        agent=_text(agent, 80),
        project="B" if project.upper() == "B" else "A",
        file=_text(file, 300),
        label=_text(label, 300),
        summary=_text(message),
        status="error",
    )


@MCP.tool()
def studio_branch_impact(project: str = "B", max_nodes: int = 120) -> dict[str, Any]:
    """Return compact Branch Lens impact and source locations without returning whole files."""
    if project.upper() not in {"A", "B"}:
        return {"available": False, "error": "project måste vara A eller B."}
    if not ARGS.branch_impact.exists():
        return {"available": False, "message": "Ingen Branch Lens-analys är laddad."}
    try:
        data = json.loads(ARGS.branch_impact.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"available": False, "error": _text(exc)}
    limit = max(1, min(500, int(max_nodes)))
    side = project.upper()
    direct = [item for item in data.get("directNodes", []) if item.get("side") == side]
    affected = [item for item in data.get("affectedNodes", []) if item.get("side") == side]
    tests = [item for item in data.get("possibleTests", []) if item.get("side") == side]
    return {
        "available": True,
        "project": side,
        "base": data.get("base"),
        "branch": data.get("branch"),
        "merge_base": data.get("mergeBase"),
        "base_sha": data.get("baseSha"),
        "branch_sha": data.get("branchSha"),
        "changed_files": data.get("changedFiles", [])[:limit],
        "direct_changed_nodes": direct[:limit],
        "affected_nodes": affected[:limit],
        "possibly_affected_tests": tests[:limit],
        "affected_communities": data.get("communityCount", 0),
        "affected_hubs": [
            item for item in data.get("hubs", []) if item.get("side") == side
        ][:limit],
    }


if __name__ == "__main__":
    MCP.run(transport="streamable-http")
