// lib/symlinks.mjs
import fs from "node:fs";

/**
 * Check a list of expected symlinks.
 * On Windows, also accepts directory junctions (created without admin rights).
 * @param {Array<{link: string, target: string}>} expected
 * @returns {Array<{link, target, ok, exists, actualTarget?, isSymlink?}>}
 */
export function checkSymlinks(expected) {
  return expected.map(({ link, target }) => {
    let stat;
    try {
      stat = fs.lstatSync(link);
    } catch {
      return { link, target, ok: false, exists: false };
    }

    if (stat.isSymbolicLink()) {
      const actualTarget = fs.readlinkSync(link);
      const ok = actualTarget === target;
      return { link, target, ok, exists: true, isSymlink: true, actualTarget };
    }

    // On Windows, directory junctions appear as directories (not symlinks).
    // readlinkSync still works on them.
    if (process.platform === "win32" && stat.isDirectory()) {
      try {
        const actualTarget = fs.readlinkSync(link);
        const ok = actualTarget === target;
        return { link, target, ok, exists: true, isSymlink: false, isJunction: true, actualTarget };
      } catch {
        // Regular directory, not a junction
      }
    }

    return { link, target, ok: false, exists: true, isSymlink: false };
  });
}
