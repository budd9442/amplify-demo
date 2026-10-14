/**
 * @monorepo/shared
 * Common domain models, constants, and validation utilities
 * shared seamlessly between @monorepo/api and @monorepo/web.
 */

// Item status definitions
export const ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

// Item categories
export const ITEM_CATEGORIES = ['Engineering', 'Design', 'DevOps', 'Product', 'Docs'];

// Priority levels
export const ITEM_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// API Endpoint routes contract
export const API_ROUTES = {
  HEALTH: '/api/health',
  STATS: '/api/stats',
  ITEMS: '/api/items',
};

// Monorepo metadata
export const MONOREPO_INFO = {
  name: 'simple-monorepo',
  architecture: 'npm workspaces',
  packages: [
    { name: '@monorepo/web', type: 'app', role: 'Frontend UI (Vite + Vanilla JS/CSS)', port: 3000 },
    { name: '@monorepo/api', type: 'app', role: 'REST API Backend (Express ESM)', port: 4000 },
    { name: '@monorepo/shared', type: 'package', role: 'Shared models, validation & utilities' },
  ],
};

/**
 * Validates an incoming item payload
 * @param {object} payload 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateItemPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object'] };
  }

  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    errors.push('Title is required and cannot be empty');
  } else if (payload.title.trim().length > 120) {
    errors.push('Title must be 120 characters or fewer');
  }

  if (payload.category && !ITEM_CATEGORIES.includes(payload.category)) {
    errors.push(`Category must be one of: ${ITEM_CATEGORIES.join(', ')}`);
  }

  if (payload.priority && !ITEM_PRIORITIES.includes(payload.priority)) {
    errors.push(`Priority must be one of: ${ITEM_PRIORITIES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format relative or readable timestamp
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function formatTimestamp(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Generates badge color configuration for statuses
 * @param {string} status
 */
export function getStatusBadgeConfig(status) {
  switch (status) {
    case ITEM_STATUS.COMPLETED:
      return { label: 'Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    case ITEM_STATUS.IN_PROGRESS:
      return { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
    case ITEM_STATUS.PENDING:
    default:
      return { label: 'Pending', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
  }
}
