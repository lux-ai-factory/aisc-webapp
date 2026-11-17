import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useProject } from '../context/ProjectContext';
import { Connection, ConnectionList, getConnections, updateConnection } from '../lib/connections';
import '../styles/common.css';

/**
 * Components and connections (CON-01): the project's connection components with the adapter that
 * reaches them, the helper role a component fills and whether a key is set. Edits go to the one
 * AIComponent connection model; the key itself is never shown here.
 */
const ConnectionsPage = () => {
    const { project_name } = useParams();
    const { projectUUID: pid, projectName } = useProject();
    const [data, setData] = useState<ConnectionList | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<Record<string, Connection>>({});

    const load = useCallback(() => {
        if (!pid) return;
        getConnections(pid)
            .then((list) => {
                setData(list);
                setDraft({});
                setError(null);
            })
            .catch((e: Error) => setError(e.message));
    }, [pid]);

    useEffect(() => {
        load();
    }, [load]);

    const row = (c: Connection): Connection => draft[c.pid] ?? c;

    const edit = (c: Connection, patch: Partial<Connection>) => {
        setDraft((d) => ({ ...d, [c.pid]: { ...row(c), ...patch } }));
    };

    const save = async (c: Connection) => {
        if (!pid) return;
        const current = row(c);
        setMessage('Saving…');
        try {
            const updated = await updateConnection(pid, c.pid, {
                adapter: current.adapter,
                adapter_version: current.adapter_version,
                helper_role: current.helper_role,
            });
            setData((d) =>
                d
                    ? { ...d, connections: d.connections.map((x) => (x.pid === c.pid ? updated : x)) }
                    : d,
            );
            setDraft((d) => {
                const next = { ...d };
                delete next[c.pid];
                return next;
            });
            setMessage('Saved.');
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    return (
        <Box>
            <Box className="page-header" sx={{ mb: 2 }}>
                <Typography variant="h4" className="page-header-title">
                    Components and connections
                </Typography>
                <span className="brand-mono">{projectName || project_name}</span>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: '80ch' }}>
                What an assessment can be about, and the adapter that reaches it. The key stays with the
                connection and is never shown again.
            </Typography>

            {error && (
                <Typography color="error" data-testid="connections-error">
                    {error}
                </Typography>
            )}
            <span className="brand-mono" data-testid="connections-message">
                {message}
            </span>

            {data && (
                <Box sx={{ overflow: 'auto', mt: 2 }} data-testid="connections-table">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Connection</th>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Type</th>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Endpoint</th>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Key</th>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Adapter</th>
                                <th className="brand-mono" style={{ textAlign: 'left' }}>Helper role</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data.connections.map((c) => {
                                const current = row(c);
                                return (
                                    <tr key={c.pid} data-testid={`connection-${c.name}`}>
                                        <td>
                                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                                        </td>
                                        <td className="brand-mono">{c.component_type}</td>
                                        <td className="brand-mono">{c.endpoint || '—'}</td>
                                        <td className="brand-mono">{c.key_set ? 'set' : 'not set'}</td>
                                        <td>
                                            <Box data-testid={`adapter-${c.name}`}>
                                                <Select
                                                    size="small"
                                                    value={current.adapter}
                                                    onChange={(e) => edit(c, { adapter: String(e.target.value) })}
                                                    inputProps={{ 'aria-label': `adapter for ${c.name}` }}
                                                >
                                                    {data.adapters.map((a) => (
                                                        <MenuItem key={a} value={a}>
                                                            {a}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </Box>
                                        </td>
                                        <td>
                                            <Box data-testid={`helper-${c.name}`}>
                                                <TextField
                                                    size="small"
                                                    value={current.helper_role}
                                                    placeholder="—"
                                                    onChange={(e) => edit(c, { helper_role: e.target.value })}
                                                />
                                            </Box>
                                        </td>
                                        <td>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                data-testid={`save-${c.name}`}
                                                onClick={() => save(c)}
                                            >
                                                Save
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Box>
            )}
        </Box>
    );
};

export default ConnectionsPage;
