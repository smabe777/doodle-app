document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');

  try {
    const res = await fetch('/api/polls');
    if (!res.ok) throw new Error('Erreur de chargement');
    const polls = await res.json();

    loading.classList.add('hidden');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active = polls.filter(p => p.dates.some(d => new Date(d + 'T00:00:00') >= today));
    const past   = polls.filter(p => p.dates.every(d => new Date(d + 'T00:00:00') < today));

    if (active.length > 0) {
      document.getElementById('active-section').classList.remove('hidden');
      active.forEach(p => document.getElementById('active-list').appendChild(buildCard(p, false)));
    }

    if (past.length > 0) {
      document.getElementById('past-section').classList.remove('hidden');
      past.forEach(p => document.getElementById('past-list').appendChild(buildCard(p, true)));
    }

    if (active.length === 0 && past.length === 0) {
      loading.textContent = 'Aucun sondage disponible pour l\'instant.';
      loading.classList.remove('hidden');
    }

  } catch (err) {
    loading.textContent = 'Impossible de charger les sondages.';
  }
});

function buildCard(poll, isPast) {
  const isHs = poll.type === 'hors-serie';

  const a = document.createElement('a');
  a.href = `/poll/${poll.id}`;
  a.className = 'hub-card' + (isHs ? ' hs' : '') + (isPast ? ' past' : '');

  const info = document.createElement('div');

  const title = document.createElement('div');
  title.className = 'hub-card-title';
  title.textContent = poll.title;

  const meta = document.createElement('div');
  meta.className = 'hub-card-meta';
  const first = formatDate(poll.dates[0]);
  const last  = formatDate(poll.dates[poll.dates.length - 1]);
  const dateRange = first === last ? first : `${first} — ${last}`;
  const responseLabel = poll.responseCount === 0
    ? 'Aucune réponse'
    : `${poll.responseCount} réponse${poll.responseCount > 1 ? 's' : ''}`;
  meta.textContent = `${dateRange} · ${responseLabel}`;

  info.appendChild(title);
  info.appendChild(meta);

  const badge = document.createElement('span');
  badge.className = 'hub-card-badge ' + (isPast ? 'badge-past' : isHs ? 'badge-hs' : 'badge-active');
  badge.textContent = isPast ? 'Terminé' : isHs ? 'Hors série' : 'Culte';

  a.appendChild(info);
  a.appendChild(badge);
  return a;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short'
  });
}
