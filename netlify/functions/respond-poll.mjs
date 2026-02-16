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
    // Extract poll ID from URL parameter
    const pollId = context.params.id;

    // Connect to MongoDB and find poll
    const { db } = await connectToDatabase();
    const poll = await db.collection('polls').findOne({ id: pollId });

    if (!poll) {
      return new Response(JSON.stringify({ error: 'Poll not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    // Validate name
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate answers object
    if (!body.answers || typeof body.answers !== 'object') {
      return new Response(JSON.stringify({ error: 'Answers are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate answers for each date
    const validValues = ['yes', 'ifneeded', 'no'];
    for (const date of poll.dates) {
      if (!body.answers[date] || !validValues.includes(body.answers[date])) {
        return new Response(JSON.stringify({ error: `Invalid or missing answer for date ${date}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create response object
    const response = {
      name: body.name.trim(),
      submittedAt: new Date().toISOString(),
      answers: body.answers,
      instruments: body.instruments || {},
      upfrontInstruments: body.upfrontInstruments || [],
    };

    // Replace existing response with same name (case-insensitive), or append
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

    return new Response(JSON.stringify({ success: true, poll }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error submitting response:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/polls/:id/respond"
};
