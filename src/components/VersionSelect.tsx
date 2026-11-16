import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Icon from '@mui/material/Icon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';

export interface VersionSelectOption {
    id?: string;
    label: string;
}

export interface VersionSelectProps {
    options: VersionSelectOption[];
    /** id of the active option; when it matches nothing, fallbackLabel is shown */
    value?: string | null;
    onSelect: (id: string | undefined, option: VersionSelectOption) => void;
    /** forwarded to the trigger Button so tests / assistive tech can target it */
    ariaLabel?: string;
    /** label shown on the trigger when no option matches value (default 'Version') */
    fallbackLabel?: string;
    /** always-used trigger label; overrides value/fallback derivation */
    buttonLabel?: string;
    disabled?: boolean;
}

/**
 * The single version dropdown used everywhere a version picker is needed
 * (SideDrawer version gutter, answer/edit forms, questionnaire detail, risk
 * history). One click selects; a circle Radio marks the active revision. The
 * menu is deliberately narrower (180px) than the old per-place copies (280px).
 */
export default function VersionSelect({
    options,
    value,
    onSelect,
    ariaLabel,
    fallbackLabel = 'Version',
    buttonLabel,
    disabled,
}: VersionSelectProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const active = options.find((o) => o.id === value) ?? null;
    return (
        <Box sx={{ display: 'inline-flex' }}>
            <Button
                size="small"
                variant="outlined"
                disabled={disabled || options.length === 0}
                aria-label={ariaLabel}
                endIcon={<Icon fontSize="small">arrow_drop_down</Icon>}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            >
                {buttonLabel ?? active?.label ?? fallbackLabel}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                slotProps={{ paper: { style: { maxHeight: 320, width: 180 } } }}
            >
                {options.map((option) => (
                    <MenuItem
                        key={option.id}
                        selected={option.id === value}
                        sx={{ gap: 0.5, px: 1.5, py: 0.5 }}
                        onClick={() => {
                            setAnchorEl(null);
                            onSelect(option.id, option);
                        }}
                    >
                        <Radio
                            size="small"
                            color="success"
                            checked={option.id === value}
                            disableRipple
                            tabIndex={-1}
                        />
                        <Typography variant="body2" noWrap>
                            {option.label}
                        </Typography>
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
}
