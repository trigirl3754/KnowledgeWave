// KeywordWidget.js
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  analyzeSnippetText,
  deleteSnippet,
  generateSuggestion,
  saveSnippet,
} from "../config/api";

function localSuggest(keyword, context) {
  const trimmedKeyword = (keyword || "").trim();
  const contextLine = (context || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const definition = contextLine
    ? `${trimmedKeyword} is a concept used in this note set. In this context, it relates to: ${contextLine}.`
    : `${trimmedKeyword} is an important concept used to describe how a system learns, predicts, or organizes information.`;

  const example = contextLine
    ? `Example: In this project, ${trimmedKeyword} appears when working with "${contextLine}".`
    : `Example: We applied ${trimmedKeyword} to improve model quality while monitoring output consistency.`;

  return { definition, example };
}

function localAnalyze(text) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  const positiveHits = ["improve", "success", "good", "effective", "stable"].reduce(
    (sum, token) => sum + (lower.includes(token) ? 1 : 0),
    0,
  );
  const negativeHits = ["error", "fail", "issue", "bad", "slow"].reduce(
    (sum, token) => sum + (lower.includes(token) ? 1 : 0),
    0,
  );

  const sentimentLabel =
    positiveHits > negativeHits
      ? "positive"
      : negativeHits > positiveHits
        ? "negative"
        : "neutral";

  const tokens = normalized
    .split(/[^A-Za-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5);

  const freq = new Map();
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    freq.set(key, (freq.get(key) || 0) + 1);
  });

  const keyPhrases = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);

  return {
    sentiment: {
      label: sentimentLabel,
      confidenceScores: {},
    },
    keyPhrases,
  };
}

export default function KeywordWidget({
  keyword,
  snippets,
  setSnippets,
  onClose,
  autoCaptureToken = 0,
}) {
  const existing = useMemo(
    () =>
      snippets[keyword] || {
        definition: "",
        example: "",
        links: [],
        history: [],
      },
    [keyword, snippets],
  );

  const [local, setLocal] = useState(existing);
  const [aiSummary, setAiSummary] = useState(null);
  const [analyzeStatus, setAnalyzeStatus] = useState({
    type: "idle",
    message: "",
  });
  const [suggestStatus, setSuggestStatus] = useState({
    type: "idle",
    message: "",
  });

  useEffect(() => {
    setLocal(existing);
    setSuggestStatus({ type: "idle", message: "" });
  }, [keyword, existing]); // when switching keywords

  const handleChange = (field, value) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const persistSnapshot = async (snapshot, note = "Updated") => {
    const updated = {
      ...snippets,
      [keyword]: {
        ...snapshot,
        history: [
          ...(snapshot.history || []),
          { ts: new Date().toISOString(), note },
        ],
      },
    };
    setSnippets(updated);

    try {
      await saveSnippet(keyword, updated[keyword]);
    } catch (e) {
      console.warn("API save failed", e);
    }
  };

  const handleSave = async () => {
    await persistSnapshot(local, "Updated");
  };

  const handleDelete = async () => {
    const updated = { ...snippets };
    delete updated[keyword];
    setSnippets(updated);
    onClose();
    try {
      await deleteSnippet(keyword);
    } catch (e) {
      console.warn("API delete failed", e);
    }
  };

  const handleSuggest = async () => {
    const context = local.example || local.definition || "";
    setSuggestStatus({ type: "loading", message: "Generating suggestion..." });

    try {
      const suggestion = await generateSuggestion(keyword, context);
      setLocal((prev) => ({
        ...prev,
        definition: suggestion.definition || prev.definition,
        example: suggestion.example || prev.example,
      }));

      const provider = suggestion.provider || "unknown";
      const usedFallback = provider === "local";
      setSuggestStatus({
        type: usedFallback ? "warning" : "success",
        message: usedFallback
          ? "Suggestion generated from local fallback provider."
          : `Suggestion generated using ${provider}.`,
      });
    } catch (e) {
      console.warn("AI suggestion failed", e);
      const fallback = localSuggest(keyword, context);
      setLocal((prev) => ({
        ...prev,
        definition: fallback.definition || prev.definition,
        example: fallback.example || prev.example,
      }));
      setSuggestStatus({
        type: "warning",
        message: "API request failed; showing browser fallback suggestion.",
      });
    }
  };

  const handleAnalyze = async () => {
    const text = [local.definition, local.example].filter(Boolean).join("\n");
    if (!text.trim()) {
      setAiSummary(null);
      setAnalyzeStatus({
        type: "warning",
        message: "Add definition or example text before analyzing.",
      });
      return;
    }

    setAnalyzeStatus({ type: "loading", message: "Analyzing text..." });

    try {
      const analysis = await analyzeSnippetText(text);
      setAiSummary(analysis);
      setAnalyzeStatus({
        type: "success",
        message: "Analysis completed using Azure Text Analytics.",
      });
    } catch (e) {
      console.warn("Text analytics failed", e);
      const fallback = localAnalyze(text);
      setAiSummary(fallback);
      setAnalyzeStatus({
        type: "warning",
        message: "Azure analysis unavailable; showing local fallback analysis.",
      });
    }
  };

  const handleAutoCapture = async () => {
    const context = local.example || local.definition || "";
    setSuggestStatus({
      type: "loading",
      message: "Generating suggestion and saving to glossary...",
    });

    let nextLocal = local;
    let provider = "local";

    try {
      const suggestion = await generateSuggestion(keyword, context);
      provider = suggestion.provider || "unknown";
      nextLocal = {
        ...local,
        definition: suggestion.definition || local.definition,
        example: suggestion.example || local.example,
      };
    } catch (e) {
      console.warn("AI suggestion failed", e);
      const fallback = localSuggest(keyword, context);
      nextLocal = {
        ...local,
        definition: fallback.definition || local.definition,
        example: fallback.example || local.example,
      };
    }

    setLocal(nextLocal);
    await persistSnapshot(nextLocal, "Quick capture saved");

    const fallbackUsed = provider === "local";
    setSuggestStatus({
      type: fallbackUsed ? "warning" : "success",
      message: fallbackUsed
        ? "Saved to glossary using local fallback suggestion."
        : `Saved to glossary using ${provider}.`,
    });
  };

  useEffect(() => {
    if (!autoCaptureToken) {
      return;
    }

    let isActive = true;
    (async () => {
      if (!isActive) {
        return;
      }
      await handleAutoCapture();
    })();

    return () => {
      isActive = false;
    };
  }, [autoCaptureToken, keyword]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-x-3 top-16 sm:inset-x-6 sm:top-20 md:left-auto md:right-6 md:w-[26rem] xl:left-64 xl:right-auto xl:w-96 max-h-[calc(100vh-5.5rem)] overflow-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-30"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-100">{keyword}</h4>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
        <button
          onClick={handleSave}
          className="px-2 py-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-400"
        >
          + Add / Save
        </button>
        <button
          onClick={handleSave}
          className="px-2 py-1 rounded-md bg-lightblue-500 text-white hover:bg-blue-500"
        >
          ✎ Edit
        </button>
        <button
          onClick={handleDelete}
          className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-500"
        >
          🗑 Delete
        </button>
        <button
          onClick={handleSuggest}
          className="px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
        >
          AI Suggest
        </button>
        <button
          onClick={handleAnalyze}
          className="px-2 py-1 rounded-md bg-sky-700 text-white hover:bg-sky-600"
        >
          Analyze
        </button>
      </div>

      {analyzeStatus.type !== "idle" && (
        <div
          className={`mb-3 rounded-md border px-2 py-1 text-[10px] ${analyzeStatus.type === "success"
            ? "border-emerald-700 bg-emerald-900/30 text-emerald-200"
            : analyzeStatus.type === "loading"
              ? "border-sky-700 bg-sky-900/30 text-sky-200"
              : "border-amber-700 bg-amber-900/30 text-amber-200"
            }`}
        >
          {analyzeStatus.message}
        </div>
      )}

      {suggestStatus.type !== "idle" && (
        <div
          className={`mb-3 rounded-md border px-2 py-1 text-[10px] ${suggestStatus.type === "success"
            ? "border-emerald-700 bg-emerald-900/30 text-emerald-200"
            : suggestStatus.type === "loading"
              ? "border-indigo-700 bg-indigo-900/30 text-indigo-200"
              : "border-amber-700 bg-amber-900/30 text-amber-200"
            }`}
        >
          {suggestStatus.message}
        </div>
      )}

      <div className="space-y-3 text-[11px]">
        <div>
          <label className="block text-slate-300 mb-1">Definition</label>
          <textarea
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
            rows={2}
            value={local.definition}
            onChange={(e) => handleChange("definition", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-1">Example</label>
          <textarea
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
            rows={2}
            value={local.example}
            onChange={(e) => handleChange("example", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-1">
            Related Links (comma-separated)
          </label>
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
            value={local.links?.join(", ") || ""}
            onChange={(e) =>
              handleChange(
                "links",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-1">Version History</label>
          <div className="bg-slate-800 border border-slate-700 rounded-md p-2 max-h-24 overflow-auto">
            {(local.history || []).length === 0 && (
              <p className="text-slate-500">No history yet.</p>
            )}
            {(local.history || []).map((h, idx) => (
              <div key={idx} className="text-slate-300 text-[10px]">
                {h.ts} — {h.note}
              </div>
            ))}
          </div>
        </div>

        {aiSummary && (
          <div>
            <label className="block text-slate-300 mb-1">Text Analytics</label>
            <div className="bg-slate-800 border border-slate-700 rounded-md p-2 text-[10px] text-slate-200">
              <p>
                Sentiment: {aiSummary.sentiment?.label || "unknown"}
              </p>
              <p className="mt-1 break-words">
                Key Phrases: {(aiSummary.keyPhrases || []).join(", ") || "None"}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
