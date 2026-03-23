// App.js
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import KeywordWidget from "./components/KeywordWidget";
import KnowledgeGraph from "./components/KnowledgeGraph";
import GlossaryPanel from "./components/GlossaryPanel";
import DocumentationColumn from "./components/DocumentationColumn";
import { getSnippets } from "./config/api";

const defaultKeywords = [
  "Neural Network",
  "Backpropagation",
  "Learning Rate",
  "Gradient Descent",
  "Activation Function",
  "Transformer",
  "Tokenization",
  "Embedding",
  "Attention Mechanism",
  "Fine-Tuning",
  "Prompt Engineering",
  "Overfitting",
  "Regularization",
  "Batch Normalization",
  "Loss Function",
  "Epoch",
  "Inference",
  "RAG (Retrieval-Augmented Generation)",
  "Vector Database",
  "Latency",
];

function mergeKeywords(existing, additional) {
  const seen = new Set(existing.map((k) => k.toLowerCase()));
  const next = [...existing];
  let changed = false;

  additional.forEach((raw) => {
    const value = (raw || "").trim();
    if (!value) {
      return;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    next.push(value);
    changed = true;
  });

  return changed ? next : existing;
}

function App() {
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileGlossaryOpen, setMobileGlossaryOpen] = useState(false);
  const [snippets, setSnippets] = useState(() => {
    const stored = localStorage.getItem("snippets");
    return stored ? JSON.parse(stored) : {};
  });
  const [keywords, setKeywords] = useState(() =>
    mergeKeywords(defaultKeywords, Object.keys(snippets)),
  );

  const handleAddKeyword = (rawKeyword) => {
    const value = (rawKeyword || "").trim();
    if (!value) {
      return false;
    }

    const existing = keywords.find(
      (keyword) => keyword.toLowerCase() === value.toLowerCase(),
    );

    if (existing) {
      setSelectedKeyword(existing);
      return false;
    }

    setKeywords((prev) => [...prev, value]);
    setSelectedKeyword(value);
    return true;
  };

  useEffect(() => {
    localStorage.setItem("snippets", JSON.stringify(snippets));
  }, [snippets]);

  useEffect(() => {
    setKeywords((prev) => mergeKeywords(prev, Object.keys(snippets)));
  }, [snippets]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const remoteSnippets = await getSnippets();
        if (isMounted && remoteSnippets && Object.keys(remoteSnippets).length) {
          setSnippets(remoteSnippets);
          setKeywords((prev) => mergeKeywords(prev, Object.keys(remoteSnippets)));
        }
      } catch {
        // Keep local storage snippets when API is not available.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Dark blue banner */}
      <header className="bg-brandDarkBlue text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="xl:hidden rounded-md border border-white/20 px-2 py-1 text-xs"
            aria-label="Open keywords"
          >
            Menu
          </button>
          <h1 className="text-base sm:text-lg font-semibold">Knowledge Wave</h1>
        </div>
        <span className="hidden sm:inline text-xs sm:text-sm opacity-80">
          Semantic Notes · Widgets · Graph
        </span>
        <button
          type="button"
          onClick={() => setMobileGlossaryOpen(true)}
          className="xl:hidden rounded-md border border-white/20 px-2 py-1 text-xs"
          aria-label="Open glossary"
        >
          Glossary
        </button>
      </header>

      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close keywords drawer"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              className="absolute left-0 top-0 h-full w-[86vw] max-w-sm bg-slate-900 border-r border-slate-700 p-3"
              initial={{ x: -28 }}
              animate={{ x: 0 }}
              exit={{ x: -28 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Sidebar
                selectedKeyword={selectedKeyword}
                onSelect={(keyword) => {
                  setSelectedKeyword(keyword);
                  setMobileSidebarOpen(false);
                }}
                snippets={snippets}
                keywords={keywords}
                onAddKeyword={handleAddKeyword}
                isOverlay
                onRequestClose={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileGlossaryOpen && (
          <motion.div
            className="fixed inset-0 z-40 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close glossary drawer"
              onClick={() => setMobileGlossaryOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              className="absolute right-0 top-0 h-full w-[86vw] max-w-sm bg-slate-900 border-l border-slate-700 p-3"
              initial={{ x: 28 }}
              animate={{ x: 0 }}
              exit={{ x: 28 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <GlossaryPanel
                snippets={snippets}
                isOverlay
                onRequestClose={() => setMobileGlossaryOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col xl:flex-row overflow-hidden">
        <div className="hidden xl:block">
          <Sidebar
            selectedKeyword={selectedKeyword}
            onSelect={setSelectedKeyword}
            snippets={snippets}
            keywords={keywords}
            onAddKeyword={handleAddKeyword}
          />
        </div>

        <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <div className="flex flex-col xl:flex-row gap-4 min-h-full">
            <DocumentationColumn
              selectedKeyword={selectedKeyword}
              snippets={snippets}
              keywords={keywords}
              onAddKeyword={handleAddKeyword}
              onSelect={setSelectedKeyword}
            />

            <div className="w-full xl:w-[56%] space-y-4">
              <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <h2 className="text-base font-semibold mb-2">Workflow</h2>
                <p className="text-sm text-slate-300">
                  Select a term from Documentation or Sidebar, click AI Suggest,
                  then Add / Save to send the entry to your glossary and graph.
                </p>
              </section>

              <KnowledgeGraph snippets={snippets} />
            </div>
          </div>
        </div>

        <div className="hidden xl:block">
          <GlossaryPanel snippets={snippets} />
        </div>
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
