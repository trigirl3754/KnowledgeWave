const { app } = require("@azure/functions");
const { startTelemetry } = require("./telemetry");
const { json, noContent } = require("./responses");
const { readSnippets, writeSnippets } = require("./storage");
const { suggestDefinition } = require("./ai");
const { analyzeText } = require("./textAnalytics");

startTelemetry();

function getKeywordParam(request) {
  return decodeURIComponent(request.params.keyword || "").trim();
}

app.http("snippetsOptions", {
  methods: ["OPTIONS"],
  authLevel: "anonymous",
  route: "{*route}",
  handler: async () => noContent(),
});

app.http("getSnippets", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "snippets",
  handler: async () => {
    try {
      const snippets = await readSnippets();
      return json(200, snippets);
    } catch (error) {
      return json(500, { error: error.message });
    }
  },
});

app.http("upsertSnippet", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "snippets/{keyword}",
  handler: async (request) => {
    const keyword = getKeywordParam(request);
    if (!keyword) {
      return json(400, { error: "Keyword is required." });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON payload." });
    }

    try {
      const snippets = await readSnippets();
      snippets[keyword] = payload;
      await writeSnippets(snippets);
      return json(200, { keyword, data: payload });
    } catch (error) {
      return json(500, { error: error.message });
    }
  },
});

app.http("deleteSnippet", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "snippets/{keyword}",
  handler: async (request) => {
    const keyword = getKeywordParam(request);
    if (!keyword) {
      return json(400, { error: "Keyword is required." });
    }

    try {
      const snippets = await readSnippets();
      delete snippets[keyword];
      await writeSnippets(snippets);
      return json(200, { deleted: keyword });
    } catch (error) {
      return json(500, { error: error.message });
    }
  },
});

app.http("generateDefinition", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "ai/definition",
  handler: async (request) => {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON payload." });
    }

    const keyword = (payload.keyword || "").trim();
    if (!keyword) {
      return json(400, { error: "keyword is required." });
    }

    try {
      const suggestion = await suggestDefinition(
        keyword,
        payload.context || "",
      );
      return json(200, suggestion);
    } catch (error) {
      return json(500, { error: error.message });
    }
  },
});

app.http("analyzeText", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "ai/text-analytics",
  handler: async (request) => {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON payload." });
    }

    const text = (payload.text || "").trim();
    if (!text) {
      return json(400, { error: "text is required." });
    }

    try {
      const result = await analyzeText(text);
      return json(200, result);
    } catch (error) {
      return json(500, { error: error.message });
    }
  },
});
