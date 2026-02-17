const MODERN_COLORS = [
    '#FF6B6B', // Coral
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
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