import assert from "node:assert/strict";
import {
    getHiddenTags,
    getVisibleSynopsisText,
    getVisibleTags,
    isTagSpoilerVisible,
    normalizeTagSpoiler,
    parseSynopsis,
} from "../lib/spoiler-safety.ts";

// --- タグ分類: spoiler = 0 だけを既定表示し、1 / 2 / 不明は隠す ---
assert.equal(normalizeTagSpoiler(0), 0);
assert.equal(normalizeTagSpoiler(1), 1);
assert.equal(normalizeTagSpoiler(2), 2);
for (const value of [undefined, null, "0", "1", "", Number.NaN, Number.POSITIVE_INFINITY, -1, 3, 0.5, true, {}, []]) {
    assert.equal(normalizeTagSpoiler(value), null, `${String(value)} must be unknown`);
}

assert.equal(isTagSpoilerVisible({ spoiler: 0 }), true);
for (const tag of [{ spoiler: 1 }, { spoiler: 2 }, { spoiler: undefined }, { spoiler: null }, { spoiler: "0" }, { spoiler: -1 }, {}, null, undefined]) {
    assert.equal(isTagSpoilerVisible(tag), false, `${JSON.stringify(tag)} must stay hidden`);
}

const tagFixture = [
    { id: "g1", name: "safe", spoiler: 0 },
    { id: "g2", name: "minor", spoiler: 1 },
    { id: "g3", name: "major", spoiler: 2 },
    { id: "g4", name: "legacy" },
];
assert.deepEqual(getVisibleTags(tagFixture).map((tag) => tag.name), ["safe"]);
assert.deepEqual(getHiddenTags(tagFixture).map((tag) => tag.name), ["minor", "major", "legacy"]);
assert.deepEqual(getVisibleTags(undefined), []);
assert.deepEqual(getHiddenTags(null), []);

// --- あらすじ: 通常文・リンク ---
assert.deepEqual(parseSynopsis("普通のあらすじです。"), [{ kind: "text", text: "普通のあらすじです。" }]);
assert.deepEqual(parseSynopsis("詳細は[url=http://example.com]公式サイト[/url]を参照。"), [
    { kind: "text", text: "詳細は公式サイトを参照。" },
]);
assert.deepEqual(parseSynopsis("[b][/b]"), []);
assert.deepEqual(parseSynopsis(null), []);
assert.deepEqual(parseSynopsis(""), []);

// --- あらすじ: 単一区間と複数区間 ---
assert.deepEqual(parseSynopsis("犯人は[spoiler]田中[/spoiler]です。"), [
    { kind: "text", text: "犯人は" },
    { kind: "spoiler", text: "田中" },
    { kind: "text", text: "です。" },
]);
assert.deepEqual(parseSynopsis("A[spoiler]B[/spoiler]C[spoiler]D[/spoiler]E"), [
    { kind: "text", text: "A" },
    { kind: "spoiler", text: "B" },
    { kind: "text", text: "C" },
    { kind: "spoiler", text: "D" },
    { kind: "text", text: "E" },
]);

// --- あらすじ: 壊れた囲みは内容を漏らさない側へ倒す ---
assert.deepEqual(parseSynopsis("A[spoiler]B"), [
    { kind: "text", text: "A" },
    { kind: "spoiler", text: "B" },
]);
// `]` が欠けた開始タグは、タグ行そのものを隠し、続く本文も隠す
assert.deepEqual(parseSynopsis("A[spoiler 秘密の内容"), [{ kind: "text", text: "A" }]);
assert.deepEqual(parseSynopsis("A[spoiler 秘密]漏れてはいけない"), [
    { kind: "text", text: "A" },
    { kind: "spoiler", text: "漏れてはいけない" },
]);
assert.deepEqual(parseSynopsis("[spoiler=ネタバレ]内容[/spoiler]"), [{ kind: "spoiler", text: "内容" }]);
assert.deepEqual(parseSynopsis("[spoiler]秘密"), [{ kind: "spoiler", text: "秘密" }]);
// 対応する開始タグがない終了タグは、それ自体では内容を隠さない
assert.deepEqual(parseSynopsis("A[/spoiler]B"), [{ kind: "text", text: "AB" }]);
// 入れ子はすべて内側として畳む
assert.deepEqual(parseSynopsis("A[spoiler]B[spoiler]C[/spoiler]D[/spoiler]E"), [
    { kind: "text", text: "A" },
    { kind: "spoiler", text: "BCD" },
    { kind: "text", text: "E" },
]);
// 角括弧が二重になった壊れた開始タグでも、内側の開始タグを検出して隠す
assert.deepEqual(parseSynopsis("A[[spoiler]B[/spoiler]C"), [
    { kind: "text", text: "A[" },
    { kind: "spoiler", text: "B" },
    { kind: "text", text: "C" },
]);
// 大文字表記もネタバレとして扱う
assert.deepEqual(parseSynopsis("A[SPOILER]B[/SPOILER]C"), [
    { kind: "text", text: "A" },
    { kind: "spoiler", text: "B" },
    { kind: "text", text: "C" },
]);
// ネタバレ以外の未知タグは従来どおりタグだけを除去し、本文は残す
assert.deepEqual(parseSynopsis("A[spoilers]B"), [{ kind: "text", text: "AB" }]);

// --- カード・metadata・JSON-LD用テキストにネタバレ内容を含めない ---
assert.equal(getVisibleSynopsisText("A[spoiler]秘密[/spoiler]B"), "AB");
assert.equal(getVisibleSynopsisText("[spoiler]秘密[/spoiler]"), "");
assert.equal(getVisibleSynopsisText("前提[spoiler]田中[/spoiler]と[url=/v1]続編[/url]"), "前提と続編");
assert.equal(getVisibleSynopsisText(undefined), "");

console.log("Spoiler safety regression check passed (tags 0/1/2/unknown, synopsis spoiler segments).");
