/**
 * VoxSign Speech & Audio Engine
 * Handles Text-to-Speech synthesis, Sentence Accumulator, and Web Audio sound effects.
 */

class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.isSpeaking = false;
    this.autoSpeak = true;
    this.currentSentence = '';

    // Web Audio Context for synthesized sound cues & emergency siren
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = AudioCtx ? new AudioCtx() : null;
    this.alarmOscillator = null;
    this.alarmGain = null;
    this.isAlarmActive = false;

    // Listeners
    this.onSpeakingStateChange = null;
    this.onSentenceChange = null;
    this.onSpoken = null;

    this.initVoices();
  }

  initVoices() {
    if (!this.synth) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    const loadVoices = () => {
      this.voices = this.synth.getVoices();
      if (!this.selectedVoice && this.voices.length > 0) {
        // Prefer natural English voices if available
        const defaultVoice = 
          this.voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Zira'))) ||
          this.voices.find(v => v.lang.startsWith('en')) ||
          this.voices[0];
        this.selectedVoice = defaultVoice;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  getVoices() {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  setVoice(voiceURI) {
    const found = this.voices.find(v => v.voiceURI === voiceURI);
    if (found) {
      this.selectedVoice = found;
    }
  }

  setRate(value) {
    this.rate = Math.max(0.5, Math.min(2.0, parseFloat(value)));
  }

  setPitch(value) {
    this.pitch = Math.max(0.5, Math.min(2.0, parseFloat(value)));
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1.0, parseFloat(value)));
  }

  /**
   * Speak a text string out loud using the speaker
   */
  speak(text, { queue = false, onStart = null, onEnd = null } = {}) {
    if (!this.synth || !text || text.trim() === '') return;

    if (!queue && this.synth.speaking) {
      this.synth.cancel(); // Interrupt previous speech for real-time responsiveness
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(true);
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
    };

    this.synth.speak(utterance);

    if (this.onSpoken) {
      this.onSpoken(text);
    }
  }

  /**
   * Play a pleasant audio chime when a sign is recognized and confirmed
   */
  playConfirmationChime() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880.00, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.14); // D6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (err) {
      console.warn('Audio chime playback failed:', err);
    }
  }

  /**
   * Emergency siren sound for SOS/Help alerts
   */
  toggleEmergencyAlarm(forceState = null) {
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const targetState = forceState !== null ? forceState : !this.isAlarmActive;

    if (!targetState) {
      // Stop siren
      if (this.alarmOscillator) {
        try {
          this.alarmOscillator.stop();
          this.alarmOscillator.disconnect();
        } catch (_) {}
        this.alarmOscillator = null;
      }
      this.isAlarmActive = false;
      return false;
    }

    // Start siren
    try {
      if (this.alarmOscillator) {
        this.alarmOscillator.stop();
      }

      const now = this.audioCtx.currentTime;
      this.alarmOscillator = this.audioCtx.createOscillator();
      this.alarmGain = this.audioCtx.createGain();

      this.alarmOscillator.type = 'sawtooth';
      
      // Siren frequency modulation
      this.alarmOscillator.frequency.setValueAtTime(650, now);
      for (let i = 0; i < 20; i++) {
        this.alarmOscillator.frequency.linearRampToValueAtTime(1100, now + i * 0.5 + 0.25);
        this.alarmOscillator.frequency.linearRampToValueAtTime(650, now + i * 0.5 + 0.5);
      }

      this.alarmGain.gain.setValueAtTime(0.2, now);

      this.alarmOscillator.connect(this.alarmGain);
      this.alarmGain.connect(this.audioCtx.destination);

      this.alarmOscillator.start(now);
      this.isAlarmActive = true;

      // Automatically speak emergency request
      this.speak("Emergency! Please help! This is an urgent request for assistance!", { queue: false });

      return true;
    } catch (err) {
      console.error('Error starting siren:', err);
      this.isAlarmActive = false;
      return false;
    }
  }

  /* Sentence Builder Management */
  addWord(word) {
    if (!word) return;
    if (this.currentSentence.length > 0 && !this.currentSentence.endsWith(' ')) {
      this.currentSentence += ' ';
    }
    this.currentSentence += word;
    this.notifySentenceChange();
  }

  addLetter(letter) {
    if (!letter) return;
    this.currentSentence += letter;
    this.notifySentenceChange();
  }

  addSpace() {
    this.currentSentence += ' ';
    this.notifySentenceChange();
  }

  backspace() {
    if (this.currentSentence.length > 0) {
      this.currentSentence = this.currentSentence.slice(0, -1);
      this.notifySentenceChange();
    }
  }

  clearSentence() {
    this.currentSentence = '';
    this.notifySentenceChange();
  }

  setSentence(text) {
    this.currentSentence = text || '';
    this.notifySentenceChange();
  }

  speakSentence() {
    if (this.currentSentence.trim()) {
      this.speak(this.currentSentence.trim());
    }
  }

  notifySentenceChange() {
    if (this.onSentenceChange) {
      this.onSentenceChange(this.currentSentence);
    }
  }
}

window.SpeechEngine = SpeechEngine;
