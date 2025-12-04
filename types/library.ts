import { VN } from "./vndb";

export type GameStatus = "playing" | "completed" | "on_hold" | "dropped" | "plan_to_play" | "watched";

export interface LibraryItem {
    vn: VN;
    status: GameStatus;
    score: number; // 0-10
    notes: string; // Memo
    review?: string; // Thoughts/Review
    playTime?: number; // In minutes
    purchaseLocation?: string; // Where the game was purchased
    addedAt: number;
    updatedAt: number;
}
