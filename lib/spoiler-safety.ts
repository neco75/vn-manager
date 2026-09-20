/**
 * VNDBのネタバレ区分を安全側で扱うためのヘルパー。
 *
 * - タグ: VNDBの `tags.spoiler` は 0 = ネタバレなし、1 = 軽度、2 = 重度。
 *   旧版で保存したデータやAPIが返さない場合は「不明」とし、安全と推測しない。
 * - あらすじ: VNDBの `[spoiler]...[/spoiler]` 区間を閉じた状態で扱う。
 *   全BBCodeの再実装は行わず、壊れた囲みは内容が漏れない側へ倒す。
 */

export const TAG_SPOILER_LEVELS = [0, 1, 2] as const;

export type TagSpoilerLevel = (typeof TAG_SPOILER_LEVELS)[number];

export interface SpoilerTagLike {
    spoiler?: unknown;
}

export type SynopsisSegment = {
    kind: "text" | "spoiler";
    text: string;
};

// 従来と同じく、あらすじに残る角括弧タグは表示から除去する。
const BRACKET_TAG = /\[[^[\]]*\]/g;
// ネタバレ開始/終了タグ、または通常のBBCodeタグのどちらかに一致する。
// 開始タグは `]` が欠けた壊れた書式 `[spoiler` も拾い、内容を漏らさない。
const SPOILER_OR_TAG = /\[\s*\/?\s*spoiler\b[^\]]*\]?|\[[^[\]]*\]/gi;
const SPOILER_TAG = /^\[\s*\/?\s*spoiler\b/i;
const SPOILER_CLOSING_TAG = /^\[\s*\/\s*spoiler\b/i;

/**
 * `tags.spoiler` を 0 / 1 / 2 のいずれかへ正規化する。
 * 欠損・数値以外・範囲外は「不明」として null を返す。
 */
export function normalizeTagSpoiler(value: unknown): TagSpoilerLevel | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return TAG_SPOILER_LEVELS.includes(value as TagSpoilerLevel) ? (value as TagSpoilerLevel) : null;
}

/**
 * そのタグを既定表示してよいか。spoiler = 0 のタグだけが true。
 * 1 / 2 / 不明（undefined・null・文字列・範囲外）はすべて false。
 */
export function isTagSpoilerVisible(tag: SpoilerTagLike | null | undefined): boolean {
    return normalizeTagSpoiler(tag?.spoiler) === 0;
}

/** 既定表示してよいタグ（spoiler = 0）だけを返す。 */
export function getVisibleTags<T extends SpoilerTagLike>(tags: readonly T[] | null | undefined): T[] {
    if (!Array.isArray(tags)) return [];
    return tags.filter((tag) => isTagSpoilerVisible(tag));
}

/** ネタバレ区分が 1 / 2 / 不明で既定非表示になるタグを返す。 */
export function getHiddenTags<T extends SpoilerTagLike>(tags: readonly T[] | null | undefined): T[] {
    if (!Array.isArray(tags)) return [];
    return tags.filter((tag) => !isTagSpoilerVisible(tag));
}

/**
 * あらすじを表示用セグメントへ分割する。
 *
 * - `[spoiler]...[/spoiler]` の内側は kind: "spoiler" として返す。
 * - 対応する終了タグがない開始タグは、末尾までを "spoiler" にする（内容を漏らさない）。
 * - `]` が欠けた `[spoiler ...` は、その開始タグ行を丸ごとネタバレ扱いにし、続く本文も隠す。
 * - 対応する開始タグがない終了タグは無視する（それ自体は内容を隠さない）。
 * - 入れ子の開始タグはカウントし、内側も "spoiler" のまま扱う。
 * - ネタバレ以外の角括弧タグは従来どおり表示から除去する。
 */
export function parseSynopsis(description: unknown): SynopsisSegment[] {
    if (typeof description !== "string" || description.length === 0) return [];

    const segments: SynopsisSegment[] = [];
    const pattern = new RegExp(SPOILER_OR_TAG.source, "gi");
    let depth = 0;
    let cursor = 0;

    const append = (kind: SynopsisSegment["kind"], raw: string) => {
        const text = raw.replace(BRACKET_TAG, "");
        if (text.length === 0) return;

        const previous = segments[segments.length - 1];
        if (previous && previous.kind === kind) {
            previous.text += text;
            return;
        }
        segments.push({ kind, text });
    };

    let match = pattern.exec(description);
    while (match !== null) {
        append(depth > 0 ? "spoiler" : "text", description.slice(cursor, match.index));
        cursor = match.index + match[0].length;

        if (SPOILER_TAG.test(match[0])) {
            if (SPOILER_CLOSING_TAG.test(match[0])) {
                if (depth > 0) depth -= 1;
            } else {
                depth += 1;
            }
        }

        match = pattern.exec(description);
    }

    append(depth > 0 ? "spoiler" : "text", description.slice(cursor));

    return segments;
}

/** ネタバレ区間を丸ごと除いたテキスト。カード・metadata・JSON-LD用。 */
export function getVisibleSynopsisText(description: unknown): string {
    return parseSynopsis(description)
        .filter((segment) => segment.kind === "text")
        .map((segment) => segment.text)
        .join("");
}
