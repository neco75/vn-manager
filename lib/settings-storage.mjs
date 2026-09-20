export function scheduleSettingsRestore(
    storage,
    setBackgroundImage,
    setNsfwBlur,
    schedule = setTimeout,
    cancel = clearTimeout,
    setBackgroundImageSexual = (_value) => {},
) {
    const storedBackground = storage.getItem("vn-manager-bg");
    const storedBackgroundSexual = storage.getItem("vn-manager-bg-sexual");
    const storedBlur = storage.getItem("vn-manager-nsfw-blur");
    const parsedSexual = storedBackgroundSexual === null ? null : Number(storedBackgroundSexual);
    const backgroundSexual =
        Number.isFinite(parsedSexual) && parsedSexual >= 0 && parsedSexual <= 2
            ? parsedSexual
            : null;

    const timeoutId = schedule(() => {
        setBackgroundImage(storedBackground);
        setBackgroundImageSexual(backgroundSexual);
        setNsfwBlur(storedBlur === null ? true : storedBlur === "true");
    }, 0);

    return () => cancel(timeoutId);
}
