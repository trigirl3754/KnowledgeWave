# Wave-Simple-App

Note taking widget UI with a React frontend and Azure-backed API services.

## Quick Start

1. Install deps once:
   - `cd note && npm install`
   - `cd ../api && npm install`
2. Start app stack from repo root:
   - `npm run dev:azure`
3. Open `http://localhost:5173`.
4. In the app:
   - Click a term in Sidebar or Documentation.
   - Click `AI Suggest`.
   - Click `Analyze`.
   - Click `+ Add / Save` and verify it appears in Glossary.

## Additional Documentation

- Repository construction details: `REPO_CONSTRUCTION.md`

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

## Current Workflow

1. Open a term from either:
   - Sidebar keyword list (supports adding custom words), or
   - Documentation column (editable paragraphs with clickable linked terms).
   - On mobile/tablet, open panels from header buttons (`Menu` for Keywords, `Glossary` for glossary drawer).
2. In the keyword widget:
   - Click `AI Suggest` to generate definition/example.
   - Click `Analyze` to run text sentiment and key phrase extraction.
   - Click `+ Add / Save` to persist to snippets and populate glossary/graph.
3. Optional: in Documentation view, use detected term chips to one-click add unknown terms into keywords.

### Responsive UI behavior

- Desktop (`xl` and up): Sidebar and Glossary are fixed side columns.
- Smaller screens: Sidebar and Glossary move to animated slide-in drawers with backdrop close.
- Header exposes drawer toggles for mobile navigation.
- Keyword widget repositions and becomes scrollable to avoid off-screen clipping.

### AI and Analyze fallback behavior

- `AI Suggest` supports provider mode via `DEFINITION_PROVIDER`:
   - `auto` (default): tries dictionary first, then Azure OpenAI, then local fallback.
   - `dictionary`: dictionary only, then local fallback.
   - `openai`: Azure OpenAI only, then local fallback.
   - `local`: local fallback only.
- Dictionary source defaults to `dictionaryapi.dev`.
- `AI Suggest` uses backend Azure OpenAI when configured and selected by provider mode.
- If Azure OpenAI is unavailable, suggestion falls back to local generation so the button still returns content.
- `Analyze` uses backend Text Analytics when configured.
- If Text Analytics is unavailable, widget shows status and returns local fallback analysis.

## Local Development

1. Install dependencies:
   - `cd note && npm install`
   - `cd ../api && npm install`
2. Copy `api/local.settings.sample.json` to `api/local.settings.json`.
3. Fill required secrets in `api/local.settings.json` (or configure Key Vault + managed identity).
4. Start apps (recommended from repo root):
   - `npm run dev:azure` (frontend + Azure Functions)
   - `npm run dev` (frontend + json-server mock)

You can also run from repository root:

- `npm run dev:azure`
- `npm run dev`

From `note/`, equivalent commands are:

- `npm run dev:azure`
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
- `DEFINITION_PROVIDER` (`auto` | `dictionary` | `openai` | `local`; default `auto`)
- `FREE_DICTIONARY_API_BASE_URL` (default: `https://api.dictionaryapi.dev/api/v2/entries/en`)
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
