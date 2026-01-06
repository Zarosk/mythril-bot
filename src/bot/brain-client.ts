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

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  usagePercent: number;
  isNearLimit: boolean; // >= 80% used
  isAtLimit: boolean;
  resetIn?: number; // seconds until reset (only when at limit)
}

export interface BrainResponse<T> {
  data: T;
  rateLimit: RateLimitInfo | null;
}

export class RateLimitError extends Error {
  public rateLimit: RateLimitInfo;

  constructor(message: string, rateLimit: RateLimitInfo) {
    super(message);
    this.name = 'RateLimitError';
    this.rateLimit = rateLimit;
  }
}

// eslint-disable-next-line no-undef
function parseRateLimitHeaders(response: Response): RateLimitInfo | null {
  const limit = response.headers.get('x-ratelimit-limit');
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');

  if (!limit || remaining === null) {
    return null;
  }

  const limitNum = parseInt(limit, 10);
  const remainingNum = parseInt(remaining, 10);
  const resetNum = reset ? parseInt(reset, 10) : 0;
  const used = limitNum - remainingNum;
  const usagePercent = Math.round((used / limitNum) * 100);

  return {
    limit: limitNum,
    remaining: remainingNum,
    reset: resetNum,
    usagePercent,
    isNearLimit: usagePercent >= 80,
    isAtLimit: remainingNum === 0,
  };
}

async function brainFetch<T>(
  path: string,
  options: globalThis.RequestInit = {}
): Promise<BrainResponse<T>> {
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

  const rateLimit = parseRateLimitHeaders(response);

  // Log when approaching limit
  if (rateLimit?.isNearLimit && !rateLimit.isAtLimit) {
    logger.warn('Brain API rate limit approaching', {
      used: rateLimit.limit - rateLimit.remaining,
      limit: rateLimit.limit,
      usagePercent: rateLimit.usagePercent,
    });
  }

  if (response.status === 429) {
    // Parse rate limit error response
    const errorBody = await response.json().catch(() => ({})) as {
      resetIn?: number;
      resetAt?: string;
    };

    const resetIn = errorBody.resetIn ?? (rateLimit?.reset ? Math.ceil((rateLimit.reset * 1000 - Date.now()) / 1000) : 60);

    const limitInfo: RateLimitInfo = {
      limit: rateLimit?.limit ?? 100,
      remaining: 0,
      reset: rateLimit?.reset ?? Math.floor(Date.now() / 1000) + resetIn,
      usagePercent: 100,
      isNearLimit: true,
      isAtLimit: true,
      resetIn,
    };

    logger.warn('Brain API rate limit exceeded', {
      limit: limitInfo.limit,
      resetIn: limitInfo.resetIn,
    });

    throw new RateLimitError('Rate limit exceeded', limitInfo);
  }

  if (!response.ok) {
    throw new Error(`Brain API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as T;
  return { data, rateLimit };
}

// Simple fetch for operations that don't need rate limit info returned
async function brainFetchSimple<T>(
  path: string,
  options: globalThis.RequestInit = {}
): Promise<T | null> {
  try {
    const result = await brainFetch<T>(path, options);
    return result.data;
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error; // Re-throw rate limit errors
    }
    throw error;
  }
}

export async function searchBrain(query: string): Promise<BrainNote[]> {
  try {
    const data = await brainFetchSimple<{ results: BrainNote[] }>(
      `/api/v1/search?q=${encodeURIComponent(query)}`
    );
    return data?.results || [];
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.warn('Brain search failed', { query, error });
    return [];
  }
}

export async function getRecentNotes(limit: number = 10): Promise<BrainNote[]> {
  try {
    const data = await brainFetchSimple<{ notes: BrainNote[] }>(
      `/api/v1/notes?limit=${limit}`
    );
    return data?.notes || [];
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.warn('Brain get recent notes failed', { limit, error });
    return [];
  }
}

export async function getActiveTasks(): Promise<BrainTask[]> {
  try {
    const data = await brainFetchSimple<{ tasks: BrainTask[] }>(
      `/api/v1/tasks?status=active`
    );
    return data?.tasks || [];
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.warn('Brain get active tasks failed', { error });
    return [];
  }
}

export interface AddNoteResult {
  note: BrainNote | null;
  rateLimit: RateLimitInfo | null;
}

export async function addNote(
  content: string,
  project?: string
): Promise<AddNoteResult> {
  try {
    const result = await brainFetch<BrainNote>('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify({ content, project, source: 'discord-chat' }),
    });
    return { note: result.data, rateLimit: result.rateLimit };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.error('Brain add note failed', { project, error });
    return { note: null, rateLimit: null };
  }
}

export async function createTask(
  title: string,
  description: string,
  project: string
): Promise<BrainTask | null> {
  try {
    const result = await brainFetch<BrainTask>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description, project }),
    });
    return result.data;
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.error('Brain create task failed', { title, project, error });
    return null;
  }
}

// User subscription management

export interface UnsubscribeResult {
  success: boolean;
  alreadyUnsubscribed?: boolean;
  error?: string;
}

export interface ResubscribeResult {
  success: boolean;
  alreadySubscribed?: boolean;
  error?: string;
}

export interface DeleteUserDataResult {
  success: boolean;
  deleted?: {
    notes: number;
    subscriptions: number;
  };
  error?: string;
}

export async function unsubscribeUser(discordId: string): Promise<UnsubscribeResult> {
  try {
    const result = await brainFetch<{ success: boolean; alreadyUnsubscribed?: boolean }>(
      `/api/v1/users/${discordId}/unsubscribe`,
      { method: 'POST' }
    );
    return {
      success: result.data.success,
      alreadyUnsubscribed: result.data.alreadyUnsubscribed,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.error('Brain unsubscribe failed', { discordId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function resubscribeUser(discordId: string): Promise<ResubscribeResult> {
  try {
    const result = await brainFetch<{ success: boolean; alreadySubscribed?: boolean }>(
      `/api/v1/users/${discordId}/resubscribe`,
      { method: 'POST' }
    );
    return {
      success: result.data.success,
      alreadySubscribed: result.data.alreadySubscribed,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.error('Brain resubscribe failed', { discordId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteUserData(discordId: string): Promise<DeleteUserDataResult> {
  try {
    const result = await brainFetch<{
      success: boolean;
      deleted: { notes: number; subscriptions: number };
    }>(
      `/api/v1/users/${discordId}/data`,
      { method: 'DELETE' }
    );
    return {
      success: result.data.success,
      deleted: result.data.deleted,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    logger.error('Brain delete user data failed', { discordId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format a rate limit warning message for Discord
 */
export function formatRateLimitWarning(rateLimit: RateLimitInfo): string | null {
  if (rateLimit.isAtLimit) {
    return `Rate limit reached (${rateLimit.limit}/${rateLimit.limit} requests).\nResets in ${rateLimit.resetIn} seconds. Take a breather.`;
  }

  if (rateLimit.isNearLimit) {
    const used = rateLimit.limit - rateLimit.remaining;
    return `${used}/${rateLimit.limit} API calls used this minute.`;
  }

  return null;
}
