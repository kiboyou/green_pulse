"use client";

import Reveal from "@/components/Reveal";
import { toast } from "@/components/Toaster";
import { useCallback, useMemo, useState } from "react";

type TopK = { label: string; prob: number };
type PredictResponse = {
	label?: string;
	confidence?: number;
	model?: string;
	inference_ms?: number;
	timestamp?: string;
	topK?: TopK[];
	[key: string]: unknown;
};

export default function PredictionPage() {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [dragging, setDragging] = useState(false);
	const [result, setResult] = useState<PredictResponse | null>(null);

	// The backend FastAPI root (no trailing /api now since endpoints are defined at root)
	const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

	// Stable example template for forecasting results (includes all fields used by the UI)
	const example = {
		label: "Prévision énergétique",
		confidence: 0.85,
		topK: [
			{ label: "Pic de charge", prob: 0.72 },
			{ label: "Tendance normale", prob: 0.18 },
			{ label: "Anomalie possible", prob: 0.10 },
		],
		forecast: [
			{ timestamp: "2025-10-27T00:00:00Z", value: 123.4 },
			{ timestamp: "2025-10-27T01:00:00Z", value: 130.1 },
			{ timestamp: "2025-10-27T02:00:00Z", value: 127.7 },
		],
		model: "Prophet-v1",
		inference_ms: 142,
		timestamp: "2025-10-27T20:49:00Z",
		metrics: { mae: 9.8, rmse: 15.2 },
	} as const;

	// Format a UTC timestamp into a French-like string without locale/timezone variability
	const formatUTC = (iso: string) => {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, "0");
		const dd = pad(d.getUTCDate());
		const mm = pad(d.getUTCMonth() + 1);
		const yyyy = d.getUTCFullYear();
		const hh = pad(d.getUTCHours());
		const min = pad(d.getUTCMinutes());
		const ss = pad(d.getUTCSeconds());
		return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
	};

	const onFile = useCallback((f: File | null) => {
		setError(null);
		setResult(null);
		setFile(f);
		if (f) {
			// read a small text preview for CSV/JSON files
			f.text()
				.then((t) => setPreview(t.slice(0, 2048)))
				.catch(() => setPreview(null));
		} else {
			setPreview(null);
		}
	}, []);

		const onDrop = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault();
				setDragging(false);
				const f = e.dataTransfer.files?.[0];
				if (!f) return;
				const name = (f.name || "").toLowerCase();
				if (name.endsWith(".csv") || name.endsWith(".json") || f.type.includes("json") || f.type.includes("csv")) onFile(f);
				else if (f) setError("Format non supporté: .csv ou .json requis.");
			},
			[onFile]
		);

	const onDragOver = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			if (!dragging) setDragging(true);
		},
		[dragging]
	);

	const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragging(false);
	}, []);

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const f = e.target.files?.[0] ?? null;
			onFile(f);
		},
		[onFile]
	);

	const disabled = useMemo(() => !file || loading, [file, loading]);

	const copyToClipboard = useCallback(async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast("Copié dans le presse‑papiers", "success");
		} catch (e) {
			toast("Impossible de copier", "error");
		}
	}, []);

	const submit = async () => {
		if (!file) return;
		setLoading(true);
		setError(null);
		setResult(null);
		setUploadProgress(0);
		try {
			const form = new FormData();
			form.append("file", file);
			const resp: any = await new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open("POST", `${apiBase}/forecast`);
				xhr.responseType = "json";
				xhr.upload.onprogress = (evt) => {
					if (evt.lengthComputable) {
						const pct = Math.round((evt.loaded / evt.total) * 100);
						setUploadProgress(pct);
					}
				};
				xhr.onload = () =>
					resolve({
						ok: xhr.status >= 200 && xhr.status < 300,
						json: () => xhr.response,
						status: xhr.status,
						statusText: xhr.statusText,
						text: () => xhr.responseText,
					});
				xhr.onerror = () => reject(new Error("Network error"));
				xhr.send(form);
			});
			if (!resp.ok) {
				const text = await resp.text();
				throw new Error(text || `HTTP ${resp.status}`);
			}
			const data = (await resp.json()) as PredictResponse;
			setResult(data);
			toast("Analyse terminée", "success");
			try {
				setTimeout(() => {
					document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
				}, 50);
			} catch {}
		} catch (e: any) {
			setError(e?.message || "Erreur inconnue pendant l'inférence");
			toast("Échec de l'analyse", "error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<section className="section section-soft-bg">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
							<div className="section-title">
								<span className="tag-accent">Prévision</span>
								<h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">Faire une prévision</h1>
								<div className="title-underline" />
								<p className="mt-3 text-slate-600 max-w-2xl mx-auto text-center">
									Chargez un fichier de séries temporelles (CSV ou JSON) pour obtenir une prévision horaire ou quotidienne.
								</p>
							</div>

					{/* Steps guide */}
					<div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
						<div className="p-4 rounded-xl border border-black/5 bg-white">
							<div className="flex items-start gap-3">
								<span className="icon-badge" aria-hidden>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
								</span>
								<div>
									<div className="text-sm font-semibold">1. Importer les données</div>
												<div className="hint">Glissez-déposez ou choisissez un fichier CSV ou JSON (timestamp,value).</div>
								</div>
							</div>
						</div>
						<div className="p-4 rounded-xl border border-black/5 bg-white">
							<div className="flex items-start gap-3">
								<span className="icon-badge badge-secondary" aria-hidden>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
								</span>
								<div>
									<div className="text-sm font-semibold">2. Lancer l'analyse</div>
									<div className="hint">Cliquez « Lancer l'analyse » et suivez la progression.</div>
								</div>
							</div>
						</div>
						<div className="p-4 rounded-xl border border-black/5 bg-white">
							<div className="flex items-start gap-3">
								<span className="icon-badge badge-neutral" aria-hidden>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								</span>
								<div>
									<div className="text-sm font-semibold">3. Consulter le résultat</div>
									<div className="hint">Les prédictions et métriques s'affichent dans la section « Résultats ».</div>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-8 grid lg:grid-cols-2 gap-8 items-start">
						{/* Upload card */}
						<Reveal>
							<div className="card">
								<div
									className={`dropzone ${dragging ? "dragover" : ""}`}
									onDragOver={onDragOver}
									onDragEnter={onDragOver}
									onDragLeave={onDragLeave}
									onDrop={onDrop}
								>
									<div className="flex items-center justify-between gap-4 flex-wrap">
										<div>
											<div className="font-semibold">Téléversez vos séries temporelles</div>
											<div className="hint">Glissez-déposez ou sélectionnez un fichier CSV ou JSON</div>
										</div>
										<label className="btn-secondary cursor-pointer">
											Choisir un fichier
											<input type="file" accept=".csv,application/json,text/csv" onChange={onChange} />
										</label>
									</div>

									{preview ? (
										<div className="mt-4">
											<div className="preview-pane p-3 text-xs text-slate-700 max-h-52 overflow-auto">{preview}</div>
											{loading && (
												<div className="mt-3">
													<div className="progress">
														<div className="bar" style={{ width: `${uploadProgress}%` }} />
													</div>
													<div className="mt-1 text-xs text-slate-600">Téléversement: {uploadProgress}%</div>
												</div>
											)}
											{error && (
												<p className="mt-3 text-sm" style={{ color: "var(--color-accent)" }}>
													{error}
												</p>
											)}
										</div>
									) : (
										<div className="mt-4 hint">
											Formats acceptés: <strong>.csv</strong>, <strong>.json</strong> — Assurez-vous d'inclure <code>timestamp</code> et <code>value</code>.
										</div>
									)}

									{preview && (
										<div className="card-actions">
											<button className="btn-primary" onClick={submit} disabled={disabled}>
												{loading ? "Prévision en cours..." : "Lancer la prévision"}
											</button>
											<button
												className="btn-secondary"
												onClick={() => {
													onFile(null);
													setResult(null);
													setError(null);
												}}
											>
												Réinitialiser
											</button>
										</div>
									)}
								</div>
							</div>
						</Reveal>

						{/* Right: Guidance & Samples */}
						<Reveal delay={120}>
							<div className="card">
								<div className="font-semibold text-lg">Conseils & Informations</div>
								<ul className="mt-3 space-y-2 text-slate-700">
									<li>• Formats acceptés : <strong>.csv</strong> ou <strong>.json</strong>. Pour les CSV, le format attendu est : <code>timestamp,value</code> (ISO 8601 / UTC recommandé).</li>
									<li>• Fréquence recommandée : horaire ou quotidienne selon votre cas d'usage. Indiquez la fréquence si possible avant l'upload.</li>
									<li>• Prétraitement conseillé : timestamps en UTC, combler ou marquer les valeurs manquantes, normaliser les unités et filtrer les valeurs aberrantes.</li>
									<li>• Longueur minimale : série d'au moins ~48 points (ex. 2 jours en résolution horaire) pour des prévisions stables.</li>
								</ul>

								<div className="mt-6 sample-grid">
									<div className="p-3 rounded-lg border border-black/5 bg-white">
										<div className="text-sm font-semibold">Analyse</div>
										<div className="text-xs text-slate-600 mt-1">Le pipeline pré-traite la série, détecte tendance/saisonnalité, et génère un horizon de prévision adapté.</div>
									</div>
									<div className="p-3 rounded-lg border border-black/5 bg-white">
										<div className="text-sm font-semibold">Résultat</div>
										<div className="text-xs text-slate-600 mt-1">Nous renvoyons la série de prévision (timestamp + valeur), intervalles de confiance si disponibles, et métriques sommaires (MAE, RMSE).</div>
									</div>
									<div className="p-3 rounded-lg border border-black/5 bg-white">
										<div className="text-sm font-semibold">Confiance</div>
										<div className="text-xs text-slate-600 mt-1">Seuil recommandé : vérifier les prévisions dont la confiance est <strong>&ge; 70%</strong>. En-deçà, privilégiez une revue humaine ou un deuxième modèle.</div>
									</div>
								</div>

								<p className="mt-4 text-xs text-slate-500">Remarque : ces prévisions sont un support à la décision opérationnelle — les décisions finales doivent rester humaines et prendre en compte le contexte métier.</p>
							</div>
						</Reveal>
					</div>
				</div>
			</section>

			{/* Results section */}
			<section id="results" className="section">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="section-title">
						<span className="tag-accent">Résultats</span>
						<h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Analyse</h2>
						<div className="title-underline" />
					</div>

					<div className="mt-6">
						{result ? (
											<Reveal>
												<div className="result-card typography-bump">
									<div className="flex items-center justify-between">
										<div className="font-semibold">Sortie du modèle</div>
										{result?.label && <span className="chip-label">{String(result.label)}</span>}
									</div>

									{typeof result?.confidence === "number" && (
										<div className="mt-2">
											<div className="progress" style={{ background: "#e2e8f0" }}>
												<div
													className="bar"
													style={{ width: `${Math.round((result.confidence as number) * 100)}%`, background: "var(--color-primary)" }}
												/>
											</div>
											<div className="mt-1 text-xs text-slate-600">{Math.round((result.confidence as number) * 100)}%</div>
										</div>
									)}

																													{(result?.model || result?.inference_ms || result?.timestamp) && (
																														<div className="mt-4 meta-grid meta-col">
																															{result?.model && (
																																<div className="meta-item meta-item--pro">
																																	<span className="icon-badge" aria-hidden>
																																		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
																																	</span>
																																	<div className="flex-1 min-w-0">
																																		<div className="k">Modèle</div>
																																		<div className="v">{String(result.model)}</div>
																																	</div>
																																	<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(String(result.model))}>
																																		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																																	</button>
																																</div>
																															)}
																															{typeof result?.inference_ms === "number" && (
																																<div className="meta-item meta-item--pro">
																																	<span className="icon-badge" aria-hidden>
																																		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
																																	</span>
																																	<div className="flex-1 min-w-0">
																																		<div className="k">Inférence</div>
																																		<div className="v v-mono">{result.inference_ms} ms</div>
																																	</div>
																																	<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(`${result.inference_ms} ms`)}>
																																		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																																	</button>
																																</div>
																															)}
																															{result?.timestamp && (
																																<div className="meta-item meta-item--pro">
																																	<span className="icon-badge" aria-hidden>
																																		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>
																																	</span>
																																	<div className="flex-1 min-w-0">
																																		<div className="k">Date</div>
																																		<div className="v v-mono">{formatUTC(result.timestamp)}</div>
																																	</div>
																																	<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(formatUTC(result.timestamp!))}>
																																		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																																	</button>
																																</div>
																															)}
																														</div>
																													)}

									<details className="mt-3">
										<summary className="cursor-pointer text-sm text-slate-600">Détails bruts</summary>
										<pre className="mt-2 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
									</details>

									<div className="mt-4 card">
										<div className="font-semibold">Conseils & Explications</div>
										<ul className="note-list text-sm">
											<li>Ce résultat est un indicateur et doit être validé dans son contexte métier.</li>
											<li>Si la confiance est faible (&lt; 70%), fournissez une série plus longue ou nettoyez les données (valeurs manquantes, outliers).</li>
											<li>En cas de doute, réalisez une revue humaine ou comparez avec des données opérationnelles de référence.</li>
										</ul>
									</div>
								</div>
							</Reveal>
						) : (
											<Reveal>
												<div className="result-card typography-bump">
									<div className="flex items-center justify-between">
										<div className="font-semibold">Sortie du modèle (exemple)</div>
										<span className="chip-label">{example.label}</span>
									</div>
									<div className="mt-2">
										<div className="progress" style={{ background: "#e2e8f0" }}>
											<div className="bar" style={{ width: `${Math.round(example.confidence * 100)}%`, background: "var(--color-primary)" }} />
										</div>
										<div className="mt-1 text-xs text-slate-600">Confiance: {Math.round(example.confidence * 100)}%</div>
									</div>

									{/* Top-K + Metadata as tiles */}
									  <div className="mt-4 grid sm:grid-cols-2 gap-4">
										<div>
											<div className="text-sm font-medium">Top‑K</div>
											<div className="mt-2 space-y-2">
												{example.topK.map((k) => (
													<div key={k.label}>
														<div className="flex items-center justify-between text-sm">
															<span>{k.label}</span>
															<span className="text-slate-600">{Math.round(k.prob * 100)}%</span>
														</div>
														<div className="progress" style={{ background: "#eef2f7" }}>
															<div className="bar" style={{ width: `${Math.round(k.prob * 100)}%` }} />
														</div>
													</div>
												))}
											</div>
										</div>
										<div>
											<div className="text-sm font-medium">Métadonnées</div>
																							<div className="mt-2 meta-grid meta-col">
																								<div className="meta-item meta-item--pro">
																									<span className="icon-badge" aria-hidden>
																										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
																									</span>
																									<div className="flex-1 min-w-0">
																										<div className="k">Modèle</div>
																										<div className="v">{String(example.model)}</div>
																									</div>
																									<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(String(example.model))}>
																										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																									</button>
																								</div>
																								<div className="meta-item meta-item--pro">
																									<span className="icon-badge badge-secondary" aria-hidden>
																										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
																									</span>
																									<div className="flex-1 min-w-0">
																										<div className="k">Inférence</div>
																										<div className="v v-mono">{example.inference_ms} ms</div>
																									</div>
																									<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(`${example.inference_ms} ms`)}>
																										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																									</button>
																								</div>
																								<div className="meta-item meta-item--pro">
																									<span className="icon-badge badge-neutral" aria-hidden>
																										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>
																									</span>
																									<div className="flex-1 min-w-0">
																										<div className="k">Date</div>
																										<div className="v v-mono">{formatUTC(example.timestamp)}</div>
																									</div>
																									<button className="icon-ghost" title="Copier" onClick={() => copyToClipboard(formatUTC(example.timestamp))}>
																										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
																									</button>
																								</div>
																							</div>
										</div>
									</div>

									<div className="mt-4 card">
										<div className="font-semibold">Conseils & Explications</div>
										<ul className="note-list text-sm">
											<li>Ce résultat est un indicateur et doit être validé dans son contexte métier.</li>
											<li>Si la confiance est faible (&lt; 70%), fournissez une série plus longue ou nettoyez les données (valeurs manquantes, outliers).</li>
											<li>En cas de doute, réalisez une revue humaine ou comparez avec des données opérationnelles de référence.</li>
										</ul>
									</div>
								</div>
							</Reveal>
						)}
					</div>
				</div>
			</section>
		</>
	);
}
