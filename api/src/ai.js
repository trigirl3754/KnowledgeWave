const { OpenAI } = require("openai");
const { getConfigValue } = require("./config");

let openAiClient;

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
  const deployment = await getConfigValue("AZURE_OPENAI_DEPLOYMENT");
  if (!deployment) {
    throw new Error("Missing AZURE_OPENAI_DEPLOYMENT (env or Key Vault).");
  }

  const client = await getOpenAiClient();

  const completion = await client.chat.completions.create({
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

  const message = completion.choices?.[0]?.message?.content;
  if (!message) {
    return {
      definition: "",
      example: "",
    };
  }

  try {
    const parsed = JSON.parse(message);
    return {
      definition: parsed.definition || "",
      example: parsed.example || "",
    };
  } catch {
    return {
      definition: message,
      example: "",
    };
  }
}

module.exports = {
  suggestDefinition,
};
