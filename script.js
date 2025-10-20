document.addEventListener("DOMContentLoaded", () => {
  // --- CORE AUDIO & STATE VARIABLES ---
  let audioContext;
  let masterGain, analyser;
  const mixerGains = {};
  const activeSources = {};
  const waveforms = ["sine", "square", "sawtooth", "triangle"];

  // --- INITIALIZATION ---
  function initAudio() {
    if (audioContext) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioContext.createGain();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      masterGain.connect(analyser);
      analyser.connect(audioContext.destination);

      waveforms.forEach((wave) => {
        const slider = document.querySelector(`#${wave}-knob input`);
        mixerGains[wave] = audioContext.createGain();
        mixerGains[wave].gain.setValueAtTime(slider ? parseFloat(slider.value) : 0, audioContext.currentTime);
        mixerGains[wave].connect(masterGain);
      });

      const volumeSlider = document.querySelector("#volume-knob input");
      masterGain.gain.setValueAtTime(parseFloat(volumeSlider.value), audioContext.currentTime);

      drawVisualizer();
    } catch (e) {
      alert("Seu navegador não suporta a Web Audio API.");
      console.error(e);
    }
  }

  function createButtons() {
    const notePad = document.getElementById("note-pad");
    notePad.innerHTML = "";

    const noteLayout = [
      { name: "Dó", type: "white", colorClass: "note-do" },
      { name: "Dó#", type: "black" },
      { name: "Ré", type: "white", colorClass: "note-re" },
      { name: "Ré#", type: "black" },
      { name: "Mi", type: "white", colorClass: "note-mi" },
      { name: "Fá", type: "white", colorClass: "note-fa" },
      { name: "Fá#", type: "black" },
      { name: "Sol", type: "white", colorClass: "note-sol" },
      { name: "Sol#", type: "black" },
      { name: "Lá", type: "white", colorClass: "note-la" },
      { name: "Lá#", type: "black" },
      { name: "Si", type: "white", colorClass: "note-si" },
    ];

    const A4_FREQ = 440;
    const C1_MIDI_NOTE = 24;
    let whiteKeyCount = 0;
    let lastWhiteKeyContainer = null;

    for (let i = 0; i < 9 * 12; i++) {
      const midiNote = C1_MIDI_NOTE + i;
      const freq = A4_FREQ * Math.pow(2, (midiNote - 69) / 12);

      const octave = Math.floor(midiNote / 12) - 1;
      const noteInfo = noteLayout[midiNote % 12];

      if (octave < 1 || octave > 9) continue;

      const noteNameDisplay = `${noteInfo.name.replace("#", "♯")}${octave}`;
      const button = document.createElement("button");

      button.dataset.frequency = freq;
      button.dataset.noteName = noteNameDisplay;
      button.innerHTML = `<span class="note-name">${noteNameDisplay}</span><span class="note-freq">${Math.round(freq)} Hz</span>`;
      button.addEventListener("click", () => toggleNote(button));

      if (noteInfo.type === "white") {
        const keyContainer = document.createElement("div");
        keyContainer.className = "relative h-full";
        keyContainer.style.flexShrink = 0;

        button.className = `note-btn white-key flex flex-col items-center justify-end rounded-md shadow-md transition-all duration-150 ease-in-out transform hover:scale-105 ${noteInfo.colorClass}`;
        keyContainer.appendChild(button);
        notePad.appendChild(keyContainer);
        lastWhiteKeyContainer = keyContainer;
        whiteKeyCount++;
      } else {
        button.className = "note-btn black-key flex flex-col items-center justify-end shadow-md transition-all duration-150 ease-in-out transform hover:scale-105";
        if (lastWhiteKeyContainer) {
          lastWhiteKeyContainer.appendChild(button);
        }
      }
    }
    notePad.style.width = `calc(var(--btn-width) * ${whiteKeyCount})`;
  }

  function toggleNote(button) {
    initAudio();
    const noteName = button.dataset.noteName;
    const freq = parseFloat(button.dataset.frequency);
    if (activeSources[noteName]) {
      stopNote(noteName, button);
    } else {
      playNote(noteName, freq, button);
    }
  }

  function playNote(noteName, freq, button) {
    if (activeSources[noteName]) return;
    const noteGroup = { sources: [] };
    waveforms.forEach((wave) => {
      const sourceGain = mixerGains[wave];
      if (!sourceGain) return;

      let source = audioContext.createOscillator();
      source.frequency.setValueAtTime(freq, audioContext.currentTime);
      source.type = wave;

      source.connect(sourceGain);
      source.start();
      noteGroup.sources.push(source);
    });
    activeSources[noteName] = noteGroup;
    if (button) button.classList.add("btn-active");
  }

  function stopNote(noteName, button) {
    const noteGroup = activeSources[noteName];
    if (!noteGroup) return;
    const now = audioContext.currentTime;
    noteGroup.sources.forEach((source) => {
      source.stop(now);
    });
    delete activeSources[noteName];
    if (button) button.classList.remove("btn-active");
  }

  function centerOnMiddleC() {
    const notePadContainer = document.querySelector(".note-pad-container");
    const middleCButton = notePadContainer.querySelector('[data-note-name="Dó4"]');

    if (middleCButton) {
      const keyContainer = middleCButton.parentElement;
      const keyPosition = keyContainer.offsetLeft;
      const keyWidth = keyContainer.offsetWidth;
      const containerWidth = notePadContainer.offsetWidth;

      notePadContainer.scrollLeft = keyPosition - containerWidth / 2 + keyWidth / 2;
    }
  }

  function setupKnob(controlElement) {
    const knob = controlElement.querySelector(".knob");
    const indicator = controlElement.querySelector(".knob-indicator");
    const slider = controlElement.querySelector("input[type=range]");
    const valueSpan = controlElement.querySelector(".value-display");
    let isDragging = false,
      startY = 0,
      startValue = 0;
    const min = parseFloat(slider.min),
      max = parseFloat(slider.max);
    const updateVisuals = (value) => {
      const normalizedValue = (value - min) / (max - min);
      indicator.style.transform = `rotate(${normalizedValue * 270 - 135}deg)`;
      valueSpan.textContent = `${Math.round(value * 100)}%`;
    };
    updateVisuals(parseFloat(slider.value));
    const dragStart = (clientY) => {
      isDragging = true;
      startY = clientY;
      startValue = parseFloat(slider.value);
      document.body.style.cursor = "ns-resize";
    };
    const dragMove = (clientY) => {
      if (!isDragging) return;
      const deltaY = startY - clientY;
      const range = max - min;
      const newValue = Math.max(min, Math.min(max, startValue + (deltaY / 150) * (range / 1)));
      slider.value = newValue;
      updateVisuals(newValue);
      slider.dispatchEvent(new Event("input"));
    };
    const dragEnd = () => {
      isDragging = false;
      document.body.style.cursor = "default";
    };
    knob.addEventListener("mousedown", (e) => dragStart(e.clientY));
    knob.addEventListener("touchstart", (e) => dragStart(e.touches[0].clientY), { passive: true });
    window.addEventListener("mousemove", (e) => {
      if (isDragging) dragMove(e.clientY);
    });
    window.addEventListener("touchmove", (e) => {
      if (isDragging && e.touches[0]) dragMove(e.touches[0].clientY);
    });
    window.addEventListener("mouseup", dragEnd);
    window.addEventListener("touchend", dragEnd);
  }

  function setupEventListeners() {
    document.querySelectorAll(".control-knob").forEach(setupKnob);
    document.querySelectorAll('[id$="-knob"] input[type="range"]').forEach((slider) => {
      const knobId = slider.closest(".control-knob").id;
      const wave = knobId.replace("-knob", "");
      slider.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        if (audioContext && mixerGains[wave]) {
          mixerGains[wave].gain.setTargetAtTime(value, audioContext.currentTime, 0.01);
        }
      });
    });
    document
      .getElementById("volume-knob")
      .querySelector("input")
      .addEventListener("input", (e) => {
        if (masterGain) masterGain.gain.setTargetAtTime(parseFloat(e.target.value), audioContext.currentTime, 0.01);
      });
    document.getElementById("stop-all").addEventListener("click", () => {
      Object.keys(activeSources).forEach((noteName) => {
        const btn = document.querySelector(`[data-note-name="${noteName}"]`);
        stopNote(noteName, btn);
      });
    });

    const notePadContainer = document.querySelector(".note-pad-container");
    notePadContainer.addEventListener("wheel", (e) => {
      e.preventDefault();
      notePadContainer.scrollLeft += e.deltaY;
    });
  }

  function drawVisualizer() {
    const canvas = document.getElementById("visualizer");
    const canvasCtx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      canvasCtx.fillStyle = "rgb(0, 0, 0)";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "rgb(52, 211, 153)";
      canvasCtx.beginPath();
      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };
    draw();
  }

  createButtons();
  setupEventListeners();
  centerOnMiddleC();
});
