import express from 'express';
import cors from 'cors';
import { 
  ITEM_STATUS, 
  ITEM_CATEGORIES, 
  ITEM_PRIORITIES, 
  validateItemPayload, 
  MONOREPO_INFO 
} from '@monorepo/shared';

const app = express();
const PORT = process.env.PORT || 3000;
const startTime = Date.now();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store with realistic starter items
let items = [
  {
    id: 'item-1',
    title: 'Initialize monorepo workspace configuration',
    category: 'Engineering',
    priority: 'high',
    status: ITEM_STATUS.COMPLETED,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'item-2',
    title: 'Connect shared model validation across Web & API',
    category: 'Engineering',
    priority: 'urgent',
    status: ITEM_STATUS.IN_PROGRESS,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    completedAt: null,
  },
  {
    id: 'item-3',
    title: 'Design responsive dark-mode dashboard interface',
    category: 'Design',
    priority: 'medium',
    status: ITEM_STATUS.IN_PROGRESS,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    completedAt: null,
  },
  {
    id: 'item-4',
    title: 'Setup unified build & development pipeline',
    category: 'DevOps',
    priority: 'low',
    status: ITEM_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    completedAt: null,
  },
];

// Initial seed copy for easy reset
const initialSeed = JSON.parse(JSON.stringify(items));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: 'ok',
    service: '@monorepo/api',
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    packagesCount: MONOREPO_INFO.packages.length,
  });
});

// Stats summary endpoint
app.get('/api/stats', (req, res) => {
  const total = items.length;
  const completed = items.filter((i) => i.status === ITEM_STATUS.COMPLETED).length;
  const inProgress = items.filter((i) => i.status === ITEM_STATUS.IN_PROGRESS).length;
  const pending = items.filter((i) => i.status === ITEM_STATUS.PENDING).length;

  const categoryBreakdown = ITEM_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat).length;
    return acc;
  }, {});

  res.json({
    total,
    completed,
    inProgress,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    categoryBreakdown,
  });
});

// List items with optional query filter
app.get('/api/items', (req, res) => {
  const { status, category } = req.query;
  let filtered = [...items];

  if (status && Object.values(ITEM_STATUS).includes(status)) {
    filtered = filtered.filter((i) => i.status === status);
  }

  if (category) {
    filtered = filtered.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }

  res.json({
    count: filtered.length,
    items: filtered,
  });
});

// Create new item
app.post('/api/items', (req, res) => {
  const validation = validateItemPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Validation failed', details: validation.errors });
  }

  const { title, category = 'Engineering', priority = 'medium' } = req.body;
  const newItem = {
    id: `item-${Date.now()}`,
    title: title.trim(),
    category,
    priority,
    status: ITEM_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  items.unshift(newItem);
  res.status(201).json(newItem);
});

// Update item (e.g. toggle status or title)
app.patch('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const itemIndex = items.findIndex((i) => i.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: `Item with id ${id} not found` });
  }

  const { status, title, priority, category } = req.body;
  const existing = items[itemIndex];

  if (status && Object.values(ITEM_STATUS).includes(status)) {
    existing.status = status;
    existing.completedAt = status === ITEM_STATUS.COMPLETED ? new Date().toISOString() : null;
  }
  if (title && typeof title === 'string') existing.title = title.trim();
  if (priority && ITEM_PRIORITIES.includes(priority)) existing.priority = priority;
  if (category && ITEM_CATEGORIES.includes(category)) existing.category = category;

  res.json(existing);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = items.length;
  items = items.filter((i) => i.id !== id);

  if (items.length === initialLength) {
    return res.status(404).json({ error: `Item with id ${id} not found` });
  }

  res.json({ success: true, deletedId: id });
});

// Reset items to initial sample data
app.post('/api/items/reset', (req, res) => {
  items = JSON.parse(JSON.stringify(initialSeed));
  res.json({ message: 'Dataset reset successfully', items });
});

app.listen(PORT, () => {
  console.log(`🚀 [@monorepo/api] Server ready at http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});
