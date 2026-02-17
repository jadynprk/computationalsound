document.addEventListener("DOMContentLoaded", function(event) {

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain(); //this will control the volume of all notes
    globalGain.gain.setValueAtTime(0.6, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);
    const waveformSelect = document.getElementById("waveform");
    const synthModeSelect = document.getElementById("synthMode");
    const MAX_MASTER_GAIN = 0.7;

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const balls = [];
    const GRAVITY = 0.4;
    const BOUNCE = 0.8;


    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
        '73': 1046.5022612023945,   //I - C
        
    }

    const params = {
        // Global
        attack: 0.02,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        masterVolume: 0.8,

        // Additive
        partials: 5,

        // AM
        amFrequency: 100,
        amDepth: 0.8,

        // FM
        fmFrequency: 100,
        fmIndex: 200
    };

    function bindSlider(id, paramName) {
        const slider = document.getElementById(id);
        slider.addEventListener("input", e => {
            params[paramName] = parseFloat(e.target.value);
        });
    }

    bindSlider("attack", "attack");
    bindSlider("decay", "decay");
    bindSlider("sustain", "sustain");
    bindSlider("release", "release");

    bindSlider("fmFrequency", "fmFrequency");
    bindSlider("fmIndex", "fmIndex");


    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    let activeOscillators = {}

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
        playNote(key);
        spawnBall(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();

        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            const { oscillators, gain } = activeOscillators[key];

            // Release phase
            const now = audioCtx.currentTime;
            const releaseTime = params.release;
            
            // smooth fade out
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

            // stop oscillator after release time
            oscillators.forEach(osc => osc.stop(now + releaseTime));

            delete activeOscillators[key];
            doPolyphonyGain(); // adjust gain for remaining notes
        }
    }

    function playNote(key) {
        const mode = synthModeSelect.value;

        if (mode === "additive") {
            playAdditive(key);
        } else if (mode === "lfo") {
            playLFO(key);
        } else if (mode === "am") {
            playAM(key);
        } else if (mode === "fm") {
            playFM(key);
        }
    }

    function createEnvelope() {
        const now = audioCtx.currentTime;

        const envelope = audioCtx.createGain();

        envelope.gain.setValueAtTime(0.0001, now);

        // Attack
        envelope.gain.exponentialRampToValueAtTime(
            1,
            now + params.attack
        );

        // Decay
        envelope.gain.exponentialRampToValueAtTime(
            params.sustain,
            now + params.attack + params.decay
        );

        envelope.connect(globalGain);

        return envelope;
    }

    function playAdditive(key) {
        const now = audioCtx.currentTime;
        const baseFreq = keyboardFrequencyMap[key];

        const envelope = createEnvelope();

        // hardcoded partials
        const partials = [
            { ratio: 1, amp: 0.5 },
            { ratio: 2, amp: 0.2 },
            { ratio: 3, amp: 0.1 }
        ];

        const oscillators = [];

        partials.forEach(partial => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.frequency.setValueAtTime(baseFreq * partial.ratio, now);
            osc.type = waveformSelect.value;
            gain.gain.setValueAtTime(partial.amp, now);
            
            osc.connect(gain);
            gain.connect(envelope);
            osc.start();
            
            oscillators.push(osc);
        });

        activeOscillators[key] = {
            oscillators: oscillators,
            gain: envelope
        };

        doPolyphonyGain();
    }

    function playLFO(key) {
        const now = audioCtx.currentTime;
        const baseFreq = keyboardFrequencyMap[key];

        const envelope = createEnvelope();

        // hardcoded partials
        const partials = [
            { ratio: 1, amp: 0.5 },
            { ratio: 2, amp: 0.2 },
            { ratio: 3, amp: 0.1 }
        ];

        const oscillators = [];

        partials.forEach(partial => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.frequency.setValueAtTime(baseFreq * partial.ratio, now);
            osc.type = waveformSelect.value;
            gain.gain.setValueAtTime(partial.amp, now);
            
            osc.connect(gain);
            gain.connect(envelope);
            osc.start();
            
            oscillators.push(osc);
        });

        activeOscillators[key] = {
            oscillators: oscillators,
            gain: envelope
        };

        // LFO

        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 6;
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 10;
        lfo.connect(lfoGain).connect(oscillators[1].frequency);
        lfo.start();

        doPolyphonyGain();
    }

    function playAM(key) {
        const now = audioCtx.currentTime;
        const baseFreq = keyboardFrequencyMap[key];

        const envelope = createEnvelope();

        const carrier = audioCtx.createOscillator();
        carrier.frequency.setValueAtTime(baseFreq, now);
        carrier.type = waveformSelect.value;

        const modulator = audioCtx.createOscillator();
        modulator.frequency.setValueAtTime(100, now);
        modulator.type = "sine";

        const depth = audioCtx.createGain();
        depth.gain.setValueAtTime(0.8, now);

        const modulated = audioCtx.createGain();
        modulated.gain.setValueAtTime(1 - depth.gain.value, now);

        modulator.connect(depth).connect(modulated.gain);
        carrier.connect(modulated);
        modulated.connect(envelope);
        
        carrier.start();
        modulator.start();

        activeOscillators[key] = {
            oscillators: [carrier, modulator],
            gain: envelope
        };

        doPolyphonyGain();
    }

    function playFM(key) {
        const now = audioCtx.currentTime;
        const baseFreq = keyboardFrequencyMap[key];

        const envelope = createEnvelope();

        const carrier = audioCtx.createOscillator();
        carrier.frequency.setValueAtTime(baseFreq, now);
        carrier.type = waveformSelect.value;

        const modulator = audioCtx.createOscillator();
        modulator.frequency.setValueAtTime(params.fmFrequency, now);
        modulator.type = "sine";

        const modulationIndex = audioCtx.createGain();
        modulationIndex.gain.setValueAtTime(params.fmIndex, now); 

        modulator.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency);
        carrier.connect(envelope);

        carrier.start();
        modulator.start();

        activeOscillators[key] = {
            oscillators: [carrier, modulator],
            gain: envelope
        };

        doPolyphonyGain();
    }



    function doPolyphonyGain() {
        const count = Object.keys(activeOscillators).length;
        if (count == 0) return;

        const targetGain = MAX_MASTER_GAIN / count;

        for (const key in activeOscillators) {
            const gainNode = activeOscillators[key].gain;
            gainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.01);
        }


    }

    function spawnBall(key) {
        const radius = 10;

        balls.push({
            x: Math.random() * (canvas.width - 2 * radius) + radius,
            y: radius,
            vx: (Math.random() - 0.5) * 8,
            vy: 0,
            radius: radius,
            color: getColorForKey(key)
        });
    }

    function getColorForKey(key) {
        const freq = keyboardFrequencyMap[key];

        const minFreq = 260;
        const maxFreq = 1000;

        const hue = ((freq - minFreq) / (maxFreq - minFreq)) * 360;

        return `hsl(${hue}, 100%, 50%)`;
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (const ball of balls) {
            ball.vy += GRAVITY;
            ball.x += ball.vx;
            ball.y += ball.vy;

            if (ball.y + ball.radius > canvas.height) {
            ball.y = canvas.height - ball.radius;
            ball.vy *= -BOUNCE;
            }

            if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
                ball.vx *= -1;
            }

            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = ball.color;
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    animate();

});
