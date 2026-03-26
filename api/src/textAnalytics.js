const { getConfigValue } = require("./config");

const DEFAULT_TIMEOUT_MS = 12000;
const API_VERSION = "v3.2";

let cachedConfig;

function trimValue(value) {
  return (value || "").toString().trim();
}

async function getTextConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const endpoint = trimValue(await getConfigValue("AZURE_TEXT_ANALYTICS_ENDPOINT"));
  const apiKey = trimValue(await getConfigValue("AZURE_TEXT_ANALYTICS_API_KEY"));

  if (!endpoint || !apiKey) {
    throw new Error(
      "Text Analytics is not configured. Set endpoint and API key via env or Key Vault.",
    );
  }

  cachedConfig = {
    endpoint: endpoint.replace(/\/$/, ""),
    apiKey,
  };

  return cachedConfig;
}

async function postTextAnalytics(path, text) {
  const { endpoint, apiKey } = await getTextConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoint}/text/analytics/${API_VERSION}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      body: JSON.stringify({
        documents: [{ id: "1", language: "en", text }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Text Analytics request failed with status ${response.status}.`;
      try {
        const payload = await response.json();
        const serviceMessage = trimValue(payload?.error?.message);
        if (serviceMessage) {
          message = serviceMessage;
        }
      } catch {
        // Keep generic status error.
      }

      throw new Error(message);
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Text Analytics request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeText(text) {
  const [sentimentPayload, keyPhrasesPayload] = await Promise.all([
    postTextAnalytics("sentiment", text),
    postTextAnalytics("keyPhrases", text),
  ]);

  const sentimentDoc = sentimentPayload?.documents?.[0];
  const sentimentError = sentimentPayload?.errors?.[0];

  const keyPhraseDoc = keyPhrasesPayload?.documents?.[0];
  const keyPhraseError = keyPhrasesPayload?.errors?.[0];

  if (sentimentError) {
    console.warn("[textAnalytics] sentiment_error", sentimentError);
  }
  if (keyPhraseError) {
    console.warn("[textAnalytics] key_phrases_error", keyPhraseError);
  }

  return {
    sentiment: !sentimentDoc || sentimentError
      ? { label: "unknown", confidenceScores: {} }
      : {
          label: sentimentDoc.sentiment,
          confidenceScores: sentimentDoc.confidenceScores || {},
        },
    keyPhrases: !keyPhraseDoc || keyPhraseError
      ? []
      : Array.isArray(keyPhraseDoc.keyPhrases)
        ? keyPhraseDoc.keyPhrases
        : [],
  };
}

module.exports = {
  analyzeText,
};
