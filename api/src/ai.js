const { OpenAI } = require("openai");
const { getConfigValue } = require("./config");

let openAiClient;

function normalizeProvider(rawValue) {
  const value = (rawValue || "auto").toString().trim().toLowerCase();
  if (["dictionary", "openai", "local", "auto"].includes(value)) {
    return value;
  }
  return "auto";
}

function cleanSentence(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

async function fetchDictionaryEntry(keyword) {
  const encoded = encodeURIComponent((keyword || "").trim());
  if (!encoded) {
    return null;
  }

  const configuredBase = await getConfigValue("FREE_DICTIONARY_API_BASE_URL");
  const baseUrl = (configuredBase || "https://api.dictionaryapi.dev/api/v2/entries/en")
    .replace(/\/$/, "");

  let response;
  try {
    response = await fetch(`${baseUrl}/${encoded}`);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry || !Array.isArray(entry.meanings)) {
    return null;
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
      definition: partOfSpeech
        ? `${definitionText} (${partOfSpeech})`
        : definitionText,
      example:
        dictionaryExample ||
        `Example: The term \"${cleanSentence(keyword)}\" is used with this meaning in context-aware notes.`,
      source: "dictionary",
      provider: "dictionaryapi.dev",
    };
  }

  return null;
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

async function getOpenAiClient() {
  if (openAiClient) {
    return openAiClient;
  }

  const endpoint = await getConfigValue("AZURE_OPENAI_ENDPOINT");
  const apiKey = await getConfigValue("AZURE_OPENAI_API_KEY");

  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure OpenAI is not configured. Set endpoint and API key via env or Key Vault.",
    );
  }

  openAiClient = new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments`,
    defaultQuery: { "api-version": "2024-10-21" },
    defaultHeaders: { "api-key": apiKey },
  });

  return openAiClient;
}

async function suggestDefinition(keyword, context) {
  const provider = normalizeProvider(await getConfigValue("DEFINITION_PROVIDER"));

  if (provider === "local") {
    return buildLocalSuggestion(keyword, context);
  }

  if (provider === "dictionary" || provider === "auto") {
    const dictionaryResult = await fetchDictionaryEntry(keyword);
    if (dictionaryResult) {
      return dictionaryResult;
    }
    if (provider === "dictionary") {
      return buildLocalSuggestion(keyword, context);
    }
  }

  const deployment = await getConfigValue("AZURE_OPENAI_DEPLOYMENT");
  if (!deployment || provider === "openai" || provider === "auto") {
    if (!deployment) {
      return buildLocalSuggestion(keyword, context);
    }
  }

  if (!deployment) {
    return buildLocalSuggestion(keyword, context);
  }

  let client;
  try {
    client = await getOpenAiClient();
  } catch {
    return buildLocalSuggestion(keyword, context);
  }

  let completion;
  try {
    completion = await client.chat.completions.create({
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
    });
  } catch {
    return buildLocalSuggestion(keyword, context);
  }

  const message = completion.choices?.[0]?.message?.content;
  if (!message) {
    return buildLocalSuggestion(keyword, context);
  }

  try {
    const parsed = JSON.parse(message);
    return {
      definition: parsed.definition || "",
      example: parsed.example || "",
      source: "openai",
      provider: "azure-openai",
    };
  } catch {
    return buildLocalSuggestion(keyword, context);
  }
}

module.exports = {
  suggestDefinition,
};
