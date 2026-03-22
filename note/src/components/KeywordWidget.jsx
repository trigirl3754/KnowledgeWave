// KeywordWidget.js
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  analyzeSnippetText,
  deleteSnippet,
  generateSuggestion,
  saveSnippet,
} from "../config/api";

export default function KeywordWidget({
  keyword,
  snippets,
  setSnippets,
  onClose,
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

  useEffect(() => {
    setLocal(existing);
  }, [keyword, existing]); // when switching keywords

  const handleChange = (field, value) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const updated = {
      ...snippets,
      [keyword]: {
        ...local,
        history: [
          ...(local.history || []),
          { ts: new Date().toISOString(), note: "Updated" },
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
    try {
      const suggestion = await generateSuggestion(keyword, local.example || local.definition || "");
      setLocal((prev) => ({
        ...prev,
        definition: suggestion.definition || prev.definition,
        example: suggestion.example || prev.example,
      }));
    } catch (e) {
      console.warn("AI suggestion failed", e);
    }
  };

  const handleAnalyze = async () => {
    const text = [local.definition, local.example].filter(Boolean).join("\n");
    if (!text.trim()) {
      setAiSummary(null);
      return;
    }

    try {
      const analysis = await analyzeSnippetText(text);
      setAiSummary(analysis);
    } catch (e) {
      console.warn("Text analytics failed", e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed left-64 top-20 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-30"
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

      <div className="flex items-center gap-2 mb-3 text-[11px]">
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
