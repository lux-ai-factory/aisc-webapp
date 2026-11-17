import { useCallback, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useProject } from '../context/ProjectContext';
import {
    Helper,
    HelperDraft,
    HelperList,
    getHelpers,
    removeHelper,
    saveHelper,
    testHelper,
} from '../lib/helpers';
import '../styles/common.css';

interface Draft extends HelperDraft {
    name: string;
    label: string;
}

const EMPTY: Draft = { name: '', label: '', endpoint_url: '', roles: [], key: '' };

/**
 * Helper models (CON-01): a model a test uses as a tool — a judge, an attacker, a grader, an
 * embedder, a generator. One endpoint and one key each, stored encrypted for the project; the Test
 * button makes one small call with that key and reports the status only.
 */
const HelpersPage = () => {
    const { projectUUID: pid } = useProject();
    const [data, setData] = useState<HelperList | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [models, setModels] = useState<Record<string, string>>({});
    const [results, setResults] = useState<Record<string, { text: string; bad: boolean }>>({});

    const load = useCallback(() => {
        if (!pid) return;
        getHelpers(pid)
            .then((list) => {
                setData(list);
                setError(null);
            })
            .catch((e: Error) => setError(e.message));
    }, [pid]);

    useEffect(() => {
        load();
    }, [load]);

    const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

    const openNew = () => {
        setEditing(null);
        setDraft({ ...EMPTY });
        setMessage(null);
    };

    const openEdit = (h: Helper) => {
        setEditing(h.name);
        setDraft({
            name: h.name,
            label: h.label,
            endpoint_url: h.endpoint_url,
            roles: [...h.roles],
            key: '',
        });
        setMessage(null);
    };

    const save = async () => {
        if (!pid || !draft) return;
        const name = editing ?? draft.name.trim();
        if (!name) {
            setMessage('Give the helper model a name.');
            return;
        }
        if (!draft.roles.length) {
            setMessage('Choose at least one role.');
            return;
        }
        setMessage('Saving…');
        try {
            await saveHelper(pid, name, {
                label: draft.label.trim(),
                endpoint_url: draft.endpoint_url.trim(),
                roles: draft.roles,
                ...(draft.key ? { key: draft.key } : {}),
            });
            setDraft(null);
            setEditing(null);
            setMessage(null);
            load();
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    const remove = async (h: Helper) => {
        if (!pid) return;
        try {
            await removeHelper(pid, h.name);
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const test = async (h: Helper) => {
        if (!pid) return;
        const model = (models[h.name] ?? '').trim();
        if (!model) {
            setResults((r) => ({ ...r, [h.name]: { text: 'Type the model name to call first.', bad: true } }));
            return;
        }
        try {
            const outcome = await testHelper(pid, h.name, model);
            setResults((r) => ({
                ...r,
                [h.name]: {
                    text: outcome.ok
                        ? `Reachable (${outcome.latency_ms} ms)`
                        : `Failed (${outcome.status}): ${outcome.detail}`,
                    bad: !outcome.ok,
                },
            }));
        } catch (e) {
            setResults((r) => ({ ...r, [h.name]: { text: (e as Error).message, bad: true } }));
        }
    };

    const roles = data?.roles ?? [];

    return (
        <Box className="page">
            <Typography variant="h4" className="brand-step">
                Helper models
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: 2 }}>
                Models a test uses as a tool: a judge, an attacker, a grader, an embedder or a
                generator. They are never what is assessed. The key is stored once here and used by
                every test that picks the model.
            </Typography>
            {error && (
                <Typography color="error" data-testid="helpers-error">
                    {error}
                </Typography>
            )}
            {message && (
                <Typography data-testid="helpers-message" sx={{ marginBottom: 1 }}>
                    {message}
                </Typography>
            )}
            {data?.can_manage && (
                <Button
                    variant="contained"
                    onClick={openNew}
                    data-testid="new-helper"
                    sx={{ marginBottom: 2 }}
                >
                    Add a helper model
                </Button>
            )}

            {(data?.helpers ?? []).map((h) => (
                <Box
                    key={h.name}
                    data-testid={`helper-${h.name}`}
                    className="brand-block"
                    sx={{ border: '1px solid #e6e8ed', padding: 2, marginBottom: 1 }}
                >
                    <Typography variant="h6" className="brand-project">
                        {h.label}
                    </Typography>
                    <Typography variant="body2" className="brand-mono">
                        {h.name} · {h.endpoint_url} · {h.roles.join(', ')}
                    </Typography>
                    <Typography variant="body2" data-testid={`state-${h.name}`}>
                        {h.has_key ? 'key stored' : 'no key'}
                    </Typography>
                    {data?.can_manage && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Button size="small" onClick={() => openEdit(h)} data-testid={`edit-${h.name}`}>
                                Edit
                            </Button>
                            <TextField
                                size="small"
                                placeholder="model name to test"
                                value={models[h.name] ?? ''}
                                onChange={(e) =>
                                    setModels((m) => ({ ...m, [h.name]: e.target.value }))
                                }
                                inputProps={{ 'data-testid': `model-${h.name}` }}
                            />
                            <Button size="small" onClick={() => test(h)} data-testid={`test-${h.name}`}>
                                Test
                            </Button>
                            <Button
                                size="small"
                                color="error"
                                onClick={() => remove(h)}
                                data-testid={`remove-${h.name}`}
                            >
                                Remove
                            </Button>
                        </Box>
                    )}
                    {results[h.name] && (
                        <Typography
                            variant="body2"
                            data-testid={`result-${h.name}`}
                            color={results[h.name].bad ? 'error' : 'text.primary'}
                        >
                            {results[h.name].text}
                        </Typography>
                    )}
                </Box>
            ))}

            {draft && (
                <Box
                    data-testid="helper-editor"
                    className="brand-block"
                    sx={{ border: '1px solid #e6e8ed', padding: 2, marginTop: 1 }}
                >
                    <Typography variant="h6">
                        {editing ? `Edit ${editing}` : 'Add a helper model'}
                    </Typography>
                    <TextField
                        label="Name"
                        size="small"
                        fullWidth
                        disabled={!!editing}
                        value={draft.name}
                        onChange={(e) => set({ name: e.target.value })}
                        inputProps={{ 'data-testid': 'field-name' }}
                    />
                    <TextField
                        label="Label"
                        size="small"
                        fullWidth
                        value={draft.label}
                        onChange={(e) => set({ label: e.target.value })}
                        inputProps={{ 'data-testid': 'field-label' }}
                    />
                    <TextField
                        label="Endpoint URL"
                        size="small"
                        fullWidth
                        value={draft.endpoint_url}
                        onChange={(e) => set({ endpoint_url: e.target.value })}
                        inputProps={{ 'data-testid': 'field-endpoint' }}
                    />
                    <Box data-testid="field-roles">
                        {roles.map((role) => (
                            <FormControlLabel
                                key={role}
                                control={
                                    <Checkbox
                                        checked={draft.roles.includes(role)}
                                        onChange={(e) =>
                                            set({
                                                roles: e.target.checked
                                                    ? [...draft.roles, role]
                                                    : draft.roles.filter((r) => r !== role),
                                            })
                                        }
                                        inputProps={
                                            {
                                                'data-testid': `role-${role}`,
                                            } as InputHTMLAttributes<HTMLInputElement>
                                        }
                                    />
                                }
                                label={role}
                            />
                        ))}
                    </Box>
                    <TextField
                        label="API key"
                        type="password"
                        size="small"
                        fullWidth
                        autoComplete="new-password"
                        value={draft.key ?? ''}
                        onChange={(e) => set({ key: e.target.value })}
                        placeholder="leave empty to keep the stored key"
                        inputProps={{ 'data-testid': 'field-key' }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, marginTop: 1 }}>
                        <Button variant="contained" onClick={save} data-testid="save-helper">
                            Save
                        </Button>
                        <Button
                            onClick={() => {
                                setDraft(null);
                                setEditing(null);
                                setMessage(null);
                            }}
                            data-testid="cancel-helper"
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default HelpersPage;
