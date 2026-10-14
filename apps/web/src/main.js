import { 
  ITEM_STATUS, 
  ITEM_CATEGORIES, 
  MONOREPO_INFO, 
  validateItemPayload, 
  formatTimestamp,
  getStatusBadgeConfig 
} from '@monorepo/shared';

// State
let currentFilter = 'all';
let currentItems = [];
let isConnected = false;

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const statusLatency = document.getElementById('status-latency');
const serverStatusPill = document.getElementById('server-status-pill');

const metricTotal = document.getElementById('metric-total');
const metricInProgress = document.getElementById('metric-inprogress');
const metricCompleted = document.getElementById('metric-completed');
const metricRate = document.getElementById('metric-rate');
const metricUptime = document.getElementById('metric-uptime');
const metricNodeVersion = document.getElementById('metric-node-version');

const workspaceChipsContainer = document.getElementById('workspace-chips');
const itemsGrid = document.getElementById('items-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const taskCountPill = document.getElementById('task-count-pill');

// Filter Buttons
const filterBtns = document.querySelectorAll('.filter-btn');

// Modals & Controls
const addModal = document.getElementById('add-modal');
const archModal = document.getElementById('arch-modal');
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const closeAddModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const openArchBtn = document.getElementById('architecture-btn');
const closeArchBtn = document.getElementById('close-arch-btn');
const resetDataBtn = document.getElementById('reset-data-btn');

const createForm = document.getElementById('create-item-form');
const formErrors = document.getElementById('form-errors');
const categorySelect = document.getElementById('task-category-select');

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIconDark = document.getElementById('theme-icon-dark');
const themeIconLight = document.getElementById('theme-icon-light');

// Initialize UI
function init() {
  populateWorkspaceChips();
  populateCategories();
  setupEventListeners();
  checkApiHealth();
  fetchStats();
  fetchItems();

  // Polling for live status
  setInterval(checkApiHealth, 5000);
}

// Populate Packages list from @monorepo/shared
function populateWorkspaceChips() {
  workspaceChipsContainer.innerHTML = MONOREPO_INFO.packages
    .map(
      (pkg) => `
    <div class="chip-item">
      <div>
        <span class="chip-name">${pkg.name}</span>
        <div class="chip-role">${pkg.role}</div>
      </div>
      <span class="badge ${pkg.type === 'app' ? 'priority-badge medium' : 'priority-badge low'}">${pkg.type}</span>
    </div>
  `
    )
    .join('');
}

// Populate Category dropdown from @monorepo/shared
function populateCategories() {
  categorySelect.innerHTML = ITEM_CATEGORIES.map(
    (cat) => `<option value="${cat}">${cat}</option>`
  ).join('');
}

// API Health Check
async function checkApiHealth() {
  const startPing = performance.now();
  try {
    const res = await fetch('/api/health');
    const latency = Math.round(performance.now() - startPing);

    if (res.ok) {
      const data = await res.json();
      isConnected = true;
      statusDot.className = 'status-dot online ping-animation';
      statusLabel.textContent = `${data.service} online`;
      statusLatency.textContent = `${latency}ms`;
      serverStatusPill.title = `Uptime: ${data.uptime} • Node: ${data.nodeVersion}`;
      metricUptime.textContent = data.uptime;
      metricNodeVersion.textContent = `Node.js ${data.nodeVersion}`;
    } else {
      throw new Error('Non-200 response');
    }
  } catch (err) {
    isConnected = false;
    statusDot.className = 'status-dot offline';
    statusLabel.textContent = 'API Offline';
    statusLatency.textContent = 'unreachable';
    metricUptime.textContent = '--';
  }
}

// Fetch Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    metricTotal.textContent = stats.total;
    metricInProgress.textContent = stats.inProgress;
    metricCompleted.textContent = stats.completed;
    metricRate.textContent = `${stats.completionRate}% completion rate`;
  } catch (err) {
    console.warn('Could not fetch stats', err);
  }
}

// Fetch Items with filtering
async function fetchItems() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  itemsGrid.innerHTML = '';

  try {
    const query = currentFilter === 'all' ? '' : `?status=${encodeURIComponent(currentFilter)}`;
    const res = await fetch(`/api/items${query}`);
    if (!res.ok) throw new Error('Failed to fetch items');
    const data = await res.json();
    currentItems = data.items;
    renderItems(currentItems);
  } catch (err) {
    console.error('Failed to load items', err);
    itemsGrid.innerHTML = `<p style="color: var(--accent-rose); padding: 20px;">Could not connect to API server. Ensure <code>npm run dev</code> is running.</p>`;
  } finally {
    loadingState.classList.add('hidden');
  }
}

// Render items in list
function renderItems(items) {
  taskCountPill.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  if (items.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  itemsGrid.innerHTML = items
    .map((item) => {
      const isDone = item.status === ITEM_STATUS.COMPLETED;
      const badgeConfig = getStatusBadgeConfig(item.status);

      return `
      <div class="item-row ${isDone ? 'completed-item' : ''}" data-id="${item.id}">
        <div class="item-left">
          <button 
            class="status-checkbox ${isDone ? 'checked' : ''}" 
            data-action="toggle" 
            data-id="${item.id}"
            title="Toggle Status"
            aria-label="Toggle completion for ${item.title}"
          >
            ${isDone ? '✓' : ''}
          </button>
          
          <div class="item-details">
            <span class="item-title">${escapeHtml(item.title)}</span>
            <div class="item-meta">
              <span class="category-tag">${escapeHtml(item.category)}</span>
              <span class="badge priority-badge ${item.priority}">${item.priority}</span>
              <span style="color: ${badgeConfig.color}; font-weight: 600;">${badgeConfig.label}</span>
              <span>Added ${formatTimestamp(item.createdAt)}</span>
            </div>
          </div>
        </div>

        <div class="item-actions">
          <button 
            class="action-icon-btn delete-btn" 
            data-action="delete" 
            data-id="${item.id}" 
            title="Delete task"
            aria-label="Delete task ${item.title}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

// Toggle item completion
async function toggleItem(id) {
  const item = currentItems.find((i) => i.id === id);
  if (!item) return;

  const nextStatus = item.status === ITEM_STATUS.COMPLETED ? ITEM_STATUS.PENDING : ITEM_STATUS.COMPLETED;

  try {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (res.ok) {
      await fetchItems();
      await fetchStats();
    }
  } catch (err) {
    console.error('Failed to toggle status', err);
  }
}

// Delete item
async function deleteItem(id) {
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchItems();
      await fetchStats();
    }
  } catch (err) {
    console.error('Failed to delete item', err);
  }
}

// Reset dataset
async function resetDataset() {
  try {
    const res = await fetch('/api/items/reset', { method: 'POST' });
    if (res.ok) {
      await fetchItems();
      await fetchStats();
    }
  } catch (err) {
    console.error('Failed to reset dataset', err);
  }
}

// Handle Form Submission with @monorepo/shared validation
async function handleCreateItem(e) {
  e.preventDefault();
  formErrors.classList.add('hidden');
  formErrors.innerHTML = '';

  const formData = new FormData(createForm);
  const payload = {
    title: formData.get('title'),
    category: formData.get('category'),
    priority: formData.get('priority'),
  };

  // Validate using shared package logic before sending to server!
  const validation = validateItemPayload(payload);
  if (!validation.valid) {
    formErrors.innerHTML = validation.errors.map((err) => `<div>• ${escapeHtml(err)}</div>`).join('');
    formErrors.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      createForm.reset();
      addModal.classList.add('hidden');
      await fetchItems();
      await fetchStats();
    } else {
      const errorData = await res.json();
      formErrors.innerHTML = (errorData.details || [errorData.error || 'Failed to create item'])
        .map((e) => `<div>• ${escapeHtml(e)}</div>`)
        .join('');
      formErrors.classList.remove('hidden');
    }
  } catch (err) {
    formErrors.textContent = 'Network error contacting backend';
    formErrors.classList.remove('hidden');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Filter switching
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      fetchItems();
    });
  });

  // Action clicks inside items list (delegated)
  itemsGrid.addEventListener('click', (e) => {
    const toggleTarget = e.target.closest('[data-action="toggle"]');
    if (toggleTarget) {
      const id = toggleTarget.dataset.id;
      toggleItem(id);
      return;
    }

    const deleteTarget = e.target.closest('[data-action="delete"]');
    if (deleteTarget) {
      const id = deleteTarget.dataset.id;
      deleteItem(id);
      return;
    }
  });

  // Modals
  openAddModalBtn.addEventListener('click', () => {
    addModal.classList.remove('hidden');
    document.getElementById('task-title-input').focus();
  });
  closeAddModalBtn.addEventListener('click', () => addModal.classList.add('hidden'));
  cancelModalBtn.addEventListener('click', () => addModal.classList.add('hidden'));

  openArchBtn.addEventListener('click', () => archModal.classList.remove('hidden'));
  closeArchBtn.addEventListener('click', () => archModal.classList.add('hidden'));

  // Close modals on outside backdrop click
  [addModal, archModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Create form
  createForm.addEventListener('submit', handleCreateItem);

  // Reset button
  resetDataBtn.addEventListener('click', resetDataset);

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Theme handling
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  document.body.classList.toggle('dark-theme', !isLight);
  themeIconDark.classList.toggle('hidden', isLight);
  themeIconLight.classList.toggle('hidden', !isLight);
  localStorage.setItem('monorepo-theme', isLight ? 'light' : 'dark');
}

// Check saved theme
const savedTheme = localStorage.getItem('monorepo-theme');
if (savedTheme === 'light') {
  document.body.classList.remove('dark-theme');
  document.body.classList.add('light-theme');
  themeIconDark.classList.add('hidden');
  themeIconLight.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Boot
init();
