"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RepoPathHeader({ initialPath }: { initialPath: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialPath);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/repo-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: value }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      setError(data.error);
    } else {
      setEditing(false);
      router.refresh();
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-gray-400 text-sm">Central skills repo ·</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setValue(initialPath); }
          }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-200 text-sm font-mono w-80 focus:outline-none focus:border-indigo-500"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-indigo-400 text-sm hover:text-indigo-300 disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(initialPath); setError(""); }}
          className="text-gray-600 text-sm hover:text-gray-400"
        >
          Cancel
        </button>
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-gray-400 text-sm">
        Central skills repo · <span className="font-mono">{initialPath || "not configured"}</span>
      </span>
      <button
        onClick={() => { setValue(initialPath); setError(""); setEditing(true); }}
        className="text-gray-600 hover:text-gray-400 text-xs"
        title="Change skills repo path"
      >
        ✎
      </button>
    </div>
  );
}
