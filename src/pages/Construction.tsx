import React from 'react';

interface ConstructionProps {
    title: string;
}

const Construction: React.FC<ConstructionProps> = ({ title }) => {
    return (
        <div>
            <h1>{title}</h1>
            <p>Page under construction.</p>
        </div>
    );
};

export default Construction;