import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/vndb.json", import.meta.url), "utf8"),
);
const port = Number(process.env.FIXTURE_PORT ?? 3101);
const metadataRequests = {};

function sendJson(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch (error) {
                reject(error);
            }
        });
        request.on("error", reject);
    });
}

const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/__fixture/status") {
        sendJson(response, 200, { metadataRequests });
        return;
    }

    if (request.method !== "POST" || request.url !== "/kana/vn") {
        sendJson(response, 404, { error: "fixture route not found" });
        return;
    }

    try {
        const body = await readRequestBody(request);
        const filters = body.filters;

        if (Array.isArray(filters) && filters[0] === "id") {
            const id = typeof filters[2] === "string" ? filters[2] : "";
            metadataRequests[id] = (metadataRequests[id] ?? 0) + 1;
            sendJson(response, 200, {
                results: fixture.vns[id] ? [fixture.vns[id]] : [],
                more: false,
            });
            return;
        }

        const query = Array.isArray(filters) && typeof filters[2] === "string" ? filters[2] : "";
        const page = String(body.page ?? 1);
        const searchPage = fixture.search[query]?.[page] ?? { ids: [], more: false };
        sendJson(response, 200, {
            results: searchPage.ids.map((id) => fixture.vns[id]),
            more: searchPage.more,
            count: searchPage.ids.length,
        });
    } catch (error) {
        sendJson(response, 400, { error: String(error) });
    }
});

server.listen(port, "127.0.0.1");

function shutdown() {
    server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
