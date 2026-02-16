document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;

  if (pathname === '/') {
    initCreatePage();
  } else if (pathname.startsWith('/poll/')) {
    const pollId = pathname.split('/poll/')[1];
    initPollPage(pollId);
  }
});

// --- Shared utilities ---

function getWeeklyDates(startDateStr, count) {
  const dates = [];
  const current = new Date(startDateStr + 'T00:00:00');

  for (let i = 0; i < count; i++) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

function getNextSunday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  if (dayOfWeek !== 0) {
    today.setDate(today.getDate() + (7 - dayOfWeek));
  }
  return formatDate(today);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// --- Create page ---

function initCreatePage() {
  const form = document.getElementById('create-form');
  const datesContainer = document.getElementById('dates-container');
  const successPanel = document.getElementById('success-panel');
  const startDateInput = document.getElementById('start-date');
  const numDatesInput = document.getElementById('num-dates');

  // Display existing poll history
  displayPollHistory();

  // Default: next Sunday, 8 weeks
  startDateInput.value = getNextSunday();

  function regenerateDates() {
    datesContainer.innerHTML = '';
    const startDate = startDateInput.value;
    const count = parseInt(numDatesInput.value, 10);
    if (!startDate || !count || count < 1) return;

    const dates = getWeeklyDates(startDate, count);
    dates.forEach(dateStr => {
      const label = document.createElement('label');
      label.className = 'date-checkbox';
      label.innerHTML =
        `<input type="checkbox" name="dates" value="${dateStr}" checked>` +
        `<span>${formatDateDisplay(dateStr)}</span>`;
      datesContainer.appendChild(label);
    });
  }

  regenerateDates();
  startDateInput.addEventListener('change', regenerateDates);
  numDatesInput.addEventListener('input', regenerateDates);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const checkedDates = Array.from(
      document.querySelectorAll('input[name="dates"]:checked')
    ).map(cb => cb.value);

    if (checkedDates.length === 0) {
      alert('Veuillez sélectionner au moins une date.');
      return;
    }

    const participantsText = document.getElementById('participants').value.trim();
    const instrumentsText = document.getElementById('instruments').value.trim();

    const participants = participantsText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const instruments = instrumentsText.split('\n').map(i => i.trim()).filter(i => i.length > 0);

    if (participants.length === 0) {
      alert('Veuillez ajouter au moins un participant.');
      return;
    }

    if (instruments.length === 0) {
      alert('Veuillez ajouter au moins un instrument.');
      return;
    }

    const payload = {
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      duration: document.getElementById('duration').value,
      dates: checkedDates,
      participants: participants,
      instruments: instruments,
    };

    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      form.classList.add('hidden');
      successPanel.classList.remove('hidden');

      const shareUrl = `${window.location.origin}${data.url}`;
      document.getElementById('share-url').value = shareUrl;

      // Save poll to localStorage with deletion token
      savePollToHistory({
        id: data.id,
        title: payload.title,
        url: shareUrl,
        createdAt: new Date().toISOString(),
        deletionToken: data.deletionToken
      });

      // Refresh poll history display
      displayPollHistory();

      document.getElementById('copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'Copié !';
        setTimeout(() => { btn.textContent = 'Copier'; }, 2000);
      });
    } catch (err) {
      alert('Erreur lors de la création du sondage : ' + err.message);
    }
  });
}

// --- Poll page ---

async function initPollPage(pollId) {
  const respondForm = document.getElementById('respond-form');
  const errorPanel = document.getElementById('error-panel');
  const respondSection = document.getElementById('respond-section');
  const resultsSection = document.getElementById('results-section');

  try {
    const res = await fetch(`/api/polls/${pollId}`);
    if (!res.ok) throw new Error('Sondage introuvable');
    const poll = await res.json();

    document.getElementById('poll-title').textContent = poll.title;
    document.getElementById('poll-description').textContent = poll.description;
    document.getElementById('poll-duration').textContent =
      poll.duration ? `Rencontre : ${poll.duration}` : '';
    document.title = `${poll.title} - Planning EPEBW - Musique`;

    buildParticipantSelect(poll.participants, poll);
    buildUpfrontInstruments(poll.instruments);
    buildAvailabilityGrid(poll.dates, poll.instruments);
    renderResults(poll);

    respondForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('participant-name').value.trim();
      if (!name) return;

      // Get upfront instruments
      const upfrontInstruments = Array.from(
        document.querySelectorAll('.upfront-instrument:checked')
      ).map(cb => cb.value);

      // Validate that at least one upfront instrument is selected
      if (upfrontInstruments.length === 0) {
        alert('Veuillez sélectionner au moins un instrument dans "Vos instruments".');
        return;
      }

      const answers = {};
      const instruments = {};
      for (const date of poll.dates) {
        const selected = document.querySelector(
          `input[name="answer-${date}"]:checked`
        );
        if (!selected) {
          alert(`Veuillez sélectionner votre disponibilité pour ${formatDateDisplay(date)}`);
          return;
        }
        answers[date] = selected.value;

        // Get selected instruments for this date
        const selectedInstruments = Array.from(
          document.querySelectorAll(`input[name="instrument-${date}"]:checked`)
        ).map(cb => cb.value);
        instruments[date] = selectedInstruments;
      }

      try {
        const submitRes = await fetch(`/api/polls/${pollId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, answers, instruments, upfrontInstruments }),
        });
        const data = await submitRes.json();
        if (!submitRes.ok) throw new Error(data.error);

        renderResults(data.poll);
        respondForm.reset();
        resultsSection.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        alert('Erreur lors de l\'envoi de la réponse : ' + err.message);
      }
    });
  } catch {
    errorPanel.classList.remove('hidden');
    respondSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
  }
}

function buildParticipantSelect(participants, poll) {
  const nameInput = document.getElementById('participant-name');

  const select = document.createElement('select');
  select.id = 'participant-name';
  select.required = true;

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Sélectionnez votre nom';
  select.appendChild(defaultOption);

  participants.forEach(participant => {
    const option = document.createElement('option');
    option.value = participant;
    option.textContent = participant;
    select.appendChild(option);
  });

  // Add event listener to show instruments section and load previous response
  select.addEventListener('change', () => {
    const upfrontSection = document.getElementById('upfront-instruments-section');
    if (select.value) {
      upfrontSection.style.display = 'block';
      loadPreviousResponse(select.value, poll);
    } else {
      upfrontSection.style.display = 'none';
    }
  });

  nameInput.parentNode.replaceChild(select, nameInput);
}

function buildUpfrontInstruments(instruments) {
  const container = document.getElementById('upfront-instruments');
  container.innerHTML = '';

  instruments.forEach(instrument => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.margin = '8px 0';
    label.innerHTML = `
      <input type="checkbox" class="upfront-instrument" value="${instrument}">
      <span>${instrument}</span>
    `;
    container.appendChild(label);

    // Add event listener to update per-date instruments when upfront selection changes
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      // Prevent unchecking the last instrument
      const allCheckboxes = container.querySelectorAll('.upfront-instrument');
      const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;

      if (checkedCount === 0) {
        e.preventDefault();
        checkbox.checked = true;
        alert('Au moins un instrument doit être sélectionné.');
        return;
      }

      updatePerDateInstruments();
    });
  });
}

function buildAvailabilityGrid(dates, instruments) {
  const grid = document.getElementById('availability-grid');
  grid.innerHTML = '';

  dates.forEach(dateStr => {
    const row = document.createElement('div');
    row.className = 'availability-row';

    // Create empty instruments container (will be populated dynamically)
    const instrumentsHtml = '<div class="instruments-select" id="instruments-' + dateStr + '" style="display:none; margin-top: 8px;"></div>';

    row.innerHTML =
      `<span class="date-label" data-date="${dateStr}">${formatDateDisplay(dateStr)}</span>` +
      `<div class="radio-group">` +
        `<label class="radio-option radio-yes">` +
          `<input type="radio" name="answer-${dateStr}" value="yes">` +
          `<span>Oui</span>` +
        `</label>` +
        `<label class="radio-option radio-ifneeded">` +
          `<input type="radio" name="answer-${dateStr}" value="ifneeded">` +
          `<span>Si nécessaire</span>` +
        `</label>` +
        `<label class="radio-option radio-no">` +
          `<input type="radio" name="answer-${dateStr}" value="no" checked>` +
          `<span>Non</span>` +
        `</label>` +
      `</div>` +
      instrumentsHtml;
    grid.appendChild(row);

    // Add event listeners to show/hide instruments
    const radios = row.querySelectorAll(`input[name="answer-${dateStr}"]`);
    const instrumentsDiv = row.querySelector(`#instruments-${dateStr}`);
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'yes' || radio.value === 'ifneeded') {
          // Get upfront selected instruments
          const upfrontInstruments = Array.from(
            document.querySelectorAll('.upfront-instrument:checked')
          ).map(cb => cb.value);

          // Check if at least one instrument is selected upfront
          if (upfrontInstruments.length === 0) {
            alert('Veuillez d\'abord sélectionner au moins un instrument dans "Vos instruments" avant de choisir "Oui" ou "Si nécessaire".');
            // Revert to "Non"
            const noRadio = row.querySelector(`input[name="answer-${dateStr}"][value="no"]`);
            if (noRadio) {
              noRadio.checked = true;
            }
            instrumentsDiv.style.display = 'none';
            return;
          }

          // Rebuild instruments div with only upfront instruments
          rebuildDateInstruments(dateStr, upfrontInstruments);
          instrumentsDiv.style.display = 'block';
        } else {
          instrumentsDiv.style.display = 'none';
        }
      });
    });
  });
}

function rebuildDateInstruments(dateStr, upfrontInstruments) {
  const instrumentsDiv = document.getElementById(`instruments-${dateStr}`);
  if (!instrumentsDiv) return;

  // Save currently checked instruments
  const previouslyChecked = Array.from(
    instrumentsDiv.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  // Rebuild with only upfront instruments
  instrumentsDiv.innerHTML = '<label style="font-size: 0.9em; color: #888; display: block; margin-bottom: 6px;">Instruments :</label>';

  upfrontInstruments.forEach(instrument => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.margin = '4px 0';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = `instrument-${dateStr}`;
    checkbox.value = instrument;
    // Check if it was previously checked, otherwise check all by default
    checkbox.checked = previouslyChecked.length > 0
      ? previouslyChecked.includes(instrument)
      : true;

    // Prevent unchecking the last instrument
    checkbox.addEventListener('change', (e) => {
      const allCheckboxes = instrumentsDiv.querySelectorAll('input[type="checkbox"]');
      const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;

      if (checkedCount === 0) {
        e.preventDefault();
        checkbox.checked = true;
        alert('Au moins un instrument doit rester sélectionné.');
      }
    });

    const span = document.createElement('span');
    span.textContent = ' ' + instrument;

    label.appendChild(checkbox);
    label.appendChild(span);
    instrumentsDiv.appendChild(label);
  });
}

function updatePerDateInstruments() {
  // Get all dates from the availability grid
  const grid = document.getElementById('availability-grid');
  const rows = grid.querySelectorAll('.availability-row');

  // Get upfront selected instruments
  const upfrontInstruments = Array.from(
    document.querySelectorAll('.upfront-instrument:checked')
  ).map(cb => cb.value);

  rows.forEach(row => {
    const dateStr = row.querySelector('.date-label').dataset.date ||
                    Array.from(row.querySelectorAll('input[type="radio"]'))[0].name.replace('answer-', '');

    // Only update if this date's answer is yes or ifneeded
    const selectedRadio = row.querySelector('input[type="radio"]:checked');
    if (selectedRadio && (selectedRadio.value === 'yes' || selectedRadio.value === 'ifneeded')) {
      rebuildDateInstruments(dateStr, upfrontInstruments);
    }
  });
}

function updatePerDateInstrumentsForDate(dateStr) {
  // Get upfront selected instruments
  const upfrontInstruments = Array.from(
    document.querySelectorAll('.upfront-instrument:checked')
  ).map(cb => cb.value);

  // Rebuild instruments for this date
  rebuildDateInstruments(dateStr, upfrontInstruments);
}

function loadPreviousResponse(participantName, poll) {
  // Find the previous response for this participant
  const previousResponse = poll.responses.find(
    r => r.name.toLowerCase() === participantName.toLowerCase()
  );

  if (!previousResponse) {
    // No previous response, just reset the form
    resetAvailabilityForm(poll);
    return;
  }

  // Load upfront instruments if they exist
  if (previousResponse.upfrontInstruments && previousResponse.upfrontInstruments.length > 0) {
    document.querySelectorAll('.upfront-instrument').forEach(cb => {
      cb.checked = previousResponse.upfrontInstruments.includes(cb.value);
    });
  }

  // Load answers for each date
  poll.dates.forEach(dateStr => {
    const answer = previousResponse.answers[dateStr];
    if (answer) {
      // Check the appropriate radio button
      const radio = document.querySelector(`input[name="answer-${dateStr}"][value="${answer}"]`);
      if (radio) {
        radio.checked = true;

        // Show instruments section if yes or ifneeded
        if (answer === 'yes' || answer === 'ifneeded') {
          const instrumentsDiv = document.getElementById(`instruments-${dateStr}`);
          if (instrumentsDiv) {
            instrumentsDiv.style.display = 'block';
          }

          // Load instruments for this date
          if (previousResponse.instruments && previousResponse.instruments[dateStr]) {
            previousResponse.instruments[dateStr].forEach(instrument => {
              const cb = document.querySelector(`input[name="instrument-${dateStr}"][value="${instrument}"]`);
              if (cb) {
                cb.checked = true;
              }
            });
          }
        }
      }
    }
  });
}

function resetAvailabilityForm(poll) {
  // Uncheck all upfront instruments
  document.querySelectorAll('.upfront-instrument').forEach(cb => {
    cb.checked = false;
  });

  // Reset all date answers to "Non"
  poll.dates.forEach(dateStr => {
    const noRadio = document.querySelector(`input[name="answer-${dateStr}"][value="no"]`);
    if (noRadio) {
      noRadio.checked = true;
    }

    // Hide instruments section
    const instrumentsDiv = document.getElementById(`instruments-${dateStr}`);
    if (instrumentsDiv) {
      instrumentsDiv.style.display = 'none';
    }

    // Uncheck all instruments
    document.querySelectorAll(`input[name="instrument-${dateStr}"]`).forEach(cb => {
      cb.checked = false;
    });
  });
}

function renderResults(poll) {
  const headerRow = document.getElementById('results-header');
  const tbody = document.getElementById('results-body');
  const summaryRow = document.getElementById('results-summary');
  const countSpan = document.getElementById('response-count');
  const noResponses = document.getElementById('no-responses');
  const table = document.getElementById('results-table');

  countSpan.textContent = poll.responses.length;

  if (poll.responses.length === 0) {
    noResponses.classList.remove('hidden');
    table.classList.add('hidden');
    return;
  }

  noResponses.classList.add('hidden');
  table.classList.remove('hidden');

  // Header
  headerRow.innerHTML = '<th>Nom</th>';
  poll.dates.forEach(dateStr => {
    const th = document.createElement('th');
    th.textContent = formatDateDisplay(dateStr);
    headerRow.appendChild(th);
  });

  // Body
  tbody.innerHTML = '';
  poll.responses.forEach(response => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = response.name;
    nameTd.className = 'participant-name';
    tr.appendChild(nameTd);

    poll.dates.forEach(dateStr => {
      const td = document.createElement('td');
      const answer = response.answers[dateStr];
      const instruments = response.instruments && response.instruments[dateStr] ? response.instruments[dateStr] : [];

      td.className = `answer answer-${answer}`;

      const symbol = answer === 'yes' ? '\u2713' :
                    answer === 'ifneeded' ? '?' :
                    '\u2717';

      if (instruments.length > 0) {
        td.innerHTML = `${symbol}<br><span style="font-size: 0.75em; color: #666;">${instruments.join(', ')}</span>`;
      } else {
        td.textContent = symbol;
      }

      td.title =
        answer === 'yes' ? 'Oui' :
        answer === 'ifneeded' ? 'Si nécessaire' :
        'Non';

      if (instruments.length > 0) {
        td.title += ' - ' + instruments.join(', ');
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // Summary
  summaryRow.innerHTML = '<td><strong>Disponible</strong></td>';
  poll.dates.forEach(dateStr => {
    const yesCount = poll.responses.filter(
      r => r.answers[dateStr] === 'yes'
    ).length;
    const ifNeededCount = poll.responses.filter(
      r => r.answers[dateStr] === 'ifneeded'
    ).length;
    const td = document.createElement('td');
    td.innerHTML = `<strong>${yesCount}</strong>` +
      (ifNeededCount > 0
        ? ` <span class="ifneeded-count">(+${ifNeededCount})</span>`
        : '');
    summaryRow.appendChild(td);
  });

  // Initialize export button
  initExportButton(poll);
}


// --- Poll History Functions ---

function savePollToHistory(poll) {
  const polls = JSON.parse(localStorage.getItem("createdPolls") || "[]");
  polls.unshift(poll); // Add to beginning
  localStorage.setItem("createdPolls", JSON.stringify(polls.slice(0, 20))); // Keep last 20
}

function displayPollHistory() {
  const polls = JSON.parse(localStorage.getItem("createdPolls") || "[]");
  const historySection = document.getElementById("poll-history");
  const pollList = document.getElementById("poll-list");

  if (polls.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.classList.remove("hidden");
  pollList.innerHTML = "";

  polls.forEach(poll => {
    const item = document.createElement("div");
    item.className = "poll-item";

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "poll-item-title";
    title.textContent = poll.title;

    const date = document.createElement("div");
    date.className = "poll-item-date";
    date.textContent = new Date(poll.createdAt).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    info.appendChild(title);
    info.appendChild(date);

    // Container for buttons
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.gap = "8px";
    buttonsContainer.style.flexWrap = "wrap";

    // Admin link
    const adminLink = document.createElement("a");
    adminLink.className = "poll-item-link";
    adminLink.href = poll.url + "?admin=true";
    adminLink.textContent = "Voir le sondage";

    // Share link button
    const shareBtn = document.createElement("button");
    shareBtn.className = "poll-item-link";
    shareBtn.textContent = "Lien à partager";
    shareBtn.style.cursor = "pointer";
    shareBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(poll.url);
      const originalText = shareBtn.textContent;
      shareBtn.textContent = "Copié !";
      setTimeout(() => { shareBtn.textContent = originalText; }, 2000);
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "poll-item-link poll-item-delete";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Êtes-vous sûr de vouloir supprimer le sondage "${poll.title}" ?\n\nCette action est irréversible et supprimera toutes les réponses des participants.`)) {
        await deletePoll(poll);
      }
    });

    buttonsContainer.appendChild(adminLink);
    buttonsContainer.appendChild(shareBtn);
    buttonsContainer.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(buttonsContainer);
    pollList.appendChild(item);
  });
}

async function deletePoll(poll) {
  try {
    // Check if poll has deletion token (newer polls only)
    if (!poll.deletionToken) {
      // Old poll without token - can only remove from localStorage
      if (confirm(`Ce sondage a été créé avant la mise en place du système de suppression sécurisé.\n\nVoulez-vous le retirer de votre liste locale ?\n(Le sondage restera accessible via son URL)`)) {
        const polls = JSON.parse(localStorage.getItem("createdPolls") || "[]");
        const updatedPolls = polls.filter(p => p.id !== poll.id);
        localStorage.setItem("createdPolls", JSON.stringify(updatedPolls));
        displayPollHistory();
        alert('Sondage retiré de votre liste locale.');
      }
      return;
    }

    // New poll with token - can delete from database
    const res = await fetch(`/api/polls/${poll.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletionToken: poll.deletionToken })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de la suppression');
    }

    // Remove from localStorage
    const polls = JSON.parse(localStorage.getItem("createdPolls") || "[]");
    const updatedPolls = polls.filter(p => p.id !== poll.id);
    localStorage.setItem("createdPolls", JSON.stringify(updatedPolls));

    // Refresh display
    displayPollHistory();

    alert('Sondage supprimé avec succès de la base de données.');
  } catch (err) {
    alert('Erreur lors de la suppression du sondage : ' + err.message);
  }
}

// --- Export Functions ---

function initExportButton(poll) {
  const exportBtn = document.getElementById("export-btn");
  if (!exportBtn) return;

  // Check if we're in admin mode (URL has ?admin=true)
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminMode = urlParams.get("admin") === "true";

  // Only show export button if user is the poll creator AND in admin mode
  const createdPolls = JSON.parse(localStorage.getItem("createdPolls") || "[]");
  const isCreator = createdPolls.some(p => p.id === poll.id);

  // Show export button only for creator in admin mode and when there are responses
  if (isCreator && isAdminMode && poll.responses.length > 0) {
    exportBtn.classList.remove("hidden");
  }

  exportBtn.addEventListener("click", () => {
    exportToGoogleSheets(poll);
  });
}

function exportToGoogleSheets(poll) {
  // Generate CSV data compatible with Google Sheets
  const lines = [];
  
  // Header row
  const headers = ["Date", "Participant"];
  poll.instruments.forEach(instrument => {
    headers.push(instrument);
  });
  lines.push(headers.join("	"));
  
  // Data rows - one row per date per participant
  poll.dates.forEach(dateStr => {
    const formattedDate = formatDateDisplay(dateStr);
    
    poll.responses.forEach(response => {
      const availability = response.answers[dateStr];
      
      // Only include if participant is available (yes or ifneeded)
      if (availability === "yes" || availability === "ifneeded") {
        const row = [formattedDate, response.name];

        // Add checkmarks for each instrument (from upfront selection only)
        poll.instruments.forEach(instrument => {
          const hasInstrument = response.upfrontInstruments?.includes(instrument);
          row.push(hasInstrument ? "✓" : "");
        });

        lines.push(row.join("	"));
      }
    });
    
    // Empty row between dates for readability
    lines.push("");
  });
  
  // Create downloadable file
  const tsvContent = lines.join("\n");
  const blob = new Blob([tsvContent], { type: "text/tab-separated-values;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${poll.title.replace(/[^a-z0-9]/gi, "_")}_export.tsv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

