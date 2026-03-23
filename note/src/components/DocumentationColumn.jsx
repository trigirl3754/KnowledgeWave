import React, { useMemo, useState } from "react";

const defaultDocumentationText = [
    "Modern Transformer systems rely on Attention Mechanism to focus on relevant context. During preprocessing, Tokenization and Embedding transform text into numeric representations.",
    "Training stability is often controlled with Learning Rate schedules, Batch Normalization, and Regularization. Engineers monitor Loss Function values each Epoch to detect Overfitting early.",
    "In production, Inference quality can improve with RAG (Retrieval-Augmented Generation) backed by a Vector Database. Teams then balance output quality with Latency and optimize behavior through Fine-Tuning and Prompt Engineering.",
].join("\n\n");

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function TermButton({ term, selectedKeyword, snippets, onSelect }) {
    const isActive = selectedKeyword === term;
    const hasSnippet = Boolean(snippets[term]);

    return (
        <button
            type="button"
            onClick={() => onSelect(term)}
            className={`mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] transition ${isActive
                ? "border-brandLightBlue bg-brandLightBlue text-white"
                : "border-slate-600 bg-slate-800 text-sky-200 hover:bg-slate-700"
                }`}
            title={hasSnippet ? "Already saved in glossary" : "Click to open widget"}
        >
            {term}
            {hasSnippet && <span className="ml-1 text-[9px] text-emerald-300">saved</span>}
        </button>
    );
}

export default function DocumentationColumn({
    selectedKeyword,
    snippets,
    keywords,
    onAddKeyword,
    onSelect,
}) {
    const [docText, setDocText] = useState(() => {
        const stored = localStorage.getItem("documentationText");
        return stored || defaultDocumentationText;
    });
    const [isEditing, setIsEditing] = useState(false);
    const [draftText, setDraftText] = useState(docText);

    const knownTerms = useMemo(() => {
        const unique = [];
        const seen = new Set();

        (keywords || []).forEach((term) => {
            const normalized = (term || "").trim();
            if (!normalized) {
                return;
            }

            const key = normalized.toLowerCase();
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            unique.push(normalized);
        });

        return unique.sort((a, b) => b.length - a.length);
    }, [keywords]);

    const termLookup = useMemo(() => {
        const map = new Map();
        knownTerms.forEach((term) => {
            map.set(term.toLowerCase(), term);
        });
        return map;
    }, [knownTerms]);

    const termRegex = useMemo(() => {
        if (!knownTerms.length) {
            return null;
        }

        return new RegExp(`(${knownTerms.map(escapeRegExp).join("|")})`, "gi");
    }, [knownTerms]);

    const paragraphs = useMemo(
        () =>
            docText
                .split(/\n\s*\n/g)
                .map((p) => p.trim())
                .filter(Boolean),
        [docText],
    );

    const suggestedTerms = useMemo(() => {
        const known = new Set(knownTerms.map((term) => term.toLowerCase()));
        const stopWords = new Set([
            "modern",
            "training",
            "in",
            "during",
            "teams",
            "engineers",
            "example",
            "project",
            "system",
            "systems",
            "production",
            "context",
        ]);

        const matches =
            docText.match(/\b(?:[A-Z]{2,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) || [];

        const deduped = [];
        const seen = new Set();

        matches.forEach((candidate) => {
            const term = candidate.trim();
            if (!term || term.length < 3) {
                return;
            }

            const normalized = term.toLowerCase();
            if (known.has(normalized) || stopWords.has(normalized) || seen.has(normalized)) {
                return;
            }

            seen.add(normalized);
            deduped.push(term);
        });

        return deduped.slice(0, 12);
    }, [docText, knownTerms]);

    const handleSaveText = () => {
        const nextText = draftText.trim() || defaultDocumentationText;
        setDocText(nextText);
        localStorage.setItem("documentationText", nextText);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setDraftText(docText);
        setIsEditing(false);
    };

    const renderLinkedParagraph = (text, paragraphIndex) => {
        if (!termRegex) {
            return <p key={paragraphIndex}>{text}</p>;
        }

        const parts = text.split(termRegex);

        return (
            <p key={paragraphIndex}>
                {parts.map((part, partIndex) => {
                    const canonical = termLookup.get(part.toLowerCase());
                    if (!canonical) {
                        return (
                            <React.Fragment key={`${paragraphIndex}-${partIndex}`}>
                                {part}
                            </React.Fragment>
                        );
                    }

                    return (
                        <TermButton
                            key={`${paragraphIndex}-${partIndex}-${canonical}`}
                            term={canonical}
                            selectedKeyword={selectedKeyword}
                            snippets={snippets}
                            onSelect={onSelect}
                        />
                    );
                })}
            </p>
        );
    };

    return (
        <section className="w-full xl:w-[44%] bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 overflow-auto">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-100">Documentation</h2>
                {!isEditing ? (
                    <button
                        type="button"
                        onClick={() => {
                            setDraftText(docText);
                            setIsEditing(true);
                        }}
                        className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                    >
                        Edit text
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveText}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-500"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
                Paste or edit paragraphs, then click highlighted known terms to open the
                widget, run AI Suggest, and Add / Save to glossary.
            </p>

            {suggestedTerms.length > 0 && !isEditing && (
                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                    <p className="text-[11px] text-slate-400 mb-2">Detected terms to add</p>
                    <div className="flex flex-wrap gap-2">
                        {suggestedTerms.map((term) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => {
                                    onAddKeyword(term);
                                    onSelect(term);
                                }}
                                className="rounded-full border border-sky-600 bg-sky-900/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-800/60"
                            >
                                + {term}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {isEditing ? (
                <div className="mt-4 space-y-2">
                    <textarea
                        value={draftText}
                        onChange={(event) => setDraftText(event.target.value)}
                        rows={14}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-brandLightBlue focus:outline-none"
                        placeholder="Paste your documentation paragraphs here. Separate paragraphs with blank lines."
                    />
                    <p className="text-[11px] text-slate-500">
                        Known terms in your text are auto-linked from the sidebar keyword
                        list.
                    </p>
                </div>
            ) : (
                <div className="mt-4 space-y-4 text-sm text-slate-300 leading-6 sm:leading-7">
                    {paragraphs.map((paragraph, idx) => renderLinkedParagraph(paragraph, idx))}
                </div>
            )}
        </section>
    );
}
