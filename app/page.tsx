"use client";

import { useEffect, useState } from "react";

type Submodule = {
  name: string;
  shortName: string;
  url: string;
  skillCount: number;
  sha: string;
  initialized: boolean;
  commitDate: string;
};

type SymlinkStatus = {
  name: string;
  link: string;
  target: string;
  ok: boolean;
  exists: boolean;
  isSymlink?: boolean;
  actualTarget?: string;
};

type UpdateResult = {
  name: string;
  shortName: string;
  hasUpdates: boolean;
  localSha: string;
  remoteSha: string;
  newCommits: { sha: string; message: string; date: string }[];
  error?: string;
};

export default function HomePage() {
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [ownSkills, setOwnSkills] = useState<string[]>([]);
  const [repoPath, setRepoPath] = useState("");
  const [symlinks, setSymlinks] = useState<SymlinkStatus[]>([]);
  const [updateResults, setUpdateResults] = useState<UpdateResult[] | null>(null);
  const [selectedUpgrades, setSelectedUpgrades] = useState<string[]>([]);
  const [syncOutput, setSyncOutput] = useState("");

  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingSymlinks, setLoadingSymlinks] = useState(true);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => { setSubmodules(d.submodules ?? []); setOwnSkills(d.ownSkills ?? []); setRepoPath(d.repoPath ?? ""); })
      .finally(() => setLoadingSkills(false));

    fetch("/api/symlinks")
      .then((r) => r.json())
      .then((d) => setSymlinks(d.symlinks ?? []))
      .finally(() => setLoadingSymlinks(false));
  }, []);

  async function handleCheckUpdates() {
    setLoadingUpdates(true);
    setUpdateResults(null);
    setSelectedUpgrades([]);
    const res = await fetch("/api/updates", { method: "POST" });
    const data = await res.json();
    setUpdateResults(data.results ?? []);
    setLoadingUpdates(false);
  }

  async function handleUpgrade() {
    if (selectedUpgrades.length === 0) return;
    setLoadingUpgrade(true);
    await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submodules: selectedUpgrades }),
    });
    setLoadingUpgrade(false);
    setUpdateResults(null);
    setSelectedUpgrades([]);
    // Refresh skills list
    const res = await fetch("/api/skills");
    const data = await res.json();
    setSubmodules(data.submodules ?? []);
  }

  async function handleSync() {
    setLoadingSync(true);
    setSyncOutput("");
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    setSyncOutput(data.output ?? data.error ?? "done");
    setLoadingSync(false);
  }

  function toggleUpgrade(name: string) {
    setSelectedUpgrades((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  return (
    <div className="space-y-10">

      {/* Skills list */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Third-party Skills</h2>
        {loadingSkills ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-3">
            {submodules.map((s) => (
              <div key={s.name} className="bg-gray-900 rounded-lg p-4 flex items-start justify-between">
                <div>
                  <div className="font-medium text-white">{s.shortName}</div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono">{s.url}</div>
                  <div className="text-xs text-gray-400 mt-1 font-mono">{s.sha.slice(0, 7)}</div>
                  {s.commitDate && (
                    <div className="text-xs text-gray-500 mt-0.5">{s.commitDate.slice(0, 10)}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-300">{s.skillCount}</div>
                  <div className="text-xs text-gray-500">skills</div>
                  {!s.initialized && (
                    <div className="text-xs text-red-400 mt-1">not initialized</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {ownSkills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">own/</h3>
            <div className="flex flex-wrap gap-2">
              {ownSkills.map((s) => (
                <span key={s} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded font-mono">{s}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Symlink status */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Symlink Status</h2>
        {loadingSymlinks ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-2">
            {symlinks.map((s) => (
              <div key={s.name} className="flex items-center gap-3 bg-gray-900 rounded px-4 py-2">
                <span className={s.ok ? "text-green-400" : "text-red-400"}>{s.ok ? "✓" : "✗"}</span>
                <span className="font-mono text-sm text-gray-300 w-28">{s.name}</span>
                <span className="font-mono text-xs text-gray-500 truncate">{s.link}</span>
                {!s.ok && s.actualTarget && (
                  <span className="text-xs text-red-400 ml-auto">→ {s.actualTarget}</span>
                )}
                {!s.ok && !s.exists && (
                  <span className="text-xs text-red-400 ml-auto">missing</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Updates */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">Updates</h2>
          <button
            onClick={handleCheckUpdates}
            disabled={loadingUpdates}
            className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            {loadingUpdates ? "Checking…" : "Check for Updates"}
          </button>
          {updateResults && selectedUpgrades.length > 0 && (
            <button
              onClick={handleUpgrade}
              disabled={loadingUpgrade}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
            >
              {loadingUpgrade ? "Upgrading…" : `Upgrade (${selectedUpgrades.length})`}
            </button>
          )}
        </div>

        {updateResults && (
          <div className="space-y-3">
            {updateResults.map((r) => (
              <div key={r.name} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {r.hasUpdates && (
                      <input
                        type="checkbox"
                        checked={selectedUpgrades.includes(r.name)}
                        onChange={() => toggleUpgrade(r.name)}
                        className="accent-green-500"
                      />
                    )}
                    <span className="font-medium">{r.shortName}</span>
                    {r.hasUpdates ? (
                      <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded">{r.newCommits.length} new commit{r.newCommits.length !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-xs text-gray-500">up to date</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-gray-500">{r.localSha.slice(0, 7)}</span>
                </div>
                {r.hasUpdates && r.newCommits.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-6">
                    {r.newCommits.map((c) => (
                      <li key={c.sha} className="text-xs text-gray-400">
                        <span className="font-mono text-gray-600">{c.sha.slice(0, 7)}</span>{" "}
                        {c.message}
                      </li>
                    ))}
                  </ul>
                )}
                {r.error && <p className="text-xs text-red-400 mt-1">{r.error}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sync to OpenClaw */}
      <section>
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-lg font-semibold">Sync to OpenClaw</h2>
          <button
            onClick={handleSync}
            disabled={loadingSync}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            {loadingSync ? "Syncing…" : "Sync own/ → openclaw"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Copies <span className="font-mono">own/</span> skills to <span className="font-mono">~/.openclaw/skills</span> via sync.sh</p>
        {syncOutput && (
          <pre className="bg-gray-900 rounded p-4 text-xs font-mono text-gray-300 whitespace-pre-wrap">{syncOutput}</pre>
        )}
      </section>

    </div>
  );
}
