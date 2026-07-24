import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import "./LoginDialog.css";

interface LoginDialogProps {
  open: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onClose?: () => void;
}

export default function LoginDialog({ open, onLogin, onClose }: LoginDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const parseError = (err: any): string => {
    const msg = err?.message || "";
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error_description) return parsed.error_description;
      if (parsed.error) return parsed.error;
    } catch {
      // not JSON, use as-is
    }
    if (msg.includes("invalid_grant")) return "Invalid email or password";
    if (msg.includes("Login failed")) return "Login failed. Please try again.";
    return msg || "An error occurred";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth onClose={onClose}>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} className="login-dialog-content">
          <Box display="flex" justifyContent="center" mb={2}>
            <Box component="img" src="/laif_logo.png" alt="Logo" className="login-dialog-logo" />
          </Box>
          <Typography variant="h5" className="login-dialog-title">
            AI Assessment Sandbox
          </Typography>
          {error && (
            <Alert severity="error" className="login-dialog-error">
              <AlertTitle>Sign in failed</AlertTitle>
              {error}
            </Alert>
          )}
          <TextField
            label="Email or Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            autoFocus
            autoComplete="username"
            disabled={loading}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="current-password"
            disabled={loading}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} className="login-dialog-submit">
            {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
