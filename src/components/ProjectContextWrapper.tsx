import { Fragment, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { API_VERSION_PREFIX } from '../config';

export default function ProjectContextWrapper({ children }: { children: ReactNode }) {
    const { project_name } = useParams();
    const { authenticated } = useAuth();
    const { projectUUID, projectName, setProjectUUID, setProjectName } = useProject();
    const { data, error } = useQuery({
        queryKey: ['projectByName', project_name],
        enabled: authenticated && !!project_name,
        retry: false,
        queryFn: async ({ signal }): Promise<{ pid: string; name: string }> => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}/projects/by-name/${encodeURIComponent(project_name!)}`, { signal });
            if (!response.ok) throw new Error('Could not load project');
            return response.json();
        },
    });
    useEffect(() => {
        setProjectUUID(data?.pid ?? null);
        setProjectName(data?.name ?? null);
    }, [data, setProjectUUID, setProjectName]);
    if (!authenticated) return <Navigate to="/" replace />;
    if (error) return <Alert severity="error">Could not load project.</Alert>;
    if (!data || projectUUID !== data.pid || projectName !== data.name) return <CircularProgress size={24} />;
    return <Fragment key={data.pid}>{children}</Fragment>;
}
