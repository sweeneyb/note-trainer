const VF = Vex.Flow;
const notesList = [
  "C3", "D3", "E3", "F3", "G3", "A3", "B3",
  "C4", "D4", "E4", "F4", "G4", "A4", "B4",
  "C5", "D5", "E5", "F5", "G5", "A5", "B5"
];
let targetNote = "";
let continueListening = false;

function getRandomNote() {
  return notesList[Math.floor(Math.random() * notesList.length)];
}

function renderNote(note) {
    const div = document.getElementById("staff");
    div.innerHTML = ""; // clear previous
  
    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = Vex.Flow;
  
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();
  
    const isBass = parseInt(note.slice(-1)) < 4;
    const staveY = isBass ? 100 : 40;
  
    const stave = new Stave(10, staveY, 400);
    stave.addClef(isBass ? "bass" : "treble");
    stave.setContext(context).draw();
  
    const keys = [note[0].toLowerCase() + "/" + note.slice(-1)];
    const staveNote = new StaveNote({
      clef: isBass ? "bass" : "treble",
      keys: keys,
      duration: "q"
    });
  
    // Add accidental if necessary (e.g. natural, sharp, flat)
    if (note.includes("#")) {
      staveNote.addAccidental(0, new Accidental("#"));
    } else if (note.includes("b")) {
      staveNote.addAccidental(0, new Accidental("b"));
    }
  
    const voice = new Voice({ num_beats: 1, beat_value: 4 });
    voice.addTickables([staveNote]);
  
    new Formatter().joinVoices([voice]).format([voice], 400);
    voice.draw(context, stave);
  }
function noteToFrequency(note) {
  const A4 = 440;
  const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitones = noteMap[note[0]] + (note[1] === "#" ? 1 : 0);
  const octave = parseInt(note[note.length - 1]);
  const n = semitones + (octave - 4) * 12;
  return A4 * Math.pow(2, n / 12);
}

function frequencyToNote(freq) {
  const A4 = 440;
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const n = Math.round(12 * Math.log2(freq / A4));
  const index = (n + 9 + 12) % 12;
  const octave = 4 + Math.floor((n + 9) / 12);
  return notes[index] + octave;
}

async function stopListening() {
    continueListening = false;
}

async function startListening() {
  continueListening = true;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);

  function autoCorrelate(buf, sampleRate) {
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;
    const size = buf.length;

    for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / size);
    console.log("rms",rms)
    // if (rms < 0.01) {
    //     console.log("too quiet")
    //     return -1; // too quiet
    // }

    let lastCorrelation = 1;
    for (let offset = 8; offset < size / 2; offset++) {
      let correlation = 0;

      for (let i = 0; i < size / 2; i++)
        correlation += buf[i] * buf[i + offset];

      correlation = correlation / (size / 2);
    //   console.log("correlation", correlation)
    //   if (correlation > 0.9 && correlation > lastCorrelation) {
      if (correlation > 0.01 && correlation > lastCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
      lastCorrelation = correlation;
    }

    if (bestOffset === -1) return -1;
    console.log("rate, offset", sampleRate, bestOffset)
    return sampleRate / bestOffset;
  }

  const detect = () => {
    analyser.getFloatTimeDomainData(buffer);
    const freq = autoCorrelate(buffer, audioContext.sampleRate);
    console.log("freq: ", freq)
    if (freq !== -1) {
      const detectedNote = frequencyToNote(freq);
      console.log("frequency is:", detectedNote)
      document.getElementById("result").textContent = `You played: ${detectedNote}`;
      if (detectedNote === targetNote) {
        document.getElementById("result").textContent += " ✅ Correct!";
      }
    } else {
        console.log("frequency is -1")
        if (continueListening == true) {
            requestAnimationFrame(detect);
        }
    }
    
  };

  detect();
}

window.onload = () => {
  targetNote = getRandomNote();
  renderNote(targetNote);
};
