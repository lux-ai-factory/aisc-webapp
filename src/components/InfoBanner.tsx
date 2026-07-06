import {Box, Typography} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import './InfoBanner.css';

interface InfoBannerProps {
    message?: string;
}

export default function InfoBanner({message = "Select a data set to auto fill the configuration"}: InfoBannerProps) {
    return (
        <Box
            className="info-banner"
            sx={{ bgcolor: 'grey.100', color: 'text.secondary' }}
        >
            <InfoOutlinedIcon fontSize="small" color="inherit"/>
            <Typography variant="body2" sx={{fontWeight: 500}}>
                {message}
            </Typography>
        </Box>
    );
}