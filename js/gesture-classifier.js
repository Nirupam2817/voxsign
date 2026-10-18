/**
 * VoxSign Gesture Classifier
 * Geometric 3D hand analysis for Everyday Needs, Emergency Phrases, ASL Alphabet, and Numbers.
 */

class GestureClassifier {
  constructor() {
    this.currentMode = 'phrases'; // 'phrases' | 'alphabet' | 'custom'
    this.holdThresholdMs = 700; // Time user must hold gesture to confirm
    this.cooldownMs = 1200; // Cooldown after a sign is confirmed before triggering again

    this.activeGestureCandidate = null;
    this.gestureStartTime = 0;
    this.lastConfirmedGesture = null;
    this.lastConfirmedTime = 0;

    // Callbacks
    this.onGestureProgress = null; // (gestureName, progressRatio 0..1, emoji, speechText)
    this.onGestureConfirmed = null; // (gestureName, emoji, speechText)
    this.onGestureLost = null; // ()

    // Custom signs stored locally
    this.customSigns = this.loadCustomSigns();
  }

  setMode(mode) {
    this.currentMode = mode;
    this.resetHold();
  }

  resetHold() {
    this.activeGestureCandidate = null;
    this.gestureStartTime = 0;
    if (this.onGestureLost) this.onGestureLost();
  }

  loadCustomSigns() {
    try {
      const data = localStorage.getItem('voxsign_custom_gestures');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  saveCustomSigns(signs) {
    this.customSigns = signs;
    try {
      localStorage.setItem('voxsign_custom_gestures', JSON.stringify(signs));
    } catch (_) {}
  }

  /* 3D Euclidean distance */
  dist(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* 2D Euclidean distance (x, y) */
  dist2D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Main classifier entry point
   * @param {Array} landmarks - 21 MediaPipe hand landmarks
   */
  classify(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      this.resetHold();
      return null;
    }

    // 1. Compute scale reference: Palm size = distance from Wrist(0) to Middle MCP(9)
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmSize = this.dist2D(wrist, middleMcp);
    if (palmSize < 0.03) {
      this.resetHold();
      return null;
    }

    // 2. Extract finger landmarks
    const thumb = {
      cmc: landmarks[1],
      mcp: landmarks[2],
      ip: landmarks[3],
      tip: landmarks[4]
    };
    const index = {
      mcp: landmarks[5],
      pip: landmarks[6],
      dip: landmarks[7],
      tip: landmarks[8]
    };
    const middle = {
      mcp: landmarks[9],
      pip: landmarks[10],
      dip: landmarks[11],
      tip: landmarks[12]
    };
    const ring = {
      mcp: landmarks[13],
      pip: landmarks[14],
      dip: landmarks[15],
      tip: landmarks[16]
    };
    const pinky = {
      mcp: landmarks[17],
      pip: landmarks[18],
      dip: landmarks[19],
      tip: landmarks[20]
    };

    // 3. Determine finger extension status
    const isExtended = (finger) => {
      const tipDist = this.dist2D(finger.tip, wrist);
      const pipDist = this.dist2D(finger.pip, wrist);
      return tipDist > pipDist * 1.15;
    };

    const isCurled = (finger) => {
      const tipDist = this.dist2D(finger.tip, wrist);
      const pipDist = this.dist2D(finger.pip, wrist);
      return tipDist < pipDist * 0.95;
    };

    const indexExt = isExtended(index);
    const middleExt = isExtended(middle);
    const ringExt = isExtended(ring);
    const pinkyExt = isExtended(pinky);

    // Thumb extension relative to pinky MCP and wrist
    const thumbTipToPinkyMcp = this.dist2D(thumb.tip, pinky.mcp);
    const thumbExt = thumbTipToPinkyMcp > palmSize * 0.72 && this.dist2D(thumb.tip, wrist) > this.dist2D(thumb.ip, wrist);

    // Fingertip touches (pinches)
    const thumbIndexDist = this.dist2D(thumb.tip, index.tip);
    const thumbMiddleDist = this.dist2D(thumb.tip, middle.tip);
    const thumbRingDist = this.dist2D(thumb.tip, ring.tip);
    const thumbPinkyDist = this.dist2D(thumb.tip, pinky.tip);

    const isPinchThumbIndex = thumbIndexDist < palmSize * 0.28;
    const isPinchThumbMiddle = thumbMiddleDist < palmSize * 0.28;

    // Finger separation
    const indexMiddleSpread = this.dist2D(index.tip, middle.tip);
    const isIndexMiddleApart = indexMiddleSpread > palmSize * 0.32;
    const isIndexMiddleTogether = indexMiddleSpread < palmSize * 0.18;

    // Hand orientation (pointing up, down, sideways)
    const isHandPointingUp = wrist.y - middleMcp.y > 0.05;
    const isHandPointingDown = middleMcp.y - wrist.y > 0.05;

    // Check custom signs first if any match
    if (this.currentMode === 'custom' || this.customSigns.length > 0) {
      const customMatch = this.matchCustomSign(landmarks, palmSize);
      if (customMatch) {
        return this.processDetection(customMatch);
      }
    }

    let detected = null;

    if (this.currentMode === 'phrases') {
      detected = this.classifyPhrases({
        landmarks, wrist, palmSize,
        thumb, index, middle, ring, pinky,
        thumbExt, indexExt, middleExt, ringExt, pinkyExt,
        isPinchThumbIndex, isPinchThumbMiddle,
        isIndexMiddleApart, isIndexMiddleTogether,
        isHandPointingUp, isHandPointingDown,
        thumbIndexDist, thumbMiddleDist, thumbRingDist, thumbPinkyDist
      });
    } else if (this.currentMode === 'alphabet') {
      detected = this.classifyAlphabet({
        landmarks, wrist, palmSize,
        thumb, index, middle, ring, pinky,
        thumbExt, indexExt, middleExt, ringExt, pinkyExt,
        isPinchThumbIndex, isPinchThumbMiddle,
        isIndexMiddleApart, isIndexMiddleTogether,
        isHandPointingUp, isHandPointingDown,
        thumbIndexDist
      });
    }

    if (detected) {
      return this.processDetection(detected);
    } else {
      this.resetHold();
      return null;
    }
  }

  /**
   * Classify Everyday Needs & Emergency Communication Gestures
   */
  classifyPhrases(ctx) {
    const {
      thumb, index, middle, ring, pinky, wrist, palmSize,
      thumbExt, indexExt, middleExt, ringExt, pinkyExt,
      isPinchThumbIndex, isIndexMiddleApart,
      isHandPointingUp, isHandPointingDown
    } = ctx;

    // 1. 🆘 HELP / EMERGENCY: Clenched fist with thumb held inside or open hand held up high
    // Universal distress / SOS hand signal: Palm open facing forward, then tuck thumb, then fold fingers
    // We detect Thumb tucked over fist, OR high open hand wave
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt && thumb.tip.y < index.pip.y) {
      // Clenched fist with thumb up or distress fist
      if (thumb.tip.y < wrist.y - palmSize * 0.2) {
        return {
          id: 'help',
          name: 'Help / Emergency',
          emoji: '🆘',
          speech: 'Emergency! Please help me!',
          confidence: 0.95
        };
      }
    }

    // 2. ❤️ I LOVE YOU (Universal ASL ILY Sign): Thumb + Index + Pinky extended, Middle & Ring curled
    if (thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) {
      return {
        id: 'ily',
        name: 'I Love You',
        emoji: '❤️',
        speech: 'I love you',
        confidence: 0.98
      };
    }

    // 3. 💧 WATER: 'W' handshape (Index, Middle, Ring extended; Pinky curled down with Thumb)
    if (!pinkyExt && indexExt && middleExt && ringExt) {
      return {
        id: 'water',
        name: 'Need Water',
        emoji: '💧',
        speech: 'I need water, please',
        confidence: 0.94
      };
    }

    // 4. 🍽️ FOOD / HUNGRY: All 5 fingertips touching or very close together (eating handshape)
    const tips = [thumb.tip, index.tip, middle.tip, ring.tip, pinky.tip];
    let maxTipDist = 0;
    for (let i = 0; i < tips.length; i++) {
      for (let j = i + 1; j < tips.length; j++) {
        const d = this.dist2D(tips[i], tips[j]);
        if (d > maxTipDist) maxTipDist = d;
      }
    }
    if (maxTipDist < palmSize * 0.42 && !isHandPointingDown) {
      return {
        id: 'food',
        name: 'Hungry / Food',
        emoji: '🍽️',
        speech: 'I am hungry, I want food',
        confidence: 0.92
      };
    }

    // 5. 🚽 RESTROOM / TOILET: 'T' handshape (Thumb tucked between index and middle in a fist)
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
      const thumbBetweenIndexMiddle = thumb.tip.x > index.mcp.x && thumb.tip.x < middle.mcp.x && thumb.tip.y < index.pip.y;
      if (thumbBetweenIndexMiddle) {
        return {
          id: 'restroom',
          name: 'Restroom / Washroom',
          emoji: '🚽',
          speech: 'I need to use the restroom',
          confidence: 0.91
        };
      }
    }

    // 6. 👍 YES / AGREE: Thumbs Up
    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      if (thumb.tip.y < thumb.mcp.y - palmSize * 0.3) {
        return {
          id: 'yes',
          name: 'Yes / Agree',
          emoji: '👍',
          speech: 'Yes, I agree',
          confidence: 0.96
        };
      }
      // 7. 👎 NO / DISAGREE: Thumbs Down
      if (thumb.tip.y > thumb.mcp.y + palmSize * 0.3) {
        return {
          id: 'no',
          name: 'No / Disagree',
          emoji: '👎',
          speech: 'No, I disagree',
          confidence: 0.96
        };
      }
    }

    // 8. 🤙 CALL ME / PHONE: Thumb and Pinky extended, middle three folded
    if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) {
      return {
        id: 'call',
        name: 'Call Someone / Phone',
        emoji: '🤙',
        speech: 'Please call someone for me',
        confidence: 0.95
      };
    }

    // 9. 👌 OK / PERFECT: Thumb and Index touching, Middle, Ring, Pinky extended
    if (isPinchThumbIndex && middleExt && ringExt && pinkyExt) {
      return {
        id: 'ok',
        name: 'OK / Good',
        emoji: '👌',
        speech: 'Okay, everything is fine',
        confidence: 0.96
      };
    }

    // 10. ✌️ PEACE / TWO: Index and Middle extended apart, others folded
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && isIndexMiddleApart) {
      return {
        id: 'peace',
        name: 'Peace / Two',
        emoji: '✌️',
        speech: 'Peace',
        confidence: 0.94
      };
    }

    // 11. ☝️ ATTENTION / LOOK / ONE: Only Index extended up
    if (indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
      return {
        id: 'point',
        name: 'Look / Attention',
        emoji: '☝️',
        speech: 'Please look here',
        confidence: 0.93
      };
    }

    // 12. ✋ STOP / WAIT: All 5 fingers extended, held straight up
    if (thumbExt && indexExt && middleExt && ringExt && pinkyExt && isHandPointingUp) {
      // Check if fingers are together (Stop) vs spread wide (Hello)
      const fingerSpread = this.dist2D(index.tip, pinky.tip);
      if (fingerSpread < palmSize * 0.9) {
        return {
          id: 'stop',
          name: 'Stop / Wait',
          emoji: '✋',
          speech: 'Please stop and wait',
          confidence: 0.93
        };
      } else {
        // 13. 👋 HELLO / GREETINGS: Open hand spread
        return {
          id: 'hello',
          name: 'Hello / Greetings',
          emoji: '👋',
          speech: 'Hello! Good to see you',
          confidence: 0.94
        };
      }
    }

    // 14. 🩺 DOCTOR / MEDICAL: Index and Middle pointing down/flat touching wrist
    if (indexExt && middleExt && !ringExt && !pinkyExt && isHandPointingDown) {
      return {
        id: 'doctor',
        name: 'Doctor / Medicine',
        emoji: '🩺',
        speech: 'I need a doctor or medicine',
        confidence: 0.90
      };
    }

    // 15. ✊ READY / WAIT / FIST: All fingers curled tightly
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
      return {
        id: 'fist',
        name: 'Ready / I am here',
        emoji: '✊',
        speech: 'I am ready',
        confidence: 0.88
      };
    }

    return null;
  }

  /**
   * Classify ASL Alphabet Letters & Digits
   */
  classifyAlphabet(ctx) {
    const {
      thumb, index, middle, ring, pinky, palmSize,
      thumbExt, indexExt, middleExt, ringExt, pinkyExt,
      isPinchThumbIndex, isIndexMiddleApart, isIndexMiddleTogether,
      thumbIndexDist
    } = ctx;

    // 'A': Fist with thumb upright against index finger side
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && thumb.tip.y < index.pip.y && thumb.tip.x < index.mcp.x) {
      return { id: 'A', name: 'Letter A', emoji: '🅰️', speech: 'A', confidence: 0.92 };
    }

    // 'B': 4 fingers straight up together, thumb folded across palm
    if (indexExt && middleExt && ringExt && pinkyExt && !thumbExt && isIndexMiddleTogether) {
      return { id: 'B', name: 'Letter B', emoji: '🅱️', speech: 'B', confidence: 0.94 };
    }

    // 'C': Curved fingers and thumb
    if (thumbIndexDist > palmSize * 0.35 && thumbIndexDist < palmSize * 0.75 && !indexExt && !middleExt) {
      const isCurved = index.tip.y < index.mcp.y && thumb.tip.y > index.tip.y;
      if (isCurved) {
        return { id: 'C', name: 'Letter C', emoji: '🅲', speech: 'C', confidence: 0.89 };
      }
    }

    // 'D': Index pointing straight up, thumb touching middle, ring, pinky tips
    if (indexExt && !middleExt && !ringExt && !pinkyExt && this.dist2D(thumb.tip, middle.tip) < palmSize * 0.3) {
      return { id: 'D', name: 'Letter D', emoji: '🅳', speech: 'D', confidence: 0.92 };
    }

    // 'F': Thumb and index touching (like OK), other 3 fingers up
    if (isPinchThumbIndex && middleExt && ringExt && pinkyExt) {
      return { id: 'F', name: 'Letter F', emoji: '🅵', speech: 'F', confidence: 0.95 };
    }

    // 'I': Pinky pointing straight up, all others folded into fist
    if (!indexExt && !middleExt && !ringExt && pinkyExt && !thumbExt) {
      return { id: 'I', name: 'Letter I', emoji: '🅸', speech: 'I', confidence: 0.95 };
    }

    // 'L': Index up, Thumb at 90 deg sideways
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) {
      return { id: 'L', name: 'Letter L', emoji: '🅻', speech: 'L', confidence: 0.96 };
    }

    // 'U': Index and middle extended straight up, touching together side-by-side
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && isIndexMiddleTogether) {
      return { id: 'U', name: 'Letter U', emoji: '🆄', speech: 'U', confidence: 0.92 };
    }

    // 'V': Index and middle extended straight up, spread apart in V
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && isIndexMiddleApart) {
      return { id: 'V', name: 'Letter V', emoji: '🆅', speech: 'V', confidence: 0.95 };
    }

    // 'W': Index, middle, ring extended spread up
    if (indexExt && middleExt && ringExt && !pinkyExt) {
      return { id: 'W', name: 'Letter W', emoji: '🆆', speech: 'W', confidence: 0.93 };
    }

    // 'Y': Thumb and pinky extended wide, others folded (shaka/Y)
    if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) {
      return { id: 'Y', name: 'Letter Y', emoji: '🆈', speech: 'Y', confidence: 0.95 };
    }

    // Numbers: 1, 2, 3, 4, 5
    if (indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
      return { id: '1', name: 'Number 1', emoji: '1️⃣', speech: '1', confidence: 0.93 };
    }
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt) {
      return { id: '2', name: 'Number 2', emoji: '2️⃣', speech: '2', confidence: 0.92 };
    }
    if (thumbExt && indexExt && middleExt && !ringExt && !pinkyExt) {
      return { id: '3', name: 'Number 3', emoji: '3️⃣', speech: '3', confidence: 0.92 };
    }
    if (!thumbExt && indexExt && middleExt && ringExt && pinkyExt) {
      return { id: '4', name: 'Number 4', emoji: '4️⃣', speech: '4', confidence: 0.93 };
    }
    if (thumbExt && indexExt && middleExt && ringExt && pinkyExt) {
      return { id: '5', name: 'Number 5', emoji: '5️⃣', speech: '5', confidence: 0.94 };
    }

    return null;
  }

  /**
   * Match against user-trained custom signs
   */
  matchCustomSign(landmarks, palmSize) {
    if (!this.customSigns || this.customSigns.length === 0) return null;

    // Extract normalized feature vector: distances from wrist to each landmark normalized by palmSize
    const wrist = landmarks[0];
    const currentVector = [];
    for (let i = 1; i < 21; i++) {
      currentVector.push(this.dist(landmarks[i], wrist) / palmSize);
    }

    let bestSign = null;
    let minDiff = Infinity;

    for (const sign of this.customSigns) {
      if (!sign.vector || sign.vector.length !== currentVector.length) continue;
      
      let sumDiff = 0;
      for (let i = 0; i < currentVector.length; i++) {
        sumDiff += Math.abs(currentVector[i] - sign.vector[i]);
      }
      const avgDiff = sumDiff / currentVector.length;

      // Threshold for match
      if (avgDiff < 0.22 && avgDiff < minDiff) {
        minDiff = avgDiff;
        bestSign = {
          id: 'custom_' + sign.id,
          name: sign.name,
          emoji: sign.emoji || '✨',
          speech: sign.phrase,
          confidence: Math.max(0.7, 1 - avgDiff)
        };
      }
    }

    return bestSign;
  }

  /**
   * Process candidate detection with hold duration & cooldown
   */
  processDetection(detected) {
    const now = performance.now();

    // Check cooldown for the last confirmed gesture to avoid rapid repeating
    if (this.lastConfirmedGesture === detected.id && (now - this.lastConfirmedTime < this.cooldownMs)) {
      return detected;
    }

    if (!this.activeGestureCandidate || this.activeGestureCandidate.id !== detected.id) {
      // New candidate started
      this.activeGestureCandidate = detected;
      this.gestureStartTime = now;
      if (this.onGestureProgress) {
        this.onGestureProgress(detected.name, 0.05, detected.emoji, detected.speech);
      }
    } else {
      // Continuing the same gesture
      const elapsed = now - this.gestureStartTime;
      const progressRatio = Math.min(1.0, elapsed / this.holdThresholdMs);

      if (this.onGestureProgress) {
        this.onGestureProgress(detected.name, progressRatio, detected.emoji, detected.speech);
      }

      if (progressRatio >= 1.0) {
        // Confirmed!
        this.lastConfirmedGesture = detected.id;
        this.lastConfirmedTime = now;
        this.activeGestureCandidate = null;
        this.gestureStartTime = 0;

        if (this.onGestureConfirmed) {
          this.onGestureConfirmed(detected.name, detected.emoji, detected.speech);
        }
      }
    }

    return detected;
  }
}

window.GestureClassifier = GestureClassifier;
