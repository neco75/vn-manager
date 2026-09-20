export const IMAGE_SEXUAL_BLUR_THRESHOLD = 1;

export function isValidImageSexualValue(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 2
    );
}

export function shouldBlurImage(sexual: unknown, blurEnabled: boolean): boolean {
    if (!blurEnabled) return false;
    if (!isValidImageSexualValue(sexual)) return true;
    return sexual >= IMAGE_SEXUAL_BLUR_THRESHOLD;
}
