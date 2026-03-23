# Repository Construction Guide

This document explains how this repository was put together, what each part does, and how the system is wired across local development and Azure-backed services.

## Quick Start

1. Install dependencies:
   - `cd note && npm install`
   - `cd ../api && npm install`
2. Start from repository root:
   - `npm run dev:azure`
3. Open `http://localhost:5173`.
4. Verify workflow:
   - click a term from Sidebar or Documentation,
   - run `AI Suggest`, then `Analyze`,
   - run `+ Add / Save` and confirm Glossary update.

## 1) High-level architecture

This repository is split into two deployable parts:

- `note/`: React + Vite frontend UI.
- `api/`: Node.js Azure Functions backend (v4 programming model).

The frontend talks to the backend over HTTP using `VITE_API_BASE_URL` (default: `http://localhost:7071/api`). The backend persists note snippets to Azure Blob Storage and provides optional AI features through Azure OpenAI and Azure AI Language Text Analytics.

## 2) Repository layout and intent

### Root

- `README.md`: project overview and local run steps.
- `LICENSE`: license metadata.

### Frontend app (`note/`)

- `src/main.jsx`: React entry point.
- `src/App.jsx`: top-level composition and state synchronization.
- `src/components/`: UI feature components:
  - `Sidebar.jsx`: keyword picker with add-new-word input.
  - `DocumentationColumn.jsx`: editable paragraph column with auto-linked keywords.
  - `KeywordWidget.jsx`: edit/save/delete widget with AI suggest and analyze actions.
  - `GlossaryPanel.jsx`: summary cards from snippets.
  - `KnowledgeGraph.jsx`: visual keyword chip graph placeholder.
- `src/config/api.js`: centralized API client wrapper.
- `index.css`: Tailwind import and base body styles.
- `tailwind.config.js`: theme extension (brand colors).
- `postcss.config.js`: Tailwind PostCSS plugin.
- `vite.config.mjs`: Vite + React plugin setup.
- `db.json`: local mock data source for legacy `json-server` mode.

### Backend app (`api/`)

- `src/index.js`: Azure Functions route registration and handlers.
- `src/storage.js`: Blob Storage read/write abstraction.
- `src/config.js`: config resolver with env-first, Key Vault fallback.
- `src/ai.js`: Azure OpenAI integration for definition/example suggestions.
- `src/textAnalytics.js`: sentiment + key phrase analysis.
- `src/telemetry.js`: Application Insights startup.
- `src/responses.js`: shared JSON/CORS response helpers.
- `local.settings.sample.json`: local dev environment template.
- `host.json`: Functions host and Application Insights sampling config.

## 3) How it was assembled (build sequence)

The current repo reflects this construction pattern:

1. Create a React-based note UI under `note/` and run it with Vite.
2. Add Tailwind for utility-first styling and define brand palette extensions.
3. Build a componentized layout:
   - left sidebar for keywords,
   - center documentation + workflow/graph area,
   - right glossary panel,
   - floating keyword widget for CRUD editing.
4. Keep snippet state in frontend memory and localStorage for immediate UX continuity.
5. Add dynamic keyword management (default terms + user-added terms + snippet-derived merge).
6. Add Documentation column with:
   - editable paragraph text stored in localStorage,
   - auto-linking of known keywords in text,
   - detected unknown term chips for one-click keyword addition.
7. Add responsive shell behavior:
   - desktop keeps fixed Sidebar + Glossary columns,
   - mobile/tablet moves them into drawers opened by header controls,
   - drawers support backdrop close and animated open/close transitions.
8. Add a backend project under `api/` using Azure Functions (Node v4 model).
9. Implement snippets endpoints (`GET`, `PUT`, `DELETE`) in `api/src/index.js`.
10. Move snippet persistence to Azure Blob Storage via `api/src/storage.js`.
11. Add cloud config strategy:
   - environment variables first,
   - then Azure Key Vault (`KEY_VAULT_URL`) fallback,
   - with in-process secret caching.
12. Add AI-assisted features:
   - Azure OpenAI for suggested definition/example,
   - dictionary-first provider option for authoritative definitions,
   - Text Analytics for sentiment and key phrase extraction.
13. Add fallback behavior so suggest/analyze still return local results when cloud services are unavailable.
14. Add backend telemetry bootstrap for Application Insights.
15. Add local developer scripts in `note/package.json`:
   - `dev:azure` to run frontend + Functions together,
   - `dev` for frontend + `json-server` mock mode.
16. Add root-level `package.json` scripts so developers can run commands from repository root.

## 4) Frontend composition details

`note/src/App.jsx` is the composition root:

- Owns `selectedKeyword` and `snippets` state.
- Owns dynamic `keywords` state used by Sidebar and Documentation linking.
- Owns mobile drawer state for Sidebar and Glossary.
- Hydrates snippets from localStorage on first render.
- Persists snippets back to localStorage on change.
- Fetches remote snippets on startup with `getSnippets()` and overlays local state if backend data is available.

Responsive navigation behavior:

- Desktop renders Sidebar and Glossary inline.
- Mobile/tablet renders drawers opened from header buttons.
- Drawers use animated transitions and backdrop close behavior.

`note/src/components/Sidebar.jsx`:

- Supports manual keyword creation from UI input.
- Selects newly created keyword immediately so widget workflow is one click away.
- Supports overlay mode with close action for mobile drawer usage.

`note/src/components/DocumentationColumn.jsx`:

- Renders editable paragraph content.
- Persists documentation text in localStorage.
- Auto-links known keywords in paragraph text to open widget on click.
- Detects potential unknown terms and provides one-click `+ term` chips to add them into keyword state.

`note/src/components/KeywordWidget.jsx` contains the main interaction logic:

- Save: updates local state and calls `saveSnippet(keyword, payload)`.
- Delete: removes local state and calls `deleteSnippet(keyword)`.
- AI Suggest: calls `generateSuggestion(keyword, context)` with provider-mode behavior:
   - `auto`: dictionary -> Azure OpenAI -> local fallback,
   - `dictionary`: dictionary -> local fallback,
   - `openai`: Azure OpenAI -> local fallback,
   - `local`: local fallback only.
- Analyze: calls `analyzeSnippetText(text)`, shows visible status, and falls back to local sentiment/key phrase heuristics if API fails.
- Uses responsive positioning/sizing so the modal remains usable on small screens.

The API wrapper in `note/src/config/api.js` centralizes:

- base URL selection from `VITE_API_BASE_URL`,
- JSON headers,
- non-2xx error normalization,
- endpoint-specific functions.

## 5) Backend construction details

`api/src/index.js` registers all HTTP routes with anonymous auth:

- `GET /api/snippets`
- `PUT /api/snippets/{keyword}`
- `DELETE /api/snippets/{keyword}`
- `POST /api/ai/definition`
- `POST /api/ai/text-analytics`
- wildcard `OPTIONS` handler for CORS preflight compatibility

Storage layer (`api/src/storage.js`):

- Reads connection string via `getConfigValue("SNIPPETS_BLOB_CONNECTION_STRING")`.
- Uses configurable container/blob names with defaults:
  - container: `snippets`
  - blob: `snippets.json`
- Creates container if missing.
- Stores snippets as formatted JSON.

Configuration layer (`api/src/config.js`):

- `getConfigValue(name, secretName?)` lookup order:
  1. process env,
  2. in-memory cache,
  3. Key Vault secret read (if `KEY_VAULT_URL` exists).

AI layer (`api/src/ai.js`):

- Supports configurable definition providers via `DEFINITION_PROVIDER`.
- Dictionary flow uses `dictionaryapi.dev` by default (configurable base URL).
- OpenAI flow uses Azure OpenAI via the `openai` SDK configured with Azure deployment base URL.
- Sends system instruction requiring JSON output with keys `definition` and `example`.
- Falls back safely to local suggestion generation when selected providers are unavailable.

Text analytics (`api/src/textAnalytics.js`):

- Calls `analyzeSentiment` and `extractKeyPhrases` on the same text.
- Returns normalized results to the frontend.

Telemetry (`api/src/telemetry.js`):

- Starts Application Insights only if connection string is present.
- Enables request, dependency, exception, and console collection.

## 6) Local development modes

### Preferred Azure-backed mode

From repository root (recommended):

1. `npm run dev:azure`

Equivalent from `note/`:

1. `npm install`
2. In `api/`, run `npm install`
3. Copy `api/local.settings.sample.json` to `api/local.settings.json`
4. Fill required settings
5. Start both apps with `npm run dev:azure`

This runs:

- Vite frontend on its dev port.
- Azure Functions host on `http://localhost:7071`.

### Legacy mock mode

From `note/`, `npm run dev` starts:

- Vite frontend.
- `json-server` against `note/db.json` on port `4000`.

## 7) Azure service dependencies and why they are present

- Azure Functions: serverless HTTP API host.
- Azure Blob Storage: durable snippet store.
- Azure Key Vault: secure secret retrieval fallback.
- Azure OpenAI: definition/example generation.
- Azure AI Language Text Analytics: sentiment + key phrase extraction.
- Application Insights: backend observability.

## 8) Configuration contract

Expected settings (env or Key Vault where applicable):

- `SNIPPETS_BLOB_CONNECTION_STRING`
- `SNIPPETS_BLOB_CONTAINER` (optional, default `snippets`)
- `SNIPPETS_BLOB_NAME` (optional, default `snippets.json`)
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `DEFINITION_PROVIDER` (`auto` | `dictionary` | `openai` | `local`; default `auto`)
- `FREE_DICTIONARY_API_BASE_URL` (default `https://api.dictionaryapi.dev/api/v2/entries/en`)
- `AZURE_TEXT_ANALYTICS_ENDPOINT`
- `AZURE_TEXT_ANALYTICS_API_KEY`
- `APPINSIGHTS_CONNECTION_STRING` or `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `KEY_VAULT_URL` (optional, enables secret fallback path)

## 9) Runtime data flow

1. User selects a keyword in the sidebar.
2. On small screens, user can first open Sidebar/Glossary via header drawer buttons.
3. Or user clicks linked terms in Documentation column (or adds detected terms).
4. `KeywordWidget` opens with current snippet data.
5. `AI Suggest` fills definition/example (Azure-backed when available, local fallback otherwise).
6. `Analyze` returns sentiment/key phrases (Azure-backed when available, local fallback otherwise).
7. `+ Add / Save` updates local state immediately.
8. Frontend calls backend endpoints via `src/config/api.js`.
9. Backend validates input and executes storage/AI operations.
10. Blob JSON is updated and returned.
11. Frontend panels (Glossary/Graph) rerender from shared `snippets` state.

## 10) Design choices and tradeoffs

- Chosen: localStorage + remote sync.
  - Benefit: resilient UX when API is down.
  - Tradeoff: potential stale local cache until refresh/sync.
- Chosen: local fallback for AI suggest/analyze.
  - Benefit: users always get visible output instead of silent failures.
  - Tradeoff: fallback quality is heuristic and lower fidelity than cloud services.
- Chosen: provider-based definition strategy (dictionary/OpenAI/local).
   - Benefit: enables authoritative definitions while keeping contextual generation available.
   - Tradeoff: external dictionary availability and response format can vary by provider.
- Chosen: Azure Functions over always-on server.
  - Benefit: lower operational overhead for this workload.
  - Tradeoff: requires Functions local tooling and cloud-specific config.
- Chosen: environment-first config with Key Vault fallback.
  - Benefit: simple local setup plus secure cloud secret handling.
  - Tradeoff: additional dependency on managed identity and vault permissions when enabled.

## 11) Suggested future construction improvements

- Add schema validation for snippet payloads shared by frontend/backend.
- Add automated tests for API handlers and frontend API client.
- Persist keyword list to backend/user profile for cross-device continuity.
- Implement actual graph edges from snippet links/co-occurrence.
- Add CI checks for lint/test/build across both apps.
