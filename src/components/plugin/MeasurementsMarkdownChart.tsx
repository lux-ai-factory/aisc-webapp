import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
// import { Box, Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Measurement } from '../../models/models.tsx';
import './MeasurementsMarkdownChart.css';

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
            className="measurements-markdown-box"
            sx={{ borderColor: 'grey.400' }}
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
