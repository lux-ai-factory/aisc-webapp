import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const ALLAUTH_BASE = "/_allauth/browser/v1";

type User = {
    id: number;
    email: string;
    username: string;
};

type AuthContextType = {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    checkSession: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
    children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch(`${ALLAUTH_BASE}/auth/session`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                const u = data?.data?.user;
                if (u) {
                    setUser({ id: u.id, email: u.email, username: u.username || u.email });
                    setIsAuthenticated(true);
                } else {
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch {
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const logout = useCallback(async () => {
        await fetch(`${ALLAUTH_BASE}/auth/session`, {
            method: "DELETE",
            credentials: "include",
        });
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, user, checkSession, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
