import { randomUUID } from 'crypto';
import { connectToDatabase } from './db-connection.mjs';

export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.title || !Array.isArray(body.dates) || body.dates.length === 0) {
      return new Response(JSON.stringify({ error: 'Title and at least one date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(body.participants) || body.participants.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one participant is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(body.instruments) || body.instruments.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one instrument is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of body.dates) {
      if (!dateRegex.test(d) || isNaN(new Date(d).getTime())) {
        return new Response(JSON.stringify({ error: `Invalid date: ${d}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create poll object with deletion token
    const deletionToken = randomUUID();
    const poll = {
      id: randomUUID(),
      title: body.title.trim(),
      description: (body.description || '').trim(),
      duration: body.duration || '',
      createdAt: new Date().toISOString(),
      dates: body.dates.sort(),
      participants: body.participants,
      instruments: body.instruments,
      responses: [],
      deletionToken: deletionToken,
    };

    // Connect to MongoDB and insert poll
    const { db } = await connectToDatabase();
    await db.collection('polls').insertOne(poll);

    return new Response(JSON.stringify({ id: poll.id, url: `/poll/${poll.id}`, deletionToken: deletionToken }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error creating poll:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/polls"
};
