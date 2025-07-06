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
    // return "A4" // testing value
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
    n = Math.round(12 * Math.log2(freq / A4));
    const index = ( (n%12) + 9 + 12) % 12;
    const octave = 4 + Math.floor((n + 9) / 12);
    console.log("offset, index, octave", n, index, octave)
    return notes[index] + octave;
}




let audioSource, audioContext, scriptProcessor;
let count = 0;
const maxFrequency = 2000;
const bufferSize = 1 << 12;
const size = bufferSize / (1 << 10);

let freq = -1

async function stopListening() {
    continueListening = false;
    audioContext.suspend()
}

async function nextNote() {
    targetNote = getRandomNote()
    renderNote(targetNote)
}

async function startListening() {


    continueListening = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    aubio().then(({ Pitch }) => {
        console.log("processing pitch start")
        const pitchDetector = new Pitch(
            "fcomb",
            processor.bufferSize * 4,
            processor.bufferSize,
            audioContext.sampleRate
        );
        const bufferSize = 1024;

        processor.addEventListener("audioprocess", function (event) {
            console.log("event listener")
        })
        processor.onaudioprocess = function (e) {
            console.log("processing pitch")
            const input = e.inputBuffer.getChannelData(0); // mono channel

            // aubio.js expects Float32Array
            const pitch = pitchDetector.do(input);
            if (pitch) {
                console.log("Detected pitch:", pitch);
                freq = pitch
            }
        }

    });
    source.connect(processor)
    processor.connect(audioContext.destination)

    const buffer = new Float32Array(analyser.fftSize);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    const canvas = document.getElementById("oscilloscope");
    const canvasCtx = canvas.getContext("2d");

    function draw() {

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = "rgb(200 200 200)";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0 0 0)";

        canvasCtx.beginPath();

        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    const detect = () => {
        draw()
        analyser.getFloatTimeDomainData(buffer);
        console.log("freq: ", freq)
        if (freq !== -1) {
            const detectedNote = frequencyToNote(freq);
            console.log("frequency is: ", freq, detectedNote)
            document.getElementById("result").textContent = `You played: ${detectedNote} (${Math.floor(freq)}) looking for ${targetNote} ${noteToFrequency(targetNote)}`;
            if (detectedNote === targetNote) {
                document.getElementById("greenCheck").textContent += " ✅ Correct!";
                setTimeout(requestAnimationFrame(function() {
                    nextNote();
                    document.getElementById("greenCheck").textContent = "";
                }), 2000);
            }
            setTimeout(requestAnimationFrame(detect), 2000);
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
    // targetNote = "A4"
    renderNote(targetNote);
};
