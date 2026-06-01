import { supabase } from '@/db/supabase';
import type { CloudFile, CloudFolder, FileCategory } from '@/types/types';
import { updateStorageUsed } from './profileService';

// ── Allowed types ──────────────────────────────────────────────────────────
export const ALLOWED_EXTENSIONS = [
  // Images
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
  // Video
  'mp4', 'mov', 'webm',
  // Documents
  'pdf', 'docx', 'txt', 'pptx', 'xlsx',
  // Audio
  'mp3', 'wav',
  // Archives
  'zip', 'rar',
  // Web / code
  'html', 'htm', 'css', 'js', 'mjs', 'cjs',
  'ts', 'tsx', 'jsx',
  'json', 'jsonc', 'xml',
  'md', 'mdx', 'yaml', 'yml',
  'py', 'php', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'fish',
  'sql', 'graphql', 'gql',
  'toml', 'ini', 'env',
  'vue', 'svelte',
  'csv',
];

export const BLOCKED_EXTENSIONS = ['exe', 'bat', 'scr', 'apk', 'msi', 'cmd'];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const ext = getFileExtension(file.name);

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported or unsafe file type.' };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported or unsafe file type.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'This file exceeds the upload limit.' };
  }
  return { valid: true };
}

const CODE_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs',
  'ts', 'tsx', 'jsx',
  'json', 'jsonc', 'xml',
  'md', 'mdx', 'yaml', 'yml',
  'py', 'php', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'fish',
  'sql', 'graphql', 'gql',
  'toml', 'ini', 'env',
  'vue', 'svelte', 'csv',
]);

export function getFileCategory(mimeType: string, ext: string): FileCategory {
  // Extension takes priority — browsers often send text/plain for code files
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (/^image\//i.test(mimeType)) return 'images';
  if (/^video\//i.test(mimeType)) return 'videos';
  if (/^audio\//i.test(mimeType)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archives';
  return 'documents';
}

/** MIME type to use when uploading code files */
export function getCodeMime(ext: string): string {
  const map: Record<string, string> = {
    html: 'text/html', htm: 'text/html',
    css: 'text/css',
    js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
    ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/javascript',
    json: 'application/json', jsonc: 'application/json',
    xml: 'application/xml',
    md: 'text/markdown', mdx: 'text/markdown',
    yaml: 'text/yaml', yml: 'text/yaml',
    py: 'text/x-python', php: 'text/x-php', rb: 'text/x-ruby',
    go: 'text/x-go', rs: 'text/x-rust', java: 'text/x-java',
    kt: 'text/x-kotlin', c: 'text/x-c', cpp: 'text/x-c++',
    h: 'text/x-c', hpp: 'text/x-c++', cs: 'text/x-csharp',
    sh: 'text/x-sh', bash: 'text/x-sh', zsh: 'text/x-sh', fish: 'text/x-sh',
    sql: 'text/x-sql', graphql: 'text/x-graphql', gql: 'text/x-graphql',
    toml: 'text/x-toml', ini: 'text/x-ini',
    vue: 'text/x-vue', svelte: 'text/x-svelte', csv: 'text/csv',
  };
  return map[ext] || 'text/plain';
}

/** Returns true if the file can be run/rendered directly in a browser tab */
export function isRunnable(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['html', 'htm', 'svg'].includes(ext);
}

/** Returns true for all code/text files that can be edited */
export function isCodeFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return CODE_EXTENSIONS.has(ext) || ext === 'txt';
}

// ── Upload ─────────────────────────────────────────────────────────────────
export async function uploadFile(
  userId: string,
  file: File,
  folderId: string | null,
  onProgress?: (pct: number) => void,
): Promise<CloudFile> {
  const ext = getFileExtension(file.name);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${userId}/${uniqueName}`;

  // Determine safe upload content type — archives always use octet-stream
  const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2']);
  const uploadContentType = ARCHIVE_EXTS.has(ext)
    ? 'application/octet-stream'
    : (file.type || 'application/octet-stream');

  // Upload to storage
  const { error: storageError } = await supabase.storage
    .from('user-files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: uploadContentType,
    });

  if (storageError) throw new Error(storageError.message);
  onProgress?.(80);

  const fileType = getFileCategory(file.type, ext);

  const { data: record, error: dbError } = await supabase
    .from('files')
    .insert({
      user_id: userId,
      folder_id: folderId,
      name: file.name,
      original_name: file.name,
      file_type: fileType,
      mime_type: file.type || `application/${ext}`,
      file_size: file.size,
      storage_path: storagePath,
      public_url: null,
      is_trashed: false,
    })
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);
  onProgress?.(100);

  // Update user's storage usage
  await updateStorageUsed(userId, file.size);

  return record as CloudFile;
}

// ── List files ─────────────────────────────────────────────────────────────
export async function listFiles(
  userId: string,
  folderId?: string | null,
  category?: FileCategory,
  search?: string,
): Promise<CloudFile[]> {
  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('is_trashed', false)
    .order('created_at', { ascending: false });

  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', folderId);
    }
  }

  if (category && category !== 'all') {
    query = query.eq('file_type', category);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data } = await query.limit(200);
  return Array.isArray(data) ? (data as CloudFile[]) : [];
}

// ── Save edited file content ────────────────────────────────────────────────
export async function saveFileContent(
  file: CloudFile,
  userId: string,
  newContent: string,
): Promise<void> {
  // Always upload as text/plain — bucket whitelist accepts it for all code/text files
  const blob = new Blob([newContent], { type: 'text/plain' });

  const { error } = await supabase.storage
    .from('user-files')
    .update(file.storage_path, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'text/plain',
    });

  if (error) throw new Error(error.message);

  await supabase
    .from('files')
    .update({ file_size: blob.size, updated_at: new Date().toISOString() })
    .eq('id', file.id)
    .eq('user_id', userId);
}


export async function createTextFile(
  userId: string,
  fileName: string,
  content: string,
  folderId: string | null,
  ext: string = 'txt',
): Promise<CloudFile> {
  // Strip any existing extension from fileName then append chosen ext
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const name = `${baseName}.${ext}`;
  const mime = getCodeMime(ext);
  const fileType = getFileCategory(mime, ext);

  // Always upload as text/plain — bucket whitelist accepts it for all code files
  const blob = new Blob([content], { type: 'text/plain' });

  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${userId}/${uniqueName}`;

  const { error: storageError } = await supabase.storage
    .from('user-files')
    .upload(storagePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'text/plain',
    });

  if (storageError) throw new Error(storageError.message);

  const { data: record, error: dbError } = await supabase
    .from('files')
    .insert({
      user_id: userId,
      folder_id: folderId,
      name,
      original_name: name,
      file_type: fileType,
      mime_type: mime,     // store real MIME in DB for display/category
      file_size: blob.size,
      storage_path: storagePath,
      public_url: null,
      is_trashed: false,
    })
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);
  await updateStorageUsed(userId, blob.size);
  return record as CloudFile;
}

// ── Global search (across all folders) ────────────────────────────────────
export async function searchAllFiles(
  userId: string,
  search: string,
): Promise<CloudFile[]> {
  if (!search.trim()) return [];
  const { data } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('is_trashed', false)
    .ilike('name', `%${search.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(100);
  return Array.isArray(data) ? (data as CloudFile[]) : [];
}


export async function trashFile(fileId: string, userId: string): Promise<void> {
  await supabase
    .from('files')
    .update({ is_trashed: true, trashed_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('user_id', userId);
}

export async function restoreFile(fileId: string, userId: string): Promise<void> {
  await supabase
    .from('files')
    .update({ is_trashed: false, trashed_at: null })
    .eq('id', fileId)
    .eq('user_id', userId);
}

export async function permanentlyDeleteFile(fileId: string, userId: string): Promise<void> {
  const { data: file } = await supabase
    .from('files')
    .select('storage_path, file_size')
    .eq('id', fileId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!file) return;

  await supabase.storage.from('user-files').remove([file.storage_path]);
  await supabase.from('files').delete().eq('id', fileId).eq('user_id', userId);
  await updateStorageUsed(userId, -file.file_size);
}

export async function listTrashedFiles(userId: string): Promise<CloudFile[]> {
  const { data } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('is_trashed', true)
    .order('trashed_at', { ascending: false });
  return Array.isArray(data) ? (data as CloudFile[]) : [];
}

// ── Rename ────────────────────────────────────────────────────────────────
export async function renameFile(fileId: string, userId: string, newName: string): Promise<void> {
  await supabase
    .from('files')
    .update({ name: newName })
    .eq('id', fileId)
    .eq('user_id', userId);
}

// ── Download ──────────────────────────────────────────────────────────────
export async function downloadFile(file: CloudFile): Promise<void> {
  const { data, error } = await supabase.storage
    .from('user-files')
    .download(file.storage_path);
  if (error || !data) throw new Error('Download failed');

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.original_name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Download multiple files as a ZIP ──────────────────────────────────────
export async function downloadFilesAsZip(
  files: CloudFile[],
  zipName = 'website-source.zip',
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Deduplicate filenames inside the zip
  const usedNames = new Set<string>();
  const uniqueName = (name: string): string => {
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
    const dot = name.lastIndexOf('.');
    const base = dot !== -1 ? name.slice(0, dot) : name;
    const ext = dot !== -1 ? name.slice(dot) : '';
    let i = 2;
    while (usedNames.has(`${base}(${i})${ext}`)) i++;
    const final = `${base}(${i})${ext}`;
    usedNames.add(final);
    return final;
  };

  let done = 0;
  await Promise.all(
    files.map(async file => {
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(file.storage_path);
      if (!error && data) {
        zip.file(uniqueName(file.original_name || file.name), data);
      }
      onProgress?.(++done, files.length);
    }),
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Get signed URL for preview ────────────────────────────────────────────
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('user-files')
    .createSignedUrl(storagePath, 3600);
  if (error || !data) throw new Error('Could not get file URL');
  return data.signedUrl;
}

// ── Folders ───────────────────────────────────────────────────────────────
export async function listFolders(userId: string, parentId?: string | null): Promise<CloudFolder[]> {
  let query = supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (parentId !== undefined) {
    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }
  }

  const { data } = await query;
  return Array.isArray(data) ? (data as CloudFolder[]) : [];
}

export async function createFolder(userId: string, name: string, parentId: string | null = null): Promise<CloudFolder> {
  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: userId, name, parent_id: parentId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CloudFolder;
}

export async function deleteFolder(folderId: string, userId: string): Promise<void> {
  await supabase.from('folders').delete().eq('id', folderId).eq('user_id', userId);
}

export async function renameFolder(folderId: string, userId: string, newName: string): Promise<void> {
  await supabase.from('folders').update({ name: newName }).eq('id', folderId).eq('user_id', userId);
}

// ── Get full folder tree ──────────────────────────────────────────────────
export async function listAllFolders(userId: string): Promise<CloudFolder[]> {
  const { data } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  return Array.isArray(data) ? (data as CloudFolder[]) : [];
}

// ── Share links ────────────────────────────────────────────────────────────
import type { ShareLink } from '@/types/types';

export async function createShareLink(
  fileId: string,
  userId: string,
  expiresAt: string | null,
): Promise<ShareLink> {
  const { data, error } = await supabase
    .from('share_links')
    .insert({ file_id: fileId, user_id: userId, expires_at: expiresAt })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShareLink;
}

export async function listShareLinks(userId: string, fileId?: string): Promise<ShareLink[]> {
  let query = supabase
    .from('share_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (fileId) query = query.eq('file_id', fileId);
  const { data } = await query;
  return Array.isArray(data) ? (data as ShareLink[]) : [];
}

export async function deleteShareLink(id: string, userId: string): Promise<void> {
  await supabase.from('share_links').delete().eq('id', id).eq('user_id', userId);
}

export async function getShareLinkFile(token: string): Promise<{ file: CloudFile; signedUrl: string } | null> {
  const { data: link } = await supabase
    .from('share_links')
    .select('*, files!share_links_file_id_fkey(*)')
    .eq('token', token)
    .maybeSingle();
  if (!link) return null;
  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;
  const file = (link as unknown as { files: CloudFile }).files;
  if (!file) return null;
  const signedUrl = await getSignedUrl(file.storage_path);
  return { file, signedUrl };
}
