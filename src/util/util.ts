const MODERN_COLORS = [
    '#45B7D1', // Sky Blue
    '#4ECDC4', // Teal
    '#FF6B6B', // Coral
    '#96CEB4', // Mint Green
    '#FFEAA7', // Light Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Aquamarine
    '#F7DC6F', // Banana Yellow
    '#BB8FCE', // Light Purple
    '#85C1E9', // Light Blue
    '#F8C471', // Orange
    '#82E0AA'  // Light Green
] as const;


export const formatFloatTo3Decimals = (value: number): number => {
    return Math.round(value * 1000) / 1000;
};

export const formatDate = (isoString: string) => {
    try {
        return new Date(isoString).toLocaleDateString();
    } catch (e) {
        return isoString;
    }
};

export const getColorFromIndex = (index: number) => MODERN_COLORS[index % MODERN_COLORS.length];


export const getColorFromString = (key: string): string => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % MODERN_COLORS.length;
    return MODERN_COLORS[index];
};
