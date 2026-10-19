"use client";

import { useState } from "react";

export function ConceptView({
  type,
  url,
  assets,
}: {
  type: "LINK" | "IMAGES" | "PDF" | "VIDEO";
  url: string | null;
  assets: string[];
}) {
  const [i, setI] = useState(0);
  if (type === "LINK" && url) {
    const embed = url.includes("figma.com") ? `https://www.figma.com/embed?embed_host=usabilitycafe&url=${encodeURIComponent(url)}` : url;
    return (
      <div className="flex h-full flex-col gap-2">
        <iframe src={embed} className="min-h-[60vh] w-full flex-1 rounded-[14px] border border-line bg-white" allowFullScreen title="Concept prototype" />
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Open prototype in a new tab</a>
      </div>
    );
  }
  if (type === "IMAGES") {
    return (
      <div className="flex flex-col gap-2" onContextMenu={(e) => e.preventDefault()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets[i]} alt={`Screen ${i + 1}`} className="max-h-[65vh] w-full rounded-[14px] border border-line bg-white object-contain" draggable={false} />
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
          <span className="text-muted">Screen {i + 1} of {assets.length}</span>
          <button type="button" className="btn-ghost" disabled={i >= assets.length - 1} onClick={() => setI(i + 1)}>Next →</button>
        </div>
      </div>
    );
  }
  if (type === "PDF") return <iframe src={`${assets[0]}#toolbar=0`} className="h-[65vh] w-full rounded-[14px] border border-line" title="Concept PDF" />;
  if (type === "VIDEO") return <video src={assets[0]} controls controlsList="nodownload" className="w-full rounded-[14px] bg-black" />;
  return <p className="text-sm text-muted">No concept attached.</p>;
}
