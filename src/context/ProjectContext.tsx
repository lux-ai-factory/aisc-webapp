// src/context/ProjectContext.tsx
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ProjectContextType = {
    projectUUID: string | null;
    setProjectUUID: (uuid: string | null) => void;
    projectName: string | null;
    setProjectName: (name: string | null) => void;
    fileUploadingPids: Set<string>;
    addFileUploadingPid: (pid: string) => void;
    removeFileUploadingPid: (pid: string) => void;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

type ProjectProviderProps = {
    children: ReactNode;
};


export function ProjectProvider({ children }: ProjectProviderProps) {
    const [projectUUID, setProjectUUIDState] = useState<string | null>(null);
    const [projectName, setProjectNameState] = useState<string | null>(null);
    const [fileUploadingPids, setFileUploadingPids] = useState<Set<string>>(new Set());

    // Wrap setters to sync with cookies
    const setProjectUUID = (uuid: string | null) => {
        setProjectUUIDState(uuid);
        // setCookie("projectUUID", uuid);
    };

    const setProjectName = (name: string | null) => {
        setProjectNameState(name);
        // setCookie("projectName", name);
    };

    const addFileUploadingPid = useCallback((pid: string) => {
        setFileUploadingPids(prev => new Set(prev).add(pid));
    }, []);

    const removeFileUploadingPid = useCallback((pid: string) => {
        setFileUploadingPids(prev => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
        });
    }, []);

    return (
        <ProjectContext.Provider
            value={{ projectUUID, setProjectUUID, projectName, setProjectName, fileUploadingPids, addFileUploadingPid, removeFileUploadingPid }}
        >
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
