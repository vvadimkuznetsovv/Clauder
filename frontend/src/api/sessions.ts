import api from './client';

export interface ChatSession {
  id: string;
  title: string;
  claude_session_id: string;
  working_directory: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_use?: unknown;
  tokens_used: number;
  created_at: string;
}

export const getSessions = () =>
  api.get<ChatSession[]>('/sessions');

export const createSession = (title?: string, workingDirectory?: string) =>
  api.post<ChatSession>('/sessions', { title, working_directory: workingDirectory });

export const deleteSession = (id: string) =>
  api.delete(`/sessions/${id}`);

export const updateSession = (id: string, data: { title?: string; working_directory?: string }) =>
  api.put<ChatSession>(`/sessions/${id}`, data);

export const getMessages = (sessionId: string) =>
  api.get<Message[]>(`/sessions/${sessionId}/messages`);
