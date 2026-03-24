// Sidebar.js
import React, { useState } from "react";

export default function Sidebar({
  selectedKeyword,
  onSelect,
  snippets,
  keywords,
  onAddKeyword,
  isOverlay = false,
  onRequestClose,
}) {
  const [newKeyword, setNewKeyword] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const added = onAddKeyword(newKeyword);
    if (added) {
      setNewKeyword("");
      return;
    }

    if (newKeyword.trim()) {
      setNewKeyword("");
    }
  };

  return (
    <aside
      className={`w-full xl:w-64 bg-slate-900 border-b xl:border-b-0 xl:border-r border-slate-800 p-4 flex flex-col ${
        isOverlay ? "h-full max-h-none" : "max-h-[45vh] xl:max-h-none"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Keywords</h3>
        {isOverlay && (
          <button
            type="button"
            onClick={onRequestClose}
            className="text-xs text-slate-400 hover:text-slate-100"
            aria-label="Close keywords"
          >
            Close
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="mb-3 space-y-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Add new word"
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-brandLightBlue focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-brandLightBlue px-2 py-2 text-xs font-medium text-white hover:bg-blue-600"
        >
          Add keyword
        </button>
      </form>
      <div className="space-y-1 flex-1 overflow-auto pr-1">
        {keywords.map((kw) => {
          const isActive = kw === selectedKeyword;
          const hasSnippet = Boolean(snippets[kw]);
          return (
            <button
              key={kw}
              onClick={() => onSelect(kw)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition
                ${isActive ? "bg-brandLightBlue text-white" : "bg-slate-800/70 text-slate-200 hover:bg-slate-700"}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="truncate pr-2">{kw}</span>
                {hasSnippet && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    linked
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
