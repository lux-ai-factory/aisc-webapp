/**
 * PagePlaceholder — the "under construction" page shown for routes whose full
 * content lands in a later WP8 unit (Qualification, Checklists, Sandbox,
 * Dashboard, Report). Each page stub named after its route renders this with
 * its title until the real unit (W3–W11) replaces it.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ConstructionIcon from '@mui/icons-material/Construction';

interface PagePlaceholderProps {
    title: string;
    description?: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
    return (
        <Box sx={{ py: 6, textAlign: 'center' }}>
            <ConstructionIcon sx={{ fontSize: 56, color: '#94a3b8' }} />
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 700, color: 'text.primary' }}>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                    {description}
                </Typography>
            )}
            <Typography variant="caption" sx={{ mt: 3, display: 'block', color: 'text.disabled' }}>
                This section is still under construction.
            </Typography>
        </Box>
    );
}
