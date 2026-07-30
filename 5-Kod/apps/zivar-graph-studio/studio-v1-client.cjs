const DEFAULT_ORIGIN = "http://127.0.0.1:8868";

function id(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 256 || /[\0\r\n]/.test(normalized)) {
    throw new Error(`${label} är ogiltigt.`);
  }
  return encodeURIComponent(normalized);
}

function operationRequest(operation, payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Studio V1-anropet har ogiltig payload.");
  }
  if (operation === "readiness") return { method: "GET", path: "/api/v1/system/readiness", timeout: 2500 };
  if (operation === "projectCatalog") return { method: "GET", path: "/api/v1/projects", timeout: 2500 };
  if (operation === "snapshotCatalog") {
    const projectId = id(payload.projectId, "Projekt-ID");
    return { method: "GET", path: `/api/v1/snapshots?projectId=${projectId}&limit=100`, timeout: 2500 };
  }
  if (operation === "readerContext") {
    return { method: "POST", path: "/api/v1/reader/context", body: payload, timeout: 10000 };
  }
  if (operation === "knowledgeList") {
    return { method: "POST", path: "/api/v1/knowledge/list", body: payload, timeout: 8000 };
  }
  if (operation === "knowledgeGet") {
    return { method: "POST", path: "/api/v1/knowledge/get", body: payload, timeout: 8000 };
  }
  if (operation === "knowledgeByTarget") {
    return { method: "POST", path: "/api/v1/knowledge/by-target", body: payload, timeout: 8000 };
  }
  if (operation === "activity") {
    const after = payload.after ? `?after=${id(payload.after, "Aktivitetsmarkör")}` : "";
    return { method: "GET", path: `/api/v1/activity${after}`, timeout: 2500 };
  }
  if (operation === "jobs") return { method: "GET", path: "/api/v1/jobs?limit=50", timeout: 2500 };
  if (operation === "cancelJob" || operation === "retryJob") {
    const jobId = id(payload.jobId, "Jobb-ID");
    const action = operation === "cancelJob" ? "cancel" : "retry";
    return { method: "POST", path: `/api/v1/jobs/${jobId}/${action}`, body: {}, timeout: 8000 };
  }
  throw new Error("Studio V1-operationen är inte tillåten.");
}

class StudioV1Client {
  constructor(origin = DEFAULT_ORIGIN) {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
      throw new Error("Studio V1 måste använda lokal loopback.");
    }
    this.origin = parsed.origin;
    this.cookie = "";
    this.csrf = "";
  }

  async startSession() {
    const response = await fetch(`${this.origin}/api/v1/system/session`, {
      method: "POST",
      headers: { Origin: this.origin },
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();
    if (!response.ok || result?.ok === false || typeof result?.value?.csrfToken !== "string") {
      throw new Error(result?.error?.message || "Studio V1-sessionen kunde inte startas.");
    }
    this.cookie = String(response.headers.get("set-cookie") || "").split(";", 1)[0];
    this.csrf = result.value.csrfToken;
  }

  async request(specification, retry = true) {
    if (!this.cookie || !this.csrf) await this.startSession();
    const response = await fetch(`${this.origin}${specification.path}`, {
      method: specification.method,
      headers: {
        Origin: this.origin,
        Cookie: this.cookie,
        "X-CSRF-Token": this.csrf,
        ...(specification.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(specification.body === undefined ? {} : { body: JSON.stringify(specification.body) }),
      signal: AbortSignal.timeout(specification.timeout),
    });
    if (response.status === 401 && retry) {
      this.cookie = "";
      this.csrf = "";
      return this.request(specification, false);
    }
    const result = await response.json();
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error?.message || result?.error || `Studio V1 svarade ${response.status}.`);
    }
    return result.value;
  }

  call(operation, payload) {
    return this.request(operationRequest(String(operation || ""), payload));
  }
}

module.exports = { DEFAULT_ORIGIN, StudioV1Client, operationRequest };
