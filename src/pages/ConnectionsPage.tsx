import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useProject } from '../context/ProjectContext';
import {
    AgentCard,
    Connection,
    ConnectionDraft,
    ConnectionList,
    TryResult,
    discoverAgentCard,
    getConnections,
    linkConnectionTarget,
    listComponents,
    removeConnection,
    saveConnection,
    tryConnection,
} from '../lib/connections';
import type { ProjectComponent } from '../lib/connections';
import '../styles/common.css';

/** The fields of the editor, before anything is saved. */
interface Draft {
    name: string;
    label: string;
    kind: string;
    base_url: string;
    model: string;
    supports_tools: boolean;
    supports_logprobs: boolean;
    protocol_version: string;
    path: string;
    method: string;
    body: string;
    answer: string;
    refusal: string;
    headers: string;
    secret_header: string;
    timeout_s: string;
    target: string;
    secret: string;
    secret_remove: boolean;
    header_add_name: string;
    header_add_value: string;
}

const EMPTY: Draft = {
    name: '',
    label: '',
    kind: 'openai',
    base_url: '',
    model: '',
    supports_tools: false,
    supports_logprobs: false,
    protocol_version: '1.0',
    path: '',
    method: 'POST',
    body: '',
    answer: '',
    refusal: '',
    headers: '',
    secret_header: '',
    timeout_s: '60',
    target: '',
    secret: '',
    secret_remove: false,
    header_add_name: '',
    header_add_value: '',
};

const draftOf = (c: Connection): Draft => ({
    ...EMPTY,
    name: c.name,
    label: c.label,
    kind: c.kind,
    base_url: c.base_url,
    model: c.model,
    supports_tools: c.supports_tools,
    supports_logprobs: c.supports_logprobs,
    protocol_version: c.protocol_version || '1.0',
    path: c.path,
    method: c.method || 'POST',
    body: c.body_template ? JSON.stringify(c.body_template) : '',
    answer: c.response_path,
    headers: Object.keys(c.headers ?? {}).length ? JSON.stringify(c.headers) : '',
    secret_header: c.secret_header,
    timeout_s: String(c.timeout_s || 60),
});

const parsed = (text: string, what: string): { value?: unknown; error?: string } => {
    if (!text.trim()) return { value: null };
    try {
        return { value: JSON.parse(text) };
    } catch {
        return { error: `${what} is not valid JSON` };
    }
};

const nameFrom = (label: string) =>
    label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63);

/**
 * Components and connections (CON-01): the project's connections, the protocol that reaches each
 * one, the adapter's own fields and the Try that makes one real call as a test would. Keys and
 * secret headers are written here but only ever read back as "stored".
 */
const ConnectionsPage = () => {
    const { projectUUID: pid } = useProject();
    const [data, setData] = useState<ConnectionList | null>(null);
    const [components, setComponents] = useState<ProjectComponent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, { text: string; bad: boolean }>>({});
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [card, setCard] = useState<AgentCard | null>(null);

    const load = useCallback(() => {
        if (!pid) return;
        getConnections(pid)
            .then((list) => {
                setData(list);
                setError(null);
            })
            .catch((e: Error) => setError(e.message));
        listComponents(pid)
            .then(setComponents)
            .catch(() => setComponents([]));
    }, [pid]);

    useEffect(() => {
        load();
    }, [load]);

    const kinds = useMemo(() => data?.adapters ?? [], [data]);

    const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

    const openNew = () => {
        setEditing(null);
        setCard(null);
        setDraft({ ...EMPTY });
        setMessage(null);
    };

    const openEdit = (c: Connection) => {
        setEditing(c.name);
        setCard(null);
        setDraft(draftOf(c));
        setMessage(null);
    };

    const save = async () => {
        if (!pid || !draft) return;
        const name = editing ?? (draft.name.trim() || nameFrom(draft.label));
        if (!name) {
            setMessage('Give the connection a name.');
            return;
        }
        const body = parsed(draft.body, 'The request body');
        const refusal = parsed(draft.refusal, 'The refusal');
        const headers = parsed(draft.headers, 'Headers');
        const bad = body.error ?? refusal.error ?? headers.error;
        if (bad) {
            setMessage(bad);
            return;
        }
        const payload: ConnectionDraft = {
            label: draft.label.trim(),
            kind: draft.kind,
            base_url: draft.base_url.trim(),
            timeout_s: parseInt(draft.timeout_s, 10) || 60,
            model: draft.model.trim(),
            supports_tools: draft.kind === 'openai' && draft.supports_tools,
            supports_logprobs: draft.kind === 'openai' && draft.supports_logprobs,
            protocol_version: draft.kind === 'a2a' ? draft.protocol_version : '',
            path: draft.path.trim(),
            method: draft.method,
            body_template: body.value ?? null,
            response_path: draft.answer.trim() || null,
            refusal: (refusal.value as Record<string, unknown> | null) ?? null,
            headers: (headers.value as Record<string, unknown> | null) ?? {},
            secret_header: draft.secret_header.trim() || null,
        };
        if (!editing && draft.target) payload.target = draft.target;
        if (draft.secret_remove) payload.secret = '';
        else if (draft.secret) payload.secret = draft.secret;
        const secretHeaders: Record<string, string> = {};
        if (draft.header_add_name.trim() && draft.header_add_value)
            secretHeaders[draft.header_add_name.trim()] = draft.header_add_value;
        if (Object.keys(secretHeaders).length) payload.secret_headers = secretHeaders;

        setMessage('Saving…');
        try {
            await saveConnection(pid, name, payload);
            setDraft(null);
            setEditing(null);
            setMessage(null);
            load();
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    const tryIt = async (c: Connection) => {
        if (!pid) return;
        const typed = inputs[c.name] ?? 'ping';
        let input: unknown = typed || 'ping';
        if (/^\s*\{/.test(String(input))) {
            try {
                input = JSON.parse(String(input));
            } catch {
                /* plain text, as typed */
            }
        }
        setResults((r) => ({ ...r, [c.name]: { text: 'Calling the system…', bad: false } }));
        try {
            const outcome: TryResult = await tryConnection(pid, c.name, input);
            let text: string;
            if (!outcome.ok) text = `Failed (${String(outcome.error)}): ${outcome.detail ?? ''}`;
            else if (outcome.refused)
                text = `The system refused: ${outcome.refusal_reason ?? '(no reason given)'}`;
            else
                text = `What a test gets: ${
                    typeof outcome.answer === 'string'
                        ? outcome.answer
                        : JSON.stringify(outcome.answer)
                } (${outcome.latency_ms} ms)`;
            setResults((r) => ({ ...r, [c.name]: { text, bad: !outcome.ok } }));
            load();
        } catch (e) {
            setResults((r) => ({ ...r, [c.name]: { text: (e as Error).message, bad: true } }));
        }
    };

    const discover = async () => {
        if (!pid || !draft) return;
        if (!editing) {
            setMessage('Save the connection before reading its agent card.');
            return;
        }
        try {
            const found = await discoverAgentCard(pid, editing);
            setCard(found);
            setMessage(`Agent card read: ${found.name || '(unnamed)'}`);
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    const link = async (c: Connection, key: string) => {
        if (!pid || !key) return;
        try {
            await linkConnectionTarget(pid, c.name, key);
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const remove = async (c: Connection) => {
        if (!pid) return;
        try {
            await removeConnection(pid, c.name);
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const free = components.filter(
        (component) => !(data?.connections ?? []).some((c) => c.target?.key === component.key),
    );

    return (
        <Box className="page">
            <Typography variant="h4" className="brand-step">
                Components and connections
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: 2 }}>
                A connection is how a test reaches the system or one of its components: the protocol
                (adapter), the endpoint and the protocol&apos;s own fields. A key is stored encrypted
                for this project and never shown again.
            </Typography>
            {error && (
                <Typography color="error" data-testid="connections-error">
                    {error}
                </Typography>
            )}
            {message && (
                <Typography data-testid="connections-message" sx={{ marginBottom: 1 }}>
                    {message}
                </Typography>
            )}
            <Button
                variant="contained"
                onClick={openNew}
                data-testid="new-connection"
                sx={{ marginBottom: 2 }}
            >
                Connect a system
            </Button>

            {(data?.connections ?? []).map((c) => (
                <Box
                    key={c.name}
                    data-testid={`connection-${c.name}`}
                    className="brand-block"
                    sx={{ border: '1px solid #e6e8ed', padding: 2, marginBottom: 1 }}
                >
                    <Typography variant="h6" className="brand-project">
                        {c.label}
                    </Typography>
                    <Typography variant="body2" className="brand-mono">
                        {c.name} · {c.protocol} · {c.base_url}
                        {c.target ? ` → ${c.target.name}` : ' · no target yet'}
                    </Typography>
                    <Typography variant="body2" data-testid={`state-${c.name}`}>
                        {c.has_secret ? 'key stored' : 'no key'}
                        {c.secret_headers.length
                            ? ` · secret headers: ${c.secret_headers.join(', ')}`
                            : ''}
                        {c.last_test_at ? (c.last_test_ok ? ' · last try OK' : ' · last try failed') : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Button size="small" onClick={() => openEdit(c)} data-testid={`edit-${c.name}`}>
                            Edit
                        </Button>
                        <TextField
                            size="small"
                            placeholder="prompt to try"
                            value={inputs[c.name] ?? 'ping'}
                            onChange={(e) =>
                                setInputs((i) => ({ ...i, [c.name]: e.target.value }))
                            }
                            inputProps={{ 'data-testid': `try-input-${c.name}` }}
                        />
                        <Button size="small" onClick={() => tryIt(c)} data-testid={`try-${c.name}`}>
                            Try
                        </Button>
                        <Button
                            size="small"
                            color="error"
                            onClick={() => remove(c)}
                            data-testid={`remove-${c.name}`}
                        >
                            Remove
                        </Button>
                        {!c.target && (
                            <Select
                                size="small"
                                displayEmpty
                                defaultValue=""
                                onChange={(e) => link(c, String(e.target.value))}
                                inputProps={{ 'data-testid': `link-${c.name}` }}
                            >
                                <MenuItem value="">Link to a target…</MenuItem>
                                {free.map((component) => (
                                    <MenuItem key={component.key} value={component.key}>
                                        {component.name} ({component.component_type})
                                    </MenuItem>
                                ))}
                            </Select>
                        )}
                    </Box>
                    {results[c.name] && (
                        <Typography
                            variant="body2"
                            data-testid={`try-result-${c.name}`}
                            color={results[c.name].bad ? 'error' : 'text.primary'}
                        >
                            {results[c.name].text}
                        </Typography>
                    )}
                </Box>
            ))}

            {draft && (
                <Box
                    data-testid="connection-editor"
                    className="brand-block"
                    sx={{ border: '1px solid #e6e8ed', padding: 2, marginTop: 1 }}
                >
                    <Typography variant="h6">{editing ? `Edit ${editing}` : 'Connect a system'}</Typography>
                    <TextField
                        label="Label"
                        size="small"
                        fullWidth
                        value={draft.label}
                        onChange={(e) => set({ label: e.target.value })}
                        inputProps={{ 'data-testid': 'field-label' }}
                    />
                    <TextField
                        label="Name"
                        size="small"
                        fullWidth
                        disabled={!!editing}
                        value={draft.name}
                        onChange={(e) => set({ name: e.target.value })}
                        inputProps={{ 'data-testid': 'field-name' }}
                    />
                    <Select
                        size="small"
                        fullWidth
                        value={draft.kind}
                        onChange={(e) => set({ kind: String(e.target.value) })}
                        inputProps={{ 'data-testid': 'field-kind' }}
                    >
                        {kinds.map((a) => (
                            <MenuItem key={a.kind} value={a.kind}>
                                {a.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <TextField
                        label="Base URL"
                        size="small"
                        fullWidth
                        value={draft.base_url}
                        onChange={(e) => set({ base_url: e.target.value })}
                        inputProps={{ 'data-testid': 'field-base-url' }}
                    />
                    {(draft.kind === 'openai' || draft.kind === 'oip') && (
                        <TextField
                            label="Model"
                            size="small"
                            fullWidth
                            value={draft.model}
                            onChange={(e) => set({ model: e.target.value })}
                            inputProps={{ 'data-testid': 'field-model' }}
                        />
                    )}
                    {draft.kind === 'openai' && (
                        <Box>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={draft.supports_tools}
                                        onChange={(e) => set({ supports_tools: e.target.checked })}
                                    />
                                }
                                label="calls tools (function calling)"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={draft.supports_logprobs}
                                        onChange={(e) => set({ supports_logprobs: e.target.checked })}
                                    />
                                }
                                label="returns log probabilities"
                            />
                        </Box>
                    )}
                    {draft.kind === 'a2a' && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Select
                                size="small"
                                value={draft.protocol_version}
                                onChange={(e) => set({ protocol_version: String(e.target.value) })}
                                inputProps={{ 'data-testid': 'field-version' }}
                            >
                                <MenuItem value="1.0">1.0</MenuItem>
                                <MenuItem value="0.3">0.3</MenuItem>
                            </Select>
                            <TextField
                                size="small"
                                label="JSON-RPC path"
                                value={draft.path}
                                onChange={(e) => set({ path: e.target.value })}
                                inputProps={{ 'data-testid': 'field-path' }}
                            />
                            <Button size="small" onClick={discover} data-testid="discover-agent-card">
                                Read agent card
                            </Button>
                        </Box>
                    )}
                    {draft.kind === 'rest' && (
                        <Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Select
                                    size="small"
                                    value={draft.method}
                                    onChange={(e) => set({ method: String(e.target.value) })}
                                    inputProps={{ 'data-testid': 'field-method' }}
                                >
                                    <MenuItem value="POST">POST</MenuItem>
                                    <MenuItem value="GET">GET</MenuItem>
                                    <MenuItem value="PUT">PUT</MenuItem>
                                </Select>
                                <TextField
                                    size="small"
                                    label="Path"
                                    value={draft.path}
                                    onChange={(e) => set({ path: e.target.value })}
                                    inputProps={{ 'data-testid': 'field-path' }}
                                />
                            </Box>
                            <TextField
                                label="Request body (JSON)"
                                size="small"
                                fullWidth
                                multiline
                                value={draft.body}
                                onChange={(e) => set({ body: e.target.value })}
                                placeholder={'{"question": "{{input}}"}'}
                                inputProps={{ 'data-testid': 'field-body' }}
                            />
                            <TextField
                                label="Answer field (JSON path)"
                                size="small"
                                fullWidth
                                value={draft.answer}
                                onChange={(e) => set({ answer: e.target.value })}
                                inputProps={{ 'data-testid': 'field-answer' }}
                            />
                            <TextField
                                label="Refusal (JSON, optional)"
                                size="small"
                                fullWidth
                                multiline
                                value={draft.refusal}
                                onChange={(e) => set({ refusal: e.target.value })}
                                inputProps={{ 'data-testid': 'field-refusal' }}
                            />
                        </Box>
                    )}
                    <TextField
                        label="Key"
                        type="password"
                        size="small"
                        fullWidth
                        autoComplete="new-password"
                        value={draft.secret}
                        onChange={(e) => set({ secret: e.target.value })}
                        inputProps={{ 'data-testid': 'field-secret' }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={draft.secret_remove}
                                onChange={(e) => set({ secret_remove: e.target.checked })}
                            />
                        }
                        label="remove the stored key"
                    />
                    <TextField
                        label="Headers (JSON, optional)"
                        size="small"
                        fullWidth
                        value={draft.headers}
                        onChange={(e) => set({ headers: e.target.value })}
                        inputProps={{ 'data-testid': 'field-headers' }}
                    />
                    <TextField
                        label="Secret header"
                        size="small"
                        fullWidth
                        value={draft.secret_header}
                        onChange={(e) => set({ secret_header: e.target.value })}
                        placeholder="Authorization: Bearer {{secret}}"
                        inputProps={{ 'data-testid': 'field-secret-header' }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            size="small"
                            label="Secret header name"
                            value={draft.header_add_name}
                            onChange={(e) => set({ header_add_name: e.target.value })}
                        />
                        <TextField
                            size="small"
                            label="its value"
                            type="password"
                            value={draft.header_add_value}
                            onChange={(e) => set({ header_add_value: e.target.value })}
                        />
                    </Box>
                    <TextField
                        label="Timeout (seconds)"
                        size="small"
                        type="number"
                        value={draft.timeout_s}
                        onChange={(e) => set({ timeout_s: e.target.value })}
                        inputProps={{ 'data-testid': 'field-timeout' }}
                    />
                    {card && (
                        <Typography variant="body2" data-testid="agent-card" className="brand-mono">
                            {card.name} · {card.url_named_by_card || card.url}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, marginTop: 1 }}>
                        <Button variant="contained" onClick={save} data-testid="save-connection">
                            Save
                        </Button>
                        <Button
                            onClick={() => {
                                setDraft(null);
                                setEditing(null);
                                setMessage(null);
                            }}
                            data-testid="cancel-connection"
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default ConnectionsPage;
