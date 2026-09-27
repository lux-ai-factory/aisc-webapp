import { apiFetch } from "../api/projectHeader";
import {
  Button,
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
import { installRequestBody } from '../pluginCatalogue/installUri';
import {
  currentPlatformProject,
  projectForPlatformUrl,
  projectsUrl,
} from '../platform/currentProject';

const API_URL = (import.meta.env.VITE_API_URL as string) + API_VERSION_PREFIX;

interface Project {
  pid: string;
  name: string;
}

interface ProjectDetail extends Project {
  plugins?: { package_name: string; version: string }[];
}

/** The engine's 403 on an install: installing a test is an admin's job. */
const NOT_ADMIN = 'Installing a test takes the admin role.';

/**
 * The workspaces an install can go into.
 *
 * When the catalogue was opened from a platform project, its workspace is the
 * one to install into. If it has none yet, the engine is asked for the
 * project's row, which it makes on first visit. Any failure leaves the list
 * empty; the person can still cancel.
 */
async function loadInstallTargets(platformProject: string | null): Promise<Project[]> {
  let found: Project[] = [];
  try {
    found = (await (await apiFetch(projectsUrl(API_URL, platformProject))).json()) as Project[];
  } catch {
    found = [];
  }
  if (found.length === 0 && platformProject) {
    try {
      const res = await apiFetch(projectForPlatformUrl(API_URL, platformProject), { method: 'POST' });
      if (res.ok) found = [(await res.json()) as Project];
    } catch {
      /* the list stays empty */
    }
  }
  return found;
}

/**
 * The project, when it already has this package at this very version.
 * Not knowing is not an error: null keeps the install button.
 */
async function alreadyInstalledIn(
  project: Project,
  pkg: string | null,
  version: string | undefined,
): Promise<Project | null> {
  try {
    const detail = (await (await apiFetch(`${API_URL}/projects/${project.pid}`)).json()) as ProjectDetail;
    const same = (detail.plugins ?? []).some(
      (p) => p.package_name === pkg && p.version === version,
    );
    return same ? { pid: project.pid, name: detail.name ?? project.name } : null;
  } catch {
    return null;
  }
}

/**
 * Global dialog shown when the public catalogue routes install(s) to this local
 * app. Walks through the queue of pending plugins; for each, the user picks a
 * project and the plugin is enabled at the version the catalogue sent (there is
 * no version selection here: the catalogue decides it).
 */
export default function PluginInstallDialog() {
  const { currentInstall, pendingInstalls, advance } = usePluginInstall();
  const { setProjectUUID, setProjectName } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  /** The workspace that already has this package at this version, if any. */
  const [alreadyIn, setAlreadyIn] = useState<Project | null>(null);

  // Items still queued after the one currently being shown.
  const remainingAfterCurrent = pendingInstalls.length - 1;
  const open = Boolean(currentInstall);
  const pkg = currentInstall?.package ?? null;
  const version = currentInstall?.version;

  useEffect(() => {
    if (!open) return;

    setSelectedProject('');
    setSubmitting(false);
    setAlreadyIn(null);
    let cancelled = false;

    const platformProject = currentPlatformProject();
    (async () => {
      const found = await loadInstallTargets(platformProject);
      if (cancelled) return;
      setProjects(found);
      // A single candidate is preselected and checked for this version.
      if (found.length !== 1) return;
      const only = found[0];
      setSelectedProject(only.pid);
      const existing = await alreadyInstalledIn(only, pkg, version);
      if (!cancelled && existing) setAlreadyIn(existing);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pkg, version]);

  const openPlugins = () => {
    if (!alreadyIn) return;
    setProjectUUID(alreadyIn.pid);
    setProjectName(alreadyIn.name);
    const isLast = remainingAfterCurrent === 0;
    advance();
    if (isLast) navigate(`/projects/${alreadyIn.name}/plugins`);
  };

  const canSubmit = Boolean(selectedProject) && !submitting;

  const handleInstall = async () => {
    if (!currentInstall || !selectedProject) {
      toast.error('Please select a project.', { position: 'bottom-right' });
      return;
    }

    setSubmitting(true);
    const target = projects.find((p) => p.pid === selectedProject);
    try {
      const res = await apiFetch(`${API_URL}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installRequestBody(currentInstall, selectedProject)),
      });
      if (res.status === 403) {
        toast.error(NOT_ADMIN, { position: 'bottom-right' });
        return;
      }
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

        {alreadyIn && (
          <Typography sx={{ mt: 2 }}>
            Already installed in {alreadyIn.name}
          </Typography>
        )}

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
        {alreadyIn ? (
          <Button variant="contained" onClick={openPlugins}>
            Open plugins
          </Button>
        ) : (
          <Button variant="contained" onClick={handleInstall} disabled={!canSubmit}>
            {submitting ? 'Installing...' : 'Install'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
