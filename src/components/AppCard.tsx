import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

/**
 * A grid card following DESIGN.md section 4: stretches to its cell, title and
 * body on top, chips/actions pinned to the bottom row.
 * `active` picks the enabled/selected surface (gradient-card); otherwise the
 * default surface (plugins-card).
 */
export default function AppCard({
    active = false,
    theme,
    onClick,
    header,
    footer,
    children,
}: {
    active?: boolean;
    theme?: 'catalogue';
    onClick?: () => void;
    header?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
}) {
    const catalogueTheme = theme === 'catalogue';
    const className = catalogueTheme
        ? `catalogue-card${active ? ' is-enabled' : ''}`
        : active
          ? 'gradient-card'
          : 'plugins-card';
    return (
        <Card
            variant="outlined"
            className={className}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            } : undefined}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: onClick ? 'pointer' : undefined,
            }}
        >
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {header}
                {children}
                {footer && (
                    <Box
                        sx={{
                            mt: 'auto',
                            pt: 1,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        {footer}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
