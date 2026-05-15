'use strict';

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const PORT = Number(process.env.PORT || 8105);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/bakos');
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-service:6379';
const SESSION_TIMEOUT = Number(process.env.SESSION_TIMEOUT || 10800);
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS || 3);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 12);
const ENABLE_SOCKET_REDIS_ADAPTER = String(process.env.ENABLE_SOCKET_REDIS_ADAPTER || 'false').toLowerCase() === 'true';

const PHASES = Object.freeze({
  LOBBY_OPEN: 'LOBBY_OPEN',
  WORD_ENTRY: 'WORD_ENTRY',
  DEFINITION_SUBMIT: 'DEFINITION_SUBMIT',
  VOTING: 'VOTING',
  SCORING_REVIEW: 'SCORING_REVIEW',
  ROUND_RESULT: 'ROUND_RESULT',
  PAUSED: 'PAUSED'
});

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  path: `${BASE_PATH}/socket.io`,
  cors: {
    origin: '*'
  }
});

let redis;
let redisReady = false;

function normalizeBasePath(value) {
  let result = String(value || '/').trim();
  if (!result.startsWith('/')) result = `/${result}`;
  if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

function sessionKey(sessionId) {
  return `bakos:session:${sessionId}`;
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function normalizeText(text, maxLength = 1200) {
  return String(text || '').trim().slice(0, maxLength);
}

function makePublicError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function getSession(sessionId) {
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) return null;
  return JSON.parse(raw);
}

async function saveSession(session, refreshTtl = false) {
  session.updatedAt = now();
  const key = sessionKey(session.sessionId);
  await redis.set(key, JSON.stringify(session));
  if (refreshTtl) {
    await redis.expire(key, SESSION_TIMEOUT);
  }
}

async function getTtl(sessionId) {
  const ttl = await redis.ttl(sessionKey(sessionId));
  return ttl > 0 ? ttl : 0;
}

async function generateSessionId() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const exists = await redis.exists(sessionKey(code));
    if (!exists) return code;
  }
  throw makePublicError('SESSION_ID_GENERATION_FAILED', 'Nem sikerült egyedi session kódot létrehozni. Próbáld újra.');
}

function getActivePlayers(session) {
  return session.players.filter((player) => player.active);
}

function getPlayer(session, playerId) {
  return session.players.find((player) => player.id === playerId);
}

function getPlayerName(session, playerId) {
  const player = getPlayer(session, playerId);
  return player ? player.name : 'Ismeretlen játékos';
}

function requireSession(session) {
  if (!session) throw makePublicError('SESSION_NOT_FOUND', 'Nem található ilyen session.');
}

function requireActivePlayer(session, playerId) {
  const player = getPlayer(session, playerId);
  if (!player || !player.active) {
    throw makePublicError('PLAYER_NOT_ACTIVE', 'Ez a játékos már nem aktív ebben a sessionben.');
  }
  return player;
}

function requirePhase(session, expectedPhase) {
  if (session.phase !== expectedPhase) {
    throw makePublicError('INVALID_PHASE', 'Ez a művelet most nem végezhető el.');
  }
}

function getCurrentRound(session) {
  if (!session.currentRound) {
    session.currentRound = createEmptyRound();
  }
  return session.currentRound;
}

function createEmptyRound() {
  return {
    word: '',
    definitions: [],
    shuffledDefinitionOrder: [],
    votes: [],
    nearCorrectDefinitionIds: [],
    roundScores: [],
    scored: false
  };
}

function hasMinimumActivePlayers(session) {
  return getActivePlayers(session).length >= MIN_PLAYERS;
}

function transferHostIfNeeded(session) {
  const host = getPlayer(session, session.hostPlayerId);
  if (host && host.active) return;
  const nextHost = getActivePlayers(session)[0];
  session.hostPlayerId = nextHost ? nextHost.id : null;
}

function pickFirstLeader(session) {
  const activePlayers = getActivePlayers(session);
  if (activePlayers.length === 0) return null;
  return activePlayers[0].id;
}

function pickNextLeader(session, previousLeaderId) {
  const activeIds = getActivePlayers(session).map((player) => player.id);
  if (activeIds.length === 0) return null;

  const order = session.roundOrder && session.roundOrder.length > 0
    ? session.roundOrder.filter((id) => activeIds.includes(id))
    : activeIds;

  if (order.length === 0) return activeIds[0];
  const previousIndex = order.indexOf(previousLeaderId);
  if (previousIndex === -1) return order[0];
  return order[(previousIndex + 1) % order.length];
}

function startFreshRound(session, leaderId, message = '') {
  session.currentRoundLeaderId = leaderId;
  session.currentRound = createEmptyRound();
  session.phase = PHASES.WORD_ENTRY;
  session.message = message;
}

function pauseIfTooFewPlayers(session) {
  if (hasMinimumActivePlayers(session)) return false;
  session.phase = PHASES.PAUSED;
  session.message = `A játék folytatásához legalább ${MIN_PLAYERS} aktív játékos szükséges.`;
  return true;
}

function checkAllDefinitionsSubmitted(session) {
  const round = getCurrentRound(session);
  const activeNonLeaders = getActivePlayers(session).filter((player) => player.id !== session.currentRoundLeaderId);
  const submittedPlayerIds = new Set(
    round.definitions
      .filter((definition) => definition.type === 'fake')
      .map((definition) => definition.playerId)
  );
  return activeNonLeaders.every((player) => submittedPlayerIds.has(player.id));
}

function checkAllVotesSubmitted(session) {
  const round = getCurrentRound(session);
  const activeNonLeaders = getActivePlayers(session).filter((player) => player.id !== session.currentRoundLeaderId);
  const voterIds = new Set(round.votes.map((vote) => vote.voterPlayerId));
  return activeNonLeaders.every((player) => voterIds.has(player.id));
}

function shuffleDefinitions(session) {
  const round = getCurrentRound(session);
  const ids = round.definitions.map((definition) => definition.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  round.shuffledDefinitionOrder = ids;
}

function maybeAdvanceAfterDefinitionChanges(session) {
  if (session.phase !== PHASES.DEFINITION_SUBMIT) return;
  if (!checkAllDefinitionsSubmitted(session)) return;
  shuffleDefinitions(session);
  session.phase = PHASES.VOTING;
  session.message = '';
}

function maybeAdvanceAfterVoteChanges(session) {
  if (session.phase !== PHASES.VOTING) return;
  if (!checkAllVotesSubmitted(session)) return;
  session.phase = PHASES.SCORING_REVIEW;
  session.message = '';
}

function removeOrLeavePlayer(session, targetPlayerId) {
  const target = getPlayer(session, targetPlayerId);
  if (!target || !target.active) return;
  target.active = false;
  target.connected = false;

  transferHostIfNeeded(session);

  if (session.phase === PHASES.LOBBY_OPEN) {
    return;
  }

  if (pauseIfTooFewPlayers(session)) {
    return;
  }

  if (targetPlayerId === session.currentRoundLeaderId) {
    const nextLeaderId = pickNextLeader(session, targetPlayerId);
    session.roundNumber += 1;
    startFreshRound(session, nextLeaderId, 'A körgazda kilépett vagy eltávolították. Új kör indul.');
    return;
  }

  maybeAdvanceAfterDefinitionChanges(session);
  maybeAdvanceAfterVoteChanges(session);
}

function definitionById(round, definitionId) {
  return round.definitions.find((definition) => definition.id === definitionId);
}

function countVotesByDefinition(round) {
  const counts = new Map();
  for (const vote of round.votes) {
    counts.set(vote.definitionId, (counts.get(vote.definitionId) || 0) + 1);
  }
  return counts;
}

function computeAndApplyScores(session) {
  const round = getCurrentRound(session);
  if (round.scored) return round.roundScores;

  const scoreDeltas = new Map();
  const reasons = new Map();

  function addScore(playerId, points, reason) {
    if (!playerId || points <= 0) return;
    scoreDeltas.set(playerId, (scoreDeltas.get(playerId) || 0) + points);
    if (!reasons.has(playerId)) reasons.set(playerId, []);
    reasons.get(playerId).push(reason);
  }

  for (const vote of round.votes) {
    const definition = definitionById(round, vote.definitionId);
    if (!definition) continue;

    if (definition.type === 'real') {
      addScore(vote.voterPlayerId, 1, 'Eltalálta az igazi definíciót');
    } else {
      addScore(definition.playerId, 1, `Valaki elhitte a definícióját: ${getPlayerName(session, vote.voterPlayerId)}`);
    }
  }

  for (const definitionId of round.nearCorrectDefinitionIds) {
    const definition = definitionById(round, definitionId);
    if (!definition || definition.type !== 'fake') continue;
    addScore(definition.playerId, 1, '(közel) jó válasz bónusz');
  }

  const roundScores = [];
  for (const [playerId, delta] of scoreDeltas.entries()) {
    const player = getPlayer(session, playerId);
    if (!player) continue;
    player.score += delta;
    roundScores.push({
      playerId,
      playerName: player.name,
      delta,
      reasons: reasons.get(playerId) || []
    });
  }

  round.roundScores = roundScores.sort((a, b) => b.delta - a.delta || a.playerName.localeCompare(b.playerName, 'hu'));
  round.scored = true;
  return round.roundScores;
}

function sanitizeSessionForPlayer(session, viewerPlayerId, ttl = 0) {
  const viewer = getPlayer(session, viewerPlayerId);
  const activePlayers = getActivePlayers(session);
  const round = session.currentRound || createEmptyRound();
  const leaderId = session.currentRoundLeaderId;
  const isLeader = viewerPlayerId === leaderId;
  const isHost = viewerPlayerId === session.hostPlayerId;

  const publicSession = {
    sessionId: session.sessionId,
    phase: session.phase,
    message: session.message || '',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresInSeconds: ttl,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    roundNumber: session.roundNumber,
    hostPlayerId: session.hostPlayerId,
    currentRoundLeaderId: leaderId,
    viewerPlayerId,
    viewerActive: Boolean(viewer && viewer.active),
    viewerIsHost: isHost,
    viewerIsLeader: isLeader,
    players: session.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      active: player.active,
      connected: player.connected,
      isHost: player.id === session.hostPlayerId,
      isCurrentRoundLeader: player.id === leaderId
    })),
    activePlayerCount: activePlayers.length,
    currentRound: {
      word: '',
      submitStatus: [],
      voteStatus: [],
      definitions: [],
      roundScores: []
    }
  };

  if ([PHASES.DEFINITION_SUBMIT, PHASES.VOTING, PHASES.SCORING_REVIEW, PHASES.ROUND_RESULT].includes(session.phase)) {
    publicSession.currentRound.word = round.word;
  }

  const activeNonLeaders = activePlayers.filter((player) => player.id !== leaderId);
  const fakeSubmitterIds = new Set(
    round.definitions.filter((definition) => definition.type === 'fake').map((definition) => definition.playerId)
  );
  publicSession.currentRound.submitStatus = activeNonLeaders.map((player) => ({
    playerId: player.id,
    name: player.name,
    submitted: fakeSubmitterIds.has(player.id)
  }));

  const voterIds = new Set(round.votes.map((vote) => vote.voterPlayerId));
  publicSession.currentRound.voteStatus = activeNonLeaders.map((player) => ({
    playerId: player.id,
    name: player.name,
    voted: voterIds.has(player.id)
  }));

  if (session.phase === PHASES.VOTING) {
    const alreadyVoted = round.votes.some((vote) => vote.voterPlayerId === viewerPlayerId);
    publicSession.currentRound.definitions = round.shuffledDefinitionOrder
      .map((definitionId) => definitionById(round, definitionId))
      .filter(Boolean)
      .map((definition) => {
        const isOwn = definition.type === 'fake' && definition.playerId === viewerPlayerId;
        return {
          id: definition.id,
          text: definition.text,
          isOwn,
          canVote: Boolean(viewer && viewer.active && !isLeader && !alreadyVoted && !isOwn)
        };
      });
  }

  if (session.phase === PHASES.SCORING_REVIEW && isLeader) {
    const voteCounts = countVotesByDefinition(round);
    publicSession.currentRound.definitions = round.shuffledDefinitionOrder
      .map((definitionId) => definitionById(round, definitionId))
      .filter(Boolean)
      .map((definition) => ({
        id: definition.id,
        text: definition.text,
        type: definition.type,
        authorPlayerId: definition.playerId,
        authorName: definition.type === 'real' ? 'Bakos / valódi definíció' : getPlayerName(session, definition.playerId),
        votesCount: voteCounts.get(definition.id) || 0,
        voters: round.votes
          .filter((vote) => vote.definitionId === definition.id)
          .map((vote) => getPlayerName(session, vote.voterPlayerId)),
        nearCorrect: round.nearCorrectDefinitionIds.includes(definition.id)
      }));
  }

  if (session.phase === PHASES.ROUND_RESULT) {
    const voteCounts = countVotesByDefinition(round);
    publicSession.currentRound.definitions = round.shuffledDefinitionOrder
      .map((definitionId) => definitionById(round, definitionId))
      .filter(Boolean)
      .map((definition) => ({
        id: definition.id,
        text: definition.text,
        type: definition.type,
        authorPlayerId: definition.playerId,
        authorName: definition.type === 'real' ? 'Bakos / valódi definíció' : getPlayerName(session, definition.playerId),
        votesCount: voteCounts.get(definition.id) || 0,
        voters: round.votes
          .filter((vote) => vote.definitionId === definition.id)
          .map((vote) => getPlayerName(session, vote.voterPlayerId)),
        nearCorrect: round.nearCorrectDefinitionIds.includes(definition.id)
      }));
    publicSession.currentRound.roundScores = round.roundScores || [];
  }

  return publicSession;
}

async function emitSessionToSocket(socket, session) {
  if (!session) return;
  const playerId = socket.data.playerId;
  if (!playerId) return;
  const ttl = await getTtl(session.sessionId);
  socket.emit('sessionUpdated', sanitizeSessionForPlayer(session, playerId, ttl));
}

async function broadcastSession(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return;
  const sockets = await io.in(`session:${sessionId}`).fetchSockets();
  await Promise.all(sockets.map((socket) => emitSessionToSocket(socket, session)));
}

function joinSocketToSession(socket, sessionId, playerId) {
  socket.join(`session:${sessionId}`);
  socket.data.sessionId = sessionId;
  socket.data.playerId = playerId;
}

async function withAction(socket, callback, action) {
  try {
    const result = await action();
    if (typeof callback === 'function') callback({ ok: true, ...result });
  } catch (err) {
    const code = err.code || 'UNKNOWN_ERROR';
    const message = err.message || 'Ismeretlen hiba történt.';
    socket.emit('actionError', { code, message });
    if (typeof callback === 'function') callback({ ok: false, code, message });
  }
}

io.on('connection', (socket) => {
  socket.on('createSession', (payload, callback) => withAction(socket, callback, async () => {
    const playerName = normalizeName(payload && payload.playerName);
    if (!playerName) throw makePublicError('INVALID_NAME', 'Adj meg egy játékosnevet.');

    const sessionId = await generateSessionId();
    const playerId = randomId('p');
    const createdAt = now();
    const session = {
      sessionId,
      createdAt,
      updatedAt: createdAt,
      phase: PHASES.LOBBY_OPEN,
      hostPlayerId: playerId,
      roundNumber: 0,
      currentRoundLeaderId: null,
      roundOrder: [],
      message: '',
      players: [{
        id: playerId,
        name: playerName,
        score: 0,
        active: true,
        connected: true,
        joinedAt: createdAt
      }],
      currentRound: createEmptyRound()
    };

    await saveSession(session, true);
    joinSocketToSession(socket, sessionId, playerId);
    await emitSessionToSocket(socket, session);
    return { sessionId, playerId };
  }));

  socket.on('joinSession', (payload, callback) => withAction(socket, callback, async () => {
    const sessionId = normalizeText(payload && payload.sessionId, 5);
    const playerName = normalizeName(payload && payload.playerName);
    if (!/^\d{5}$/.test(sessionId)) throw makePublicError('INVALID_SESSION_ID', 'Adj meg egy 5 számjegyű session kódot.');
    if (!playerName) throw makePublicError('INVALID_NAME', 'Adj meg egy játékosnevet.');

    const session = await getSession(sessionId);
    requireSession(session);
    if (session.phase !== PHASES.LOBBY_OPEN) {
      throw makePublicError('SESSION_ALREADY_STARTED', 'Ehhez a játékhoz már nem lehet csatlakozni.');
    }
    if (getActivePlayers(session).length >= MAX_PLAYERS) {
      throw makePublicError('SESSION_FULL', 'A session megtelt.');
    }
    const nameTaken = session.players.some((player) => player.active && player.name.toLocaleLowerCase('hu') === playerName.toLocaleLowerCase('hu'));
    if (nameTaken) {
      throw makePublicError('NAME_ALREADY_TAKEN', 'Ez a név már foglalt. Válassz másikat.');
    }

    const playerId = randomId('p');
    session.players.push({
      id: playerId,
      name: playerName,
      score: 0,
      active: true,
      connected: true,
      joinedAt: now()
    });
    await saveSession(session);
    joinSocketToSession(socket, sessionId, playerId);
    await broadcastSession(sessionId);
    return { sessionId, playerId };
  }));

  socket.on('rejoinSession', (payload, callback) => withAction(socket, callback, async () => {
    const sessionId = normalizeText(payload && payload.sessionId, 5);
    const playerId = String((payload && payload.playerId) || '');
    if (!/^\d{5}$/.test(sessionId)) throw makePublicError('INVALID_SESSION_ID', 'Hibás session kód.');

    const session = await getSession(sessionId);
    requireSession(session);
    const player = getPlayer(session, playerId);
    if (!player) throw makePublicError('PLAYER_NOT_FOUND', 'A játékos nem található ebben a sessionben.');
    if (!player.active) throw makePublicError('PLAYER_NOT_ACTIVE', 'Ez a játékos már nem aktív ebben a sessionben.');

    player.connected = true;
    await saveSession(session);
    joinSocketToSession(socket, sessionId, playerId);
    await broadcastSession(sessionId);
    return { sessionId, playerId };
  }));

  socket.on('startGame', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.LOBBY_OPEN);

    if (session.hostPlayerId !== playerId) {
      throw makePublicError('HOST_ONLY', 'A játékot csak a host indíthatja el.');
    }
    if (!hasMinimumActivePlayers(session)) {
      throw makePublicError('TOO_FEW_PLAYERS', `A játék indításához legalább ${MIN_PLAYERS} aktív játékos szükséges.`);
    }

    session.roundOrder = getActivePlayers(session).map((player) => player.id);
    session.roundNumber = 1;
    startFreshRound(session, pickFirstLeader(session), '');
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('submitWordAndRealDefinition', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.WORD_ENTRY);
    if (session.currentRoundLeaderId !== playerId) {
      throw makePublicError('LEADER_ONLY', 'Ezt a műveletet csak az aktuális körgazda végezheti el.');
    }

    const word = normalizeText(payload && payload.word, 100);
    const realDefinition = normalizeText(payload && payload.realDefinition, 1500);
    if (!word) throw makePublicError('WORD_REQUIRED', 'Add meg a szót.');
    if (!realDefinition) throw makePublicError('REAL_DEFINITION_REQUIRED', 'Add meg a valódi definíciót.');

    session.currentRound = createEmptyRound();
    session.currentRound.word = word;
    session.currentRound.definitions.push({
      id: 'def_real',
      playerId,
      text: realDefinition,
      type: 'real'
    });
    session.phase = PHASES.DEFINITION_SUBMIT;
    session.message = '';
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('submitFakeDefinition', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.DEFINITION_SUBMIT);
    if (session.currentRoundLeaderId === playerId) {
      throw makePublicError('LEADER_CANNOT_SUBMIT_FAKE', 'A körgazda nem ír kamu definíciót ebben a körben.');
    }

    const round = getCurrentRound(session);
    const alreadySubmitted = round.definitions.some((definition) => definition.type === 'fake' && definition.playerId === playerId);
    if (alreadySubmitted) throw makePublicError('ALREADY_SUBMITTED', 'Már beküldted a definíciódat.');

    let definition = normalizeText(payload && payload.definition, 1500);
    if (!definition) definition = '(üres válasz)';

    round.definitions.push({
      id: randomId('def'),
      playerId,
      text: definition,
      type: 'fake'
    });

    maybeAdvanceAfterDefinitionChanges(session);
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('submitVote', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    const definitionId = String((payload && payload.definitionId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.VOTING);
    if (session.currentRoundLeaderId === playerId) {
      throw makePublicError('LEADER_CANNOT_VOTE', 'A körgazda ebben a körben nem szavaz.');
    }

    const round = getCurrentRound(session);
    const existingVote = round.votes.some((vote) => vote.voterPlayerId === playerId);
    if (existingVote) throw makePublicError('ALREADY_VOTED', 'Már szavaztál ebben a körben.');

    const definition = definitionById(round, definitionId);
    if (!definition) throw makePublicError('DEFINITION_NOT_FOUND', 'Nem található ilyen definíció.');
    if (definition.type === 'fake' && definition.playerId === playerId) {
      throw makePublicError('CANNOT_VOTE_OWN_DEFINITION', 'Saját definíciódra nem szavazhatsz.');
    }

    round.votes.push({
      voterPlayerId: playerId,
      definitionId
    });

    maybeAdvanceAfterVoteChanges(session);
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('markNearCorrect', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    const definitionId = String((payload && payload.definitionId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.SCORING_REVIEW);
    if (session.currentRoundLeaderId !== playerId) {
      throw makePublicError('LEADER_ONLY', 'Ezt a műveletet csak az aktuális körgazda végezheti el.');
    }

    const round = getCurrentRound(session);
    const definition = definitionById(round, definitionId);
    if (!definition || definition.type !== 'fake') {
      throw makePublicError('INVALID_NEAR_CORRECT_TARGET', 'Csak játékos által írt definíció jelölhető közel jó válasznak.');
    }

    if (round.nearCorrectDefinitionIds.includes(definitionId)) {
      round.nearCorrectDefinitionIds = round.nearCorrectDefinitionIds.filter((id) => id !== definitionId);
    } else {
      round.nearCorrectDefinitionIds.push(definitionId);
    }

    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('finalizeScoring', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.SCORING_REVIEW);
    if (session.currentRoundLeaderId !== playerId) {
      throw makePublicError('LEADER_ONLY', 'Ezt a műveletet csak az aktuális körgazda végezheti el.');
    }

    computeAndApplyScores(session);
    session.phase = PHASES.ROUND_RESULT;
    session.message = '';
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('startNextRound', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);
    requirePhase(session, PHASES.ROUND_RESULT);
    if (session.currentRoundLeaderId !== playerId) {
      throw makePublicError('LEADER_ONLY', 'A következő kört az aktuális körgazda indíthatja.');
    }
    if (!hasMinimumActivePlayers(session)) {
      throw makePublicError('TOO_FEW_PLAYERS', `A játék folytatásához legalább ${MIN_PLAYERS} aktív játékos szükséges.`);
    }

    const nextLeaderId = pickNextLeader(session, session.currentRoundLeaderId);
    session.roundNumber += 1;
    startFreshRound(session, nextLeaderId, '');
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('leaveSession', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    const player = getPlayer(session, playerId);
    if (!player) throw makePublicError('PLAYER_NOT_FOUND', 'A játékos nem található ebben a sessionben.');

    removeOrLeavePlayer(session, playerId);
    await saveSession(session);
    socket.leave(`session:${session.sessionId}`);
    socket.data.sessionId = null;
    socket.data.playerId = null;
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('removePlayer', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const requesterPlayerId = String((payload && payload.requesterPlayerId) || '');
    const targetPlayerId = String((payload && payload.targetPlayerId) || '');
    requireActivePlayer(session, requesterPlayerId);
    if (requesterPlayerId === targetPlayerId) {
      throw makePublicError('USE_LEAVE_BUTTON', 'Saját kilépéshez használd a Kilépés gombot.');
    }
    const target = getPlayer(session, targetPlayerId);
    if (!target || !target.active) throw makePublicError('TARGET_NOT_ACTIVE', 'Ez a játékos már nem aktív.');

    removeOrLeavePlayer(session, targetPlayerId);
    await saveSession(session);
    await broadcastSession(session.sessionId);
    return {};
  }));

  socket.on('extendSession', (payload, callback) => withAction(socket, callback, async () => {
    const session = await getSession(normalizeText(payload && payload.sessionId, 5));
    requireSession(session);
    const playerId = String((payload && payload.playerId) || '');
    requireActivePlayer(session, playerId);

    await saveSession(session, true);
    const ttl = await getTtl(session.sessionId);
    await broadcastSession(session.sessionId);
    socket.emit('sessionExtended', { expiresInSeconds: ttl });
    return { expiresInSeconds: ttl };
  }));

  socket.on('disconnect', async () => {
    const { sessionId, playerId } = socket.data;
    if (!sessionId || !playerId) return;
    try {
      const session = await getSession(sessionId);
      if (!session) return;
      const player = getPlayer(session, playerId);
      if (player) {
        player.connected = false;
        await saveSession(session);
        await broadcastSession(sessionId);
      }
    } catch (err) {
      console.error('Disconnect handling failed:', err);
    }
  });
});

app.disable('x-powered-by');
app.use(express.json());

app.get('/health', async (req, res) => {
  res.status(redisReady ? 200 : 503).json({
    status: redisReady ? 'ok' : 'redis-not-ready',
    app: 'bakos-game'
  });
});

app.get('/', (req, res) => {
  res.redirect(`${BASE_PATH}/`);
});

app.use(BASE_PATH, express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

app.get(`${BASE_PATH}/session/:sessionId`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(`${BASE_PATH}/health`, async (req, res) => {
  res.status(redisReady ? 200 : 503).json({
    status: redisReady ? 'ok' : 'redis-not-ready',
    app: 'bakos-game'
  });
});

async function start() {
  redis = createClient({ url: REDIS_URL });
  redis.on('error', (err) => {
    redisReady = false;
    console.error('Redis error:', err);
  });
  redis.on('ready', () => {
    redisReady = true;
    console.log('Redis ready');
  });

  await redis.connect();

  if (ENABLE_SOCKET_REDIS_ADAPTER) {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter enabled');
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Bakos emlekverseny listening on port ${PORT}, base path ${BASE_PATH}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
