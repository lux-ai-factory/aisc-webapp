import CircularProgress, {
    CircularProgressProps,
} from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * CircularProgressWithLabel component
 * A circular progress indicator that displays a percentage label in its center
 * Extends Material-UI's CircularProgress with an added percentage label
 * 
 * @param {CircularProgressProps & { value: number }} props - Component props
 * @param {number} props.value - The progress value (0-100)
 * @returns {JSX.Element} A circular progress indicator with a centered percentage label
 */
function CircularProgressWithLabel(
    props: CircularProgressProps & { value: number },
) {
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress variant="determinate" {...props} />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: 'text.secondary' }}
                >{`${Math.round(props.value)}%`}</Typography>
            </Box>
        </Box>
    );
}

export default CircularProgressWithLabel;
