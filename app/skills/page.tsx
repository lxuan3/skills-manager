"use client";

import { useEffect, useState } from "react";

type ToolState = boolean | "na";

type Namespace = {
  name: string;
  skillCount: number;
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

const TOOL_KEYS = ["claudeCode", "openCode", "openClaw"] as const;
const TOOL_LABELS: Record<string, { label: string; hint: string }> = {
  claudeCode: { label: "Claude Code + Codex", hint: "~/.agents/skills/" },
  openCode: { label: "OpenCode", hint: "opencode.json" },
  openClaw: { label: "OpenClaw", hint: "~/.openclaw/skills/" },
};

export default function SkillsPage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
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

  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState("");

  async function loadState() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/distribution");
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    setNamespaces(data.namespaces ?? []);
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

  async function handleNewSkill() {
    setSkillLoading(true);
    setSkillError("");
    const res = await fetch("/api/own/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: skillName }),
    });
    const data = await res.json();
    if (data.error) {
      setSkillError(data.error);
      setSkillLoading(false);
      return;
    }
    await fetch("/api/own/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: skillName }),
    });
    setShowSkillModal(false);
    setSkillName("");
    setSkillLoading(false);
    await loadState();
  }

  async function handleOpenOwnDir() {
    await fetch("/api/own/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Skill Distribution</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage which namespaces sync to each tool. Changes are written on &ldquo;Apply Changes&rdquo;.
        </p>
      </div>

      {/* Matrix table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide w-2/5">
                Namespace
              </th>
              {TOOL_KEYS.map((key) => (
                <th key={key} className="px-4 py-3 text-center">
                  <div className="text-gray-300 text-xs font-semibold">{TOOL_LABELS[key].label}</div>
                  <div className="text-gray-600 text-xs font-mono mt-0.5">{TOOL_LABELS[key].hint}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {namespaces.map((ns, i) => (
              <tr key={ns.name} className={i < namespaces.length - 1 ? "border-b border-gray-800" : ""}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-200 font-medium">{ns.name}</span>
                    {ns.name === "own" && (
                      <button
                        onClick={handleOpenOwnDir}
                        className="text-xs text-gray-600 hover:text-gray-400"
                        title="Open own/ in Finder"
                      >
                        open ↗
                      </button>
                    )}
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">
                    {ns.source} · {ns.skillCount} skills
                  </div>
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
        <button
          onClick={() => {
            setShowSkillModal(true);
            setSkillError("");
          }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg border border-gray-700"
        >
          + New Skill
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

      {/* New Skill modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">New Skill</h2>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Skill name</label>
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="my-skill"
                  className="flex-1 bg-transparent text-gray-200 text-sm font-mono placeholder-gray-600 focus:outline-none"
                />
                <span className="text-gray-600 text-sm font-mono">.md</span>
              </div>
            </div>
            {skillError && <p className="text-red-400 text-xs">{skillError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSkillModal(false)}
                className="text-gray-500 text-sm hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleNewSkill}
                disabled={skillLoading || !skillName}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {skillLoading ? "Creating…" : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
