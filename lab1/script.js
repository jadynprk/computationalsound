document.addEventListener("DOMContentLoaded", function(event) {

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain(); //this will control the volume of all notes
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);
    const waveformSelect = document.getElementById("waveform");
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
    }

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    activeOscillators = {}

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
            const { osc, gain } = activeOscillators[key];

            // Release phase
            const now = audioCtx.currentTime;
            const releaseTime = 0.3;
            // smooth fade out
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

            // stop oscillator after release time
            osc.stop(now + releaseTime);

            delete activeOscillators[key];
            doPolyphonyGain(); // adjust gain for remaining notes
        }
    }

    function playNote(key) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        const now = audioCtx.currentTime;
        const numKeys = Object.keys(activeOscillators).length + 1;
        const targetGain = MAX_MASTER_GAIN / numKeys;

        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], now);
        osc.type = waveformSelect.value;

        // ASDR
        gainNode.gain.setValueAtTime(0.0001, now);

        gainNode.gain.exponentialRampToValueAtTime(
            targetGain,
            now + 0.02
        );

        osc.connect(gainNode);
        gainNode.connect(globalGain);

        osc.start();

        activeOscillators[key] = { osc, gain: gainNode };

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
