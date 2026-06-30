import { Box, Card, Chip, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { Measurement } from "../../models/models.tsx";

// Lower-is-better signals (high value = worse): attack success, harm, errors, etc.
const LOWER_BETTER = [
    "asr", "attack_success", "attack-success", "harm", "error", "degradation",
    "noise", "failure", "fail_rate", "fail-rate", "leak", "unsafe", "toxicity", "bias",
];
// Higher-is-better signals (high value = better).
const HIGHER_BETTER = [
    "utility", "success", "resistance", "precision", "recall", "faithful",
    "relevanc", "pass_rate", "pass-rate", "security_rate", "benign", "accuracy", "coverage",
];

type Direction = "higher" | "lower" | "neutral";

function direction(name: string, unit?: string | null, metricDirection?: string | null): Direction {
    if (metricDirection) return metricDirection as Direction;
    // Infer direction if not explicitly provided.
    const u = (unit || "").toLowerCase();
    if (u.includes("higher")) return "higher";
    if (u.includes("lower")) return "lower";
    const n = name.toLowerCase();
    if (LOWER_BETTER.some((k) => n.includes(k))) return "lower";
    if (HIGHER_BETTER.some((k) => n.includes(k))) return "higher";
    return "neutral";
}

// Direction-aware colour band for a 0..1 rate. Neutral or out-of-range -> grey.
function toneColor(theme: Theme, score: number, dir: Direction, unit?: string | null): string {
    const grey = theme.palette.text.secondary;
    if (!unit || !unit.includes("%")) return grey; // only colour % metrics
    if (dir === "neutral" || score < 0 || score > 1) return grey;
    const good = theme.palette.success.main;
    const warn = theme.palette.warning.main;
    const bad = theme.palette.error.main;
    const v = dir === "lower" ? 1 - score : score; // normalise so higher v = better
    if (v >= 0.7) return good;
    if (v >= 0.4) return warn;
    return bad;
}

function formatScore(score: number, unit?: string | null): string {
    if (!Number.isFinite(score)) return String(score);
    const u = (unit || "").toLowerCase();
    if (u.includes("%") || u === "pp") return `${(score <= 1 ? score * 100 : score).toFixed(1)}%`;
    if (Math.abs(score) < 1) return score.toFixed(3);
    if (Number.isInteger(score)) return String(score);
    return score.toFixed(2);
}

function humanize(name: string): string {
    return name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bAsr\b/i, "ASR")
        .replace(/\bKde\b/i, "KDE");
}

interface Props {
    measurements: Measurement[];
}

/**
 * Renders the headline KPIs of an evaluation as colour-coded cards.
 * Only single-valued (aggregate) metrics are shown — a metric name that appears
 * exactly once across the measurements. Per-task / per-sample rows (the same
 * metric repeated with different dimensions) stay in the detailed tables below.
 */
export default function KpiScorecard({ measurements }: Props) {
    const theme = useTheme();

    // Aggregate KPI = a metric name that occurs exactly once (no per-row breakdown).
    const counts: Record<string, number> = {};
    for (const m of measurements) counts[m.name] = (counts[m.name] || 0) + 1;
    const kpis = measurements.filter((m) => counts[m.name] === 1 && !m.error);

    if (kpis.length === 0) return null;

    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 1 }}>
            {kpis.map((m) => {
                const dir = direction(m.name, m.unit, m.direction);
                const color = toneColor(theme, m.score, dir, m.unit);
                return (
                    <Card
                        key={m.name}
                        variant="outlined"
                        sx={{ p: 2, minWidth: 180, flex: "1 1 180px", maxWidth: 260, borderTop: `3px solid ${color}` }}
                    >
                        <Tooltip title={m.description || ""} placement="top" arrow>
                            <Typography variant="body2" color="text.secondary" noWrap fontWeight={600}>
                                {humanize(m.name)}
                            </Typography>
                        </Tooltip>
                        <Typography variant="h4" sx={{ color, fontWeight: 700, mt: 0.5, lineHeight: 1.1 }}>
                            {formatScore(m.score, m.unit)}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            {m.unit && <Chip label={m.unit} size="small" variant="outlined" />}
                            {dir !== "neutral" && (
                                <Tooltip title={dir === "higher" ? "Higher is better" : "Lower is better"}>
                                    {dir === "higher"
                                        ? <ArrowUpwardIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                        : <ArrowDownwardIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />}
                                </Tooltip>
                            )}
                        </Stack>
                    </Card>
                );
            })}
        </Box>
    );
}
