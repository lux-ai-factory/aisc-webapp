// Renames a finished run from its card on the Results page (pages/runName.ts does the call).
import {useState} from 'react';
import {Alert, Box, Button, Stack, TextField, Typography} from '@mui/material';
import {renameRun} from '../pages/runName';

type Props = {
    apiUrl: string;
    evaluationPid: string;
    /** the run's name now ('' when it has the automatic one) */
    current: string;
    /** called once the engine kept the new name, to read the runs again */
    onRenamed: () => void | Promise<void>;
};

export default function RenameRun({apiUrl, evaluationPid, current, onRenamed}: Props) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(current);
    const [error, setError] = useState<string | null>(null);

    if (!editing) {
        return (
            <Box>
                <Button size="small" onClick={() => { setName(current); setError(null); setEditing(true); }}>
                    Rename
                </Button>
            </Box>
        );
    }

    const save = async () => {
        try {
            await renameRun(apiUrl, evaluationPid, name);
            setEditing(false);
            await onRenamed();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <Stack spacing={0.5}>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <TextField size="small" label="Run name" value={name} autoFocus inputProps={{maxLength: 255}}
                           onChange={(e) => setName(e.target.value)} sx={{flex: 1}} />
                <Button size="small" variant="contained" onClick={save}>Save</Button>
                <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                Empty gives the automatic name back. The results dashboard shows the new name.
            </Typography>
            {error && <Alert severity="error" sx={{py: 0}}>{error}</Alert>}
        </Stack>
    );
}
