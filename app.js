const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const frequencyInput = document.getElementById('frequency');
const messagesDiv = document.getElementById('messages');
const beepSound = document.getElementById('beepSound');

let localStream;
let peerConnection;
let signalingChannel;

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Create a simple signaling mechanism using WebSocket
function connectSignalingServer() {
    signalingChannel = new WebSocket('ws://localhost:3000'); // Set your server here

    signalingChannel.onmessage = (message) => {
        const data = JSON.parse(message.data);
        handleSignalingData(data);
    };
}

function handleSignalingData(data) {
    switch (data.type) {
        case 'offer':
            createAnswer(data.offer);
            break;
        case 'answer':
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
        case 'candidate':
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;
    }
}

function startCommunication() {
    const frequency = parseInt(frequencyInput.value);
    if (frequency < 1 || frequency > 20) {
        alert("Please select a frequency between 1 and 20.");
        return;
    }
    addMessage(`Communication started on frequency ${frequency}.`);
    playBeepSound();
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            localStream = stream;
            connectSignalingServer();
            setupPeerConnection();
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        })
        .catch(error => {
            console.error("Error accessing media devices.", error);
        });
}

function stopCommunication() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        localStream.getTracks().forEach(track => track.stop());
    }
    addMessage("Communication stopped.");
    playBeepSound();
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingChannel.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
            }));
        }
    };
    
    peerConnection.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    createOffer();
}

function createOffer() {
    peerConnection.createOffer()
        .then(offer => {
            peerConnection.setLocalDescription(offer);
            signalingChannel.send(JSON.stringify({
                type: 'offer',
                offer: offer,
            }));
        })
        .catch(error => {
            console.error("Error creating offer: ", error);
        });
}

function createAnswer(offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            return peerConnection.createAnswer();
        })
        .then(answer => {
            peerConnection.setLocalDescription(answer);
            signalingChannel.send(JSON.stringify({
                type: 'answer',
                answer: answer,
            }));
        })
        .catch(error => {
            console.error("Error creating answer: ", error);
        });
}

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function playBeepSound() {
    beepSound.currentTime = 0;
    beepSound.play();
}

// Event listeners
startButton.addEventListener('click', startCommunication);
stopButton.addEventListener('click', stopCommunication);

// Service Worker Registration for Offline Capabilities
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
        });
}
