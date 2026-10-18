# 🤟 VoxSign AI — Sign Language to Speech Synthesizer

> **Assistive Web Technology bridging the communication barrier for mute and speech-impaired individuals.**

VoxSign is a real-time web application that detects sign language gestures through your computer's webcam, interprets what the person is communicating using client-side AI and geometric computer vision, and speaks the message aloud through the computer speaker using Text-to-Speech synthesis.

---

## 🌟 Key Features

1. **Real-Time Webcam Detection**:
   - Powered by Google MediaPipe Hands (WebAssembly / GPU accelerated).
   - Tracks 21 3D hand landmarks per hand with high accuracy and low latency.
   - Beautiful glowing skeletal overlay with pulsating joint and fingertip tracking.

2. **Everyday Needs & Emergency Sign Vocabulary**:
   - 🆘 **Emergency / Help**: Immediate distress notification and audible siren alarm.
   - 💧 **Water**: *"I need water, please"* (ASL 'W' handshape).
   - 🍽️ **Food / Hungry**: *"I am hungry, I want food"* (eating cup handshape).
   - 🚽 **Restroom**: *"I need to use the restroom"* (ASL 'T' handshape).
   - ❤️ **I Love You**: Universal ASL ILY sign.
   - 👍 **Yes / Agree**: Thumbs up.
   - 👎 **No / Disagree**: Thumbs down.
   - ✋ **Stop / Wait**: Flat palm forward.
   - 👋 **Hello / Greetings**: Open hand spread.
   - 👌 **OK / Good**: Thumb and index touching.
   - 🤙 **Call Someone / Phone**: Thumb and pinky extended.
   - ✌️ **Peace / Two**: Index and middle spread in V.
   - ☝️ **Look / Attention**: Index finger pointing up.
   - 🩺 **Doctor / Medical**: Two fingers pointing down.

3. **ASL Alphabet & Numbers Spelling Mode**:
   - Switch between **Daily Needs & Phrases** and **Alphabet & Numbers** (A-Z, 1-5) to spell custom words and names letter-by-letter.

4. **✨ Custom Gesture Trainer**:
   - Train personal custom hand signs!
   - Capture hand gestures with a 3-second recording countdown, assign any phrase or sentence you want, and save it to your browser. VoxSign will recognize and speak your personalized signs in real time.

5. **🔊 Speaker Audio Output (Text-to-Speech)**:
   - Uses the Web Speech API with customizable voice, speaking rate, pitch, and volume.
   - Confirmation audio chime whenever a sign is locked and confirmed.
   - Emergency SOS siren sound for urgent assistance.
   - Large captions banner for deaf or hard-of-hearing conversational partners to read on-screen.

6. **📝 Sentence Builder & Speech History**:
   - Accumulate multiple signs or letters into full sentences before speaking.
   - History log with timestamps and one-click replay buttons.

---

## 🚀 How to Run the Website

### Method 1: One-Click Launch (Recommended for Windows)
1. Navigate to the project folder:
   ```
   C:\Users\DELL\.gemini\antigravity\scratch\sign-to-speech
   ```
2. Double-click the file named **`start_app.bat`**.
3. A local server will start, and your web browser (Edge/Chrome) will open automatically at **`http://localhost:8080/`**.
4. When prompted by your browser, click **"Allow"** to grant webcam access.

### Method 2: Launch via PowerShell
1. Open PowerShell and run:
   ```powershell
   cd C:\Users\DELL\.gemini\antigravity\scratch\sign-to-speech
   .\server.ps1
   ```

---

## 🛠️ Technology Stack
- **AI & Computer Vision**: Google MediaPipe Hands (CDN, zero npm dependencies needed).
- **Speech Engine**: HTML5 Web Speech Synthesis API (`window.speechSynthesis`).
- **Sound Effects & Siren**: Web Audio API (`AudioContext`, `OscillatorNode`).
- **Frontend**: HTML5, Canvas 2D, Vanilla JavaScript (ES6+), Modern Responsive CSS with Glassmorphism.
- **Server**: Zero-dependency PowerShell HTTP Server (`System.Net.HttpListener`).

---

## 📖 How to Use
1. **Show your hand** to the webcam. Make sure your hand is visible and well-lit.
2. Form any sign (refer to the **📖 Sign Guide** button in the header if you want to see all gestures).
3. **Hold the sign steady** for ~0.7 seconds. You will see a circular progress ring fill up on your screen.
4. When the ring completes, VoxSign will chime and **speak the phrase aloud through your speakers**!
