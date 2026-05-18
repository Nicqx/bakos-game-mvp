(() => {
  'use strict';

  const BASE_PATH = '/bakos';
  const STORAGE_KEY = 'bakos-game-session';
  const LANGUAGE_STORAGE_KEY = 'bakos-game-language';
  const socket = io({ path: `${BASE_PATH}/socket.io` });

  const app = document.getElementById('app');
  const alertBox = document.getElementById('alertBox');
  const connectionStatus = document.getElementById('connectionStatus');
  const languageSelect = document.getElementById('languageSelect');
  const languageLabel = document.getElementById('languageLabel');
  const heroEyebrow = document.getElementById('heroEyebrow');
  const heroTitle = document.getElementById('heroTitle');
  const heroLead = document.getElementById('heroLead');

  const DEFAULT_LANGUAGE = 'hu';
  const LANGUAGE_NAMES = {
    hu: 'Magyar',
    en: 'English',
    de: 'Deutsch'
  };
  const SPEECH_LOCALES = {
    hu: 'hu-HU',
    en: 'en-US',
    de: 'de-DE'
  };

  const TRANSLATIONS = {
    hu: {
      appTitle: 'Bakos emlékverseny',
      eyebrow: 'Kubernetes társasjáték',
      lead: 'Kamu definíciók, valódi idegen szavak és sok nevetés — papírkeverés nélkül.',
      language: 'Felület nyelve',
      connecting: 'Kapcsolódás...',
      connected: 'Kapcsolódva',
      disconnected: 'Nincs kapcsolat',
      actionFailed: 'Nem sikerült végrehajtani a műveletet.',
      errorOccurred: 'Hiba történt.',
      unknown: 'ismeretlen',
      lessThanMinute: 'kevesebb mint 1 perc',
      hourMinute: '{hours} óra {minutes} perc',
      minutes: '{minutes} perc',
      createGameTitle: 'Új játék létrehozása',
      createGameHelp: 'A létrehozó játékos lesz a host, aki a lobbyból elindítja a játékot.',
      yourName: 'Neved',
      createNamePlaceholder: 'pl. Nick',
      joinNamePlaceholder: 'pl. Anna',
      createSession: 'Új session létrehozása',
      joinTitle: 'Csatlakozás',
      joinHelp: 'Csak nyitott lobbyhoz lehet csatlakozni.',
      sessionCode: 'Session kód',
      join: 'Csatlakozás',
      shortRulesTitle: 'Rövid szabály',
      shortRulesText: 'A körgazda megad egy ritka szót és a valódi definíciót. A többiek kamu definíciót írnak, majd mindenki megszavazza, melyik lehet az igazi. Pont jár a megtévesztő definícióért, a helyes szavazatért és a közel jó válaszért.',
      session: 'Session',
      round: 'Kör',
      timeRemaining: 'Hátralévő idő',
      extendSession: 'Idő hosszabbítása',
      leave: 'Kilépés',
      scoreboard: 'Ponttábla',
      hostLabel: 'Host',
      roundLeaderLabel: 'Körgazda',
      online: 'online',
      offline: 'nincs kapcsolat',
      leftGame: 'kilépett',
      points: '{points} pont',
      remove: 'Eltávolítás',
      lobbyTitle: 'Lobby',
      lobbyHelp: 'A játékhoz legalább {min}, legfeljebb {max} aktív játékos szükséges. Indítás után már nem lehet csatlakozni.',
      activePlayers: 'Aktív játékosok',
      you: 'Te',
      startGame: 'Játék indítása',
      minPlayersToStart: 'A játék indításához legalább {min} aktív játékos kell.',
      hostStarts: 'A host indítja a játékot, ha mindenki csatlakozott.',
      wordEntryLeaderTitle: 'Te vagy a körgazda',
      wordEntryLeaderHelp: 'Add meg a szót és a könyv szerinti valódi definíciót. A többiek csak a szót fogják látni.',
      word: 'Szó',
      wordPlaceholder: 'pl. absztraktum',
      realDefinition: 'Valódi definíció',
      realDefinitionPlaceholder: 'A Bakosban szereplő meghatározás...',
      startRound: 'Kör indítása',
      wordEntryWaitingTitle: 'A körgazda készíti a feladványt',
      currentRoundLeader: 'Aktuális körgazda',
      definitionWritingTitle: 'Definícióírás',
      leaderWaitFake: 'Körgazdaként most nem írsz kamu definíciót. Várd meg, amíg minden aktív játékos beküldi a sajátját.',
      submittedDefinition: 'Beküldted a definíciódat. Várakozás a többiekre...',
      whatMeans: 'Szerinted mit jelenthet?',
      fakeDefinitionPlaceholder: 'Írj meggyőző, de lehetőleg vicces kamu definíciót...',
      submitDefinition: 'Definíció beküldése',
      submitStatus: 'Beküldési státusz',
      submitted: 'beküldte',
      stillWriting: 'még írja',
      voteStatus: 'Szavazási státusz',
      voted: 'szavazott',
      stillThinking: 'még gondolkodik',
      votingTitle: 'Felolvasás és szavazás',
      votingHelp: 'A definíciók mindenkinek ugyanebben a sorrendben jelennek meg. A körgazda nem szavaz, saját válaszra nem lehet szavazni.',
      definitionNumber: '{number}. definíció',
      ownAnswer: 'saját válasz',
      speak: 'Felolvasás',
      voteThis: 'Erre szavazok',
      scoringInProgressTitle: 'Pontozás folyamatban',
      scoringInProgressHelp: 'A körgazda áttekinti a szavazatokat és megjelölheti a közel jó válaszokat.',
      scoringLeaderViewTitle: 'Körgazda pontozási nézet',
      scoringLeaderViewHelp: 'Jelöld meg azokat a játékosválaszokat, amelyek gyakorlatilag vagy közel pontosan jók.',
      votesCount: '{count} szavazat',
      author: 'Szerző',
      realDefinitionAuthor: 'Bakos / valódi definíció',
      voters: 'Szavazók',
      nobody: 'senki',
      nearCorrectUndo: 'Közel jó visszavonása',
      nearCorrect: '(közel) jó válasz',
      finalizeScoring: 'Pontozás lezárása',
      roundResult: 'Kör eredménye',
      real: 'igazi',
      nearCorrectBonus: '(közel) jó válasz bónusz',
      roundScoresTitle: 'Ebben a körben szerzett pontok',
      plusPoints: '+{points}',
      noPointsRound: 'Ebben a körben senki nem szerzett pontot.',
      nextRound: 'Következő kör',
      leaderStartsNext: 'A következő kört a körgazda indítja.',
      gamePausedTitle: 'A játék szünetel',
      gamePausedText: 'Nincs elég aktív játékos a folytatáshoz.',
      unknownState: 'Ismeretlen állapot',
      confirmLeave: 'Biztosan kilépsz a játékból?',
      removedFromGame: 'Kiléptél vagy eltávolítottak ebből a játékból.',
      confirmRemove: 'Biztosan eltávolítod ezt a játékost: {name}?',
      browserNoTts: 'A böngésződ nem támogatja a felolvasást.',
      sessionExtended: 'A session ideje újra 3 órára lett hosszabbítva.',
      serverMessageTooFew: 'A játék folytatásához legalább {min} aktív játékos szükséges.',
      serverMessageLeaderRemoved: 'A körgazda kilépett vagy eltávolították. Új kör indul.',
      reasonRealVote: 'Eltalálta az igazi definíciót',
      reasonBelieved: 'Valaki elhitte a definícióját: {name}',
      reasonNearCorrect: '(közel) jó válasz bónusz',
      emptyAnswer: '(üres válasz)',
      error_SESSION_ID_GENERATION_FAILED: 'Nem sikerült egyedi session kódot létrehozni. Próbáld újra.',
      error_SESSION_NOT_FOUND: 'Nem található ilyen session.',
      error_PLAYER_NOT_ACTIVE: 'Ez a játékos már nem aktív ebben a sessionben.',
      error_PLAYER_NOT_FOUND: 'A játékos nem található ebben a sessionben.',
      error_INVALID_SESSION_ID: 'Hibás session kód.',
      error_INVALID_NAME: 'Adj meg egy játékosnevet.',
      error_NAME_REQUIRED: 'Add meg a neved.',
      error_SESSION_ALREADY_STARTED: 'Ehhez a játékhoz már nem lehet csatlakozni.',
      error_SESSION_FULL: 'A session megtelt.',
      error_NAME_ALREADY_TAKEN: 'Ez a név már foglalt. Válassz másikat.',
      error_HOST_ONLY: 'A játékot csak a host indíthatja el.',
      error_TOO_FEW_PLAYERS: 'A játék indításához legalább 3 aktív játékos szükséges.',
      error_INVALID_PHASE: 'Ez a művelet ebben a játékállapotban nem végezhető el.',
      error_LEADER_ONLY: 'Ezt a műveletet csak az aktuális körgazda végezheti el.',
      error_WORD_REQUIRED: 'Add meg a szót.',
      error_REAL_DEFINITION_REQUIRED: 'Add meg a valódi definíciót.',
      error_LEADER_CANNOT_SUBMIT_FAKE: 'A körgazda nem ír kamu definíciót ebben a körben.',
      error_ALREADY_SUBMITTED: 'Már beküldted a definíciódat.',
      error_LEADER_CANNOT_VOTE: 'A körgazda ebben a körben nem szavaz.',
      error_ALREADY_VOTED: 'Már szavaztál ebben a körben.',
      error_DEFINITION_NOT_FOUND: 'Nem található ilyen definíció.',
      error_CANNOT_VOTE_OWN_DEFINITION: 'Saját definíciódra nem szavazhatsz.',
      error_INVALID_NEAR_CORRECT_TARGET: 'Csak játékos által írt definíció jelölhető közel jó válasznak.',
      error_USE_LEAVE_BUTTON: 'Saját kilépéshez használd a Kilépés gombot.',
      error_TARGET_NOT_ACTIVE: 'Ez a játékos már nem aktív.'
    },
    en: {
      appTitle: 'Bakos Memorial Game',
      eyebrow: 'Kubernetes party game',
      lead: 'Fake definitions, real obscure words, and a lot of laughter — without shuffling paper.',
      language: 'Interface language',
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected',
      actionFailed: 'The action could not be completed.',
      errorOccurred: 'An error occurred.',
      unknown: 'unknown',
      lessThanMinute: 'less than 1 minute',
      hourMinute: '{hours} h {minutes} min',
      minutes: '{minutes} min',
      createGameTitle: 'Create new game',
      createGameHelp: 'The creator becomes the host and starts the game from the lobby.',
      yourName: 'Your name',
      createNamePlaceholder: 'e.g. Nick',
      joinNamePlaceholder: 'e.g. Anna',
      createSession: 'Create new session',
      joinTitle: 'Join',
      joinHelp: 'You can only join an open lobby.',
      sessionCode: 'Session code',
      join: 'Join',
      shortRulesTitle: 'Short rules',
      shortRulesText: 'The round leader enters an obscure word and the real definition. Everyone else writes a fake definition, then votes for the one they think is real. Points are awarded for convincing fake definitions, correct votes, and near-correct answers.',
      session: 'Session',
      round: 'Round',
      timeRemaining: 'Time remaining',
      extendSession: 'Extend session',
      leave: 'Leave',
      scoreboard: 'Scoreboard',
      hostLabel: 'Host',
      roundLeaderLabel: 'Round leader',
      online: 'online',
      offline: 'offline',
      leftGame: 'left',
      points: '{points} pts',
      remove: 'Remove',
      lobbyTitle: 'Lobby',
      lobbyHelp: 'The game needs at least {min} and at most {max} active players. After the game starts, nobody else can join.',
      activePlayers: 'Active players',
      you: 'You',
      startGame: 'Start game',
      minPlayersToStart: 'At least {min} active players are needed to start.',
      hostStarts: 'The host starts the game when everyone has joined.',
      wordEntryLeaderTitle: 'You are the round leader',
      wordEntryLeaderHelp: 'Enter the word and the real dictionary definition. The others will only see the word.',
      word: 'Word',
      wordPlaceholder: 'e.g. abstractum',
      realDefinition: 'Real definition',
      realDefinitionPlaceholder: 'The real dictionary definition...',
      startRound: 'Start round',
      wordEntryWaitingTitle: 'The round leader is preparing the challenge',
      currentRoundLeader: 'Current round leader',
      definitionWritingTitle: 'Write a definition',
      leaderWaitFake: 'As the round leader, you do not write a fake definition. Wait until every active player submits theirs.',
      submittedDefinition: 'You submitted your definition. Waiting for the others...',
      whatMeans: 'What do you think it means?',
      fakeDefinitionPlaceholder: 'Write a convincing, preferably funny fake definition...',
      submitDefinition: 'Submit definition',
      submitStatus: 'Submission status',
      submitted: 'submitted',
      stillWriting: 'still writing',
      voteStatus: 'Voting status',
      voted: 'voted',
      stillThinking: 'still thinking',
      votingTitle: 'Read aloud and vote',
      votingHelp: 'Everyone sees the definitions in the same order. The round leader does not vote, and you cannot vote for your own answer.',
      definitionNumber: 'Definition {number}',
      ownAnswer: 'your answer',
      speak: 'Read aloud',
      voteThis: 'Vote for this',
      scoringInProgressTitle: 'Scoring in progress',
      scoringInProgressHelp: 'The round leader reviews the votes and may mark near-correct answers.',
      scoringLeaderViewTitle: 'Round leader scoring view',
      scoringLeaderViewHelp: 'Mark player answers that are practically correct or close enough.',
      votesCount: '{count} votes',
      author: 'Author',
      realDefinitionAuthor: 'Bakos / real definition',
      voters: 'Voters',
      nobody: 'nobody',
      nearCorrectUndo: 'Undo near-correct',
      nearCorrect: 'Near-correct answer',
      finalizeScoring: 'Finalize scoring',
      roundResult: 'Round result',
      real: 'real',
      nearCorrectBonus: 'near-correct answer bonus',
      roundScoresTitle: 'Points earned this round',
      plusPoints: '+{points}',
      noPointsRound: 'Nobody earned points this round.',
      nextRound: 'Next round',
      leaderStartsNext: 'The round leader starts the next round.',
      gamePausedTitle: 'Game paused',
      gamePausedText: 'There are not enough active players to continue.',
      unknownState: 'Unknown state',
      confirmLeave: 'Are you sure you want to leave the game?',
      removedFromGame: 'You left or were removed from this game.',
      confirmRemove: 'Are you sure you want to remove this player: {name}?',
      browserNoTts: 'Your browser does not support text-to-speech.',
      sessionExtended: 'The session time has been extended to 3 hours again.',
      serverMessageTooFew: 'At least {min} active players are needed to continue.',
      serverMessageLeaderRemoved: 'The round leader left or was removed. A new round is starting.',
      reasonRealVote: 'Voted for the real definition',
      reasonBelieved: 'Someone believed their definition: {name}',
      reasonNearCorrect: 'near-correct answer bonus',
      emptyAnswer: '(empty answer)',
      error_SESSION_ID_GENERATION_FAILED: 'Could not generate a unique session code. Try again.',
      error_SESSION_NOT_FOUND: 'No such session was found.',
      error_PLAYER_NOT_ACTIVE: 'This player is no longer active in this session.',
      error_PLAYER_NOT_FOUND: 'The player was not found in this session.',
      error_INVALID_SESSION_ID: 'Invalid session code.',
      error_INVALID_NAME: 'Enter a player name.',
      error_NAME_REQUIRED: 'Enter your name.',
      error_SESSION_ALREADY_STARTED: 'This game has already started; joining is closed.',
      error_SESSION_FULL: 'The session is full.',
      error_NAME_ALREADY_TAKEN: 'This name is already taken. Choose another one.',
      error_HOST_ONLY: 'Only the host can start the game.',
      error_TOO_FEW_PLAYERS: 'At least 3 active players are required to start the game.',
      error_INVALID_PHASE: 'This action cannot be performed in the current game state.',
      error_LEADER_ONLY: 'Only the current round leader can do this.',
      error_WORD_REQUIRED: 'Enter the word.',
      error_REAL_DEFINITION_REQUIRED: 'Enter the real definition.',
      error_LEADER_CANNOT_SUBMIT_FAKE: 'The round leader does not write a fake definition this round.',
      error_ALREADY_SUBMITTED: 'You have already submitted your definition.',
      error_LEADER_CANNOT_VOTE: 'The round leader does not vote this round.',
      error_ALREADY_VOTED: 'You have already voted this round.',
      error_DEFINITION_NOT_FOUND: 'No such definition was found.',
      error_CANNOT_VOTE_OWN_DEFINITION: 'You cannot vote for your own definition.',
      error_INVALID_NEAR_CORRECT_TARGET: 'Only a player-written definition can be marked as near-correct.',
      error_USE_LEAVE_BUTTON: 'Use the Leave button to leave yourself.',
      error_TARGET_NOT_ACTIVE: 'This player is no longer active.'
    },
    de: {
      appTitle: 'Bakos-Gedenkspiel',
      eyebrow: 'Kubernetes-Gesellschaftsspiel',
      lead: 'Falsche Definitionen, echte Fremdwörter und viel Gelächter — ohne Papiermischen.',
      language: 'Sprache der Oberfläche',
      connecting: 'Verbindung wird hergestellt...',
      connected: 'Verbunden',
      disconnected: 'Keine Verbindung',
      actionFailed: 'Die Aktion konnte nicht ausgeführt werden.',
      errorOccurred: 'Ein Fehler ist aufgetreten.',
      unknown: 'unbekannt',
      lessThanMinute: 'weniger als 1 Minute',
      hourMinute: '{hours} Std. {minutes} Min.',
      minutes: '{minutes} Min.',
      createGameTitle: 'Neues Spiel erstellen',
      createGameHelp: 'Der Ersteller ist der Host und startet das Spiel aus der Lobby.',
      yourName: 'Dein Name',
      createNamePlaceholder: 'z. B. Nick',
      joinNamePlaceholder: 'z. B. Anna',
      createSession: 'Neue Session erstellen',
      joinTitle: 'Beitreten',
      joinHelp: 'Du kannst nur einer offenen Lobby beitreten.',
      sessionCode: 'Session-Code',
      join: 'Beitreten',
      shortRulesTitle: 'Kurzregeln',
      shortRulesText: 'Der Rundeleiter gibt ein seltenes Wort und die echte Definition ein. Alle anderen schreiben eine falsche Definition und stimmen dann ab, welche echt sein könnte. Punkte gibt es für überzeugende falsche Definitionen, richtige Stimmen und fast richtige Antworten.',
      session: 'Session',
      round: 'Runde',
      timeRemaining: 'Verbleibende Zeit',
      extendSession: 'Session verlängern',
      leave: 'Verlassen',
      scoreboard: 'Punktestand',
      hostLabel: 'Host',
      roundLeaderLabel: 'Rundeleiter',
      online: 'online',
      offline: 'offline',
      leftGame: 'verlassen',
      points: '{points} Punkte',
      remove: 'Entfernen',
      lobbyTitle: 'Lobby',
      lobbyHelp: 'Das Spiel benötigt mindestens {min} und höchstens {max} aktive Spieler. Nach dem Start kann niemand mehr beitreten.',
      activePlayers: 'Aktive Spieler',
      you: 'Du',
      startGame: 'Spiel starten',
      minPlayersToStart: 'Zum Starten sind mindestens {min} aktive Spieler nötig.',
      hostStarts: 'Der Host startet das Spiel, wenn alle beigetreten sind.',
      wordEntryLeaderTitle: 'Du bist der Rundeleiter',
      wordEntryLeaderHelp: 'Gib das Wort und die echte Wörterbuchdefinition ein. Die anderen sehen nur das Wort.',
      word: 'Wort',
      wordPlaceholder: 'z. B. Abstraktum',
      realDefinition: 'Echte Definition',
      realDefinitionPlaceholder: 'Die echte Wörterbuchdefinition...',
      startRound: 'Runde starten',
      wordEntryWaitingTitle: 'Der Rundeleiter bereitet die Aufgabe vor',
      currentRoundLeader: 'Aktueller Rundeleiter',
      definitionWritingTitle: 'Definition schreiben',
      leaderWaitFake: 'Als Rundeleiter schreibst du keine falsche Definition. Warte, bis alle aktiven Spieler ihre Antwort abgeschickt haben.',
      submittedDefinition: 'Du hast deine Definition abgeschickt. Warten auf die anderen...',
      whatMeans: 'Was könnte es bedeuten?',
      fakeDefinitionPlaceholder: 'Schreibe eine überzeugende, möglichst lustige falsche Definition...',
      submitDefinition: 'Definition abschicken',
      submitStatus: 'Abgabestatus',
      submitted: 'abgeschickt',
      stillWriting: 'schreibt noch',
      voteStatus: 'Abstimmungsstatus',
      voted: 'abgestimmt',
      stillThinking: 'denkt noch nach',
      votingTitle: 'Vorlesen und abstimmen',
      votingHelp: 'Alle sehen die Definitionen in derselben Reihenfolge. Der Rundeleiter stimmt nicht ab, und du kannst nicht für deine eigene Antwort stimmen.',
      definitionNumber: 'Definition {number}',
      ownAnswer: 'eigene Antwort',
      speak: 'Vorlesen',
      voteThis: 'Dafür stimmen',
      scoringInProgressTitle: 'Auswertung läuft',
      scoringInProgressHelp: 'Der Rundeleiter prüft die Stimmen und kann fast richtige Antworten markieren.',
      scoringLeaderViewTitle: 'Auswertungsansicht des Rundeleiters',
      scoringLeaderViewHelp: 'Markiere Antworten, die praktisch richtig oder nahe genug sind.',
      votesCount: '{count} Stimmen',
      author: 'Autor',
      realDefinitionAuthor: 'Bakos / echte Definition',
      voters: 'Stimmen von',
      nobody: 'niemand',
      nearCorrectUndo: 'Fast richtig zurücknehmen',
      nearCorrect: 'Fast richtige Antwort',
      finalizeScoring: 'Auswertung abschließen',
      roundResult: 'Rundenergebnis',
      real: 'echt',
      nearCorrectBonus: 'Bonus für fast richtige Antwort',
      roundScoresTitle: 'Punkte in dieser Runde',
      plusPoints: '+{points}',
      noPointsRound: 'In dieser Runde hat niemand Punkte bekommen.',
      nextRound: 'Nächste Runde',
      leaderStartsNext: 'Der Rundeleiter startet die nächste Runde.',
      gamePausedTitle: 'Spiel pausiert',
      gamePausedText: 'Es gibt nicht genug aktive Spieler, um fortzufahren.',
      unknownState: 'Unbekannter Status',
      confirmLeave: 'Möchtest du das Spiel wirklich verlassen?',
      removedFromGame: 'Du hast das Spiel verlassen oder wurdest entfernt.',
      confirmRemove: 'Diesen Spieler wirklich entfernen: {name}?',
      browserNoTts: 'Dein Browser unterstützt keine Sprachausgabe.',
      sessionExtended: 'Die Session-Zeit wurde wieder auf 3 Stunden verlängert.',
      serverMessageTooFew: 'Zum Fortfahren sind mindestens {min} aktive Spieler nötig.',
      serverMessageLeaderRemoved: 'Der Rundeleiter hat das Spiel verlassen oder wurde entfernt. Eine neue Runde beginnt.',
      reasonRealVote: 'Hat für die echte Definition gestimmt',
      reasonBelieved: 'Jemand hat die Definition geglaubt: {name}',
      reasonNearCorrect: 'Bonus für fast richtige Antwort',
      emptyAnswer: '(leere Antwort)',
      error_SESSION_ID_GENERATION_FAILED: 'Es konnte kein eindeutiger Session-Code erzeugt werden. Bitte erneut versuchen.',
      error_SESSION_NOT_FOUND: 'Diese Session wurde nicht gefunden.',
      error_PLAYER_NOT_ACTIVE: 'Dieser Spieler ist in dieser Session nicht mehr aktiv.',
      error_PLAYER_NOT_FOUND: 'Der Spieler wurde in dieser Session nicht gefunden.',
      error_INVALID_SESSION_ID: 'Ungültiger Session-Code.',
      error_INVALID_NAME: 'Gib einen Spielernamen ein.',
      error_NAME_REQUIRED: 'Gib deinen Namen ein.',
      error_SESSION_ALREADY_STARTED: 'Dieses Spiel hat bereits begonnen; Beitritt ist geschlossen.',
      error_SESSION_FULL: 'Die Session ist voll.',
      error_NAME_ALREADY_TAKEN: 'Dieser Name ist bereits vergeben. Wähle einen anderen.',
      error_HOST_ONLY: 'Nur der Host kann das Spiel starten.',
      error_TOO_FEW_PLAYERS: 'Zum Starten sind mindestens 3 aktive Spieler nötig.',
      error_INVALID_PHASE: 'Diese Aktion ist im aktuellen Spielstatus nicht möglich.',
      error_LEADER_ONLY: 'Das kann nur der aktuelle Rundeleiter tun.',
      error_WORD_REQUIRED: 'Gib das Wort ein.',
      error_REAL_DEFINITION_REQUIRED: 'Gib die echte Definition ein.',
      error_LEADER_CANNOT_SUBMIT_FAKE: 'Der Rundeleiter schreibt in dieser Runde keine falsche Definition.',
      error_ALREADY_SUBMITTED: 'Du hast deine Definition bereits abgeschickt.',
      error_LEADER_CANNOT_VOTE: 'Der Rundeleiter stimmt in dieser Runde nicht ab.',
      error_ALREADY_VOTED: 'Du hast in dieser Runde bereits abgestimmt.',
      error_DEFINITION_NOT_FOUND: 'Diese Definition wurde nicht gefunden.',
      error_CANNOT_VOTE_OWN_DEFINITION: 'Du kannst nicht für deine eigene Definition stimmen.',
      error_INVALID_NEAR_CORRECT_TARGET: 'Nur eine von Spielern geschriebene Definition kann als fast richtig markiert werden.',
      error_USE_LEAVE_BUTTON: 'Benutze zum eigenen Verlassen die Schaltfläche Verlassen.',
      error_TARGET_NOT_ACTIVE: 'Dieser Spieler ist nicht mehr aktiv.'
    }
  };

  let currentLanguage = readLanguage();
  let session = null;
  let playerId = null;
  let pending = false;
  let socketConnected = false;
  let sessionExpiresAtMs = null;

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readLanguage() {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
    const browserLanguage = (navigator.language || '').slice(0, 2).toLowerCase();
    return TRANSLATIONS[browserLanguage] ? browserLanguage : DEFAULT_LANGUAGE;
  }

  function saveLanguage(language) {
    currentLanguage = TRANSLATIONS[language] ? language : DEFAULT_LANGUAGE;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    document.documentElement.lang = currentLanguage;
  }

  function t(key, params = {}) {
    const dictionary = TRANSLATIONS[currentLanguage] || TRANSLATIONS[DEFAULT_LANGUAGE];
    const fallback = TRANSLATIONS[DEFAULT_LANGUAGE] || {};
    let text = dictionary[key] || fallback[key] || key;
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue));
    }
    return text;
  }

  function updateStaticTexts() {
    document.title = t('appTitle');
    if (heroTitle) heroTitle.textContent = t('appTitle');
    if (heroEyebrow) heroEyebrow.textContent = t('eyebrow');
    if (heroLead) heroLead.textContent = t('lead');
    if (languageLabel) languageLabel.textContent = t('language');
    if (languageSelect) {
      languageSelect.value = currentLanguage;
      languageSelect.setAttribute('aria-label', t('language'));
    }
    setConnection(socketConnected);
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

  function errorMessage(code, fallbackMessage) {
    if (code && t(`error_${code}`) !== `error_${code}`) return t(`error_${code}`);
    return translateServerMessage(fallbackMessage) || t('actionFailed');
  }

  function translateServerMessage(message) {
    if (!message) return '';
    if (message.includes('legalább') && message.includes('aktív játékos szükséges')) {
      const min = session && session.minPlayers ? session.minPlayers : 3;
      return t('serverMessageTooFew', { min });
    }
    if (message.includes('A körgazda kilépett vagy eltávolították')) {
      return t('serverMessageLeaderRemoved');
    }
    return message;
  }

  function translateReason(reason) {
    if (!reason) return '';
    if (reason === 'Eltalálta az igazi definíciót') return t('reasonRealVote');
    if (reason === '(közel) jó válasz bónusz') return t('reasonNearCorrect');
    const believedMatch = reason.match(/^Valaki elhitte a definícióját: (.*)$/);
    if (believedMatch) return t('reasonBelieved', { name: believedMatch[1] });
    return reason;
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
    socketConnected = connected;
    connectionStatus.textContent = connected ? t('connected') : t('disconnected');
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
        setAlert(errorMessage(response && response.code, response && response.message));
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

  function rememberSessionExpiry(nextSession) {
    if (nextSession && typeof nextSession.expiresInSeconds === 'number' && nextSession.expiresInSeconds > 0) {
      sessionExpiresAtMs = Date.now() + (nextSession.expiresInSeconds * 1000);
    } else {
      sessionExpiresAtMs = null;
    }
  }

  function currentTtlSeconds() {
    if (!sessionExpiresAtMs) return null;
    return Math.max(0, Math.ceil((sessionExpiresAtMs - Date.now()) / 1000));
  }

  function formatTtl(seconds) {
    if (seconds === null || seconds === undefined) return t('unknown');
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    if (safeSeconds <= 0) return t('lessThanMinute');
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    if (h > 0) return t('hourMinute', { hours: h, minutes: m });
    return t('minutes', { minutes: Math.max(1, m) });
  }

  function playerStatusText(player) {
    const parts = [];
    if (player.isHost) parts.push(t('hostLabel'));
    if (player.isCurrentRoundLeader) parts.push(t('roundLeaderLabel'));
    parts.push(player.connected ? t('online') : t('offline'));
    if (!player.active) parts.push(t('leftGame'));
    return parts.join(' · ');
  }

  function render() {
    updateStaticTexts();
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
          <h2>${t('createGameTitle')}</h2>
          <p class="muted">${t('createGameHelp')}</p>
          <div class="form-row">
            <label for="createName"><strong>${t('yourName')}</strong></label>
            <input id="createName" autocomplete="name" maxlength="32" placeholder="${escapeHtml(t('createNamePlaceholder'))}">
          </div>
          <button id="createBtn">${t('createSession')}</button>
        </section>

        <section class="card">
          <h2>${t('joinTitle')}</h2>
          <p class="muted">${t('joinHelp')}</p>
          <div class="form-row">
            <label for="joinName"><strong>${t('yourName')}</strong></label>
            <input id="joinName" autocomplete="name" maxlength="32" placeholder="${escapeHtml(t('joinNamePlaceholder'))}">
          </div>
          <div class="form-row">
            <label for="joinCode"><strong>${t('sessionCode')}</strong></label>
            <input id="joinCode" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="48291" value="${escapeHtml(sessionFromUrl)}">
          </div>
          <button id="joinBtn">${t('join')}</button>
        </section>
      </div>

      <section class="card soft" style="margin-top: 18px;">
        <h2>${t('shortRulesTitle')}</h2>
        <p>${t('shortRulesText')}</p>
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
      return a.name.localeCompare(b.name, currentLanguage);
    });

    return `
      <aside class="card">
        <h2>${t('session')}</h2>
        <p><span class="session-code">${escapeHtml(session.sessionId)}</span></p>
        <div class="kpi-row">
          <span class="kpi">${t('round')}: ${session.roundNumber || 0}</span>
          <span class="kpi">${t('timeRemaining')}: <span id="ttlValue">${formatTtl(currentTtlSeconds())}</span></span>
        </div>
        <div class="row-actions">
          <button class="secondary" id="extendBtn">${t('extendSession')}</button>
          <button class="danger" id="leaveBtn">${t('leave')}</button>
        </div>
        <hr>
        <h3>${t('scoreboard')}</h3>
        <div class="player-list">
          ${players.map((player) => `
            <div class="player ${player.active ? '' : 'inactive'}">
              <div class="player-row">
                <div>
                  <div class="player-name">${escapeHtml(player.name)}</div>
                  <div class="small muted">${escapeHtml(playerStatusText(player))}</div>
                </div>
                <strong>${t('points', { points: player.score })}</strong>
              </div>
              ${player.active && player.id !== playerId ? `<button class="secondary remove-player" data-player-id="${escapeHtml(player.id)}">${t('remove')}</button>` : ''}
            </div>
          `).join('')}
        </div>
      </aside>
    `;
  }

  function renderPhase() {
    const message = session.message ? `<section class="alert">${escapeHtml(translateServerMessage(session.message))}</section>` : '';
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
        return `${message}<section class="card"><h2>${t('gamePausedTitle')}</h2><p class="muted">${t('gamePausedText')}</p></section>`;
      default:
        return `<section class="card"><h2>${t('unknownState')}</h2><p>${escapeHtml(session.phase)}</p></section>`;
    }
  }

  function renderLobby() {
    const me = viewer();
    const canStart = session.viewerIsHost && activePlayers().length >= session.minPlayers;
    return `
      <section class="card">
        <h2>${t('lobbyTitle')}</h2>
        <p>${t('lobbyHelp', { min: session.minPlayers, max: session.maxPlayers })}</p>
        <div class="kpi-row">
          <span class="kpi">${t('activePlayers')}: ${session.activePlayerCount}/${session.maxPlayers}</span>
          <span class="kpi">${t('you')}: ${escapeHtml(me ? me.name : '')}</span>
        </div>
        ${session.viewerIsHost ? `
          <button id="startGameBtn" ${canStart ? '' : 'disabled'}>${t('startGame')}</button>
          ${canStart ? '' : `<p class="muted small">${t('minPlayersToStart', { min: session.minPlayers })}</p>`}
        ` : `<p class="muted">${t('hostStarts')}</p>`}
      </section>
    `;
  }

  function renderWordEntry() {
    const currentLeader = leader();
    if (session.viewerIsLeader) {
      return `
        <section class="card">
          <h2>${t('wordEntryLeaderTitle')}</h2>
          <p class="muted">${t('wordEntryLeaderHelp')}</p>
          <div class="form-row">
            <label for="wordInput"><strong>${t('word')}</strong></label>
            <input id="wordInput" maxlength="100" placeholder="${escapeHtml(t('wordPlaceholder'))}">
          </div>
          <div class="form-row">
            <label for="realDefinitionInput"><strong>${t('realDefinition')}</strong></label>
            <textarea id="realDefinitionInput" maxlength="1500" placeholder="${escapeHtml(t('realDefinitionPlaceholder'))}"></textarea>
          </div>
          <button id="submitWordBtn">${t('startRound')}</button>
        </section>
      `;
    }
    return `
      <section class="card">
        <h2>${t('wordEntryWaitingTitle')}</h2>
        <p class="muted">${t('currentRoundLeader')}: <strong>${escapeHtml(currentLeader ? currentLeader.name : t('unknown'))}</strong></p>
      </section>
    `;
  }

  function renderDefinitionSubmit() {
    const round = session.currentRound;
    const submittedByMe = round.submitStatus.some((item) => item.playerId === playerId && item.submitted);
    return `
      <section class="card">
        <h2>${t('definitionWritingTitle')}</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        ${session.viewerIsLeader ? `
          <p class="muted">${t('leaderWaitFake')}</p>
        ` : submittedByMe ? `
          <p class="status-ok">${t('submittedDefinition')}</p>
        ` : `
          <div class="form-row">
            <label for="fakeDefinitionInput"><strong>${t('whatMeans')}</strong></label>
            <textarea id="fakeDefinitionInput" maxlength="1500" placeholder="${escapeHtml(t('fakeDefinitionPlaceholder'))}"></textarea>
          </div>
          <button id="submitFakeBtn">${t('submitDefinition')}</button>
        `}
      </section>
      ${renderSubmitStatus(round.submitStatus)}
    `;
  }

  function renderSubmitStatus(status) {
    return `
      <section class="card soft">
        <h3>${t('submitStatus')}</h3>
        <div class="status-list">
          ${status.map((item) => `
            <div class="status-item">
              <div class="status-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="${item.submitted ? 'status-ok' : 'status-wait'}">${item.submitted ? t('submitted') : t('stillWriting')}</span>
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
        <h3>${t('voteStatus')}</h3>
        <div class="status-list">
          ${status.map((item) => `
            <div class="status-item">
              <div class="status-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="${item.voted ? 'status-ok' : 'status-wait'}">${item.voted ? t('voted') : t('stillThinking')}</span>
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
        <h2>${t('votingTitle')}</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <p class="muted">${t('votingHelp')}</p>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card">
              <div class="definition-header">
                <strong>${t('definitionNumber', { number: index + 1 })}</strong>
                ${definition.isOwn ? `<span class="badge">${t('ownAnswer')}</span>` : ''}
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <div class="row-actions">
                <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">${t('speak')}</button>
                ${definition.canVote ? `<button class="vote-btn" data-definition-id="${escapeHtml(definition.id)}">${t('voteThis')}</button>` : ''}
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
          <h2>${t('scoringInProgressTitle')}</h2>
          <p class="muted">${t('scoringInProgressHelp')}</p>
          <p>${t('roundLeaderLabel')}: <strong>${escapeHtml(currentLeader ? currentLeader.name : t('unknown'))}</strong></p>
        </section>
      `;
    }

    const round = session.currentRound;
    return `
      <section class="card">
        <h2>${t('scoringLeaderViewTitle')}</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <p class="muted">${t('scoringLeaderViewHelp')}</p>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card ${definition.type === 'real' ? 'real' : ''} ${definition.nearCorrect ? 'near' : ''}">
              <div class="definition-header">
                <strong>${t('definitionNumber', { number: index + 1 })}</strong>
                <span class="badge">${t('votesCount', { count: definition.votesCount })}</span>
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <p class="small muted">${t('author')}: <strong>${escapeHtml(definition.type === 'real' ? t('realDefinitionAuthor') : definition.authorName)}</strong></p>
              <p class="small muted">${t('voters')}: ${definition.voters.length ? escapeHtml(definition.voters.join(', ')) : t('nobody')}</p>
              <div class="row-actions">
                <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">${t('speak')}</button>
                ${definition.type === 'fake' ? `<button class="near-btn ${definition.nearCorrect ? 'success' : ''}" data-definition-id="${escapeHtml(definition.id)}">${definition.nearCorrect ? t('nearCorrectUndo') : t('nearCorrect')}</button>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
        <hr>
        <button id="finalizeScoringBtn">${t('finalizeScoring')}</button>
      </section>
    `;
  }

  function renderRoundResult() {
    const round = session.currentRound;
    return `
      <section class="card">
        <h2>${t('roundResult')}</h2>
        <div class="word-display">${escapeHtml(round.word)}</div>
        <div class="definition-list">
          ${round.definitions.map((definition, index) => `
            <article class="definition-card ${definition.type === 'real' ? 'real' : ''} ${definition.nearCorrect ? 'near' : ''}">
              <div class="definition-header">
                <strong>${t('definitionNumber', { number: index + 1 })}</strong>
                <span class="badge">${definition.type === 'real' ? t('real') : t('votesCount', { count: definition.votesCount })}</span>
              </div>
              <div class="definition-text">${escapeHtml(definition.text)}</div>
              <p class="small muted">${t('author')}: <strong>${escapeHtml(definition.type === 'real' ? t('realDefinitionAuthor') : definition.authorName)}</strong></p>
              <p class="small muted">${t('voters')}: ${definition.voters.length ? escapeHtml(definition.voters.join(', ')) : t('nobody')}</p>
              ${definition.nearCorrect ? `<p class="status-ok">${t('nearCorrectBonus')}</p>` : ''}
              <button class="secondary speak-btn" data-text="${escapeHtml(definition.text)}">${t('speak')}</button>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="card soft">
        <h3>${t('roundScoresTitle')}</h3>
        ${round.roundScores.length ? `
          <div class="score-list">
            ${round.roundScores.map((score) => `
              <div class="score-item">
                <div class="score-row">
                  <strong>${escapeHtml(score.playerName)}</strong>
                  <strong>${t('plusPoints', { points: score.delta })}</strong>
                </div>
                <div class="small muted">${escapeHtml((score.reasons || []).map(translateReason).join(' · '))}</div>
              </div>
            `).join('')}
          </div>
        ` : `<p class="muted">${t('noPointsRound')}</p>`}
        ${session.viewerIsLeader ? `<hr><button id="nextRoundBtn">${t('nextRound')}</button>` : `<p class="muted">${t('leaderStartsNext')}</p>`}
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
        if (!confirm(t('confirmLeave'))) return;
        emitAction('leaveSession', { sessionId: session.sessionId, playerId }, () => {
          clearLocalSession();
          session = null;
          sessionExpiresAtMs = null;
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
        if (!confirm(t('confirmRemove', { name: target.name }))) return;
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
      setAlert(t('browserNoTts'));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const locale = SPEECH_LOCALES[currentLanguage] || SPEECH_LOCALES.hu;
    utterance.lang = locale;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  }

  if (languageSelect) {
    languageSelect.value = currentLanguage;
    languageSelect.addEventListener('change', () => {
      saveLanguage(languageSelect.value);
      render();
    });
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
      sessionExpiresAtMs = null;
      playerId = null;
      goHome();
      setAlert(t('removedFromGame'));
      render();
      return;
    }

    session = nextSession;
    rememberSessionExpiry(nextSession);
    playerId = nextSession.viewerPlayerId;
    goToSession(nextSession.sessionId);
    render();
  });

  socket.on('actionError', (err) => {
    setAlert(errorMessage(err && err.code, err && err.message) || t('errorOccurred'));
  });

  socket.on('sessionExtended', () => {
    setAlert(t('sessionExtended'));
  });

  window.setInterval(() => {
    const ttlValue = document.getElementById('ttlValue');
    if (ttlValue) {
      ttlValue.textContent = formatTtl(currentTtlSeconds());
    }
  }, 15000);

  saveLanguage(currentLanguage);
  updateStaticTexts();
  render();
})();
