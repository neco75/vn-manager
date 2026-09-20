const originalFetch = globalThis.fetch;

globalThis.fetch = function guardedFetch(input, init) {
    const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    if (new URL(url).hostname === "api.vndb.org") {
        throw new Error(`Unexpected real VNDB request in E2E: ${url}`);
    }
    return originalFetch.call(this, input, init);
};
