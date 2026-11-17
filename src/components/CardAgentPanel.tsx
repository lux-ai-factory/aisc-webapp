import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
    askCardAgent,
    componentFlag,
    listCardComponents,
    patchQualificationNode,
    type CardAgentProposal,
    type CardComponentLink,
    type Qualification,
} from '../lib/qualification';

/**
 * The card agent on the AI card page (step 1): ask about the card, or ask it to
 * correct a node. The agent only *proposes* — each suggestion quotes the person's
 * words or the card — and applying one goes through the node-correction endpoint,
 * which rebuilds the card as a new version. Nothing here invents a change, and
 * with no model configured the backend says so (503) instead.
 *
 * The same panel reports the card's components against the engine: which of them
 * changed in the engine since the card was saved, and which are not in the engine
 * at all.
 */
export default function CardAgentPanel({
    pid,
    qualification,
    onApplied,
}: {
    pid: string;
    qualification: Qualification;
    onApplied: (qualification: Qualification) => void;
}) {
    const [message, setMessage] = useState('');
    const [answer, setAnswer] = useState('');
    const [proposals, setProposals] = useState<CardAgentProposal[]>([]);
    const [dropped, setDropped] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [applying, setApplying] = useState<string>('');
    const [links, setLinks] = useState<CardComponentLink[]>([]);

    const loadLinks = useCallback(async () => {
        try {
            setLinks(await listCardComponents(pid, qualification.pid));
        } catch {
            setLinks([]);
        }
    }, [pid, qualification.pid]);

    useEffect(() => {
        setAnswer('');
        setProposals([]);
        setDropped([]);
        setError('');
        void loadLinks();
    }, [qualification.pid, loadLinks]);

    const ask = async () => {
        const text = message.trim();
        if (!text) return;
        setBusy(true);
        setError('');
        try {
            const turn = await askCardAgent(pid, qualification.pid, text);
            setAnswer(turn.text);
            setProposals(turn.proposals);
            setDropped(turn.dropped.map((d) => d.reason));
            setMessage('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'the card agent could not answer');
        } finally {
            setBusy(false);
        }
    };

    const apply = async (proposal: CardAgentProposal) => {
        setApplying(proposal.node_id + proposal.property);
        setError('');
        try {
            const updated = await patchQualificationNode(
                pid,
                qualification.pid,
                proposal.node_id,
                { [proposal.property]: proposal.value },
            );
            setProposals((prev) =>
                prev.filter(
                    (p) => !(p.node_id === proposal.node_id && p.property === proposal.property),
                ),
            );
            onApplied(updated);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'the correction was refused');
        } finally {
            setApplying('');
        }
    };

    const flagged = links
        .map((link) => ({ link, flag: componentFlag(link) }))
        .filter((row) => row.flag !== null);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                    smart_toy
                </Icon>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Card agent
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    it proposes, you decide
                </Typography>
            </Box>

            {error && <Alert severity="warning">{error}</Alert>}
            {answer && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {answer}
                </Typography>
            )}

            {proposals.map((proposal) => (
                <Box
                    key={`${proposal.node_id}:${proposal.property}`}
                    sx={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        {proposal.node_id} · {proposal.property}
                    </Typography>
                    <Typography variant="body2" className="brand-mono">
                        {proposal.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        quoting “{proposal.quote}”
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={applying !== ''}
                            onClick={() => void apply(proposal)}
                            sx={{ textTransform: 'none' }}
                        >
                            Apply
                        </Button>
                        <Button
                            size="small"
                            disabled={applying !== ''}
                            onClick={() => setProposals((prev) => prev.filter((p) => p !== proposal))}
                            sx={{ textTransform: 'none' }}
                        >
                            Dismiss
                        </Button>
                    </Box>
                </Box>
            ))}

            {dropped.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                    Left out: {dropped.join('; ')}
                </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                    size="small"
                    fullWidth
                    label="Ask the agent, or ask it to correct the card"
                    value={message}
                    disabled={busy}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void ask();
                        }
                    }}
                />
                <Button
                    variant="contained"
                    className="gradient-btn"
                    disabled={busy || message.trim() === ''}
                    onClick={() => void ask()}
                    startIcon={busy ? <CircularProgress size={14} /> : <Icon>send</Icon>}
                    sx={{ textTransform: 'none' }}
                >
                    Ask
                </Button>
            </Box>

            {links.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Card components vs the engine
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {links.map((link) => {
                            const flag = componentFlag(link);
                            return (
                                <Chip
                                    key={link.component_key}
                                    size="small"
                                    variant="outlined"
                                    color={flag?.tone === 'warning' ? 'warning' : 'default'}
                                    label={flag ? `${link.name}: ${flag.label}` : link.name}
                                />
                            );
                        })}
                    </Box>
                    {flagged.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                            Every component still matches the engine.
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}
