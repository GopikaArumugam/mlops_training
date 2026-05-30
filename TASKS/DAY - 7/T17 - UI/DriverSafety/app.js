// ==================== PREMIUM COCKPIT STATE STORAGE ====================
const state = {
  activeScreen: 'checkin', // 'checkin' | 'dashboard' | 'emergency'
  riskScore: 28,          // 0 to 100
  targetRiskScore: 28,    // For smooth counting transition
  operatorEmotion: 'Focused',
  eyeBlinkRate: 14,
  yawnCount: 0,
  drivingScore: 98,
  stressLevel: 12.4,      // percentage
  laneFocus: 96.8,
  speed: 72,
  gForce: 1.04,
  brakingPressure: 0.0,
  steeringRate: 0.2,
  tempAI: 41.2,
  
  // Historical data arrays for charts
  history: {
    fatigue: Array(25).fill(12),
    stress: Array(25).fill(14),
    risk: Array(25).fill(28)
  }
};

// Canvas animation handles
let faceMeshAnimationId;
let voiceWaveAnimationId;

// Face Mesh variables
let yawnAnimationProgress = 0; // 0 to 1
let eyeBlinkTimer = 0;
let isBlinking = false;
let forceYawn = false;

// Voice wave variables
let wavePhase = 0;

// Chat typing flag
let isTyping = false;

// ==================== INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', () => {
  // Update time initially and start interval
  updateTime();
  setInterval(updateTime, 1000);
  
  // Start canvas visualizers
  initFaceMeshCanvas();
  initVoiceWaveCanvas();
  initAnalyticsCharts();
  
  // Start periodic telemetry updates
  setInterval(updateTelemetryPhysics, 2500);
  
  // Smoothly count up risk values in rendering
  requestAnimationFrame(smoothUpdateLoop);
});

// Update Header HUD Time
function updateTime() {
  const clockElement = document.getElementById('hud-time');
  if (clockElement) {
    const now = new Date();
    clockElement.innerText = now.toTimeString().split(' ')[0];
  }
}

// Add system message to feed log
function addFeedLog(sender, message, type = 'normal') {
  const logFeed = document.getElementById('scrolling-log');
  if (!logFeed) return;
  
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  const logLine = document.createElement('div');
  logLine.className = 'log-row';
  
  if (type === 'orange') logLine.className += ' text-orange';
  if (type === 'red') logLine.className += ' text-red';
  
  logLine.innerHTML = `<span class="time">[${timeStr}]</span> ${message}`;
  logFeed.appendChild(logLine);
  
  // Scroll to bottom
  logFeed.scrollTop = logFeed.scrollHeight;
  
  // Truncate logs if too long
  if (logFeed.children.length > 50) {
    logFeed.removeChild(logFeed.firstChild);
  }
}

// ==================== CHECK-IN MECHANICS ====================
function submitCheckin(event) {
  event.preventDefault();
  const inputEl = document.getElementById('feelings-input');
  if (!inputEl) return;
  
  const rawText = inputEl.value.trim();
  if (!rawText) return;
  
  processPreflightInput(rawText);
}

function quickCheckin(type, label) {
  const inputEl = document.getElementById('feelings-input');
  if (inputEl) inputEl.value = label;
  
  let riskSeed = 28;
  let emotion = 'Focused';
  let responseText = '';
  
  if (type === 'tired') {
    riskSeed = 80;
    emotion = 'Sleepy';
    responseText = "Safety limits set for sleepy driver. Active driver alerts will start to help you stay awake.";
  } else if (type === 'stressed') {
    riskSeed = 52;
    emotion = 'Stressed';
    responseText = "Stressed state detected. Turning on driving help and setting clean air cooling for driver comfort.";
  } else if (type === 'fine') {
    riskSeed = 18;
    emotion = 'Focused';
    responseText = "Driver state looks great. Safety systems are active under normal levels. Have a nice drive.";
  } else if (type === 'angry') {
    riskSeed = 68;
    emotion = 'Agitated';
    responseText = "Tension or hurry detected. Making safety warnings faster to prioritize your safety.";
  }
  
  setInitialState(riskSeed, emotion, responseText);
}

function processPreflightInput(text) {
  const lowercaseText = text.toLowerCase();
  let riskSeed = 25;
  let emotion = 'Focused';
  let responseText = "Driver state checked. Setting driver safety limits for your support.";
  
  if (lowercaseText.includes('tired') || lowercaseText.includes('sleepy') || lowercaseText.includes('exhausted') || lowercaseText.includes('drowsy')) {
    riskSeed = 78;
    emotion = 'Sleepy';
    responseText = "Tiredness markers detected. Dashboard starting in Warning state. Auto lane assist and warning sounds are ready.";
  } else if (lowercaseText.includes('stressed') || lowercaseText.includes('anxious') || lowercaseText.includes('worry') || lowercaseText.includes('scared')) {
    riskSeed = 50;
    emotion = 'Stressed';
    responseText = "Stress levels recorded. Easy route helpers active. Adjusting air cooling for your comfort.";
  } else if (lowercaseText.includes('angry') || lowercaseText.includes('mad') || lowercaseText.includes('furious') || lowercaseText.includes('hate') || lowercaseText.includes('agitated')) {
    riskSeed = 65;
    emotion = 'Agitated';
    responseText = "Warning: Focus indicators show high tension. Auto-braking is now set to high response.";
  } else if (lowercaseText.includes('good') || lowercaseText.includes('fine') || lowercaseText.includes('great') || lowercaseText.includes('perfect') || lowercaseText.includes('happy') || lowercaseText.includes('focused')) {
    riskSeed = 15;
    emotion = 'Focused';
    responseText = "Excellent. Driver focus parameters look good. Standard safety systems active.";
  }
  
  setInitialState(riskSeed, emotion, responseText);
}

function setInitialState(risk, emotion, systemReply) {
  state.riskScore = risk;
  state.targetRiskScore = risk;
  state.operatorEmotion = emotion;
  state.stressLevel = risk * 0.7 + 5; // seed stress
  
  // Log checkin
  addFeedLog('AI', `Driver calibration complete. State: ${emotion} (${risk}% Risk Level)`, 'normal');
  
  // Transition screens
  const checkinScreen = document.getElementById('checkin-panel');
  const cockpitScreen = document.getElementById('cockpit-container');
  
  if (checkinScreen && cockpitScreen) {
    checkinScreen.style.opacity = '0';
    checkinScreen.style.transform = 'scale(0.97)';
    
    setTimeout(() => {
      checkinScreen.classList.add('hidden');
      cockpitScreen.classList.remove('hidden');
      
      // Inject AI initial chat bubble
      const messagesArea = document.getElementById('chat-messages');
      if (messagesArea) {
        messagesArea.innerHTML = ''; // clear initial placeholder
        addChatBubble('ADIS', systemReply, 'ai');
      }
      
      state.activeScreen = 'dashboard';
      
      addFeedLog('SYS', 'Tracking sensors active.', 'normal');
      addFeedLog('AI', 'ADIS active safety started.', 'normal');
      
      if (risk >= 70) {
        triggerWarningUI("Warning: Tracking indicators suggest driver fatigue. Active safety helpers enabled.");
      }
    }, 600);
  }
}

// ==================== CHATBOT NLP LOGIC ====================
function submitChat(event) {
  event.preventDefault();
  if (isTyping) return;
  
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  
  const text = chatInput.value.trim();
  if (!text) return;
  
  // User bubble
  addChatBubble('DRIVER', text, 'user');
  chatInput.value = '';
  
  // Analyze input
  isTyping = true;
  
  const thinkingDot = addChatBubble('ADIS', 'Analyzing voice pitch...', 'ai typing');
  
  setTimeout(() => {
    // Remove thinking indicator
    thinkingDot.remove();
    
    const lowercase = text.toLowerCase();
    let replyText = '';
    let emotionChange = state.operatorEmotion;
    let riskDelta = 0;
    
    if (lowercase.includes('sleepy') || lowercase.includes('tired') || lowercase.includes('exhausted') || lowercase.includes('yawn') || lowercase.includes('drowsy')) {
      riskDelta = 25;
      emotionChange = 'Sleepy';
      replyText = "Warning: Driver attention score is low. Eye-scan shows high sleepiness. Starting cooling air. Please consider taking a break.";
      forceYawn = true; // triggers yawn simulation inside canvas face silhouette!
      addFeedLog('AI', 'Warning: Yawning indicators observed.', 'orange');
    } else if (lowercase.includes('stressed') || lowercase.includes('anxious') || lowercase.includes('panic') || lowercase.includes('late')) {
      riskDelta = 15;
      emotionChange = 'Stressed';
      replyText = "Stress settings active. Driver stress is " + (state.stressLevel + 16).toFixed(1) + "%. Finding routes with lighter traffic.";
    } else if (lowercase.includes('angry') || lowercase.includes('mad') || lowercase.includes('frustrated') || lowercase.includes('idiot') || lowercase.includes('traffic') || lowercase.includes('agitated')) {
      riskDelta = 18;
      emotionChange = 'Agitated';
      replyText = "Voice pitch suggests you are in a hurry or upset. Making warning lights react faster to help you drive safely.";
    } else if (lowercase.includes('good') || lowercase.includes('fine') || lowercase.includes('happy') || lowercase.includes('calm') || lowercase.includes('perfect') || lowercase.includes('relax') || lowercase.includes('focused')) {
      riskDelta = -15;
      emotionChange = 'Focused';
      replyText = "State mapped as calm and relaxed. Active safety helpers are set to normal. Have a nice trip.";
    } else if (lowercase.includes('emergency') || lowercase.includes('accident') || lowercase.includes('crash') || lowercase.includes('stop') || lowercase.includes('help')) {
      state.targetRiskScore = 95;
      state.stressLevel = 90;
      state.operatorEmotion = 'Critical';
      addChatBubble('ADIS', "Warning: Safety override active. Pulling the car over safely now.", 'ai');
      triggerEmergencyHUD();
      isTyping = false;
      return;
    } else {
      replyText = "State checked. Driver attention looks good. Safe driving status active.";
    }
    
    // Update State
    state.operatorEmotion = emotionChange;
    state.targetRiskScore = Math.max(5, Math.min(99, state.targetRiskScore + riskDelta));
    state.stressLevel = Math.max(5, Math.min(95, state.stressLevel + (riskDelta * 0.7)));
    
    // Smooth chat typing effect
    addChatBubble('ADIS', replyText, 'ai');
    
    isTyping = false;
  }, 1000);
}

function addChatBubble(sender, message, className) {
  const chatArea = document.getElementById('chat-messages');
  if (!chatArea) return null;
  
  const bubble = document.createElement('div');
  bubble.className = `chat-message-row ${className}`;
  
  bubble.innerHTML = `
    <div class="sender-name">${sender}</div>
    <div class="message-content">${message}</div>
  `;
  
  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
  return bubble;
}

// ==================== SMOOTH UPDATE & GAUGE ANIMATION LOOP ====================
function smoothUpdateLoop() {
  // Smoothly slide current risk score towards target
  const diff = state.targetRiskScore - state.riskScore;
  if (Math.abs(diff) > 0.1) {
    state.riskScore += diff * 0.05; // ease toward target
  } else {
    state.riskScore = state.targetRiskScore;
  }
  
  // Render updates
  updateRiskMeterUI();
  
  // Check emergency threshold
  if (state.riskScore >= 80 && state.activeScreen !== 'emergency') {
    triggerEmergencyHUD();
  } else if (state.riskScore < 80 && state.activeScreen === 'emergency') {
    resetEmergencyMode();
  }
  
  requestAnimationFrame(smoothUpdateLoop);
}

function updateRiskMeterUI() {
  const riskValEl = document.getElementById('risk-value');
  const riskStateEl = document.getElementById('risk-state-label');
  const ringEl = document.getElementById('svg-fill-ring');
  const glowEl = document.getElementById('gauge-glow');
  const engineTag = document.getElementById('engine-status-tag');
  
  const heroCard = document.getElementById('status-hero-card');
  const heroText = document.getElementById('status-hero-text');
  
  if (!riskValEl || !ringEl) return;
  
  const risk = Math.round(state.riskScore);
  riskValEl.innerText = `${risk}%`;
  
  // SVG Ring fill Math: dashoffset has a track of 515 (approx for r=82)
  const offset = 515 - (515 * risk) / 100;
  ringEl.setAttribute('stroke-dashoffset', offset);
  
  // Update state label, colors, filters based on Risk Level
  if (risk < 40) {
    // SAFE - Ice Blue
    riskStateEl.innerText = "Nominal";
    riskStateEl.className = "readout-status state-safe";
    riskValEl.style.color = "var(--text-pure)";
    ringEl.setAttribute('stroke', 'url(#grad-safe)');
    glowEl.style.background = 'radial-gradient(circle, rgba(14, 165, 233, 0.14) 0%, transparent 70%)';
    if (engineTag) {
      engineTag.innerText = "System Calibrated";
      engineTag.className = "panel-badge-status status-safe";
    }
    
    // Update Hero Status Display
    if (heroCard && heroText) {
      heroCard.className = "active-status-hero-card state-safe-bg";
      heroText.innerText = "STATUS: SAFE & FOCUSED";
    }
  } else if (risk < 75) {
    // WARNING - Warm Gold
    riskStateEl.innerText = "Risk Elevated";
    riskStateEl.className = "readout-status state-warn";
    riskValEl.style.color = "var(--accent-gold)";
    ringEl.setAttribute('stroke', 'url(#grad-warn)');
    glowEl.style.background = 'radial-gradient(circle, rgba(202, 138, 4, 0.14) 0%, transparent 70%)';
    if (engineTag) {
      engineTag.innerText = "Context Warning";
      engineTag.className = "panel-badge-status state-warn";
      engineTag.style.color = "var(--accent-gold)";
      engineTag.style.borderColor = "rgba(202, 138, 4, 0.3)";
    }
    
    // Update Hero Status Display
    if (heroCard && heroText) {
      heroCard.className = "active-status-hero-card state-warn-bg";
      if (state.operatorEmotion === 'Sleepy') {
        heroText.innerText = "STATUS: SLEEPY WARNING";
      } else if (state.operatorEmotion === 'Stressed') {
        heroText.innerText = "STATUS: STRESSED WARNING";
      } else if (state.operatorEmotion === 'Agitated') {
        heroText.innerText = "STATUS: HURRIED WARNING";
      } else {
        heroText.innerText = "STATUS: ATTENTION WARNING";
      }
    }
  } else {
    // DANGER - Crimson
    riskStateEl.innerText = "Threat Critical";
    riskStateEl.className = "readout-status state-danger";
    riskValEl.style.color = "var(--accent-crimson)";
    ringEl.setAttribute('stroke', 'url(#grad-danger)');
    glowEl.style.background = 'radial-gradient(circle, rgba(185, 28, 28, 0.2) 0%, transparent 70%)';
    if (engineTag) {
      engineTag.innerText = "Impairment Flagged";
      engineTag.className = "panel-badge-status state-danger";
      engineTag.style.color = "var(--accent-crimson)";
      engineTag.style.borderColor = "rgba(185, 28, 28, 0.3)";
    }
    
    // Update Hero Status Display
    if (heroCard && heroText) {
      heroCard.className = "active-status-hero-card state-danger-bg";
      heroText.innerText = "STATUS: DRIVER IMPAIRED";
    }
  }
}

// ==================== VISUAL DIAGNOSTICS & SYSTEM WARNING BOX ====================
function triggerWarningUI(text) {
  const box = document.getElementById('warning-box');
  const boxText = document.getElementById('warning-box-text');
  const icon = document.getElementById('warning-banner-icon');
  if (!box || !boxText) return;
  
  boxText.innerText = text;
  
  if (state.riskScore >= 75) {
    box.style.borderColor = 'rgba(185, 28, 28, 0.25)';
    box.style.background = 'rgba(185, 28, 28, 0.02)';
    if (icon) {
      icon.innerText = '!';
      icon.style.background = 'rgba(185, 28, 28, 0.1)';
      icon.style.color = 'var(--accent-crimson)';
    }
  } else {
    box.style.borderColor = 'rgba(202, 138, 4, 0.25)';
    box.style.background = 'rgba(202, 138, 4, 0.02)';
    if (icon) {
      icon.innerText = '!';
      icon.style.background = 'rgba(202, 138, 4, 0.1)';
      icon.style.color = 'var(--accent-gold)';
    }
  }
}

function resetWarningUI() {
  const box = document.getElementById('warning-box');
  const boxText = document.getElementById('warning-box-text');
  const icon = document.getElementById('warning-banner-icon');
  if (!box || !boxText) return;
  
  boxText.innerText = "All parameters nominal. Driver cognitive focus maps as highly stable.";
  box.style.borderColor = 'rgba(255, 255, 255, 0.04)';
  box.style.background = 'rgba(255, 255, 255, 0.01)';
  if (icon) {
    icon.innerText = '✓';
    icon.style.background = 'rgba(14, 165, 233, 0.1)';
    icon.style.color = 'var(--accent-ice)';
  }
}

// ==================== CANVAS 1: SLEEK MINIMALIST HUMAN PROFILE OUTLINE ====================
function initFaceMeshCanvas() {
  const canvas = document.getElementById('canvas-face-mesh');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  function draw() {
    if (!ctx) return;
    
    // Set size dynamically
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = rect.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Eye Blinking logic
    eyeBlinkTimer++;
    if (eyeBlinkTimer > 180) { // blink every ~3 seconds (60fps * 3)
      isBlinking = true;
      if (eyeBlinkTimer > 190) {
        isBlinking = false;
        eyeBlinkTimer = 0;
      }
    }
    
    // Yawn stretch animation
    if (forceYawn) {
      yawnAnimationProgress += 0.05;
      if (yawnAnimationProgress >= 1) {
        state.yawnCount++;
        const yawnCounterEl = document.getElementById('metric-yawn');
        const fillYawnEl = document.getElementById('fill-yawn');
        if (yawnCounterEl) yawnCounterEl.innerText = `Flagged (${state.yawnCount})`;
        if (fillYawnEl) fillYawnEl.style.width = `${Math.min(100, state.yawnCount * 30 + 10)}%`;
        if (fillYawnEl) fillYawnEl.className = "row-progress-fill fill-normal state-tired";
        
        forceYawn = false;
      }
    } else if (yawnAnimationProgress > 0) {
      yawnAnimationProgress -= 0.03; // shrink back slowly
    }
    
    // Color determined by operator safety state - Luxury Palette
    let strokeColor = 'rgba(14, 165, 233, 0.4)';
    let highlightColor = 'rgba(14, 165, 233, 0.85)';
    let activeFill = 'rgba(14, 165, 233, 0.02)';
    
    if (state.riskScore >= 75) {
      strokeColor = 'rgba(185, 28, 28, 0.4)';
      highlightColor = 'rgba(185, 28, 28, 0.9)';
      activeFill = 'rgba(185, 28, 28, 0.03)';
    } else if (state.riskScore >= 40) {
      strokeColor = 'rgba(202, 138, 4, 0.4)';
      highlightColor = 'rgba(202, 138, 4, 0.9)';
      activeFill = 'rgba(202, 138, 4, 0.03)';
    }
    
    // Draw highly abstract, premium vector outline of a human face side-profile
    const startX = w / 2 - 35;
    const startY = h / 2 - 50;
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    
    // Forehead curve
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(startX + 30, startY - 10, startX + 50, startY + 10, startX + 50, startY + 30);
    
    // Nose bridge & tip
    ctx.lineTo(startX + 46, startY + 40);
    ctx.lineTo(startX + 60, startY + 45); // nose tip
    ctx.lineTo(startX + 48, startY + 52); // nose under
    
    // Lips & Mouth Area
    const mouthAperture = yawnAnimationProgress * 15;
    ctx.lineTo(startX + 50, startY + 58 - mouthAperture / 2);
    ctx.lineTo(startX + 45, startY + 61);
    ctx.lineTo(startX + 49, startY + 64 + mouthAperture / 2);
    
    // Chin & Jawline
    ctx.quadraticCurveTo(startX + 48, startY + 76, startX + 38, startY + 82); // chin
    ctx.lineTo(startX + 10, startY + 92); // jaw under
    ctx.bezierCurveTo(startX - 20, startY + 80, startX - 25, startY + 30, startX - 20, startY); // back head
    ctx.closePath();
    
    // Soft fill inside profile
    ctx.fillStyle = activeFill;
    ctx.fill();
    ctx.stroke();
    
    // Draw eye focus point (highly elegant)
    const eyeX = startX + 32;
    const eyeY = startY + 32;
    
    ctx.fillStyle = highlightColor;
    if (isBlinking) {
      // Sleek blink line
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(eyeX - 4, eyeY);
      ctx.lineTo(eyeX + 4, eyeY);
      ctx.stroke();
    } else {
      // Circular clean dot eye
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw minimalist floating biometric focus circles around profile head
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(w / 2 - 5, h / 2 - 10, 68, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = highlightColor + '20'; // thin focus ring
    ctx.beginPath();
    ctx.arc(w / 2 - 5, h / 2 - 10, 78, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    // Key breathing biometric focus nodes
    const nodes = [
      {x: eyeX, y: eyeY}, // eye
      {x: startX + 50, y: startY + 61}, // mouth
      {x: startX + 38, y: startY + 82}, // chin
      {x: startX - 5, y: startY + 25} // temple area
    ];
    
    nodes.forEach((n, idx) => {
      ctx.fillStyle = highlightColor;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Fine connecting hairline
      ctx.strokeStyle = highlightColor + '30';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(n.x + (n.x > w/2 ? 15 : -15), n.y - 12);
      ctx.stroke();
    });
    
    faceMeshAnimationId = requestAnimationFrame(draw);
  }
  
  draw();
}

// ==================== CANVAS 2: MINIMALIST ACOUSTIC SINWAVE ====================
function initVoiceWaveCanvas() {
  const canvas = document.getElementById('canvas-voice-wave');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  function draw() {
    if (!ctx) return;
    
    // Set size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = rect.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Determine color and speed of wave depending on Risk Score
    let waveColor = '#0ea5e9';
    let lineW = 1.2;
    let waveCount = 2;
    let speedMult = 0.8;
    let ampMult = 0.8;
    
    if (state.riskScore >= 75) {
      waveColor = '#b91c1c';
      speedMult = 2.0;
      ampMult = 1.8;
    } else if (state.riskScore >= 40) {
      waveColor = '#ca8a04';
      speedMult = 1.3;
      ampMult = 1.2;
    }
    
    wavePhase += 0.04 * speedMult;
    
    // Render 2 premium, highly clean sinewaves
    for (let j = 0; j < waveCount; j++) {
      ctx.beginPath();
      ctx.lineWidth = lineW - (j * 0.3);
      
      const opacity = 0.8 - (j * 0.4);
      ctx.strokeStyle = waveColor + Math.round(opacity * 255).toString(16).padStart(2, '0');
      
      const waveShift = j * Math.PI * 0.4;
      
      for (let x = 0; x < w; x++) {
        const angle = (x / w) * Math.PI * 3.5 + wavePhase + waveShift;
        const envelope = Math.sin((x / w) * Math.PI); // squeeze at ends
        const y = h / 2 + envelope * (Math.sin(angle) * 10 * ampMult);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    voiceWaveAnimationId = requestAnimationFrame(draw);
  }
  
  draw();
}

// ==================== CANVAS 3: SLEEK LUXURY TIMELINE CHARTS ====================
function initAnalyticsCharts() {
  const chartFatigue = document.getElementById('chart-fatigue');
  const chartStress = document.getElementById('chart-stress');
  const chartRisk = document.getElementById('chart-risk');
  
  function drawChart(canvas, dataArray, maxVal, accentColor) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set dimensions
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = rect.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw very clean subtle guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 0.5;
    
    // just 1 horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    
    if (dataArray.length === 0) return;
    
    // Calculate coordinates
    const stepX = w / (dataArray.length - 1);
    const coords = dataArray.map((val, idx) => {
      const x = idx * stepX;
      const ratio = Math.max(0, Math.min(100, val)) / maxVal;
      const y = h - (ratio * (h - 12)) - 6;
      return {x, y};
    });
    
    // Draw clean curve
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accentColor;
    
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      const xc = (coords[i - 1].x + coords[i].x) / 2;
      const yc = (coords[i - 1].y + coords[i].y) / 2;
      ctx.quadraticCurveTo(coords[i - 1].x, coords[i - 1].y, xc, yc);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
    ctx.stroke();
    
    // Soft undergradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, accentColor + '15'); // very transparent
    gradient.addColorStop(1, accentColor + '00');
    
    ctx.beginPath();
    ctx.moveTo(coords[0].x, h);
    ctx.lineTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      const xc = (coords[i - 1].x + coords[i].x) / 2;
      const yc = (coords[i - 1].y + coords[i].y) / 2;
      ctx.quadraticCurveTo(coords[i - 1].x, coords[i - 1].y, xc, yc);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw tiny circle indicator at the end
    const last = coords[coords.length - 1];
    ctx.beginPath();
    ctx.fillStyle = accentColor;
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  function updateChartsLoop() {
    let accent = 'rgba(14, 165, 233, 0.85)';
    if (state.riskScore >= 75) {
      accent = 'rgba(185, 28, 28, 0.85)';
    } else if (state.riskScore >= 40) {
      accent = 'rgba(202, 138, 4, 0.85)';
    }
    
    drawChart(chartFatigue, state.history.fatigue, 100, accent);
    drawChart(chartStress, state.history.stress, 100, accent);
    drawChart(chartRisk, state.history.risk, 100, accent);
    
    setTimeout(() => {
      requestAnimationFrame(updateChartsLoop);
    }, 600);
  }
  
  updateChartsLoop();
}

// ==================== SIMULATED TELEMETRY PHYSICS RANDOMIZER ====================
function updateTelemetryPhysics() {
  if (state.activeScreen === 'checkin') return;
  
  let multiplier = 1;
  if (state.operatorEmotion === 'Drowsy') multiplier = 2.4;
  else if (state.operatorEmotion === 'Stressed') multiplier = 1.6;
  else if (state.operatorEmotion === 'Agitated') multiplier = 2.0;
  
  // Random small shifts in metrics
  const riskVariance = (Math.random() - 0.45) * 3 * multiplier;
  state.targetRiskScore = Math.max(5, Math.min(99, state.targetRiskScore + riskVariance));
  
  const stressVariance = (Math.random() - 0.45) * 2.5 * multiplier;
  state.stressLevel = Math.max(5, Math.min(98, state.stressLevel + stressVariance));
  
  // Update Fatigue Index
  let currentFatigue = state.history.fatigue[state.history.fatigue.length - 1];
  let fatigueChange = (Math.random() - 0.45) * 1.8;
  if (state.operatorEmotion === 'Drowsy') fatigueChange += 0.8;
  currentFatigue = Math.max(5, Math.min(98, currentFatigue + fatigueChange));
  
  // Update behavior score based on risk
  if (state.riskScore > 75) {
    state.drivingScore = Math.max(45, state.drivingScore - Math.floor(Math.random() * 2));
    state.laneFocus = Math.max(70, state.laneFocus - (Math.random() * 1.5));
  } else {
    state.drivingScore = Math.min(100, state.drivingScore + (Math.random() > 0.85 ? 1 : 0));
    state.laneFocus = Math.min(100, state.laneFocus + (Math.random() - 0.4) * 0.4);
  }
  
  // Physics gauges
  state.gForce = (1.0 + Math.random() * 0.12).toFixed(2);
  state.steeringRate = ((Math.random() - 0.5) * 0.4).toFixed(2);
  
  // Update AI temp micro shifts
  state.tempAI = (40.5 + Math.random() * 1.2).toFixed(1);
  
  // Speed fluctuations
  if (state.riskScore > 85) {
    state.speed = Math.max(0, state.speed - 10);
  } else {
    state.speed = Math.round(69 + Math.random() * 4);
  }
  
  // Sync history logs
  state.history.fatigue.push(currentFatigue);
  state.history.stress.push(state.stressLevel);
  state.history.risk.push(state.riskScore);
  
  // Limit arrays to 25 items
  state.history.fatigue.shift();
  state.history.stress.shift();
  state.history.risk.shift();
  
  // Render these DOM elements
  syncTelemetryToDOM();
  
  // Push random HUD ticker system alerts
  triggerRandomSystemLogs();
}

function syncTelemetryToDOM() {
  // Biometric left dashboard
  const metricBlink = document.getElementById('metric-blink');
  const fillBlink = document.getElementById('fill-blink');
  const metricEmotion = document.getElementById('metric-emotion');
  const fillEmotion = document.getElementById('fill-emotion');
  
  if (metricBlink && fillBlink) {
    state.eyeBlinkRate = Math.round(13 + Math.random() * 4 + (state.operatorEmotion === 'Drowsy' ? 7 : 0));
    metricBlink.innerHTML = `${state.eyeBlinkRate} <small>bpm</small>`;
    fillBlink.style.width = `${Math.min(100, state.eyeBlinkRate * 4)}%`;
  }
  
  if (metricEmotion && fillEmotion) {
    metricEmotion.innerText = state.operatorEmotion;
    if (state.operatorEmotion === 'Drowsy') {
      metricEmotion.className = 'val state-tired';
      fillEmotion.style.backgroundColor = 'var(--accent-crimson)';
    } else if (state.operatorEmotion === 'Stressed') {
      metricEmotion.className = 'val state-stressed';
      fillEmotion.style.backgroundColor = 'var(--accent-gold)';
    } else if (state.operatorEmotion === 'Agitated') {
      metricEmotion.className = 'val state-stressed';
      fillEmotion.style.backgroundColor = 'var(--accent-gold)';
    } else {
      metricEmotion.className = 'val state-calm';
      fillEmotion.style.backgroundColor = 'var(--accent-ice)';
    }
  }
  
  // Physics gauges DOM
  const forceEl = document.getElementById('val-gforce');
  const brakingEl = document.getElementById('val-braking');
  const steeringEl = document.getElementById('val-steering');
  
  if (forceEl) forceEl.innerText = `${state.gForce}G`;
  if (brakingEl) brakingEl.innerText = `${state.brakingPressure}%`;
  if (steeringEl) steeringEl.innerText = `${state.steeringRate} nm`;
  
  // Right metrics DOM
  const stressLevelEl = document.getElementById('stress-level-label');
  const driverScoreEl = document.getElementById('driver-score');
  const laneFocusEl = document.getElementById('lane-focus');
  
  if (stressLevelEl) {
    const stressStr = state.stressLevel > 75 ? 'Critical' : state.stressLevel > 40 ? 'Moderate' : 'Stable';
    stressLevelEl.innerText = `${stressStr} (${state.stressLevel.toFixed(1)}%)`;
    if (stressStr === 'Critical') {
      stressLevelEl.className = 'val state-tired';
    } else if (stressStr === 'Moderate') {
      stressLevelEl.className = 'val state-stressed';
    } else {
      stressLevelEl.className = 'val state-calm';
    }
  }
  
  if (driverScoreEl) {
    driverScoreEl.innerText = state.drivingScore;
    if (state.drivingScore < 70) {
      driverScoreEl.className = 'val state-tired';
    } else if (state.drivingScore < 85) {
      driverScoreEl.className = 'val state-stressed';
    } else {
      driverScoreEl.className = 'val score-green';
    }
  }
  
  if (laneFocusEl) {
    laneFocusEl.innerText = `${state.laneFocus.toFixed(1)}%`;
    if (state.laneFocus < 75) {
      laneFocusEl.className = 'val state-tired';
    } else if (state.laneFocus < 90) {
      laneFocusEl.className = 'val state-stressed';
    } else {
      laneFocusEl.className = 'val score-cyan';
    }
  }
  
  // Header bar updates
  const hudSpeed = document.getElementById('hud-speed');
  const hudTemp = document.getElementById('hud-temp');
  
  if (hudSpeed) hudSpeed.innerText = state.speed;
  if (hudTemp) hudTemp.innerText = `${state.tempAI}°C`;
  
  // Analytics timelines values
  const timelinesFatigue = document.getElementById('timeline-fatigue-value');
  const timelinesStress = document.getElementById('timeline-stress-value');
  const timelinesRisk = document.getElementById('timeline-risk-value');
  
  if (timelinesFatigue) timelinesFatigue.innerText = `${state.history.fatigue[state.history.fatigue.length - 1].toFixed(1)}%`;
  if (timelinesStress) timelinesStress.innerText = `${state.stressLevel.toFixed(1)}%`;
  if (timelinesRisk) timelinesRisk.innerText = `${state.riskScore.toFixed(1)}%`;
  
  // Warning Box system suggestions
  if (state.riskScore >= 75) {
    triggerWarningUI("Safety Override: High risk level. Pulling the car over safely.");
  } else if (state.riskScore >= 45) {
    triggerWarningUI("Warning: Mild tiredness detected. Comfort cooling settings are active.");
  } else {
    resetWarningUI();
  }
}

function triggerRandomSystemLogs() {
  const alertsList = [
    'Face tracking sensors checked.',
    'Comfort air loop is active.',
    'Lane keeping systems active.',
    'Driver tracking matches safe profiles.',
    'Front distance sensor safe.',
  ];
  
  const headerTickerList = [
    "Driver tracking active • System safe",
    "Active cruise control running smoothly",
    "Driver attention level looks normal",
    "Lane focus algorithms tracking well"
  ];
  
  if (Math.random() > 0.8) {
    const alert = alertsList[Math.floor(Math.random() * alertsList.length)];
    if (state.riskScore < 50) {
      addFeedLog('AI', alert, 'normal');
    }
  }
  
  // Warning logs when in danger state
  if (state.riskScore >= 75 && Math.random() > 0.45) {
    addFeedLog('AI', 'Warning: Long eye closures detected.', 'red');
    addFeedLog('SYS', 'Front distance warning active.', 'orange');
  }
  
  // Ticker update
  if (Math.random() > 0.85) {
    const tickerContent = document.getElementById('header-ticker');
    if (tickerContent) {
      if (state.riskScore >= 75) {
        tickerContent.innerText = "Warning: Safety indicators suggest driver fatigue.";
        tickerContent.style.color = "var(--accent-crimson)";
      } else if (state.riskScore >= 45) {
        tickerContent.innerText = "Driver attention warning. Comfort cooling started.";
        tickerContent.style.color = "var(--accent-gold)";
      } else {
        tickerContent.innerText = headerTickerList[Math.floor(Math.random() * headerTickerList.length)];
        tickerContent.style.color = "var(--text-secondary)";
      }
    }
  }
}

// ==================== EMERGENCY OVERLAY SYSTEM MODE ====================
function triggerEmergencyHUD() {
  state.activeScreen = 'emergency';
  
  const overlay = document.getElementById('emergency-overlay');
  const speedText = document.getElementById('em-speed');
  
  if (overlay) {
    overlay.classList.remove('hidden');
    
    // Animate speed in alert banner
    if (speedText) speedText.innerText = `${state.speed} mph`;
    
    addFeedLog('SYS', 'Emergency override active.', 'red');
    addFeedLog('AI', 'Safety threat: Safe stop prepared.', 'red');
  }
}

function resetEmergencyMode() {
  state.activeScreen = 'dashboard';
  state.targetRiskScore = 28;
  state.stressLevel = 15;
  state.operatorEmotion = 'Focused';
  
  const overlay = document.getElementById('emergency-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  
  // Reset all active SOS buttons
  const cards = document.querySelectorAll('.sos-card');
  cards.forEach(card => {
    card.classList.remove('sos-triggered');
  });
  
  // reset button text overrides
  document.querySelector('.call-active p').innerText = "Call emergency dispatch right now.";
  document.querySelector('.location-active p').innerText = "Send live location details to safety units.";
  document.querySelector('.family-active p').innerText = "Send quick text warnings to family numbers.";
  
  resetWarningUI();
  addFeedLog('SYS', 'Driver cleared safety override.', 'normal');
  addFeedLog('AI', 'Resetting attention sensors to standard level.', 'normal');
}

function triggerEmergencyAction(actionType) {
  if (actionType === 'emergency_call') {
    const card = document.querySelector('.call-active');
    card.classList.add('sos-triggered');
    card.querySelector('p').innerText = "SOS call placed successfully.";
    addFeedLog('SOS', 'DOWNEY unit linked. Emergency dispatch active.', 'red');
  }
  
  if (actionType === 'location') {
    const card = document.querySelector('.location-active');
    card.classList.add('sos-triggered');
    card.querySelector('p').innerText = "GPS location coordinates shared.";
    addFeedLog('SOS', 'Broadcasting link: 37.7749° N, 122.4194° W', 'orange');
  }
  
  if (actionType === 'notify_family') {
    const card = document.querySelector('.family-active');
    card.classList.add('sos-triggered');
    card.querySelector('p').innerText = "Emergency SMS sent to contacts.";
    addFeedLog('SOS', 'Distress alerts dispatched to family sector.', 'red');
  }
  
  if (actionType === 'emergency_stop') {
    addFeedLog('SYS', 'Autonomous safe stop started. Decelerating...', 'red');
    
    // Slow vehicle physics down smoothly
    const slowDownInterval = setInterval(() => {
      state.speed = Math.max(0, state.speed - 12);
      const speedText = document.getElementById('em-speed');
      const hudSpeed = document.getElementById('hud-speed');
      
      if (speedText) speedText.innerText = `${state.speed} mph`;
      if (hudSpeed) hudSpeed.innerText = state.speed;
      
      if (state.speed === 0) {
        clearInterval(slowDownInterval);
        addFeedLog('SYS', 'Safe stop completed successfully.', 'normal');
        addChatBubble('ADIS', "Safe stop completed. Responders have been alerted. Click the button below when you are ready to reset.", 'ai');
      }
    }, 450);
  }
}
