import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import Icon from '@mui/material/Icon';

import AppDialog from './AppDialog';
import {
    applyPrefill,
    prefillQualification,
    type PrefillMode,
    type PrefillResult,
} from '../lib/qualification';

/**
 * "Upload a document" for step 1: the backend reads .pdf/.docx/.txt/.md with
 * text rules and *proposes* answers, this dialog shows them for review, and only
 * what the person keeps reaches the form. The file itself is never saved.
 */
export default function QualificationPrefill({
    open,
    pid,
    questionnaireId,
    answers,
    onClose,
    onApply,
}: {
    open: boolean;
    pid: string;
    questionnaireId?: string;
    answers: Record<string, string>;
    onClose: () => void;
    onApply: (answers: Record<string, string>) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [result, setResult] = useState<PrefillResult | null>(null);
    const [mode, setMode] = useState<PrefillMode>('empty');
    const [taken, setTaken] = useState<Record<string, boolean>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        setResult(null);
        setTaken({});
        setError('');
        setBusy(false);
        setMode('empty');
    };

    const close = () => {
        reset();
        onClose();
    };

    const read = async (file: File) => {
        setBusy(true);
        setError('');
        try {
            const body = await prefillQualification(pid, file, questionnaireId);
            setResult(body);
            setTaken(Object.fromEntries(body.proposals.map((p) => [p.field, true])));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'that file could not be read');
        } finally {
            setBusy(false);
        }
    };

    const kept = (result?.proposals ?? []).filter((p) => taken[p.field] !== false);

    return (
        <AppDialog
            open={open}
            onClose={close}
            title="Pre-fill from a document"
            maxWidth="md"
            fullWidth
            actions={
                <>
                    <Button
                        onClick={() => fileRef.current?.click()}
                        variant="outlined"
                        startIcon={<Icon>file_upload</Icon>}
                        disabled={busy}
                        sx={{ textTransform: 'none' }}
                    >
                        {result ? 'Choose another file' : 'Choose a file'}
                    </Button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.markdown"
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void read(file);
                        }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Button onClick={close} variant="outlined" sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        disabled={busy || kept.length === 0}
                        onClick={() => {
                            onApply(applyPrefill(answers, kept, mode));
                            close();
                        }}
                        sx={{ textTransform: 'none' }}
                    >
                        Fill the form
                    </Button>
                </>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Drop in a description of the system (.pdf, .docx, .txt or .md). The text is
                    read with rules only — no model — and every suggestion below is yours to
                    keep or drop. The file is not sent with the form.
                </Typography>

                {busy && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">Reading the document…</Typography>
                    </Box>
                )}
                {error && <Typography color="error">{error}</Typography>}

                {result && (
                    <>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip label={result.filename || 'document'} size="small" variant="outlined" />
                            <Chip label={`${result.characters} characters`} size="small" variant="outlined" />
                            <Chip
                                label={`${result.proposals.length} suggestion${result.proposals.length === 1 ? '' : 's'}`}
                                size="small"
                                color={result.proposals.length > 0 ? 'success' : 'default'}
                                variant="outlined"
                            />
                        </Box>

                        {result.note && <Typography color="text.secondary">{result.note}</Typography>}

                        {result.proposals.map((proposal) => (
                            <Box
                                key={proposal.field}
                                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={taken[proposal.field] !== false}
                                    onChange={(e) =>
                                        setTaken((prev) => ({
                                            ...prev,
                                            [proposal.field]: e.target.checked,
                                        }))
                                    }
                                    inputProps={{ 'aria-label': `keep ${proposal.field}` }}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={600}>
                                        {proposal.field}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        from “{proposal.matched}” · line {proposal.line}
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {proposal.value}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}

                        {result.unmatched.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Nothing found for: {result.unmatched.join(', ')}
                            </Typography>
                        )}

                        <RadioGroup
                            value={mode}
                            onChange={(e) => setMode(e.target.value as PrefillMode)}
                            row
                        >
                            <FormControlLabel
                                value="empty"
                                control={<Radio size="small" />}
                                label={<Typography variant="body2">Fill only the empty fields</Typography>}
                            />
                            <FormControlLabel
                                value="replace"
                                control={<Radio size="small" />}
                                label={<Typography variant="body2">Replace my answers</Typography>}
                            />
                        </RadioGroup>
                    </>
                )}
            </Box>
        </AppDialog>
    );
}
