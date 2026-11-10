declare module 'react-force-graph-2d' {
    import * as React from 'react';

    interface ForceGraphProps {
        graphData: {
            nodes: Record<string, unknown>[];
            links: Record<string, unknown>[];
        };
        nodeLabel?: string | ((node: unknown) => string);
        nodeCanvasObject?: (node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => void;
        linkColor?: string | ((link: unknown) => string);
        linkDirectionalParticles?: number | ((link: unknown) => number);
        [key: string]: unknown;
    }

    const ForceGraph2D: React.FC<ForceGraphProps>;
    export default ForceGraph2D;
}
