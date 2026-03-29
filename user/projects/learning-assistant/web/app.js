/**
 * Muse Learning Assistant - app.js
 * Frontend logic, state machine, and API integration.
 */

class MuseApp {
    constructor() {
        this.state = 'idle'; // idle, listening, thinking, speaking
        this.autoPlay = true;
        this.isMockMode = true;
        this.history = [];
        this.currentMessageElement = null;
        this.freeMicEnabled = false;
        this.pendingVoiceText = null;
        
        // DOM Elements
        this.elements = {
            body: document.body,
            statusIndicator: document.getElementById('status-indicator'),
            dialogueArea: document.getElementById('dialogue-area'),
            textInput: document.getElementById('text-input'),
            sendBtn: document.getElementById('send-btn'),
            voiceBtn: document.getElementById('voice-btn'),
            autoPlayToggle: document.getElementById('auto-play-toggle'),
            interimContainer: document.getElementById('interim-results'),
            interimText: document.getElementById('interim-text'),
            speechPreview: document.getElementById('speech-preview'),
            speechPreviewText: document.getElementById('speech-preview-text'),
            speechPreviewStatus: document.getElementById('speech-preview-status'),
            notesSidebar: document.getElementById('notes-sidebar'),
            notesContent: document.getElementById('notes-content'),
            toggleNotesBtn: document.getElementById('toggle-notes'),
            closeNotesBtn: document.getElementById('close-notes'),
            exportNotesBtn: document.getElementById('export-notes'),
            mockModeToggle: document.getElementById('mock-mode-toggle')
        };

        this.recognition = null;
        this.audioPlayer = new Audio();
        
        this.init();
    }

    init() {
        this.initSpeechRecognition();
        this.setupEventListeners();
        this.updateState('idle');
        this.updateVoiceButton();
        
        // Load settings from localStorage if any
        const savedAutoPlay = localStorage.getItem('autoPlay');
        if (savedAutoPlay !== null) {
            this.autoPlay = savedAutoPlay === 'true';
            this.elements.autoPlayToggle.checked = this.autoPlay;
        }

        console.log('Muse App Initialized');
    }

    setupEventListeners() {
        // Text Input
        this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.elements.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });

        // Voice Control
        this.elements.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Settings
        this.elements.autoPlayToggle.addEventListener('change', (e) => {
            this.autoPlay = e.target.checked;
            localStorage.setItem('autoPlay', this.autoPlay);
        });
        
        this.elements.mockModeToggle.addEventListener('change', (e) => {
            this.isMockMode = e.target.checked;
            console.log('Mock Mode:', this.isMockMode);
        });

        // Notes
        this.elements.toggleNotesBtn.addEventListener('click', () => {
            this.elements.notesSidebar.classList.toggle('closed');
        });
        this.elements.closeNotesBtn.addEventListener('click', () => {
            this.elements.notesSidebar.classList.add('closed');
        });
        this.elements.exportNotesBtn.addEventListener('click', () => this.exportNotes());

        // Audio Player Events
        this.audioPlayer.addEventListener('ended', () => {
            if (this.state === 'speaking') {
                this.updateState('idle');
                this.resumeFreeMicIfNeeded();
            }
        });
        this.audioPlayer.addEventListener('error', (e) => {
            console.error('Audio player error:', e);
            if (this.state === 'speaking') {
                this.updateState('idle');
                this.resumeFreeMicIfNeeded();
            }
        });
    }

    updateState(newState) {
        console.log(`State transition: ${this.state} -> ${newState}`);
        this.state = newState;
        
        // Update UI classes
        this.elements.body.className = `state-${newState}`;
        
        // Update status text
        const statusMap = {
            idle: '闲置',
            listening: '正在听...',
            thinking: '思考中...',
            speaking: '正在说话'
        };
        this.elements.statusIndicator.textContent = statusMap[newState] || newState;

        // Handle specific state side effects
        if (newState === 'listening') {
            this.elements.interimContainer.classList.remove('hidden');
            this.elements.speechPreview.classList.remove('hidden');
            if (!this.elements.speechPreviewText.textContent.trim()) {
                this.elements.speechPreviewStatus.textContent = '实时识别中';
            }
        } else {
            this.elements.interimContainer.classList.add('hidden');
            this.elements.interimText.textContent = '';
        }

        // Disable text triggers when thinking. Free mic button stays usable
        // so the user can close it even while waiting for a reply.
        const isThinking = (newState === 'thinking');
        this.elements.textInput.disabled = isThinking;
        this.elements.sendBtn.disabled = isThinking;
        this.updateVoiceButton();
    }

    // --- Speech Recognition ---

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Web Speech API is not supported in this browser.');
            this.elements.voiceBtn.disabled = true;
            this.elements.voiceBtn.title = '浏览器不支持语音识别';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-CN';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.updateState('listening');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            this.elements.interimText.textContent = interimTranscript || finalTranscript;
            this.updateSpeechPreview(interimTranscript || finalTranscript, Boolean(finalTranscript));
            
            if (finalTranscript) {
                console.log('Final Transcript:', finalTranscript);
                this.pendingVoiceText = finalTranscript.trim();
                this.elements.textInput.value = this.pendingVoiceText;
                this.recognition.stop();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.elements.speechPreview.classList.remove('hidden');
            this.elements.speechPreviewStatus.textContent = '识别失败';
            this.updateState('idle');
        };

        this.recognition.onend = () => {
            if (this.state === 'listening') {
                this.updateState('idle');
            }
            if (this.pendingVoiceText) {
                const text = this.pendingVoiceText;
                this.pendingVoiceText = null;
                this.handleSendMessage(text);
                return;
            }
            this.resumeFreeMicIfNeeded();
        };
    }

    toggleVoiceInput() {
        if (!this.recognition) return;

        if (this.freeMicEnabled) {
            this.freeMicEnabled = false;
            this.pendingVoiceText = null;
            if (this.state === 'listening') {
                this.recognition.stop();
            }
            this.updateVoiceButton();
            return;
        }

        this.freeMicEnabled = true;
        if (!this.audioPlayer.paused) {
            this.audioPlayer.pause();
            if (this.state === 'speaking') {
                this.updateState('idle');
            }
        }
        if (this.state === 'idle') {
            this.startListening();
        }
        this.updateVoiceButton();
    }

    startListening() {
        if (!this.recognition || this.state === 'thinking') return;
        try {
            this.recognition.start();
        } catch (error) {
            console.warn('Speech recognition start skipped:', error.message);
        }
    }

    resumeFreeMicIfNeeded() {
        if (!this.freeMicEnabled) return;
        if (this.state !== 'idle') return;
        setTimeout(() => {
            if (this.freeMicEnabled && this.state === 'idle') {
                this.startListening();
            }
        }, 250);
    }

    updateVoiceButton() {
        const label = this.elements.voiceBtn.querySelector('.label');
        this.elements.voiceBtn.classList.toggle('is-active', this.freeMicEnabled);
        this.elements.voiceBtn.disabled = !this.recognition;
        if (label) {
            label.textContent = this.freeMicEnabled ? '关闭自由麦' : '自由麦';
        }
    }

    updateSpeechPreview(text, isFinal = false) {
        const normalized = (text || '').trim();
        if (!normalized) return;
        this.elements.speechPreview.classList.remove('hidden');
        this.elements.speechPreview.classList.toggle('is-final', isFinal);
        this.elements.speechPreviewText.textContent = normalized;
        this.elements.speechPreviewStatus.textContent = isFinal ? '已识别' : '实时识别中';
    }

    clearSpeechPreview() {
        this.elements.speechPreviewText.textContent = '';
        this.elements.speechPreviewStatus.textContent = '实时识别中';
        this.elements.speechPreview.classList.remove('is-final');
        if (!this.freeMicEnabled && this.state !== 'listening') {
            this.elements.speechPreview.classList.add('hidden');
        }
    }

    // --- Messaging ---

    handleSendMessage(forcedText = null) {
        const text = forcedText || this.elements.textInput.value.trim();
        if (!text || this.state === 'thinking') return;

        this.elements.textInput.value = '';
        if (!forcedText) {
            this.clearSpeechPreview();
        }
        this.addMessage('user', text);
        
        // Push user turn to history
        this.history.push({ role: 'user', content: text });
        if (this.history.length > 20) this.history.shift();

        this.fetchResponse(text);
    }

    addMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.textContent = content;
        
        msgDiv.appendChild(contentDiv);
        this.elements.dialogueArea.appendChild(msgDiv);
        this.scrollToBottom();
        
        return msgDiv;
    }

    updateAssistantMessage(element, content, isIncremental = true) {
        const contentDiv = element.querySelector('.content');
        if (isIncremental) {
            contentDiv.textContent += content;
        } else {
            contentDiv.textContent = content;
        }
        this.scrollToBottom();
    }

    addContextTag(element, contextItems) {
        if (!contextItems || contextItems.length === 0) return;
        
        const tag = document.createElement('span');
        tag.className = 'context-tag';
        const titles = contextItems.map(item => `📖 ${item.file}`).join(', ');
        tag.textContent = `基于: ${titles}`;
        
        element.insertBefore(tag, element.firstChild);
    }

    scrollToBottom() {
        this.elements.dialogueArea.scrollTop = this.elements.dialogueArea.scrollHeight;
    }

    // --- API / Backend ---

    async fetchResponse(message) {
        this.updateState('thinking');
        
        const assistantMsgElement = this.addMessage('assistant', '');
        let fullText = '';

        if (this.isMockMode) {
            this.handleMockSSE(message, assistantMsgElement);
            return;
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: this.history,
                    mode: 'study'
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            this.handleSSEEvent(data, assistantMsgElement);
                            if (data.type === 'token') fullText += data.content;
                        } catch (e) {
                            console.error('Error parsing SSE data', e);
                        }
                    }
                }
            }
            
            this.onResponseDone(fullText);

        } catch (error) {
            console.error('Fetch error:', error);
            this.updateAssistantMessage(assistantMsgElement, '抱歉，连接服务器出错。', false);
            this.updateState('idle');
        }
    }

    handleSSEEvent(data, element) {
        switch (data.type) {
            case 'context':
                this.addContextTag(element, data.items);
                break;
            case 'token':
                this.updateAssistantMessage(element, data.content);
                break;
            case 'done':
                // Final full text might be in data.fullText
                break;
        }
    }

    onResponseDone(fullText) {
        this.history.push({ role: 'assistant', content: fullText });
        if (this.history.length > 20) this.history.shift();
        
        if (this.autoPlay && fullText) {
            this.playTTS(fullText);
        } else {
            this.updateState('idle');
            this.resumeFreeMicIfNeeded();
        }
    }

    async playTTS(text) {
        this.updateState('speaking');

        if (this.isMockMode) {
            console.log('Mock TTS playing:', text);
            // Simulate playing time based on text length
            setTimeout(() => {
                if (this.state === 'speaking') this.updateState('idle');
            }, Math.min(3000, text.length * 100));
            return;
        }

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: 'default' })
            });

            if (!response.ok) throw new Error('TTS request failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            this.audioPlayer.src = url;
            this.audioPlayer.play();
        } catch (error) {
            console.error('TTS error:', error);
            this.updateState('idle');
        }
    }

    // --- Mock Implementation ---

    handleMockSSE(message, element) {
        const mockResponses = [
            {
                context: [{ file: 'F2-Transformer' }],
                tokens: ["Self-", "Attention", " 的", "核心", "是", "让", "每个", " token", " 都能", "看到", "序列中", "的其他", "所有", " token", "。"]
            },
            {
                context: [{ file: 'unit01-Agent-Core' }],
                tokens: ["Agent", " 的", "核心", "组件", "通常", "包含", "：", "规划", "、", "记忆", "和", "工具", "使用", "。"]
            }
        ];

        const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        
        // 1. Send context
        setTimeout(() => {
            this.handleSSEEvent({ type: 'context', items: response.context }, element);
            
            // 2. Stream tokens
            let i = 0;
            let fullText = '';
            const interval = setInterval(() => {
                if (i < response.tokens.length) {
                    const token = response.tokens[i];
                    this.handleSSEEvent({ type: 'token', content: token }, element);
                    fullText += token;
                    i++;
                } else {
                    clearInterval(interval);
                    this.handleSSEEvent({ type: 'done', fullText }, element);
                    this.onResponseDone(fullText);
                }
            }, 100);
        }, 500);
    }

    // --- Notes ---

    exportNotes() {
        const content = this.elements.notesContent.innerText;
        if (!content.trim()) {
            alert('没有笔记可导出');
            return;
        }

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `muse-notes-${date}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Instantiate the app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new MuseApp();
});
