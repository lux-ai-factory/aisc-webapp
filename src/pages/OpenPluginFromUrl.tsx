// Step 4's test tiles (2026-10-03): the launcher's E link opens the execution page with one test's card open,
// /projects/<name>/plugins/evaluation?plugin=<plugin name>. Sean's page (PluginStartEvaluation.tsx) stays as on
// his master and reads nothing from the URL, so this wraps it and opens the card the way a click does: his page
// draws one card per enabled plugin in the project's order, and a closed card opens on a click once its plugin is
// configured. A plugin his page does not list (unknown, disabled) opens nothing.
import { ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext.tsx';
import { getProject } from '../api/api.tsx';

const TRIES = 50;            // every 100 ms: the cards come after the project and each plugin's definitions
const ACTIVE = 'plugin-eval-card--active';

export default function OpenPluginFromUrl({ children }: { children: ReactNode }) {
    const [params] = useSearchParams();
    const wanted = params.get('plugin');
    const { projectUUID } = useProject();
    const { data: project } = useQuery({
        queryKey: ['project', projectUUID],            // the same query as the page's: one request
        queryFn: () => getProject(projectUUID ?? ''),
        enabled: !!projectUUID && !!wanted,
    });

    useEffect(() => {
        if (!wanted || !project) return;
        const listed = project.plugins.filter(p => p.enabled);
        const index = listed.findIndex(p => p.name === wanted);
        if (index < 0) return;
        const label = listed[index].display_name || listed[index].name;
        let tries = 0;
        const timer = setInterval(() => {
            const card = document.querySelectorAll<HTMLElement>('[data-plugin-card]')[index];
            if (card && !(card.textContent || '').includes(label)) { clearInterval(timer); return; }  // not his order
            if (card?.classList.contains(ACTIVE)) {
                card.scrollIntoView?.({ block: 'center' });
                clearInterval(timer);
                return;
            }
            if (card) card.click();
            if (++tries >= TRIES) clearInterval(timer);
        }, 100);
        return () => clearInterval(timer);
    }, [wanted, project]);

    return <>{children}</>;
}
