import { cachedDashboard, fetchDashboard } from '../../lib/dashboardStorage';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {
    BREAKPOINT_COLS,
    DASHBOARD_BREAKPOINTS,
    DASHBOARD_ROW_HEIGHT,
    DASHBOARD_MARGIN,
    DASHBOARD_PADDING,
    DEFAULT_CHART_SIZE,
    DEFAULT_COMMENT_SIZE,
    combineByPlugin,
    getDoneEvaluations,
    getPluginMeasurements,
    nextWidgetSlot,
    type DashboardEval,
    type EvalPluginResults,
    type EvalRow,
    type GridWidget,
} from '../../lib/dashboardCharts';
import { GridLayout, noCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { evalTitle } from '../../lib/sandbox';
import type { Measurement } from '../../models/models';
import { exportDashboardWidgets } from '../../lib/reportDashboard';
import { chartWidgetToViz, renderVisualization } from './dashboardPlot';
import './GridDashboard.css';
import WidgetChartSurface from './WidgetChartSurface';

import type { RenderedDashboardWidget as ReportDashboardWidget } from '../../lib/reportCharts';

export interface DashboardWidgetPickerHandle {
    /** Rasterize every selected chart card to an embeddable image. */
    exportSelected: () => Promise<ReportDashboardWidget[]>;
}

// Keep RGL geometry fixed; only the outer preview scales with the dialog.
const PREVIEW_WIDTH = DASHBOARD_BREAKPOINTS.lg;
const PREVIEW_GRID_CONFIG = {
    cols: BREAKPOINT_COLS.lg,
    rowHeight: DASHBOARD_ROW_HEIGHT,
    margin: DASHBOARD_MARGIN,
    containerPadding: DASHBOARD_PADDING,
};

/**
 * A mini version of the dashboard for the report's generate dialog: the widgets
 * keep their dashboard positions (scaled), and each is a selectable card
 * rendering the exact chart the dashboard shows. Selecting a card means
 * "collect this widget into the report"; the chart is rasterized in the browser
 * (the chart surface + the title + the legend drawn onto a canvas).
 */
const DashboardWidgetPicker = forwardRef<DashboardWidgetPickerHandle, {
    projectPid: string;
    widgets: GridWidget[];
    selected: Set<string>;
    onToggle: (key: string) => void;
}>(function DashboardWidgetPicker({ projectPid, widgets, selected, onToggle }, ref) {
    const [evals, setEvals] = useState<DashboardEval[]>([]);
    const [loaded, setLoaded] = useState(false);
    // per (evaluation, plugin) rows, needed to draw each widget's chart
    const [rows, setRows] = useState<Record<string, EvalRow>>({});
    // becomes true once evaluations and every widget's measurements are loaded,
    // so exportSelected never reads an undrawn chart
    const rowsRef = useRef(rows);
    const evalsRef = useRef(evals);
    evalsRef.current = evals;

    // Measure the viewport after loading mounts it, including scrollbar space.
    const gridRef = useRef<HTMLDivElement | null>(null);
    const [gridWidth, setGridWidth] = useState(0);
    useEffect(() => {
        const el = gridRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            setGridWidth(el?.clientWidth ?? 0);
            return;
        }
        const measure = () => setGridWidth(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [loaded, widgets.length]);

    const [savedLayout, setSavedLayout] = useState(() => cachedDashboard(projectPid)?.layouts.lg ?? []);
    useEffect(() => {
        let cancelled = false;
        void fetchDashboard(projectPid).then((state) => {
            if (!cancelled) setSavedLayout(state.layouts.lg ?? []);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [projectPid]);
    const scale = Math.min(gridWidth / PREVIEW_WIDTH, 1);
    const layout = useMemo(() => {
        const saved = savedLayout;
        const keys = new Set(widgets.map((widget) => widget.key));
        const items = saved.filter((item) => keys.has(item.i)).map((item) => ({ ...item }));
        for (const widget of widgets) {
            if (items.some((item) => item.i === widget.key)) continue;
            items.push({
                i: widget.key,
                ...nextWidgetSlot(items),
                ...(widget.kind === 'text' ? DEFAULT_COMMENT_SIZE : DEFAULT_CHART_SIZE),
            });
        }
        return items;
    }, [savedLayout, widgets]);
    const rowsHigh = layout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);
    const previewHeight = Math.max(0,
        rowsHigh * DASHBOARD_ROW_HEIGHT + (rowsHigh - 1) * DASHBOARD_MARGIN[1]
        + 2 * DASHBOARD_PADDING[1],
    );

    useEffect(() => {
        let cancelled = false;
        getDoneEvaluations(projectPid)
            .then((data) => {
                if (cancelled) return;
                setEvals(data);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [projectPid]);

    // Fetch the (evaluation, plugin) results every widget's chart needs (done
    // evaluations of the project; a widget without evaluations = all of them),
    // reusing the dashboard's session cache so already-seen data resolves
    // instantly and never refetches.
    const fetched = useRef(new Set<string>());

    useEffect(() => {
        if (!loaded) return;
        const wanted: Array<[string, string, string, string]> = []; // plugin, eval, epPid, evalLabel
        widgets.forEach((widget) => {
            const plugin = widget.plugin;
            if (!plugin || widget.kind === 'text') return;
            const es = widget.evaluations?.length
                ? evals.filter((e) => widget.evaluations!.includes(e.pid))
                : evals;
            es.forEach((e) => {
                const ep = (e.evaluation_plugins ?? []).find((p) => p.name === plugin);
                if (ep) wanted.push([plugin, e.pid, ep.pid, evalTitle(e)]);
            });
        });

        const starter = async () => {
            const promises = wanted.map(async ([plugin, evalUuid, epPid, evalLabel]) => {
                const key = `${evalUuid}|${plugin}`;
                if (fetched.current.has(key)) return;
                fetched.current.add(key);
                const res = await getPluginMeasurements(epPid, evalUuid);
                rowsRef.current = { ...rowsRef.current,
                    [key]: makeRow(plugin, evalUuid, evalLabel, epPid, res) };
                setRows(rowsRef.current);
            });
            await Promise.allSettled(promises);
        };
        void starter();
    }, [loaded, widgets, evals]);

    // The combined measurements of one chart widget (<-- its plugin + evals).
    const dataFor = (widget: GridWidget): EvalPluginResults => {
        const combined = combineByPlugin(
            (widget.evaluations?.length ? widget.evaluations.map((e) => rowsRef.current[`${e}|${widget.plugin}`])
                : evalsRef.current.map((e) => rowsRef.current[`${e.pid}|${widget.plugin}`]))
                .filter((r): r is EvalRow => Boolean(r)),
        );
        return { measurements: combined.get(widget.plugin ?? '') ?? [] };
    };

    useImperativeHandle(ref, () => ({
        async exportSelected(): Promise<ReportDashboardWidget[]> {
            return exportDashboardWidgets(projectPid, widgets, selected);
        },
    }));

    if (!loaded) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">Loading dashboard widgets…</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', overflowX: 'hidden' }}>
            {widgets.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                    No dashboard widgets yet — add charts and comments on the Dashboard page.
                </Typography>
            )}
            {widgets.length > 0 && (
                <Box ref={gridRef} sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
                    <Box sx={{ height: previewHeight * scale, position: 'relative', overflow: 'hidden' }}>
                        <Box sx={{
                            position: 'absolute',
                            width: PREVIEW_WIDTH,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                        }}>
                            <GridLayout
                                width={PREVIEW_WIDTH}
                                layout={layout}
                                gridConfig={PREVIEW_GRID_CONFIG}
                                compactor={noCompactor}
                                dragConfig={{ enabled: false }}
                                resizeConfig={{ enabled: false, handles: [] }}
                            >
                                {widgets.map((widget) => {
                                    const picked = selected.has(widget.key);
                                    const data = dataFor(widget).measurements ?? [];
                                    return (
                                        <div key={widget.key}>
                                            <Paper
                                                variant="outlined"
                                                className="grid-widget"
                                                role="checkbox"
                                                tabIndex={0}
                                                aria-checked={picked}
                                                aria-label={widgetTitle(widget)}
                                                onClick={() => onToggle(widget.key)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onToggle(widget.key);
                                                    }
                                                }}
                                                sx={{
                                                    cursor: 'pointer',
                                                    boxShadow: (theme) => picked
                                                        ? `inset 0 0 0 2px ${theme.palette.primary.main}` : 'none',
                                                    '&:focus-visible': {
                                                        outline: '2px solid',
                                                        outlineColor: 'primary.main',
                                                        outlineOffset: -2,
                                                    },
                                                }}
                                            >
                                                <Box className="grid-widget-header" sx={{ cursor: 'pointer' }}>
                                                    <Typography className="grid-widget-header-title">
                                                        {widgetTitle(widget)}
                                                    </Typography>
                                                    {picked && (
                                                        <Icon fontSize="small" sx={{ color: 'primary.main' }}>check_circle</Icon>
                                                    )}
                                                </Box>
                                                {widget.kind === 'text' ? (
                                                    <Box className="grid-widget-body">
                                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                            {widget.text && widget.text.trim() ? widget.text : 'Empty note'}
                                                        </Typography>
                                                    </Box>
                                                ) : data.length === 0 ? (
                                                    <Box className="grid-widget-body">
                                                        <Alert severity="info" sx={{ my: 1, py: 0 }}>
                                                            No measurements for this plugin in its evaluations.
                                                        </Alert>
                                                    </Box>
                                                ) : (
                                                    <ChartPreview widget={widget} data={data} />
                                                )}
                                                {widget.comment && widget.kind !== 'text' && (
                                                    <Box
                                                        sx={{
                                                            borderTop: 1,
                                                            borderColor: 'divider',
                                                            px: 1,
                                                            py: 0.5,
                                                            display: 'flex',
                                                            gap: 0.5,
                                                            alignItems: 'center',
                                                            color: 'text.secondary',
                                                        }}
                                                    >
                                                        <Icon fontSize="inherit" sx={{ fontSize: 14 }}>comment</Icon>
                                                        <Typography variant="caption">{widget.comment}</Typography>
                                                    </Box>
                                                )}
                                            </Paper>
                                        </div>
                                    );
                                })}
                            </GridLayout>
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
});

function widgetTitle(widget: GridWidget): string {
    if (widget.kind === 'text') return 'Comment';
    return widget.title || `${widget.plugin ?? 'Chart'} · ${widget.chartType ?? 'chart'}`;
}

/** A widget's chart preview: its body is the flex-constrained card body (the
 *  measured height is stable — no resize feedback loop) so the preview chart
 *  fills it without an empty band at the bottom. Purely decorative: the report
 *  image comes from a fresh full-size render (renderChartImage). */
function ChartPreview({ widget, data }: { widget: GridWidget; data: Measurement[] }) {
    return <WidgetChartSurface>{(height) => renderVisualization(
        data, chartWidgetToViz(widget), widget.labelOverrides, widget.labelOrder, height, true,
    )}</WidgetChartSurface>;
}


function makeRow(
    plugin: string, evalUuid: string, evalLabel: string, epPid: string, res: EvalPluginResults,
): EvalRow {
    return { index: 0, evalUuid, evalLabel, pluginName: plugin,
        evalPluginPid: epPid, measurements: res.measurements ?? [],
        metric_visualizations: res.metric_visualizations };
}

export default DashboardWidgetPicker;
