/**
 * VoxSign Main Application Controller
 * Orchestrates Hand Detection, Gesture Classification, Speech Synthesis, and UI.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const videoEl = document.getElementById('webcam-video');
  const canvasEl = document.getElementById('output-canvas');
  const cameraStatusBadge = document.getElementById('camera-status');
  const fpsText = document.getElementById('fps-text');
  const handCountBadge = document.getElementById('hand-count');

  // Hold indicator
  const holdContainer = document.getElementById('hold-feedback');
  const holdBarCircle = document.getElementById('hold-circle-bar');
  const holdGestureLabel = document.getElementById('hold-gesture-label');

  // Current detection card
  const currentSignEmoji = document.getElementById('current-sign-emoji');
  const currentSignName = document.getElementById('current-sign-name');
  const currentSignDesc = document.getElementById('current-sign-desc');
  const confidenceVal = document.getElementById('confidence-val');
  const confidenceBarFill = document.getElementById('confidence-bar-fill');

  // Spoken Output
  const lastSpokenText = document.getElementById('last-spoken-text');
  const lastSpokenTime = document.getElementById('last-spoken-time');
  const audioWaves = document.getElementById('audio-waves');
  const replayBtn = document.getElementById('replay-btn');

  // Sentence Builder
  const sentenceDisplay = document.getElementById('sentence-display');
  const btnSpeakSentence = document.getElementById('btn-speak-sentence');
  const btnAddSpace = document.getElementById('btn-add-space');
  const btnBackspace = document.getElementById('btn-backspace');
  const btnClearSentence = document.getElementById('btn-clear-sentence');

  // History List
  const historyListEl = document.getElementById('history-list');

  // Mode buttons
  const modePills = document.querySelectorAll('.mode-pill');

  // Toggles & Camera Buttons
  const toggleSkeleton = document.getElementById('toggle-skeleton');
  const toggleAutospeak = document.getElementById('toggle-autospeak');
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnEmergency = document.getElementById('btn-emergency');

  // Modals
  const settingsModal = document.getElementById('settings-modal');
  const guideModal = document.getElementById('guide-modal');
  const trainerModal = document.getElementById('trainer-modal');

  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnOpenGuide = document.getElementById('btn-open-guide');
  const btnOpenTrainer = document.getElementById('btn-open-trainer');

  // Settings inputs
  const voiceSelect = document.getElementById('voice-select');
  const rateRange = document.getElementById('rate-range');
  const rateVal = document.getElementById('rate-val');
  const pitchRange = document.getElementById('pitch-range');
  const pitchVal = document.getElementById('pitch-val');
  const volumeRange = document.getElementById('volume-range');
  const volumeVal = document.getElementById('volume-val');
  const holdSpeedRange = document.getElementById('hold-speed-range');
  const holdSpeedVal = document.getElementById('hold-speed-val');

  // Initialize Core Engines
  const speech = new SpeechEngine();
  const classifier = new GestureClassifier();
  const detector = new HandDetector(videoEl, canvasEl);
  const trainer = new CustomTrainer(classifier, speech);
  window.customTrainerApp = trainer; // For onclick handlers

  let lastSpokenString = '';
  let speechHistory = [];

  // ==========================================
  // Hand Detection & Classification Link
  // ==========================================

  detector.onStatusChange = (statusMsg, isActive) => {
    cameraStatusBadge.textContent = statusMsg;
    if (isActive) {
      cameraStatusBadge.classList.remove('inactive');
    } else {
      cameraStatusBadge.classList.add('inactive');
    }
  };

  detector.onFpsUpdate = (fps) => {
    fpsText.textContent = `${fps} FPS`;
  };

  detector.onHandsDetected = (multiLandmarks, multiHandedness) => {
    handCountBadge.textContent = `${multiLandmarks.length} Hand${multiLandmarks.length === 1 ? '' : 's'}`;

    if (multiLandmarks.length > 0) {
      const primaryLandmarks = multiLandmarks[0];
      trainer.onNewLandmarks(primaryLandmarks);
      classifier.classify(primaryLandmarks);
    } else {
      trainer.onNewLandmarks(null);
      classifier.resetHold();
      updateConfidenceUI(null);
    }
  };

  // ==========================================
  // Gesture Classifier Callbacks
  // ==========================================

  classifier.onGestureProgress = (name, ratio, emoji, speechText) => {
    holdContainer.classList.add('active');
    holdGestureLabel.textContent = `${emoji} ${name}`;

    // SVG circle circumference is ~100 with stroke-dasharray: 100
    const offset = 100 - ratio * 100;
    holdBarCircle.style.strokeDashoffset = offset;

    // Update detected card
    currentSignEmoji.textContent = emoji;
    currentSignName.textContent = name;
    currentSignDesc.textContent = `Hold still to speak: "${speechText}"`;
    updateConfidenceUI(ratio);
  };

  classifier.onGestureLost = () => {
    holdContainer.classList.remove('active');
    holdBarCircle.style.strokeDashoffset = 100;
  };

  classifier.onGestureConfirmed = (name, emoji, speechText) => {
    holdContainer.classList.remove('active');
    holdBarCircle.style.strokeDashoffset = 100;

    // Play pleasant confirmation audio cue
    speech.playConfirmationChime();

    // Visual notification toast
    showToast(`Recognized: ${emoji} ${name}`);

    // If Alphabet mode: add letter to sentence builder
    if (classifier.currentMode === 'alphabet') {
      speech.addLetter(speechText);
      if (speech.autoSpeak) {
        speech.speak(speechText);
      }
    } else {
      // Phrases mode or Custom mode
      speech.addWord(speechText);

      if (speech.autoSpeak) {
        triggerSpokenOutput(speechText, emoji);
      }
    }
  };

  function updateConfidenceUI(ratio) {
    if (ratio === null || ratio === undefined) {
      confidenceVal.textContent = '0%';
      confidenceBarFill.style.width = '0%';
    } else {
      const pct = Math.min(100, Math.round(ratio * 100));
      confidenceVal.textContent = `${pct}%`;
      confidenceBarFill.style.width = `${pct}%`;
    }
  }

  function triggerSpokenOutput(text, emoji = '🗣️') {
    speech.speak(text);
    lastSpokenString = text;
    lastSpokenText.textContent = `"${text}"`;
    lastSpokenText.classList.remove('empty');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastSpokenTime.textContent = `Spoken at ${timeStr}`;

    // Add to history
    addToHistory(text, emoji, timeStr);
  }

  function addToHistory(text, emoji, timeStr) {
    speechHistory.unshift({ text, emoji, time: timeStr });
    if (speechHistory.length > 20) speechHistory.pop();
    renderHistory();
  }

  function renderHistory() {
    if (speechHistory.length === 0) {
      historyListEl.innerHTML = '<li style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:12px;">No speech history yet.</li>';
      return;
    }

    historyListEl.innerHTML = speechHistory.map((item, index) => `
      <li class="history-item">
        <div class="history-left">
          <span>${item.emoji}</span>
          <div>
            <div class="history-text">${item.text}</div>
            <div class="history-time">${item.time}</div>
          </div>
        </div>
        <button class="history-speak-btn" title="Replay Voice" onclick="window.speakHistoryIndex(${index})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>
      </li>
    `).join('');
  }

  window.speakHistoryIndex = (index) => {
    if (speechHistory[index]) {
      speech.speak(speechHistory[index].text);
    }
  };

  // Audio wave visualization listener
  speech.onSpeakingStateChange = (isSpeaking) => {
    if (isSpeaking) {
      audioWaves.classList.add('speaking');
    } else {
      audioWaves.classList.remove('speaking');
    }
  };

  // Sentence Builder events
  speech.onSentenceChange = (sentence) => {
    sentenceDisplay.value = sentence;
  };

  sentenceDisplay.addEventListener('input', (e) => {
    speech.setSentence(e.target.value);
  });

  btnSpeakSentence.addEventListener('click', () => {
    if (sentenceDisplay.value.trim()) {
      triggerSpokenOutput(sentenceDisplay.value.trim(), '💬');
    }
  });

  btnAddSpace.addEventListener('click', () => speech.addSpace());
  btnBackspace.addEventListener('click', () => speech.backspace());
  btnClearSentence.addEventListener('click', () => speech.clearSentence());

  replayBtn.addEventListener('click', () => {
    if (lastSpokenString) {
      speech.speak(lastSpokenString);
    }
  });

  // Emergency Siren SOS
  btnEmergency.addEventListener('click', () => {
    const isNowActive = speech.toggleEmergencyAlarm();
    if (isNowActive) {
      btnEmergency.textContent = '🚨 STOP ALARM';
      btnEmergency.style.background = '#b91c1c';
      showToast('Emergency SOS siren active!');
    } else {
      btnEmergency.textContent = '🚨 EMERGENCY SOS';
      btnEmergency.style.background = '';
      showToast('Emergency alarm silenced');
    }
  });

  // Mode Selection
  modePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      modePills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const mode = pill.getAttribute('data-mode');
      classifier.setMode(mode);
      showToast(`Switched to ${pill.textContent} mode`);
    });
  });

  // Toggles
  toggleSkeleton.addEventListener('change', (e) => {
    detector.showSkeleton = e.target.checked;
  });

  toggleAutospeak.addEventListener('change', (e) => {
    speech.autoSpeak = e.target.checked;
    showToast(`Auto-Speak ${speech.autoSpeak ? 'Enabled' : 'Disabled'}`);
  });

  let isCameraRunning = true;
  btnToggleCamera.addEventListener('click', async () => {
    if (isCameraRunning) {
      detector.stopCamera();
      btnToggleCamera.textContent = '📷 Start Camera';
      isCameraRunning = false;
    } else {
      btnToggleCamera.textContent = '📷 Stop Camera';
      await detector.startCamera();
      isCameraRunning = true;
    }
  });

  // ==========================================
  // Modals & Settings Management
  // ==========================================

  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }

  document.querySelectorAll('.modal-close-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target);
    }
  });

  btnOpenSettings.addEventListener('click', () => {
    populateVoiceSelect();
    openModal(settingsModal);
  });

  btnOpenGuide.addEventListener('click', () => openModal(guideModal));
  btnOpenTrainer.addEventListener('click', () => openModal(trainerModal));

  // Populate Voices
  function populateVoiceSelect() {
    const voices = speech.getVoices();
    voiceSelect.innerHTML = voices
      .map((v) => `<option value="${v.voiceURI}" ${speech.selectedVoice && speech.selectedVoice.voiceURI === v.voiceURI ? 'selected' : ''}>${v.name} (${v.lang})</option>`)
      .join('');
  }

  voiceSelect.addEventListener('change', (e) => {
    speech.setVoice(e.target.value);
  });

  rateRange.addEventListener('input', (e) => {
    rateVal.textContent = `${e.target.value}x`;
    speech.setRate(e.target.value);
  });

  pitchRange.addEventListener('input', (e) => {
    pitchVal.textContent = `${e.target.value}x`;
    speech.setPitch(e.target.value);
  });

  volumeRange.addEventListener('input', (e) => {
    const pct = Math.round(e.target.value * 100);
    volumeVal.textContent = `${pct}%`;
    speech.setVolume(e.target.value);
  });

  holdSpeedRange.addEventListener('input', (e) => {
    classifier.holdThresholdMs = parseInt(e.target.value, 10);
    holdSpeedVal.textContent = `${(classifier.holdThresholdMs / 1000).toFixed(1)}s`;
  });

  // Guide modal tabs
  const guideTabBtns = document.querySelectorAll('.guide-tab-btn');
  const guideSections = document.querySelectorAll('.guide-section');

  guideTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      guideTabBtns.forEach((b) => b.classList.remove('active'));
      guideSections.forEach((s) => (s.style.display = 'none'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      const targetSec = document.getElementById(targetId);
      if (targetSec) targetSec.style.display = 'grid';
    });
  });

  // Toast Helper
  const toastContainer = document.getElementById('toast-container');
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  // Keyboard accessibility
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
    }
  });

  // Start detector!
  const initialized = await detector.init();
  if (initialized) {
    showToast('VoxSign ready! Show your hand to begin communicating.');
  }
});
