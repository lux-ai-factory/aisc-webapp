import React, { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Grid2,
    Button,
    Chip,
    CircularProgress,
    Alert,
    Stack
} from '@mui/material';
import { Gauge } from '@mui/x-charts/Gauge';
import {
    getEvaluationDimensionKeys,
    getEvaluationDimensionValues,
    aggregateEvaluationMeasurements,
    getEvaluationMetricNames
} from '../../api/api'; // Adjust path if necessary

const getScoreColor = (score: number | null) => {
    if (score === null) return '#ddd';
    if (score >= 0 && score <= 1) {
        if (score > 0.8) return '#4caf50';
        if (score > 0.5) return '#ff9800';
        return '#f44336';
    }
    return '#2196f3';
};

interface AggregationResult {
    avg_score: number | null;
    min_score: number | null;
    max_score: number | null;
    count: number;
    [key: string]: any;
}

interface SummaryStatsProps {
    title: string;
    stats: AggregationResult;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ title, stats }) => {
    const avgScore = stats.avg_score || 0;
    const isPercentage = avgScore >= 0 && avgScore <= 1;
    const color = getScoreColor(stats.avg_score);

    return (
        <Paper sx={{ p: 2, border: `1px solid ${color}`, borderRadius: 2, height: '100%' }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom sx={{ fontWeight: 'bold' }}>
                {title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 80, height: 80, flexShrink: 0 }}>
                    <Gauge
                        value={isPercentage ? avgScore * 100 : avgScore}
                        valueMax={isPercentage ? 100 : Math.max(avgScore, stats.max_score || 0, 100)}
                        text={isPercentage ? `${Math.round(avgScore * 100)}%` : `${avgScore.toFixed(1)}`}
                        innerRadius="70%"
                        outerRadius="100%"
                        sx={{
                            [`& .MuiGauge-valueArc`]: { fill: color },
                            [`& .MuiGauge-valueText`]: { fontSize: '0.75rem', fontWeight: 'bold' }
                        }}
                    />
                </Box>
                <Grid2 container spacing={1} sx={{ flexGrow: 1 }}>
                    <Grid2 size={{ xs: 6 }}>
                        <Typography variant="caption" display="block" color="textSecondary">Count</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{stats.count}</Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6 }}>
                        <Typography variant="caption" display="block" color="textSecondary">Avg</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {isPercentage
                                ? avgScore.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })
                                : avgScore.toFixed(3)
                            }
                        </Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6 }}>
                        <Typography variant="caption" display="block" color="textSecondary">Min</Typography>
                        <Typography variant="body2">{(stats.min_score || 0).toFixed(3)}</Typography>
                    </Grid2>
                    <Grid2 size={{ xs: 6 }}>
                        <Typography variant="caption" display="block" color="textSecondary">Max</Typography>
                        <Typography variant="body2">{(stats.max_score || 0).toFixed(3)}</Typography>
                    </Grid2>
                </Grid2>
            </Stack>
        </Paper>
    );
};

interface MeasurementsExplorerProps {
    evaluationPid: string;
    evaluationPluginPid?: string;
}

export const MeasurementsExplorer: React.FC<MeasurementsExplorerProps> = ({ evaluationPid, evaluationPluginPid }) => {
    // UI State
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [selectedMetric, setSelectedMetric] = useState<string>('');

    // --- Queries ---

    const { data: metricNamesData, isPending: isMetricsPending, error: metricsError } = useQuery({
        queryKey: ['metricNames', evaluationPid, evaluationPluginPid],
        queryFn: () => getEvaluationMetricNames(evaluationPid, evaluationPluginPid),
        enabled: !!evaluationPid
    });

    const { data: dimensionKeysData, isPending: isKeysPending, error: keysError } = useQuery({
        queryKey: ['dimensionKeys', evaluationPid, evaluationPluginPid, selectedMetric],
        queryFn: () => getEvaluationDimensionKeys(evaluationPid, evaluationPluginPid, selectedMetric),
        enabled: !!evaluationPid
    });

    const dimensionKeys = dimensionKeysData?.keys || [];

    const dimensionValuesQueries = useQueries({
        queries: dimensionKeys.map((key: string) => ({
            queryKey: ['dimensionValues', evaluationPid, evaluationPluginPid, selectedMetric, key],
            queryFn: () => getEvaluationDimensionValues(evaluationPid, key, evaluationPluginPid, selectedMetric),
            enabled: !!evaluationPid && !!key
        }))
    });

    const { data: totalStatsData, isPending: isTotalStatsPending, error: totalStatsError } = useQuery({
        queryKey: ['totalStats', evaluationPid, evaluationPluginPid, selectedMetric],
        queryFn: () => aggregateEvaluationMeasurements(evaluationPid, {
            evaluation_plugin_pid: evaluationPluginPid,
            metric_name: selectedMetric,
            aggregations: ['avg_score', 'count', 'min_score', 'max_score']
        }),
        enabled: !!evaluationPid
    });

    const { data: filteredResultsData, isPending: isFilteredPending, error: filteredError } = useQuery({
        queryKey: ['filteredStats', evaluationPid, evaluationPluginPid, selectedMetric, groupBy, filters],
        queryFn: () => aggregateEvaluationMeasurements(evaluationPid, {
            evaluation_plugin_pid: evaluationPluginPid,
            metric_name: selectedMetric,
            group_by: groupBy,
            filters: filters,
            aggregations: ['avg_score', 'count', 'min_score', 'max_score']
        }),
        enabled: !!evaluationPid
    });

    // --- Data Processing & Status ---

    const metricNames = metricNamesData?.names || [];
    const totalStats = totalStatsData?.results?.[0] || null;

    // Sort the results descending by avg_score
    const sortedFilteredResults = useMemo(() => {
        const results = filteredResultsData?.results || [];
        return [...results].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));
    }, [filteredResultsData?.results]);

    // Reduce the dimension values queries into a map
    const availableValues = dimensionValuesQueries.reduce((acc, q, index) => {
        const key = dimensionKeys[index];
        const data = q.data as { values: any[] };
        if (data) acc[key] = data.values;
        return acc;
    }, {} as Record<string, any[]>);

    const isPending = isMetricsPending || isKeysPending || isTotalStatsPending || isFilteredPending || dimensionValuesQueries.some(q => q.isPending);
    const error = metricsError || keysError || totalStatsError || filteredError || dimensionValuesQueries.find(q => q.error)?.error;

    // Visibility flag: Only show the bottom results if they are actively drilling down
    const showGroupedResults = selectedMetric !== '' || groupBy.length > 0 || Object.keys(filters).length > 0;

    // --- Handlers ---

    const handleGroupByChange = (event: any) => {
        const value = event.target.value;
        setGroupBy(typeof value === 'string' ? value.split(',') : value);
    };

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            if (value === '' || (Array.isArray(value) && value.length === 0)) {
                delete newFilters[key];
            } else {
                newFilters[key] = value;
            }
            return newFilters;
        });
    };

    return (
        <Paper sx={{ p: 2, mt: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Measurements Explorer (Dimensions)
                </Typography>
                {isPending && <CircularProgress size={20} />}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as Error).message || "An error occurred fetching data."}</Alert>}

            <Grid2 container spacing={2} sx={{ mb: 4 }}>
                <Grid2 size={{ xs: 12, md: 4, lg: 3 }}>
                    {totalStats ? (
                        <SummaryStats title={selectedMetric ? `Total: ${selectedMetric}` : "Total Aggregations"} stats={totalStats} />
                    ) : (
                        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Typography color="textSecondary">No data</Typography>
                        </Box>
                    )}
                </Grid2>

                <Grid2 size={{ xs: 12, md: 8, lg: 9 }}>
                    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Filters & Grouping
                        </Typography>
                        <Grid2 container spacing={2} sx={{ flexGrow: 1 }}>
                            <Grid2 size={{ xs: 12, sm: 4 }}>
                                <Stack spacing={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Measure Name</InputLabel>
                                        <Select
                                            value={selectedMetric}
                                            onChange={(e) => setSelectedMetric(e.target.value)}
                                            label="Measure Name"
                                        >
                                            <MenuItem value=""><em>All Measures</em></MenuItem>
                                            {metricNames.map((name: string) => (
                                                <MenuItem key={name} value={name}>
                                                    {name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <FormControl fullWidth size="small">
                                        <InputLabel>Group By (Dimensions)</InputLabel>
                                        <Select
                                            multiple
                                            value={groupBy}
                                            onChange={handleGroupByChange}
                                            input={<OutlinedInput label="Group By (Dimensions)" />}
                                            renderValue={(selected) => (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {selected.map((value) => (
                                                        <Chip key={value} label={value} size="small" />
                                                    ))}
                                                </Box>
                                            )}
                                        >
                                            {dimensionKeys.map((key: string) => (
                                                <MenuItem key={key} value={key}>
                                                    {key}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Grid2>
                            <Grid2 size={{ xs: 12, sm: 8 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                    {dimensionKeys.map((key: string) => (
                                        <FormControl key={key} size="small" sx={{ flexGrow: 1, minWidth: 140 }}>
                                            <InputLabel>{key}</InputLabel>
                                            <Select
                                                value={filters[key] || ''}
                                                onChange={(e) => handleFilterChange(key, e.target.value)}
                                                label={key}
                                            >
                                                <MenuItem value=""><em>None</em></MenuItem>
                                                {availableValues[key]?.map(val => (
                                                    <MenuItem key={String(val)} value={val}>
                                                        {String(val)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    ))}
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setFilters({})}
                                        disabled={Object.keys(filters).length === 0}
                                        sx={{ height: 40, ml: 'auto' }}
                                    >
                                        Clear Filters
                                    </Button>
                                </Box>
                            </Grid2>
                        </Grid2>
                    </Box>
                </Grid2>
            </Grid2>

            {/* Conditionally render the grouped results area */}
            {showGroupedResults && (
                <>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
                        Grouped Results
                    </Typography>

                    <Grid2 container spacing={2}>
                        {sortedFilteredResults.length === 0 && !isPending ? (
                            <Grid2 size={{ xs: 12 }}>
                                <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
                                    <Typography color="textSecondary">No data matching filters</Typography>
                                </Box>
                            </Grid2>
                        ) : (
                            sortedFilteredResults.map((res: AggregationResult, i: number) => {
                                const label = groupBy.map(g => {
                                    const value = res[`dimensions__${g}`];
                                    return `${g}: ${value ?? 'N/A'}`;
                                }).join(' / ') || "Selection";
                                return (
                                    <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                                        <SummaryStats
                                            title={label}
                                            stats={res}
                                        />
                                    </Grid2>
                                );
                            })
                        )}
                    </Grid2>
                </>
            )}
        </Paper>
    );
};

export default MeasurementsExplorer;