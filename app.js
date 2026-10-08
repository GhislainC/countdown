'use strict';

// Configuration default values
let config = {
    countdownDuration: 2700, // Default 45 mins in seconds
    warningThreshold: 120    // Default 2 mins in seconds
};

// Application state/context
let context = {
    remainingTime: 2700,
    warningThreshold: 120,
    isPaused: true,
    isStarted: false,
    timeOnly: false
};

let messageDisplayed = false;
let countdownInterval = null;

// DOM Elements
const countdownElement = document.getElementById('countdown');
const messageElement = document.getElementById('message');
const currentTimeElement = document.getElementById('current-time');
const configElement = document.getElementById('config');
const messageEditorElement = document.getElementById('message-editor');
const modalOverlay = document.getElementById('modal-overlay');
const closeConfigButton = document.getElementById('closeConfig');
const closeMessageButton = document.getElementById('closeMessage');
const mainControlsElements = document.getElementById('main_controls');
const progressBar = document.getElementById('progress-bar');

const durationInput = document.getElementById('duration');
const thresholdInput = document.getElementById('threshold');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const add1minButton = document.getElementById('add1min');
const add5minButton = document.getElementById('add5min');
const add10minButton = document.getElementById('add10min');
const sub1minButton = document.getElementById('sub1min');
const sub5minButton = document.getElementById('sub5min');
const sub10minButton = document.getElementById('sub10min');
const timeOnlyButton = document.getElementById('timeOnly');
const toggleConfigButton = document.getElementById('toggleConfig');
const toggleMessageButton = document.getElementById('toggleMessage');
const sendMessageButton = document.getElementById('send_message');
const messageContentInput = document.getElementById('message-content');
const messageDurationInput = document.getElementById('message-duration');
const messageColorInput = document.getElementById('message-color');

// Session Identifier
let session_id = null;
let i_am_master = false;
let masterExists = false;
const own_id = crypto.randomUUID();

const fragments = new URLSearchParams(window.location.hash.substring(1));
session_id = fragments.get('session') || '';
if (!session_id) {
    session_id = crypto.randomUUID();
}

const bc = new BroadcastChannel(`countdown.${session_id}`);
console.log(`session_id=${session_id}`);

// Wake Lock API management
let wakeLock = null;

async function setScreenAwake(shouldKeepAwake) {
    if (shouldKeepAwake) {
        if (!wakeLock) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Écran verrouillé pour rester allumé.');
            } catch (err) {
                console.error("Erreur lors de l'activation du Wake Lock:", err);
            }
        }
    } else {
        if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
            console.log('Écran peut maintenant se verrouiller.');
        }
    }
}

window.addEventListener('beforeunload', () => {
    setScreenAwake(false);
    sendCmd('master-dead', { id: own_id });
    bc.close();
});

// BroadcastChannel message handling
bc.onmessage = (event) => {
    const data = event.data;
    if (!data) return;

    console.log(`Broadcast from ${data.sender}: ${JSON.stringify(data)}`);

    if (!i_am_master && data.context) {
        context = data.context;
        updateCountdown();
        updatePause();
    }

    if (data.config) {
        config = data.config;
    }

    if (data.cmd) {
        switch (data.cmd.name) {
            case 'start':
                closeModals();
                initStart();
                startCountdown();
                break;
            case 'hello':
                if (i_am_master) {
                    sendCmd('master-exists', { id: own_id });
                }
                break;
            case 'master-exists':
                if (!i_am_master) {
                    console.log('Another master exists:', data.cmd.data?.id);
                    masterExists = true;
                }
                document.title = `CD m=${i_am_master} s=${session_id}`;
                break;
            case 'pause':
                context.isPaused = data.cmd.data;
                updatePause();
                sendContext();
                break;
            case 'timeOnly':
                context.timeOnly = data.cmd.data;
                initStart();
                startCountdown();
                updateTimeOnly();
                context.isPaused = !context.timeOnly;
                updatePause();
                sendContext();
                updateCountdown();
                updateCurrentTime();
                break;
            case 'addTime':
                if (i_am_master) {
                    addTime(data.cmd.data);
                }
                break;
            case 'subtractTime':
                if (i_am_master) {
                    subtractTime(data.cmd.data);
                }
                break;
            case 'message':
                if (data.cmd.data) {
                    display_message(
                        data.cmd.data.message,
                        data.cmd.data.timeout,
                        data.cmd.data.bgcolor
                    );
                }
                break;
        }
    }
};

function announcePresence() {
    sendCmd('hello', { id: own_id });
}

function electMaster() {
    masterExists = false;
    announcePresence();

    setTimeout(() => {
        if (!masterExists) {
            i_am_master = true;
            console.log('🟢 I am the new master:', own_id);
            sendCmd('new-master', { id: own_id });
        } else {
            console.log('🔵 I am a slave:', own_id);
        }
        document.title = `CD m=${i_am_master} s=${session_id}`;
    }, 500);
}

electMaster();

// Auto-hide Control Bar Logic
let hideControlsTimeout = null;

function resetControlsTimeout() {
    if (!mainControlsElements) return;

    mainControlsElements.classList.remove('autohide');
    clearTimeout(hideControlsTimeout);

    // If modal is open, don't auto-hide
    const isModalOpen = !configElement.classList.contains('hidden') || !messageEditorElement.classList.contains('hidden');
    if (isModalOpen) return;

    hideControlsTimeout = setTimeout(() => {
        mainControlsElements.classList.add('autohide');
    }, 3000);
}

['mousemove', 'mousedown', 'keydown', 'touchstart', 'pointermove'].forEach(eventType => {
    window.addEventListener(eventType, resetControlsTimeout, { passive: true });
});
resetControlsTimeout();

// Modal Overlay & Close Management
function closeModals() {
    configElement.classList.add('hidden');
    messageEditorElement.classList.add('hidden');
    modalOverlay.classList.add('hidden');
    resetControlsTimeout();
}

function openModal(modalEl) {
    closeModals();
    modalEl.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
    resetControlsTimeout();
}

modalOverlay.addEventListener('click', closeModals);
if (closeConfigButton) closeConfigButton.addEventListener('click', closeModals);
if (closeMessageButton) closeMessageButton.addEventListener('click', closeModals);

// Message Display Management
function display_message(message, timeout, bgcolor) {
    messageDisplayed = true;
    messageElement.textContent = message;

    document.body.classList.remove('state-warning', 'state-alert');

    if (bgcolor === 'amber') {
        document.body.style.backgroundColor = '#d97706';
        document.body.style.color = '#ffffff';
    } else if (bgcolor === 'red') {
        document.body.style.backgroundColor = '#dc2626';
        document.body.style.color = '#ffffff';
    } else if (bgcolor === 'green') {
        document.body.style.backgroundColor = '#16a34a';
        document.body.style.color = '#ffffff';
    } else {
        document.body.style.backgroundColor = '#0b0f19';
        document.body.style.color = '#ffffff';
    }

    countdownElement.classList.add('hidden');
    currentTimeElement.classList.add('hidden');
    messageElement.classList.remove('hidden');

    setTimeout(() => {
        messageDisplayed = false;
        document.body.style.backgroundColor = '';
        document.body.style.color = '';
        currentTimeElement.classList.remove('hidden');
        countdownElement.classList.remove('hidden');
        messageElement.classList.add('hidden');
        updateCountdown();
    }, timeout);
}

function sendContext() {
    if (i_am_master) {
        bc.postMessage({ sender: own_id, context: context });
    }
}

function sendConfig() {
    bc.postMessage({ sender: own_id, config: config });
}

function sendCmd(cmd_name, data) {
    bc.postMessage({
        sender: own_id,
        cmd: {
            name: cmd_name,
            data: data
        }
    });
}

// Time Formatting
function formatCountdownTime(seconds) {
    const mins = String(Math.floor(Math.abs(seconds) / 60)).padStart(2, '0');
    const secs = String(Math.abs(seconds) % 60).padStart(2, '0');
    return `${seconds < 0 ? '-' : ''}${mins}:${secs}`;
}

function capitalize(s) {
    if (!s) return '';
    return String(s[0]).toUpperCase() + String(s).slice(1);
}

function formatCurrentTime(showDate = true, showTime = true) {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, '0');
    const month = capitalize(now.toLocaleString('default', { month: 'long' }));
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ret = [];
    if (showDate) {
        ret.push(`${day} ${month} ${year}`);
    }
    if (showTime) {
        ret.push(`${hours}:${minutes}`);
    }
    return ret.join(' ');
}

function updateCurrentTime() {
    currentTimeElement.textContent = formatCurrentTime(true, !context.timeOnly);
}

// Progress Bar Management
function updateProgressBar() {
    if (!progressBar) return;

    if (context.timeOnly) {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = 'var(--primary-color)';
        return;
    }

    const totalDuration = config.countdownDuration || 1;
    let percentage = (context.remainingTime / totalDuration) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    progressBar.style.width = `${percentage}%`;

    if (context.remainingTime <= 0) {
        progressBar.style.backgroundColor = 'var(--alert-bg)';
    } else if (context.remainingTime <= context.warningThreshold) {
        progressBar.style.backgroundColor = 'var(--warning-bg)';
    } else {
        progressBar.style.backgroundColor = 'var(--primary-color)';
    }
}

// Countdown Loop & Render
function updateCountdown() {
    if (context.timeOnly) {
        if (!messageDisplayed) {
            countdownElement.textContent = formatCurrentTime(false, true);
        }
    } else {
        if (!context.isPaused) {
            if (i_am_master) {
                context.isStarted = true;
                context.remainingTime--;
                sendContext();
            }
        }
        if (!messageDisplayed) {
            countdownElement.textContent = formatCountdownTime(context.remainingTime);
        }
    }

    updatePauseLabel();
    updateProgressBar();

    if (!messageDisplayed) {
        document.body.classList.remove('state-warning', 'state-alert');
        if (!context.timeOnly && context.remainingTime <= context.warningThreshold && context.remainingTime > 0) {
            document.body.classList.add('state-warning');
        } else if (!context.timeOnly && context.remainingTime <= 0) {
            document.body.classList.add('state-alert');
        }
    }
}

// Start Countdown
function startCountdown() {
    countdownElement.textContent = formatCountdownTime(context.remainingTime);

    clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);

    closeModals();
    setScreenAwake(true);
    updatePause();
    sendContext();
}

function configureStart() {
    config.countdownDuration = (parseInt(durationInput.value, 10) || 0) * 60;
    config.warningThreshold = parseInt(thresholdInput.value, 10) || 0;

    closeModals();

    context.timeOnly = false;
    sendCmd('timeOnly', context.timeOnly);
    updateTimeOnly();
    updateTimeOnlyLabel();

    sendConfig();
    initStart();
    startCountdown();
    sendCmd('start');
}

function initStart() {
    if (i_am_master) {
        context.isStarted = false;
        context.remainingTime = config.countdownDuration;
        context.warningThreshold = config.warningThreshold;
        context.isPaused = true;
    }
}

function togglePause() {
    context.isPaused = !context.isPaused;
    updatePause();
    sendCmd('pause', context.isPaused);
}

function updatePauseLabel() {
    if (context.isStarted) {
        pauseButton.textContent = context.isPaused ? 'Reprendre' : 'Pause';
    } else {
        pauseButton.textContent = 'Démarrer';
    }
}

function updatePause() {
    updatePauseLabel();
    if (context.isPaused) {
        pauseButton.classList.add('btn-danger');
        setScreenAwake(false);
    } else {
        pauseButton.classList.remove('btn-danger');
        setScreenAwake(true);
    }
}

function addTime(seconds) {
    if (i_am_master) {
        context.remainingTime += seconds;
        countdownElement.textContent = formatCountdownTime(context.remainingTime);
        updateProgressBar();
        sendContext();
    } else {
        sendCmd('addTime', seconds);
    }
}

function subtractTime(seconds) {
    if (i_am_master) {
        context.remainingTime -= seconds;
        countdownElement.textContent = formatCountdownTime(context.remainingTime);
        updateProgressBar();
        sendContext();
    } else {
        sendCmd('subtractTime', seconds);
    }
}

function toggleConfig() {
    if (!configElement.classList.contains('hidden')) {
        closeModals();
    } else {
        openModal(configElement);
    }
}

function toggleMessage() {
    if (!messageEditorElement.classList.contains('hidden')) {
        closeModals();
    } else {
        openModal(messageEditorElement);
    }
}

function toggleTimeOnly() {
    context.timeOnly = !context.timeOnly;
    initStart();
    startCountdown();
    updateTimeOnly();
    sendCmd('timeOnly', context.timeOnly);
    updateCountdown();
    updateCurrentTime();
}

function updateTimeOnlyLabel() {
    timeOnlyButton.textContent = context.timeOnly ? 'Chrono' : 'Heure';
}

function updateTimeOnly() {
    updateTimeOnlyLabel();
    if (context.timeOnly) {
        timeOnlyButton.classList.add('btn-active');
        setScreenAwake(true);
    } else {
        timeOnlyButton.classList.remove('btn-active');
        setScreenAwake(!context.isPaused);
    }
}

function display_message_action() {
    const duration = (parseInt(messageDurationInput.value, 10) || 0) * 1000;
    const content = messageContentInput.value;
    const color = messageColorInput.value;

    closeModals();
    display_message(content, duration, color);
    sendCmd('message', {
        timeout: duration,
        message: content,
        bgcolor: color
    });
}

// Keyboard Shortcuts Listener
window.addEventListener('keydown', (e) => {
    // Ignore shortcuts if active element is an input or select
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
        if (e.key === 'Escape') {
            closeModals();
        }
        return;
    }

    switch (e.key) {
        case ' ':
            e.preventDefault();
            togglePause();
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            toggleConfig();
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            toggleMessage();
            break;
        case 't':
        case 'T':
            e.preventDefault();
            toggleTimeOnly();
            break;
        case 'Escape':
            closeModals();
            break;
    }
});

// Timers initialization
setInterval(updateCurrentTime, 1000);
updateCurrentTime();
updateProgressBar();

// Event Attachments
startButton.addEventListener('click', configureStart);
pauseButton.addEventListener('click', togglePause);
add1minButton.addEventListener('click', () => addTime(60));
add5minButton.addEventListener('click', () => addTime(300));
add10minButton.addEventListener('click', () => addTime(600));
sub1minButton.addEventListener('click', () => subtractTime(60));
sub5minButton.addEventListener('click', () => subtractTime(300));
sub10minButton.addEventListener('click', () => subtractTime(600));
toggleConfigButton.addEventListener('click', toggleConfig);
toggleMessageButton.addEventListener('click', toggleMessage);
timeOnlyButton.addEventListener('click', toggleTimeOnly);
sendMessageButton.addEventListener('click', display_message_action);
