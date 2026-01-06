import { config } from '../config';
import logger from '../utils/logger';

export interface BrainNote {
  id: string;
  content: string;
  project?: string;
  source?: string;
  created_at: string;
}

export interface BrainTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  project?: string;
}

async function brainFetch<T>(
  path: string,
  options: globalThis.RequestInit = {}
): Promise<T> {
  const url = config.brainApi.url;
  const apiKey = config.brainApi.apiKey;

  if (!url) {
    throw new Error('Brain API URL not configured');
  }

  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Brain API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function searchBrain(query: string): Promise<BrainNote[]> {
  try {
    const data = await brainFetch<{ results: BrainNote[] }>(
      `/api/v1/search?q=${encodeURIComponent(query)}`
    );
    return data.results || [];
  } catch (error) {
    logger.warn('Brain search failed', { query, error });
    return [];
  }
}

export async function getRecentNotes(limit: number = 10): Promise<BrainNote[]> {
  try {
    const data = await brainFetch<{ notes: BrainNote[] }>(
      `/api/v1/notes?limit=${limit}`
    );
    return data.notes || [];
  } catch (error) {
    logger.warn('Brain get recent notes failed', { limit, error });
    return [];
  }
}

export async function getActiveTasks(): Promise<BrainTask[]> {
  try {
    const data = await brainFetch<{ tasks: BrainTask[] }>(
      `/api/v1/tasks?status=active`
    );
    return data.tasks || [];
  } catch (error) {
    logger.warn('Brain get active tasks failed', { error });
    return [];
  }
}

export async function addNote(
  content: string,
  project?: string
): Promise<BrainNote | null> {
  try {
    return await brainFetch<BrainNote>('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify({ content, project, source: 'discord-chat' }),
    });
  } catch (error) {
    logger.error('Brain add note failed', { project, error });
    return null;
  }
}

export async function createTask(
  title: string,
  description: string,
  project: string
): Promise<BrainTask | null> {
  try {
    return await brainFetch<BrainTask>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description, project }),
    });
  } catch (error) {
    logger.error('Brain create task failed', { title, project, error });
    return null;
  }
}
