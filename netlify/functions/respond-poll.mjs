import { connectToDatabase } from './db-connection.mjs';

const NOTIFY_EMAIL = 'rodrigue.lima@gmail.com';

async function sendEmailNotification(poll, response, isUpdate) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Skip if not configured

  const action = isUpdate ? 'modifié sa réponse' : 'ajouté sa réponse';

  const answerLabel = { yes: 'Oui ✓', ifneeded: 'Si nécessaire ~', no: 'Non ✗' };

  const dateRows = poll.dates.map(date => {
    const answer = response.answers[date];
    const instruments = response.instruments?.[date] || [];
    const dateDisplay = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const instrText = instruments.length > 0 ? ` (${instruments.join(', ')})` : '';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#d4d4d4">${dateDisplay}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#d4d4d4">${answerLabel[answer] || answer}${instrText}</td>
    </tr>`;
  }).join('');

  const instrumentsText = response.upfrontInstruments?.length > 0
    ? `<p style="color:#aaa;margin:16px 0 4px">Instruments :</p><p style="color:#d4d4d4;margin:0">${response.upfrontInstruments.join(', ')}</p>`
    : '';

  const pollUrl = `https://doodle-app-planning-epebw.netlify.app/poll/${poll.id}?admin=true`;

  const html = `
    <div style="background:#0f0f0f;padding:32px;font-family:sans-serif;max-width:600px">
      <h2 style="color:#e8e8e8;margin-bottom:4px">${poll.title}</h2>
      <p style="color:#888;margin-bottom:24px">${response.name} a ${action}</p>
      ${instrumentsText}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#1a1a1a;border-radius:8px;overflow:hidden">
        <thead>
          <tr>
            <th style="padding:10px 12px;text-align:left;color:#aaa;font-size:0.85em;background:#222">Date</th>
            <th style="padding:10px 12px;text-align:left;color:#aaa;font-size:0.85em;background:#222">Disponibilité</th>
          </tr>
        </thead>
        <tbody>${dateRows}</tbody>
      </table>
      <p style="margin-top:24px">
        <a href="${pollUrl}" style="background:#e8e8e8;color:#0f0f0f;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:500">Voir le sondage</a>
      </p>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sondage Musique <onboarding@resend.dev>',
      to: [NOTIFY_EMAIL],
      subject: `${response.name} a ${action} — ${poll.title}`,
      html,
    }),
  });
}

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

    // Send email notification (fire and forget - don't block response)
    sendEmailNotification(poll, response, existingIndex >= 0).catch(err => {
      console.error('Email notification failed:', err);
    });

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
