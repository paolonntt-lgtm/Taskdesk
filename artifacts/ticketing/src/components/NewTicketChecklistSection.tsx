import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, MenuItem, IconButton,
  Collapse, CircularProgress, Chip, Divider,
} from '@mui/material';
import {
  ExpandMore, ExpandLess, Add, Delete, PlaylistAdd, Close,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

export interface ChecklistDraft {
  mode: 'template' | 'manual';
  templateId: number | null;
  templateTitle: string;
  title: string;
  items: string[];
}

interface ChecklistTemplate {
  id: number;
  title: string;
  category: string | null;
  items: { id: number; text: string; position: number }[];
}

interface Props {
  value: ChecklistDraft | null;
  onChange: (draft: ChecklistDraft | null) => void;
  forceExpand?: boolean;
}

export default function NewTicketChecklistSection({ value, onChange, forceExpand }: Props) {
  const { t } = useLanguage();
  const ct = t.newTicket;

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (expanded && !templatesLoaded) {
      setTemplatesLoading(true);
      fetch('/api/checklist-templates', { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then((data: ChecklistTemplate[]) => {
          setTemplates(data);
          setTemplatesLoaded(true);
        })
        .catch(() => setTemplatesLoaded(true))
        .finally(() => setTemplatesLoading(false));
    }
  }, [expanded, templatesLoaded]);

  function handleToggle() {
    setExpanded(v => !v);
  }

  function handleRemove() {
    onChange(null);
    setExpanded(false);
  }

  function handleSelectMode(mode: 'template' | 'manual') {
    onChange({ mode, templateId: null, templateTitle: '', title: '', items: [] });
  }

  function handleTemplateSelect(templateId: number) {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const sortedItems = [...tpl.items].sort((a, b) => a.position - b.position);
    onChange({
      mode: 'template',
      templateId: tpl.id,
      templateTitle: tpl.title,
      title: tpl.title,
      items: sortedItems.map(i => i.text),
    });
  }

  function handleAddItem() {
    if (!newItemText.trim() || !value) return;
    onChange({ ...value, items: [...value.items, newItemText.trim()] });
    setNewItemText('');
  }

  function handleRemoveItem(idx: number) {
    if (!value) return;
    onChange({ ...value, items: value.items.filter((_, i) => i !== idx) });
  }

  const hasValue = value !== null;
  const isTemplate = value?.mode === 'template';

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.25,
          bgcolor: 'action.hover',
          gap: 1,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={handleToggle}
      >
        <PlaylistAdd fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {ct.checklistSection}
        </Typography>

        {hasValue && !expanded && (
          <Chip
            size="small"
            label={isTemplate && value!.templateId
              ? value!.templateTitle
              : ct.checklistSummary(value!.items.length)
            }
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}

        {hasValue && (
          <IconButton
            size="small"
            color="error"
            onClick={e => { e.stopPropagation(); handleRemove(); }}
            title={ct.checklistRemove}
          >
            <Close fontSize="small" />
          </IconButton>
        )}

        <IconButton size="small" onClick={e => { e.stopPropagation(); handleToggle(); }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* No mode selected yet — show mode picker */}
          {!hasValue && (
            <Box display="flex" gap={0.75}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleSelectMode('manual')}
                sx={{ flex: 1, fontSize: '0.72rem', py: 0.5, minHeight: 0 }}
              >
                {ct.checklistModeManual}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleSelectMode('template')}
                sx={{ flex: 1, fontSize: '0.72rem', py: 0.5, minHeight: 0 }}
              >
                {ct.checklistModeTemplate}
              </Button>
            </Box>
          )}

          {/* Mode toggle when already configured */}
          {hasValue && (
            <Box display="flex" gap={0.75}>
              <Button
                size="small"
                variant={!isTemplate ? 'contained' : 'outlined'}
                onClick={() => handleSelectMode('manual')}
                sx={{ flex: 1, fontSize: '0.72rem', py: 0.5, minHeight: 0 }}
              >
                {ct.checklistModeManual}
              </Button>
              <Button
                size="small"
                variant={isTemplate ? 'contained' : 'outlined'}
                onClick={() => handleSelectMode('template')}
                sx={{ flex: 1, fontSize: '0.72rem', py: 0.5, minHeight: 0 }}
              >
                {ct.checklistModeTemplate}
              </Button>
            </Box>
          )}

          {/* Template selector */}
          {hasValue && isTemplate && (
            <Box>
              {templatesLoading ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  <Typography variant="caption">{ct.checklistLoadingTemplates}</Typography>
                </Box>
              ) : templates.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  {ct.checklistNoTemplates}
                </Typography>
              ) : (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={ct.checklistSelectTemplate}
                  value={value!.templateId ?? ''}
                  onChange={e => handleTemplateSelect(Number(e.target.value))}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {templates.map(tpl => (
                    <MenuItem key={tpl.id} value={tpl.id}>
                      {tpl.title}
                      {tpl.category && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({tpl.category})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          )}

          {/* Manual: title field */}
          {hasValue && !isTemplate && (
            <TextField
              fullWidth
              size="small"
              label={ct.checklistNameLabel}
              placeholder={ct.checklistNamePlaceholder}
              value={value!.title}
              onChange={e => value && onChange({ ...value, title: e.target.value })}
            />
          )}

          {/* Items list + add row — shown in manual mode always,
              in template mode only after a template is selected */}
          {hasValue && (!isTemplate || value!.templateId !== null) && (
            <Box>
              {value!.items.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                    {ct.checklistItems}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={0.25} mb={1}>
                    {value!.items.map((item, idx) => (
                      <Box key={idx} display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {idx + 1}. {item}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Delete sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                  <Divider sx={{ mb: 1 }} />
                </>
              )}

              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={ct.checklistItemPlaceholder}
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }
                    if (e.key === 'Escape') setNewItemText('');
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {ct.checklistAddItem}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Collapsed footer — only when no draft configured */}
      {!hasValue && !expanded && (
        <Box sx={{ px: 2, py: 1 }}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={handleToggle}
            color="primary"
          >
            {ct.checklistAdd}
          </Button>
        </Box>
      )}
    </Box>
  );
}
