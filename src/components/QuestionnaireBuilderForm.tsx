/**
 * QuestionnaireBuilderForm — the definition editor for questionnaires.
 *
 * Two togglable modes: the builder (toggle structured blocks + add/edit
 * questions/fields, no JSON needed) and a raw-JSON view. Used by both the
 * "Add" dialog and the "Edit definition" drawer so the two flows share one
 * editor (DESIGN.md: prefer reusable components).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import '../styles/common.css';

export type QuestionnaireBuilderMode = 'builder' | 'json';

export interface BuilderQuestion {
    field: string;
    text: string;
    citation: string;
    required: boolean;
}

/** The structured blocks a questionnaire can declare. Picking one in the
 *  builder adds it to the definition's `blocks` array, so the answer form shows
 *  that section. */
const BLOCK_OPTIONS: Array<{ key: string; label: string; hint: string }> = [
    { key: 'description', label: 'Description', hint: 'about-the-deployment section' },
    { key: 'targetUseCase', label: 'Target use case', hint: 'about-the-deployment section' },
    { key: 'targetUsers', label: 'Target users', hint: 'about-the-deployment section' },
    { key: 'intendedDeployers', label: 'Intended deployers', hint: 'about-the-deployment section' },
    { key: 'targetSystem', label: 'Target systems', hint: 'classifications section' },
    { key: 'sector', label: 'Sectors', hint: 'classifications section' },
    { key: 'marketForm', label: 'Market form', hint: 'classifications section' },
    { key: 'locality', label: 'Localities of use', hint: 'classifications section' },
    { key: 'risks', label: 'Risks', hint: 'risk-matrix section' },
];

function slugify(text: string): string {
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || '';
}

export function emptyBuilderQuestion(): BuilderQuestion {
    return { field: '', text: '', citation: '', required: false };
}

export interface QuestionnaireBuilderFormProps {
    mode: QuestionnaireBuilderMode;
    onModeChange: (mode: QuestionnaireBuilderMode) => void;
    blocks: string[];
    onBlocksChange: (blocks: string[]) => void;
    questions: BuilderQuestion[];
    onQuestionsChange: (questions: BuilderQuestion[]) => void;
    definition: string;
    onDefinitionChange: (text: string) => void;
    busy?: boolean;
}

export default function QuestionnaireBuilderForm({
    mode,
    onModeChange,
    blocks,
    onBlocksChange,
    questions,
    onQuestionsChange,
    definition,
    onDefinitionChange,
    busy,
}: QuestionnaireBuilderFormProps) {
    const setQuestion = (index: number, patch: Partial<BuilderQuestion>) =>
        onQuestionsChange(
            questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
        );

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 0.5,
                }}
            >
                <Typography variant="body2" fontWeight={600}>
                    Sections (blocks)
                </Typography>
                <Button
                    size="small"
                    sx={{ textTransform: 'none' }}
                    onClick={() => onModeChange(mode === 'builder' ? 'json' : 'builder')}
                >
                    {mode === 'builder' ? 'Edit as JSON' : 'Use builder'}
                </Button>
            </Box>

            {mode === 'builder' ? (
                <>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {BLOCK_OPTIONS.map((b) => {
                            const selected = blocks.includes(b.key);
                            return (
                                <Chip
                                    key={b.key}
                                    label={b.label}
                                    size="small"
                                    color={selected ? 'primary' : 'default'}
                                    variant={selected ? 'filled' : 'outlined'}
                                    onClick={() =>
                                        onBlocksChange(
                                            blocks.includes(b.key)
                                                ? blocks.filter((k) => k !== b.key)
                                                : [...blocks, b.key],
                                        )
                                    }
                                />
                            );
                        })}
                    </Box>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                    >
                        Toggle the sections the answer form will show. Add a question to
                        create your own field.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {questions.map((q, i) => (
                            <Card key={i} variant="outlined" className="plugins-card">
                                <CardContent
                                    sx={{
                                        py: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1,
                                        '&:last-child': { pb: 1 },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                                            Question {i + 1}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            aria-label={`Remove question ${i + 1}`}
                                            onClick={() =>
                                                onQuestionsChange(questions.filter((_, j) => j !== i))
                                            }
                                        >
                                            <Icon fontSize="small">delete</Icon>
                                        </IconButton>
                                    </Box>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label="Question text"
                                        value={q.text}
                                        onChange={(e) => {
                                            const text = e.target.value;
                                            setQuestion(i, {
                                                text,
                                                field: q.field || slugify(text),
                                            });
                                        }}
                                    />
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label="Field key"
                                        value={q.field}
                                        helperText={
                                            q.field === slugify(q.text) || (q.field && !q.field.trim())
                                                ? ' '
                                                : 'Free key (differs from the auto one)'
                                        }
                                        onChange={(e) => setQuestion(i, { field: e.target.value })}
                                    />
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label="Citation (optional)"
                                        value={q.citation}
                                        onChange={(e) => setQuestion(i, { citation: e.target.value })}
                                    />
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Checkbox
                                            size="small"
                                            checked={q.required}
                                            onChange={(e) => setQuestion(i, { required: e.target.checked })}
                                        />
                                        <Typography variant="body2">Required</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Icon fontSize="small">add</Icon>}
                            onClick={() => onQuestionsChange([...questions, emptyBuilderQuestion()])}
                            sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                        >
                            Add question
                        </Button>
                    </Box>
                </>
            ) : (
                <TextField
                    multiline
                    minRows={10}
                    fullWidth
                    label="Definition (JSON)"
                    value={definition}
                    onChange={(e) => onDefinitionChange(e.target.value)}
                    disabled={busy === true}
                    aria-label="New definition JSON"
                    sx={{ fontFamily: 'monospace' }}
                />
            )}
        </Box>
    );
}
