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
    const [projectUUID, setProjectUUID] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string | null>(null);

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
