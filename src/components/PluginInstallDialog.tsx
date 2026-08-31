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
import { useEffect, useMemo, useState } from 'react';
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

interface AvailablePackage {
  package_name: string;
  version: string;
}

/**
 * Global dialog shown when the public catalogue routes an install request to
 * this local app. Lets the user pick which project the plugin should be enabled
 * for, then reuses the regular "enable package" backend flow.
 */
export default function PluginInstallDialog() {
  const { pendingInstall, setPendingInstall } = usePluginInstall();
  const { setProjectUUID, setProjectName } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const open = Boolean(pendingInstall);

  const candidateVersions: string[] = useMemo(() => {
    const fromPayload = pendingInstall?.version;
    const list = [...availableVersions];
    if (fromPayload && !list.includes(fromPayload)) list.push(fromPayload);
    return list;
  }, [availableVersions, pendingInstall]);

  useEffect(() => {
    if (!open) return;

    setSelectedProject('');
    setSubmitting(false);

    fetch(`${API_URL}/projects`)
      .then((res) => res.json() as Promise<Project[]>)
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));

    const pkg = pendingInstall?.package;
    if (!pkg) return;

    fetch(`${API_URL}/plugins`)
      .then((res) => res.json() as Promise<AvailablePackage[]>)
      .then((data) => {
        const versions = data
          .filter((p) => p.package_name === pkg)
          .map((p) => p.version);
        const unique = [...new Set(versions)].sort();
        setAvailableVersions(unique);
        if (pendingInstall?.version) {
          setSelectedVersion(pendingInstall.version);
        } else if (unique.length === 1) {
          setSelectedVersion(unique[0]);
        }
      })
      .catch(() => setAvailableVersions([]));
    // Resolve initial version after fetching available versions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit =
    Boolean(selectedProject) && Boolean(selectedVersion) && !submitting;

  const handleInstall = async () => {
    if (!pendingInstall || !selectedProject || !selectedVersion) {
      toast.error('Please select a project and version.', { position: 'bottom-right' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: pendingInstall.package,
          version: selectedVersion,
          project_uuid: selectedProject,
        }),
      });
      if (!res.ok) throw new Error('Network response was not ok');

      const target = projects.find((p) => p.pid === selectedProject);
      setProjectUUID(selectedProject);
      setProjectName(target?.name ?? null);

      // Ensure any cached plugins/project data (e.g. the Plugins page) is
      // refreshed so the newly enabled plugin shows up without a manual reload.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['project'] }),
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
      ]);

      toast.success(`Plugin enabled for ${target?.name ?? 'project'}.`, {
        position: 'bottom-right',
      });
      setPendingInstall(null);
      navigate(`/projects/${target?.name ?? selectedProject}/plugins`);
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
    <Dialog open={open} onClose={() => setPendingInstall(null)} maxWidth="sm" fullWidth>
      <DialogTitle>Install plugin from catalogue</DialogTitle>
      <DialogContent>
        <DialogContentText>
          A plugin from the public catalogue wants to be enabled on this local
          instance.
        </DialogContentText>

        <Typography sx={{ mt: 2 }}>
          <strong>Package:</strong>{' '}
          <code>{pendingInstall?.package ?? 'unknown'}</code>
        </Typography>

        <FormControl fullWidth sx={{ mt: 2 }} disabled={candidateVersions.length === 0}>
          <InputLabel id="plugin-dialog-version-label">Version</InputLabel>
          <Select
            labelId="plugin-dialog-version-label"
            label="Version"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {candidateVersions.map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

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
        <Button onClick={() => setPendingInstall(null)}>Cancel</Button>
        <Button variant="contained" onClick={handleInstall} disabled={!canSubmit}>
          {submitting ? 'Enabling...' : 'Enable plugin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
