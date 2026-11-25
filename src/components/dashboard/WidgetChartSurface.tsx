import { useRef, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import { useWidgetChartHeight } from './useWidgetChartHeight';

/** Live dashboard/preview sizing; exports use their own fixed-size renderer. */
export default function WidgetChartSurface({ children, enabled = true }: {
    children: (height: number | undefined) => ReactNode;
    enabled?: boolean;
}) {
    const body = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const height = useWidgetChartHeight(body, content, enabled);
    return <Box ref={body} className="grid-widget-body">
        {enabled ? <Box ref={content} className="dashboard-chart-content">{children(height)}</Box> : children(undefined)}
    </Box>;
}
