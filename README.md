# Skills Manager

Skills Manager is a local web app for managing which AI skill packages are active in each of your coding agents. It gives you a live matrix of all your skill namespaces versus all your tools, lets you toggle sync on and off, and handles the actual file operations — symlinks, JSON patches, rsync copies — so you don't have to.

## What it does

- **One view, all tools.** See every skill namespace and whether it's active in Claude Code / Codex, OpenCode, and OpenClaw — all at once.
- **Toggle with checkboxes.** Check or uncheck, then hit Apply Changes. Skills Manager handles the rest.
- **Add third-party skill packs.** Paste a GitHub URL and it runs `git submodule add` for you.
- **Author your own skills.** Create a new `.md` skill in your personal `own/` namespace and open it in your editor in one step.
- **Cross-platform path detection.** On first run it finds your tool directories automatically — on macOS, Linux, or Windows.
- **Override any path.** Click the pencil icon next to any tool column to point it somewhere custom. Hit Re-detect to let it find things again.

## Prerequisites

- **Node.js 18+** (tested on Node 22)
- **Git** (for submodule support)
- **rsync** (for OpenClaw sync — pre-installed on macOS/Linux; on Windows use Git Bash or WSL)

## Installation

```bash
git clone https://github.com/lxuan3/skills-manager
cd skills-manager
npm install
```

That's it. There's nothing to configure before first run — path detection happens automatically.

## Starting the app

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

To keep it running in the background:

```bash
npm run dev &
```

Or add it to your shell profile so it starts on login.

## First run: path auto-detection

On first load, Skills Manager reads each tool's own config file to find where it stores skills, then falls back to standard candidate paths. Results are saved to a config file so detection only runs once.

### What it looks for

**Claude Code + Codex**

| Platform | Config file checked | Candidate fallback |
|----------|---------------------|--------------------|
| macOS / Linux | `~/.claude/settings.json` → `skillsDirectory` | `~/.agents/skills` |
| Windows | `%APPDATA%\Claude\settings.json` → `skillsDirectory` | `%USERPROFILE%\.agents\skills` |

**OpenCode**

| Platform | Candidate path |
|----------|----------------|
| macOS / Linux | `~/.config/opencode/opencode.json` |
| Windows | `%APPDATA%\opencode\opencode.json` |

**OpenClaw**

| Platform | Config file checked | Candidate fallback |
|----------|---------------------|--------------------|
| macOS / Linux | `~/.openclaw/config.json` → `skillsDir` | `~/.openclaw/skills` |
| Windows | `%USERPROFILE%\.openclaw\config.json` → `skillsDir` | `%USERPROFILE%\.openclaw\skills` |

### Config file location

Detected paths are persisted here:

| Platform | Path |
|----------|------|
| macOS / Linux | `~/.config/skills-manager/config.json` |
| Windows | `%APPDATA%\skills-manager\config.json` |

### Status indicators

Each tool column shows a coloured dot next to the detected path:

| Dot | Meaning |
|-----|---------|
| Green | Path found and exists |
| Orange | Path set manually by you |
| Red | Path is set but doesn't exist on disk |
| Grey | Nothing detected — path unknown |

A red or grey dot doesn't block you from using Apply Changes. Errors will surface at that point.

## How sync works per tool

### Claude Code + Codex

Creates a symlink in the skills directory pointing to the namespace's `skills/` folder inside the submodule:

```
~/.agents/skills/superpowers -> ~/Github/openclaw-config/third-party/superpowers/skills
```

Enabling: `fs.symlinkSync(skillsPath, linkPath)`
Disabling: `fs.unlinkSync(linkPath)`

### OpenCode

Adds or removes a plugin entry in `opencode.json`:

```json
{ "plugins": [{ "type": "local", "path": "/path/to/skills" }] }
```

The file is created if it doesn't exist.

### OpenClaw

Copies the skills directory using rsync:

```
rsync -a third-party/superpowers/skills/ ~/.openclaw/skills/superpowers/
```

Enabling: rsync copy
Disabling: removes the target directory

## Using the Skills page

### Toggling sync

1. Open [http://localhost:3001/skills](http://localhost:3001/skills)
2. Check or uncheck cells in the matrix
3. Changed cells show an amber dot — nothing is written yet
4. Click **Apply Changes** to execute all pending changes at once
5. Click **Undo** to clear pending changes without applying

### Adding a third-party skill pack

Click **+ Add Package** and paste a GitHub URL (or a local path):

```
https://github.com/obra/superpowers
```

Skills Manager runs `git submodule add` and initialises the submodule. The new namespace appears in the matrix immediately.

For local repos, paste the absolute path:

```
/Users/you/Github/my-skills-repo
```

### Creating your own skill

Click **+ New Skill**, type a name (without `.md`), and click **Create & Open**. Skills Manager creates `own/{name}.md` with a starter template and opens it in your default editor.

Your `own/` namespace always appears at the bottom of the matrix and is never a submodule — it's just a folder in your skills repo.

### Editing a tool path manually

Click the **✎** pencil icon next to any tool column header. Type the new path and click **Save**. The dot turns orange to indicate a manual override.

To go back to auto-detection, click **Re-detect** in the table footer. Manual paths are preserved; only auto-detected paths are refreshed.

## Keeping skill packs up to date

Skills Manager doesn't auto-update submodules, but it's one git command:

```bash
cd ~/Github/openclaw-config   # or wherever your skills repo is
git submodule update --remote --merge
```

Or update a single pack:

```bash
git submodule update --remote third-party/superpowers
```

## Windows notes

rsync is not included in standard Windows. Options:

- **Git Bash** — ships with rsync; works if you run `npm run dev` from Git Bash
- **WSL** — run the whole app inside WSL2; best compatibility
- **Cygwin / MSYS2** — install rsync from the package manager

If rsync is not available, OpenClaw sync will fail with an error at Apply Changes time. Claude Code and OpenCode sync do not require rsync.

Path separators: Skills Manager uses Node's `path` module throughout, so Windows paths (`C:\Users\...`) work correctly in the config file and the edit UI.

## Repository structure

```
skills-manager/
  app/
    api/
      config/         GET+POST /api/config, POST /api/config/detect
      distribution/   GET+POST /api/distribution
      submodule/      POST /api/submodule/add
      own/            POST /api/own/new, /api/own/open
    skills/           /skills page (React client component)
    layout.tsx        Nav bar
  lib/
    tool-paths.mjs    Path detection + config persistence
    distribution.mjs  Sync state read/write (symlinks, JSON, rsync)
    skills-repo.mjs   Git submodule listing
    own-skills.mjs    own/ namespace helpers
```

## Running tests

```bash
npm test
```

Uses Node's built-in `node:test` runner. Tests use real temp directories — no mocks.

## License

MIT
