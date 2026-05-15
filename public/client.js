(() => {
  'use strict';

  const BASE_PATH = '/bakos';
  const STORAGE_KEY = 'bakos-game-session';
  const socket = io({ path: `${BASE_PATH}/socket.io` });

  const app = document.getElementById('app');
  const alertBox = document.getElementById('alertBox');
  const connectionStatus = document.getElementById('connectionStatus');

  let session = null;
  let playerId = null;
  let pending = false;

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function saveLocalSession(sessionId, id, playerName) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, playerId: id, playerName }));
  }

  function readLocalSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function clearLocalSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function setAlert(message) {
    if (!message) {
      alertBox.classList.add('hidden');
      alertBox.textContent = '';
      return;
    }
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');
    window.setTimeout(() => setAlert(''), 5500);
  }

  function setConnection(connected) {
    connectionStatus.textContent = connected ? 'Kapcsolódva' : 'Nincs kapcsolat';
    connectionStatus.classList.toggle('connected', connected);
    connectionStatus.classList.toggle('disconnected', !connected);
  }

  function pathSessionId() {
    const match = window.location.pathname.match(/\/bakos\/session\/(\d{5})/);
    return match ? match[1] : '';
  }

  function goToSession(sessionId) {
    window.history.replaceState({}, '', `${BASE_PATH}/session/${sessionId}`);
  }

  function goHome() {
    window.history.replaceState({}, '', `${BASE_PATH}/`);
  }

  function emitAction(eventName, payload, onOk) {
    if (pending) return;
    pending = true;
    socket.emit(eventName, payload, (response) => {
      pending = false;
      if (!response || !response.ok) {
        setAlert((response && response.message) || 'Nem sikerült végrehajtani a műveletet.');
        return;
      }
      if (typeof onOk === 'function') onOk(response);
    });
  }

  function activePlayers() {
    if (!session) return [];
    return session.players.filter((player) => player.active);
  }

  function viewer() {
    if (!session) return null;
    return session.players.find((player) => player.id === playerId) || null;
  }

  function leader() {
    if (!session) return null;
    return session.players.find((player) => player.id === session.currentRoundLeaderId) || null;
  }

  function formatTtl(seconds) {
    if (!seconds) return 'ismeretlen';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} óra ${m} perc`;
    return `${m} perc`;
  }

  function render() {
    if (!session) {
      renderHome();
      return;
    }

    const main = renderPhase();
    app.innerHTML = `
      <div class="grid main">
        <section class="grid">${main}</section>
        ${renderSidebar()}
      </div>
    `;
    bindCommonActions();
    bindPhaseActions();
  }

  function renderHome() {
    const sessionFromUrl = pathSessionId();
    app.innerHTML = `
      <div class="grid two">
        <section class="card">
          <h2>Új játék létrehozása</h2>
          <p class="muted">A létrehozó játékos lesz a host, aki a lobbyból elindítja a játékot.</p>
          <div class="form-row">
            <label for="createName"><strong>Neved</strong></label>
            <input id="createName" autocomplete="name" maxlength="32" placeholder="pl. Nick">
          </div>
          <button id="createBtn">Új session létrehozása</button>
        </section>

        <section class="card">
          <h2>Csatlakozás</h2>
          <p class="muted">Csak nyitott lobbyhoz lehet csatlakozni.</p>
          <div class="form-row">
            <label for="joinName"><strong>Neved</strong></label>
            <input id="joinName" autocomplete="name" maxlength="32" placeholder="pl. Anna">
          </div>
          <div class="form-row">
            <label for="joinCode"><strong>Session kód</strong></label>
            <input id="joinCode" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="48291" value="${escapeHtml(sessionFromUrl)}">
          </div>
          <button id="joinBtn">Csatlakozás</button>
        </section>
      </div>

      <section class="card soft" style="margin-top: 18px;">
        <h2>Rövid szabály</h2>
        <p>A körgazda megad egy ritka szót és a valódi definíciót. A többiek kamu definíciót írnak, majd mindenki megszavazza, melyik lehet az igazi. Pont jár a megtévesztő definícióért, a helyes szavazatért és a közel jó válaszért.</p>
      </section>
    `;

    document.getElementById('createBtn').addEventListener('click', () => {
      const name = document.getElementById('createName').value.trim();
      emitAction('createSession', { playerName: name }, (response) => {
        playerId = response.playerId;
        saveLocalSession(response.sessionId, response.playerId, name);
        goToSession(response.sessionId);
      });
    });

    document.getElementById('joinBtn').addEventListener('click', () => {
      const name = document.getElementById('joinName').value.trim();
      const sessionId = document.getElementById('joinCode').value.trim();
      emitAction('joinSession', { sessionId, playerName: name }, (response) => {
        playerId = response.playerId;
        saveLocalSession(response.sessionId, response.playerId, name);
        goToSession(response.sessionId);
      });
    });
  }

  function renderSidebar() {
    const players = [...session.players].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name, 'hu');
    });

    return `
      <aside class="card">
        <h2>Session</h2>
        <p><span class="session-code">${escapeHtml(session.sessionId)}</span></p>
        <div class="kpi-row">
          <span class="kpi">Kör: ${session.roundNumber || 0}</span>
          <span class="kpi">Lejárat: ${formatTtl(session.expiresInSeconds)}</span>
        </div>
        <div class="row-actions">
          <button class="secondary" id="extendBtn">Idő hosszabbítása</button>
          <button class="danger" id="leaveBtn">Kilépés</button>
        </div>
        <hr>
        <h3>Ponttábla</h3>
        <div class="player-list">
          ${players.map((player) => `
            <div class="player ${player.active ? '' : 'inactive'}">
              <div class="player-row">
                <div>
                  <div class="player-name">${escapeHtml(player.name)}</div>
                  <div class="small muted">
                    ${player.isHost ? 'Host · ' : ''}${player.isCurrentRoundLeader ? 'Körgazda · ' : ''}${player.connected ? 'online' : 'nincs kapcsolat'}${player.active ? '' : ' · kilépett'}
                  </div>
                </div>
                <strong>${player.score} pont</strong>
              </div>
              ${player.active && player.id !== playerId ? `<button class="secondary remove-player" data-player-id="${escapeHtml(player.id)}">Eltávolítás</button>` : ''}
            </div>
          `).join('')}
        </div>
      </aside>
    `;
  }

  function renderPhase() {
    const message = session.message ? `<section class="alert">${escapeHtml(session.message)}</section>` : '';
    switch (session.phase) {
      case 'LOBBY_OPEN':
        return `${message}${renderLobby()}`;
      case 'WORD_ENTRY':
        return `${message}${renderWordEntry()}`;
      case 'DEFINITION_SUBMIT':
        return `${message}${renderDefinitionSubmit()}`;
      case 'VOTING':
        return `${message}${renderVoting()}`;
      case 'SCORING_REVIEW':
        return `${message}${renderScoringReview()}`;
      case 'ROUND_RESULT':
        return `${message}${renderRoundResult()}`;
      case 'PAUSED':
        return `${message}<section class="card"><h2>A játék szünetel</h2><p class="muted">Nincs elég aktív játékos a folytatáshoz.</p></section>`;
      default:
        return `<section class="card"><h2>Ismeretlen állapot</h2><p>${escapeHtml(session.phase)}</p></section>`;
    }
  }

  function renderLobby() {
    const me = viewer();
    const canStart = session.viewerIsHost && activePlayers().length >= session.minPlayers;
    return `
      <section class="card">
        <h2>Lobby</h2>
        <p>A játékhoz legalább ${session.minPlayers}, legfeljebb ${session.maxPlayers} aktív játékos szükséges. Indítás után már nem lehet csatlakozni.</p>
        <div class="kpi-row">
          <span class="kpi">Aktív játékosok: ${session.activePlayerCount}/${session.maxPlayers}</span>
          <span class="kpi">Te: ${escapeHtml(me ? me.name : '')}</span>
        </div>
        ${session.viewerIsHost ? `
          <button id="startGameBtn" ${canStart ? '' : 'disabled'}>Játék indítása</button>
          ${canStart ? '' : `<p class="muted small">A játék indításához legalább ${session.minPlayers} aktív játékos kell.</p>`}
        ` : `<p class="muted">A host indítja a játékot, ha mindenki csatlakozott.</p>`}
      </section>
    `;
  }

  function renderWordEntry() {
    const currentLeader = leader();
    if (session.viewerIsLeader) {
      return `
        <section class="card">
          <h2>Te vagy a körgazda</h2>
          <p class="muted">Add meg a szót és a könyv szerinti valódi definíciót. A többiek csak a szót fogják látni.</p>
          <div class="form-row">
            <label for="wordInput"><strong>Szó</strong></label>
            <input id="wordInput" maxlength="100" placeholder="pl. absztraktum">
          </div>
          <div class="form-row">
            <label for="realDefinitionInput"><strong>Valódi definíció</strong></label>
            <textarea id="realDefinitionInput" maxlength="1500" placeholder="A Bakosban szereplő meghatározás..."></textarea>
          </div>
          <button id="submitWordBtn">Kör indítása</button>
        </section>
      `;
    }
    return `
      <section class="card">
        <h2>A körgazda készíti a feladványt</h2>
        <p class="muted">Aktuális körgazda: <strong>${escapeHtml(currentLeader ? currentLeader.name : 'ismeretlen')}</strong></p>
      </section>
    `;
  }

  function renderDefinitionSubmit() {
    const round = session.currentRound;
    const submittedByMe = round.submitStatus.some((item) => item.playerId === playerId && item.submitted);
    return `
      <section class="card">
        <h2>Definícióírás</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        ${session.viewerIsLeader ? `
          <p class="muted">Körgazdaként most nem írsz kamu definíciót. Várd meg, amíg minden aktív játékos beküldi a sajátját.</p>
        ` : submittedByMe ? `
          <p class="status-ok">Beküldted a definíciódat. Várakozás a többiekre...</p>
        ` : `
          <div class="form-row">
            <label for="fakeDefinitionInput"><strong>Szerinted mit jelenthet?</strong></label>
            <textarea id="fakeDefinitionInput" maxlength="1500" placeholder="Írj meggyőző, de lehetőleg vicces kamu definíciót..."></textarea>
          </div>
          <button id="submitFakeBtn">Definíció beküldése</button>
        `}
      </section>
      ${renderSubmitStatus(round.submitStatus)}
    `;
  }

  function renderSubmitStatus(status) {
    return `
      <section class="card soft">
        <h3>Beküldési státusz</h3>
        <div class="status-list">
          ${status.map((item) => `
            <div class="status-item">
              <div class="status-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="${item.submitted ? 'status-ok' : 'status-wait'}">${item.submitted ? 'beküldte' : 'még írja'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderVoteStatus(status) {
    return `
      <section class="card soft">
        <h3>Szavazási státusz</h3>
        <div class="status-list">
          ${status.map((item) => `
            <div class="status-item">
              <div class="status-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="${item.voted ? 'status-ok' : 'status-wait'}">${item.voted ? 'szavazott' : 'még gondolkodik'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderVoting() {
    const round = session.currentRound;
    return `
      <section class="card">
        <h2>Felolvasás és szavazás</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <p class="muted">A definíciók mindenkinek ugyanebben a sorrendben jelennek meg. A körgazda nem szavaz, saját válaszra nem lehet szavazni.</p>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card">
              <div class="definition-header">
                <strong>${index + 1}. definíció</strong>
                ${definition.isOwn ? '<span class="badge">saját válasz</span>' : ''}
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <div class="row-actions">
                <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">Felolvasás</button>
                ${definition.canVote ? `<button class="vote-btn" data-definition-id="${escapeHtml(definition.id)}">Erre szavazok</button>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
      ${renderVoteStatus(round.voteStatus)}
    `;
  }

  function renderScoringReview() {
    const currentLeader = leader();
    if (!session.viewerIsLeader) {
      return `
        <section class="card">
          <h2>Pontozás folyamatban</h2>
          <p class="muted">A körgazda áttekinti a szavazatokat és megjelölheti a közel jó válaszokat.</p>
          <p>Körgazda: <strong>${escapeHtml(currentLeader ? currentLeader.name : 'ismeretlen')}</strong></p>
        </section>
      `;
    }

    const round = session.currentRound;
    return `
      <section class="card">
        <h2>Körgazda pontozási nézet</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <p class="muted">Jelöld meg azokat a játékosválaszokat, amelyek gyakorlatilag vagy közel pontosan jók.</p>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card ${definition.type === 'real' ? 'real' : ''} ${definition.nearCorrect ? 'near' : ''}">
              <div class="definition-header">
                <strong>${index + 1}. definíció</strong>
                <span class="badge">${definition.votesCount} szavazat</span>
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <p class="small muted">Szerző: <strong>${escapeHtml(definition.authorName)}</strong></p>
              <p class="small muted">Szavazók: ${definition.voters.length ? escapeHtml(definition.voters.join(', ')) : 'senki'}</p>
              <div class="row-actions">
                <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">Felolvasás</button>
                ${definition.type === 'fake' ? `<button class="near-btn ${definition.nearCorrect ? 'success' : ''}" data-definition-id="${escapeHtml(definition.id)}">${definition.nearCorrect ? 'Közel jó visszavonása' : '(közel) jó válasz'}</button>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
        <hr>
        <button id="finalizeScoringBtn">Pontozás lezárása</button>
      </section>
    `;
  }

  function renderRoundResult() {
    const round = session.currentRound;
    return `
      <section class="card">
        <h2>Kör eredménye</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card ${definition.type === 'real' ? 'real' : ''} ${definition.nearCorrect ? 'near' : ''}">
              <div class="definition-header">
                <strong>${index + 1}. definíció</strong>
                <span class="badge">${definition.type === 'real' ? 'igazi' : `${definition.votesCount} szavazat`}</span>
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <p class="small muted">Szerző: <strong>${escapeHtml(definition.authorName)}</strong></p>
              <p class="small muted">Szavazók: ${definition.voters.length ? escapeHtml(definition.voters.join(', ')) : 'senki'}</p>
              ${definition.nearCorrect ? '<p class="status-ok">(közel) jó válasz bónusz</p>' : ''}
              <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">Felolvasás</button>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="card soft">
        <h3>Ebben a körben szerzett pontok</h3>
        ${round.roundScores.length ? `
          <div class="score-list">
            ${round.roundScores.map((score) => `
              <div class="score-item">
                <div class="score-row">
                  <strong>${escapeHtml(score.playerName)}</strong>
                  <strong>+${score.delta}</strong>
                </div>
                <div class="small muted">${escapeHtml((score.reasons || []).join(' · '))}</div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="muted">Ebben a körben senki nem szerzett pontot.</p>'}
        ${session.viewerIsLeader ? '<hr><button id="nextRoundBtn">Következő kör</button>' : '<p class="muted">A következő kört a körgazda indítja.</p>'}
      </section>
    `;
  }

  function bindCommonActions() {
    const extendBtn = document.getElementById('extendBtn');
    if (extendBtn) {
      extendBtn.addEventListener('click', () => {
        emitAction('extendSession', { sessionId: session.sessionId, playerId });
      });
    }

    const leaveBtn = document.getElementById('leaveBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        if (!confirm('Biztosan kilépsz a játékból?')) return;
        emitAction('leaveSession', { sessionId: session.sessionId, playerId }, () => {
          clearLocalSession();
          session = null;
          playerId = null;
          goHome();
          render();
        });
      });
    }

    document.querySelectorAll('.remove-player').forEach((button) => {
      button.addEventListener('click', () => {
        const targetPlayerId = button.dataset.playerId;
        const target = session.players.find((player) => player.id === targetPlayerId);
        if (!target) return;
        if (!confirm(`Biztosan eltávolítod ezt a játékost: ${target.name}?`)) return;
        emitAction('removePlayer', {
          sessionId: session.sessionId,
          requesterPlayerId: playerId,
          targetPlayerId
        });
      });
    });
  }

  function bindPhaseActions() {
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        emitAction('startGame', { sessionId: session.sessionId, playerId });
      });
    }

    const submitWordBtn = document.getElementById('submitWordBtn');
    if (submitWordBtn) {
      submitWordBtn.addEventListener('click', () => {
        emitAction('submitWordAndRealDefinition', {
          sessionId: session.sessionId,
          playerId,
          word: document.getElementById('wordInput').value,
          realDefinition: document.getElementById('realDefinitionInput').value
        });
      });
    }

    const submitFakeBtn = document.getElementById('submitFakeBtn');
    if (submitFakeBtn) {
      submitFakeBtn.addEventListener('click', () => {
        emitAction('submitFakeDefinition', {
          sessionId: session.sessionId,
          playerId,
          definition: document.getElementById('fakeDefinitionInput').value
        });
      });
    }

    document.querySelectorAll('.vote-btn').forEach((button) => {
      button.addEventListener('click', () => {
        emitAction('submitVote', {
          sessionId: session.sessionId,
          playerId,
          definitionId: button.dataset.definitionId
        });
      });
    });

    document.querySelectorAll('.near-btn').forEach((button) => {
      button.addEventListener('click', () => {
        emitAction('markNearCorrect', {
          sessionId: session.sessionId,
          playerId,
          definitionId: button.dataset.definitionId
        });
      });
    });

    const finalizeScoringBtn = document.getElementById('finalizeScoringBtn');
    if (finalizeScoringBtn) {
      finalizeScoringBtn.addEventListener('click', () => {
        emitAction('finalizeScoring', { sessionId: session.sessionId, playerId });
      });
    }

    const nextRoundBtn = document.getElementById('nextRoundBtn');
    if (nextRoundBtn) {
      nextRoundBtn.addEventListener('click', () => {
        emitAction('startNextRound', { sessionId: session.sessionId, playerId });
      });
    }

    document.querySelectorAll('.speak-btn').forEach((button) => {
      button.addEventListener('click', () => speak(button.dataset.text || ''));
    });
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) {
      setAlert('A böngésződ nem támogatja a felolvasást.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hu-HU';
    const voices = window.speechSynthesis.getVoices();
    const huVoice = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith('hu'));
    if (huVoice) utterance.voice = huVoice;
    window.speechSynthesis.speak(utterance);
  }

  socket.on('connect', () => {
    setConnection(true);
    const local = readLocalSession();
    const urlSession = pathSessionId();
    if (local && local.sessionId && local.playerId && (!urlSession || urlSession === local.sessionId)) {
      playerId = local.playerId;
      emitAction('rejoinSession', { sessionId: local.sessionId, playerId: local.playerId }, () => {
        goToSession(local.sessionId);
      });
    } else {
      render();
    }
  });

  socket.on('disconnect', () => {
    setConnection(false);
  });

  socket.on('sessionUpdated', (nextSession) => {
    if (!nextSession.viewerActive) {
      clearLocalSession();
      session = null;
      playerId = null;
      goHome();
      setAlert('Kiléptél vagy eltávolítottak ebből a játékból.');
      render();
      return;
    }

    session = nextSession;
    playerId = nextSession.viewerPlayerId;
    goToSession(nextSession.sessionId);
    render();
  });

  socket.on('actionError', (err) => {
    setAlert((err && err.message) || 'Hiba történt.');
  });

  socket.on('sessionExtended', () => {
    setAlert('A session ideje újra 3 órára lett hosszabbítva.');
  });

  render();
})();
