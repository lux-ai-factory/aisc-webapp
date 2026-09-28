import {
  Button,
  Link,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import { usePluginInstall } from '../pluginCatalogue/PluginInstallContext';
import { catalogueSlugOf } from '../pluginCatalogue/installUri';
import { PROJECT_HEADER } from '../api/projectHeader';
import { isConfigurator } from '../deployment';
import {
  currentPlatformProject,
  isPlatformPid,
  lastPlatformProject,
  projectForPlatformUrl,
  rememberLastPlatformProject,
  rememberPlatformProject,
} from '../platform/currentProject';

const API_URL = (import.meta.env.VITE_API_URL as string) + API_VERSION_PREFIX;

interface Project {
  pid: string;
  name: string;
}

/**
 * Standalone (Sean's master, unchanged): walks through the queue of pending
 * plugins; for each, the user picks one of the engine's projects and the plugin
 * is enabled at the catalogue-provided version (there is no version selection
 * here: that comes from the catalogue).
 */
function StandaloneInstallDialog() {
  const { currentInstall, pendingInstalls, advance } = usePluginInstall();
  const { setProjectUUID, setProjectName } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Items still queued after the one currently being shown.
  const remainingAfterCurrent = pendingInstalls.length - 1;
  const open = Boolean(currentInstall);
  const pkg = currentInstall?.package ?? null;
  const version = currentInstall?.version;

  useEffect(() => {
    if (!open) return;

    setSelectedProject('');
    setSubmitting(false);

    fetch(`${API_URL}/projects`)
      .then((res) => res.json() as Promise<Project[]>)
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));
  }, [open, pkg]);

  const canSubmit = Boolean(selectedProject) && !submitting;

  const handleInstall = async () => {
    if (!currentInstall || !selectedProject) {
      toast.error('Please select a project.', { position: 'bottom-right' });
      return;
    }

    setSubmitting(true);
    const target = projects.find((p) => p.pid === selectedProject);
    try {
      const res = await fetch(`${API_URL}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: currentInstall.package,
          version: currentInstall.version,
          project_uuid: selectedProject,
        }),
      });
      if (!res.ok) throw new Error('Network response was not ok');

      setProjectUUID(selectedProject);
      setProjectName(target?.name ?? null);

      // Refresh cached plugin/project data so the newly enabled plugin shows up.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['project'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);

      toast.success(`Plugin enabled for ${target?.name ?? 'project'}.`, {
        position: 'bottom-right',
      });
      // Was this the last plugin in the queue? If so, take the user to the
      // plugins page after this one is consumed.
      const isLast = remainingAfterCurrent === 0;
      advance();
      if (isLast) {
        navigate(`/projects/${target?.name ?? selectedProject}/plugins`);
      }
    } catch (err) {
      console.error('Failed to enable plugin:', err);
      toast.error('Could not enable the plugin. Is it available in the local plugin registry?', {
        position: 'bottom-right',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => advance()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Install plugin from catalogue
        {remainingAfterCurrent > 0 && (
          <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'text.secondary' }}>
            ({remainingAfterCurrent + 1} of {pendingInstalls.length})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          A plugin from the public catalogue wants to be enabled on this local
          instance.
        </DialogContentText>

        <Typography sx={{ mt: 2 }}>
          <strong>Package:</strong>{' '}
          <code>{pkg ?? 'unknown'}</code>
        </Typography>

        <Typography sx={{ mt: 1 }}>
          <strong>Version:</strong> <code>{version}</code>
        </Typography>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="plugin-dialog-project-label">Project</InputLabel>
          <Select
            labelId="plugin-dialog-project-label"
            label="Project"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((p) => (
              <MenuItem key={p.pid} value={p.pid}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => advance()}>Cancel</Button>
        <Button variant="contained" onClick={handleInstall} disabled={!canSubmit}>
          {submitting ? 'Enabling...' : 'Enable plugin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** A platform project the caller is in (GET /platform/api/projects). */
interface PlatformProject {
  pid: string;
  name: string;
  slug?: string;
}

/** The caller's platform projects, served by the gateway (not the engine). */
const PLATFORM_PROJECTS_URL = '/platform/api/projects';

const launcherUrl = (): string => (import.meta.env.VITE_LAUNCHER_URL as string) || 'http://localhost:8100/';

/** The engine's 403 on an install: installing a test is an admin's job. */
const NOT_ADMIN = 'Installing a test takes the admin role.';
const NOT_MEMBER = 'You are not in this project.';
const LIST_UNREADABLE = 'Your projects could not be loaded. Open this from your project on the launcher.';

/** null: the list could not be read (the gateway decides, on Install). */
async function loadPlatformProjects(): Promise<PlatformProject[] | null> {
  try {
    const res = await fetch(PLATFORM_PROJECTS_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as PlatformProject[]) : null;
  } catch {
    return null;
  }
}

/**
 * Configurator: the engine has no project list of its own. The install goes to
 * the link's ?project=, else the project last opened in this browser, named;
 * the caller's platform projects are there to change it. The engine's side of
 * the project is found (or made) by for-platform, then the plugin is enabled
 * in it, both calls naming the target project.
 */
function ConfiguratorInstallDialog() {
  const { currentInstall, pendingInstalls, advance } = usePluginInstall();
  const { setProjectUUID, setProjectName } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /** undefined: loading; null: could not be read. */
  const [mine, setMine] = useState<PlatformProject[] | null | undefined>(undefined);
  const [target, setTarget] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  /** The engine said the caller is not in the target (for-platform 404). */
  const [refused, setRefused] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remainingAfterCurrent = pendingInstalls.length - 1;
  const open = Boolean(currentInstall);
  const pkg = currentInstall?.package ?? null;
  const version = currentInstall?.version;

  useEffect(() => {
    if (!open) return;
    // Only a pid is a target; anything else is no target.
    const fromTab = currentPlatformProject();
    setTarget(isPlatformPid(fromTab) ? fromTab : lastPlatformProject());
    setChanging(false);
    setRefused(null);
    setSubmitting(false);
    setMine(undefined);
    let cancelled = false;
    loadPlatformProjects().then((found) => {
      if (!cancelled) setMine(found);
    });
    return () => {
      cancelled = true;
    };
  }, [open, pkg, version]);

  const inNoProject = Array.isArray(mine) && mine.length === 0;
  const lost = mine === null && !target;
  const named = Array.isArray(mine) ? mine.find((p) => p.pid.toLowerCase() === target?.toLowerCase()) : undefined;
  const notMember =
    Boolean(target) && (refused === target || (Array.isArray(mine) && mine.length > 0 && !named));
  const canSubmit = Boolean(target) && mine !== undefined && !inNoProject && !notMember && !submitting;

  const choose = (pid: string) => {
    setTarget(pid);
    setRefused(null);
  };

  const handleInstall = async () => {
    if (!currentInstall || !target) return;
    setSubmitting(true);
    const headers = { [PROJECT_HEADER]: target };
    try {
      const found = await fetch(projectForPlatformUrl(API_URL, target), { method: 'POST', headers });
      if (found.status === 404) {
        setRefused(target);
        return;
      }
      if (found.status === 403) {
        toast.error(NOT_ADMIN, { position: 'bottom-right' });
        return;
      }
      if (!found.ok) throw new Error(`for-platform answered ${found.status}`);
      const engine = (await found.json()) as Project;

      const slug = catalogueSlugOf(currentInstall);
      const res = await fetch(`${API_URL}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          package_name: currentInstall.package,
          version: currentInstall.version,
          project_uuid: engine.pid,
          ...(slug ? { catalogue_slug: slug } : {}),
        }),
      });
      if (res.status === 403) {
        toast.error(NOT_ADMIN, { position: 'bottom-right' });
        return;
      }
      if (!res.ok) throw new Error(`install answered ${res.status}`);

      // This tab now works in the target project.
      rememberPlatformProject(target);
      rememberLastPlatformProject(target);
      setProjectUUID(engine.pid);
      setProjectName(engine.name ?? null);

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['project'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);

      const label = named?.name ?? engine.name ?? 'the project';
      toast.success(`Test installed in ${label}.`, { position: 'bottom-right' });
      const isLast = remainingAfterCurrent === 0;
      advance();
      if (isLast) navigate(`/projects/${engine.name ?? engine.pid}/plugins`);
    } catch (err) {
      console.error('Failed to install the test:', err);
      toast.error('Could not install the test. Is it in the local plugin registry?', {
        position: 'bottom-right',
      });
    } finally {
      setSubmitting(false);
    }
  };

  let where: string;
  if (named) where = `Install into ${named.name}`;
  else if (target && mine === null) where = 'Install into the project you came from';
  else where = 'Choose a project';

  return (
    <Dialog open={open} onClose={() => advance()} maxWidth="sm" fullWidth>
      <DialogTitle>
        Install a test from the catalogue
        {remainingAfterCurrent > 0 && (
          <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'text.secondary' }}>
            ({remainingAfterCurrent + 1} of {pendingInstalls.length})
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Typography>
          <strong>Package:</strong> <code>{pkg ?? 'unknown'}</code>
        </Typography>
        <Typography sx={{ mt: 1 }}>
          <strong>Version:</strong> <code>{version}</code>
        </Typography>

        {inNoProject ? (
          <Typography sx={{ mt: 2 }}>
            You are in no project yet: create one on the launcher.{' '}
            <Link href={launcherUrl()}>Go to the launcher</Link>
          </Typography>
        ) : lost ? (
          <Typography sx={{ mt: 2 }}>
            {LIST_UNREADABLE}{' '}
            <Link href={launcherUrl()}>Go to the launcher</Link>
          </Typography>
        ) : (
          mine !== undefined && (
            <>
              <Typography sx={{ mt: 2 }}>
                <strong>{where}</strong>
                {Array.isArray(mine) && !changing && (
                  <Button size="small" sx={{ ml: 1 }} onClick={() => setChanging(true)}>
                    Change
                  </Button>
                )}
              </Typography>
              {notMember && (
                <Typography sx={{ mt: 1 }} color="error">
                  {NOT_MEMBER}
                </Typography>
              )}
              {Array.isArray(mine) && (changing || !target) && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel id="plugin-dialog-platform-project-label">Project</InputLabel>
                  <Select
                    labelId="plugin-dialog-platform-project-label"
                    label="Project"
                    value={named?.pid ?? ''}
                    onChange={(e) => choose(e.target.value)}
                  >
                    {mine.map((p) => (
                      <MenuItem key={p.pid} value={p.pid}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => advance()}>Cancel</Button>
        <Button variant="contained" onClick={handleInstall} disabled={!canSubmit}>
          {submitting ? 'Installing...' : 'Install'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Global dialog shown when the public catalogue routes install(s) to this app:
 * Sean's project picker standalone, the project you came from in the Configurator.
 */
export default function PluginInstallDialog() {
  return isConfigurator() ? <ConfiguratorInstallDialog /> : <StandaloneInstallDialog />;
}
