import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const fixturePort = Number(process.env.PLAYWRIGHT_FIXTURE_PORT ?? 3101);

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? "line" : "list",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${port}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    webServer: [
        {
            command: "node e2e/fixture-server.mjs",
            env: { ...process.env, FIXTURE_PORT: String(fixturePort) } as Record<string, string>,
            url: `http://127.0.0.1:${fixturePort}/__fixture/status`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
            env: {
                ...process.env,
                VNDB_API_URL: `http://127.0.0.1:${fixturePort}/kana/vn`,
                NODE_OPTIONS: "--require=./e2e/guard-network.cjs",
            } as Record<string, string>,
            url: `http://127.0.0.1:${port}`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
    ],
});
