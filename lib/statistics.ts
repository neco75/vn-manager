import {
    GAME_STATUSES,
    isValidLibraryDate,
    type GameStatus,
    type LibraryItem,
} from "@/types/library";
import { calculateAverageScore } from "@/lib/library-score";
import { getVisibleTags } from "@/lib/spoiler-safety";

export interface MonthlyCompletedCount {
    month: string;
    count: number;
}

export interface TagFrequency {
    name: string;
    count: number;
}

export interface LibraryStatistics {
    total: number;
    completed: number;
    ratedCount: number;
    averageScore: number | null;
    actualPlaytimeMinutes: number;
    estimatedUnstartedMinutes: number;
    estimatedUnstartedCount: number;
    statusCounts: Record<GameStatus, number>;
    monthlyCompleted: MonthlyCompletedCount[];
    completedWithoutDate: number;
    tagFrequencies: TagFrequency[];
}

function nonNegativeFiniteNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function completedMonth(value: unknown): string | null {
    if (typeof value !== "string" || !isValidLibraryDate(value)) return null;
    // Keep the stored calendar date as a string. Converting it to a Date can
    // move a date-only value into the previous month in a negative timezone.
    return value.slice(0, 7);
}

export function calculateLibraryStatistics(items: readonly LibraryItem[]): LibraryStatistics {
    const statusCounts = GAME_STATUSES.reduce((counts, status) => {
        counts[status] = 0;
        return counts;
    }, {} as Record<GameStatus, number>);
    const monthlyCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let actualPlaytimeMinutes = 0;
    let estimatedUnstartedMinutes = 0;
    let estimatedUnstartedCount = 0;
    let completedWithoutDate = 0;

    for (const item of items) {
        statusCounts[item.status] += 1;

        if (item.status !== "watched") {
            actualPlaytimeMinutes += nonNegativeFiniteNumber(item.playTime);
        }

        const estimatedMinutes = nonNegativeFiniteNumber(item.vn.length_minutes);
        if (
            item.ownership === "owned" &&
            item.status === "plan_to_play" &&
            item.startedOn === undefined &&
            nonNegativeFiniteNumber(item.playTime) === 0 &&
            estimatedMinutes > 0
        ) {
            estimatedUnstartedMinutes += estimatedMinutes;
            estimatedUnstartedCount += 1;
        }

        if (item.status === "completed") {
            const month = completedMonth(item.completedOn);
            if (month === null) {
                completedWithoutDate += 1;
            } else {
                monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
            }
        }

        for (const tag of getVisibleTags(item.vn.tags)) {
            if (typeof tag.name !== "string" || tag.name.length === 0) continue;
            tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1);
        }
    }

    const tagFrequencies = [...tagCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
        .slice(0, 6);

    return {
        total: items.length,
        completed: statusCounts.completed,
        ratedCount: items.filter((item) => item.score !== null).length,
        averageScore: calculateAverageScore([...items]),
        actualPlaytimeMinutes,
        estimatedUnstartedMinutes,
        estimatedUnstartedCount,
        statusCounts,
        monthlyCompleted: [...monthlyCounts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([month, count]) => ({ month, count })),
        completedWithoutDate,
        tagFrequencies,
    };
}
