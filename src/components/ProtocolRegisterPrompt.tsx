import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { isProtocolHandlerSupported } from '../pluginCatalogue/installUri';
import { usePluginInstall } from '../pluginCatalogue/PluginInstallContext';

const PROMPT_SHOWN_KEY = 'aisc_protocol_prompt_shown';

/**
 * First-boot prompt offering to register the web+aiscplugin protocol handler,
 * so "enable plugin" links from the public catalogue (or Slack/email) route
 * straight into this app. Shown only once per browser (tracked in localStorage)
 * and only when the browser supports protocol handlers.
 */
export default function ProtocolRegisterPrompt() {
  const { registerProtocol } = usePluginInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isProtocolHandlerSupported()) return;
    // Mark as shown immediately so it only appears once, even if dismissed.
    const shown = localStorage.getItem(PROMPT_SHOWN_KEY) === '1';
    if (!shown) {
      localStorage.setItem(PROMPT_SHOWN_KEY, '1');
      setOpen(true);
    }
  }, []);

  const handleRegister = async () => {
    setBusy(true);
    const status = await registerProtocol();
    setBusy(false);
    if (status === 'registered') {
      toast.success('One-click installs enabled.', { position: 'bottom-right' });
    } else {
      toast.error('Could not register the protocol handler.', { position: 'bottom-right' });
    }
    setOpen(false);
  };

  const handleDismiss = () => setOpen(false);

  return (
    <Dialog open={open} onClose={handleDismiss} maxWidth="sm" fullWidth>
      <DialogTitle>Enable one-click installs?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Let this app open automatically when you click “Enable plugin” on the
          public catalogue (or a link from Slack/email) so you can install
          plugins into a project in a couple of clicks.
        </DialogContentText>
        <DialogContentText sx={{ mt: 1.5, fontSize: 13, color: 'text.secondary' }}>
          You can change this later from the top bar (Register/Unregister).
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss}>Not now</Button>
        <Button variant="contained" onClick={handleRegister} disabled={busy}>
          Enable
        </Button>
      </DialogActions>
    </Dialog>
  );
}
