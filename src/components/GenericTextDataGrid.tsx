import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Box, CircularProgress } from '@mui/material';

interface GenericMarkdownPreviewProps {
    title?: string;
    fileUrl: string;
}

export const GenericTextDataGrid: React.FC<GenericMarkdownPreviewProps> = ({ title, fileUrl }) => {
    const [content, setContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;
        setContent(null);
        setError(null);
        setLoading(true);

        fetch(fileUrl)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch the file');
                return res.text();
            })
            .then(text => {
                if (isMounted) {
                    setContent(text);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err.message || 'Could not read file');
                    setLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [fileUrl]);

    if (loading) {
        return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
    }

    if (error) {
        return <Box sx={{ p: 2, color: 'error.main' }}>{error}</Box>;
    }

    if (!content) return null;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                border: 1,
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 2,
                bgcolor: 'background.paper',
                maxHeight: 400,
                overflowY: 'auto',
                width: '100%',
            }}
        >
            {title && <h3>{title}</h3>}

            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
            >
                {content}
            </ReactMarkdown>
        </Box>
    );
};

export default GenericTextDataGrid;
