import React from "react";

export default function GlossaryPanel({
  snippets,
  isOverlay = false,
  onRequestClose,
}) {
  const entries = Object.entries(snippets);

  return (
    <aside
      className={`w-full xl:w-72 bg-slate-900 border-t xl:border-t-0 xl:border-l border-slate-800 p-4 flex flex-col ${
        isOverlay ? "h-full max-h-none" : "max-h-[40vh] xl:max-h-none"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Glossary</h3>
        {isOverlay && (
          <button
            type="button"
            onClick={onRequestClose}
            className="text-xs text-slate-400 hover:text-slate-100"
            aria-label="Close glossary"
          >
            Close
          </button>
        )}
      </div>
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
