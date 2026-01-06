import { GuildMember, PermissionFlagsBits } from 'discord.js';

/**
 * User cooldown tracking for rate limiting
 */
const userCooldowns = new Map<string, Map<string, number>>();

/**
 * Check if a user is on cooldown for a specific action
 * @param userId - Discord user ID
 * @param action - Action identifier (e.g., 'start', 'approve')
 * @param cooldownMs - Cooldown duration in milliseconds
 * @returns true if user can proceed, false if on cooldown
 */
export function checkUserCooldown(
  userId: string,
  action: string,
  cooldownMs: number
): { allowed: boolean; remainingMs: number } {
  const now = Date.now();

  if (!userCooldowns.has(userId)) {
    userCooldowns.set(userId, new Map());
  }

  const userActions = userCooldowns.get(userId)!;
  const lastAction = userActions.get(action) || 0;
  const elapsed = now - lastAction;

  if (elapsed < cooldownMs) {
    return {
      allowed: false,
      remainingMs: cooldownMs - elapsed
    };
  }

  userActions.set(action, now);
  return { allowed: true, remainingMs: 0 };
}

/**
 * Clear cooldown for a user/action (e.g., after admin override)
 */
export function clearUserCooldown(userId: string, action?: string): void {
  if (action) {
    userCooldowns.get(userId)?.delete(action);
  } else {
    userCooldowns.delete(userId);
  }
}

/**
 * Cooldown durations for different actions (in ms)
 */
export const COOLDOWNS = {
  start: 30000,      // 30 seconds between start commands
  stop: 10000,       // 10 seconds between stop commands
  approve: 5000,     // 5 seconds between approvals
  reject: 5000,      // 5 seconds between rejections
  brain: 5000,       // 5 seconds between brain commands
  chat: 3000,        // 3 seconds between chat messages
} as const;

/**
 * Check if a member has administrator permissions
 */
export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Check if a member has a specific role by name or ID
 */
export function hasRole(member: GuildMember | null, roleIdentifier: string): boolean {
  if (!member) return false;
  return member.roles.cache.some(
    role => role.id === roleIdentifier || role.name.toLowerCase() === roleIdentifier.toLowerCase()
  );
}

/**
 * Commands that require admin permissions
 */
export const ADMIN_COMMANDS = ['start', 'stop', 'approve', 'reject'] as const;

/**
 * Check if a command requires admin permissions
 */
export function requiresAdmin(command: string): boolean {
  return ADMIN_COMMANDS.includes(command as typeof ADMIN_COMMANDS[number]);
}

/**
 * Sanitize user input to prevent injection attacks
 * Removes or escapes potentially dangerous content
 */
export function sanitizeInput(input: string, maxLength: number = 2000): string {
  if (!input) return '';

  // Truncate to max length
  let sanitized = input.slice(0, maxLength);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Format cooldown remaining time for display
 */
export function formatCooldownMessage(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000);
  return `Please wait ${seconds} second${seconds !== 1 ? 's' : ''} before using this command again.`;
}
