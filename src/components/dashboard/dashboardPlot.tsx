import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
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

/** Render one metric visualization on combined (multi-evaluation) measurements.
 *  `__eval` is always added to the grouping so each evaluation becomes its own series. */
export function renderVisualization(
    data: Measurement[],
    viz: MetricVisualization,
    labelOverrides?: Record<string, string>,
    seriesOrder?: string[],
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
    if (!groupBy.includes(EVAL_DIM_KEY)) groupBy.push(EVAL_DIM_KEY);
    const labelDim = viz.metric_label_dimension || undefined;
    const facet = viz.facet_by_dimension?.[0];
    const title = viz.title || undefined;
    const description = viz.description || undefined;
    const chartProps = { title, description, data: filtered, metricLabelDimension: labelDim, groupByDimensions: groupBy };

    switch (viz.chart_type) {
        case 'line':
            return <MeasurementsLineChart {...chartProps} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'scatter':
            return <MeasurementsScatterChart {...chartProps} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'kde':
            return <MeasurementsKDEChart {...chartProps} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'bars':
            return <MeasurementsBarsChart {...chartProps} facetByDimension={facet} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'radar':
            return <MeasurementsRadarChart {...chartProps} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'pie':
            return <MeasurementsPieChart {...chartProps} labelOverrides={labelOverrides} seriesOrder={seriesOrder} />;
        case 'table':
        default:
            return <MeasurementsDataGrid title={title} description={description} data={filtered} />;
    }
}
