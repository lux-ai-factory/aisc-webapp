import { Typography } from '@mui/material';
import React from 'react';

interface ConstructionProps {
    title: string;
}

const Construction: React.FC<ConstructionProps> = ({ title }) => {
    return (
        <Typography component="h2" variant="h4" gutterBottom>
            {title}
        </Typography>
    );
};

export default Construction;