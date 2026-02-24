import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
// import { Box, Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Measurement } from '../../models/models.tsx';

interface MeasurementsMarkdownProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsMarkdown = ({title: _title, data}: MeasurementsMarkdownProps) => {
    const markdownContent = data
    .map((measurement) => measurement.description)
    .filter((desc): desc is string => Boolean(desc))
    .join('\n\n');

    if (!markdownContent) return null;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                borderColor: 'grey.400',
                borderRadius: 2,
                padding: 2,
            }}
        >
            {/* {title && <Typography variant="h6">{title}</Typography>} */}

            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
            >
                {markdownContent}
            </ReactMarkdown>
        </Box>
    );
};

export default MeasurementsMarkdown;
