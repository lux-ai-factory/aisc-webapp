import { ReactNode, useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import '../styles/common.css';
import './SplitPaneDialog.css';

/** One master-pane entry; `content` is shown in the detail pane when selected. */
export interface SplitPaneItem {
    id: string;
    label: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    /** Secondary indicator on the list row, e.g. a green check or version chip. */
    badge?: ReactNode;
    disabled?: boolean;
    content?: ReactNode;
}

export interface SplitPaneDialogProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    items: SplitPaneItem[];
    /** Initial selection for uncontrolled usage; defaults to the first enabled item. */
    defaultSelectedId?: string | null;
    /** Controlled selection (updates the parent instead of internal state). */
    selectedId?: string | null;
    onSelectedChange?: (id: string) => void;
    /** Optional element rendered on top of the master list (e.g. an Add button). */
    navAction?: ReactNode;
    /** Optional footer actions, styled like AppDialog's footer. */
    actions?: ReactNode;
    /** Replace the detail pane content entirely (e.g. an inline editor form). */
    detailOverride?: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
    /** Width of the master pane in px. */
    navWidth?: number;
    emptyText?: ReactNode;
}

function firstEnabledId(items: SplitPaneItem[]): string | null {
    const first = items.find((i) => !i.disabled);
    return first ? first.id : null;
}

function isValid(items: SplitPaneItem[], id: string | null): id is string {
    return id !== null && items.some((i) => i.id === id && !i.disabled);
}

/**
 * Reusable master–detail dialog: a list of items on the left whose detail
 * content renders on the right without closing the dialog. Visually consistent
 * with AppDialog (blue title bar, white body inset on the blue paper, app
 * standard footer buttons).
 */
export default function SplitPaneDialog({
    open,
    onClose,
    title,
    items,
    defaultSelectedId = null,
    selectedId: controlled,
    onSelectedChange,
    navAction,
    actions,
    detailOverride,
    maxWidth = 'md',
    navWidth = 260,
    emptyText = 'No items.',
}: SplitPaneDialogProps) {
    const [internal, setInternal] = useState<string | null>(null);

    const select = (id: string) => {
        setInternal(id);
        if (onSelectedChange) onSelectedChange(id);
    };

    // Seed the uncontrolled selection when the dialog opens / items arrive,
    // keeping the current choice when it is still valid.
    useEffect(() => {
        if (!open) return;
        setInternal((prev) =>
            isValid(items, prev)
                ? prev
                : defaultSelectedId !== null && isValid(items, defaultSelectedId)
                  ? defaultSelectedId
                  : firstEnabledId(items),
        );
    }, [open, items, defaultSelectedId]);

    const selectedId = controlled ?? internal;
    const effective = isValid(items, selectedId) ? selectedId : firstEnabledId(items);
    const selected = items.find((i) => i.id === effective) ?? null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth={maxWidth}
            slotProps={{ paper: { className: 'dialog-paper-blue' } }}
        >
            {title && <DialogTitle sx={{ color: 'white' }}>{title}</DialogTitle>}
            <Box className="split-pane-body">
                <Box
                    component="nav"
                    className="split-pane-nav"
                    style={{ width: navWidth }}
                    aria-label="Split pane sections"
                >
                    {navAction && <Box className="split-pane-nav-action">{navAction}</Box>}
                    {items.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                            {emptyText}
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {items.map((item) => {
                                const isCurrent = item.id === effective;
                                return (
                                    <ListItemButton
                                        key={item.id}
                                        disabled={item.disabled}
                                        selected={isCurrent}
                                        onClick={() => select(item.id)}
                                        aria-current={isCurrent ? 'true' : undefined}
                                        className={isCurrent ? 'split-pane-item-selected' : undefined}
                                    >
                                        {item.icon && (
                                            <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                                        )}
                                        <ListItemText primary={item.label} secondary={item.description} />
                                        {item.badge}
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    )}
                </Box>
                <Box className="split-pane-detail" role="tabpanel" aria-label="Detail">
                    {detailOverride ?? selected?.content ?? (
                        <Typography color="text.secondary">{emptyText}</Typography>
                    )}
                </Box>
            </Box>
            {actions && (
                <DialogActions
                    className="app-dialog-footer"
                    sx={{
                        justifyContent: 'flex-end',
                        bgcolor: '#f5f7fb',
                        borderRadius: '0 0 12px 12px',
                        margin: '0 8px 8px 8px',
                        borderTop: '1px solid #e2e8f0',
                        boxShadow: '0 -3px 6px rgba(0,0,0,0.05)',
                        padding: '16px 24px',
                    }}
                >
                    {actions}
                </DialogActions>
            )}
        </Dialog>
    );
}
