"use client";

import { useEffect, useState } from "react";

type ToolState = boolean | "na";

type Namespace = {
  name: string;
  skillCount: number;
  skills: string[];
  source: string;
  tools: {
    claudeCode: ToolState;
    openCode: ToolState;
    openClaw: ToolState;
  };
};

type PendingChange = {
  namespace: string;
  tool: "claudeCode" | "openCode" | "openClaw";
  enabled: boolean;
};

type PathState = "found" | "manual" | "missing" | "undetected";
type ToolPathEntry = { path: string | null; manual: boolean; state: PathState };
type ToolPathsConfig = Record<string, ToolPathEntry>;

const TOOL_KEYS = ["claudeCode", "openCode", "openClaw"] as const;
const TOOL_LABELS: Record<string, { label: string }> = {
  claudeCode: { label: "Claude Code + Codex" },
  openCode: { label: "OpenCode" },
  openClaw: { label: "OpenClaw" },
};

const STATE_DOT: Record<PathState, string> = {
  found: "bg-green-500",
  manual: "bg-amber-500",
  missing: "bg-red-500",
  undetected: "bg-gray-500",
};

function truncatePath(p: string | null, maxLen = 32): string {
  if (!p) return "not found";
  if (p.length <= maxLen) return p;
  const keep = Math.floor((maxLen - 1) / 2);
  return p.slice(0, keep) + "…" + p.slice(p.length - keep);
}

export default function SkillsPage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [repoNotConfigured, setRepoNotConfigured] = useState(false);
  const [repoPathInput, setRepoPathInput] = useState("");
  const [repoPathSaving, setRepoPathSaving] = useState(false);
  const [repoPathError, setRepoPathError] = useState("");

  const [toolPaths, setToolPaths] = useState<ToolPathsConfig>({});
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [redetecting, setRedetecting] = useState(false);

  const [editingRepoPath, setEditingRepoPath] = useState(false);
  const [repoPathEditValue, setRepoPathEditValue] = useState("");
  const [repoPathEditSaving, setRepoPathEditSaving] = useState(false);
  const [repoPathEditError, setRepoPathEditError] = useState("");

  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set());

  async function loadState() {
    setLoading(true);
    setError("");
    const [distRes, cfgRes] = await Promise.all([
      fetch("/api/distribution"),
      fetch("/api/config"),
    ]);
    const dist = await distRes.json();
    const cfg = await cfgRes.json();
    if (dist.repoNotConfigured) {
      setRepoNotConfigured(true);
      setLoading(false);
      return;
    }
    setRepoNotConfigured(false);
    if (dist.error) { setError(dist.error); setLoading(false); return; }
    setNamespaces(dist.namespaces ?? []);
    setRepoPath(dist.repoPath ?? "");
    setToolPaths(cfg.tools ?? {});
    if (cfg.error) setApplyError(`Config load failed: ${cfg.error}`);
    setPending([]);
    setLoading(false);
  }

  useEffect(() => {
    loadState();
  }, []);

  function effectiveState(ns: string, tool: (typeof TOOL_KEYS)[number]): ToolState {
    const loaded = namespaces.find((n) => n.name === ns)?.tools[tool];
    if (loaded === "na") return "na";
    const p = pending.find((c) => c.namespace === ns && c.tool === tool);
    return p !== undefined ? p.enabled : (loaded ?? false);
  }

  function isPendingCell(ns: string, tool: (typeof TOOL_KEYS)[number]): boolean {
    const loaded = namespaces.find((n) => n.name === ns)?.tools[tool];
    if (loaded === "na") return false;
    const p = pending.find((c) => c.namespace === ns && c.tool === tool);
    return p !== undefined && p.enabled !== loaded;
  }

  function toggleCell(ns: string, tool: (typeof TOOL_KEYS)[number]) {
    const loaded = namespaces.find((n) => n.name === ns)?.tools[tool];
    if (loaded === "na") return;
    const current = effectiveState(ns, tool) as boolean;
    const newEnabled = !current;
    if (newEnabled === loaded) {
      setPending((prev) => prev.filter((c) => !(c.namespace === ns && c.tool === tool)));
    } else {
      setPending((prev) => {
        const without = prev.filter((c) => !(c.namespace === ns && c.tool === tool));
        return [...without, { namespace: ns, tool, enabled: newEnabled }];
      });
    }
  }

  async function applyChanges() {
    setApplying(true);
    setApplyError("");
    const res = await fetch("/api/distribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: pending }),
    });
    const data = await res.json();
    if (data.errors && data.errors.length > 0) {
      setApplyError(
        data.errors
          .map((e: { namespace: string; tool: string; error: string }) => `${e.namespace}×${e.tool}: ${e.error}`)
          .join("; ")
      );
    }
    setApplying(false);
    await loadState();
  }

  function handleUrlChange(val: string) {
    setAddUrl(val);
    const segment = val.split("/").filter(Boolean).pop() ?? "";
    const derived = segment.replace(/\.git$/, "");
    const prevDerived = addUrl.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") ?? "";
    if (!addName || addName === prevDerived) {
      setAddName(derived);
    }
  }

  async function handleAddPackage() {
    setAddLoading(true);
    setAddError("");
    const res = await fetch("/api/submodule/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: addUrl, name: addName }),
    });
    const data = await res.json();
    if (data.error) {
      setAddError(data.error);
      setAddLoading(false);
      return;
    }
    setShowAddModal(false);
    setAddUrl("");
    setAddName("");
    setAddLoading(false);
    await loadState();
  }

  async function handleSavePath(tool: string) {
    setEditSaving(true);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, path: editValue }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (data.error) {
      setApplyError(`Failed to save path: ${data.error}`);
    } else {
      setEditingTool(null);
    }
    await loadState();
  }

  async function handleRedetect() {
    setRedetecting(true);
    await fetch("/api/config/detect", { method: "POST" });
    setRedetecting(false);
    await loadState();
  }

  async function handleSaveRepoPath() {
    setRepoPathEditSaving(true);
    setRepoPathEditError("");
    const res = await fetch("/api/repo-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: repoPathEditValue }),
    });
    const data = await res.json();
    setRepoPathEditSaving(false);
    if (data.error) {
      setRepoPathEditError(data.error);
    } else {
      setEditingRepoPath(false);
      await loadState();
    }
  }

  function toggleExpand(ns: string) {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      next.has(ns) ? next.delete(ns) : next.add(ns);
      return next;
    });
  }

  async function handleDeletePackage() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/submodule/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deleteTarget }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDeleteError(data.error || "Unexpected error. Please try again.");
        return;
      }
      setDeleteTarget(null);
      await loadState();
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSaveRepoPath() {
    setRepoPathSaving(true);
    setRepoPathError("");
    try {
      const res = await fetch("/api/repo-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repoPathInput }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setRepoPathError(data.error || "Failed to save path.");
        return;
      }
      await loadState();
    } catch {
      setRepoPathError("Network error. Please try again.");
    } finally {
      setRepoPathSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  if (repoNotConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-md space-y-4">
          <h2 className="text-white font-semibold text-lg">Set Skills Repo Path</h2>
          <p className="text-sm text-gray-400">
            Enter the absolute path to your skills git repository.
          </p>
          <input
            type="text"
            value={repoPathInput}
            onChange={(e) => setRepoPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveRepoPath(); }}
            placeholder="/Users/you/Github/skills"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          {repoPathError && <p className="text-red-400 text-xs">{repoPathError}</p>}
          <div className="flex justify-end">
            <button
              onClick={handleSaveRepoPath}
              disabled={repoPathSaving || !repoPathInput.trim()}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
            >
              {repoPathSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Skill Distribution</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage which namespaces sync to each tool. Changes are written on &ldquo;Apply Changes&rdquo;.
        </p>
        <div className="flex items-center gap-2 mt-1">
          {editingRepoPath ? (
            <>
              <input
                type="text"
                value={repoPathEditValue}
                onChange={(e) => setRepoPathEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveRepoPath(); if (e.key === "Escape") setEditingRepoPath(false); }}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-200 text-xs font-mono w-80 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button onClick={handleSaveRepoPath} disabled={repoPathEditSaving} className="text-indigo-400 text-xs hover:text-indigo-300 disabled:opacity-50">
                {repoPathEditSaving ? "…" : "Save"}
              </button>
              <button onClick={() => setEditingRepoPath(false)} className="text-gray-600 text-xs hover:text-gray-400">Cancel</button>
              {repoPathEditError && <span className="text-red-400 text-xs">{repoPathEditError}</span>}
            </>
          ) : (
            <>
              {repoPath && <span className="text-gray-600 text-xs font-mono">{repoPath}</span>}
              <button
                onClick={() => { setRepoPathEditValue(repoPath); setRepoPathEditError(""); setEditingRepoPath(true); }}
                className="text-gray-700 hover:text-gray-400 text-xs"
                title="Change skills repo path"
              >
                ✎
              </button>
            </>
          )}
        </div>
      </div>

      {/* Matrix table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide w-2/5">
                Namespace
              </th>
              {TOOL_KEYS.map((key) => {
                const tp = toolPaths[key];
                const isEditing = editingTool === key;
                return (
                  <th key={key} className="px-4 py-3 text-center">
                    <div className="text-gray-300 text-xs font-semibold">{TOOL_LABELS[key].label}</div>
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1 justify-center">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-gray-200 text-xs font-mono w-40 focus:outline-none focus:border-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSavePath(key)}
                          disabled={editSaving}
                          className="text-indigo-400 text-xs hover:text-indigo-300 disabled:opacity-50"
                        >
                          {editSaving ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingTool(null)}
                          className="text-gray-600 text-xs hover:text-gray-400"
                        >
                          ✕
                        </button>
                      </div>
                    ) : tp ? (
                      <div className="flex items-center gap-1 mt-1 justify-center">
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${STATE_DOT[tp.state]}`}
                        />
                        <span className="text-gray-600 text-xs font-mono" title={tp.path ?? "not found"}>
                          {truncatePath(tp.path)}
                        </span>
                        <button
                          onClick={() => { setEditingTool(key); setEditValue(tp.path ?? ""); }}
                          className="text-gray-700 hover:text-gray-400 text-xs ml-0.5"
                          title="Edit path"
                        >
                          ✎
                        </button>
                      </div>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {namespaces.map((ns, i) => (
              <tr key={ns.name} className={i < namespaces.length - 1 ? "border-b border-gray-800" : ""}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(ns.name)}
                      className="text-gray-600 hover:text-gray-300 text-xs w-3 text-left"
                      title={expandedNs.has(ns.name) ? "Collapse" : "Expand"}
                    >
                      {expandedNs.has(ns.name) ? "▾" : "▸"}
                    </button>
                    <span className="font-mono text-gray-200 font-medium">{ns.name}</span>
                    <button
                      onClick={() => { setDeleteTarget(ns.name); setDeleteError(""); }}
                      className="text-xs text-gray-700 hover:text-red-500"
                      title="Remove package"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5 ml-5">
                    {ns.source} · {ns.skillCount} skills
                  </div>
                  {expandedNs.has(ns.name) && ns.skills.length > 0 && (
                    <div className="ml-5 mt-1 flex flex-wrap gap-1">
                      {ns.skills.map((s) => (
                        <span key={s} className="bg-gray-800 text-gray-400 text-xs px-1.5 py-0.5 rounded font-mono">{s}</span>
                      ))}
                    </div>
                  )}
                </td>
                {TOOL_KEYS.map((tool) => {
                  const state = effectiveState(ns.name, tool);
                  const hasPending = isPendingCell(ns.name, tool);
                  return (
                    <td key={tool} className="px-4 py-3 text-center">
                      {state === "na" ? (
                        <span className="text-gray-700">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={state as boolean}
                            onChange={() => toggleCell(ns.name, tool)}
                            className="w-4 h-4 accent-indigo-500 cursor-pointer"
                          />
                          {hasPending && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Pending change" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-2.5 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-600 text-xs">{namespaces.length} namespaces · 3 tools</span>
          <button
            onClick={handleRedetect}
            disabled={redetecting}
            className="text-gray-600 hover:text-gray-400 text-xs disabled:opacity-50"
          >
            {redetecting ? "Detecting…" : "Re-detect"}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowAddModal(true);
            setAddError("");
          }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg border border-gray-700"
        >
          + Add Package
        </button>
      </div>

      {/* Apply Changes banner */}
      {pending.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-gray-400 text-sm">
            <span className="text-amber-400 font-semibold">{pending.length}</span> pending change
            {pending.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            {applyError && <span className="text-red-400 text-xs">{applyError}</span>}
            <button onClick={() => setPending([])} className="text-gray-500 text-sm hover:text-gray-300">
              Undo
            </button>
            <button
              onClick={applyChanges}
              disabled={applying}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg"
            >
              {applying ? "Applying…" : "Apply Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Add Package modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-white font-semibold">Add Package</h2>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Git URL or local path</label>
                <input
                  type="text"
                  value={addUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://github.com/owner/repo or /Users/me/Github/project"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="my-skills"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 text-sm hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPackage}
                disabled={addLoading || !addUrl || !addName}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {addLoading ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Package confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">Remove Package</h2>
            <div className="space-y-2 text-sm text-gray-400">
              <p>Remove <span className="font-mono text-gray-200">{deleteTarget}</span>?</p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>Disables all active distributions</li>
                <li>Removes the git submodule</li>
                <li>You will need to <span className="font-mono">git commit</span> to finalise</li>
              </ul>
            </div>
            {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="text-gray-500 text-sm hover:text-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePackage}
                disabled={deleteLoading}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {deleteLoading ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
