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

const API_URL = (import.meta.env.VITE_API_URL as string) + API_VERSION_PREFIX;

interface Project {
  pid: string;
  name: string;
}

/**
 * Global dialog shown when the public catalogue routes install(s) to this local
 * app. Walks through the queue of pending plugins; for each, the user picks a
 * project and the plugin is enabled at the catalogue-provided version (there is
 * no version selection here — that comes from the catalogue).
 */
export default function PluginInstallDialog() {
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
