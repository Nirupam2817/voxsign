/**
 * VoxSign Custom Gesture Trainer
 * Enables users to record, train, and personalize their own sign language gestures.
 */

class CustomTrainer {
  constructor(classifier, speechEngine) {
    this.classifier = classifier;
    this.speech = speechEngine;

    this.isRecording = false;
    this.recordedFrames = [];
    this.sampleGoal = 25; // 25 frames
    this.currentLandmarks = null;

    // UI elements
    this.modal = document.getElementById('trainer-modal');
    this.nameInput = document.getElementById('custom-name-input');
    this.phraseInput = document.getElementById('custom-phrase-input');
    this.recordBtn = document.getElementById('start-train-btn');
    this.statusText = document.getElementById('train-status-text');
    this.customListContainer = document.getElementById('custom-signs-list');

    this.initEventListeners();
    this.renderCustomList();
  }

  initEventListeners() {
    if (this.recordBtn) {
      this.recordBtn.addEventListener('click', () => this.startRecordingProcess());
    }
  }

  onNewLandmarks(landmarks) {
    if (landmarks && landmarks.length >= 21) {
      this.currentLandmarks = landmarks;
      if (this.isRecording) {
        this.captureFrame(landmarks);
      }
    } else {
      this.currentLandmarks = null;
    }
  }

  captureFrame(landmarks) {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmSize = Math.sqrt(
      Math.pow(wrist.x - middleMcp.x, 2) + Math.pow(wrist.y - middleMcp.y, 2)
    );
    if (palmSize < 0.03) return;

    // Vector of distances from wrist normalized by palmSize
    const frameVec = [];
    for (let i = 1; i < 21; i++) {
      const d = Math.sqrt(
        Math.pow(landmarks[i].x - wrist.x, 2) +
        Math.pow(landmarks[i].y - wrist.y, 2) +
        Math.pow((landmarks[i].z || 0) - (wrist.z || 0), 2)
      );
      frameVec.push(d / palmSize);
    }

    this.recordedFrames.push(frameVec);

    const progress = Math.round((this.recordedFrames.length / this.sampleGoal) * 100);
    this.statusText.textContent = `Recording sign... ${progress}%`;

    if (this.recordedFrames.length >= this.sampleGoal) {
      this.finishRecording();
    }
  }

  startRecordingProcess() {
    const name = this.nameInput.value.trim();
    const phrase = this.phraseInput.value.trim();

    if (!name || !phrase) {
      alert('Please enter both a Gesture Name and the Phrase to speak.');
      return;
    }

    if (!this.currentLandmarks) {
      alert('Please place your hand in front of the camera first before recording.');
      return;
    }

    this.recordBtn.disabled = true;
    this.recordedFrames = [];

    // 3 second countdown before capturing
    let count = 3;
    this.statusText.textContent = `Get ready in ${count}... Hold your gesture still!`;

    const countdown = setInterval(() => {
      count--;
      if (count > 0) {
        this.statusText.textContent = `Get ready in ${count}... Hold your gesture still!`;
      } else {
        clearInterval(countdown);
        this.statusText.textContent = 'Hold steady! Capturing gesture...';
        this.isRecording = true;
      }
    }, 1000);
  }

  finishRecording() {
    this.isRecording = false;
    this.recordBtn.disabled = false;

    // Average the collected feature vectors
    const numFeatures = this.recordedFrames[0].length;
    const avgVector = new Array(numFeatures).fill(0);

    for (let i = 0; i < this.recordedFrames.length; i++) {
      for (let j = 0; j < numFeatures; j++) {
        avgVector[j] += this.recordedFrames[i][j];
      }
    }

    for (let j = 0; j < numFeatures; j++) {
      avgVector[j] /= this.recordedFrames.length;
    }

    const newSign = {
      id: Date.now().toString(),
      name: this.nameInput.value.trim(),
      phrase: this.phraseInput.value.trim(),
      emoji: '✨',
      vector: avgVector
    };

    const signs = this.classifier.customSigns || [];
    signs.push(newSign);
    this.classifier.saveCustomSigns(signs);

    this.statusText.textContent = `Success! Custom gesture "${newSign.name}" saved!`;
    this.nameInput.value = '';
    this.phraseInput.value = '';

    this.speech.speak(`Custom sign ${newSign.name} trained successfully!`);
    this.renderCustomList();
  }

  deleteSign(id) {
    let signs = this.classifier.customSigns || [];
    signs = signs.filter((s) => s.id !== id);
    this.classifier.saveCustomSigns(signs);
    this.renderCustomList();
  }

  renderCustomList() {
    if (!this.customListContainer) return;
    const signs = this.classifier.customSigns || [];

    if (signs.length === 0) {
      this.customListContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No custom gestures saved yet.</p>';
      return;
    }

    this.customListContainer.innerHTML = signs
      .map(
        (s) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.5); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color); margin-bottom:6px;">
        <div>
          <strong style="color:#fff; font-size:0.9rem;">${s.name}</strong>
          <span style="display:block; color:var(--text-secondary); font-size:0.78rem;">Phrase: "${s.phrase}"</span>
        </div>
        <button onclick="window.customTrainerApp.deleteSign('${s.id}')" style="background:#ef4444; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Delete</button>
      </div>
    `
      )
      .join('');
  }
}

window.CustomTrainer = CustomTrainer;
