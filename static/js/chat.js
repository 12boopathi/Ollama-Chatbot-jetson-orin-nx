class OllamaChat {
    constructor() {
        this.selectedModel = null;
        this.chatHistory = [];
        this.isStreaming = true;
        
        // Voice recording properties
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingTimer = null;
        this.recordingSeconds = 0;
        
        this.initializeEventListeners();
        this.checkConnection();
        this.checkVoiceSupport();
    }
    
    initializeEventListeners() {
        // Model selection
        $('#modelSelect').on('change', (e) => {
            this.selectModel(e.target.value);
        });
        
        // Chat form submission
        $('#chatForm').on('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Clear chat
        $('#clearChat').on('click', () => {
            this.clearChat();
        });
        
        // Refresh models
        $('#refreshModels').on('click', () => {
            this.refreshModels();
        });
        
        // Stream toggle
        $('#streamToggle').on('change', (e) => {
            this.isStreaming = e.target.checked;
        });
        
        // Enter key handling
        $('#messageInput').on('keypress', (e) => {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Voice input buttons
        $('#recordButton').on('click', () => {
            this.toggleRecording();
        });
        
        $('#voiceInputBtn').on('click', () => {
            this.quickVoiceInput();
        });
        
        // Transcription controls
        $('#useTranscription').on('click', () => {
            this.useTranscription();
        });
        
        $('#clearTranscription').on('click', () => {
            this.clearTranscription();
        });
    }
    
    selectModel(modelName) {
        if (!modelName) {
            this.selectedModel = null;
            $('#messageInput, #sendButton, #voiceInputBtn').prop('disabled', true);
            $('#selectedModelDisplay').text('No model selected');
            $('#modelInfo').hide();
            return;
        }
        
        this.selectedModel = modelName;
        $('#messageInput, #sendButton, #voiceInputBtn').prop('disabled', false);
        $('#selectedModelDisplay').text(`Using: ${modelName}`);
        $('#messageInput').focus();
        
        this.addSystemMessage(`Selected model: ${modelName}`);
    }
    
    async checkVoiceSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Voice input not supported in this browser');
            $('#recordButton, #voiceInputBtn').prop('disabled', true);
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
            console.log('Microphone access granted');
        } catch (error) {
            console.error('Microphone access denied:', error);
            $('#recordButton, #voiceInputBtn').prop('disabled', true);
        }
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.recordingSeconds = 0;
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            
            // Update UI
            $('#recordButton').removeClass('btn-outline-primary').addClass('btn-danger');
            $('#recordButtonText').text('Stop Recording');
            $('#recordingStatus').show();
            
            // Start timer
            this.recordingTimer = setInterval(() => {
                this.recordingSeconds++;
                $('#recordingTimer').text(this.recordingSeconds);
            }, 1000);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.addSystemMessage(`Microphone error: ${error.message}`);
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            
            // Update UI
            $('#recordButton').removeClass('btn-danger').addClass('btn-outline-primary');
            $('#recordButtonText').text('Start Recording');
            $('#recordingStatus').hide();
            
            // Clear timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
        }
    }
    
    async processRecording() {
        if (this.audioChunks.length === 0) {
            this.addSystemMessage('No audio recorded');
            return;
        }
        
        try {
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            
            // Convert to WAV format for better Whisper compatibility
            const wavBlob = await this.convertToWav(audioBlob);
            
            // Show processing indicator
            this.addSystemMessage('Transcribing audio...');
            
            // Send to server for transcription
            const formData = new FormData();
            formData.append('audio', wavBlob, 'recording.wav');
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.displayTranscription(data.transcription, data.language);
            } else {
                this.addSystemMessage(`Transcription error: ${data.error}`);
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.addSystemMessage(`Processing error: ${error.message}`);
        }
    }
    
    async convertToWav(audioBlob) {
        // For simplicity, we'll send the webm blob directly
        // In production, you might want to convert to WAV format
        return audioBlob;
    }
    
    displayTranscription(text, language) {
        $('#transcriptionText').text(text);
        $('#transcriptionPreview').show();
        
        this.addSystemMessage(`Voice input transcribed (${language}): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }
    
    useTranscription() {
        const transcription = $('#transcriptionText').text();
        $('#messageInput').val(transcription);
        $('#transcriptionPreview').hide();
        $('#messageInput').focus();
    }
    
    clearTranscription() {
        $('#transcriptionPreview').hide();
        $('#transcriptionText').text('');
    }
    
    async quickVoiceInput() {
        $('#voiceInputBtn').addClass('voice-input-btn recording').prop('disabled', true);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // Send for transcription
                const formData = new FormData();
                formData.append('audio', audioBlob, 'quick_recording.wav');
                
                try {
                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        $('#messageInput').val(data.transcription);
                        $('#messageInput').focus();
                    } else {
                        this.addSystemMessage(`Quick transcription error: ${data.error}`);
                    }
                } catch (error) {
                    this.addSystemMessage(`Quick transcription failed: ${error.message}`);
                }
                
                // Cleanup
                stream.getTracks().forEach(track => track.stop());
                $('#voiceInputBtn').removeClass('voice-input-btn recording').prop('disabled', false);
            };
            
            mediaRecorder.start();
            
            // Auto-stop after 10 seconds
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 10000);
            
            // Stop on click
            $('#voiceInputBtn').one('click', () => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            });
            
        } catch (error) {
            console.error('Quick voice input error:', error);
            this.addSystemMessage(`Voice input error: ${error.message}`);
            $('#voiceInputBtn').removeClass('voice-input-btn recording').prop('disabled', false);
        }
    }
    
    async sendMessage() {
        const messageText = $('#messageInput').val().trim();
        if (!messageText || !this.selectedModel) return;
        
        // Clear input and disable form
        $('#messageInput').val('').prop('disabled', true);
        $('#sendButton, #voiceInputBtn').prop('disabled', true);
        
        // Add user message to chat
        this.addMessage('user', messageText);
        
        // Add to history
        this.chatHistory.push({
            role: 'user',
            content: messageText
        });
        
        if (this.isStreaming && $('#streamToggle').prop('checked')) {
            await this.sendStreamingMessage();
        } else {
            await this.sendCompleteMessage();
        }
        
        // Re-enable form
        $('#messageInput').prop('disabled', false);
        $('#sendButton, #voiceInputBtn').prop('disabled', false);
        $('#messageInput').focus();
    }
    
    async sendStreamingMessage() {
        // Create assistant message element immediately for real-time updates
        const messageElement = this.addMessage('assistant', '');
        const contentElement = messageElement.find('.message-content');
        
        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.selectedModel,
                    message: this.chatHistory[this.chatHistory.length - 1].content,
                    history: this.chatHistory.slice(0, -1)
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let fullResponse = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.content) {
                                fullResponse += data.content;
                                contentElement.html(this.formatMessage(fullResponse));
                                this.scrollToBottom();
                            } else if (data.done) {
                                this.chatHistory.push({
                                    role: 'assistant',
                                    content: fullResponse
                                });
                                return;
                            } else if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            console.debug('JSON parse error (expected during streaming):', e);
                        }
                    }
                }
            }
        } catch (error) {
            messageElement.remove();
            this.addMessage('system', `Error: ${error.message}`);
        }
    }
    
    async sendCompleteMessage() {
        const typingIndicator = this.addTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.selectedModel,
                    message: this.chatHistory[this.chatHistory.length - 1].content,
                    history: this.chatHistory.slice(0, -1)
                })
            });
            
            const data = await response.json();
            
            typingIndicator.remove();
            
            if (response.ok) {
                this.addMessage('assistant', data.response);
                this.chatHistory.push({
                    role: 'assistant',
                    content: data.response
                });
            } else {
                this.addMessage('system', `Error: ${data.error}`);
            }
        } catch (error) {
            typingIndicator.remove();
            this.addMessage('system', `Network error: ${error.message}`);
        }
    }
    
    addMessage(role, content) {
        const messageHtml = `
            <div class="message ${role}">
                <div class="message-content">${this.formatMessage(content)}</div>
                <small class="message-timestamp">${new Date().toLocaleTimeString()}</small>
            </div>
        `;
        
        const messageElement = $(messageHtml);
        $('#messagesContainer').append(messageElement);
        this.scrollToBottom();
        
        $('#welcomeMessage').hide();
        
        return messageElement;
    }
    
    addSystemMessage(content) {
        return this.addMessage('system', content);
    }
    
    addTypingIndicator() {
        const typingHtml = `
            <div class="typing-indicator">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        const typingElement = $(typingHtml);
        $('#messagesContainer').append(typingElement);
        this.scrollToBottom();
        
        return typingElement;
    }
    
    formatMessage(content) {
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }
    
    clearChat() {
        $('#messagesContainer').empty();
        $('#welcomeMessage').show();
        this.chatHistory = [];
        this.clearTranscription();
    }
    
    async refreshModels() {
        const button = $('#refreshModels');
        const originalText = button.html();
        button.html('<i class="fas fa-spinner fa-spin"></i> Refreshing...').prop('disabled', true);
        
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            
            const select = $('#modelSelect');
            const currentValue = select.val();
            select.empty().append('<option value="">Choose a model...</option>');
            
            data.models.forEach(model => {
                const option = `
                    <option value="${model.name}">
                        ${model.name}
                        ${model.details?.parameter_size ? `(${model.details.parameter_size})` : ''}
                    </option>
                `;
                select.append(option);
            });
            
            if (currentValue && data.models.some(m => m.name === currentValue)) {
                select.val(currentValue);
            }
            
            this.addSystemMessage(`Refreshed models. Found ${data.models.length} models.`);
        } catch (error) {
            this.addSystemMessage(`Error refreshing models: ${error.message}`);
        } finally {
            button.html(originalText).prop('disabled', false);
        }
    }
    
    async checkConnection() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.status === 'healthy' && data.ollama_connected) {
                $('#connectionStatus').html(`
                    <i class="fas fa-circle text-success"></i> 
                    Connected to Ollama (${data.models_count} models)
                    ${data.gpu_available ? '<br><i class="fas fa-microchip text-success"></i> GPU Available' : ''}
                `).removeClass('alert-secondary alert-danger').addClass('alert-success');
            } else {
                throw new Error('Ollama not responding');
            }
        } catch (error) {
            $('#connectionStatus').html(`
                <i class="fas fa-circle text-danger"></i> 
                Connection failed: ${error.message}
            `).removeClass('alert-secondary alert-success').addClass('alert-danger');
        }
    }
    
    scrollToBottom() {
        const container = $('#messagesContainer');
        container.scrollTop(container[0].scrollHeight);
    }
}

// Initialize chat when document is ready
$(document).ready(() => {
    new OllamaChat();
});

