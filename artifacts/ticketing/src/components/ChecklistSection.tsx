import React, { useState } from 'react';
import {
  Box, Card, Typography, LinearProgress, Checkbox, IconButton,
  TextField, Button, CircularProgress, Collapse, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Chip, Menu, MenuItem,
} from '@mui/material';
import {
  Add, Delete, ExpandLess, ExpandMore, EditOutlined, CheckBoxOutlineBlank,
  ArrowUpward, ArrowDownward, PlaylistAdd, Label,
} from '@mui/icons-material';
import {
  useListTicketChecklists, useCreateChecklist, useUpdateChecklist, useDeleteChecklist,
  useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  getListTicketChecklistsQueryKey,
} from '@workspace/api-client-react';
import type { ChecklistWithItems } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

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
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SingleChecklist({ checklist, ticketId, isAdmin, onError, onDeleted, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: SingleChecklistProps) {
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
      await updateChecklist.mutateAsync({
        ticketId,
        checklistId: checklist.id,
        data: { title: renameVal.trim() },
      });
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
    try {
      await updateItem.mutateAsync({
        ticketId,
        checklistId: checklist.id,
        itemId,
        data: { checked: !checked },
      });
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
      await updateItem.mutateAsync({
        ticketId,
        checklistId: checklist.id,
        itemId,
        data: { text: editingItemText.trim() },
      });
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

  const fromTemplateName = (checklist as any).fromTemplateName as string | null | undefined;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ mr: 0.5 }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>

        {renaming ? (
          <TextField
            size="small"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            autoFocus
            sx={{ flex: 1 }}
            disabled={updateChecklist.isPending}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {checklist.title}
            </Typography>
            {fromTemplateName && (
              <Chip
                icon={<Label sx={{ fontSize: 12 }} />}
                label={ct.fromTemplate(fromTemplateName)}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
          </Box>
        )}

        {renaming ? (
          <>
            <Button size="small" onClick={handleRename} disabled={updateChecklist.isPending}>
              {ct.save}
            </Button>
            <Button size="small" onClick={() => { setRenaming(false); setRenameVal(checklist.title); }}>
              {ct.cancel}
            </Button>
          </>
        ) : isAdmin ? (
          <>
            <Tooltip title={ct.moveUp}>
              <span>
                <IconButton size="small" onClick={onMoveUp} disabled={!canMoveUp}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={ct.moveDown}>
              <span>
                <IconButton size="small" onClick={onMoveDown} disabled={!canMoveDown}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={ct.renameChecklist}>
              <IconButton size="small" onClick={() => setRenaming(true)}>
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={ct.deleteChecklist}>
              <IconButton size="small" color="error" onClick={() => setDeleteDialogOpen(true)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Box>

      {/* Progress bar */}
      {total > 0 && (
        <Box sx={{ px: 2, pt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
            color={progress === 100 ? 'success' : 'primary'}
          />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {ct.progress(done, total)}
          </Typography>
        </Box>
      )}

      {/* Items */}
      <Collapse in={expanded}>
        <Box sx={{ px: 1, pb: 1 }}>
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 0.25,
                '&:hover .item-actions': { opacity: 1 },
              }}
            >
              {item.checked && item.checkedByName ? (
                <Tooltip
                  title={ct.checkedBy(
                    item.checkedByName,
                    item.checkedAt
                      ? new Date(item.checkedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                      : ''
                  )}
                  arrow
                >
                  <Checkbox
                    size="small"
                    checked={item.checked}
                    onChange={() => handleToggleItem(item.id, item.checked)}
                    icon={<CheckBoxOutlineBlank fontSize="small" />}
                    sx={{ p: 0.5 }}
                    disabled={editingItemId === item.id}
                  />
                </Tooltip>
              ) : (
                <Checkbox
                  size="small"
                  checked={item.checked}
                  onChange={() => handleToggleItem(item.id, item.checked)}
                  icon={<CheckBoxOutlineBlank fontSize="small" />}
                  sx={{ p: 0.5 }}
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
                  />
                  <Button size="small" onClick={() => handleRenameItem(item.id)} disabled={!editingItemText.trim() || updateItem.isPending}>
                    {ct.save}
                  </Button>
                  <Button size="small" onClick={() => { setEditingItemId(null); setEditingItemText(''); }}>
                    {ct.cancel}
                  </Button>
                </Box>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      ml: 0.5,
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
                            <IconButton size="small" onClick={() => handleReorderItem(item.id, 'up')} disabled={items.indexOf(item) === 0 || updateItem.isPending}>
                              <ArrowUpward sx={{ fontSize: 13 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={ct.moveDown}>
                          <span>
                            <IconButton size="small" onClick={() => handleReorderItem(item.id, 'down')} disabled={items.indexOf(item) === itemCount - 1 || updateItem.isPending}>
                              <ArrowDownward sx={{ fontSize: 13 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={ct.renameItem}>
                          <IconButton
                            size="small"
                            onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); }}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title={ct.deleteItem}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </>
              )}
            </Box>
          ))}

          {/* Add item row */}
          {addingItem ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, pl: 0.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder={ct.addItemPlaceholder}
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); } }}
                autoFocus
                disabled={addItem.isPending}
              />
              <Button size="small" variant="contained" onClick={handleAddItem} disabled={!newItemText.trim() || addItem.isPending}>
                {addItem.isPending ? <CircularProgress size={14} color="inherit" /> : ct.save}
              </Button>
              <Button size="small" onClick={() => { setAddingItem(false); setNewItemText(''); }}>
                {ct.cancel}
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => setAddingItem(true)}
              sx={{ mt: 0.5, ml: 0.5 }}
            >
              {ct.addItem}
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Delete checklist confirm */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
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
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        }
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
      const res = await fetch(`/api/tickets/${ticketId}/checklists/from-template/${templateId}`, {
        method: 'POST',
        credentials: 'include',
      });
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
      <Card>
        <Box p={2} display="flex" justifyContent="center">
          <CircularProgress size={20} />
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <Box p={{ xs: 1.5, sm: 2.5 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={checklists.length > 0 || isAdmin ? 2 : 0} flexWrap="wrap" gap={1}>
          <Typography variant="h6" fontWeight={700} fontSize={{ xs: 15, sm: 17 }}>
            {ct.sectionTitle}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={ct.addFromTemplateTitle}>
              <Button
                size="small"
                startIcon={applyingTemplateId ? <CircularProgress size={14} color="inherit" /> : <PlaylistAdd />}
                onClick={openTemplateMenu}
                disabled={applyingTemplateId != null}
                variant="outlined"
              >
                {ct.addFromTemplate}
              </Button>
            </Tooltip>
            {!addingChecklist && (
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setAddingChecklist(true)}
              >
                {ct.addChecklist}
              </Button>
            )}
          </Box>
        </Box>

        {/* Template picker menu */}
        <Menu
          anchorEl={templateMenuAnchor}
          open={Boolean(templateMenuAnchor)}
          onClose={() => setTemplateMenuAnchor(null)}
          PaperProps={{ sx: { minWidth: 240, maxHeight: 320 } }}
        >
          {templatesLoading ? (
            <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> {ct.addFromTemplateTitle}…</MenuItem>
          ) : templates.length === 0 ? (
            <MenuItem disabled>{ct.noTemplatesAvailable}</MenuItem>
          ) : (
            templates.map((tpl) => (
              <MenuItem key={tpl.id} onClick={() => handleApplyTemplate(tpl.id)}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{tpl.title}</Typography>
                  {tpl.category && (
                    <Typography variant="caption" color="text.secondary">{tpl.category}</Typography>
                  )}
                </Box>
              </MenuItem>
            ))
          )}
        </Menu>

        {checklists.length === 0 && !addingChecklist && (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={1}>
            {ct.noChecklists}
          </Typography>
        )}

        <Box display="flex" flexDirection="column" gap={1.5}>
          {([...(checklists as ChecklistWithItems[])].sort((a, b) => a.position - b.position)).map((cl, idx, arr) => (
            <SingleChecklist
              key={cl.id}
              checklist={cl}
              ticketId={ticketId}
              isAdmin={isAdmin}
              onError={setErrorMsg}
              onDeleted={() => invalidate()}
              canMoveUp={idx > 0}
              canMoveDown={idx < arr.length - 1}
              onMoveUp={() => handleReorderChecklist(cl.id, 'up')}
              onMoveDown={() => handleReorderChecklist(cl.id, 'down')}
            />
          ))}
        </Box>

        {addingChecklist && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: checklists.length > 0 ? 1.5 : 0 }}>
            <TextField
              size="small"
              fullWidth
              placeholder={ct.checklistTitlePlaceholder}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setAddingChecklist(false); setNewTitle(''); } }}
              autoFocus
              disabled={createChecklist.isPending}
            />
            <Button
              size="small"
              variant="contained"
              onClick={handleCreate}
              disabled={!newTitle.trim() || createChecklist.isPending}
            >
              {createChecklist.isPending ? <CircularProgress size={14} color="inherit" /> : ct.save}
            </Button>
            <Button size="small" onClick={() => { setAddingChecklist(false); setNewTitle(''); }}>
              {ct.cancel}
            </Button>
          </Box>
        )}
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
    </Card>
  );
}
