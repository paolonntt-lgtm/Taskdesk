import React, { useState } from 'react';
import {
  Box, Typography, LinearProgress, Checkbox, IconButton,
  TextField, Button, CircularProgress, Collapse, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Chip, Menu, MenuItem,
} from '@mui/material';
import {
  Add, Delete, ExpandLess, ExpandMore, EditOutlined, CheckBoxOutlineBlank,
  ArrowUpward, ArrowDownward, PlaylistAdd, Label, BookmarkAdd,
} from '@mui/icons-material';
import {
  useListTicketChecklists, useCreateChecklist, useUpdateChecklist, useDeleteChecklist,
  useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  getListTicketChecklistsQueryKey,
} from '@workspace/api-client-react';
import type { ChecklistWithItems } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

function playCheckSound() {
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.06);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available
  }
}

interface Props {
  ticketId: number;
  isAdmin: boolean;
}

interface SingleChecklistProps {
  checklist: ChecklistWithItems;
  ticketId: number;
  isAdmin: boolean;
  onError: (msg: string) => void;
  onDeleted: (id: number) => void;
  onTemplateSaved: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SingleChecklist({ checklist, ticketId, isAdmin, onError, onDeleted, onTemplateSaved, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: SingleChecklistProps) {
  const { t } = useLanguage();
  const ct = t.checklist;
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(checklist.title);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const updateChecklist = useUpdateChecklist();
  const deleteChecklist = useDeleteChecklist();
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();

  const items = [...(checklist.items ?? [])].sort((a, b) => a.position - b.position);
  const itemCount = items.length;
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListTicketChecklistsQueryKey(ticketId) });
  }

  async function handleRename() {
    if (!renameVal.trim() || renameVal.trim() === checklist.title) { setRenaming(false); return; }
    try {
      await updateChecklist.mutateAsync({ ticketId, checklistId: checklist.id, data: { title: renameVal.trim() } });
      invalidate();
    } catch {
      onError(ct.updateError);
    }
    setRenaming(false);
  }

  async function handleDelete() {
    try {
      await deleteChecklist.mutateAsync({ ticketId, checklistId: checklist.id });
      onDeleted(checklist.id);
      invalidate();
    } catch {
      onError(ct.deleteError);
    }
    setDeleteDialogOpen(false);
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    try {
      await addItem.mutateAsync({ ticketId, checklistId: checklist.id, data: { text: newItemText.trim() } });
      setNewItemText('');
      setAddingItem(false);
      invalidate();
    } catch {
      onError(ct.itemError);
    }
  }

  async function handleToggleItem(itemId: number, checked: boolean) {
    if (!checked) playCheckSound();
    try {
      await updateItem.mutateAsync({ ticketId, checklistId: checklist.id, itemId, data: { checked: !checked } });
      invalidate();
    } catch {
      onError(ct.itemError);
    }
  }

  async function handleDeleteItem(itemId: number) {
    try {
      await deleteItem.mutateAsync({ ticketId, checklistId: checklist.id, itemId });
      invalidate();
    } catch {
      onError(ct.itemError);
    }
  }

  async function handleRenameItem(itemId: number) {
    if (!editingItemText.trim()) return;
    try {
      await updateItem.mutateAsync({ ticketId, checklistId: checklist.id, itemId, data: { text: editingItemText.trim() } });
      setEditingItemId(null);
      setEditingItemText('');
      invalidate();
    } catch {
      onError(ct.itemError);
    }
  }

  async function handleReorderItem(itemId: number, direction: 'up' | 'down') {
    const sorted = [...(checklist.items ?? [])].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const neighbor = sorted[swapIdx];
    try {
      await Promise.all([
        updateItem.mutateAsync({ ticketId, checklistId: checklist.id, itemId: current.id, data: { position: neighbor.position } }),
        updateItem.mutateAsync({ ticketId, checklistId: checklist.id, itemId: neighbor.id, data: { position: current.position } }),
      ]);
      invalidate();
    } catch {
      onError(ct.itemError);
    }
  }

  async function handleSaveAsTemplate() {
    if (!isAdmin || !checklist.title.trim() || items.length === 0 || savingAsTemplate) return;
    setSavingAsTemplate(true);
    try {
      const templateResponse = await fetch('/api/checklist-templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: checklist.title.trim() }),
      });
      if (!templateResponse.ok) throw new Error('template creation failed');
      const template = await templateResponse.json() as { id: number };

      try {
        for (const item of items) {
          const itemResponse = await fetch(`/api/checklist-templates/${template.id}/items`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: item.text }),
          });
          if (!itemResponse.ok) throw new Error('template item creation failed');
        }
      } catch (error) {
        await fetch(`/api/checklist-templates/${template.id}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => undefined);
        throw error;
      }

      setTemplateSaved(true);
      onTemplateSaved();
      window.setTimeout(() => setTemplateSaved(false), 3500);
    } catch {
      onError(ct.templateSaveError);
    } finally {
      setSavingAsTemplate(false);
    }
  }

  const fromTemplateName = (checklist as any).fromTemplateName as string | null | undefined;

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      {/* Compact header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.75, px: 0.5 }}>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ p: 0.25 }}>
          {expanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
        </IconButton>

        {renaming ? (
          <>
            <TextField
              size="small"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              autoFocus
              sx={{ flex: 1, '& .MuiInputBase-input': { py: '4px', fontSize: 13 } }}
              disabled={updateChecklist.isPending}
            />
            <Button size="small" onClick={handleRename} disabled={updateChecklist.isPending} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
              {ct.save}
            </Button>
            <Button size="small" onClick={() => { setRenaming(false); setRenameVal(checklist.title); }} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
              {ct.cancel}
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} fontSize={13} noWrap>
                {checklist.title}
              </Typography>
              {fromTemplateName && (
                <Chip
                  icon={<Label sx={{ fontSize: 10 }} />}
                  label={ct.fromTemplate(fromTemplateName)}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                />
              )}
              {total > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, flexShrink: 0 }}>
                  {done}/{total}
                </Typography>
              )}
            </Box>

            {isAdmin && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <Tooltip title={ct.moveUp}>
                  <span>
                    <IconButton size="small" onClick={onMoveUp} disabled={!canMoveUp} sx={{ p: 0.25 }}>
                      <ArrowUpward sx={{ fontSize: 13 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={ct.moveDown}>
                  <span>
                    <IconButton size="small" onClick={onMoveDown} disabled={!canMoveDown} sx={{ p: 0.25 }}>
                      <ArrowDownward sx={{ fontSize: 13 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={ct.renameChecklist}>
                  <IconButton size="small" onClick={() => setRenaming(true)} sx={{ p: 0.25 }}>
                    <EditOutlined sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={ct.saveAsTemplate}>
                  <span>
                    <IconButton
                      size="small"
                      data-testid={`button-save-checklist-as-template-${checklist.id}`}
                      onClick={handleSaveAsTemplate}
                      disabled={savingAsTemplate || items.length === 0}
                      sx={{ p: 0.25 }}
                    >
                      {savingAsTemplate ? <CircularProgress size={13} /> : <BookmarkAdd sx={{ fontSize: 13 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={ct.deleteChecklist}>
                  <IconButton size="small" color="error" onClick={() => setDeleteDialogOpen(true)} sx={{ p: 0.25 }}>
                    <Delete sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Thin progress bar */}
      {total > 0 && (
        <Box sx={{ px: 1, pb: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 3, borderRadius: 2 }}
            color={progress === 100 ? 'success' : 'primary'}
          />
        </Box>
      )}

      {/* Items */}
      <Collapse in={expanded}>
        <Box sx={{ pb: 0.5, pl: 0.5 }}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 0.1,
                '&:hover .item-actions': { opacity: 1 },
              }}
            >
              {item.checked && item.checkedByName ? (
                <Tooltip
                  title={ct.checkedBy(
                    item.checkedByName,
                    item.checkedAt ? new Date(item.checkedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''
                  )}
                  arrow
                >
                  <Checkbox
                    size="small"
                    checked={item.checked}
                    onChange={() => handleToggleItem(item.id, item.checked)}
                    icon={<CheckBoxOutlineBlank sx={{ fontSize: 16 }} />}
                    sx={{ p: 0.4 }}
                    disabled={editingItemId === item.id}
                  />
                </Tooltip>
              ) : (
                <Checkbox
                  size="small"
                  checked={item.checked}
                  onChange={() => handleToggleItem(item.id, item.checked)}
                  icon={<CheckBoxOutlineBlank sx={{ fontSize: 16 }} />}
                  sx={{ p: 0.4 }}
                  disabled={editingItemId === item.id}
                />
              )}

              {editingItemId === item.id ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={editingItemText}
                    onChange={(e) => setEditingItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameItem(item.id);
                      if (e.key === 'Escape') { setEditingItemId(null); setEditingItemText(''); }
                    }}
                    autoFocus
                    disabled={updateItem.isPending}
                    variant="standard"
                    sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
                  />
                  <Button size="small" onClick={() => handleRenameItem(item.id)} disabled={!editingItemText.trim() || updateItem.isPending} sx={{ fontSize: 12, minWidth: 0, px: 1 }}>
                    {ct.save}
                  </Button>
                  <Button size="small" onClick={() => { setEditingItemId(null); setEditingItemText(''); }} sx={{ fontSize: 12, minWidth: 0, px: 1 }}>
                    {ct.cancel}
                  </Button>
                </Box>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      ml: 0.25,
                      fontSize: 13,
                      textDecoration: item.checked ? 'line-through' : 'none',
                      color: item.checked ? 'text.disabled' : 'text.primary',
                    }}
                  >
                    {item.text}
                  </Typography>
                  <Box className="item-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}>
                    {isAdmin && (
                      <>
                        <Tooltip title={ct.moveUp}>
                          <span>
                            <IconButton size="small" onClick={() => handleReorderItem(item.id, 'up')} disabled={items.indexOf(item) === 0 || updateItem.isPending} sx={{ p: 0.25 }}>
                              <ArrowUpward sx={{ fontSize: 12 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={ct.moveDown}>
                          <span>
                            <IconButton size="small" onClick={() => handleReorderItem(item.id, 'down')} disabled={items.indexOf(item) === itemCount - 1 || updateItem.isPending} sx={{ p: 0.25 }}>
                              <ArrowDownward sx={{ fontSize: 12 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={ct.renameItem}>
                          <IconButton size="small" onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); }} sx={{ p: 0.25 }}>
                            <EditOutlined sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title={ct.deleteItem}>
                      <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)} sx={{ p: 0.25 }}>
                        <Delete sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </>
              )}
            </Box>
          ))}

          {/* Add item row */}
          {addingItem ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, pl: 0.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder={ct.addItemPlaceholder}
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); } }}
                autoFocus
                disabled={addItem.isPending}
                sx={{ '& .MuiInputBase-input': { py: '4px', fontSize: 13 } }}
              />
              <Button size="small" variant="contained" onClick={handleAddItem} disabled={!newItemText.trim() || addItem.isPending} sx={{ minWidth: 0, px: 1.5, fontSize: 12 }}>
                {addItem.isPending ? <CircularProgress size={12} color="inherit" /> : ct.save}
              </Button>
              <Button size="small" onClick={() => { setAddingItem(false); setNewItemText(''); }} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
                {ct.cancel}
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              startIcon={<Add sx={{ fontSize: '14px !important' }} />}
              onClick={() => setAddingItem(true)}
              sx={{ mt: 0.25, ml: 0.25, fontSize: 12, px: 1, py: 0.25, textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {ct.addItem}
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Delete checklist confirm */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Delete /> {ct.deleteChecklistTitle}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">{ct.deleteChecklistConfirm}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" disabled={deleteChecklist.isPending}>
            {ct.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteChecklist.isPending}
            startIcon={deleteChecklist.isPending ? <CircularProgress size={14} color="inherit" /> : <Delete />}
          >
            {ct.deleteChecklistAction}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={templateSaved}
        autoHideDuration={3500}
        onClose={() => setTemplateSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setTemplateSaved(false)} sx={{ width: '100%' }}>
          {ct.templateSaved}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface ChecklistTemplate {
  id: number;
  title: string;
  category: string | null;
  items: { id: number; text: string; position: number }[];
}

export default function ChecklistSection({ ticketId, isAdmin }: Props) {
  const { t } = useLanguage();
  const ct = t.checklist;
  const queryClient = useQueryClient();
  const { data: checklists = [], isLoading } = useListTicketChecklists(ticketId);
  const createChecklist = useCreateChecklist();
  const updateChecklist = useUpdateChecklist();
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<HTMLElement | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListTicketChecklistsQueryKey(ticketId) });
  }

  async function openTemplateMenu(e: React.MouseEvent<HTMLElement>) {
    setTemplateMenuAnchor(e.currentTarget);
    if (templates.length === 0) {
      setTemplatesLoading(true);
      try {
        const res = await fetch('/api/checklist-templates', { credentials: 'include' });
        if (res.ok) setTemplates(await res.json());
      } catch {
        // swallow
      } finally {
        setTemplatesLoading(false);
      }
    }
  }

  async function handleApplyTemplate(templateId: number) {
    setTemplateMenuAnchor(null);
    setApplyingTemplateId(templateId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/checklists/from-template/${templateId}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      invalidate();
    } catch {
      setErrorMsg(ct.addFromTemplateError);
    } finally {
      setApplyingTemplateId(null);
    }
  }

  async function handleReorderChecklist(checklistId: number, direction: 'up' | 'down') {
    const sorted = [...(checklists as ChecklistWithItems[])].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((c) => c.id === checklistId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const neighbor = sorted[swapIdx];
    try {
      await Promise.all([
        updateChecklist.mutateAsync({ ticketId, checklistId: current.id, data: { position: neighbor.position } }),
        updateChecklist.mutateAsync({ ticketId, checklistId: neighbor.id, data: { position: current.position } }),
      ]);
      invalidate();
    } catch {
      setErrorMsg(ct.updateError);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    try {
      await createChecklist.mutateAsync({ ticketId, data: { title: newTitle.trim() } });
      setNewTitle('');
      setAddingChecklist(false);
      invalidate();
    } catch {
      setErrorMsg(ct.createError);
    }
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={18} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Section header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2" fontWeight={700} fontSize={13} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {ct.sectionTitle}
        </Typography>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Tooltip title={ct.addFromTemplateTitle}>
            <IconButton
              size="small"
              onClick={openTemplateMenu}
              disabled={applyingTemplateId != null}
              sx={{ p: 0.5 }}
            >
              {applyingTemplateId ? <CircularProgress size={14} color="inherit" /> : <PlaylistAdd sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={ct.addChecklist}>
            <IconButton size="small" onClick={() => setAddingChecklist(true)} disabled={addingChecklist} sx={{ p: 0.5 }}>
              <Add sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Template picker menu */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
        PaperProps={{ sx: { minWidth: 220, maxHeight: 300 } }}
      >
        {templatesLoading ? (
          <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> {ct.addFromTemplateTitle}…</MenuItem>
        ) : templates.length === 0 ? (
          <MenuItem disabled>{ct.noTemplatesAvailable}</MenuItem>
        ) : (
          templates.map((tpl) => (
            <MenuItem key={tpl.id} onClick={() => handleApplyTemplate(tpl.id)} dense>
              <Box>
                <Typography variant="body2" fontWeight={600} fontSize={13}>{tpl.title}</Typography>
                {tpl.category && (
                  <Typography variant="caption" color="text.secondary" fontSize={11}>{tpl.category}</Typography>
                )}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* New checklist name row */}
      {addingChecklist && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={ct.checklistTitlePlaceholder}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setAddingChecklist(false); setNewTitle(''); } }}
            autoFocus
            disabled={createChecklist.isPending}
            sx={{ '& .MuiInputBase-input': { py: '5px', fontSize: 13 } }}
          />
          <Button size="small" variant="contained" onClick={handleCreate} disabled={!newTitle.trim() || createChecklist.isPending} sx={{ minWidth: 0, px: 1.5, fontSize: 12 }}>
            {createChecklist.isPending ? <CircularProgress size={12} color="inherit" /> : ct.save}
          </Button>
          <Button size="small" onClick={() => { setAddingChecklist(false); setNewTitle(''); }} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
            {ct.cancel}
          </Button>
        </Box>
      )}

      {/* Checklist list */}
      {checklists.length === 0 && !addingChecklist && (
        <Typography variant="body2" color="text.secondary" fontSize={12} sx={{ py: 0.5 }}>
          {ct.noChecklists}
        </Typography>
      )}

      <Box>
        {([...(checklists as ChecklistWithItems[])].sort((a, b) => a.position - b.position)).map((cl, idx, arr) => (
          <SingleChecklist
            key={cl.id}
            checklist={cl}
            ticketId={ticketId}
            isAdmin={isAdmin}
            onError={setErrorMsg}
            onDeleted={() => invalidate()}
            onTemplateSaved={() => {
              setTemplates([]);
            }}
            canMoveUp={idx > 0}
            canMoveDown={idx < arr.length - 1}
            onMoveUp={() => handleReorderChecklist(cl.id, 'up')}
            onMoveDown={() => handleReorderChecklist(cl.id, 'down')}
          />
        ))}
      </Box>

      <Snackbar
        open={errorMsg != null}
        autoHideDuration={5000}
        onClose={() => setErrorMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ width: '100%' }}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
