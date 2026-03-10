import { useState, useEffect, FormEvent } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LoginIcon from "@mui/icons-material/Login";
import { useAuth } from "../context/AuthContext";

const ALLAUTH_BASE = "/_allauth/browser/v1";

type OidcProvider = {
    id: string;
    name: string;
};

function getCsrfToken(): string {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
}

export default function LoginPage() {
    const { checkSession } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [providers, setProviders] = useState<OidcProvider[]>([]);

    // Fetch available OIDC providers (also sets the CSRF cookie)
    useEffect(() => {
        fetch(`${ALLAUTH_BASE}/config`, { credentials: "include" })
            .then((res) => res.json())
            .then((data) => {
                const provs = data?.data?.socialaccount?.providers ?? [];
                setProviders(provs);
            })
            .catch(() => {});
    }, []);

    const handleEmailLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const res = await fetch(`${ALLAUTH_BASE}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken(),
                },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                await checkSession();
            } else {
                const data = await res.json().catch(() => null);
                const msg = data?.errors?.[0]?.message
                    || data?.error?.message
                    || "Login failed. Check your credentials.";
                setError(msg);
            }
        } catch {
            setError("Network error. Is the backend running?");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOidcLogin = (providerId: string) => {
        // Use a hidden form to POST to allauth's provider redirect endpoint
        // This triggers a full-page browser redirect to the IdP
        const form = document.createElement("form");
        form.method = "POST";
        form.action = `${ALLAUTH_BASE}/auth/provider/redirect`;

        const addField = (name: string, value: string) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = value;
            form.appendChild(input);
        };

        addField("provider", providerId);
        addField("callback_url", window.location.origin + "/");
        addField("process", "login");
        addField("csrfmiddlewaretoken", getCsrfToken());

        document.body.appendChild(form);
        form.submit();
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#f5f5f5",
            }}
        >
            <Card sx={{ maxWidth: 420, width: "100%", mx: 2 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" align="center" gutterBottom fontWeight={600}>
                        A4S
                    </Typography>
                    <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
                        Sign in to continue
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleEmailLogin}>
                        <TextField
                            label="Email"
                            type="email"
                            fullWidth
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            sx={{ mb: 2 }}
                            size="small"
                        />
                        <TextField
                            label="Password"
                            type="password"
                            fullWidth
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            sx={{ mb: 2 }}
                            size="small"
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={submitting}
                            startIcon={submitting ? <CircularProgress size={18} /> : <LoginIcon />}
                            sx={{ mb: 2 }}
                        >
                            {submitting ? "Signing in..." : "Sign in"}
                        </Button>
                    </Box>

                    {providers.length > 0 && (
                        <>
                            <Divider sx={{ my: 2 }}>or</Divider>
                            {providers.map((provider) => (
                                <Button
                                    key={provider.id}
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleOidcLogin(provider.id)}
                                    sx={{ mb: 1 }}
                                >
                                    Sign in with {provider.name}
                                </Button>
                            ))}
                        </>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
