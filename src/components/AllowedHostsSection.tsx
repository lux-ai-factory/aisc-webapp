import { useCallback, useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
    AllowedHostList,
    allowHost,
    getAllowedHosts,
    removeAllowedHost,
} from '../lib/allowedHosts';

/** The pilot's `when` cell: `2026-11-17 09:25 by <subject>`, to the minute. */
const changed = (at: string | null, by: string) =>
    at ? `${String(at).slice(0, 16).replace('T', ' ')}${by ? ` by ${by}` : ''}` : '';

/**
 * Allowed internal hosts (CON-01), the pilot's `#allowed-hosts` section.
 *
 * A connection may call any public address; an internal one — a private network, the Docker host,
 * a machine on the LAN — is refused unless it is listed here. The services of this deployment,
 * loopback (the platform itself) and cloud metadata addresses can never be listed, and an entry
 * that names one is shown with the reason instead of being quietly usable.
 */
const AllowedHostsSection = ({ projectPid }: { projectPid: string }) => {
    const [data, setData] = useState<AllowedHostList | null>(null);
    const [host, setHost] = useState('');
    const [note, setNote] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [bad, setBad] = useState(false);

    const load = useCallback(() => {
        if (!projectPid) return;
        getAllowedHosts(projectPid)
            .then(setData)
            .catch((e: Error) => {
                setMessage(e.message);
                setBad(true);
            });
    }, [projectPid]);

    useEffect(() => {
        load();
    }, [load]);

    const say = (text: string, isBad = false) => {
        setMessage(text);
        setBad(isBad);
    };

    const allow = async () => {
        const typed = host.trim();
        if (!typed) {
            say('Enter a host or host:port.', true);
            return;
        }
        say('Saving…');
        try {
            const saved = await allowHost(projectPid, typed, note.trim());
            setHost('');
            setNote('');
            say(`Allowed ${saved.host}.`);
            load();
        } catch (e) {
            say((e as Error).message, true);
        }
    };

    const remove = async (entry: string) => {
        say('Removing…');
        try {
            await removeAllowedHost(projectPid, entry);
            say('');
            load();
        } catch (e) {
            say((e as Error).message, true);
        }
    };

    const floor = data?.floor ?? [];
    const entries = data?.entries ?? [];
    const canManage = data?.can_manage ?? false;

    return (
        <Accordion data-testid="allowed-hosts" sx={{ marginTop: 3 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="brand-project">
                    Allowed internal hosts
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    {data?.rule ??
                        'A connection may call any public address. An internal one is refused ' +
                            'unless it is listed here, as a host or host:port.'}
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Host</TableCell>
                            <TableCell>Note</TableCell>
                            <TableCell>Changed</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {floor.map((entry) => (
                            <TableRow key={`floor-${entry}`} data-testid={`allowed-floor-${entry}`}>
                                <TableCell className="brand-mono">{entry}</TableCell>
                                <TableCell>set by the deployment</TableCell>
                                <TableCell className="brand-mono" />
                                <TableCell />
                            </TableRow>
                        ))}
                        {entries.map((entry) => (
                            <TableRow key={entry.host} data-testid={`allowed-${entry.host}`}>
                                <TableCell className="brand-mono">
                                    {entry.host}
                                    {entry.denied && (
                                        <Typography
                                            variant="caption"
                                            color="error"
                                            display="block"
                                            data-testid={`denied-${entry.host}`}
                                        >
                                            {entry.denied}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>{entry.note}</TableCell>
                                <TableCell className="brand-mono">
                                    {changed(entry.updated_at, entry.updated_by)}
                                </TableCell>
                                <TableCell>
                                    {canManage && (
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() => remove(entry.host)}
                                            data-testid={`remove-allowed-${entry.host}`}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!floor.length && !entries.length && (
                            <TableRow>
                                <TableCell colSpan={4} data-testid="allowed-none">
                                    No internal host allowed.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {canManage ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', marginTop: 1 }}>
                        <TextField
                            size="small"
                            placeholder="host.docker.internal:8500"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            inputProps={{ 'data-testid': 'allow-host' }}
                        />
                        <TextField
                            size="small"
                            placeholder="note, e.g. MCAS-lite on the Docker host"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            inputProps={{ 'data-testid': 'allow-note' }}
                        />
                        <Button variant="contained" onClick={allow} data-testid="allow-submit">
                            Allow
                        </Button>
                    </Box>
                ) : (
                    <Typography variant="body2" data-testid="allowed-readonly">
                        Only an owner or an admin can change this list.
                    </Typography>
                )}
                {message !== null && message !== '' && (
                    <Typography
                        variant="body2"
                        color={bad ? 'error' : 'text.primary'}
                        data-testid="allowed-message"
                        sx={{ marginTop: 1 }}
                    >
                        {message}
                    </Typography>
                )}
            </AccordionDetails>
        </Accordion>
    );
};

export default AllowedHostsSection;
