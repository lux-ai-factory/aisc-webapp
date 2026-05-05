import Box from '@mui/material/Box';

import {Gauge} from "@mui/x-charts";



interface MeasurementsGaugeProps {
    title?: string;
    value: number
}

export const MeasurementsGauge = ({ title: _title, value }: MeasurementsGaugeProps) => {

    return (
        <Box sx={{ height: 250, width: '25%' }}>
            <Gauge value={value}/>
        </Box>
    );
}

export default MeasurementsGauge;
