import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Grid,
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
} from '../../api/api';

const getScoreColor = (score: number | null) => {
    if (score === null) return '#ddd';
    // If the score is between 0 and 1, we assume it's a percentage where higher is better
    if (score >= 0 && score <= 1) {
        if (score > 0.8) return '#4caf50'; // Green
        if (score > 0.5) return '#ff9800'; // Orange
        return '#f44336'; // Red
    }
    // For non-percentage scores (e.g. > 1 or < 0), we use a neutral blue
    return '#2196f3'; // Blue
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
                            [`& .MuiGauge-valueArc`]: {
                                fill: color,
                            },
                            [`& .MuiGauge-valueText`]: {
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                </Box>
                <Grid container spacing={1} sx={{ flexGrow: 1 }}>
                    <Grid item xs={6}>
                        <Typography variant="caption" display="block" color="textSecondary">Count</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{stats.count}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" display="block" color="textSecondary">Avg</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {isPercentage 
                                ? avgScore.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })
                                : avgScore.toFixed(3)
                            }
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" display="block" color="textSecondary">Min</Typography>
                        <Typography variant="body2">{(stats.min_score || 0).toFixed(3)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" display="block" color="textSecondary">Max</Typography>
                        <Typography variant="body2">{(stats.max_score || 0).toFixed(3)}</Typography>
                    </Grid>
                </Grid>
            </Stack>
        </Paper>
    );
};

interface MeasurementsExplorerProps {
    evaluationPid: string;
    evaluationPluginPid?: string;
}

export const MeasurementsExplorer: React.FC<MeasurementsExplorerProps> = ({ evaluationPid, evaluationPluginPid }) => {
    const [dimensionKeys, setDimensionKeys] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [availableValues, setAvailableValues] = useState<Record<string, any[]>>({});
    const [metricNames, setMetricNames] = useState<string[]>([]);
    const [selectedMetric, setSelectedMetric] = useState<string>('');
    const [totalStats, setTotalStats] = useState<AggregationResult | null>(null);
    const [filteredResults, setFilteredResults] = useState<AggregationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load of keys and total stats
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);
            try {
                // Load metric names
                const { names } = await getEvaluationMetricNames(evaluationPid, evaluationPluginPid);
                setMetricNames(names);

                // Load keys
                const { keys } = await getEvaluationDimensionKeys(evaluationPid, evaluationPluginPid, selectedMetric);
                setDimensionKeys(keys);
                
                // Load values for filters
                keys.forEach(async (key) => {
                    const { values } = await getEvaluationDimensionValues(evaluationPid, key, evaluationPluginPid, selectedMetric);
                    setAvailableValues(prev => ({ ...prev, [key]: values }));
                });

                const { results: totalResults } = await aggregateEvaluationMeasurements(evaluationPid, {
                    evaluation_plugin_pid: evaluationPluginPid,
                    metric_name: selectedMetric,
                    aggregations: ['avg_score', 'count', 'min_score', 'max_score']
                });
                if (totalResults.length > 0) {
                    setTotalStats(totalResults[0]);
                }

            } catch (err) {
                console.error("Initialization failed", err);
                setError("Failed to load evaluation data.");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [evaluationPid, evaluationPluginPid, selectedMetric]);

    // Update filtered results when filters or groupBy change
    useEffect(() => {
        const updateFiltered = async () => {
            setLoading(true);
            try {
                const { results } = await aggregateEvaluationMeasurements(evaluationPid, {
                    evaluation_plugin_pid: evaluationPluginPid,
                    metric_name: selectedMetric,
                    group_by: groupBy,
                    filters: filters,
                    aggregations: ['avg_score', 'count', 'min_score', 'max_score']
                });
                setFilteredResults(results);
                setError(null);
            } catch (err) {
                console.error("Filtered aggregation failed", err);
                setError("Failed to update grouped results.");
            } finally {
                setLoading(false);
            }
        };
        updateFiltered();
    }, [evaluationPid, evaluationPluginPid, selectedMetric, filters, groupBy]);

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
                {loading && <CircularProgress size={20} />}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4} lg={3}>
                    {totalStats ? (
                        <SummaryStats title={selectedMetric ? `Total: ${selectedMetric}` : "Total Aggregations"} stats={totalStats} />
                    ) : (
                        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Typography color="textSecondary">No data</Typography>
                        </Box>
                    )}
                </Grid>
                
                <Grid item xs={12} md={8} lg={9}>
                    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Filters & Grouping
                        </Typography>
                        <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                            <Grid item xs={12} sm={4}>
                                <Stack spacing={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Measure Name</InputLabel>
                                        <Select
                                            value={selectedMetric}
                                            onChange={(e) => setSelectedMetric(e.target.value)}
                                            label="Measure Name"
                                        >
                                            <MenuItem value=""><em>All Measures</em></MenuItem>
                                            {metricNames.map((name) => (
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
                                            {dimensionKeys.map((key) => (
                                                <MenuItem key={key} value={key}>
                                                    {key}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm={8}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                    {dimensionKeys.map(key => (
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
                                        onClick={() => {
                                            setFilters({});
                                        }}
                                        disabled={Object.keys(filters).length === 0}
                                        sx={{ height: 40, ml: 'auto' }}
                                    >
                                        Clear Filters
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
                Grouped Results
            </Typography>

            <Grid container spacing={2}>
                {filteredResults.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
                            <Typography color="textSecondary">No data matching filters</Typography>
                        </Box>
                    </Grid>
                ) : (
                    filteredResults.map((res, i) => {
                        const label = groupBy.map(g => {
                            const value = res[`dimensions__${g}`];
                            return `${g}: ${value ?? 'N/A'}`;
                        }).join(' / ') || "Selection";
                        return (
                            <Grid item key={i} xs={12} sm={6} md={4}>
                                <SummaryStats 
                                    title={label} 
                                    stats={res} 
                                />
                            </Grid>
                        );
                    })
                )}
            </Grid>
        </Paper>
    );
};

export default MeasurementsExplorer;
