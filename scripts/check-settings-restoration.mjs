import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(`${root}/context/SettingsContext.tsx`, "utf8");

const checks = [
    ["background storage key", source.includes('localStorage.getItem("vn-manager-bg")')],
    ["blur storage key", source.includes('localStorage.getItem("vn-manager-nsfw-blur")')],
    ["blur default is enabled", source.includes('useState<boolean>(true)')],
    ["restoration is deferred", source.includes("window.setTimeout(() =>")],
    ["restoration timer is cancelled", source.includes("window.clearTimeout(timeoutId)")],
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length > 0) {
    console.error(`Settings restoration regression check failed: ${failures.join(", ")}`);
    process.exit(1);
}

console.log(`Settings restoration regression check passed (${checks.length} checks).`);
