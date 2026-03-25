import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LoginIcon from "@mui/icons-material/Login";

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
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState<OidcProvider[]>([]);

    // Fetch available OIDC providers (also sets the CSRF cookie)
    useEffect(() => {
        fetch(`${ALLAUTH_BASE}/config`, { credentials: "include" })
            .then((res) => res.json())
            .then((data) => {
                const provs = data?.data?.socialaccount?.providers ?? [];
                setProviders(provs);
                if (provs.length === 0) {
                    setError("No identity provider configured. Contact your administrator.");
                }
            })
            .catch((err) => {
                console.error("Failed to fetch providers:", err);
                setError("Unable to reach the server. Is the backend running?");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleOidcLogin = (providerId: string) => {
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

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                            <CircularProgress size={32} />
                        </Box>
                    ) : (
                        providers.map((provider) => (
                            <Button
                                key={provider.id}
                                variant="contained"
                                fullWidth
                                onClick={() => handleOidcLogin(provider.id)}
                                startIcon={<LoginIcon />}
                                sx={{ mb: 1 }}
                            >
                                Sign in
                            </Button>
                        ))
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
