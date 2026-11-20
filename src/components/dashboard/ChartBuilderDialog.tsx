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
import { buildDistinctSeriesKeys, labelFromSeriesKey } from '../plugin/ChartUtils';

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

    // Legend labels exactly as the chart renders them (respecting the selected
    // metrics + filter rules, with the evaluation dimension always grouped), so
    // the user can rename each visible series.
    const availableLabels = useMemo(() => {
        const data = selectMeasurements(pluginData, metrics, filters);
        const group: string[] = [...(groupBy.length ? groupBy : []), EVAL_DIM_KEY];
        const keys = buildDistinctSeriesKeys(data, group, labelDim || undefined);
        return Array.from(new Set(keys.map(labelFromSeriesKey))).sort();
    }, [pluginData, metrics, filters, groupBy, labelDim]);

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

    // Enabled as soon as a plugin is picked so one click always adds the
    // widget; its data loads in the background right after.
    const hasSelection = plugins.length > 0 && Boolean(plugin);

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
                                title,
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

                    <TextField
                        size="small"
                        label="Widget title (optional)"
                        value={title}
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

                    {displayedLabels.length > 0 && (
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
                                    {displayedLabels.map((label, index) => (
                                        <Box key={label} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                            <IconButton
                                                size="small"
                                                disabled={index === 0}
                                                onClick={() => moveLabel(index, -1)}
                                                aria-label={`Move up ${label}`}
                                            >
                                                <ArrowUpwardRounded fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                disabled={index === displayedLabels.length - 1}
                                                onClick={() => moveLabel(index, 1)}
                                                aria-label={`Move down ${label}`}
                                            >
                                                <ArrowDownwardRounded fontSize="small" />
                                            </IconButton>
                                            <TextField
                                                size="small"
                                                label={label}
                                                value={labelOverrides[label] ?? label}
                                                onChange={(e) =>
                                                    setLabelOverrides((prev) => ({ ...prev, [label]: e.target.value }))
                                                }
                                                sx={{ flex: 1 }}
                                            />
                                        </Box>
                                    ))}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Stack>

                <Stack spacing={2} sx={{ flex: '1 1 360px', minWidth: 320 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Live preview
                    </Typography>
                    {hasSelection ? (
                        renderVisualization(pluginData, viz, labelOverrides, displayedLabels)
                    ) : (
                        <Alert severity="info">
                            Select a plugin with measurements to preview the chart.
                        </Alert>
                    )}
                </Stack>
            </Box>
        </AppDialog>
    );
}
