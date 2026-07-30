import { Box, Button, Dialog, DialogContent, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import "./LoginDialog.css";

export default function LoginDialog() {
  const { authenticated, login } = useAuth();

  return (
    <Dialog open={!authenticated} maxWidth="xs" fullWidth>
      <DialogContent>
        <Box display="flex" justifyContent="center" mb={2}>
          <Box component="img" src="/laif_logo.png" alt="Logo" className="login-dialog-logo" />
        </Box>
        <Typography variant="h5" className="login-dialog-title" textAlign="center">
          AI Assessment Sandbox
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" mb={3}>
          Sign in to continue
        </Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={login}
          className="login-dialog-submit"
        >
          Sign in
        </Button>
      </DialogContent>
    </Dialog>
  );
}
