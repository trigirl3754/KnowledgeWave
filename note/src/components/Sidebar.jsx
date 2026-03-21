// Sidebar.js
import React from "react";

const defaultKeywords = [
  "Neural Network",
  "Backpropagation",
  "Learning Rate",
  "Gradient Descent",
  "Activation Function",
];

export default function Sidebar({ selectedKeyword, onSelect, snippets }) {
  const keywords = defaultKeywords;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Keywords</h3>
      <div className="space-y-1 flex-1 overflow-auto">
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
                <span>{kw}</span>
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
