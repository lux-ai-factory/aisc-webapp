import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Alert from '@mui/material/Alert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import AppDialog from '../AppDialog';
import type { Measurement, MetricVisualization } from '../../models/models';
import { evalTitle } from '../../lib/sandbox';
import { EVAL_DIM_KEY, availableDimensionKeys, availableMetrics, selectMeasurements, vizToChartFields, type ChartFields, type DashboardEval, type GridWidget } from '../../lib/dashboardCharts';
import { renderVisualization } from './dashboardPlot';
import { buildDistinctSeriesKeys, getGroupLabel, getMetricLabel, labelFromSeriesKey } from '../plugin/ChartUtils';

const CHART_TYPES = ['line', 'bars', 'scatter', 'kde', 'radar', 'pie', 'table'] as const;

interface ChartBuilderDialogProps {
    open: boolean;
    plugins: { name: string; displayName: string }[];
    evals: DashboardEval[];
    dataFor: (plugin: string, evaluations: string[]) => Measurement[];
    requestData: (plugin: string, evaluations: string[]) => void;
    /** Default charts the plugin defines for the selected evaluations. */
    visualizationsFor: (plugin: string, evaluations: string[]) => MetricVisualization[];
    /** Existing chart widget being edited (null = create a new one). */
    initial?: GridWidget | null;
    onClose: () => void;
    onSubmit: (fields: ChartFields) => void;
}

/** Per-chart builder: the plugin, the evaluations it should overlay, the chart
 *  type/metrics/dimensions, feed title and legend labels, with a live preview.
 *  Used both to create and to edit dashboard widgets. */
export default function ChartBuilderDialog({
    open, plugins, evals, dataFor, requestData, visualizationsFor, initial, onClose, onSubmit,
}: ChartBuilderDialogProps) {
    const [plugin, setPlugin] = useState('');
    const [evaluations, setEvaluations] = useState<string[]>([]);
    const [chartType, setChartType] = useState<string>('table');
    const [metrics, setMetrics] = useState<string[]>([]);
    const [labelDim, setLabelDim] = useState('');
    const [facetDim, setFacetDim] = useState('');
    const [facets, setFacets] = useState<string[]>([]);
    const [facetTitles, setFacetTitles] = useState<Record<string, string>>({});
    const [facetComments, setFacetComments] = useState<Record<string, string>>({});
    const [facetOverrides, setFacetOverrides] = useState<Record<string, Record<string, string>>>({});
    const [facetOrder, setFacetOrder] = useState<Record<string, string[]>>({});
    const [groupByInput, setGroupByInput] = useState('');
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [filterKey, setFilterKey] = useState('');
    const [filterValue, setFilterValue] = useState('');
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
    const [labelOrder, setLabelOrder] = useState<string[]>([]);
    const [importIdx, setImportIdx] = useState('');
    const preImportRef = useRef<Partial<ChartFields> | null>(null);
    const wasOpen = useRef(false);
    // Once the user customizes the facet selection, background data updates
    // must preserve it (only values that disappear are dropped).
    const facetsTouched = useRef(false);
    const facetDimRef = useRef(facetDim);
    const isEdit = !!initial;

    // Reset the form once per dialog opening; later prop churn (e.g. the
    // background evaluation poll) must not clobber in-progress selections.
    useEffect(() => {
        if (!open || wasOpen.current) return;
        setPlugin(initial?.plugin ?? plugins[0]?.name ?? '');
        setEvaluations(initial?.evaluations && initial.evaluations.length ? initial.evaluations : evals.map((e) => e.pid));
        setChartType(initial?.chartType ?? 'table');
        setMetrics(initial?.metrics ?? []);
        setLabelDim(initial?.labelDim ?? '');
        setFacetDim(initial?.facetDim ?? '');
        setFacets([]);
        setFacetTitles({});
        setFacetComments({});
        setFacetOverrides({});
        setFacetOrder({});
        setGroupByInput('');
        setGroupBy(initial?.groupBy ?? []);
        setFilterKey('');
        setFilterValue('');
        setFilters(initial?.filters ?? {});
        setTitle(initial?.title ?? '');
        setComment(initial?.comment ?? '');
        setLabelOverrides(initial?.labelOverrides ?? {});
        setLabelOrder(initial?.labelOrder ?? []);
        setImportIdx('');
        preImportRef.current = null;
        // a fresh opening starts a new facet-selection session
        facetDimRef.current = initial?.facetDim ?? '';
        facetsTouched.current = false;
        wasOpen.current = true;
    }, [open, initial, plugins, evals]);

    useEffect(() => {
        if (!open) wasOpen.current = false;
    }, [open]);

    // Pull the measurements for the chart's (plugin, evaluations) combination.
    useEffect(() => {
        if (open && plugin && evaluations.length) requestData(plugin, evaluations);
    }, [open, plugin, evaluations, requestData]);

    const pluginData = useMemo(() => dataFor(plugin, evaluations), [dataFor, plugin, evaluations]);
    const metricOptions = useMemo(() => availableMetrics(pluginData), [pluginData]);
    const dimOptions = useMemo(
        () => availableDimensionKeys(pluginData).filter((k) => k !== EVAL_DIM_KEY),
        [pluginData],
    );

    const filterValueOptions = useMemo(() => {
        if (!filterKey) return [];
        const values = new Set<string>();
        pluginData.forEach((m) => {
            const v = m.dimensions?.[filterKey];
            if (v !== undefined && v !== null) values.add(String(v));
        });
        return Array.from(values).sort();
    }, [pluginData, filterKey]);

    // Facet values available for the chosen facet dimension (e.g. "fold → a,b,c").
    const facetValueOptions = useMemo(() => {
        if (!facetDim) return [];
        const values = new Set<string>();
        pluginData.forEach((m) => {
            const v = m.dimensions?.[facetDim];
            if (v !== undefined && v !== null) values.add(String(v));
        });
        return Array.from(values).sort();
    }, [pluginData, facetDim]);

    // Reconciling the facet selection with the data instead of resetting it:
    // choosing a different facet dimension defaults to every currently available
    // value (a new selection session); if data arrives late and the user has not
    // touched the selection yet, initialize from the first available value set.
    // Once the user customizes the selection, background data updates only drop
    // values that genuinely disappeared - never re-select new ones, and an
    // intentionally empty selection stays empty.
    useEffect(() => {
        if (facetDim !== facetDimRef.current) {
            facetDimRef.current = facetDim;
            facetsTouched.current = false;
            setFacets(facetValueOptions);
            return;
        }
        if (facetsTouched.current) {
            setFacets((previous) => previous.filter((value) => facetValueOptions.includes(value)));
            return;
        }
        // untouched: keep the default-to-all selection in sync with the data
        setFacets(facetValueOptions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facetDim, facetValueOptions.join('|')]);

    const handlePluginChange = (name: string) => {
        setPlugin(name);
        setImportIdx('');
        preImportRef.current = null;
        setMetrics([]);
        setLabelDim('');
        setFacetDim('');
        setGroupByInput('');
        setGroupBy([]);
        setFilterKey('');
        setFilterValue('');
        setFilters({});
        setLabelOverrides({});
        setLabelOrder([]);
    };

    // Default charts the selected plugin ships for these evaluations, offered as
    // a one-click import that pre-fills the chart type/metrics/dimensions.
    const defaultCharts = useMemo(
        () => (plugin && evaluations.length ? visualizationsFor(plugin, evaluations) : []),
        [plugin, evaluations, visualizationsFor],
    );
    const chartLabel = (viz: MetricVisualization, index: number) =>
        viz.title || `${viz.chart_type}${viz.metrics?.length ? ` · ${viz.metrics.join(', ')}` : ''}` || `Chart ${index + 1}`;
    const applyVisualization = (viz: MetricVisualization) => {
        // snapshot the current form so "(None)" can undo the import
        preImportRef.current = { chartType, metrics, filters, groupBy, labelDim, facetDim, title };
        const fields = vizToChartFields(viz);
        setChartType(fields.chartType ?? 'table');
        setMetrics(fields.metrics ?? []);
        setFilters(fields.filters ?? {});
        setGroupBy(fields.groupBy ?? []);
        setLabelDim(fields.labelDim ?? '');
        setFacetDim(fields.facetDim ?? '');
        setTitle(fields.title ?? '');
        setLabelOverrides({});
        setLabelOrder([]);
    };
    /** Restore the form to its state before the last import (selecting "(None)"). */
    const undoImport = () => {
        setImportIdx('');
        const prev = preImportRef.current;
        preImportRef.current = null;
        const p = prev ?? {};
        setChartType(p.chartType ?? 'table');
        setMetrics(p.metrics ?? []);
        setFilters(p.filters ?? {});
        setGroupBy(p.groupBy ?? []);
        setLabelDim(p.labelDim ?? '');
        setFacetDim(p.facetDim ?? '');
        setTitle(p.title ?? '');
        setLabelOverrides({});
        setLabelOrder([]);
    };

    const handleAddFilter = () => {
        if (!filterKey || !filterValue) return;
        setFilters((prev) => ({ ...prev, [filterKey]: [...(prev[filterKey] ?? []), filterValue] }));
        setFilterValue('');
    };

    const handleAddGroupBy = () => {
        if (!groupByInput || groupBy.includes(groupByInput)) return;
        setGroupBy((prev) => [...prev, groupByInput]);
        setGroupByInput('');
    };

    const viz: MetricVisualization = {
        chart_type: chartType,
        metrics,
        filter_dimensions: Object.keys(filters).length ? filters : undefined,
        metric_label_dimension: labelDim || undefined,
        group_by_dimensions: groupBy.length ? groupBy : undefined,
        facet_by_dimension: facetDim ? [facetDim] : undefined,
    };

    // Data scoped to the chosen facet charts (default all): the live preview and the
    // legend labels both reflect exactly which facet charts will be added.
    const scopedData = useMemo(() => {
        if (!facetDim || facets.length === 0) return pluginData;
        return selectMeasurements(pluginData, [], { [facetDim]: facets });
    }, [pluginData, facetDim, facets]);

    // Legend labels exactly as the chart renders them (respecting the selected
    // metrics + filter rules, with the evaluation dimension always grouped), so
    // the user can rename each visible series. Bars and radar render one series per run/group
    // (their axes already carry the metrics), so their legends list group labels
    // rather than "metric (run)" composites.
    const availableLabels = useMemo(() => {
        const data = selectMeasurements(scopedData, metrics, filters);
        const group: string[] = [...(groupBy.length ? groupBy : []), EVAL_DIM_KEY];
        if (chartType === 'bars' || chartType === 'radar') {
            return Array.from(new Set(data.map((m) => getGroupLabel(m, group)))).sort();
        }
        const keys = buildDistinctSeriesKeys(data, group, labelDim || undefined);
        return Array.from(new Set(keys.map(labelFromSeriesKey))).sort();
    }, [scopedData, metrics, filters, groupBy, labelDim, chartType]);

    // The user's chosen order (labelOrder) comes first; the rest follow naturally.
    const displayedLabels = useMemo(() => {
        const order = labelOrder.filter((l) => availableLabels.includes(l));
        const rest = availableLabels.filter((l) => !order.includes(l));
        return [...order, ...rest];
    }, [availableLabels, labelOrder]);

    const moveLabel = (index: number, dir: number) => {
        const target = index + dir;
        if (target < 0 || target >= displayedLabels.length) return;
        const next = [...displayedLabels];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        setLabelOrder(next);
    };

    // Per-(facet, metric) counterparts: legend labels and their ordering, scoped to
    // one unit, so each faceted preview chart gets its own title/comment/legend block.
    const unitKey = (value: string, metric: string) => (metric ? `${value}::${metric}` : value);
    const unitData = (value: string, metric: string) =>
        selectMeasurements(scopedData, metric ? [metric] : [], { [facetDim]: [value] });

    const facetLabelsOf = (value: string, metric: string): string[] => {
        const data = unitData(value, metric);
        const group: string[] = [...(groupBy.length ? groupBy : []), EVAL_DIM_KEY];
        if (chartType === 'bars' || chartType === 'radar') {
            return Array.from(new Set(data.map((m) => getGroupLabel(m, group)))).sort();
        }
        const keys = buildDistinctSeriesKeys(data, group, labelDim || undefined);
        return Array.from(new Set(keys.map(labelFromSeriesKey))).sort();
    };

    const orderedFacetLabels = (value: string, metric: string): string[] => {
        const labels = facetLabelsOf(value, metric);
        const chosen = facetOrder[unitKey(value, metric)] ?? [];
        const order = chosen.filter((l) => labels.includes(l));
        const rest = labels.filter((l) => !order.includes(l));
        return [...order, ...rest];
    };

    const moveFacetLabel = (value: string, metric: string, index: number, dir: number) => {
        const order = orderedFacetLabels(value, metric);
        const target = index + dir;
        if (target < 0 || target >= order.length) return;
        const next = [...order];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        setFacetOrder((prev) => ({ ...prev, [unitKey(value, metric)]: next }));
    };

    // Enabled as soon as a plugin is picked so one click always adds the
    // widget; its data loads in the background right after.
    const hasSelection = plugins.length > 0 && Boolean(plugin);

    const facetEnabled = Boolean(facetDim);
    const previewFacets = facetEnabled ? facetValueOptions.filter((v) => facets.includes(v)) : [];
    // Render a single (non-faceted) chart per facet in the preview.
    const singleViz: MetricVisualization = { ...viz, facet_by_dimension: undefined };
    // Several metrics → one plot per (facet, metric); otherwise one per facet value.
    const metricSplit = facetEnabled && metrics.length > 1;
    const previewUnits = previewFacets.flatMap((value) =>
        (metricSplit ? metrics : ['']).map((metric) => ({ value, metric })),
    );
    const unitLabel = (value: string, metric: string) =>
        `${facetDim}: ${value}${metric ? ` · ${metric}` : ''}`;
    // The full default widget title (the header a chart shows without one), used to
    // pre-fill the title field in every case — faceted or not.
    const defaultTitle = `${plugins.find((p) => p.name === plugin)?.displayName ?? plugin} · ${
        chartType ? chartType[0].toUpperCase() + chartType.slice(1) : ''
    }`;
    // Fit each unit chart's height to its own category count (in compact mode),
    // so narrow facets don't render as oversized blank charts.
    const facetChartHeight = (value: string, metric: string): number => {
        const categories = new Set(unitData(value, metric).map((m) => getMetricLabel(m, labelDim || undefined))).size;
        return Math.max(180, Math.min(360, 90 + categories * 26));
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            title={isEdit ? 'Edit chart' : 'Add chart'}
            actions={
                <>
                    <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        disabled={!hasSelection}
                        sx={{ textTransform: 'none' }}
                        onClick={() => {
                            onSubmit({
                                plugin,
                                evaluations,
                                chartType,
                                metrics,
                                filters,
                                groupBy,
                                labelDim,
                                facetDim,
                                facets,
                                facetTitles,
                                facetComments,
                                facetLabelOverrides: facetOverrides,
                                facetLabelOrder: facetOrder,
                                title: title || defaultTitle,
                                comment,
                                labelOverrides,
                                labelOrder: displayedLabels,
                            });
                            onClose();
                        }}
                    >
                        {isEdit ? 'Save' : 'Add chart'}
                    </Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Stack spacing={2} sx={{ flex: '1 1 360px', minWidth: 320 }}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>Evaluations</InputLabel>
                        <Select
                            multiple
                            label="Evaluations"
                            value={evaluations}
                            onChange={(e) => setEvaluations(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            input={<OutlinedInput label="Evaluations" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.length === 0 ? <em>None</em> : `${selected.length} evaluation(s)`}
                                </Box>
                            )}
                        >
                            {evals.map((e) => (
                                <MenuItem key={e.pid} value={e.pid} sx={{ whiteSpace: 'nowrap' }}>
                                    {evalTitle(e)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                        <InputLabel>Plugin</InputLabel>
                        <Select label="Plugin" value={plugin} onChange={(e) => handlePluginChange(e.target.value)}>
                            {plugins.map((p) => (
                                <MenuItem key={p.name} value={p.name}>
                                    {p.displayName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                        <InputLabel>Default charts</InputLabel>
                        <Select
                            label="Default charts"
                            value={importIdx}
                            onChange={(e) => {
                                const v = e.target.value as string;
                                if (v === '') {
                                    undoImport();
                                    return;
                                }
                                const viz = defaultCharts[Number(v)];
                                setImportIdx(v);
                                if (viz) applyVisualization(viz);
                            }}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {defaultCharts.map((viz, i) => (
                                <MenuItem key={i} value={String(i)} sx={{ whiteSpace: 'nowrap' }}>
                                    {chartLabel(viz, i)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                        <InputLabel>Metrics (empty = all)</InputLabel>
                        <Select
                            multiple
                            label="Metrics (empty = all)"
                            value={metrics}
                            onChange={(e) => setMetrics(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            input={<OutlinedInput label="Metrics (empty = all)" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.length === 0 ? (
                                        <em>All metrics</em>
                                    ) : (
                                        selected.map((value) => <Chip key={value} label={value} size="small" />)
                                    )}
                                </Box>
                            )}
                        >
                            {metricOptions.map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                        <InputLabel>Chart type</InputLabel>
                        <Select label="Chart type" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                            {CHART_TYPES.map((t) => (
                                <MenuItem key={t} value={t}>
                                    {(t[0] ?? '').toUpperCase() + t.slice(1)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Typography variant="subtitle2" color="text.secondary">
                        Dimensions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
                            <InputLabel>Metric label dim</InputLabel>
                            <Select label="Metric label dim" value={labelDim} onChange={(e) => setLabelDim(e.target.value)}>
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {dimOptions.map((key) => (
                                    <MenuItem key={key} value={key}>
                                        {key}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
                            <InputLabel>Facet (iterate) by dim</InputLabel>
                            <Select label="Facet (iterate) by dim" value={facetDim} onChange={(e) => setFacetDim(e.target.value)}>
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                                {dimOptions.map((key) => (
                                    <MenuItem key={key} value={key}>
                                        {key}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Group by dim key</InputLabel>
                            <Select label="Group by dim key" value={groupByInput} onChange={(e) => setGroupByInput(e.target.value)}>
                                {dimOptions.map((key) => (
                                    <MenuItem key={key} value={key}>
                                        {key}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="outlined" size="small" onClick={handleAddGroupBy} disabled={!groupByInput}>
                            Add Group By Key
                        </Button>
                        {groupBy.map((dim) => (
                            <Chip key={dim} label={dim} onDelete={() => setGroupBy((prev) => prev.filter((d) => d !== dim))} />
                        ))}
                    </Box>

                    <Typography variant="subtitle2" color="text.secondary">
                        Filters
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Filter dim</InputLabel>
                            <Select label="Filter dim" value={filterKey} onChange={(e) => { setFilterKey(e.target.value); setFilterValue(''); }}>
                                {dimOptions.map((key) => (
                                    <MenuItem key={key} value={key}>
                                        {key}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 130 }} disabled={!filterKey}>
                            <InputLabel>Filter value</InputLabel>
                            <Select label="Filter value" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                                {filterValueOptions.map((val) => (
                                    <MenuItem key={val} value={val}>
                                        {val}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="outlined" size="small" onClick={handleAddFilter} disabled={!filterKey || !filterValue}>
                            Add Filter Rule
                        </Button>
                        {Object.entries(filters).map(([k, values]) => (
                            <Chip
                                key={k}
                                label={`${k}: ${values.join(', ')}`}
                                onDelete={() => setFilters((prev) => {
                                    const copy = { ...prev };
                                    delete copy[k];
                                    return copy;
                                })}
                            />
                        ))}
                    </Box>
                </Stack>

                <Stack spacing={2} sx={{ flex: '1 1 360px', minWidth: 320 }}>
                    {facetEnabled && facetValueOptions.length > 0 && (
                        <FormControl size="small" fullWidth>
                            <InputLabel>Facet charts to add (one per value · metric)</InputLabel>
                            <Select
                                multiple
                                label="Facet charts to add (one per value · metric)"
                                value={facets}
                                onChange={(e) => {
                                    facetsTouched.current = true;
                                    setFacets(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value);
                                }}
                                input={<OutlinedInput label="Facet charts to add (one per value · metric)" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.length === 0 ? (
                                            <em>None (one faceted chart)</em>
                                        ) : (
                                            selected.map((value) => <Chip key={value} label={value} size="small" />)
                                        )}
                                    </Box>
                                )}
                            >
                                {facetValueOptions.map((value) => (
                                    <MenuItem key={value} value={value}>
                                        {value}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <Typography variant="subtitle2" color="text.secondary">
                        Live preview
                    </Typography>
                    {facetEnabled ? (
                        previewFacets.length === 0 ? (
                            hasSelection ? (
                                renderVisualization(scopedData, viz, labelOverrides, displayedLabels)
                            ) : (
                                <Alert severity="info">Select a plugin with measurements to preview the chart.</Alert>
                            )
                        ) : (
                            previewUnits.map(({ value, metric }) => {
                                const key = unitKey(value, metric);
                                return (
                                    <Box
                                        key={key}
                                        sx={{ borderTop: 1, borderColor: 'divider', pt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
                                    >
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {unitLabel(value, metric)}
                                        </Typography>
                                        {hasSelection ? (
                                            renderVisualization(
                                                unitData(value, metric),
                                                singleViz,
                                                facetOverrides[key],
                                                orderedFacetLabels(value, metric),
                                                facetChartHeight(value, metric),
                                                true,
                                            )
                                        ) : (
                                            <Alert severity="info">No measurements yet to preview.</Alert>
                                        )}
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Widget title (optional)"
                                            value={facetTitles[key] ?? `${defaultTitle} · ${unitLabel(value, metric)}`}
                                            onChange={(e) =>
                                                setFacetTitles((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        />
                                        <TextField
                                            size="small"
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            label="Footer comment (optional, collapsed)"
                                            value={facetComments[key] ?? ''}
                                            onChange={(e) =>
                                                setFacetComments((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                        />
                                        <LegendLabelsEditor
                                            overrides={facetOverrides[key] ?? {}}
                                            order={orderedFacetLabels(value, metric)}
                                            onMove={(index, dir) => moveFacetLabel(value, metric, index, dir)}
                                            onOverride={(label, v) =>
                                                setFacetOverrides((prev) => ({
                                                    ...prev,
                                                    [key]: { ...(prev[key] ?? {}), [label]: v },
                                                }))
                                            }
                                        />
                                    </Box>
                                );
                            })
                        )
                    ) : hasSelection ? (
                        renderVisualization(scopedData, viz, labelOverrides, displayedLabels)
                    ) : (
                        <Alert severity="info">
                            Select a plugin with measurements to preview the chart.
                        </Alert>
                    )}

                    {!facetEnabled && (
                        <>
                            <TextField
                                size="small"
                                label="Widget title (optional)"
                                value={title || defaultTitle}
                                onChange={(e) => setTitle(e.target.value)}
                            />

                            <TextField
                                size="small"
                                multiline
                                minRows={2}
                                label="Footer comment (optional, collapsed)"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />

                            <LegendLabelsEditor
                                overrides={labelOverrides}
                                order={displayedLabels}
                                onMove={moveLabel}
                                onOverride={(label, v) => setLabelOverrides((prev) => ({ ...prev, [label]: v }))}
                            />
                        </>
                    )}
                </Stack>
            </Box>
        </AppDialog>
    );
}

/** Collapsible legend-renaming editor, shared by single charts and every facet
 *  chart in the preview so each gets its own legend control. */
function LegendLabelsEditor({
    overrides,
    order,
    onOverride,
    onMove,
}: {
    overrides: Record<string, string>;
    order: string[];
    onOverride: (label: string, value: string) => void;
    onMove: (index: number, dir: number) => void;
}) {
    if (order.length === 0) return null;
    return (
        <Accordion variant="outlined" sx={{ bgcolor: 'background.default', boxShadow: 'none' }}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: 0, '&.Mui-expanded': { minHeight: 0 }, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
                <Typography variant="subtitle2" color="text.secondary">
                    Legend labels
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={1}>
                    {order.map((label, index) => (
                        <Box key={label} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <IconButton
                                size="small"
                                disabled={index === 0}
                                onClick={() => onMove(index, -1)}
                                aria-label={`Move up ${label}`}
                            >
                                <ArrowUpwardRounded fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                disabled={index === order.length - 1}
                                onClick={() => onMove(index, 1)}
                                aria-label={`Move down ${label}`}
                            >
                                <ArrowDownwardRounded fontSize="small" />
                            </IconButton>
                            <TextField
                                size="small"
                                label={label}
                                value={overrides[label] ?? label}
                                onChange={(e) => onOverride(label, e.target.value)}
                                sx={{ flex: 1 }}
                            />
                        </Box>
                    ))}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
