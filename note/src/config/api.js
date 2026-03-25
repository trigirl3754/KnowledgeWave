const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:7071/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code;
    let details;
    try {
      const err = await response.json();
      if (err?.error) {
        message = err.error;
      }
      code = err?.code;
      details = err?.details;
    } catch {
      // Ignore JSON parse failures and keep the fallback message.
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.details = details;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getSnippets() {
  return apiRequest("/snippets", { method: "GET" });
}

export async function saveSnippet(keyword, data) {
  return apiRequest(`/snippets/${encodeURIComponent(keyword)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSnippet(keyword) {
  return apiRequest(`/snippets/${encodeURIComponent(keyword)}`, {
    method: "DELETE",
  });
}

export async function generateSuggestion(keyword, context) {
  return apiRequest("/ai/definition", {
    method: "POST",
    body: JSON.stringify({ keyword, context }),
  });
}

export async function analyzeSnippetText(text) {
  return apiRequest("/ai/text-analytics", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
