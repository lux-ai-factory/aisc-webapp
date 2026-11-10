import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import toast from 'react-hot-toast';
import AppDialog from './AppDialog';
import { createChecklist } from '../lib/checklists';

interface QuestionRow {
    text: string;
    article: string;
    category: string;
}

function NewChecklistDialog({
    open,
    onClose,
    projectPid,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    projectPid: string;
    onCreated: () => void;
}) {
    const [name, setName] = useState('');
    const [questions, setQuestions] = useState<QuestionRow[]>([
        { text: '', article: '', category: '' },
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setRow = (index: number, patch: Partial<QuestionRow>) =>
        setQuestions((prev) =>
            prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
        );

    const create = async () => {
        if (!name.trim()) {
            setError('a name is required');
            return;
        }
        const filled = questions.filter((q) => q.text.trim());
        if (filled.length === 0) {
            setError('add at least one question');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await createChecklist(projectPid, {
                name: name.trim(),
                control_topic: name.trim(),
                questions: filled.map((q) => ({
                    text: q.text.trim(),
                    article: q.article.trim(),
                    category: q.category.trim(),
                })),
            });
            toast.success('Checklist created.', { position: 'bottom-right' });
            onCreated();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create checklist');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            title="New checklist"
            actions={
                <>
                    <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        onClick={() => void create()}
                        disabled={saving}
                        sx={{ textTransform: 'none' }}
                    >
                        {saving ? 'Creating...' : 'Create'}
                    </Button>
                </>
            }
        >
            <Stack spacing={2}>
                <TextField
                    size="small"
                    label="Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    inputProps={{ 'aria-label': 'Checklist name' }}
                />
                {questions.map((q, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <TextField
                            size="small"
                            label={`Question ${i + 1}`}
                            fullWidth
                            value={q.text}
                            onChange={(e) => setRow(i, { text: e.target.value })}
                            inputProps={{ 'aria-label': `Question text ${i + 1}` }}
                        />
                        <TextField
                            size="small"
                            label="Category"
                            value={q.category}
                            onChange={(e) => setRow(i, { category: e.target.value })}
                            sx={{ width: 160 }}
                        />
                        {questions.length > 1 && (
                            <Tooltip title="Remove question">
                                <IconButton
                                    size="small"
                                    aria-label={`Remove question ${i + 1}`}
                                    onClick={() =>
                                        setQuestions((prev) =>
                                            prev.filter((_, idx) => idx !== i),
                                        )
                                    }
                                >
                                    <Icon fontSize="small">delete</Icon>
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                ))}
                <Button
                    variant="outlined"
                    startIcon={<Icon>add</Icon>}
                    onClick={() =>
                        setQuestions((prev) => [
                            ...prev,
                            { text: '', article: '', category: '' },
                        ])
                    }
                    sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                >
                    Add question
                </Button>
                {error && (
                    <Typography color="error" variant="body2">
                        {error}
                    </Typography>
                )}
            </Stack>
        </AppDialog>
    );
}

export default NewChecklistDialog;
