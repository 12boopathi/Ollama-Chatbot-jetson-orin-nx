from flask import Flask, render_template, request, jsonify, Response
import requests
import json
import logging
import os
import whisper
import torch
import tempfile
import threading
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ollama server configuration
OLLAMA_BASE_URL = "http://localhost:11434"

# Initialize Whisper model
try:
    whisper_model = whisper.load_model("base").to("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Whisper model loaded on {'CUDA' if torch.cuda.is_available() else 'CPU'}")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    whisper_model = None

class OllamaClient:
    def __init__(self, base_url=OLLAMA_BASE_URL):
        self.base_url = base_url
        
    def list_models(self):
        """Fetch available models from Ollama server"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('models', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching models: {e}")
            return []
    
    def chat_stream(self, model, messages):
        """Stream chat response from Ollama"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": True
            }
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                stream=True,
                timeout=60
            )
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        if chunk.get('message', {}).get('content'):
                            yield chunk['message']['content']
                    except json.JSONDecodeError:
                        continue
                        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error in chat stream: {e}")
            yield f"Error: {str(e)}"
    
    def chat_complete(self, model, messages):
        """Get complete chat response from Ollama"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": False
            }
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            
            data = response.json()
            return data.get('message', {}).get('content', 'No response received')
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error in chat: {e}")
            return f"Error: {str(e)}"

# Initialize Ollama client
ollama_client = OllamaClient()

@app.route('/')
def index():
    """Main chat interface"""
    models = ollama_client.list_models()
    whisper_available = whisper_model is not None
    return render_template('chat.html', models=models, whisper_available=whisper_available)

@app.route('/api/models')
def get_models():
    """API endpoint to get available models"""
    models = ollama_client.list_models()
    return jsonify({'models': models})

@app.route('/api/chat', methods=['POST'])
def chat():
    """API endpoint for chat completion"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    model = data.get('model')
    message = data.get('message')
    history = data.get('history', [])
    
    if not model or not message:
        return jsonify({'error': 'Model and message are required'}), 400
    
    # Prepare messages for Ollama
    messages = history + [{"role": "user", "content": message}]
    
    # Get response from Ollama
    response = ollama_client.chat_complete(model, messages)
    
    return jsonify({
        'response': response,
        'model': model
    })

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """API endpoint for streaming chat responses"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    model = data.get('model')
    message = data.get('message')
    history = data.get('history', [])
    
    if not model or not message:
        return jsonify({'error': 'Model and message are required'}), 400
    
    # Prepare messages for Ollama
    messages = history + [{"role": "user", "content": message}]
    
    def generate():
        try:
            for chunk in ollama_client.chat_stream(model, messages):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """API endpoint for audio transcription"""
    if not whisper_model:
        return jsonify({'error': 'Whisper model not available'}), 500
    
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Transcribe with Whisper
        logger.info(f"Transcribing audio file: {filepath}")
        result = whisper_model.transcribe(filepath)
        
        # Clean up temp file
        os.remove(filepath)
        
        transcription = result["text"].strip()
        logger.info(f"Transcription completed: {transcription[:50]}...")
        
        return jsonify({
            'transcription': transcription,
            'language': result.get('language', 'unknown'),
            'segments': result.get('segments', [])
        })
        
    except Exception as e:
        logger.error(f"Error in transcription: {e}")
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    try:
        models = ollama_client.list_models()
        return jsonify({
            'status': 'healthy',
            'ollama_connected': len(models) >= 0,
            'models_count': len(models),
            'whisper_available': whisper_model is not None,
            'gpu_available': torch.cuda.is_available()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

