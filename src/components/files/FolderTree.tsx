import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronRight, Folder, FolderOpen, Home, Loader2, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { listAllFolders } from '@/services/fileService';
import type { CloudFolder } from '@/types/types';

interface TreeNode {
  folder: CloudFolder;
  children: TreeNode[];
}

function buildTree(folders: CloudFolder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  folders.forEach(f => map.set(f.id, { folder: f, children: [] }));
  const roots: TreeNode[] = [];
  folders.forEach(f => {
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(map.get(f.id)!);
    } else {
      roots.push(map.get(f.id)!);
    }
  });
  return roots;
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null, name: string, breadcrumbs: { id: string | null; name: string }[]) => void;
  parentCrumbs: { id: string | null; name: string }[];
}

function TreeNodeRow({ node, depth, selectedId, onSelect, parentCrumbs }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.folder.id;
  const crumbs = [...parentCrumbs, { id: node.folder.id, name: node.folder.name }];

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors select-none',
          isSelected
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          onSelect(node.folder.id, node.folder.name, crumbs);
          if (hasChildren) setExpanded(e => !e);
        }}
      >
        {/* Expand toggle */}
        <span
          className={cn('shrink-0 transition-transform', expanded ? 'rotate-90' : '')}
          onClick={e => { e.stopPropagation(); setExpanded(o => !o); }}
        >
          {hasChildren
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <span className="h-3.5 w-3.5 inline-block" />
          }
        </span>
        {/* Icon */}
        {expanded
          ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          : <Folder className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary' : 'text-yellow-400/70')} />
        }
        <span className="text-xs truncate">{node.folder.name}</span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              parentCrumbs={crumbs}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface FolderTreeProps {
  userId: string;
  selectedId: string | null;
  onSelect: (id: string | null, name: string, breadcrumbs: { id: string | null; name: string }[]) => void;
  refreshTrigger?: number;
}

export function FolderTree({ userId, selectedId, onSelect, refreshTrigger }: FolderTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listAllFolders(userId);
      setTree(buildTree(all));
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const ROOT_CRUMBS = [{ id: null, name: 'My Files' }];

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Folders
        </span>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={load}
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {/* Root / My Files */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors text-xs',
            selectedId === null
              ? 'bg-primary/15 text-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
          )}
          onClick={() => onSelect(null, 'My Files', ROOT_CRUMBS)}
        >
          <Home className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>My Files</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-muted-foreground/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : tree.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground/50">No folders yet.</p>
        ) : (
          tree.map(node => (
            <TreeNodeRow
              key={node.folder.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              parentCrumbs={ROOT_CRUMBS}
            />
          ))
        )}
      </div>
    </div>
  );
}
