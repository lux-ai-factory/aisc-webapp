import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { REPORT_SECTIONS } from '../lib/report';

export const FONT_CHOICES = [
    { id: 'inter', label: 'Inter' },
    { id: 'liberation-sans', label: 'Liberation Sans (Arial)' },
    { id: 'liberation-serif', label: 'Liberation Serif (Times)' },
    { id: 'roboto', label: 'Roboto' },
    { id: 'dejavu-sans', label: 'DejaVu Sans' },
    { id: 'dejavu-serif', label: 'DejaVu Serif' },
] as const;

export const MARKING_CHOICES = [
    { id: 'none', label: 'None' },
    { id: 'public', label: 'Public' },
    { id: 'internal', label: 'Internal' },
    { id: 'confidential', label: 'Confidential' },
    { id: 'strictly_confidential', label: 'Strictly confidential' },
] as const;

export type ReportSettingsDraft = {
    default_format: string;
    default_sections: string[];
    report_title: string;
    subtitle: string;
    primary_color: string;
    accent_color: string;
    font: string;
    font_size_pt: number;
    header_text: string;
    footer_text: string;
    marking: string;
    show_document_id: boolean;
    logo: { mime: string; data_base64: string } | null;
};

export const DEFAULT_LOGO_LIMIT = 1_000_000;

/** Read a chosen file into {mime, data_base64} (base64 payload of a logo). */
function readLogo(file: File): Promise<{ mime: string; data_base64: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('could not read the logo'));
        reader.onload = () => {
            const dataUrl = String(reader.result ?? '');
            resolve({
                mime: file.type || 'image/png',
                data_base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
            });
        };
        reader.readAsDataURL(file);
    });
}

/** The report customisation, as a controlled form: the generate dialog owns the
 *  value and saves it when a report is generated, so the next one reuses it. */
export default function ReportSettings({
    value,
    onChange,
}: {
    value: ReportSettingsDraft;
    onChange: (next: ReportSettingsDraft) => void;
}) {
    const set = (patch: Partial<ReportSettingsDraft>) => onChange({ ...value, ...patch });

    const pickLogo = (file: File | null) => {
        if (!file || file.size > DEFAULT_LOGO_LIMIT) {
            // a logo over 1 MB is dropped (the backend holds the same cap)
            return;
        }
        void readLogo(file).then(
            (logo) => set({ logo }),
            () => undefined,
        );
    };

    return (
        <Box>
            <Typography variant="subtitle1">Customisation</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <TextField
                    label="Report title"
                    size="small"
                    value={value.report_title}
                    placeholder="AI system assessment report"
                    onChange={(e) => set({ report_title: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    sx={{ flex: '1 1 280px', maxWidth: 420 }}
                />
                <TextField
                    label="Subtitle"
                    size="small"
                    value={value.subtitle}
                    placeholder="Assessment period or scope"
                    onChange={(e) => set({ subtitle: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 300 } }}
                    sx={{ flex: '1 1 280px', maxWidth: 420 }}
                />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <TextField
                    label="Primary colour"
                    type="color"
                    size="small"
                    value={value.primary_color}
                    onChange={(e) => set({ primary_color: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 170 }}
                />
                <TextField
                    label="Accent colour"
                    type="color"
                    size="small"
                    value={value.accent_color}
                    onChange={(e) => set({ accent_color: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 170 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', maxWidth: 220 }}>
                    LAIF default palette: blue #000fdf · pink #ff007e
                </Typography>
            </Stack>

            <Typography variant="subtitle1" sx={{ mt: 3 }}>
                Look and page
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <TextField
                    select
                    label="Font"
                    size="small"
                    value={value.font}
                    sx={{ minWidth: 220 }}
                    onChange={(e) => set({ font: e.target.value })}
                >
                    {FONT_CHOICES.map((f) => (
                        <MenuItem key={f.id} value={f.id}>{f.label}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    label="Font size (pt)"
                    type="number"
                    size="small"
                    value={value.font_size_pt}
                    onChange={(e) => set({ font_size_pt: Number(e.target.value || 8) })}
                    slotProps={{ htmlInput: { min: 8, max: 16, step: 0.5 } }}
                    sx={{ width: 130 }}
                />
                <TextField
                    select
                    label="Marking"
                    size="small"
                    value={value.marking}
                    sx={{ minWidth: 180 }}
                    onChange={(e) => set({ marking: e.target.value })}
                >
                    {MARKING_CHOICES.map((m) => (
                        <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                    ))}
                </TextField>
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <TextField
                    label="Page header"
                    size="small"
                    value={value.header_text}
                    placeholder="ACME internal"
                    onChange={(e) => set({ header_text: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                    sx={{ flex: '1 1 280px', maxWidth: 420 }}
                />
                <TextField
                    label="Page footer"
                    size="small"
                    value={value.footer_text}
                    placeholder="Confidential"
                    onChange={(e) => set({ footer_text: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                    sx={{ flex: '1 1 280px', maxWidth: 420 }}
                />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 2 }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={value.show_document_id}
                            onChange={(e) => set({ show_document_id: e.target.checked })}
                        />
                    }
                    label="Show document id and fingerprint"
                />
                <Button component="label" size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                    Upload logo
                    <input
                        type="file"
                        hidden
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            void pickLogo(file);
                            e.target.value = '';
                        }}
                    />
                </Button>
                {value.logo && (
                    <Button size="small" color="error" sx={{ textTransform: 'none' }} onClick={() => set({ logo: null })}>
                        Remove logo
                    </Button>
                )}
            </Stack>

            <Typography variant="subtitle1" sx={{ mt: 3 }}>
                Format and sections
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mt: 1.5 }}>
                <TextField
                    select
                    label="Format"
                    value={value.default_format}
                    size="small"
                    sx={{ minWidth: 160 }}
                    onChange={(e) => set({ default_format: e.target.value })}
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
                                checked={value.default_sections.includes(section)}
                                onChange={() =>
                                    set({
                                        default_sections: value.default_sections.includes(section)
                                            ? value.default_sections.filter((s) => s !== section)
                                            : [...value.default_sections, section],
                                    })
                                }
                            />
                        }
                        label={section}
                    />
                ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
                Saved when you generate, so the next report starts with these values.
            </Typography>
        </Box>
    );
}
