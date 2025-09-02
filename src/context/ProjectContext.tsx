// src/context/ProjectContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

type ProjectContextType = {
    projectUUID: string | null;
    setProjectUUID: (uuid: string | null) => void;
    projectName: string | null;
    setProjectName: (name: string | null) => void;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

type ProjectProviderProps = {
    children: ReactNode;
};


export function ProjectProvider({ children }: ProjectProviderProps) {
    const [projectUUID, setProjectUUIDState] = useState<string | null>(null);
    const [projectName, setProjectNameState] = useState<string | null>(null);

    // Wrap setters to sync with cookies
    const setProjectUUID = (uuid: string | null) => {
        setProjectUUIDState(uuid);
        // setCookie("projectUUID", uuid);
    };

    const setProjectName = (name: string | null) => {
        setProjectNameState(name);
        // setCookie("projectName", name);
    };

    return (
        <ProjectContext.Provider
            value={{ projectUUID, setProjectUUID, projectName, setProjectName }}
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
