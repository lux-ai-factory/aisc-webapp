import { ReactNode } from "react";
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    DialogProps,
} from "@mui/material";
import type { DialogActionsProps } from "@mui/material/DialogActions";

type AppDialogProps = Omit<DialogProps, "title"> & {
    title?: ReactNode;
    actions?: ReactNode;
    actionsSx?: DialogActionsProps["sx"];
};

/**
 * App-wide dialog shell: fixed blue title bar, white scrollable body,
 * and an optional pinned footer (actions) that always stays in view.
 */
export default function AppDialog({
    title,
    actions,
    actionsSx,
    children,
    slotProps,
    ...dialogProps
}: AppDialogProps) {
    return (
        <Dialog
            {...dialogProps}
            slotProps={{
                ...slotProps,
                paper: { className: "dialog-paper-blue" },
            }}
        >
            {title && (
                <DialogTitle sx={{ color: "white" }}>{title}</DialogTitle>
            )}
            <DialogContent className="dialog-content-white">
                {children}
            </DialogContent>
            {actions && (
                <DialogActions
                    className="app-dialog-footer"
                    sx={{
                        justifyContent: "flex-end",
                        bgcolor: "#f5f7fb",
                        borderRadius: "0 0 12px 12px",
                        margin: "0 8px 8px 8px",
                        borderTop: "1px solid #e2e8f0",
                        boxShadow: "0 -3px 6px rgba(0,0,0,0.05)",
                        padding: "16px 24px",
                        ...actionsSx,
                    }}
                >
                    {actions}
                </DialogActions>
            )}
        </Dialog>
    );
}
