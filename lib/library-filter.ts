import type { LibraryItem } from "@/types/library";
import { getTitleSearchTerms } from "@/lib/vndb-title";

export function normalizeLibrarySearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function getLibrarySearchTerms(query: string): string[] {
  return normalizeLibrarySearchText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function matchesLibrarySearch(item: LibraryItem, query: string): boolean {
  const terms = getLibrarySearchTerms(query);
  if (terms.length === 0) return true;

  const searchableText = [
    ...getTitleSearchTerms(item.vn),
    ...(item.vn.developers ?? []).flatMap((developer) => [
      developer.name,
      developer.original,
    ]),
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeLibrarySearchText)
    .join(" ");

  return terms.every((term) => searchableText.includes(term));
}
