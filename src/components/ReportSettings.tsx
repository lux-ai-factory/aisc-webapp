import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
    REPORT_SECTIONS,
    cleanSections,
    getReportSettings,
    setReportSettings,
} from '../lib/report';
import '../styles/common.css';

export default function ReportSettings({ projectPid }: { projectPid: string }) {
    const [format, setFormat] = useState('pdf');
    const [sections, setSections] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        getReportSettings(projectPid)
            .then((settings) => {
                if (!alive) return;
                setFormat(settings?.default_format === 'html' ? 'html' : 'pdf');
                setSections(cleanSections(settings?.default_sections ?? []));
                setLoading(false);
            })
            .catch((e: unknown) => {
                if (!alive) return;
                setError(e instanceof Error ? e.message : 'failed to load report settings');
                setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [projectPid]);

    if (loading) return <CircularProgress size={24} />;

    const toggle = (section: string) => {
        setSaved(false);
        setSections((prev) =>
            prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
        );
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const updated = await setReportSettings(projectPid, {
                default_format: format,
                default_sections: cleanSections(sections),
            });
            setFormat(updated.default_format);
            setSections(cleanSections(updated.default_sections));
            setSaved(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'could not save report settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: 'primary.main', display: 'flex' }}>
                        <Icon>description</Icon>
                    </Box>
                    <Typography component="h3" variant="h5">
                        Report settings
                    </Typography>
                </Stack>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    disabled={saving}
                    onClick={() => void save()}
                    sx={{ textTransform: 'none' }}
                >
                    <Icon sx={{ fontSize: '1.15rem' }}>save</Icon>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </Stack>
            <Typography variant="body1" color="text.secondary">
                Defaults used when generating a report without picking a format or
                sections. No sections selected means all sections.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mt: 1.5 }}>
                <TextField
                    select
                    label="Default format"
                    value={format}
                    size="small"
                    sx={{ minWidth: 160 }}
                    onChange={(e) => {
                        setFormat(e.target.value);
                        setSaved(false);
                    }}
                >
                    <MenuItem value="pdf">PDF</MenuItem>
                    <MenuItem value="html">HTML</MenuItem>
                </TextField>
                {REPORT_SECTIONS.map((section) => (
                    <FormControlLabel
                        key={section}
                        control={
                            <Checkbox
                                size="small"
                                checked={sections.includes(section)}
                                onChange={() => toggle(section)}
                            />
                        }
                        label={section}
                    />
                ))}
            </Box>
            {saved && (
                <Typography color="success.main" variant="body2" sx={{ mt: 1 }}>
                    Report settings saved.
                </Typography>
            )}
            {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
}
