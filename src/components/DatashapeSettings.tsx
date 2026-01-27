import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Button,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'; import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import { isDeeplyEqual } from '../utils';

enum FeatureType {
  FLOAT = "float",
  INTEGER = "integer",
  CATEGORICAL = "categorical",
  DATE = "date"
}

enum FeatureTypeHuman {
  FLOAT = "Continuous",
  INTEGER = "Discrete",
  CATEGORICAL = "Categorical",
  DATE = "Date"
}

interface Feature {
  name: string;
  min_value: number;
  max_value: number;
  feature_type: FeatureType;
  isDate: boolean;
  isTarget: boolean;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


interface Dataset {
  pid: string;
  name: string;
  data: string;
}

type ImportButtonProps = {
  onImportFeatures: (dataset_pid: string) => void;
};

const ImportButton = ({ onImportFeatures }: ImportButtonProps) => {

  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);

  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const { projectUUID } = useProject()

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true)
      try {
        const response = await fetch(`${API_URL}/projects/${projectUUID}`);
        if (!response.ok) {
          throw new Error('Failed to fetch datasets');
        }
        const data = await response.json();
        setDatasets(data.datasets);
      } catch (err) {
        setDatasets([]);
      } finally {
        setLoadingDatasets(false)
      }
    };

    if (openImportDialog) {
      fetchDatasets();
    }
  }, [openImportDialog]);


  const handleImportFeatures = (dataset_pid: string | null) => {
    if (!dataset_pid) return;
    onImportFeatures(dataset_pid);
    setOpenImportDialog(false);
  };

  if (loadingDatasets) {
    return <CircularProgress />
  }

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<ContentCopyIcon />}
        onClick={() => setOpenImportDialog(true)}
      >
        Import Features
      </Button>
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)}>
        <DialogTitle>Import Features</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 2 }}>
            This action will import feature names, minimum and maximum values observed in a dataset of the project.
            Note that this will appear in edit mode in the datashape feature table.
            You still have to select the target and timestamp feature.
            Don't forget to save to apply your modifications.
            Select the dataset you want to import features from.
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Dataset</InputLabel>
            <Select
              value={selectedDataset || ''}
              onChange={(e) => setSelectedDataset(e.target.value as string)}
              label="Dataset"
            >
              {datasets.map((dataset) => (
                <MenuItem key={dataset.pid} value={dataset.pid}>{dataset.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
          <Button
            onClick={() => handleImportFeatures(selectedDataset)}
            disabled={!selectedDataset}
            variant="contained"
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
};

const DatashapeSettings = () => {
  const [existingFeatures, setExistingFeatures] = useState<Feature[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChanged, setIsChanged] = useState(false);

  const { projectUUID } = useProject()


  const orederFeatures = (features: Feature[]) => {
    const sortedFeatures = [...features].sort((a, b) => {
      if (a.isTarget && !b.isTarget) return -1;
      if (!a.isTarget && b.isTarget) return 1;
      if (a.isDate && !b.isDate) return -1;
      if (!a.isDate && b.isDate) return 1;
      return a.name.localeCompare(b.name);
    });
    return sortedFeatures;
  };

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const response = await fetch(`${API_URL}/projects/${projectUUID}/datashape`);
        if (!response.ok) {
          throw new Error('Failed to fetch features');
        }
        const data = await response.json();
        const features = [...data.features, data.date, data.target]
        setFeatures(orederFeatures(features.map((f: any) => ({
          ...f,
          isDate: data.date.pid === f.pid,
          isTarget: data.target.pid === f.pid
        }))));
      } catch (err) {
        setFeatures([]);
      } finally {
        setExistingFeatures(orederFeatures(features));
        setIsChanged(false);
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [projectUUID]);

  useEffect(() => {
    const evalIsChanged = isDeeplyEqual(existingFeatures, features)
    setIsChanged(evalIsChanged)
  }, [existingFeatures, features]);

  const handleAddFeature = () => {
    setFeatures(prev => [...prev, {
      name: '',
      min_value: 0,
      max_value: 0,
      feature_type: FeatureType.FLOAT,
      isDate: false,
      isTarget: false
    }]);
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleDate = (index: number) => {
    setFeatures(prev => prev.map((f, i) => {
      if (i === index) {
        return { ...f, isDate: !f.isDate, isTarget: false };
      }
      return { ...f, isDate: false };
    }));
  };

  const handleToggleTarget = (index: number) => {
    setFeatures(prev => prev.map((f, i) => {
      if (i === index) {
        return { ...f, isTarget: !f.isTarget, isDate: false };
      }
      return { ...f, isTarget: false };
    }));
  };

  const handleChange = (index: number, field: keyof Feature, value: any) => {
    setFeatures(prev => prev.map((f, i) =>
      i === index ? { ...f, [field]: value } : f
    ));
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;



  const handleImportFeatures = async (dataset_pid: string) => {
    if (!dataset_pid) return;

    try {
      const response = await fetch(`${API_URL}/datasets/${dataset_pid}/datashape`);
      if (!response.ok) {
        throw new Error('Failed to import features');
      }
      const data = await response.json();
      setFeatures(data.features.map((f: any) => ({
        ...f,
        isDate: f.isDate || false,
        isTarget: f.isTarget || false
      })));
    } catch (err) {
      console.error('Error importing features:', err);
    }
  };


  const handleSave = async () => {
    try {
      const dateFeature = features.find(f => f.isDate);
      const targetFeature = features.find(f => f.isTarget);
      const sendFeatures = features.filter(f => !f.isDate && !f.isTarget);

      if (!dateFeature || !targetFeature) {
        setError('Please select both a date and target feature');
        return;
      }

      const featureToDto = (feature: Feature | undefined) => {
        if (!feature) return undefined;
        return {
          name: feature.name,
          min_value: feature.min_value,
          max_value: feature.max_value,
          feature_type: feature.feature_type
        };
      };

      const response = await fetch(`${API_URL}/projects/${projectUUID}/datashape`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features: sendFeatures.map(featureToDto),
          date: featureToDto(dateFeature),
          target: featureToDto(targetFeature)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save features');
      }

      setExistingFeatures(orederFeatures([...features]));
      setFeatures(orederFeatures([...features]));
      setIsChanged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save features');
    }
  }


  const featureTypes = Object.entries(FeatureType) as [keyof typeof FeatureType, FeatureType][];


  return (
    <Box sx={{ p: 2 }}>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Min Value</TableCell>
              <TableCell>Max Value</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {features.filter(feature => feature.name).map((feature, index) => (
              <TableRow key={index}>
                <TableCell>
                  <TextField
                    value={feature.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={feature.min_value}
                    onChange={(e) => handleChange(index, 'min_value', parseFloat(e.target.value))}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={feature.max_value}
                    onChange={(e) => handleChange(index, 'max_value', parseFloat(e.target.value))}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <FormControl fullWidth>
                    <Select
                      value={feature.feature_type.toLowerCase()}
                      onChange={(e) => handleChange(index, 'feature_type', e.target.value)}
                    >

                      {featureTypes.map(([key, value]) => (
                        <MenuItem key={value} value={value}>{FeatureTypeHuman[key]}</MenuItem>
                      ))}
                      {/* <MenuItem value="continuous">Continuous</MenuItem>
                      <MenuItem value="categorical">Categorical</MenuItem> */}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <IconButton
                    color={feature.isDate ? 'primary' : 'default'}
                    sx={{
                      '& .MuiSvgIcon-root': {
                        transition: 'transform 0.2s',
                        transform: feature.isDate ? 'scale(1.5)' : 'scale(1)'
                      }
                    }}
                    onClick={() => handleToggleDate(index)}
                  >
                    <AccessTimeIcon />
                  </IconButton>
                </TableCell>
                <TableCell>
                  <IconButton
                    color={feature.isTarget ? 'primary' : 'default'}
                    sx={{
                      '& .MuiSvgIcon-root': {
                        transition: 'transform 0.2s',
                        transform: feature.isTarget ? 'scale(1.5)' : 'scale(1)'
                      }
                    }}
                    onClick={() => handleToggleTarget(index)}
                  >
                    <FlagIcon />
                  </IconButton>
                </TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveFeature(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'left', mt: 2, gap: 2 }}>
        <ImportButton onImportFeatures={handleImportFeatures} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddFeature}
        >
          Add Feature
        </Button>


      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'right', mt: 2, gap: 2 }}>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={isChanged}
          onClick={handleSave}
        >
          Save changes
        </Button>
      </Box>
    </Box>
  );
};

export default DatashapeSettings;
