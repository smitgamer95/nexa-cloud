import React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText, Image, Video, Music, Archive, File,
  FileSpreadsheet, Code2, Globe, FileJson,
  FileCode, Database, Terminal,
} from 'lucide-react';
import type { CloudFile } from '@/types/types';

interface FileIconProps {
  file: CloudFile;
  className?: string;
}

const extIconMap: Record<string, React.ElementType> = {
  // Spreadsheets / office
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  // Web
  html: Globe,
  htm: Globe,
  svg: Globe,
  // Data
  json: FileJson,
  jsonc: FileJson,
  xml: FileJson,
  yaml: FileJson,
  yml: FileJson,
  toml: FileJson,
  // Database
  sql: Database,
  graphql: Database,
  gql: Database,
  // Shell
  sh: Terminal,
  bash: Terminal,
  zsh: Terminal,
  fish: Terminal,
  // Generic code
  js: Code2, mjs: Code2, cjs: Code2,
  ts: Code2, tsx: FileCode, jsx: FileCode,
  py: Code2, php: Code2, rb: Code2,
  go: Code2, rs: Code2, java: Code2, kt: Code2,
  c: Code2, cpp: Code2, h: Code2, hpp: Code2, cs: Code2,
  vue: FileCode, svelte: FileCode,
  md: FileText, mdx: FileText,
};

const categoryIconMap: Record<string, React.ElementType> = {
  images: Image,
  videos: Video,
  audio: Music,
  archives: Archive,
  code: Code2,
  documents: FileText,
};

const extColorMap: Record<string, string> = {
  html: 'text-orange-400', htm: 'text-orange-400',
  css: 'text-blue-400',
  js: 'text-yellow-400', mjs: 'text-yellow-400', cjs: 'text-yellow-400',
  ts: 'text-blue-500', tsx: 'text-blue-400', jsx: 'text-cyan-400',
  json: 'text-green-400', jsonc: 'text-green-400',
  xml: 'text-rose-400', yaml: 'text-purple-400', yml: 'text-purple-400',
  py: 'text-yellow-300', php: 'text-indigo-400', rb: 'text-red-400',
  go: 'text-cyan-400', rs: 'text-orange-500', java: 'text-orange-400',
  sql: 'text-sky-400', graphql: 'text-pink-400', gql: 'text-pink-400',
  sh: 'text-green-300', bash: 'text-green-300',
  md: 'text-slate-400', svg: 'text-teal-400', csv: 'text-emerald-400',
};

const categoryColorMap: Record<string, string> = {
  images: 'text-blue-400',
  videos: 'text-purple-400',
  audio: 'text-green-400',
  archives: 'text-yellow-400',
  code: 'text-cyan-400',
  documents: 'text-red-400',
};

export function FileIcon({ file, className }: FileIconProps) {
  const ext = file.original_name.split('.').pop()?.toLowerCase() || '';
  const Icon = extIconMap[ext] || categoryIconMap[file.file_type] || File;
  const color = extColorMap[ext] || categoryColorMap[file.file_type] || 'text-muted-foreground';
  return <Icon className={cn('h-6 w-6', color, className)} />;
}
