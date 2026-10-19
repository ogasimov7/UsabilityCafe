"use client";

export function PrintButton() {
  return <button className="btn-primary no-print" onClick={() => window.print()}>Export PDF</button>;
}
