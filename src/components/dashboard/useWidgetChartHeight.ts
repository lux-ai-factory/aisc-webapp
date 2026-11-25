import { useEffect, useState, type RefObject } from 'react';

/** Size plot surfaces after reserving the live widget's legends and controls.
 * Export renderers deliberately do not use this hook. */
export function useWidgetChartHeight(
    bodyRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>, enabled: boolean,
) {
    const [height, setHeight] = useState<number>();
    useEffect(() => {
        const body = bodyRef.current;
        const content = contentRef.current;
        if (!enabled || !body || !content || typeof ResizeObserver === 'undefined') return;
        let frame = 0;
        const measure = () => {
            const surfaces = [...content.querySelectorAll<SVGSVGElement>('svg.MuiChartsSurface-root')];
            if (!surfaces.length || body.clientHeight <= 0) return;
            const padding = getComputedStyle(body);
            const available = body.clientHeight - (parseFloat(padding.paddingTop) || 0)
                - (parseFloat(padding.paddingBottom) || 0);
            const surfaceHeight = surfaces.reduce((sum, svg) => sum + svg.clientHeight, 0);
            const chrome = Math.max(0, content.offsetHeight - surfaceHeight);
            setHeight(Math.max(200, Math.floor((available - chrome) / surfaces.length)));
        };
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        observer.observe(body);
        observer.observe(content);
        measure();
        return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, [bodyRef, contentRef, enabled]);
    return height;
}
