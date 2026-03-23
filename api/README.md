# Azure Functions API

Node.js Azure Functions backend for the note taking widget UI.

## Endpoints

- `GET /api/snippets`
- `PUT /api/snippets/{keyword}`
- `DELETE /api/snippets/{keyword}`
- `POST /api/ai/definition`
- `POST /api/ai/text-analytics`

## Run Locally

1. `npm install`
2. Copy `local.settings.sample.json` to `local.settings.json`
3. Fill values (or configure Key Vault and managed identity)
4. `npm start`

## Notes

- Snippets are stored as JSON in Blob Storage.
- Secrets resolve from environment first, then Key Vault.
- App Insights telemetry starts automatically when connection string is configured.
- Definition provider behavior is controlled by `DEFINITION_PROVIDER`:
	- `auto` (default): dictionary -> Azure OpenAI -> local fallback
	- `dictionary`: dictionary -> local fallback
	- `openai`: Azure OpenAI -> local fallback
	- `local`: local fallback only
- Free dictionary base URL can be overridden with `FREE_DICTIONARY_API_BASE_URL`.
