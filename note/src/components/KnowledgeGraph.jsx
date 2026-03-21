import React from "react";
import { motion } from "framer-motion";

export default function KnowledgeGraph({ snippets }) {
  const keywords = Object.keys(snippets);

  if (keywords.length === 0) {
    return (
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2 text-slate-100">
          Knowledge Graph
        </h2>
        <p className="text-xs text-slate-400">
          As you add snippets, we’ll visualize relationships between concepts
          here.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-3 text-slate-100">
        Knowledge Graph
      </h2>
      <div className="flex flex-wrap gap-3">
        {keywords.map((kw, idx) => (
          <motion.div
            key={kw}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="px-3 py-2 rounded-full bg-brandLightBlue/20 border border-brandLightBlue/40 text-[11px] text-slate-100"
          >
            {kw}
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        (Next step: draw edges based on shared links or co-occurrence in
        documents.)
      </p>
    </section>
  );
}
