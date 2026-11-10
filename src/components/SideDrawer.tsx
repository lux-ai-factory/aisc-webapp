/**
 * SideDrawer — a general-purpose right-hand slide-in panel (the working name
 * was "CompSlide"; this is its proper name).
 *
 * Used wherever the app shows context about something you clicked: celery
 * tasks, project logs, a questionnaire's answers, a plugin's config form. It
 * is deliberately context-agnostic — the caller decides the content, whether
 * it is editable, and whether a version gutter should be shown.
 *
 * Deliberately built like the proven tasks drawer (pages/CeleryTasks.tsx):
 * a plain MUI Drawer anchored right, a stylesheet-driven paper below the
 * TopBar, and a document-level mousemove resize. No kept-mounted portals,
 * no CSS-in-JS paper overrides.
 *
 * Features:
 *  - slides in from the right (MUI Drawer, temporary so it overlays), with an
 *    optional overlay backdrop (default on);
 *  - the width is adjustable by dragging the left edge of the panel;
 *  - `mode` controls visibility of the editor footer: "view" (read-only),
 *    "edit" (Save/Cancel footer), or "static" (no footer at all);
 *  - optional `versions` gutter down the side: a clickable scroll of version
 *    numbers/labels, the chosen one highlighted; callers pick what a click
 *    does (switch content, scroll to a version, ...);
 *  - keyboard accessible (Esc to close).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Drawer from '@mui/material/Drawer';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import './SideDrawer.css';

export type SideDrawerMode = 'view' | 'edit' | 'static';

export interface VersionEntry {
    label: string;
    /** client key; the selected version is compared against this */
    id?: string;
}

/** Default panel width: half the viewport, like the tasks drawer. */
function viewportWidth(fraction: number): number {
    return Math.round((typeof window !== 'undefined' ? window.innerWidth : 1280) * fraction);
}

function defaultDrawerWidth(
    defaultWidth: number | undefined,
    minWidth: number | undefined,
    maxWidth: number | undefined,
): number {
    const base = defaultWidth && defaultWidth > 0 ? defaultWidth : viewportWidth(0.5);
    const min = minWidth && minWidth > 0 ? minWidth : viewportWidth(0.4);
    const max = maxWidth && maxWidth > 0 ? maxWidth : viewportWidth(0.8);
    return Math.max(min, Math.min(max, base));
}

export interface SideDrawerProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    /** the panel content */
    children: React.ReactNode;
    /** controls whether the editor footer is shown (default 'view') */
    mode?: SideDrawerMode;
    /** optional version gutter */
    versions?: VersionEntry[];
    selectedVersionId?: string;
    onSelectVersion?: (version: VersionEntry, index: number) => void;
    /** See how a version looks without selecting it (checkbox selects). */
    onPreviewVersion?: (version: VersionEntry, index: number) => void;
    /** editor footer + callbacks (used when mode === 'edit') */
    onSave?: () => void;
    onCancel?: () => void;
    /** label for the editor-footer cancel button (default 'Cancel') */
    cancelLabel?: string;
    /** label for the editor-footer save button (default 'Save') */
    saveLabel?: string;
    /** extra actions rendered on the left side of the editor footer */
    footerActions?: React.ReactNode;
    /** initial width in px (default half the viewport) */
    defaultWidth?: number;
    /** minimum width in px (default 40% of the viewport) */
    minWidth?: number;
    /** maximum width in px (default 80% of the viewport) */
    maxWidth?: number;
    /** show the overlay backdrop (default true) */
    withBackdrop?: boolean;
    /** heading slot placed in the header, next to the title (e.g. an info chip) */
    headerAction?: React.ReactNode;
    className?: string;
}

export default function SideDrawer({
    open,
    onClose,
    title,
    children,
    mode = 'view',
    versions,
    selectedVersionId,
    onSelectVersion,
    onPreviewVersion,
    onSave,
    onCancel,
    cancelLabel = 'Cancel',
    saveLabel = 'Save',
    footerActions,
    defaultWidth,
    minWidth,
    maxWidth,
    withBackdrop = true,
    headerAction,
    className,
}: SideDrawerProps) {
    const [width, setWidth] = useState(() => defaultDrawerWidth(defaultWidth, minWidth, maxWidth));
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const [versionOpen, setVersionOpen] = useState(false);
    const versionAnchorRef = useRef<HTMLButtonElement>(null);

    // Re-latch width when the default changes while closed.
    useEffect(() => {
        if (!open) setWidth(defaultDrawerWidth(defaultWidth, minWidth, maxWidth));
    }, [open, defaultWidth, minWidth, maxWidth]);

    const clamp = useCallback(
        (w: number) => {
            const min = minWidth && minWidth > 0 ? minWidth : viewportWidth(0.4);
            const max = maxWidth && maxWidth > 0 ? maxWidth : viewportWidth(0.8);
            return Math.max(min, Math.min(max, w));
        },
        [minWidth, maxWidth],
    );

    /*
     * Drawer resize.
     *
     * The drawer is anchored to the right:
     *
     *   mouse moves LEFT  -> drawer gets wider
     *   mouse moves RIGHT -> drawer gets narrower
     */
    const handleDrawerResize = useCallback(
        (event: MouseEvent) => {
            if (!dragRef.current) return;
            const diff = dragRef.current.startX - event.clientX;
            setWidth(clamp(dragRef.current.startWidth + diff));
        },
        [clamp],
    );

    const stopDrawerResize = useCallback(() => {
        dragRef.current = null;
        document.removeEventListener('mousemove', handleDrawerResize);
        document.removeEventListener('mouseup', stopDrawerResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [handleDrawerResize]);

    const startDrawerResize = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = { startX: event.clientX, startWidth: width };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleDrawerResize);
        document.addEventListener('mouseup', stopDrawerResize);
    };

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleDrawerResize);
            document.removeEventListener('mouseup', stopDrawerResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [handleDrawerResize, stopDrawerResize]);

    const gutter = versions ?? [];
    const selectedLabel = gutter.find((v) => v.id === selectedVersionId)?.label ?? '';

    // Esc closes.
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const editable = mode === 'edit';

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            variant="temporary"
            hideBackdrop={!withBackdrop}
            disableEnforceFocus
            disableRestoreFocus
            PaperProps={{
                className: ['side-drawer-paper', className].filter(Boolean).join(' '),
                style: { width },
            }}
        >
            <Box className="side-drawer-layout">
                <Box className="side-drawer-main">
                    <Box
                        className="side-drawer-resize-handle"
                        onMouseDown={startDrawerResize}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize panel"
                    />
                    <Box className="side-drawer-header">
                        <Box
                            component="span"
                            sx={{
                                width: 8,
                                height: 28,
                                borderRadius: 1,
                                background: 'linear-gradient(180deg, #57a8ff, #0d47b8)',
                                flexShrink: 0,
                            }}
                        />
                        <Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0, fontWeight: 600 }}>
                            {title}
                        </Typography>
                        {gutter.length > 0 && (
                            <Box sx={{ mr: 1 }}>
                                <Button
                                    ref={versionAnchorRef}
                                    size="small"
                                    variant="outlined"
                                    endIcon={<Icon fontSize="small">arrow_drop_down</Icon>}
                                    onClick={() => setVersionOpen(true)}
                                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                    {selectedLabel || gutter[0]?.label || 'Version'}
                                </Button>
                                <Menu
                                    open={versionOpen}
                                    onClose={() => setVersionOpen(false)}
                                    anchorEl={versionAnchorRef.current}
                                    slotProps={{ paper: { style: { maxHeight: 320, width: 280 } } }}
                                >
                                    {gutter.map((v, index) => {
                                        const selected = !!selectedVersionId && v.id === selectedVersionId;
                                        return (
                                            <MenuItem key={v.id ?? `${v.label}-${index}`} sx={{ px: 1.5, py: 0.5 }}>
                                                <Checkbox
                                                    size="small"
                                                    color="success"
                                                    checked={selected}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={() => {
                                                        onSelectVersion?.(v, index);
                                                        setVersionOpen(false);
                                                    }}
                                                />
                                                <Box
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPreviewVersion?.(v, index);
                                                        setVersionOpen(false);
                                                    }}
                                                    sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }}
                                                >
                                                    <Typography variant="body2" noWrap>
                                                        {v.label}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        );
                                    })}
                                </Menu>
                            </Box>
                        )}
                        {headerAction}
                        <IconButton onClick={onClose} aria-label="Close panel" size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Box className="side-drawer-body">{children}</Box>

                    {(editable || footerActions) && (
                        <Box className="side-drawer-footer">
                            {footerActions && (
                                <Box
                                    sx={{
                                        // Left when the edit footer (Cancel/Save) takes the
                                        // right side; otherwise the footer right-aligns it.
                                        mr: editable ? 'auto' : 0,
                                        display: 'flex',
                                        gap: 1,
                                        alignItems: 'center',
                                    }}
                                >
                                    {footerActions}
                                </Box>
                            )}
                            {editable && (
                                <>
                                    <Button
                                        onClick={onCancel}
                                        variant="outlined"
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {cancelLabel}
                                    </Button>
                                    <Button
                                        onClick={onSave}
                                        variant="contained"
                                        className="gradient-btn"
                                        sx={{ textTransform: 'none' }}
                                    >
                                        {saveLabel}
                                    </Button>
                                </>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
