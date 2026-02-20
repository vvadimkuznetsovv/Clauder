import api from './client';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mod_time: string;
}

export interface FileListResponse {
  path: string;
  files: FileEntry[];
}

export interface FileReadResponse {
  path: string;
  content: string;
  size: number;
}

export const listFiles = (path?: string) =>
  api.get<FileListResponse>('/files', { params: { path } });

export const readFile = (path: string) =>
  api.get<FileReadResponse>('/files/read', { params: { path } });

export const writeFile = (path: string, content: string) =>
  api.put('/files/write', { path, content });

export const deleteFile = (path: string) =>
  api.delete('/files', { params: { path } });
