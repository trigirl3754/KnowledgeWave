const { OpenAI } = require("openai");
const { getConfigValue } = require("./config");

const openAiClients = new Map();

class PromptShieldBlockedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PromptShieldBlockedError";
    this.code = "prompt_shield_blocked";
    this.status = 422;
    this.details = details;
  }
}

function normalizeProvider(rawValue) {
  const value = (rawValue || "auto").toString().trim().toLowerCase();
  if (["dictionary", "mcp", "openai", "local", "auto"].includes(value)) {
    return value;
  }
  return "auto";
}

function normalizePromptShieldMode(rawValue) {
  const value = (rawValue || "off").toString().trim().toLowerCase();
  if (["off", "annotate", "block"].includes(value)) {
    return value;
  }
  return "off";
}

function isPromptShieldEnabled(mode) {
  return mode === "annotate" || mode === "block";
}

function cleanSentence(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function logEvent(level, event, data = {}) {
  const payload = {
    event,
    ...data,
  };

  if (level === "error") {
    console.error("[ai]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[ai]", payload);
    return;
  }

  console.info("[ai]", payload);
}

function buildPromptShieldConfig(mode) {
  if (!isPromptShieldEnabled(mode)) {
    return undefined;
  }

  return {
    user_prompt: {
      enabled: true,
      action: mode,
    },
  };
}

function extractPromptShieldResult(completion) {
  const promptResults = Array.isArray(completion?.prompt_filter_results)
    ? completion.prompt_filter_results
    : [];

  for (const result of promptResults) {
    const jailbreak = result?.content_filter_results?.jailbreak;
    if (!jailbreak || typeof jailbreak !== "object") {
      continue;
    }

    if (
      typeof jailbreak.detected === "boolean" ||
      typeof jailbreak.filtered === "boolean"
    ) {
      return {
        detected: Boolean(jailbreak.detected),
        filtered: Boolean(jailbreak.filtered),
      };
    }
  }

  return null;
}

function buildDictionaryCandidates(keyword) {
  const cleaned = cleanSentence(keyword);
  if (!cleaned) {
    return [];
  }

  const noParen = cleanSentence(cleaned.replace(/\([^)]*\)/g, " "));
  const normalized = cleanSentence(
    noParen
      .replace(/[-_/]/g, " ")
      .replace(/[^A-Za-z0-9\s]/g, " "),
  );

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  const prioritizedTokens = [];
  if (tokens.length) {
    // Try the semantic head and tail first (e.g., Retrieval Generation).
    prioritizedTokens.push(tokens[tokens.length - 1], tokens[0]);
    tokens.forEach((token) => prioritizedTokens.push(token));
  }

  const rawCandidates = [cleaned, noParen, normalized, ...prioritizedTokens];
  const seen = new Set();

  return rawCandidates
    .map((value) => cleanSentence(value))
    .filter((value) => {
      if (!value) {
        return false;
      }

      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

async function fetchDictionaryCandidate(baseUrl, candidate, diagnostics = {}) {
  const encoded = encodeURIComponent(candidate);

  logEvent("info", "dictionary.request.attempt", {
    ...diagnostics,
    candidate,
  });

  let response;
  try {
    response = await fetch(`${baseUrl}/${encoded}`);
  } catch (error) {
    logEvent("warn", "dictionary.request.network_error", {
      ...diagnostics,
      candidate,
      reason: error?.message || "unknown",
    });
    return {
      result: null,
      reason: "network-error",
    };
  }

  if (!response.ok) {
    logEvent("warn", "dictionary.request.http_error", {
      ...diagnostics,
      candidate,
      status: response.status,
    });
    return {
      result: null,
      reason: `http-${response.status}`,
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    logEvent("warn", "dictionary.response.parse_error", {
      ...diagnostics,
      candidate,
    });
    return {
      result: null,
      reason: "invalid-json",
    };
  }

  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry || !Array.isArray(entry.meanings)) {
    return {
      result: null,
      reason: "no-meanings",
    };
  }

  for (const meaning of entry.meanings) {
    if (!Array.isArray(meaning.definitions) || !meaning.definitions.length) {
      continue;
    }

    const first = meaning.definitions[0];
    const definitionText = cleanSentence(first?.definition);
    if (!definitionText) {
      continue;
    }

    const partOfSpeech = cleanSentence(meaning.partOfSpeech);
    const dictionaryExample = cleanSentence(first?.example);

    return {
      result: {
        definition: partOfSpeech
          ? `${definitionText} (${partOfSpeech})`
          : definitionText,
        example:
          dictionaryExample ||
          `Example: The term \"${candidate}\" is used with this meaning in context-aware notes.`,
        source: "dictionary",
        provider: "dictionaryapi.dev",
      },
      reason: "success",
    };
  }

  return {
    result: null,
    reason: "no-definitions",
  };
}

async function fetchFallbackDictionaryCandidate(baseUrl, candidate, diagnostics = {}) {
  const encoded = encodeURIComponent(candidate);

  logEvent("info", "dictionary.fallback.request.attempt", {
    ...diagnostics,
    candidate,
  });

  let response;
  try {
    response = await fetch(`${baseUrl}?sp=${encoded}&md=d&max=1`);
  } catch (error) {
    logEvent("warn", "dictionary.fallback.request.network_error", {
      ...diagnostics,
      candidate,
      reason: error?.message || "unknown",
    });
    return {
      result: null,
      reason: "network-error",
    };
  }

  if (!response.ok) {
    logEvent("warn", "dictionary.fallback.request.http_error", {
      ...diagnostics,
      candidate,
      status: response.status,
    });
    return {
      result: null,
      reason: `http-${response.status}`,
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    logEvent("warn", "dictionary.fallback.response.parse_error", {
      ...diagnostics,
      candidate,
    });
    return {
      result: null,
      reason: "invalid-json",
    };
  }

  const first = Array.isArray(payload) ? payload[0] : null;
  const defs = Array.isArray(first?.defs) ? first.defs : [];
  const rawDefinition = defs[0] || "";
  const definitionText = cleanSentence(rawDefinition.replace(/^[^\t]*\t/, ""));

  if (!definitionText) {
    return {
      result: null,
      reason: "no-definitions",
    };
  }

  return {
    result: {
      definition: definitionText,
      example: `Example: The term \"${candidate}\" is used with this meaning in context-aware notes.`,
      source: "dictionary-fallback",
      provider: "datamuse",
    },
    reason: "success",
  };
}

async function fetchDictionaryEntry(keyword, diagnostics = {}) {
  const candidates = buildDictionaryCandidates(keyword);
  if (!candidates.length) {
    return {
      result: null,
      reason: "empty-keyword",
    };
  }

  const configuredBase = await getConfigValue("FREE_DICTIONARY_API_BASE_URL");
  const baseUrl = (configuredBase || "https://api.dictionaryapi.dev/api/v2/entries/en")
    .replace(/\/$/, "");

  const configuredFallbackBase = await getConfigValue("FREE_DICTIONARY_FALLBACK_BASE_URL");
  const fallbackBaseUrl = (configuredFallbackBase || "https://api.datamuse.com/words")
    .replace(/\/$/, "");

  logEvent("info", "dictionary.request.start", {
    ...diagnostics,
    keyword: cleanSentence(keyword),
    baseUrl,
    fallbackBaseUrl,
    candidates,
  });

  let lastFailure = "unknown";
  for (const candidate of candidates) {
    const lookup = await fetchDictionaryCandidate(baseUrl, candidate, diagnostics);
    if (lookup.result) {
      return lookup;
    }
    lastFailure = lookup.reason;
  }

  logEvent("warn", "dictionary.request.primary_unavailable", {
    ...diagnostics,
    keyword: cleanSentence(keyword),
    reason: lastFailure,
  });

  let fallbackFailure = "unknown";
  for (const candidate of candidates) {
    const lookup = await fetchFallbackDictionaryCandidate(
      fallbackBaseUrl,
      candidate,
      diagnostics,
    );
    if (lookup.result) {
      return lookup;
    }
    fallbackFailure = lookup.reason;
  }

  return {
    result: null,
    reason: `exhausted-candidates:primary=${lastFailure};fallback=${fallbackFailure}`,
  };
}

function extractMcpSuggestion(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directDefinition = cleanSentence(payload.definition);
  const directExample = cleanSentence(payload.example);
  if (directDefinition) {
    return {
      definition: directDefinition,
      example:
        directExample ||
        `Example: ${cleanSentence(payload.keyword || "this concept")} is applied in this learning context.`,
      source: cleanSentence(payload.source) || "mcp-learn",
      provider: cleanSentence(payload.provider) || "mcp-learn",
    };
  }

  if (payload.data && typeof payload.data === "object") {
    const nestedDefinition = cleanSentence(payload.data.definition);
    const nestedExample = cleanSentence(payload.data.example);
    if (nestedDefinition) {
      return {
        definition: nestedDefinition,
        example:
          nestedExample ||
          `Example: ${cleanSentence(payload.data.keyword || "this concept")} is applied in this learning context.`,
        source: cleanSentence(payload.data.source) || "mcp-learn",
        provider: cleanSentence(payload.data.provider) || "mcp-learn",
      };
    }
  }

  return null;
}

async function fetchMcpLearnSuggestion(keyword, context, diagnostics = {}) {
  const endpoint = cleanSentence(await getConfigValue("MCP_LEARN_ENDPOINT"));
  if (!endpoint) {
    return {
      result: null,
      reason: "missing-endpoint",
    };
  }

  const apiKey = cleanSentence(await getConfigValue("MCP_LEARN_API_KEY"));
  const timeoutRaw = cleanSentence(await getConfigValue("MCP_LEARN_TIMEOUT_MS"));
  const parsedTimeout = Number.parseInt(timeoutRaw || "12000", 10);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 12000;

  const headers = {
    "content-type": "application/json",
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const requestBody = {
    keyword: cleanSentence(keyword),
    context: cleanSentence(context),
    requestId: diagnostics.requestId,
  };

  logEvent("info", "mcp.request.start", {
    ...diagnostics,
    keyword: cleanSentence(keyword),
    endpoint,
    timeoutMs,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const reason = error?.name === "AbortError" ? "timeout" : error?.message || "network-error";
    logEvent("warn", "mcp.request.failed", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
      reason,
    });
    return {
      result: null,
      reason,
    };
  }

  clearTimeout(timeout);

  if (!response.ok) {
    logEvent("warn", "mcp.request.http_error", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
      status: response.status,
    });
    return {
      result: null,
      reason: `http-${response.status}`,
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    logEvent("warn", "mcp.response.parse_error", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return {
      result: null,
      reason: "invalid-json",
    };
  }

  const suggestion = extractMcpSuggestion(payload);
  if (!suggestion) {
    logEvent("warn", "mcp.response.missing_fields", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return {
      result: null,
      reason: "missing-definition",
    };
  }

  logEvent("info", "mcp.request.success", {
    ...diagnostics,
    keyword: cleanSentence(keyword),
  });

  return {
    result: suggestion,
    reason: "success",
  };
}

function buildLocalSuggestion(keyword, context) {
  const cleanedKeyword = (keyword || "").trim();
  const cleanedContext = (context || "").replace(/\s+/g, " ").trim();
  const shortContext = cleanedContext.slice(0, 180);

  if (!cleanedKeyword) {
    return {
      definition: "",
      example: "",
    };
  }

  return {
    definition: shortContext
      ? `${cleanedKeyword} is a practical concept in this project context, especially around: ${shortContext}.`
      : `${cleanedKeyword} is a key concept used to describe behavior, structure, or optimization in machine learning workflows.`,
    example: shortContext
      ? `Example: We referenced ${cleanedKeyword} while refining notes related to "${shortContext}".`
      : `Example: The team adjusted ${cleanedKeyword} to improve model performance and output quality.`,
    source: "local-fallback",
    provider: "local",
  };
}

async function getOpenAiApiVersion(promptShieldMode) {
  const configuredVersion = cleanSentence(await getConfigValue("AZURE_OPENAI_API_VERSION"));
  if (configuredVersion) {
    return configuredVersion;
  }

  return isPromptShieldEnabled(promptShieldMode) ? "2024-10-01-preview" : "2024-10-21";
}

async function getOpenAiClient(apiVersion) {
  if (openAiClients.has(apiVersion)) {
    return openAiClients.get(apiVersion);
  }

  const endpoint = await getConfigValue("AZURE_OPENAI_ENDPOINT");
  const apiKey = await getConfigValue("AZURE_OPENAI_API_KEY");

  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure OpenAI is not configured. Set endpoint and API key via env or Key Vault.",
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments`,
    defaultQuery: { "api-version": apiVersion },
    defaultHeaders: { "api-key": apiKey },
  });

  openAiClients.set(apiVersion, client);
  return client;
}

async function suggestDefinition(keyword, context, diagnostics = {}) {
  const provider = normalizeProvider(await getConfigValue("DEFINITION_PROVIDER"));
  const promptShieldMode = normalizePromptShieldMode(
    await getConfigValue("AZURE_OPENAI_PROMPT_SHIELDS_MODE"),
  );

  logEvent("info", "definition.provider.resolved", {
    ...diagnostics,
    keyword: cleanSentence(keyword),
    provider,
  });

  if (provider === "local") {
    logEvent("info", "definition.provider.local", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return buildLocalSuggestion(keyword, context);
  }

  if (provider === "dictionary" || provider === "auto") {
    const dictionaryLookup = await fetchDictionaryEntry(keyword, diagnostics);
    if (dictionaryLookup.result) {
      logEvent("info", "dictionary.request.success", {
        ...diagnostics,
        keyword: cleanSentence(keyword),
      });
      return dictionaryLookup.result;
    }

    logEvent("warn", "dictionary.request.unavailable", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
      reason: dictionaryLookup.reason,
    });

    if (provider === "dictionary") {
      logEvent("info", "definition.provider.dictionary_fallback_local", {
        ...diagnostics,
        keyword: cleanSentence(keyword),
      });
      return buildLocalSuggestion(keyword, context);
    }
  }

  if (provider === "mcp" || provider === "auto") {
    const mcpLookup = await fetchMcpLearnSuggestion(keyword, context, diagnostics);
    if (mcpLookup.result) {
      return mcpLookup.result;
    }

    logEvent("warn", "mcp.request.unavailable", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
      reason: mcpLookup.reason,
    });

    if (provider === "mcp") {
      logEvent("info", "definition.provider.mcp_fallback_local", {
        ...diagnostics,
        keyword: cleanSentence(keyword),
      });
      return buildLocalSuggestion(keyword, context);
    }
  }

  const deployment = await getConfigValue("AZURE_OPENAI_DEPLOYMENT");
  if (!deployment || provider === "openai" || provider === "auto") {
    if (!deployment) {
      logEvent("warn", "openai.config.missing_deployment", {
        ...diagnostics,
        keyword: cleanSentence(keyword),
      });
      return buildLocalSuggestion(keyword, context);
    }
  }

  if (!deployment) {
    logEvent("warn", "openai.config.no_deployment", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return buildLocalSuggestion(keyword, context);
  }

  let client;
  const apiVersion = await getOpenAiApiVersion(promptShieldMode);
  try {
    client = await getOpenAiClient(apiVersion);
  } catch {
    logEvent("warn", "openai.client.unavailable", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return buildLocalSuggestion(keyword, context);
  }

  let completion;
  try {
    const requestPayload = {
      model: deployment,
      temperature: 0.2,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "You are a concise technical writing assistant. Return only JSON with keys definition and example.",
        },
        {
          role: "user",
          content: `Keyword: ${keyword}\nContext: ${context || "N/A"}`,
        },
      ],
      response_format: { type: "json_object" },
    };

    const promptShield = buildPromptShieldConfig(promptShieldMode);
    if (promptShield) {
      requestPayload.prompt_shield = promptShield;
    }

    completion = await client.chat.completions.create(requestPayload);
  } catch (error) {
    logEvent("warn", "openai.request.failed", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
      reason: error?.message || "unknown",
    });

    if (
      isPromptShieldEnabled(promptShieldMode) &&
      /jailbreak|prompt shield|prompt_shield|content filter/i.test(error?.message || "")
    ) {
      throw new PromptShieldBlockedError("Prompt blocked by Azure Prompt Shields.", {
        action: promptShieldMode,
        apiVersion,
      });
    }

    return buildLocalSuggestion(keyword, context);
  }

  const promptShieldResult = extractPromptShieldResult(completion);
  if (promptShieldResult) {
    logEvent(
      promptShieldResult.filtered ? "warn" : "info",
      "openai.prompt_shield.result",
      {
        ...diagnostics,
        keyword: cleanSentence(keyword),
        action: promptShieldMode,
        detected: promptShieldResult.detected,
        filtered: promptShieldResult.filtered,
      },
    );
  }

  if (promptShieldResult?.filtered) {
    throw new PromptShieldBlockedError("Prompt blocked by Azure Prompt Shields.", {
      action: promptShieldMode,
      apiVersion,
      ...promptShieldResult,
    });
  }

  const message = completion.choices?.[0]?.message?.content;
  if (!message) {
    logEvent("warn", "openai.response.empty", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return buildLocalSuggestion(keyword, context);
  }

  try {
    const parsed = JSON.parse(message);
    return {
      definition: parsed.definition || "",
      example: parsed.example || "",
      source: "openai",
      provider: "azure-openai",
      safety: promptShieldResult
        ? {
            promptShield: {
              enabled: isPromptShieldEnabled(promptShieldMode),
              action: promptShieldMode,
              detected: promptShieldResult.detected,
              filtered: promptShieldResult.filtered,
            },
          }
        : undefined,
    };
  } catch {
    logEvent("warn", "openai.response.invalid_json", {
      ...diagnostics,
      keyword: cleanSentence(keyword),
    });
    return buildLocalSuggestion(keyword, context);
  }
}

module.exports = {
  PromptShieldBlockedError,
  suggestDefinition,
};
