// --- Planning page ---
// URL params: ?id=<pollId>&admin=true&back=admin|poll

const urlParams = new URLSearchParams(window.location.search);
const pollId = urlParams.get('id');
const isAdmin = urlParams.get('admin') === 'true';
const backTo = urlParams.get('back'); // 'admin' or 'poll'

let currentPoll = null;
// planning: { [dateStr]: { [instrument]: { name, isGuest, certain } } }
let currentPlanning = {};

// Priority instruments (must be ordered first in table rows and composition)
const COMPOSITION_PRIORITY = ['piano', 'guitare'];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!pollId) { showError('Paramètre id manquant dans l\'URL.'); return; }

  try {
    const res = await fetch(`/api/polls/${pollId}`);
    if (!res.ok) throw new Error('Sondage introuvable');
    currentPoll = await res.json();
  } catch (err) {
    showError(err.message);
    return;
  }

  document.getElementById('planning-title').textContent = `Planning — ${currentPoll.title}`;
  document.title = `Planning — ${currentPoll.title}`;

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => {
    if (backTo === 'admin') {
      window.location.href = '/';
    } else {
      window.location.href = `/poll/${pollId}`;
    }
  });

  // Load existing planning if present
  if (currentPoll.planning && Object.keys(currentPoll.planning).length > 0) {
    currentPlanning = currentPoll.planning;
  }

  // Admin controls
  if (isAdmin) {
    const adminControls = document.getElementById('admin-controls');
    adminControls.classList.remove('hidden');
    adminControls.style.display = 'flex';
    document.getElementById('compose-btn').addEventListener('click', onCompose);
    document.getElementById('save-btn').addEventListener('click', onSave);
  }

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('planning-table-container').classList.remove('hidden');
  document.getElementById('planning-legend').classList.remove('hidden');

  renderTable();
}

// ---- Table rendering ----

function getInstrumentOrder() {
  const isPriority = i => COMPOSITION_PRIORITY.some(p => i.toLowerCase() === p.toLowerCase());
  const priority = COMPOSITION_PRIORITY
    .map(p => currentPoll.instruments.find(i => i.toLowerCase() === p.toLowerCase()))
    .filter(Boolean);
  const rest = currentPoll.instruments.filter(i => !isPriority(i));
  return [...priority, ...rest];
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Returns players available for a given instrument on a given date
function getCellCandidates(instrument, dateStr) {
  const yes = [], ifneeded = [];
  for (const response of (currentPoll.responses || [])) {
    const avail = response.answers[dateStr];
    const di = response.instruments?.[dateStr] || [];
    if (!di.includes(instrument)) continue;
    if (avail === 'yes') yes.push(response.name);
    else if (avail === 'ifneeded') ifneeded.push(response.name);
  }
  return { yes, ifneeded };
}

function renderTable() {
  const container = document.getElementById('planning-table-container');
  const instruments = getInstrumentOrder();
  const dates = currentPoll.dates;

  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper planning-table-wrapper';

  const table = document.createElement('table');
  table.className = 'planning-table';

  // Header: first cell = "Date", then one cell per instrument
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  const thDate = document.createElement('th');
  thDate.textContent = 'Date';
  thDate.className = 'planning-instr-header';
  headerRow.appendChild(thDate);
  for (const instrument of instruments) {
    const th = document.createElement('th');
    th.textContent = instrument;
    headerRow.appendChild(th);
  }

  // Body: one row per session
  const tbody = table.createTBody();
  for (const dateStr of dates) {
    const row = tbody.insertRow();
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(dateStr);
    tdDate.className = 'planning-instr-name';
    row.appendChild(tdDate);

    for (const instrument of instruments) {
      const td = document.createElement('td');
      td.className = 'planning-cell';
      if (isAdmin) {
        td.appendChild(buildEditCell(instrument, dateStr));
      } else {
        td.appendChild(buildReadonlyCell(instrument, dateStr));
      }
      row.appendChild(td);
    }
  }

  wrapper.appendChild(table);
  container.innerHTML = '';
  container.appendChild(wrapper);
}

function buildReadonlyCell(instrument, dateStr) {
  const assignment = currentPlanning?.[dateStr]?.[instrument];
  const span = document.createElement('span');
  if (!assignment || !assignment.name) {
    span.textContent = '—';
    span.className = 'planning-empty';
  } else if (assignment.isGuest) {
    span.textContent = assignment.name; // guest colour only, no ★
    span.className = 'planning-guest';
  } else if (!assignment.certain) {
    span.textContent = `[${assignment.name}]`;
    span.className = 'planning-uncertain';
  } else {
    span.textContent = assignment.name;
    span.className = 'planning-confirmed';
  }
  return span;
}

function buildEditCell(instrument, dateStr) {
  const { yes, ifneeded } = getCellCandidates(instrument, dateStr);
  const assignment = currentPlanning?.[dateStr]?.[instrument];

  const cellWrapper = document.createElement('div');
  cellWrapper.className = 'edit-cell-wrapper';

  const select = document.createElement('select');
  select.className = 'planning-select';

  // Empty / unassigned
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '—';
  select.appendChild(emptyOpt);

  // Yes group
  if (yes.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'Disponibles';
    yes.forEach(name => {
      const opt = document.createElement('option');
      opt.value = 'yes\x00' + name; // use null byte as separator (safe)
      opt.textContent = name;
      grp.appendChild(opt);
    });
    select.appendChild(grp);
  }

  // Ifneeded group
  if (ifneeded.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'Si nécessaire';
    ifneeded.forEach(name => {
      const opt = document.createElement('option');
      opt.value = 'ifneeded\x00' + name;
      opt.textContent = `[${name}]`;
      grp.appendChild(opt);
    });
    select.appendChild(grp);
  }

  // Guest option
  const guestOpt = document.createElement('option');
  guestOpt.value = '__GUEST__';
  guestOpt.textContent = '★ Invité...';
  select.appendChild(guestOpt);

  // Guest text input (hidden by default)
  const guestInput = document.createElement('input');
  guestInput.type = 'text';
  guestInput.className = 'planning-guest-input hidden';
  guestInput.placeholder = "Nom de l'invité";

  // Restore current value
  if (assignment && assignment.name) {
    if (assignment.isGuest) {
      select.value = '__GUEST__';
      guestInput.value = assignment.name;
      guestInput.classList.remove('hidden');
    } else {
      const prefix = assignment.certain ? 'yes' : 'ifneeded';
      select.value = prefix + '\x00' + assignment.name;
    }
  }

  // Handlers
  select.addEventListener('change', () => {
    if (select.value === '__GUEST__') {
      guestInput.classList.remove('hidden');
      guestInput.focus();
      deletePlanning(instrument, dateStr);
    } else if (select.value === '') {
      guestInput.classList.add('hidden');
      guestInput.value = '';
      deletePlanning(instrument, dateStr);
    } else {
      guestInput.classList.add('hidden');
      guestInput.value = '';
      const sep = select.value.indexOf('\x00');
      const certainty = select.value.slice(0, sep);
      const name = select.value.slice(sep + 1);
      savePlanning(instrument, dateStr, { name, isGuest: false, certain: certainty === 'yes' });
    }
  });

  guestInput.addEventListener('input', () => {
    const name = guestInput.value.trim();
    if (name) {
      savePlanning(instrument, dateStr, { name, isGuest: true, certain: null });
    } else {
      deletePlanning(instrument, dateStr);
    }
  });

  cellWrapper.appendChild(select);
  cellWrapper.appendChild(guestInput);
  return cellWrapper;
}

function savePlanning(instrument, dateStr, assignment) {
  if (!currentPlanning[dateStr]) currentPlanning[dateStr] = {};
  currentPlanning[dateStr][instrument] = assignment;
}

function deletePlanning(instrument, dateStr) {
  if (currentPlanning[dateStr]) {
    delete currentPlanning[dateStr][instrument];
  }
}

// ---- Admin actions ----

function onCompose() {
  currentPlanning = computeComposition(currentPoll);
  renderTable();
}

async function onSave() {
  const token = getPollToken(pollId);
  if (!token) {
    alert('Token introuvable. Assurez-vous d\'être l\'administrateur de ce sondage.');
    return;
  }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Sauvegarde...';

  try {
    const res = await fetch(`/api/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletionToken: token, planning: currentPlanning }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur inconnue');
    }
    saveBtn.textContent = '✓ Sauvegardé';
    setTimeout(() => {
      saveBtn.textContent = 'Sauvegarder';
      saveBtn.disabled = false;
    }, 2000);
  } catch (err) {
    alert('Erreur lors de la sauvegarde : ' + err.message);
    saveBtn.textContent = 'Sauvegarder';
    saveBtn.disabled = false;
  }
}

function getPollToken(id) {
  const polls = JSON.parse(localStorage.getItem('createdPolls') || '[]');
  const poll = polls.find(p => p.id === id);
  return poll?.deletionToken || null;
}

function showError(msg) {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = msg;
}

// ---- Composition algorithm (duplicated from app.js) ----

function computeComposition(poll) {
  // Precompute remaining availability per person per instrument per date index (EDF).
  const remainingAvail = {};
  poll.responses.forEach(r => {
    remainingAvail[r.name] = {};
    for (const instr of poll.instruments) {
      const arr = new Array(poll.dates.length).fill(0);
      for (let i = poll.dates.length - 1; i >= 0; i--) {
        const avail = r.answers[poll.dates[i]];
        const di = r.instruments?.[poll.dates[i]] || [];
        const here = ((avail === 'yes' || avail === 'ifneeded') && di.includes(instr)) ? 1 : 0;
        arr[i] = here + (i + 1 < poll.dates.length ? arr[i + 1] : 0);
      }
      remainingAvail[r.name][instr] = arr;
    }
  });

  const instrAssignments = {};
  poll.responses.forEach(r => { instrAssignments[r.name] = {}; });

  const compositionByDate = {};
  const sessionAssigned = {};
  for (const d of poll.dates) {
    compositionByDate[d] = {};
    sessionAssigned[d] = new Set();
  }

  const isPriority = i => COMPOSITION_PRIORITY.some(p => i.toLowerCase() === p.toLowerCase());

  const priorityInstruments = COMPOSITION_PRIORITY
    .map(p => poll.instruments.find(i => i.toLowerCase() === p.toLowerCase()))
    .filter(Boolean);

  const otherInstruments = poll.instruments
    .filter(i => !isPriority(i))
    .sort((a, b) => {
      const eligible = instr => poll.responses.filter(r =>
        poll.dates.some(d => {
          const avail = r.answers[d];
          return (avail === 'yes' || avail === 'ifneeded') && (r.instruments?.[d] || []).includes(instr);
        })
      ).length;
      return eligible(a) - eligible(b);
    });

  for (const instrument of [...priorityInstruments, ...otherInstruments]) {
    poll.dates.forEach((dateStr, dateIdx) => {
      const yes = [], ifneeded = [];
      for (const response of poll.responses) {
        if (sessionAssigned[dateStr].has(response.name)) continue;
        const avail = response.answers[dateStr];
        const di = response.instruments?.[dateStr] || [];
        if (!di.includes(instrument)) continue;
        if (avail === 'yes') yes.push(response.name);
        else if (avail === 'ifneeded') ifneeded.push(response.name);
      }
      if (yes.length === 0 && ifneeded.length === 0) return;

      const byEDF = (a, b) => {
        const remDiff = (remainingAvail[a]?.[instrument]?.[dateIdx] || 0)
                      - (remainingAvail[b]?.[instrument]?.[dateIdx] || 0);
        if (remDiff !== 0) return remDiff;
        const instrDiff = (instrAssignments[a]?.[instrument] || 0)
                        - (instrAssignments[b]?.[instrument] || 0);
        if (instrDiff !== 0) return instrDiff;
        return a.localeCompare(b);
      };
      yes.sort(byEDF);
      ifneeded.sort(byEDF);

      const chosen = yes.length > 0 ? yes[0] : ifneeded[0];
      const certain = yes.length > 0;

      compositionByDate[dateStr][instrument] = { name: chosen, isGuest: false, certain };
      sessionAssigned[dateStr].add(chosen);
      instrAssignments[chosen][instrument] = (instrAssignments[chosen][instrument] || 0) + 1;
    });
  }

  return compositionByDate;
}
