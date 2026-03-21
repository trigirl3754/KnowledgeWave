// App.js
import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import KeywordWidget from "./components/KeywordWidget";
import KnowledgeGraph from "./components/KnowledgeGraph";
import GlossaryPanel from "./components/GlossaryPanel";

function App() {
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [snippets, setSnippets] = useState(() => {
    const stored = localStorage.getItem("snippets");
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    localStorage.setItem("snippets", JSON.stringify(snippets));
  }, [snippets]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Dark blue banner */}
      <header className="bg-brandDarkBlue text-white px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-semibold">Knowledge Wave</h1>
        <span className="text-sm opacity-80">
          Semantic Notes · Widgets · Graph
        </span>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <Sidebar
          selectedKeyword={selectedKeyword}
          onSelect={setSelectedKeyword}
          snippets={snippets}
        />

        <div className="flex-1 relative p-6 space-y-4 overflow-auto">
          {/* Main document placeholder */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h2 className="text-base font-semibold mb-2">Document</h2>
            <p className="text-sm text-slate-300">
              Click a keyword in the sidebar to open its widget. Widgets
              auto-feed the glossary and knowledge graph.
            </p>
          </section>

          <KnowledgeGraph snippets={snippets} />
        </div>

        <GlossaryPanel snippets={snippets} />
      </main>

      {selectedKeyword && (
        <KeywordWidget
          keyword={selectedKeyword}
          snippets={snippets}
          setSnippets={setSnippets}
          onClose={() => setSelectedKeyword(null)}
        />
      )}
    </div>
  );
}

export default App;
