const fs = require("node:fs");
const path = require("node:path");

const IMPORT_RELATIONS = new Set([
  "imports",
  "imports_from",
  "re_exports",
  "requires",
  "depends_on",
]);

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizedLabel(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function endpointId(value) {
  if (value && typeof value === "object") return String(value.id ?? value.label ?? "");
  return String(value ?? "");
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function jaccard(left, right) {
  const a = left instanceof Set ? left : new Set(left);
  const b = right instanceof Set ? right : new Set(right);
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / (a.size + b.size - shared || 1);
}

function topLevel(sourceFile) {
  const normalized = cleanText(sourceFile).replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean)[0] || "(utan sökväg)";
}

function fileBase(sourceFile) {
  return path.basename(cleanText(sourceFile).replaceAll("\\", "/")).toLowerCase();
}

function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}

function graphFromCsv(input, name = "CSV") {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error("CSV-filen saknar datarader.");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const indexOf = (...names) => names.map((value) => headers.indexOf(value)).find((value) => value >= 0) ?? -1;
  const sourceIndex = indexOf("source", "from", "källa");
  const targetIndex = indexOf("target", "to", "mål");
  const idIndex = indexOf("id", "node_id", "key");
  const labelIndex = indexOf("label", "name", "title", "namn");
  const relationIndex = indexOf("relation", "type", "edge_type");
  const nodes = new Map();
  const links = [];
  const ensureNode = (id, label = id) => {
    const key = cleanText(id);
    if (key && !nodes.has(key)) {
      nodes.set(key, {
        id: key,
        label: cleanText(label, key),
        file_type: "data",
        source_file: name,
        community: 0,
        community_name: name,
      });
    }
  };
  for (const values of rows.slice(1)) {
    if (sourceIndex >= 0 && targetIndex >= 0) {
      const source = cleanText(values[sourceIndex]);
      const target = cleanText(values[targetIndex]);
      if (!source || !target) continue;
      ensureNode(source);
      ensureNode(target);
      links.push({
        source,
        target,
        relation: cleanText(values[relationIndex], "links_to"),
        confidence: "IMPORTED",
        confidence_score: 1,
        weight: 1,
        source_file: name,
      });
    } else {
      const id = cleanText(values[idIndex >= 0 ? idIndex : 0]);
      if (id) ensureNode(id, values[labelIndex >= 0 ? labelIndex : idIndex]);
    }
  }
  if (!nodes.size) throw new Error("CSV-filen innehåller varken noder eller source/target-kopplingar.");
  return { directed: true, multigraph: true, nodes: [...nodes.values()], links };
}

function graphFromSql(input, name = "SQL-schema") {
  const nodes = new Map();
  const links = [];
  const tablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?[\w-]+"?\.)?"?([\w-]+)"?\s*\(([\s\S]*?)\)\s*;/gi;
  for (const match of input.matchAll(tablePattern)) {
    const table = match[1];
    nodes.set(table, {
      id: table,
      label: table,
      file_type: "table",
      source_file: name,
      source_location: "CREATE TABLE",
      community: 0,
      community_name: "Databasschema",
    });
  }
  const referencePattern = /(?:(?:alter\s+table\s+(?:"?[\w-]+"?\.)?"?([\w-]+)"?[\s\S]*?)|(?:create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?[\w-]+"?\.)?"?([\w-]+)"?[\s\S]*?))references\s+(?:"?[\w-]+"?\.)?"?([\w-]+)"?/gi;
  for (const match of input.matchAll(referencePattern)) {
    const source = match[1] || match[2];
    const target = match[3];
    if (!source || !target) continue;
    for (const table of [source, target]) {
      if (!nodes.has(table)) {
        nodes.set(table, {
          id: table,
          label: table,
          file_type: "table",
          source_file: name,
          community: 0,
          community_name: "Databasschema",
        });
      }
    }
    links.push({
      source,
      target,
      relation: "foreign_key",
      confidence: "EXTRACTED",
      confidence_score: 1,
      weight: 1,
      source_file: name,
    });
  }
  if (!nodes.size) throw new Error("Ingen CREATE TABLE-struktur hittades i SQL-filen.");
  return { directed: true, multigraph: true, nodes: [...nodes.values()], links };
}

class GraphProject {
  constructor(data, options = {}) {
    this.name = cleanText(options.name, "Projekt");
    this.graphPath = options.graphPath || null;
    this.sourceRoot = options.sourceRoot || null;
    this.kind = options.kind || "graphify";
    this.builtAtCommit = data.built_at_commit || null;
    this.nodes = [];
    this.links = [];
    this.byId = new Map();
    this.adjacency = new Map();
    this.byCommunity = new Map();
    this.byFile = new Map();
    this.degree = new Map();
    this.relationCounts = new Map();
    this.confidenceCounts = new Map();
    this._audit = null;

    for (const raw of Array.isArray(data.nodes) ? data.nodes : []) {
      const id = endpointId(raw.id || raw.label);
      if (!id || this.byId.has(id)) continue;
      const node = {
        ...raw,
        id,
        label: cleanText(raw.label, id),
        source_file: cleanText(raw.source_file),
        file_type: cleanText(raw.file_type, cleanText(raw.type, "symbol")),
        community: Number.isFinite(Number(raw.community)) ? Number(raw.community) : -1,
        community_name: cleanText(raw.community_name, `Community ${raw.community ?? "?"}`),
      };
      this.nodes.push(node);
      this.byId.set(id, node);
      this.adjacency.set(id, []);
      this.degree.set(id, 0);
      if (!this.byCommunity.has(node.community)) this.byCommunity.set(node.community, []);
      this.byCommunity.get(node.community).push(id);
      if (node.source_file) {
        if (!this.byFile.has(node.source_file)) this.byFile.set(node.source_file, []);
        this.byFile.get(node.source_file).push(id);
      }
    }

    for (const raw of Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : []) {
      const source = endpointId(raw.source);
      const target = endpointId(raw.target);
      if (!this.byId.has(source) || !this.byId.has(target)) continue;
      const edge = {
        ...raw,
        source,
        target,
        relation: cleanText(raw.relation, cleanText(raw.type, "related_to")),
        confidence: cleanText(raw.confidence, "UNKNOWN").toUpperCase(),
        confidence_score: Number.isFinite(Number(raw.confidence_score)) ? Number(raw.confidence_score) : 0,
        weight: Math.max(0.01, Number(raw.weight) || 1),
        source_file: cleanText(raw.source_file),
      };
      const index = this.links.length;
      this.links.push(edge);
      this.adjacency.get(source).push({ edge: index, other: target, direction: "out" });
      this.adjacency.get(target).push({ edge: index, other: source, direction: "in" });
      this.degree.set(source, this.degree.get(source) + 1);
      this.degree.set(target, this.degree.get(target) + 1);
      this.relationCounts.set(edge.relation, (this.relationCounts.get(edge.relation) || 0) + 1);
      this.confidenceCounts.set(edge.confidence, (this.confidenceCounts.get(edge.confidence) || 0) + 1);
    }
    this.summary = this.#buildSummary();
  }

  static fromFile(graphPath, options = {}) {
    const input = fs.readFileSync(graphPath, "utf8");
    const extension = path.extname(graphPath).toLowerCase();
    let data;
    let kind = options.kind;
    if (extension === ".csv") {
      data = graphFromCsv(input, path.basename(graphPath));
      kind ||= "csv";
    } else if (extension === ".sql") {
      data = graphFromSql(input, path.basename(graphPath));
      kind ||= "sql";
    } else {
      data = JSON.parse(input);
      kind ||= "graphify";
    }
    return new GraphProject(data, {
      ...options,
      graphPath,
      kind,
      name: options.name || path.basename(path.dirname(graphPath)),
    });
  }

  #buildSummary() {
    const parent = new Map(this.nodes.map((node) => [node.id, node.id]));
    const find = (id) => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(id) !== id) {
        const next = parent.get(id);
        parent.set(id, root);
        id = next;
      }
      return root;
    };
    const union = (a, b) => {
      const left = find(a);
      const right = find(b);
      if (left !== right) parent.set(right, left);
    };
    for (const edge of this.links) union(edge.source, edge.target);
    const components = new Map();
    for (const node of this.nodes) {
      const root = find(node.id);
      components.set(root, (components.get(root) || 0) + 1);
    }
    const componentSizes = [...components.values()].sort((a, b) => b - a);
    const degrees = [...this.degree.values()];
    const isolates = degrees.filter((value) => value === 0).length;
    return {
      name: this.name,
      kind: this.kind,
      nodes: this.nodes.length,
      edges: this.links.length,
      communities: this.byCommunity.size,
      files: this.byFile.size,
      relations: this.relationCounts.size,
      components: componentSizes.length,
      largestComponent: componentSizes[0] || 0,
      largestComponentRatio: this.nodes.length ? (componentSizes[0] || 0) / this.nodes.length : 0,
      isolates,
      averageDegree: this.nodes.length ? (this.links.length * 2) / this.nodes.length : 0,
      p95Degree: percentile(degrees, 0.95),
      maxDegree: Math.max(0, ...degrees),
      builtAtCommit: this.builtAtCommit,
      relationCounts: Object.fromEntries([...this.relationCounts.entries()].sort((a, b) => b[1] - a[1])),
      confidenceCounts: Object.fromEntries([...this.confidenceCounts.entries()].sort((a, b) => b[1] - a[1])),
    };
  }

  #edgeAllowed(edge, filters = {}) {
    const relation = cleanText(filters.relation, "ALL");
    const confidence = cleanText(filters.confidence, "ALL").toUpperCase();
    const minWeight = Number(filters.minWeight) || 0;
    return (relation === "ALL" || edge.relation === relation)
      && (confidence === "ALL" || edge.confidence === confidence)
      && edge.weight >= minWeight;
  }

  #viewNode(node, extra = {}) {
    return {
      id: node.id,
      label: node.label,
      subtitle: node.source_file || node.file_type,
      kind: node.file_type,
      community: node.community,
      communityName: node.community_name,
      sourceFile: node.source_file,
      degree: this.degree.get(node.id) || 0,
      size: 1 + Math.log2((this.degree.get(node.id) || 0) + 1),
      cluster: node.source_file ? topLevel(node.source_file) : node.file_type,
      project: this.name,
      ...extra,
    };
  }

  #aggregateEdges(nodeKey, filters, maximum = 2500) {
    const aggregate = new Map();
    const aggregateFilters = { ...filters, minWeight: 0 };
    const minWeight = Number(filters?.minWeight) || 0;
    for (const edge of this.links) {
      if (!this.#edgeAllowed(edge, aggregateFilters)) continue;
      const source = nodeKey(edge.source);
      const target = nodeKey(edge.target);
      if (!source || !target || source === target) continue;
      const key = `${source}\u0000${target}`;
      let item = aggregate.get(key);
      if (!item) {
        item = {
          id: key,
          source,
          target,
          weight: 0,
          count: 0,
          inferred: 0,
          relations: new Map(),
        };
        aggregate.set(key, item);
      }
      item.weight += edge.weight;
      item.count += 1;
      if (edge.confidence === "INFERRED") item.inferred += 1;
      item.relations.set(edge.relation, (item.relations.get(edge.relation) || 0) + 1);
    }
    return [...aggregate.values()]
      .filter((item) => item.weight >= minWeight)
      .sort((a, b) => b.count - a.count)
      .slice(0, maximum)
      .map((item) => {
        const [relation, relationCount] = [...item.relations.entries()].sort((a, b) => b[1] - a[1])[0];
        return {
          id: item.id,
          source: item.source,
          target: item.target,
          relation,
          relationCount,
          count: item.count,
          weight: item.weight,
          confidence: item.inferred === item.count ? "INFERRED" : item.inferred ? "MIXED" : "EXTRACTED",
          label: `${item.count} ${relation}`,
        };
      });
  }

  overview(filters = {}) {
    const nodes = [];
    const communityKey = (id) => `community:${this.byId.get(id)?.community ?? -1}`;
    for (const [community, ids] of this.byCommunity) {
      const members = ids.map((id) => this.byId.get(id));
      const names = new Map();
      const roots = new Map();
      let degree = 0;
      for (const member of members) {
        names.set(member.community_name, (names.get(member.community_name) || 0) + 1);
        roots.set(topLevel(member.source_file), (roots.get(topLevel(member.source_file)) || 0) + 1);
        degree += this.degree.get(member.id) || 0;
      }
      const label = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || `Community ${community}`;
      const cluster = [...roots.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "(utan sökväg)";
      nodes.push({
        id: `community:${community}`,
        label,
        subtitle: `${ids.length} noder · ${cluster}`,
        kind: "community",
        community,
        communityName: label,
        sourceFile: "",
        degree,
        size: 4 + Math.log2(ids.length + 1) * 1.6,
        rawCount: ids.length,
        cluster,
        project: this.name,
      });
    }
    return {
      mode: "overview",
      title: this.name,
      breadcrumb: [this.name],
      nodes,
      edges: this.#aggregateEdges(communityKey, filters),
      summary: this.summary,
    };
  }

  community(community, filters = {}) {
    const numericCommunity = Number(community);
    const ids = this.byCommunity.get(numericCommunity) || [];
    const files = new Map();
    for (const id of ids) {
      const node = this.byId.get(id);
      const sourceFile = node.source_file || "(utan källfil)";
      if (!files.has(sourceFile)) files.set(sourceFile, []);
      files.get(sourceFile).push(id);
    }
    const nodes = [...files.entries()].map(([sourceFile, members]) => ({
      id: `file:${sourceFile}`,
      label: path.basename(sourceFile),
      subtitle: `${members.length} symboler · ${sourceFile}`,
      kind: "file",
      community: numericCommunity,
      communityName: this.byId.get(members[0])?.community_name || `Community ${numericCommunity}`,
      sourceFile,
      degree: members.reduce((sum, id) => sum + (this.degree.get(id) || 0), 0),
      size: 3 + Math.log2(members.length + 1) * 1.5,
      rawCount: members.length,
      cluster: path.dirname(sourceFile).replaceAll("\\", "/"),
      project: this.name,
    }));
    const idToFile = new Map();
    for (const [sourceFile, members] of files) {
      for (const id of members) idToFile.set(id, `file:${sourceFile}`);
    }
    const edges = this.#aggregateEdges((id) => idToFile.get(id), filters, 3000);
    const label = nodes[0]?.communityName || `Community ${numericCommunity}`;
    return {
      mode: "community",
      title: label,
      breadcrumb: [this.name, label],
      nodes,
      edges,
      summary: { files: nodes.length, nodes: ids.length, edges: edges.reduce((sum, edge) => sum + edge.count, 0) },
    };
  }

  file(sourceFile, filters = {}) {
    const ids = this.byFile.get(sourceFile) || [];
    const ordered = [...ids].sort((a, b) => (this.degree.get(b) || 0) - (this.degree.get(a) || 0)).slice(0, 700);
    const visible = new Set(ordered);
    const nodes = ordered.map((id) => this.#viewNode(this.byId.get(id)));
    const edges = [];
    const rawFilters = { ...filters, minWeight: 0 };
    for (let index = 0; index < this.links.length; index += 1) {
      const edge = this.links[index];
      if (!this.#edgeAllowed(edge, rawFilters) || !visible.has(edge.source) || !visible.has(edge.target)) continue;
      edges.push({
        id: `edge:${index}`,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
        count: 1,
        weight: edge.weight,
        confidence: edge.confidence,
        label: edge.relation,
      });
    }
    return {
      mode: "file",
      title: path.basename(sourceFile),
      breadcrumb: [this.name, topLevel(sourceFile), sourceFile],
      nodes,
      edges: edges.slice(0, 3500),
      summary: { nodes: nodes.length, edges: edges.length, sourceFile },
    };
  }

  neighborhood(nodeId, filters = {}, depth = 1) {
    if (!this.byId.has(nodeId)) throw new Error(`Noden finns inte: ${nodeId}`);
    const visible = new Set([nodeId]);
    const rawFilters = { ...filters, minWeight: 0 };
    let frontier = [nodeId];
    for (let level = 0; level < Math.max(1, Math.min(3, Number(depth) || 1)); level += 1) {
      const next = [];
      for (const id of frontier) {
        for (const adjacent of this.adjacency.get(id) || []) {
          const edge = this.links[adjacent.edge];
          if (!this.#edgeAllowed(edge, rawFilters) || visible.has(adjacent.other)) continue;
          visible.add(adjacent.other);
          next.push(adjacent.other);
          if (visible.size >= 800) break;
        }
        if (visible.size >= 800) break;
      }
      frontier = next;
      if (!frontier.length || visible.size >= 800) break;
    }
    const ordered = [...visible].sort((a, b) => {
      if (a === nodeId) return -1;
      if (b === nodeId) return 1;
      return (this.degree.get(b) || 0) - (this.degree.get(a) || 0);
    });
    const nodes = ordered.map((id) => this.#viewNode(this.byId.get(id), { focus: id === nodeId }));
    const edges = [];
    for (const id of visible) {
      for (const adjacent of this.adjacency.get(id) || []) {
        if (adjacent.direction !== "out" || !visible.has(adjacent.other)) continue;
        const edge = this.links[adjacent.edge];
        if (!this.#edgeAllowed(edge, rawFilters)) continue;
        edges.push({
          id: `edge:${adjacent.edge}`,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
          count: 1,
          weight: edge.weight,
          confidence: edge.confidence,
          label: edge.relation,
        });
      }
    }
    const focus = this.byId.get(nodeId);
    return {
      mode: "neighborhood",
      title: focus.label,
      breadcrumb: [this.name, focus.source_file || focus.community_name, focus.label],
      nodes,
      edges,
      summary: { nodes: nodes.length, edges: edges.length, depth },
    };
  }

  view(request = {}) {
    if (request.mode === "community") return this.community(request.key, request.filters);
    if (request.mode === "file") return this.file(request.key, request.filters);
    if (request.mode === "neighborhood") return this.neighborhood(request.key, request.filters, request.depth);
    return this.overview(request.filters);
  }

  search(query, limit = 30) {
    const needle = normalizedLabel(query);
    if (!needle) return [];
    return this.nodes
      .map((node) => {
        const label = normalizedLabel(node.label);
        const file = normalizedLabel(node.source_file);
        let score = 0;
        if (label === needle) score = 100;
        else if (label.startsWith(needle)) score = 70;
        else if (label.includes(needle)) score = 50;
        else if (file.includes(needle)) score = 25;
        return { node, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (this.degree.get(b.node.id) || 0) - (this.degree.get(a.node.id) || 0))
      .slice(0, limit)
      .map(({ node, score }) => ({ ...this.#viewNode(node), score }));
  }

  nodeDetails(id) {
    if (id.startsWith("community:")) {
      const community = Number(id.slice("community:".length));
      const view = this.community(community);
      const topFiles = [...view.nodes].sort((a, b) => b.rawCount - a.rawCount).slice(0, 12);
      return { id, label: view.title, kind: "community", summary: view.summary, topFiles };
    }
    if (id.startsWith("file:")) {
      const sourceFile = id.slice("file:".length);
      const members = this.byFile.get(sourceFile) || [];
      const topNodes = members
        .sort((a, b) => (this.degree.get(b) || 0) - (this.degree.get(a) || 0))
        .slice(0, 15)
        .map((nodeId) => this.#viewNode(this.byId.get(nodeId)));
      return {
        id,
        label: path.basename(sourceFile),
        kind: "file",
        sourceFile,
        summary: { nodes: members.length, degree: topNodes.reduce((sum, node) => sum + node.degree, 0) },
        topNodes,
      };
    }
    const node = this.byId.get(id);
    if (!node) return null;
    const neighbors = (this.adjacency.get(id) || [])
      .map((item) => {
        const edge = this.links[item.edge];
        const other = this.byId.get(item.other);
        return {
          id: other.id,
          label: other.label,
          sourceFile: other.source_file,
          relation: edge.relation,
          confidence: edge.confidence,
          direction: item.direction,
          degree: this.degree.get(other.id) || 0,
        };
      })
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 30);
    return {
      ...node,
      kind: node.file_type,
      degree: this.degree.get(id) || 0,
      neighbors,
      relations: [...new Set(neighbors.map((item) => item.relation))],
    };
  }

  audit() {
    if (this._audit) return this._audit;
    const duplicates = new Map();
    let selfLoops = 0;
    let inferred = 0;
    for (const edge of this.links) {
      const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
      duplicates.set(key, (duplicates.get(key) || 0) + 1);
      if (edge.source === edge.target) selfLoops += 1;
      if (edge.confidence === "INFERRED") inferred += 1;
    }
    const duplicateEdges = [...duplicates.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    const importLinks = this.links.filter((edge) => IMPORT_RELATIONS.has(edge.relation));
    const outgoing = new Map();
    for (const edge of importLinks) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      outgoing.get(edge.source).push(edge.target);
    }
    const indexById = new Map();
    const lowById = new Map();
    const stack = [];
    const onStack = new Set();
    const cycles = [];
    let nextIndex = 0;
    const visit = (id) => {
      indexById.set(id, nextIndex);
      lowById.set(id, nextIndex);
      nextIndex += 1;
      stack.push(id);
      onStack.add(id);
      for (const target of outgoing.get(id) || []) {
        if (!indexById.has(target)) {
          visit(target);
          lowById.set(id, Math.min(lowById.get(id), lowById.get(target)));
        } else if (onStack.has(target)) {
          lowById.set(id, Math.min(lowById.get(id), indexById.get(target)));
        }
      }
      if (lowById.get(id) !== indexById.get(id)) return;
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== id);
      if (component.length > 1) cycles.push(component);
    };
    for (const id of outgoing.keys()) if (!indexById.has(id)) visit(id);
    const hubs = this.nodes
      .map((node) => ({ id: node.id, label: node.label, sourceFile: node.source_file, degree: this.degree.get(node.id) || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 20);
    const isolateRatio = this.nodes.length ? this.summary.isolates / this.nodes.length : 0;
    const inferredRatio = this.links.length ? inferred / this.links.length : 0;
    const duplicateRatio = this.links.length ? duplicateEdges / this.links.length : 0;
    const cycleRatio = importLinks.length ? cycles.reduce((sum, cycle) => sum + cycle.length, 0) / importLinks.length : 0;
    const riskScore = Math.min(100, Math.round(
      isolateRatio * 20
      + inferredRatio * 20
      + duplicateRatio * 30
      + Math.min(1, cycleRatio) * 20
      + (selfLoops ? 10 : 0),
    ));
    this._audit = {
      riskScore,
      isolates: this.summary.isolates,
      isolateRatio,
      inferred,
      inferredRatio,
      duplicateEdges,
      duplicateRatio,
      selfLoops,
      importCycles: cycles.length,
      cycleNodes: cycles.reduce((sum, cycle) => sum + cycle.length, 0),
      cycleExamples: cycles.slice(0, 8).map((cycle) => cycle.slice(0, 8).map((id) => this.byId.get(id)?.label || id)),
      hubs,
      formula: "20% isolering + 20% infererade länkar + 30% dubblettkanter + 20% importcykler + 10% självlänkar",
    };
    return this._audit;
  }

  matchingSets() {
    const labels = new Map();
    for (const node of this.nodes) {
      const key = normalizedLabel(node.label);
      if (!key) continue;
      if (!labels.has(key)) labels.set(key, []);
      labels.get(key).push(node.id);
    }
    return {
      labels,
      labelSet: new Set(labels.keys()),
      files: new Set([...this.byFile.keys()].map(fileBase).filter(Boolean)),
      relations: new Set(this.relationCounts.keys()),
      kinds: new Set(this.nodes.map((node) => node.file_type)),
      roots: new Set(this.nodes.map((node) => topLevel(node.source_file))),
    };
  }
}

function compareProjects(left, right) {
  if (!left || !right) return null;
  const a = left.matchingSets();
  const b = right.matchingSets();
  const facets = {
    labels: jaccard(a.labelSet, b.labelSet),
    files: jaccard(a.files, b.files),
    relations: jaccard(a.relations, b.relations),
    nodeKinds: jaccard(a.kinds, b.kinds),
    roots: jaccard(a.roots, b.roots),
  };
  const overall = facets.labels * 0.35
    + facets.files * 0.2
    + facets.relations * 0.2
    + facets.nodeKinds * 0.15
    + facets.roots * 0.1;
  const sharedLabels = [...a.labelSet].filter((label) => b.labelSet.has(label));
  const exactMatches = [];
  for (const label of sharedLabels) {
    const leftIds = a.labels.get(label);
    const rightIds = b.labels.get(label);
    if (leftIds.length !== 1 || rightIds.length !== 1) continue;
    const leftNode = left.byId.get(leftIds[0]);
    const rightNode = right.byId.get(rightIds[0]);
    exactMatches.push({
      label: leftNode.label,
      aId: leftNode.id,
      bId: rightNode.id,
      aFile: leftNode.source_file,
      bFile: rightNode.source_file,
      aCommunity: leftNode.community,
      bCommunity: rightNode.community,
      aDegree: left.degree.get(leftNode.id) || 0,
      bDegree: right.degree.get(rightNode.id) || 0,
    });
  }
  exactMatches.sort((x, y) => (y.aDegree + y.bDegree) - (x.aDegree + x.bDegree));
  return {
    left: left.summary,
    right: right.summary,
    facets,
    weights: { labels: 0.35, files: 0.2, relations: 0.2, nodeKinds: 0.15, roots: 0.1 },
    overall,
    sharedLabels: sharedLabels.length,
    exactMatches: exactMatches.slice(0, 250),
    ambiguousMatches: sharedLabels.length - exactMatches.length,
    audits: { left: left.audit(), right: right.audit() },
  };
}

function comparisonGraph(left, right) {
  const comparison = compareProjects(left, right);
  if (!comparison) return null;
  const pairCounts = new Map();
  for (const match of comparison.exactMatches) {
    const key = `${match.aCommunity}\u0000${match.bCommunity}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const pairs = [...pairCounts.entries()]
    .map(([key, count]) => {
      const [aCommunity, bCommunity] = key.split("\u0000").map(Number);
      return { aCommunity, bCommunity, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 180);
  const prefixView = (project, side) => {
    const view = project.overview({ minWeight: 0 });
    return {
      nodes: view.nodes.map((node) => ({
        ...node,
        id: `${side}:${node.id}`,
        subtitle: `${node.rawCount} noder · ${side}`,
        project: side,
      })),
      edges: view.edges.map((edge) => ({
        ...edge,
        id: `${side}:${edge.id}`,
        source: `${side}:${edge.source}`,
        target: `${side}:${edge.target}`,
        project: side,
      })),
    };
  };
  const leftView = prefixView(left, "A");
  const rightView = prefixView(right, "B");
  const nodes = [
    ...leftView.nodes,
    ...rightView.nodes,
  ];
  const edges = [
    ...leftView.edges,
    ...rightView.edges,
    ...pairs.map((pair, index) => ({
      id: `match:${index}`,
      source: `A:community:${pair.aCommunity}`,
      target: `B:community:${pair.bCommunity}`,
      relation: "exact_label_match",
      confidence: "DETERMINISTIC",
      count: pair.count,
      weight: pair.count,
      label: `${pair.count} exakta namnmatchningar`,
    })),
  ];
  return {
    mode: "comparison",
    title: `${left.name} ↔ ${right.name}`,
    breadcrumb: ["Jämförelse", left.name, right.name],
    nodes,
    edges,
    summary: comparison,
  };
}

function differenceGraph(left, right, perSideLimit = 350) {
  const comparison = compareProjects(left, right);
  if (!comparison) return null;
  const a = left.matchingSets();
  const b = right.matchingSets();
  const changedPairs = [];
  const changedA = new Set();
  const changedB = new Set();

  for (const match of comparison.exactMatches) {
    const leftRelations = relationSet(left, match.aId);
    const rightRelations = relationSet(right, match.bId);
    if (
      match.aDegree !== match.bDegree
      || jaccard(leftRelations, rightRelations) < 1
      || fileBase(match.aFile) !== fileBase(match.bFile)
    ) {
      changedPairs.push(match);
      changedA.add(match.aId);
      changedB.add(match.bId);
    }
  }

  const candidates = (project, other, changed) => project.nodes
    .filter((node) => {
      const label = normalizedLabel(node.label);
      return label && (!other.labelSet.has(label) || changed.has(node.id));
    })
    .sort((x, y) => (project.degree.get(y.id) || 0) - (project.degree.get(x.id) || 0))
    .slice(0, perSideLimit);
  const leftNodes = candidates(left, b, changedA);
  const rightNodes = candidates(right, a, changedB);
  const leftVisible = new Set(leftNodes.map((node) => node.id));
  const rightVisible = new Set(rightNodes.map((node) => node.id));

  const viewNode = (project, node, side, status) => ({
    id: `${side}:${node.id}`,
    label: node.label,
    subtitle: node.source_file || node.file_type,
    kind: node.file_type,
    community: node.community,
    communityName: node.community_name,
    sourceFile: node.source_file,
    degree: project.degree.get(node.id) || 0,
    size: 1 + Math.log2((project.degree.get(node.id) || 0) + 1),
    cluster: node.source_file ? topLevel(node.source_file) : node.file_type,
    project: side,
    changeStatus: status,
  });
  const nodes = [
    ...leftNodes.map((node) => viewNode(left, node, "A", changedA.has(node.id) ? "modified" : "deleted")),
    ...rightNodes.map((node) => viewNode(right, node, "B", changedB.has(node.id) ? "modified" : "added")),
  ];
  const projectEdges = (project, side, visible) => project.links
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => visible.has(edge.source) && visible.has(edge.target))
    .slice(0, 2500)
    .map(({ edge, index }) => ({
      id: `${side}:diff:${index}`,
      source: `${side}:${edge.source}`,
      target: `${side}:${edge.target}`,
      relation: edge.relation,
      confidence: edge.confidence,
      weight: edge.weight,
      count: 1,
      label: edge.relation,
      project: side,
    }));
  const edges = [
    ...projectEdges(left, "A", leftVisible),
    ...projectEdges(right, "B", rightVisible),
    ...changedPairs
      .filter((match) => leftVisible.has(match.aId) && rightVisible.has(match.bId))
      .map((match, index) => ({
        id: `changed-match:${index}`,
        source: `A:${match.aId}`,
        target: `B:${match.bId}`,
        relation: "changed_match",
        confidence: "DETERMINISTIC",
        weight: 1,
        count: 1,
        label: "samma namn, olika kopplingar",
      })),
  ];
  return {
    mode: "comparison",
    diffLens: true,
    title: `Skillnader: ${left.name} ↔ ${right.name}`,
    breadcrumb: ["Skillnader", left.name, right.name],
    nodes,
    edges,
    summary: {
      ...comparison,
      differences: {
        onlyA: leftNodes.length - changedA.size,
        onlyB: rightNodes.length - changedB.size,
        changed: changedPairs.length,
      },
    },
  };
}

function relationSet(project, id) {
  const result = new Set();
  for (const adjacent of project.adjacency.get(id) || []) {
    result.add(project.links[adjacent.edge].relation);
  }
  return result;
}

function simulateIntegration(left, right, aId, bId) {
  if (!left || !right) throw new Error("Två projekt måste vara laddade.");
  const a = left.byId.get(aId);
  const b = right.byId.get(bId);
  if (!a || !b) throw new Error("Välj en riktig symbol i båda projekten.");
  const sameLabel = normalizedLabel(a.label) === normalizedLabel(b.label);
  const sameFile = fileBase(a.source_file) && fileBase(a.source_file) === fileBase(b.source_file);
  const sameKind = a.file_type === b.file_type;
  const relationOverlap = jaccard(relationSet(left, a.id), relationSet(right, b.id));
  const hubA = (left.degree.get(a.id) || 0) >= left.summary.p95Degree;
  const hubB = (right.degree.get(b.id) || 0) >= right.summary.p95Degree;
  let risk = 0;
  const findings = [];
  if (sameLabel) {
    risk += 35;
    findings.push({ level: "high", text: "Samma normaliserade namn kan ge symbol- eller ansvarskollision." });
  }
  if (sameFile) {
    risk += 20;
    findings.push({ level: "high", text: "Samma filnamn finns på båda sidor och kräver ett uttalat ägarskap." });
  }
  if (hubA || hubB) {
    risk += 20;
    findings.push({ level: "medium", text: "Minst en nod är en arkitekturhubb; ändringen får stor följdyta." });
  }
  if (relationOverlap < 0.25) {
    risk += 15;
    findings.push({ level: "medium", text: "Noderna har få gemensamma relationstyper och passar inte direkt i samma roll." });
  }
  if (!sameKind) {
    risk += 10;
    findings.push({ level: "low", text: "Nodtyperna skiljer sig och behöver en adapter eller tydlig gräns." });
  }
  const compatibility = Math.round((
    (sameLabel ? 0.35 : 0)
    + (sameKind ? 0.25 : 0)
    + relationOverlap * 0.3
    + (sameFile ? 0.1 : 0)
  ) * 100);
  return {
    a: left.nodeDetails(a.id),
    b: right.nodeDetails(b.id),
    risk: Math.min(100, risk),
    compatibility: Math.min(100, compatibility),
    relationOverlap,
    findings,
    verdict: risk >= 65 ? "Hög strukturell risk" : risk >= 35 ? "Kräver avgränsad adapter" : "Strukturellt rimlig kandidat",
    limitation: "Detta är en deterministisk strukturprognos. Körtidsfel kan bara bevisas av projektens riktiga tester.",
  };
}

module.exports = {
  GraphProject,
  compareProjects,
  comparisonGraph,
  differenceGraph,
  graphFromCsv,
  graphFromSql,
  normalizedLabel,
  simulateIntegration,
};
