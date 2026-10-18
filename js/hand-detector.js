/**
 * VoxSign Hand Detector
 * Integrates MediaPipe Hands with HTML5 Video and Canvas Overlay.
 */

class HandDetector {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.hands = null;
    this.cameraStream = null;
    this.isTracking = false;
    this.showSkeleton = true;

    // FPS calculation
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    // Callbacks
    this.onHandsDetected = null; // (landmarksArray, handednessArray)
    this.onFpsUpdate = null; // (fpsNumber)
    this.onStatusChange = null; // (statusString, isActive)

    // Animation loop
    this.animationFrameId = null;
    this.isProcessingFrame = false;
  }

  async init() {
    try {
      if (this.onStatusChange) this.onStatusChange('Loading MediaPipe AI model...', false);

      // Check if MediaPipe Hands is loaded from CDN
      if (typeof Hands === 'undefined') {
        throw new Error('MediaPipe Hands library not loaded from CDN.');
      }

      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
      });

      this.hands.onResults((results) => this.handleResults(results));

      if (this.onStatusChange) this.onStatusChange('AI Model Ready. Starting camera...', false);
      await this.startCamera();
      return true;
    } catch (err) {
      console.error('Failed to initialize HandDetector:', err);
      if (this.onStatusChange) this.onStatusChange(`Error: ${err.message}`, false);
      return false;
    }
  }

  async startCamera() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.cameraStream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          this.updateCanvasDimensions();
          resolve();
        };
      });

      window.addEventListener('resize', () => this.updateCanvasDimensions());

      this.isTracking = true;
      if (this.onStatusChange) this.onStatusChange('Camera Active & Detecting Signs', true);

      this.startProcessingLoop();
    } catch (err) {
      console.error('Failed to start camera:', err);
      let msg = 'Could not access camera. Please allow camera permissions.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser address bar.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera device found on this system.';
      }
      if (this.onStatusChange) this.onStatusChange(msg, false);
      throw err;
    }
  }

  stopCamera() {
    this.isTracking = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.onStatusChange) this.onStatusChange('Camera Stopped', false);
  }

  updateCanvasDimensions() {
    if (!this.video.videoWidth) return;
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
  }

  startProcessingLoop() {
    const process = async () => {
      if (!this.isTracking) return;

      if (!this.isProcessingFrame && this.video.readyState >= 2) {
        this.isProcessingFrame = true;
        try {
          await this.hands.send({ image: this.video });
        } catch (e) {
          console.warn('Frame send error:', e);
        } finally {
          this.isProcessingFrame = false;
        }

        // Measure FPS
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
          this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
          this.frameCount = 0;
          this.lastFpsUpdate = now;
          if (this.onFpsUpdate) this.onFpsUpdate(this.fps);
        }
      }

      this.animationFrameId = requestAnimationFrame(process);
    };

    this.animationFrameId = requestAnimationFrame(process);
  }

  handleResults(results) {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        if (this.showSkeleton) {
          this.drawStylizedHand(landmarks, this.ctx, this.canvas.width, this.canvas.height);
        }
      }

      if (this.onHandsDetected) {
        this.onHandsDetected(results.multiHandLandmarks, results.multiHandedness);
      }
    } else {
      if (this.onHandsDetected) {
        this.onHandsDetected([], []);
      }
    }

    this.ctx.restore();
  }

  /**
   * Render glowing futuristic hand skeleton and landmarks
   */
  drawStylizedHand(landmarks, ctx, width, height) {
    const HAND_CONNECTIONS = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm base
      [5, 9], [9, 13], [13, 17]
    ];

    // 1. Draw glowing bones/connections
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      const x1 = p1.x * width;
      const y1 = p1.y * height;
      const x2 = p2.x * width;
      const y2 = p2.y * height;

      // Glow gradient line
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.85)'); // Cyan
      grad.addColorStop(1, 'rgba(59, 130, 246, 0.85)'); // Blue

      ctx.strokeStyle = grad;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 2. Draw glowing joints and fingertips
    const TIPS = [4, 8, 12, 16, 20];

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const x = lm.x * width;
      const y = lm.y * height;
      const isTip = TIPS.includes(i);

      ctx.beginPath();
      if (isTip) {
        // Fingertip: large glowing pulse dot
        ctx.arc(x, y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#06b6d4';
        ctx.fill();
      } else {
        // Inner joint
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 6;
        ctx.fill();
      }
    }

    // Reset shadow
    ctx.shadowBlur = 0;
  }
}

window.HandDetector = HandDetector;
