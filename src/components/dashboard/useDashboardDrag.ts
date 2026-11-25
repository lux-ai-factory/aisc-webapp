import { useEffect, useRef, useState } from 'react';
import type { ResponsiveProps } from 'react-grid-layout';
import { getAllCollisions } from 'react-grid-layout/core';

export function useDashboardDrag(projectUUID: string, enabled: boolean) {
    const [dragging, setDragging] = useState(false);
    const dragPointer = useRef<MouseEvent | TouchEvent | null>(null);
    const activeProject = useRef(projectUUID);
    activeProject.current = projectUUID;
    useEffect(() => { setDragging(false); }, [projectUUID]);
    useEffect(() => {
        if (!dragging || !enabled) return;
        let frame: number;
        const track = (event: MouseEvent | TouchEvent) => { dragPointer.current = event; };
        const scroll = () => {
            if (activeProject.current !== projectUUID || !dragPointer.current) return;
            const event = dragPointer.current;
            const point = event && ('touches' in event ? event.touches[0] : event);
            if (point) {
                const root = document.scrollingElement ?? document.documentElement;
                const direction = point.clientY > window.innerHeight - 50 ? 1 : point.clientY < 50 ? -1 : 0;
                const next = Math.max(0, Math.min(root.scrollHeight - window.innerHeight, root.scrollTop + direction * 12));
                if (direction && next !== root.scrollTop) {
                    const before = root.scrollTop;
                    window.scrollBy({ top: next - before, behavior: 'instant' });
                    if (root.scrollTop !== before) {
                        // Recalculate RGL's drag coordinates after the grid moves
                        // beneath a stationary pointer, without waiting for a mouse move.
                        let move: Event;
                        if (event && 'touches' in event) {
                            move = new Event('touchmove', { bubbles: true, cancelable: true });
                            Object.defineProperties(move, {
                                touches: { value: [point] }, changedTouches: { value: [point] },
                            });
                        } else {
                            move = new MouseEvent('mousemove', {
                                bubbles: true, clientX: point.clientX, clientY: point.clientY, buttons: 1,
                            });
                        }
                        document.dispatchEvent(move);
                    }
                }
            }
            frame = requestAnimationFrame(scroll);
        };
        const stop = () => { cancelAnimationFrame(frame); dragPointer.current = null; };
        window.addEventListener('blur', stop);
        document.addEventListener('mousemove', track);
        document.addEventListener('touchmove', track, { passive: true });
        frame = requestAnimationFrame(scroll);
        return () => {
            stop();
            window.removeEventListener('blur', stop);
            document.removeEventListener('mousemove', track);
            document.removeEventListener('touchmove', track);
        };
    }, [dragging, enabled, projectUUID]);

    const onDragStart: NonNullable<ResponsiveProps['onDragStart']> = (_layout, _original, _item, _placeholder, event) => {
        dragPointer.current = event as MouseEvent | TouchEvent;
        setDragging(true);
    };
    const onDragStop: NonNullable<ResponsiveProps['onDragStop']> = (layout, original, item) => {
        dragPointer.current = null;
        const dropped = layout.find((entry) => entry.i === item?.i);
        if (original && dropped && getAllCollisions(layout, dropped).length) {
            // RGL commits this layout after the callback: restore an
            // occupied drop before it can be displayed or saved.
            dropped.x = original.x;
            dropped.y = original.y;
        }
        setDragging(false);
    };
    return { dragging, onDragStart, onDragStop };
}
