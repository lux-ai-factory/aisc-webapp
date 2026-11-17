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
    type QualificationBlocks,
} from '../lib/qualification';

/**
 * "Upload a document" for step 1: the backend reads .pdf/.docx/.txt/.md with the
 * pilot's text rules — no model — and *proposes* answers, the profile block, the
 * tag sets and the risk rows; this dialog shows them for review, and only what
 * the person keeps reaches the form. The file itself is never saved.
 *
 * The merge is the backend's: the form as it stands and the chosen mode go with
 * the file, and what comes back is the form after the merge. The dialog only
 * *vetoes* — a suggestion the person unticked is put back the way it was.
 */
export default function QualificationPrefill({
    open,
    pid,
    questionnaireId,
    answers,
    blocks,
    onClose,
    onApply,
}: {
    open: boolean;
    pid: string;
    questionnaireId?: string;
    answers: Record<string, string>;
    blocks: QualificationBlocks;
    onClose: () => void;
    onApply: (answers: Record<string, string>, blocks: QualificationBlocks) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<PrefillResult | null>(null);
    const [mode, setMode] = useState<PrefillMode>('empty');
    const [taken, setTaken] = useState<Record<string, boolean>>({});
    const [withBlocks, setWithBlocks] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        setFile(null);
        setResult(null);
        setTaken({});
        setWithBlocks(true);
        setError('');
        setBusy(false);
        setMode('empty');
    };

    const close = () => {
        reset();
        onClose();
    };

    const read = async (chosen: File, chosenMode: PrefillMode) => {
        setBusy(true);
        setError('');
        try {
            const body = await prefillQualification(pid, chosen, {
                questionnaireId,
                mode: chosenMode,
                current: answers,
            });
            setFile(chosen);
            setResult(body);
            setTaken(Object.fromEntries(body.proposed.map((field) => [field, true])));
        } catch (e) {
            setFile(null);
            setResult(null);
            setError(e instanceof Error ? e.message : 'that file could not be read');
        } finally {
            setBusy(false);
        }
    };

    const kept = (result?.proposed ?? []).filter((field) => taken[field] !== false);
    const blockFields = result
        ? result.profileFilled.length + result.tagsFilled.length
            + (result.risks === null ? 0 : result.risks.length)
        : 0;
    const nothingToTake = kept.length === 0 && (blockFields === 0 || !withBlocks);

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
                            const chosen = e.target.files?.[0];
                            e.target.value = '';
                            if (chosen) void read(chosen, mode);
                        }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Button onClick={close} variant="outlined" sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        disabled={busy || !result || nothingToTake}
                        onClick={() => {
                            if (result) {
                                const applied = applyPrefill(answers, blocks, result, { taken, withBlocks });
                                onApply(applied.answers, applied.blocks);
                            }
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

                <RadioGroup
                    value={mode}
                    onChange={(e) => {
                        const next = e.target.value as PrefillMode;
                        setMode(next);
                        // the merge is the backend's, so a changed mode reads the file again
                        if (file) void read(file, next);
                    }}
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
                                label={`${result.proposed.length} answer${result.proposed.length === 1 ? '' : 's'}`}
                                size="small"
                                color={result.proposed.length > 0 ? 'success' : 'default'}
                                variant="outlined"
                            />
                            {blockFields > 0 && (
                                <Chip
                                    label={`${blockFields} block field${blockFields === 1 ? '' : 's'}`}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Box>

                        {result.note && <Typography color="text.secondary">{result.note}</Typography>}

                        {result.proposed.map((field) => (
                            <Box key={field} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <Checkbox
                                    size="small"
                                    checked={taken[field] !== false}
                                    onChange={(e) =>
                                        setTaken((prev) => ({ ...prev, [field]: e.target.checked }))
                                    }
                                    inputProps={{ 'aria-label': `keep ${field}` }}
                                />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={600}>
                                        {field}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {result.filled.includes(field)
                                            ? 'from the document'
                                            : 'kept what you had answered'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {String(result.values[field] ?? '')}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}

                        {blockFields > 0 && (
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={withBlocks}
                                        onChange={(e) => setWithBlocks(e.target.checked)}
                                        inputProps={{ 'aria-label': 'keep the blocks' }}
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Also take the{' '}
                                        {[
                                            result.profileFilled.length > 0
                                                ? `profile (${result.profileFilled.join(', ')})` : '',
                                            result.tagsFilled.length > 0
                                                ? `tags (${result.tagsFilled.join(', ')})` : '',
                                            result.risks !== null && result.risks.length > 0
                                                ? `${result.risks.length} risk row${result.risks.length === 1 ? '' : 's'}` : '',
                                        ]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </Typography>
                                }
                            />
                        )}

                        {result.unmatched.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Nothing found for: {result.unmatched.join(', ')}
                            </Typography>
                        )}
                        {Object.keys(result.unplaced).length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                The document also names{' '}
                                {Object.keys(result.unplaced).join(', ')}, which this form has no
                                field for.
                            </Typography>
                        )}
                    </>
                )}
            </Box>
        </AppDialog>
    );
}
