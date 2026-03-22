# Wave-Simple-App

Note taking widget UI with a React frontend and Azure-backed API services.

## Implemented Azure Service Integration

This repository now includes implementation hooks for:

- Azure Functions (HTTP API backend)
- Azure Blob Storage (snippet persistence)
- Azure Key Vault (secret resolution fallback)
- Azure OpenAI (definition/example suggestion)
- Azure AI Language Text Analytics (sentiment and key phrase extraction)
- Azure Monitor / Application Insights (backend telemetry)

## Repository Layout

- `note/` - React + Vite frontend.
- `api/` - Azure Functions (Node.js v4 programming model).

## Local Development

1. Install dependencies:
   - `cd note && npm install`
   - `cd ../api && npm install`
2. Copy `api/local.settings.sample.json` to `api/local.settings.json`.
3. Fill required secrets in `api/local.settings.json` (or configure Key Vault + managed identity).
4. Run frontend + Azure Functions from `note/`:
   - `npm run dev:azure`
5. For frontend-only legacy mock mode:
   - `npm run dev`

Default API base URL for frontend is `http://localhost:7071/api` and can be overridden with `VITE_API_BASE_URL`.

## Azure Configuration Keys

Backend supports reading values from environment variables first, then Key Vault (if `KEY_VAULT_URL` is set):

- `SNIPPETS_BLOB_CONNECTION_STRING`
- `SNIPPETS_BLOB_CONTAINER` (default: `snippets`)
- `SNIPPETS_BLOB_NAME` (default: `snippets.json`)
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_TEXT_ANALYTICS_ENDPOINT`
- `AZURE_TEXT_ANALYTICS_API_KEY`
- `APPINSIGHTS_CONNECTION_STRING` (or `APPLICATIONINSIGHTS_CONNECTION_STRING`)

## AKS Readiness and Migration Path

Current implementation uses Azure Functions as the primary backend, which is the best fit for low-ops serverless workloads.

If you later need AKS for advanced scaling or multi-service orchestration:

1. Containerize the `api/` service and expose equivalent REST endpoints.
2. Move blob/key vault/openai/text-analytics access logic unchanged into the container service.
3. Use Azure Key Vault CSI driver or managed identity in AKS for secrets.
4. Configure Azure Monitor Container Insights and Application Insights/OpenTelemetry exporter.
5. Point frontend `VITE_API_BASE_URL` to the AKS ingress endpoint.

This lets you start simple with Functions and move to AKS without changing frontend contracts.
