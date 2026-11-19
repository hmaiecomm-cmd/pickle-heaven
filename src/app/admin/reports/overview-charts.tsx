"use client";

import * as React from "react";
import {
  BarChart3,
  ChevronDown,
  Grid3x3,
  LineChart as LineIcon,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHART_META,
  type ChartKey,
  type CourtState,
  type OverviewData,
} from "./overview-types";
import { chartRead, COURT_STATE_LABEL, money } from "./overview-insights";

export const CHART_ICON: Record<ChartKey, typeof LineIcon> = {
  usage: LineIcon,
  courts: MapPin,
  heatmap: Grid3x3,
  revenue: BarChart3,
};
const CHART_ORDER: ChartKey[] = ["usage", "courts", "heatmap", "revenue"];

function Empty({ text = "尚無足夠資料" }: { text?: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d7dfcf] bg-[#fafcf7] text-sm text-muted">
      {text}
    </div>
  );
}

/* ─────────── 使用率趨勢：折線 ─────────── */

function UsageTrend({
  data,
  change,
}: {
  data: OverviewData["usage"];
  change: number | null;
}) {
  if (!data.some((p) => p.value > 0)) return <Empty />;
  const W = 640,
    H = 240,
    L = 40,
    R = 12,
    T = 16,
    B = 30;
  const n = data.length;
  const x = (i: number) =>
    L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((100 - Math.min(100, v)) / 100) * (H - T - B);
  const path = data
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`)
    .join(" ");
  const avg = Math.round((data.reduce((s, p) => s + p.value, 0) / n) * 10) / 10;
  const every = Math.max(1, Math.ceil(n / 8));
  const showValues = n <= 14;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          平均使用率 <b className="text-sm text-[#1f2a22]">{avg}%</b>
        </span>
        <span>
          較前期{" "}
          <b
            className={cn(
              "text-sm",
              change === null
                ? "text-muted"
                : change >= 0
                  ? "text-emerald-700"
                  : "text-red-700",
            )}
          >
            {change === null
              ? "無可比較資料"
              : `${change >= 0 ? "▲ 上升" : "▼ 下降"} ${Math.abs(change)} 個百分點`}
          </b>
        </span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label={`使用率趨勢，平均 ${avg}%，共 ${n} 個資料點`}
        >
          {[0, 20, 40, 60, 80, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eef1e9" />
              <text
                x={L - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#7b8579"
              >
                {v}%
              </text>
            </g>
          ))}
          <line
            x1={L}
            x2={W - R}
            y1={y(avg)}
            y2={y(avg)}
            stroke="#7cb342"
            strokeDasharray="4 4"
          />
          <path
            d={`${path} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`}
            fill="#7cb342"
            opacity="0.14"
          />
          <path
            d={path}
            fill="none"
            stroke="#2f7d3b"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {data.map((p, i) => (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="4"
                fill="#fff"
                stroke="#2f7d3b"
                strokeWidth="2.5"
              >
                <title>{`${p.label}：${p.value}%`}</title>
              </circle>
              {showValues && (
                <text
                  x={x(i)}
                  y={y(p.value) - 9}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#1f4d34"
                >
                  {p.value}%
                </text>
              )}
              {i % every === 0 && (
                <text
                  x={x(i)}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#7b8579"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        虛線為期間平均；將游標移到資料點可看數值。
      </p>
    </div>
  );
}

/* ─────────── 場地圖：每面場地一張卡 ─────────── */

const COURT_TONE: Record<CourtState, string> = {
  IN_USE: "bg-emerald-50 ring-emerald-200 text-emerald-900",
  AVAILABLE: "bg-sky-50 ring-sky-200 text-sky-900",
  MAINTENANCE: "bg-amber-50 ring-amber-200 text-amber-900",
  SUSPENDED: "bg-red-50 ring-red-200 text-red-900",
};
const COURT_DOT: Record<CourtState, string> = {
  IN_USE: "bg-emerald-500",
  AVAILABLE: "bg-sky-500",
  MAINTENANCE: "bg-amber-500",
  SUSPENDED: "bg-red-500",
};

function CourtMap({ courts }: { courts: OverviewData["courts"] }) {
  if (!courts.length) return <Empty text="尚未建立場地" />;
  return (
    <div>
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
        aria-label="場地目前狀態"
      >
        {courts.map((c) => (
          <li
            key={c.id}
            className={cn("rounded-xl p-3 ring-1", COURT_TONE[c.status])}
          >
            <p className="text-sm font-bold">{c.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", COURT_DOT[c.status])}
                aria-hidden
              />
              {COURT_STATE_LABEL[c.status]}
            </p>
            <p className="mt-2 text-[11px] opacity-80">
              期間使用率 {c.rate === null ? "—" : `${c.rate}%`}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
        {(Object.keys(COURT_STATE_LABEL) as CourtState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span
              className={cn("h-2 w-2 rounded-full", COURT_DOT[s])}
              aria-hidden
            />
            {COURT_STATE_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────── 使用熱力圖：星期 × 時段 ─────────── */

const heat = (v: number) => {
  if (v <= 0) return "#f3f4f6";
  if (v < 20) return "#3b82f6";
  if (v < 40) return "#60a5fa";
  if (v < 60) return "#fbbf24";
  if (v < 80) return "#f97316";
  return "#dc2626";
};

function Heatmap({ data }: { data: OverviewData["heatmap"] }) {
  if (!data.rows.some((r) => r.values.some((v) => v > 0))) return <Empty />;
  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain pb-1">
        <table
          className="w-full min-w-[560px] border-separate border-spacing-1 text-[11px]"
          aria-label="使用熱力圖：列為星期、欄為時段，數值為使用率"
        >
          <thead>
            <tr>
              <th className="w-10" />
              {data.hours.map((h, i) => (
                <th key={h} scope="col" className="font-normal text-muted">
                  {i % 2 === 0 ? h : ""}
                  <span className="sr-only">{i % 2 ? h : ""}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="pr-1 text-left font-semibold text-[#3d4a40]"
                >
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className="h-8 rounded-md cursor-pointer transition-opacity hover:opacity-80"
                    style={{ background: heat(v) }}
                    title={`${row.label} ${data.hours[i]}${v > 0 ? `：${v}%` : ""}`}
                  >
                    <span className="sr-only">{`${row.label} ${data.hours[i]}${v > 0 ? ` 使用率 ${v}%` : ""}`}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-[#f8fafc] p-3 ring-1 ring-[#e2e8f0]">
        <p className="mb-2 text-xs font-semibold text-[#1f2a22]">使用率色階</p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted">低</span>
          <div className="flex gap-0.5">
            {[
              { v: 0, label: "0%" },
              { v: 10, label: "10%" },
              { v: 30, label: "30%" },
              { v: 50, label: "50%" },
              { v: 70, label: "70%" },
              { v: 90, label: "90%" },
            ].map(({ v, label }) => (
              <div key={v} className="flex flex-col items-center gap-1">
                <span
                  className="h-6 w-5 rounded-sm border border-[#e5e7eb]"
                  style={{ background: heat(v) }}
                  aria-hidden
                />
                <span className="w-5 text-center text-[10px] text-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <span className="text-muted">高</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        • 藍色表示低使用率、紅色表示高使用率
        <br />
        • 灰色表示無資料
        <br />• 將游標移到格子或點擊可看詳細資訊
      </p>
    </div>
  );
}

/* ─────────── 營收記錄：堆疊長條 ─────────── */

const REV_COLORS = {
  court: "#2f7d3b",
  event: "#7cb342",
  topup: "#b9dea0",
} as const;
const REV_LABEL = {
  court: "場地預約",
  event: "活動收入",
  topup: "會員方案（儲值）",
} as const;

function RevenueChart({
  revenue,
  change,
}: {
  revenue: OverviewData["revenue"];
  change: number | null;
}) {
  const total = revenue.sources.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return <Empty text="此期間尚無營收資料" />;
  const W = 640,
    H = 240,
    L = 56,
    R = 8,
    T = 12,
    B = 30;
  const n = revenue.series.length;
  const max = Math.max(1, ...revenue.series.map((s) => s.total));
  const step = (W - L - R) / n;
  const bw = Math.max(4, Math.min(36, step * 0.6));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const every = Math.max(1, Math.ceil(n / 8));
  const main = [...revenue.sources].sort((a, b) => b.amount - a.amount)[0];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          期間總營收 <b className="text-sm text-[#1f2a22]">{money(total)}</b>
        </span>
        <span>
          較前期{" "}
          <b
            className={cn(
              "text-sm",
              change === null
                ? "text-muted"
                : change >= 0
                  ? "text-emerald-700"
                  : "text-red-700",
            )}
          >
            {change === null
              ? "無可比較資料"
              : `${change >= 0 ? "▲ 成長" : "▼ 減少"} ${Math.abs(change)}%`}
          </b>
        </span>
        <span>
          主要來源 <b className="text-sm text-[#1f2a22]">{main.label}</b>
        </span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label={`營收記錄，期間總營收 ${money(total)}`}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={L}
                x2={W - R}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="#eef1e9"
              />
              <text
                x={L - 6}
                y={y(max * f) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#7b8579"
              >
                {max * f >= 10000
                  ? `${Math.round((max * f) / 1000)}k`
                  : Math.round(max * f)}
              </text>
            </g>
          ))}
          {revenue.series.map((s, i) => {
            const cx = L + step * i + step / 2;
            let acc = 0;
            return (
              <g key={i}>
                {(["court", "event", "topup"] as const).map((k) => {
                  const v = s[k];
                  if (v <= 0) return null;
                  const y1 = y(acc + v);
                  const h = y(acc) - y1;
                  acc += v;
                  return (
                    <rect
                      key={k}
                      x={cx - bw / 2}
                      y={y1}
                      width={bw}
                      height={Math.max(1, h)}
                      rx="2"
                      fill={REV_COLORS[k]}
                    >
                      <title>{`${s.label} ${REV_LABEL[k]}：${money(v)}`}</title>
                    </rect>
                  );
                })}
                {i % every === 0 && (
                  <text
                    x={cx}
                    y={H - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#7b8579"
                  >
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {revenue.sources.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-2 rounded-lg bg-[#fafcf7] px-2 py-1.5"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{
                  background:
                    (REV_COLORS as Record<string, string>)[s.key] ?? "#d4d4d8",
                }}
                aria-hidden
              />
              {s.label}
            </span>
            <span className="font-semibold tabular">
              {s.available ? money(s.amount) : "尚未接入"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────── 圖表面板：選擇圖表 ＋ 單一圖表 ＋ 簡易判讀 ─────────── */

export function ChartPanel({
  data,
  chart,
  onChart,
  extra,
  idPrefix,
}: {
  data: OverviewData;
  chart: ChartKey;
  onChart: (c: ChartKey) => void;
  extra?: React.ReactNode;
  idPrefix: string;
}) {
  const meta = CHART_META[chart];
  const Icon = CHART_ICON[chart];
  const selectId = `${idPrefix}-chart-select`;
  return (
    <section
      aria-labelledby={`${idPrefix}-chart-title`}
      className="rounded-2xl border border-[#e3e8dc] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)] sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2
            id={`${idPrefix}-chart-title`}
            className="flex items-center gap-2 text-lg font-bold text-[#1f2a22]"
          >
            <Icon className="h-5 w-5 text-[#2f7d3b]" aria-hidden />
            {meta.title}
            <span className="hidden text-sm font-normal text-muted sm:inline">
              ｜{meta.desc}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-muted sm:hidden">{meta.desc}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {extra}
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-[#3d4a40] sm:shrink-0"
          >
            選擇圖表
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={chart}
              onChange={(e) => onChart(e.target.value as ChartKey)}
              className="h-11 w-full appearance-none rounded-xl border border-[#d7dfcf] bg-white pl-3 pr-9 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb342] sm:w-48"
            >
              {CHART_ORDER.map((k) => (
                <option key={k} value={k}>
                  {CHART_META[k].title}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {chart === "usage" && (
        <UsageTrend data={data.usage} change={data.kpi.utilization.change} />
      )}
      {chart === "courts" && <CourtMap courts={data.courts} />}
      {chart === "heatmap" && <Heatmap data={data.heatmap} />}
      {chart === "revenue" && (
        <RevenueChart revenue={data.revenue} change={data.kpi.revenue.change} />
      )}

      <p
        className="mt-4 rounded-xl bg-[#f6f9f2] px-3 py-2 text-sm text-[#2c3a2e]"
        aria-live="polite"
      >
        <span className="font-semibold text-[#1f4d34]">圖表判讀：</span>
        {chartRead(chart, data)}
      </p>
    </section>
  );
}
