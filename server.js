const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// --- API Handlers ---

async function handleCreatePoll(req, res) {
  try {
    const body = await readBody(req);

    if (!body.title || !Array.isArray(body.dates) || body.dates.length === 0) {
      return sendJSON(res, 400, { error: 'Title and at least one date are required' });
    }

    if (!Array.isArray(body.participants) || body.participants.length === 0) {
      return sendJSON(res, 400, { error: 'At least one participant is required' });
    }

    if (!Array.isArray(body.instruments) || body.instruments.length === 0) {
      return sendJSON(res, 400, { error: 'At least one instrument is required' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of body.dates) {
      if (!dateRegex.test(d) || isNaN(new Date(d).getTime())) {
        return sendJSON(res, 400, { error: `Invalid date: ${d}` });
      }
    }

    const poll = {
      id: crypto.randomUUID(),
      title: body.title.trim(),
      description: (body.description || '').trim(),
      duration: body.duration || '',
      createdAt: new Date().toISOString(),
      dates: body.dates.sort(),
      participants: body.participants,
      instruments: body.instruments,
      responses: [],
    };

    const db = await getDb();
    await db.collection('polls').insertOne(poll);

    sendJSON(res, 201, { id: poll.id, url: `/poll/${poll.id}` });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

async function handleGetPoll(req, res, pollId) {
  try {
    const db = await getDb();
    const poll = await db.collection('polls').findOne({ id: pollId });

    if (!poll) {
      return sendJSON(res, 404, { error: 'Poll not found' });
    }

    // Remove MongoDB _id field from response
    delete poll._id;
    sendJSON(res, 200, poll);
  } catch (err) {
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

async function handleRespond(req, res, pollId) {
  try {
    const db = await getDb();
    const poll = await db.collection('polls').findOne({ id: pollId });

    if (!poll) {
      return sendJSON(res, 404, { error: 'Poll not found' });
    }

    const body = await readBody(req);

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return sendJSON(res, 400, { error: 'Name is required' });
    }
    if (!body.answers || typeof body.answers !== 'object') {
      return sendJSON(res, 400, { error: 'Answers are required' });
    }

    const validValues = ['yes', 'ifneeded', 'no'];
    for (const date of poll.dates) {
      if (!body.answers[date] || !validValues.includes(body.answers[date])) {
        return sendJSON(res, 400, { error: `Invalid or missing answer for date ${date}` });
      }
    }

    const response = {
      name: body.name.trim(),
      submittedAt: new Date().toISOString(),
      answers: body.answers,
      instruments: body.instruments || {},
      upfrontInstruments: body.upfrontInstruments || [],
    };

    // Replace existing response with same name, or append
    const existingIndex = poll.responses.findIndex(
      r => r.name.toLowerCase() === response.name.toLowerCase()
    );
    if (existingIndex >= 0) {
      poll.responses[existingIndex] = response;
    } else {
      poll.responses.push(response);
    }

    // Update poll in database
    await db.collection('polls').updateOne(
      { id: pollId },
      { $set: { responses: poll.responses } }
    );

    // Remove MongoDB _id field from response
    delete poll._id;
    sendJSON(res, 200, { success: true, poll });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API routes
  if (req.method === 'POST' && pathname === '/api/polls') {
    return handleCreatePoll(req, res);
  }

  const getPollMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && getPollMatch) {
    return handleGetPoll(req, res, getPollMatch[1]);
  }

  const respondMatch = pathname.match(/^\/api\/polls\/([a-f0-9-]+)\/respond$/);
  if (req.method === 'POST' && respondMatch) {
    return handleRespond(req, res, respondMatch[1]);
  }

  // Page routes
  if (req.method === 'GET' && pathname === '/') {
    return serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  const pollPageMatch = pathname.match(/^\/poll\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && pollPageMatch) {
    return serveStaticFile(res, path.join(PUBLIC_DIR, 'poll.html'));
  }

  // Static files
  if (req.method === 'GET') {
    const filePath = path.join(PUBLIC_DIR, pathname);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    return serveStaticFile(res, resolved);
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Start server after connecting to database
const { connect } = require('./db');

async function startServer() {
  try {
    await connect();
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
