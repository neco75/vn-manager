export function scheduleSettingsRestore(
    storage,
    setBackgroundImage,
    setNsfwBlur,
    schedule = setTimeout,
    cancel = clearTimeout,
) {
    const storedBackground = storage.getItem("vn-manager-bg");
    const storedBlur = storage.getItem("vn-manager-nsfw-blur");
    const timeoutId = schedule(() => {
        setBackgroundImage(storedBackground);
        setNsfwBlur(storedBlur === null ? true : storedBlur === "true");
    }, 0);

    return () => cancel(timeoutId);
}
