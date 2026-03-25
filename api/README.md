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
	- `auto` (default): dictionary -> MCP Learn -> Azure OpenAI -> local fallback
	- `dictionary`: dictionary -> local fallback
	- `mcp`: MCP Learn -> local fallback
	- `openai`: Azure OpenAI -> local fallback
	- `local`: local fallback only
- Free dictionary base URL can be overridden with `FREE_DICTIONARY_API_BASE_URL`.
- Secondary dictionary fallback base URL can be overridden with `FREE_DICTIONARY_FALLBACK_BASE_URL`.
- MCP Learn endpoint/key can be configured with `MCP_LEARN_ENDPOINT` and `MCP_LEARN_API_KEY`.
- Azure Prompt Shields can be enabled for Azure OpenAI requests with `AZURE_OPENAI_PROMPT_SHIELDS_MODE`:
	- `off`: no shield request settings sent.
	- `annotate`: request annotation metadata but do not block.
	- `block`: block prompts flagged by Azure Prompt Shields.
- `AZURE_OPENAI_API_VERSION` can be set explicitly if your deployment requires a preview API version for guardrails.

## Prompt Shields behavior

When `AZURE_OPENAI_PROMPT_SHIELDS_MODE=block` and Azure flags the prompt, the API returns:

- HTTP `422`
- JSON error code `prompt_shield_blocked`

The frontend is wired to stop local fallback in that case so blocked prompts stay blocked.

## Troubleshooting dictionary provider

1. Confirm API logs contain `definition.request.received` and `definition.request.completed` events.
2. Inspect `[ai]` log events:
	- `definition.provider.resolved` for effective provider mode.
	- `dictionary.request.start` and `dictionary.request.success` for successful dictionary use.
	- `dictionary.request.primary_unavailable` when the primary dictionary source failed and fallback is attempted.
	- `dictionary.request.unavailable` with reason when neither primary nor fallback dictionary source produced a result.
3. If dictionary is skipped, check secret precedence:
	- Runtime resolves environment values first, then Key Vault.
	- `DEFINITION_PROVIDER=openai` or `local` will bypass dictionary-first behavior.
4. Validate dictionary URL source:
	- `FREE_DICTIONARY_API_BASE_URL` should be `https://api.dictionaryapi.dev/api/v2/entries/en` unless intentionally customized.
	- `FREE_DICTIONARY_FALLBACK_BASE_URL` should be `https://en.wiktionary.org/api/rest_v1/page/definition` unless intentionally customized.
