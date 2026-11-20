// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { vizToChartFields } from '../../lib/dashboardCharts';
import type { MetricVisualization } from '../../models/models';

describe('vizToChartFields', () => {
    it('maps a plugin default chart onto builder fields', () => {
        const viz: MetricVisualization = {
            chart_type: 'radar',
            metrics: ['accuracy', 'recall'],
            title: 'Model radar',
            filter_dimensions: { model: ['m1'] },
            group_by_dimensions: ['category'],
            metric_label_dimension: 'metric',
            facet_by_dimension: ['fold'],
        };
        expect(vizToChartFields(viz)).toEqual({
            chartType: 'radar',
            metrics: ['accuracy', 'recall'],
            title: 'Model radar',
            filters: { model: ['m1'] },
            groupBy: ['category'],
            labelDim: 'metric',
            facetDim: 'fold',
        });
    });

    it('defaults cleanly when optional fields are missing', () => {
        expect(vizToChartFields({ chart_type: 'line', metrics: [] })).toEqual({
            chartType: 'line',
            metrics: [],
            title: '',
            filters: {},
            groupBy: [],
            labelDim: '',
            facetDim: '',
        });
    });
});
