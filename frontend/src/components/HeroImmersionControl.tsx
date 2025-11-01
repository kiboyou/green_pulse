"use client";

import { useEffect, useState } from "react";

type VisualMode = "shader" | "texture";

export default function HeroImmersionControl() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<VisualMode>("texture");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("immersionEnabled");
      if (saved !== null) setEnabled(saved === "true");
      const savedMode = localStorage.getItem("immersionMode");
      if (savedMode === "shader" || savedMode === "texture") setMode(savedMode as VisualMode);
      else if (savedMode === "model") {
        setMode("texture");
        try { localStorage.setItem("immersionMode", "texture"); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("immersionEnabled", String(enabled));
    } catch {}
    window.dispatchEvent(new CustomEvent("immersion-toggle", { detail: { enabled } }));
  }, [enabled]);

  useEffect(() => {
    try {
      localStorage.setItem("immersionMode", mode);
    } catch {}
    window.dispatchEvent(new CustomEvent("immersion-toggle", { detail: { mode } }));
  }, [mode]);

  return (
    <div className="flex flex-wrap items-center gap-4 mt-4" role="group" aria-label="Options d'immersion">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Visuel+</span>
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "" : "bg-slate-300"}`}
          style={{ backgroundColor: enabled ? "var(--color-primary)" : undefined }}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`}
          />
          <span className="sr-only">Basculer Visuel+</span>
        </button>
      </div>
      <label className="text-sm text-slate-600" htmlFor="immersion-mode">Mode</label>
      <select
        id="immersion-mode"
        className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white"
        value={mode}
        onChange={(e) => setMode(e.target.value as VisualMode)}
      >
        <option value="shader">Shader</option>
        <option value="texture">Texture</option>
      </select>
    </div>
  );
}
