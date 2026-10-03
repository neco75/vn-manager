import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { globSync } = pluginRequire("fast-glob");
const tempRoot = realpathSync(tmpdir());
const fixture = mkdtempSync(path.join(tempRoot, "vn-manager-lint-root-"));
const normalized = (value) => value.replaceAll("\\", "/");

try {
  for (const name of ["one", "two"]) {
    mkdirSync(path.join(fixture, "apps", name, "pages"), { recursive: true });
    writeFileSync(path.join(fixture, "apps", name, "pages", "index.tsx"), "export default function Page() { return null; }");
  }
  writeFileSync(path.join(fixture, "apps", "not-a-directory"), "fixture");
  const expected = ["one", "two"].map((name) => normalized(path.join(fixture, "apps", name))).sort();
  const rootGlob = `${normalized(fixture)}/apps/*`;
  assert.deepEqual(globSync(rootGlob, { onlyDirectories: true }).sort(), expected);
  assert.deepEqual(globSync(`${normalized(fixture)}/apps/{one,two}`, { onlyDirectories: true }).sort(), expected);
  assert.deepEqual(globSync(`${normalized(fixture)}/missing/*`, { onlyDirectories: true }), []);

  const staticRoot = expected[0];
  assert.deepEqual(globSync(staticRoot, { onlyDirectories: true }), [staticRoot]);
  const relativeRoot = normalized(path.relative(process.cwd(), staticRoot));
  assert.deepEqual(globSync(relativeRoot, { onlyDirectories: true }), [relativeRoot]);
  assert.throws(() => globSync(rootGlob, { onlyFiles: true }), /only directory/);

  for (const rootDir of [staticRoot, relativeRoot, rootGlob, [rootGlob]]) {
    const eslint = new ESLint({ overrideConfig: [{ settings: { next: { rootDir } } }] });
    const [result] = await eslint.lintText('export default function Example() { return <a href="/">home</a>; }', {
      filePath: path.resolve("app/lint-root-fixture.tsx"),
    });
    assert(result.messages.some((message) => message.ruleId === "@next/next/no-html-link-for-pages"),
      "Next's internal-link lint rule must still detect the fixture route");
  }
  console.log("Next rootDir lint regression check passed (static/relative/glob/array roots, directories, brace glob, missing path).");
} finally {
  assert.equal(path.dirname(realpathSync(fixture)), tempRoot);
  assert(path.basename(fixture).startsWith("vn-manager-lint-root-"));
  rmSync(fixture, { recursive: true });
}
