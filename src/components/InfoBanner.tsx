import {Box, Typography} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface InfoBannerProps {
    message?: string;
}

export default function InfoBanner({message = "Select a data set to auto fill the configuration"}: InfoBannerProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'grey.100',
                color: 'text.secondary',
                p: 1.5,
                borderRadius: 1,
                mb: 2
            }}
        >
            <InfoOutlinedIcon fontSize="small" color="inherit"/>
            <Typography variant="body2" sx={{fontWeight: 500}}>
                {message}
            </Typography>
        </Box>
    );
}