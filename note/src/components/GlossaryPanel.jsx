import React from "react";

export default function GlossaryPanel({ snippets }) {
  const entries = Object.entries(snippets);

  return (
    <aside className="w-72 bg-slate-900 border-l border-slate-800 p-4 hidden lg:flex flex-col">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Glossary</h3>
      <div className="space-y-2 overflow-auto text-[11px]">
        {entries.length === 0 && (
          <p className="text-slate-500 text-xs">
            No glossary entries yet. Save a widget to populate.
          </p>
        )}
        {entries.map(([kw, data]) => (
          <div
            key={kw}
            className="bg-slate-800/70 border border-slate-700 rounded-lg p-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-100">{kw}</span>
              <span className="text-[9px] text-slate-400">
                {data.history?.length || 0} versions
              </span>
            </div>
            {data.definition && (
              <p className="text-slate-300 text-[11px] line-clamp-3">
                {data.definition}
              </p>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
