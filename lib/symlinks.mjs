// lib/symlinks.mjs
import fs from "node:fs";

/**
 * Check a list of expected symlinks.
 * @param {Array<{link: string, target: string}>} expected
 * @returns {Array<{link, target, ok, exists, actualTarget?, isSymlink?}>}
 */
export function checkSymlinks(expected) {
  return expected.map(({ link, target }) => {
    // Use lstatSync (not existsSync) so broken symlinks are detected as existing.
    // existsSync follows the symlink and returns false if the target is missing.
    let stat;
    try {
      stat = fs.lstatSync(link);
    } catch {
      return { link, target, ok: false, exists: false };
    }

    if (!stat.isSymbolicLink()) {
      return { link, target, ok: false, exists: true, isSymlink: false };
    }

    const actualTarget = fs.readlinkSync(link);
    const ok = actualTarget === target;
    return { link, target, ok, exists: true, isSymlink: true, actualTarget };
  });
}
