const { BlobServiceClient } = require("@azure/storage-blob");
const { getConfigValue } = require("./config");

const defaultPayload = {};

async function getBlobClient() {
  const connectionString = await getConfigValue(
    "SNIPPETS_BLOB_CONNECTION_STRING",
  );
  if (!connectionString) {
    throw new Error(
      "Missing SNIPPETS_BLOB_CONNECTION_STRING (env or Key Vault).",
    );
  }

  const containerName = process.env.SNIPPETS_BLOB_CONTAINER || "snippets";
  const blobName = process.env.SNIPPETS_BLOB_NAME || "snippets.json";

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  return containerClient.getBlockBlobClient(blobName);
}

async function readSnippets() {
  const blobClient = await getBlobClient();

  if (!(await blobClient.exists())) {
    return defaultPayload;
  }

  const download = await blobClient.download();
  const chunks = [];
  for await (const chunk of download.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return defaultPayload;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return defaultPayload;
  }
}

async function writeSnippets(snippets) {
  const blobClient = await getBlobClient();
  const payload = JSON.stringify(snippets, null, 2);

  await blobClient.upload(payload, Buffer.byteLength(payload), {
    blobHTTPHeaders: {
      blobContentType: "application/json",
    },
  });
}

module.exports = {
  readSnippets,
  writeSnippets,
};
