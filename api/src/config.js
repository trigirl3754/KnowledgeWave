const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

const secretCache = new Map();

function getCredential() {
  return new DefaultAzureCredential();
}

function getVaultClient() {
  const keyVaultUrl = process.env.KEY_VAULT_URL;
  if (!keyVaultUrl) {
    return null;
  }
  return new SecretClient(keyVaultUrl, getCredential());
}

async function getConfigValue(name, secretName = name) {
  if (process.env[name]) {
    return process.env[name];
  }

  if (secretCache.has(secretName)) {
    return secretCache.get(secretName);
  }

  const vaultClient = getVaultClient();
  if (!vaultClient) {
    return undefined;
  }

  try {
    const secret = await vaultClient.getSecret(secretName);
    secretCache.set(secretName, secret.value);
    return secret.value;
  } catch {
    return undefined;
  }
}

module.exports = {
  getConfigValue,
  getCredential,
};
