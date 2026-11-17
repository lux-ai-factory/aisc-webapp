import { useQuery } from '@tanstack/react-query';
import { Catalogue } from './catalogue';
import { getCatalogue, getProjectDimensions, listLibrary } from './checklists';

export const CATALOGUE_QUERY_KEY = ['catalogue'] as const;
export const CHECKLIST_LIBRARY_QUERY_KEY = ['checklists'] as const;
export const PROJECT_DIMENSIONS_QUERY_KEY = ['project-dimensions'] as const;

/** The global catalogue is project-independent and changes rarely; keep the
 *  cached copy for a while so opening "Explore" never refetches it on every
 *  click or page switch. */
export function useCatalogue() {
    const query = useQuery({
        queryKey: CATALOGUE_QUERY_KEY,
        queryFn: getCatalogue,
        staleTime: 5 * 60_000,
    });
    return {
        catalogue: query.data ?? ({ plugins: [], controls: [] } as Catalogue),
        loading: query.isPending,
        error: query.error ?? null,
    };
}

/** A project's installed checklists: served from cache for 30s so navigating
 *  between pages doesn't refetch them; install/uninstall invalidate the key. */
export function useInstalledChecklists(pid: string | null) {
    const query = useQuery({
        queryKey: [...CHECKLIST_LIBRARY_QUERY_KEY, pid],
        queryFn: () => listLibrary(pid as string),
        enabled: !!pid,
        staleTime: 30_000,
    });
    return {
        library: query.data ?? null,
        loading: query.isPending,
        error: query.error ?? null,
    };
}

/** The project's dimensions (from its selected objectives) — what the catalogue
 *  filters by. Absent = not read yet; `[]` = nothing selected, show everything. */
export function useProjectDimensions(pid: string | null) {
    const query = useQuery({
        queryKey: [...PROJECT_DIMENSIONS_QUERY_KEY, pid],
        queryFn: () => getProjectDimensions(pid as string),
        enabled: !!pid,
        staleTime: 30_000,
    });
    return {
        projectObjectives: query.data?.objectives ?? [],
        projectDimensions: query.data?.dimensions ?? [],
        loading: query.isPending,
    };
}
