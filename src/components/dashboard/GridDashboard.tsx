import { fetchDashboard, flushDashboardSave, scheduleDashboardSave } from '../../lib/dashboardStorage';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button, { type ButtonProps } from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import CloseRounded from '@mui/icons-material/CloseRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import Addchart from '@mui/icons-material/Addchart';
import CommentRounded from '@mui/icons-material/CommentRounded';
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import AppDialog from '../AppDialog';
import './GridDashboard.css';
import { Responsive, noCompactor, useContainerWidth, type ResponsiveLayouts } from 'react-grid-layout';
import { useDashboardDrag } from './useDashboardDrag';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import type { Measurement, MetricVisualization } from '../../models/models';
import { evalTitle } from '../../lib/sandbox';
import {
    BREAKPOINT_COLS,
    DASHBOARD_BREAKPOINTS,
    DASHBOARD_ROW_HEIGHT,
    DASHBOARD_MARGIN,
    DASHBOARD_PADDING,
    DEFAULT_CHART_SIZE,
    DEFAULT_COMMENT_SIZE,
    clearSessionCache,
    combineByPlugin,
    getCachedDoneEvaluations,
    getCachedPluginMeasurements,
    getPluginMeasurements,
    loadGridState,
    nextWidgetSlot,
    refreshDoneEvaluations,
    scaleLayout,
    splitFacetWidgets,
    uid,
    type DashboardEval,
    type ChartFields,
    type DashboardEvalPlugin,
    type EvalPluginResults,
    type EvalRow,
    type GridItemLayout,
    type GridWidget,
} from '../../lib/dashboardCharts';
import { chartWidgetToViz, renderVisualization } from './dashboardPlot';
import ChartBuilderDialog from './ChartBuilderDialog';
import WidgetChartSurface from './WidgetChartSurface';

// Icon-only toolbar below this measured dashboard width.
const TOOLBAR_COMPACT_WIDTH = 600;
const toolbarButtonSx = { textTransform: 'none', borderRadius: '10px', fontWeight: 600 };
const toolbarIconButtonSx = { minWidth: 0, px: 1.5 };

/** Toolbar action: label when there is room, icon + tooltip when compact. */
function ToolbarButton({
    compact,
    label,
    icon,
    muted,
    ...props
}: ButtonProps & { compact: boolean; label: string; icon: ReactNode; muted?: boolean }) {
    return (
        <Tooltip title={compact ? label : ''}>
            <Button
                {...props}
                aria-label={label}
                startIcon={compact ? undefined : icon}
                sx={{
                    ...toolbarButtonSx,
                    ...(compact ? toolbarIconButtonSx : null),
                    ...(muted
                        ? { bgcolor: 'grey.200', color: 'text.secondary', '&:hover': { bgcolor: 'grey.300' } }
                        : null),
                }}
            >
                {compact ? icon : label}
            </Button>
        </Tooltip>
    );
}

// Compare the fields the builder uses, including plugin data that can arrive later.
function evaluationSignature(list: DashboardEval[]) {
    return JSON.stringify([...list].sort((a, b) => a.pid.localeCompare(b.pid)).map((e) => ({
        pid: e.pid, status: e.status, name: e.name, created_at: e.created_at,
        plugins: e.evaluation_plugins,
    })));
}

export default function GridDashboard({ projectUUID }: { projectUUID: string }) {
    // Seed from the session cache so returning to the dashboard shows data
    // immediately (no spinner / refetch — the dashboard stays "alive").
    const [evals, setEvals] = useState<DashboardEval[]>(() => getCachedDoneEvaluations(projectUUID) ?? []);
    const [evalsLoaded, setEvalsLoaded] = useState<boolean>(() => getCachedDoneEvaluations(projectUUID) !== undefined);
    const [evalsError, setEvalsError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    // Seed synchronously from localStorage so returning to the dashboard paints
    // the saved grid immediately instead of flashing an empty state.
    const [widgets, setWidgets] = useState<GridWidget[]>([]);
    const [layouts, setLayouts] = useState<Record<string, GridItemLayout[] | undefined>>(
        () => ({}),
    );
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderExited, setBuilderExited] = useState(true);
    const [scrollTarget, setScrollTarget] = useState<{ project: string; key: string } | null>(null);
    const widgetGridRef = useRef<HTMLDivElement>(null);
    const [builderLoading, setBuilderLoading] = useState(false);
    const activeProject = useRef(projectUUID);
    activeProject.current = projectUUID;
    const builderRequest = useRef(0);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [textEditingKey, setTextEditingKey] = useState<string | null>(null);
    const [clearOpen, setClearOpen] = useState(false);
    const [dashboardReady, setDashboardReady] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const { dragging, onDragStart, onDragStop } = useDashboardDrag(projectUUID, canEdit);
    const [dashboardError, setDashboardError] = useState('');
    const [canImport, setCanImport] = useState(false);
    const revisionRef = useRef(0);
    const savedRef = useRef('');
    const hydratedProject = useRef<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        hydratedProject.current = null;
        setScrollTarget(null);
        setBuilderExited(true);
        setDashboardReady(false);
        void fetchDashboard(projectUUID).then((state) => {
            if (cancelled) return;
            const value = { widgets: state.widgets, layouts: state.layouts };
            savedRef.current = JSON.stringify(value);
            revisionRef.current = state.revision;
            hydratedProject.current = projectUUID;
            setWidgets(state.widgets);
            setLayouts(state.layouts);
            setCanEdit(state.can_edit);
            setCanImport(state.revision === 0 && Boolean(loadGridState(projectUUID)));
            setDashboardReady(true);
            setDashboardError('');
        }).catch((error: Error) => { if (!cancelled) setDashboardError(error.message); });
        return () => {
            cancelled = true;
            void flushDashboardSave(projectUUID).catch(() => {});
        };
    }, [projectUUID]);
    const { containerRef, width, mounted } = useContainerWidth();
    const gridRef = containerRef as unknown as Ref<HTMLDivElement>;
    const compactToolbar = mounted && width > 0 && width < TOOLBAR_COMPACT_WIDTH;

    // per-(evaluation, plugin) rows, accumulated on demand (cached per session)
    const [rowMap, setRowMap] = useState<Record<string, EvalRow>>({});
    const [extraPairs, setExtraPairs] = useState<Set<string>>(new Set());

    // Poll for finished evaluations while the dashboard is open so newly
    // completed runs appear automatically (~15s, plus on tab focus). The evals
    // state is only replaced when evaluation or plugin metadata changes, and
    // existing chart rows are never wiped, so charts do not reload spuriously.
    // Manual Refresh is the only full reload.
    useEffect(() => {
        let cancelled = false;
        let inFlight = false;
        const cached = getCachedDoneEvaluations(projectUUID);
        setEvals(cached ?? []);
        setEvalsLoaded(cached !== undefined);
        setEvalsError(null);

        const applyIfChanged = (fresh: DashboardEval[]) => {
            if (cancelled) return;
            setEvals((prev) => (evaluationSignature(prev) === evaluationSignature(fresh) ? prev : fresh));
            setEvalsLoaded(true);
            setEvalsError(null);
        };

        const poll = async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                applyIfChanged(await refreshDoneEvaluations(projectUUID));
            } catch (e) {
                if (!cancelled) setEvalsError(e instanceof Error ? e.message : 'failed to load evaluations');
            } finally {
                inFlight = false;
            }
        };

        // Cache provides the first paint; always revalidate immediately.
        void poll();
        const timer = window.setInterval(() => void poll(), 15_000);
        const onFocus = () => void poll();
        window.addEventListener('focus', onFocus);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener('focus', onFocus);
        };
    }, [projectUUID, refreshKey]);

    const handleRefresh = () => {
        clearSessionCache();
        setRowMap({});
        setRefreshKey((k) => k + 1);
    };

    useEffect(() => {
        if (!dashboardReady || !canEdit || hydratedProject.current !== projectUUID) return;
        const value = { widgets, layouts };
        const serialized = JSON.stringify(value);
        if (serialized === savedRef.current) return;
        let cancelled = false;
        void scheduleDashboardSave(projectUUID, value, revisionRef.current).then((state) => {
            if (cancelled) return;
            revisionRef.current = state.revision;
            savedRef.current = serialized;
            setCanImport(false);
        }).catch((error: Error) => {
            if (cancelled) return;
            setDashboardError(error.message);
            setCanEdit(false);
        });
        return () => { cancelled = true; };
    }, [widgets, layouts, projectUUID, dashboardReady, canEdit]);

    // Mirror every other breakpoint from the current `lg` arrangement whenever it
    // changes, so a page-width change always shows the layout scaled to that size
    // (X|Y then Z keeps its order — no stale per-breakpoint layouts).
    const lgKey = useMemo(
        () => (layouts.lg ?? []).map((l) => `${l.i}:${l.x},${l.y},${l.w},${l.h}`).join('|'),
        [layouts.lg],
    );
    useEffect(() => {
        setLayouts((prev) => {
            const lg = prev.lg ?? [];
            if (!lg.length) return prev;
            return {
                ...prev,
                md: scaleLayout(lg, BREAKPOINT_COLS.lg, BREAKPOINT_COLS.md),
                sm: scaleLayout(lg, BREAKPOINT_COLS.lg, BREAKPOINT_COLS.sm),
                xs: scaleLayout(lg, BREAKPOINT_COLS.lg, BREAKPOINT_COLS.xs),
                xxs: scaleLayout(lg, BREAKPOINT_COLS.lg, BREAKPOINT_COLS.xxs),
            };
        });
    }, [lgKey]);

    const evalsById = useMemo(() => new Map(evals.map((e) => [e.pid, e])), [evals]);
    const sortedEvals = useMemo(
        () =>
            [...evals].sort((a, b) => {
                const ta = a.created_at ? Date.parse(a.created_at) : 0;
                const tb = b.created_at ? Date.parse(b.created_at) : 0;
                return tb - ta; // newest on top
            }),
        [evals],
    );

    const displayNames = useMemo(() => {
        const map = new Map<string, string>();
        evals.forEach((e) =>
            (e.evaluation_plugins ?? []).forEach((ep) => map.set(ep.name, ep.display_name || ep.name)),
        );
        return map;
    }, [evals]);

    // Every plugin seen in any done evaluation, for the builder's plugin list.
    const pluginOptions = useMemo(
        () =>
            Array.from(displayNames.entries()).map(([name, displayName]) => ({ name, displayName })),
        [displayNames],
    );

    const makeRow = (
        evaluation: DashboardEval,
        ep: DashboardEvalPlugin,
        res: EvalPluginResults,
    ): EvalRow => ({
        index: 1,
        evalUuid: evaluation.pid,
        evalLabel: evalTitle(evaluation),
        pluginName: ep.name,
        displayName: ep.display_name || ep.name,
        evalPluginPid: ep.pid,
        measurements: res.measurements ?? [],
        metric_visualizations: res.metric_visualizations,
    });

    /** Ask for (evaluation, plugin) results to be fetched into the row cache. */
    const requestData = useCallback((plugin: string, evaluations: string[]) => {
        setExtraPairs((prev) => {
            const next = new Set(prev);
            evaluations.forEach((e) => next.add(`${e}|${plugin}`));
            return next;
        });
    }, []);

    // Fetch results for every (evaluation, plugin) pair referenced by a widget
    // or requested by the builder (already-cached ones resolve instantly).
    useEffect(() => {
        const pairs = new Set(extraPairs);
        const allEvals = evals.map((e) => e.pid);
        widgets.forEach((w) => {
            if (!w.plugin) return;
            const evaluations = w.evaluations && w.evaluations.length ? w.evaluations : allEvals;
            evaluations.forEach((e) => pairs.add(`${e}|${w.plugin}`));
        });

        pairs.forEach((key) => {
            if (rowMap[key]) return;
            const [evalUuid, pluginName] = key.split('|');
            const evaluation = evalsById.get(evalUuid);
            if (!evaluation) return;
            const ep = (evaluation.evaluation_plugins ?? []).find((p) => p.name === pluginName);
            if (!ep) return;
            const cached = getCachedPluginMeasurements(ep.pid, evalUuid);
            if (cached) {
                setRowMap((prev) => (prev[key] ? prev : { ...prev, [key]: makeRow(evaluation, ep, cached) }));
                return;
            }
            void getPluginMeasurements(ep.pid, evalUuid)
                .then((res) =>
                    setRowMap((prev) => (prev[key] ? prev : { ...prev, [key]: makeRow(evaluation, ep, res) })),
                )
                .catch(() => { /* evaluation plugin without a result: skip */ });
        });
    }, [extraPairs, widgets, evalsById, evals, rowMap]);

    /** Combined measurements for one widget: its plugin across its evaluations. */
    const dataFor = useCallback(
        (plugin: string, evaluations: string[]) => {
            const rows = evaluations
                .map((e) => rowMap[`${e}|${plugin}`])
                .filter((r): r is EvalRow => Boolean(r));
            return combineByPlugin(rows).get(plugin) ?? [];
        },
        [rowMap],
    );

    /** The metric visualizations of a plugin widget (taken from its evaluations). */
    const vizFor = (widget: GridWidget): MetricVisualization[] => {
        if (!widget.plugin) return [];
        const allEvals = evals.map((e) => e.pid);
        const evaluations = widget.evaluations && widget.evaluations.length ? widget.evaluations : allEvals;
        for (const e of evaluations) {
            const viz = rowMap[`${e}|${widget.plugin}`]?.metric_visualizations;
            if (viz && viz.length) return viz;
        }
        return [];
    };

    /** Default charts the plugin defines for a set of evaluations (import source). */
    const visualizationsFor = (plugin: string, evaluations: string[]): MetricVisualization[] => {
        for (const e of evaluations) {
            const viz = rowMap[`${e}|${plugin}`]?.metric_visualizations;
            if (viz && viz.length) return viz;
        }
        return [];
    };

    // Stable measurement arrays per widget (keyed by data, not by render), so the
    // MUI charts only redraw when their data really changes — not on every
    // layout change, typing, or other unrelated state update.
    const measurementsByKey = useMemo(() => {
        const byKey: Record<string, Measurement[]> = {};
        const allEvals = evals.map((e) => e.pid);
        widgets.forEach((widget) => {
            const evaluations = widget.evaluations && widget.evaluations.length ? widget.evaluations : allEvals;
            byKey[widget.key] = widget.plugin ? dataFor(widget.plugin, evaluations) : [];
        });
        return byKey;
    }, [widgets, evals, dataFor]);

    // --- geometry: the grid engine (RGL) owns layouts; app state owns widgets ---
    const addWidget = useCallback(
        (widget: Omit<GridWidget, 'key'>, { w, h }: { w: number; h: number }, minW = 2, minH = 2) => {
            const key = uid();
            // Batched facet additions should reveal their first widget.
            setScrollTarget((previous) => previous ?? { project: projectUUID, key });
            setWidgets((prev) => [...prev, { ...widget, key }]);
            // Append the new item to every breakpoint's layout so it renders at
            // the current size too (clamped to the page width, not a 1×1 box).
            // Existing items are never touched.
            setLayouts((prev) => {
                const next: Record<string, GridItemLayout[] | undefined> = { ...prev };
                (Object.keys(BREAKPOINT_COLS) as (keyof typeof BREAKPOINT_COLS)[]).forEach((bp) => {
                    const cols = BREAKPOINT_COLS[bp];
                    const list = prev[bp] ?? [];
                    const { x, y } = nextWidgetSlot(list);
                    next[bp] = [...list, { i: key, x, y, w: Math.min(w, cols), h, minW, minH }];
                });
                return next;
            });
        },
        [projectUUID],
    );

    useEffect(() => {
        if (!scrollTarget || scrollTarget.project !== projectUUID || builderOpen || !builderExited
            || !dashboardReady || !evalsLoaded || !mounted || width <= 0) return;
        // RGL owns the item refs; find our marked wrapper after it has laid out.
        const frame = requestAnimationFrame(() => {
            if (activeProject.current !== scrollTarget.project) return;
            const element = widgetGridRef.current?.querySelector<HTMLElement>('[data-scroll-target]');
            if (!element) return;
            element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            setScrollTarget(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [scrollTarget, projectUUID, builderOpen, builderExited, dashboardReady, evalsLoaded, mounted, width, layouts]);

    const deleteWidget = (key: string) => {
        setWidgets((prev) => prev.filter((w) => w.key !== key));
        setLayouts((prev) =>
            Object.fromEntries(
                Object.entries(prev).map(([bp, arr]) => [bp, arr?.filter((l) => l.i !== key) ?? []]),
            ),
        );
    };

    const updateText = (key: string, text: string) => {
        setWidgets((prev) => prev.map((w) => (w.key === key ? { ...w, text } : w)));
    };

    const saveText = (key: string, text: string) => {
        updateText(key, text);
        setTextEditingKey(null);
    };

    useEffect(() => {
        const requests = builderRequest;
        ++requests.current;
        setBuilderOpen(false);
        setBuilderLoading(false);
        setRowMap({});
        setExtraPairs(new Set());
        return () => { ++requests.current; };
    }, [projectUUID]);

    const openCreate = async () => {
        const request = ++builderRequest.current;
        setBuilderLoading(true);
        try {
            const fresh = await refreshDoneEvaluations(projectUUID);
            if (activeProject.current !== projectUUID || request !== builderRequest.current) return;
            setEvals((prev) => evaluationSignature(prev) === evaluationSignature(fresh) ? prev : fresh);
            setEvalsLoaded(true);
            setEvalsError(null);
            setEditingKey(null);
            setBuilderExited(false);
            setBuilderOpen(true);
        } catch (error) {
            if (activeProject.current === projectUUID && request === builderRequest.current) {
                setEvalsError(error instanceof Error ? error.message : 'failed to load evaluations');
            }
        } finally {
            if (activeProject.current === projectUUID && request === builderRequest.current) setBuilderLoading(false);
        }
    };

    const openEdit = (key: string) => {
        setEditingKey(key);
        setBuilderExited(false);
        setBuilderOpen(true);
    };

    const handleBuilderSubmit = (fields: ChartFields) => {
        if (editingKey) {
            // facet-only fields matter when creating new widgets; drop them from the saved widget
            const editable = { ...fields };
            delete editable.facets;
            delete editable.facetTitles;
            delete editable.facetComments;
            delete editable.facetLabelOverrides;
            delete editable.facetLabelOrder;
            setWidgets((prev) =>
                prev.map((w) =>
                    w.key === editingKey ? { ...w, kind: 'chart', ...editable, plugin: fields.plugin } : w,
                ),
            );
            setEditingKey(null);
        } else {
            // A faceted bars submission becomes one widget per selected facet value.
            const split = splitFacetWidgets(fields);
            if (split.length) {
                split.forEach((w) => addWidget(w, DEFAULT_CHART_SIZE));
            } else {
                // single chart: drop the facet-only payload before persisting the widget
                const single = { ...fields };
                delete single.facets;
                delete single.facetTitles;
                delete single.facetComments;
                delete single.facetLabelOverrides;
                delete single.facetLabelOrder;
                addWidget({ kind: 'chart', ...single }, DEFAULT_CHART_SIZE);
            }
        }
    };

    const clearWidgets = () => {
        setWidgets([]);
        setLayouts({});
        setClearOpen(false);
    };

    if (!dashboardReady) return (
        <Box ref={gridRef} sx={{ width: '100%' }}>
            <Typography>{dashboardError || 'Loading dashboard…'}</Typography>
        </Box>
    );

    return (
        <Box ref={gridRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {dashboardError && <Typography color="error">{dashboardError}</Typography>}
            {canImport && canEdit && <Button onClick={() => {
                if (revisionRef.current !== 0) return;
                const state = loadGridState(projectUUID);
                if (state) { setWidgets(state.widgets); setLayouts(state.layouts); }
                setCanImport(false);
            }}>Import this browser’s dashboard</Button>}
            <Box component="fieldset" disabled={!canEdit}
                sx={{ border: 0, m: 0, p: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'nowrap',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <ToolbarButton
                        compact={compactToolbar}
                        label="Clear layout"
                        icon={<DeleteSweepRounded />}
                        variant="contained"
                        color="error"
                        onClick={() => setClearOpen(true)}
                    />
                    <ToolbarButton
                        compact={compactToolbar}
                        label="Refresh"
                        icon={<RefreshRounded />}
                        variant="contained"
                        onClick={handleRefresh}
                        muted
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <ToolbarButton
                        compact={compactToolbar}
                        label="Add comment"
                        icon={<CommentRounded />}
                        variant="contained"
                        className="gradient-btn"
                        onClick={() => addWidget({ kind: 'text', text: '' }, DEFAULT_COMMENT_SIZE)}
                    />
                    <ToolbarButton
                        compact={compactToolbar}
                        label="Add chart"
                        icon={builderLoading ? <CircularProgress size={16} /> : <Addchart />}
                        variant="contained"
                        className="gradient-btn"
                        disabled={builderLoading}
                        onClick={() => void openCreate()}
                    />
                </Box>
            </Box>

            {evalsError && <Typography color="error">{evalsError}</Typography>}

            {!evalsLoaded ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : widgets.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="body2" color="text.secondary">
                        {evals.length === 0
                            ? 'No completed evaluations yet — add comments with “Add comment”; charts become available here once an evaluation finishes.'
                            : 'No widgets yet — use “Add chart” to add a plot (picking its plugin, evaluations, title and legend labels), or “Add comment” for a note.'}
                    </Typography>
                </Paper>
            ) : (
                <div ref={widgetGridRef} style={{ width: '100%' }}>
                    {mounted && width > 0 && (
                        <Responsive
                            width={width}
                            layouts={layouts as ResponsiveLayouts}
                            breakpoints={DASHBOARD_BREAKPOINTS}
                            cols={BREAKPOINT_COLS}
                            rowHeight={DASHBOARD_ROW_HEIGHT}
                            margin={DASHBOARD_MARGIN}
                            containerPadding={DASHBOARD_PADDING}
                            // dedicated header drag handle; resize stays on the corner handles.
                            // Cross cards freely during a drag; keep resizing collision-safe.
                            // No compaction: other widgets never move to fill gaps.
                            compactor={{ ...noCompactor, allowOverlap: dragging, preventCollision: !dragging }}
                            onDragStart={onDragStart}
                            onDragStop={onDragStop}
                            dragConfig={{ enabled: canEdit, handle: '.widget-drag-handle' }}
                            resizeConfig={{ enabled: canEdit }}
                            onLayoutChange={(_layout, all) =>
                                setLayouts(all as unknown as Record<string, GridItemLayout[] | undefined>)
                            }
                        >
                            {widgets.map((widget) => (
                                <div key={widget.key} data-scroll-target={scrollTarget?.key === widget.key ? '' : undefined}>
                                    <GridWidgetBody
                                        widget={widget}
                                        measurements={measurementsByKey[widget.key] ?? []}
                                        visualizations={widget.kind === 'plugin' ? vizFor(widget) : []}
                                        displayName={(p) => displayNames.get(p) ?? p}
                                        onEdit={canEdit && widget.kind !== 'text' ? () => openEdit(widget.key) : undefined}
                                        onDelete={() => { if (canEdit) deleteWidget(widget.key); }}
                                        editingText={textEditingKey === widget.key}
                                        onEditText={() => { if (canEdit) setTextEditingKey(widget.key); }}
                                        onSaveText={(text) => saveText(widget.key, text)}
                                        onCancelText={() => setTextEditingKey(null)}
                                    />
                                </div>
                            ))}
                        </Responsive>
                    )}
                </div>
            )}

            <ChartBuilderDialog
                open={builderOpen}
                plugins={pluginOptions}
                evals={sortedEvals}
                dataFor={dataFor}
                requestData={requestData}
                visualizationsFor={visualizationsFor}
                initial={editingKey ? widgets.find((w) => w.key === editingKey) : null}
                onClose={() => { setBuilderOpen(false); setEditingKey(null); }}
                onExited={() => setBuilderExited(true)}
                onSubmit={handleBuilderSubmit}
            />

            <AppDialog
                open={clearOpen}
                onClose={() => setClearOpen(false)}
                maxWidth="xs"
                fullWidth
                title="Clear dashboard layout?"
                actions={
                    <>
                        <Button onClick={() => setClearOpen(false)} variant="outlined" sx={{ textTransform: 'none' }}>
                            Cancel
                        </Button>
                        <Button variant="contained" color="error" onClick={clearWidgets} sx={{ textTransform: 'none' }}>
                            Clear widgets
                        </Button>
                    </>
                }
            >
                <Typography variant="body2" color="text.secondary">
                    This removes all charts and comments from the grid for this project. This cannot be undone.
                </Typography>
            </AppDialog>
        </Box>
    );
}

function GridWidgetBody({
    widget,
    measurements,
    visualizations,
    displayName,
    onEdit,
    onDelete,
    editingText,
    onEditText,
    onSaveText,
    onCancelText,
}: {
    widget: GridWidget;
    measurements: Measurement[];
    visualizations: MetricVisualization[];
    displayName: (plugin: string) => string;
    onEdit?: () => void;
    onDelete?: () => void;
    editingText?: boolean;
    onEditText?: () => void;
    onSaveText?: (text: string) => void;
    onCancelText?: () => void;
}) {
    const [draft, setDraft] = useState(widget.text ?? '');
    useEffect(() => {
        if (editingText) setDraft(widget.text ?? '');
    }, [editingText, widget.text]);

    const fitCharts = widget.kind !== 'text' && widget.chartType !== 'table';
    const renderContent = (chartHeight?: number) => {
        let content: React.ReactNode;
        if (widget.kind === 'text') {
            content =
                editingText ? (
                    <TextField
                        autoFocus
                        multiline
                        fullWidth
                        size="small"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                onSaveText?.(draft);
                            }
                            if (e.key === 'Escape') onCancelText?.();
                        }}
                        placeholder="Write a note or comment…"
                        sx={{ height: '100%', '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' } }}
                    />
                ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} color={widget.text ? 'text.primary' : 'text.disabled'}>
                        {widget.text && widget.text.trim() ? widget.text : 'Empty note — press Edit to write one.'}
                    </Typography>
                );
        } else if (widget.kind === 'plugin') {
            content = measurements.length === 0 ? (
                <Alert severity="info" sx={{ my: 1 }}>
                    No measurements yet for this plugin in the selected evaluations.
                </Alert>
            ) : visualizations.length === 0 ? (
                renderVisualization(measurements, { chart_type: 'table', metrics: [] })
            ) : (
                visualizations.map((viz, i) => (
                    <Box key={i} sx={{ mb: 2 }}>
                        {renderVisualization(measurements, viz, widget.labelOverrides, widget.labelOrder, chartHeight)}
                    </Box>
                ))
            );
        } else {
            const viz = chartWidgetToViz(widget);
            content = measurements.length === 0 ? (
                <Alert severity="info" sx={{ my: 1 }}>
                    No measurements for this plugin in the selected evaluations.
                </Alert>
            ) : (
                renderVisualization(measurements, viz, widget.labelOverrides, widget.labelOrder, chartHeight)
            );
        }

        return content;
    };

    const title = widget.kind === 'text'
        ? 'Comment'
        : widget.title || (widget.plugin ? `${displayName(widget.plugin)} · ${widget.chartType}` : 'Chart');

    return (
        <Paper variant="outlined" className="grid-widget">
            <Box className="widget-drag-handle grid-widget-header">
                <DragIndicatorRounded fontSize="small" />
                <Typography variant="subtitle2" className="grid-widget-header-title">
                    {title}
                </Typography>
                {widget.kind === 'text' && editingText ? (
                    <>
                        <Tooltip title="Save comment">
                            <IconButton size="small" onClick={() => onSaveText?.(draft)} onMouseDown={(e) => e.stopPropagation()} aria-label="Save comment">
                                <CheckRounded fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Discard changes">
                            <IconButton size="small" onClick={onCancelText} onMouseDown={(e) => e.stopPropagation()} aria-label="Cancel comment edit">
                                <CloseRounded fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </>
                ) : null}
                {onEdit && (
                    <Tooltip title="Edit chart">
                        <IconButton size="small" onClick={onEdit} onMouseDown={(e) => e.stopPropagation()} aria-label="Edit widget">
                            <EditRounded fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {widget.kind === 'text' && !editingText && onEditText && (
                    <Tooltip title="Edit comment">
                        <IconButton size="small" onClick={onEditText} onMouseDown={(e) => e.stopPropagation()} aria-label="Edit comment">
                            <EditRounded fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {onDelete && (
                    <Tooltip title="Remove widget">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={onDelete}
                            onMouseDown={(e) => e.stopPropagation()}
                            aria-label="Remove widget"
                        >
                            <Icon fontSize="small">delete</Icon>
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
            <WidgetChartSurface enabled={fitCharts}>{renderContent}</WidgetChartSurface>
            {widget.kind !== 'text' && widget.comment?.trim() && (
                <Accordion
                    disableGutters
                    square
                    sx={{
                        flexShrink: 0,
                        borderTop: 1,
                        borderColor: 'divider',
                        bgcolor: 'transparent',
                        '&:before': { display: 'none' },
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon fontSize="small" />}
                        sx={{
                            minHeight: 0,
                            '&.Mui-expanded': { minHeight: 0 },
                            '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center' },
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                            <CommentRounded sx={{ fontSize: 16 }} />
                            <Typography variant="caption">Comment</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, maxHeight: 160, overflow: 'auto' }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {widget.comment}
                        </Typography>
                    </AccordionDetails>
                </Accordion>
            )}
        </Paper>
    );
}
