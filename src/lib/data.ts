export type Severity = "advisory" | "major" | "critical";

export const SEVERITY_LABEL: Record<Severity, string> = {
  advisory: "Advisory",
  major: "Major",
  critical: "Critical",
};

export type Aspect = "door" | "acv" | "corrugation" | "shm";

export const ASPECTS: { id: Aspect; name: string; blurb: string; path: string }[] = [
  { id: "door", name: "Door", blurb: "Resistance signature", path: "/aspects/door" },
  { id: "acv", name: "ACV", blurb: "Refrigerant leaks", path: "/aspects/acv" },
  {
    id: "corrugation",
    name: "Rail Corrugation",
    blurb: "Side I / Side II",
    path: "/aspects/corrugation",
  },
  { id: "shm", name: "SHM", blurb: "Fatigue damage", path: "/aspects/shm" },
];

export type Station = {
  id: string;
  name: string;
  code: string;
  x: number; // 0-100 map space
  y: number;
  status: Severity;
  tracks: string[];
};

export const STATIONS: Station[] = [
  { id: "jur", name: "Jurong East", code: "NS1", x: 14, y: 58, status: "advisory", tracks: ["Track A", "Track B"] },
  { id: "bnv", name: "Buona Vista", code: "EW21", x: 27, y: 70, status: "major", tracks: ["Track A", "Track B", "Track C"] },
  { id: "wdl", name: "Woodlands", code: "NS9", x: 40, y: 12, status: "critical", tracks: ["Track A", "Track B"] },
  { id: "bsh", name: "Bishan", code: "NS17", x: 52, y: 38, status: "major", tracks: ["Track A", "Track B"] },
  { id: "dby", name: "Dhoby Ghaut", code: "NS24", x: 50, y: 62, status: "critical", tracks: ["Track A", "Track B", "Track C"] },
  { id: "cty", name: "City Hall", code: "NS25", x: 55, y: 72, status: "advisory", tracks: ["Track A", "Track B"] },
  { id: "pyl", name: "Paya Lebar", code: "EW8", x: 70, y: 55, status: "major", tracks: ["Track A", "Track B"] },
  { id: "tpn", name: "Tampines", code: "EW2", x: 86, y: 44, status: "critical", tracks: ["Track A", "Track B"] },
  { id: "hbf", name: "HarbourFront", code: "NE1", x: 42, y: 86, status: "advisory", tracks: ["Track A"] },
];

export type Anomaly = {
  id: string;
  aspect: Aspect;
  title: string;
  severity: Severity;
  stationId: string;
  track: string;
  train: string;
  car: number;
  detail: string;
  date: string;
};

export type ProcessedCsvResponse = {
  anomalies?: Partial<Anomaly>[];
  rows?: Partial<Anomaly>[];
};

const fallbackStation = STATIONS[0];

export function normalizeAnomaly(row: Partial<Anomaly>, index: number): Anomaly {
  const aspect = ASPECTS.some((item) => item.id === row.aspect) ? row.aspect as Aspect : "shm";
  const severity = row.severity === "critical" || row.severity === "major" ? row.severity : "advisory";
  const station = stationById(row.stationId ?? "") ?? fallbackStation;
  return {
    id: row.id || `CSV-${String(index + 1).padStart(4, "0")}`,
    aspect,
    title: row.title || `${aspect.toUpperCase()} reading imported from CSV`,
    severity,
    stationId: station.id,
    track: row.track || station.tracks[0],
    train: row.train || "Imported",
    car: Number(row.car) || 1,
    detail: row.detail || "Imported from user CSV; pending engineering review.",
    date: row.date || new Date().toISOString().slice(0, 10),
  };
}

export function parseCsvAnomalies(csv: string): Anomaly[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    const row = Object.fromEntries(headers.map((header, position) => [header, values[position] || ""]));
    return normalizeAnomaly(row as Partial<Anomaly>, index);
  });
}

const seedTitles: Record<Aspect, string[]> = {
  door: ["Abnormal door resistance", "Door close force drift", "Obstruction re-open cycle"],
  acv: ["Refrigerant leak detected", "Compressor pressure drop", "Saloon cooling shortfall"],
  corrugation: ["Side I corrugation", "Side II corrugation", "Short-pitch corrugation"],
  shm: ["Fatigue damage accrual", "Strain cycle exceedance", "Viaduct joint stress"],
};

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry(42);
const severities: Severity[] = ["advisory", "advisory", "major", "major", "critical"];

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.floor(r * list.length) % list.length] as T;
}

export const ANOMALIES: Anomaly[] = Array.from({ length: 96 }, (_, i) => {
  const aspect = pick(ASPECTS, rand()).id;
  const station = pick(STATIONS, rand());
  return {
    id: `AN-${(1000 + i).toString()}`,
    aspect,
    title: pick(seedTitles[aspect], rand()),
    severity: pick(severities, rand()),
    stationId: station.id,
    track: pick(station.tracks, rand()),
    train: `T${(101 + Math.floor(rand() * 40)).toString()}`,
    car: 1 + Math.floor(rand() * 6),
    detail: "Auto-flagged by condition monitoring; pending engineering review.",
    date: `2026-09-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`,
  };
});

export const MONTHS = [
  "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26",
  "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26",
];

export const MONTHLY_DEVIATIONS = MONTHS.map((month, i) => {
  const r = mulberry(i + 7);
  return {
    month,
    advisory: 18 + Math.floor(r() * 22),
    major: 8 + Math.floor(r() * 14),
    critical: 1 + Math.floor(r() * 7),
  };
});

export const DAILY_DEVIATIONS = Array.from({ length: 30 }, (_, i) => {
  const r = mulberry(i + 300);
  return {
    day: String(i + 1).padStart(2, "0"),
    advisory: 1 + Math.floor(r() * 7),
    major: Math.floor(r() * 4),
    critical: Math.floor(r() * 2),
  };
});

export const SHM_SERIES = MONTHS.map((month, i) => ({
  month,
  damage: Number((0.14 + i * 0.062 + (i % 3) * 0.012).toFixed(3)),
}));

export function shmBand(value: number): Severity {
  if (value >= 0.8) return "critical";
  if (value >= 0.5) return "major";
  return "advisory";
}

export function stationById(id: string) {
  return STATIONS.find((s) => s.id === id);
}

export function anomaliesFor(filter: {
  aspect?: Aspect;
  stationId?: string;
  track?: string;
}) {
  return ANOMALIES.filter(
    (a) =>
      (!filter.aspect || a.aspect === filter.aspect) &&
      (!filter.stationId || a.stationId === filter.stationId) &&
      (!filter.track || a.track === filter.track),
  );
}

export function countBySeverity(list: Anomaly[]) {
  return {
    advisory: list.filter((a) => a.severity === "advisory").length,
    major: list.filter((a) => a.severity === "major").length,
    critical: list.filter((a) => a.severity === "critical").length,
    total: list.length,
  };
}