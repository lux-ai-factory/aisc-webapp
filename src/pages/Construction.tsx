import { Typography } from '@mui/material';
import React from 'react';

/**
 * Props interface for the Construction component
 * @interface ConstructionProps
 * @property {string} title - The title to display on the construction page
 */
interface ConstructionProps {
    title: string;
}

/**
 * Construction page component
 * Displays a placeholder page for features that are under construction
 * Shows a heading with the provided title
 * 
 * @param {ConstructionProps} props - Component props
 * @param {string} props.title - The title to display
 * @returns {JSX.Element} A typography component displaying the title
 */
const Construction: React.FC<ConstructionProps> = ({ title }) => {
    return (
        <Typography component="h2" variant="h4" gutterBottom>
            {title}
        </Typography>
    );
};

export default Construction;