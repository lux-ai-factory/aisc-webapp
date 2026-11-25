import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MeasurementsDataGrid from '../plugin/MeasurementsDataGrid';
import MeasurementsLineChart from '../plugin/MeasurementsLineChart';
import MeasurementsScatterChart from '../plugin/MeasurementsScatterChart';
import MeasurementsRadarChart from '../plugin/MeasurementsRadarChart';
import MeasurementsKDEChart from '../plugin/MeasurementsKDEChart';
import MeasurementsBarsChart from '../plugin/MeasurementsBarsChart';
import MeasurementsPieChart from '../plugin/MeasurementsPieChart';
import type { Measurement, MetricVisualization } from '../../models/models';
import { EVAL_DIM_KEY, selectMeasurements, type GridWidget } from '../../lib/dashboardCharts';

/** Map a chart widget's fields back to a metric visualization. */
export function chartWidgetToViz(widget: GridWidget): MetricVisualization {
    return {
        chart_type: widget.chartType ?? 'table',
        metrics: widget.metrics ?? [],
        filter_dimensions: widget.filters && Object.keys(widget.filters).length ? widget.filters : undefined,
        metric_label_dimension: widget.labelDim || undefined,
        group_by_dimensions: widget.groupBy && widget.groupBy.length ? widget.groupBy : undefined,
        facet_by_dimension: widget.facetDim ? [widget.facetDim] : undefined,
    };
}

/** Split a visualization into one chart per facet value (generic faceting for every
 *  chart type; bars instead uses its own built-in facet rendering with compact sizing). */
function renderFaceted(
    filtered: Measurement[],
    facet: string,
    renderOne: (data: Measurement[]) => ReactNode,
): ReactNode {
    const values = Array.from(
        new Set(filtered.map((m) => m.dimensions?.[facet]).filter((v) => v !== undefined && v !== null).map(String)),
    ).sort();
    if (values.length === 0) return renderOne(filtered);
    return (
        <Box>
            {values.map((value) => (
                <Box key={value} sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                        {facet}: {value}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({filtered.filter((m) => String(m.dimensions?.[facet]) === value).length} measurements)
                        </Typography>
                    </Typography>
                    {renderOne(filtered.filter((m) => String(m.dimensions?.[facet]) === value))}
                </Box>
            ))}
        </Box>
    );
}

/** Render one metric visualization on combined (multi-evaluation) measurements.
 *  `__eval` is always added to the grouping so each evaluation becomes its own series. */
export function renderVisualization(
    data: Measurement[],
    viz: MetricVisualization,
    labelOverrides?: Record<string, string>,
    seriesOrder?: string[],
    height?: number,
    compact?: boolean,
    groupByEvaluation = true,
): ReactNode {
    const filtered = selectMeasurements(data, viz.metrics ?? [], viz.filter_dimensions ?? {});
    if (filtered.length === 0) {
        return (
            <Alert severity="warning" sx={{ my: 2 }}>
                No matching measurements for the selected metrics/filters in these evaluations.
            </Alert>
        );
    }

    const groupBy: string[] = [...(viz.group_by_dimensions ?? [])];
    if (groupByEvaluation && !groupBy.includes(EVAL_DIM_KEY)) groupBy.push(EVAL_DIM_KEY);
    const labelDim = viz.metric_label_dimension || undefined;
    const facet = viz.facet_by_dimension?.[0];
    const title = viz.title || undefined;
    const description = viz.description || undefined;
    const chartProps = { title, description, metricLabelDimension: labelDim, groupByDimensions: groupBy };

    const renderOne = (d: Measurement[]): ReactNode => {
        switch (viz.chart_type) {
            case 'line':
                return <MeasurementsLineChart {...chartProps} data={d} height={height} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'scatter':
                return <MeasurementsScatterChart {...chartProps} data={d} height={height} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'kde':
                return <MeasurementsKDEChart {...chartProps} data={d} height={height} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'bars':
                return <MeasurementsBarsChart {...chartProps} data={d} facetByDimension={facet} height={height} compact={compact} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'radar':
                return <MeasurementsRadarChart {...chartProps} data={d} height={height} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'pie':
                return <MeasurementsPieChart {...chartProps} data={d} height={height} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
            case 'table':
            default:
                return <MeasurementsDataGrid title={title} description={description} data={d} />;
        }
    };

    if (facet && viz.chart_type !== 'bars') {
        return renderFaceted(filtered, facet, renderOne);
    }
    return renderOne(filtered);
}
