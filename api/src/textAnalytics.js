const {
  AzureKeyCredential,
  TextAnalyticsClient,
} = require("@azure/ai-text-analytics");
const { getConfigValue } = require("./config");

let textClient;

async function getTextClient() {
  if (textClient) {
    return textClient;
  }

  const endpoint = await getConfigValue("AZURE_TEXT_ANALYTICS_ENDPOINT");
  const apiKey = await getConfigValue("AZURE_TEXT_ANALYTICS_API_KEY");

  if (!endpoint || !apiKey) {
    throw new Error(
      "Text Analytics is not configured. Set endpoint and API key via env or Key Vault.",
    );
  }

  textClient = new TextAnalyticsClient(
    endpoint,
    new AzureKeyCredential(apiKey),
  );
  return textClient;
}

async function analyzeText(text) {
  const client = await getTextClient();

  const [sentiment] = await client.analyzeSentiment([text]);
  const [keyPhrases] = await client.extractKeyPhrases([text]);

  return {
    sentiment: sentiment.isError
      ? { label: "unknown", confidenceScores: {} }
      : {
          label: sentiment.sentiment,
          confidenceScores: sentiment.confidenceScores,
        },
    keyPhrases: keyPhrases.isError ? [] : keyPhrases.keyPhrases,
  };
}

module.exports = {
  analyzeText,
};
