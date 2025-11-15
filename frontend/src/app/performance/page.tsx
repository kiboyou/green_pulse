"use client";

import Reveal from "@/components/Reveal";
import { Fragment, useEffect, useMemo, useState } from "react";

type MetricsSummary = Record<string, { mae?: number; rmse?: number; mape?: number } & Record<string, number>>;

export default function PerformancePage() {
	const [summary, setSummary] = useState<MetricsSummary | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const res = await fetch(`${apiBase}/metrics/summary`);
				if (!res.ok) throw new Error(await res.text());
				const data = (await res.json()) as MetricsSummary;
				if (!cancelled) setSummary(data);
			} catch (e: any) {
				if (!cancelled) setErr(e?.message || "Impossible de charger les métriques");
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [apiBase]);

	const models = useMemo(() => {
		if (!summary) {
			return [
				{ name: "ARIMA", mae: 12.4, rmse: 18.2, mape: 5.9, latency_ms: 48 },
				{ name: "Prophet", mae: 10.9, rmse: 16.4, mape: 5.1, latency_ms: 62 },
				{ name: "LSTM", mae: 9.8, rmse: 15.2, mape: 4.6, latency_ms: 120 },
			];
		}
		// Convert summary object to rows
		return Object.entries(summary).map(([name, m]) => ({
			name,
			mae: Number(m.mae ?? NaN),
			rmse: Number(m.rmse ?? NaN),
			mape: Number(m.mape ?? NaN),
			latency_ms: (name.toLowerCase() === 'lstm' ? 120 : name.toLowerCase() === 'lightgbm' ? 30 : 60),
		}));
	}, [summary]);

	// Example performance snapshot (static demo data) for forecasts
	const perf = useMemo(
		() => ({
			mae: 9.8,
			rmse: 15.2,
			mape: 4.6,
			latency_ms: 120,
			loss: [0.68, 0.54, 0.43, 0.36, 0.31, 0.28, 0.26, 0.25],
			acc: [0.62, 0.71, 0.78, 0.83, 0.86, 0.88, 0.9, 0.91],
			series: [
				{ t: 0, a: 120, f: 118 },
				{ t: 1, a: 130, f: 127 },
				{ t: 2, a: 125, f: 123 },
				{ t: 3, a: 140, f: 138 },
			],
			// Precision/recall demo points and ROC sample for the PR chart placeholder
			pr: [
				[0, 0.1],
				[0.25, 0.3],
				[0.5, 0.55],
				[0.75, 0.78],
				[1, 0.9],
			],
			roc: [
				[0, 0],
				[0.2, 0.4],
				[0.5, 0.7],
				[0.8, 0.9],
				[1, 1],
			],
			cm: [
				[40, 5],
				[3, 52],
			],
			classes: ["Normal", "Anomalie"],
		}),
		[]
	);

	return (
		<section className="section section-soft-bg">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="section-title">
					<span className="tag-accent">Performance</span>
					<h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">Évaluation du modèle</h1>
					<div className="title-underline" />
					<p className="mt-3 text-slate-600 max-w-2xl mx-auto text-center">
						Aperçu des métriques clés et des courbes: ROC, PR, matrice de confusion, courbes d'entraînement.
					</p>
				</div>

				{/* KPI cards */}
				<div className="mt-8 kpi-grid">
					<Reveal>
						<div className="kpi-card">
							<div className="kpi-label">MAE</div>
							<div className="kpi-value">{perf.mae}</div>
							<div className="kpi-sub">Mean Absolute Error</div>
						</div>
					</Reveal>
					<Reveal delay={80}>
						<div className="kpi-card">
							<div className="kpi-label">RMSE</div>
							<div className="kpi-value">{perf.rmse}</div>
							<div className="kpi-sub">Root Mean Squared Error</div>
						</div>
					</Reveal>
					<Reveal delay={120}>
						<div className="kpi-card">
							<div className="kpi-label">MAPE</div>
							<div className="kpi-value">{perf.mape}%</div>
							<div className="kpi-sub">Mean Absolute Percentage Error</div>
						</div>
					</Reveal>
					<Reveal delay={160}>
						<div className="kpi-card">
							<div className="kpi-label">Latence</div>
							<div className="kpi-value">{perf.latency_ms} ms</div>
							<div className="kpi-sub">Temps d'inférence</div>
						</div>
					</Reveal>
				</div>

				{/* Charts row 1: Forecast vs Actual + Error distribution */}
				<div className="mt-8 grid md:grid-cols-2 gap-6">
					<Reveal>
						<div className="chart-card">
							<div className="chart-title">Prévision vs Réel (exemple)</div>
							<TimeSeriesChart series={perf.series} />
							<div className="legend">
								<span className="dot dot-primary" /> Réel
								<span className="sep" /> Prévision
							</div>
						</div>
					</Reveal>
					<Reveal delay={80}>
						<div className="chart-card">
							<div className="chart-title">Distribution des erreurs (exemple)</div>
							<ErrorHistogram series={perf.series} />
						</div>
					</Reveal>
				</div>

				{/* Charts row 2: Loss/Accuracy + PR */}
				<div className="mt-6 grid md:grid-cols-2 gap-6">
					<Reveal>
						<div className="chart-card">
							<div className="chart-title">Entraînement: Perte & Accuracy</div>
							<TrainCurves loss={perf.loss} acc={perf.acc} />
							<div className="legend">
								<span className="dot dot-secondary" /> Loss
								<span className="sep" />
								<span className="dot dot-primary" /> Accuracy
							</div>
						</div>
					</Reveal>
					<Reveal delay={80}>
						<div className="chart-card">
							<div className="chart-title">Courbe Précision‑Rappel</div>
							  <PrChart points={perf.pr as [number, number][]} />
							<div className="legend">
								<span className="dot dot-primary" /> Modèle
							</div>
						</div>
					</Reveal>
				</div>

				{/* Model comparison table */}
				<Reveal>
					<div className="mt-10 card">
						<h2 className="font-semibold text-lg">Comparaison des modèles</h2>
						{err && <div className="mt-2 text-sm text-red-600">Erreur de chargement: {err}</div>}
						{(() => {
							const best = {
								mae: Math.min(...models.map((m) => m.mae)),
								rmse: Math.min(...models.map((m) => m.rmse)),
								mape: Math.min(...models.map((m) => m.mape)),
							};
							return (
								<div className="mt-4 overflow-x-auto table-premium">
									<table className="w-full text-left text-sm">
										<thead>
											<tr>
												<th>Modèle</th>
												<th>MAE</th>
												<th>RMSE</th>
												<th>MAPE</th>
												<th>Latence</th>
											</tr>
										</thead>
										<tbody>
											{models.map((m) => (
												<tr key={m.name}>
													<td className="name-cell">
														<span className="model-name">{m.name}</span>
													</td>
													<td className={m.mae === best.mae ? "cell-best" : undefined}>
														<div className="metric-chip">{m.mae}</div>
													</td>
													<td className={m.rmse === best.rmse ? "cell-best" : undefined}>
														<div className="metric-chip">{m.rmse}</div>
													</td>
													<td className={m.mape === best.mape ? "cell-best" : undefined}>
														<div className="metric-chip">{m.mape}%</div>
													</td>
													<td>
														<div className="v-mono">{m.latency_ms} ms</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							);
						})()}
						<p className="mt-4 text-xs text-slate-500">Remarque: Connectez cette page à vos métriques réelles (p.ex., export MLflow) lorsque disponibles.</p>
					</div>
				</Reveal>
			</div>
		</section>
	);
}

function svgPath(points: [number, number][], width: number, height: number) {
	const toXY = (p: [number, number]) => {
		const [x, y] = p;
		return [x * width, (1 - y) * height];
	};
	return points
		.map((p, i) => {
			const [x, y] = toXY(p);
			return `${i === 0 ? "M" : "L"}${x},${y}`;
		})
		.join(" ");
}

function RocChart({ points }: { points: [number, number][] }) {
	const width = 520, height = 280, pad = 28;
	const path = svgPath(points, width - pad * 2, height - pad * 2);
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart">
			<g transform={`translate(${pad},${pad})`}>
				<rect x={0} y={0} width={width - pad * 2} height={height - pad * 2} rx={10} ry={10} fill="#fff" stroke="rgba(2,6,23,0.06)" />
				<line x1={0} y1={height - pad * 2} x2={width - pad * 2} y2={0} stroke="#e5e7eb" strokeDasharray="4 4" />
				<path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={3} />
				<Axis width={width - pad * 2} height={height - pad * 2} />
			</g>
		</svg>
	);
}

function PrChart({ points }: { points: [number, number][] }) {
	const width = 520, height = 280, pad = 28;
	const path = svgPath(points, width - pad * 2, height - pad * 2);
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart">
			<g transform={`translate(${pad},${pad})`}>
				<rect x={0} y={0} width={width - pad * 2} height={height - pad * 2} rx={10} ry={10} fill="#fff" stroke="rgba(2,6,23,0.06)" />
				<path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={3} />
				<Axis width={width - pad * 2} height={height - pad * 2} />
			</g>
		</svg>
	);
}

function TrainCurves({ loss, acc }: { loss: number[]; acc: number[] }) {
	const width = 520, height = 280, pad = 28;
	const n = Math.max(loss.length, acc.length);
	const toXY = (i: number, v: number, min: number, max: number) => {
		const x = (i / (n - 1)) * (width - pad * 2);
		const y = (1 - (v - min) / (max - min)) * (height - pad * 2);
		return [x, y];
	};
	const lossMin = Math.min(...loss), lossMax = Math.max(...loss);
	const accMin = Math.min(...acc), accMax = Math.max(...acc);
	const lossPath = loss
		.map((v, i) => {
			const [x, y] = toXY(i, v, lossMin, lossMax);
			return `${i === 0 ? "M" : "L"}${x},${y}`;
		})
		.join(" ");
	const accPath = acc
		.map((v, i) => {
			const [x, y] = toXY(i, v, accMin, accMax);
			return `${i === 0 ? "M" : "L"}${x},${y}`;
		})
		.join(" ");
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart">
			<g transform={`translate(${pad},${pad})`}>
				<rect x={0} y={0} width={width - pad * 2} height={height - pad * 2} rx={10} ry={10} fill="#fff" stroke="rgba(2,6,23,0.06)" />
				<path d={lossPath} fill="none" stroke="var(--color-secondary)" strokeWidth={3} />
				<path d={accPath} fill="none" stroke="var(--color-primary)" strokeWidth={3} />
				<Axis width={width - pad * 2} height={height - pad * 2} />
			</g>
		</svg>
	);
}

function Axis({ width, height }: { width: number; height: number }) {
	return (
		<g>
			<line x1={0} y1={height} x2={width} y2={height} stroke="#e5e7eb" />
			<line x1={0} y1={0} x2={0} y2={height} stroke="#e5e7eb" />
			{[0, 0.5, 1].map((t) => (
				<g key={t}>
					<line x1={t * width} y1={height} x2={t * width} y2={height - 6} stroke="#94a3b8" />
					<text x={t * width} y={height + 16} fontSize={10} fill="#64748b" textAnchor="middle">{t}</text>
					<line x1={0} y1={(1 - t) * height} x2={6} y2={(1 - t) * height} stroke="#94a3b8" />
					<text x={-10} y={(1 - t) * height + 3} fontSize={10} fill="#64748b" textAnchor="end">{t}</text>
				</g>
			))}
		</g>
	);
}

function ConfusionMatrix({ cm, labels }: { cm: number[][]; labels: string[] }) {
	const n = cm.length;
	const total = cm.flat().reduce((a, b) => a + b, 0);
	const max = Math.max(...cm.flat());
	return (
		<div>
			<div className="cm-grid" style={{ gridTemplateColumns: `repeat(${n + 1}, minmax(0, 1fr))` }}>
				<div />
				{labels.map((l) => (
					<div key={`col-${l}`} className="cm-h">Préd: {l}</div>
				))}
				{cm.map((row, i) => (
					<Fragment key={`row-${i}`}>
						<div key={`rowh-${i}`} className="cm-h">Vrai: {labels[i]}</div>
						{row.map((v, j) => {
							const intensity = v / max;
							return (
								<div key={`cell-${i}-${j}`} className="cm-cell" style={{ background: `rgba(0,123,255,${0.08 + intensity * 0.28})` }}>
									<div className="cm-v">{v}</div>
									<div className="cm-p">{((v / total) * 100).toFixed(1)}%</div>
								</div>
							);
						})}
					</Fragment>
				))}
			</div>
			<div className="legend mt-2"><span className="dot dot-primary" /> Intensité = fréquence</div>
		</div>
	);
}

function TimeSeriesChart({ series }: { series: { t: number; a: number; f: number }[] }) {
	const width = 520, height = 260, pad = 28;
	const n = series.length;
	const maxV = Math.max(...series.flatMap((s) => [s.a, s.f]));
	const toXY = (i: number, v: number) => {
		const x = (i / Math.max(1, n - 1)) * (width - pad * 2);
		const y = (1 - v / maxV) * (height - pad * 2);
		return [x, y];
	};
	const pathA = series.map((s, i) => {
		const [x, y] = toXY(i, s.a);
		return `${i === 0 ? 'M' : 'L'}${x},${y}`;
	}).join(' ');
	const pathF = series.map((s, i) => {
		const [x, y] = toXY(i, s.f);
		return `${i === 0 ? 'M' : 'L'}${x},${y}`;
	}).join(' ');
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart">
			<g transform={`translate(${pad},${pad})`}>
				<rect x={0} y={0} width={width - pad * 2} height={height - pad * 2} rx={10} ry={10} fill="#fff" stroke="rgba(2,6,23,0.06)" />
				<path d={pathA} fill="none" stroke="var(--color-primary)" strokeWidth={3} />
				<path d={pathF} fill="none" stroke="var(--color-secondary)" strokeWidth={2} strokeDasharray="6 4" />
				<Axis width={width - pad * 2} height={height - pad * 2} />
			</g>
		</svg>
	);
}

function ErrorHistogram({ series }: { series: { t: number; a: number; f: number }[] }) {
	// compute simple absolute errors for demo
	const errors = series.map((s) => Math.abs(s.a - s.f));
	const maxE = Math.max(...errors, 1);
	// create 6 buckets
	const buckets = new Array(6).fill(0).map(() => 0);
	errors.forEach((e) => {
		const idx = Math.min(buckets.length - 1, Math.floor((e / maxE) * buckets.length));
		buckets[idx]++;
	});
	return (
		<div style={{ display: 'flex', gap: 8, alignItems: 'end', height: 120 }}>
			{buckets.map((c, i) => (
				<div key={i} style={{ flex: 1 }}>
					<div style={{ height: `${(c / Math.max(...buckets)) * 100}%`, background: 'var(--color-primary)', borderRadius: 6 }} />
					<div style={{ textAlign: 'center', fontSize: 12, marginTop: 6 }}>{c}</div>
				</div>
			))}
		</div>
	);
}
