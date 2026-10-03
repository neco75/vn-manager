import { globSync as nativeGlobSync, statSync } from "node:fs";

// ponytail: Next's rootDir lookup only; remove this override when upstream drops braces.
export function globSync(pattern, options = {}) {
  if (typeof pattern !== "string" || options.onlyDirectories !== true ||
      Object.keys(options).some((key) => key !== "onlyDirectories") || pattern.startsWith("!")) {
    throw new TypeError("next-root-glob supports only directory rootDir globs");
  }
  return nativeGlobSync(pattern)
    .filter((entry) => statSync(entry).isDirectory())
    .map((entry) => entry.replaceAll("\\", "/"));
}
