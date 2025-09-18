
# Ollama Chatbot with Whisper (Jetson Orin NX)

This project is a **Flask-based chatbot web application** designed to run on the **NVIDIA Jetson Orin NX**.  
It integrates:

- [Ollama](https://ollama.ai) for running **local LLMs** (GPU accelerated).  
- [OpenAI Whisper](https://github.com/openai/whisper) for **speech-to-text (STT)** transcription via microphone input.  
- A **Flask Web UI** with chat, model selection, and real-time transcription.  

The goal is to provide a smooth **chatbot experience** powered entirely on-device, leveraging the Jetson GPU.

---

## 🚀 Features
- **Chatbot Web UI** with Flask + HTML + JS frontend.  
- **LLM inference with Ollama** using GPU acceleration.  
- **Speech-to-text** transcription with Whisper.  
- **Model selection** from Ollama’s available models.  
- **Streaming responses** with Server-Sent Events (SSE).  
- **Health check endpoint** to verify GPU, Whisper, and Ollama connectivity.  

---

## 📂 Project Structure

```

.
├── app.py                 # Flask backend
├── requirements.txt       # Python dependencies
├── static
│   ├── css
│   │   └── style.css      # UI styling
│   └── js
│       └── chat.js        # Frontend chat logic
└── templates
├── chat.html          # Chat UI
└── index.html         # Landing page

````

---

## 🖥️ Prerequisites
- NVIDIA Jetson Orin NX (JetPack 6.x recommended).  
- **Python 3.10** (using virtual environment recommended).  
- [Ollama](https://ollama.ai) installed and running (`ollama serve`).  
- CUDA enabled (for GPU acceleration).  


## ⚙️ Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/12boopathi/Ollama-Chatbot-jetson-orin-nx.git

   cd Ollama-Chatbot-jetson-orin-nx
  ```

2. **Create and activate Python 3.10 virtual environment**

   ```bash
   python3.10 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Start Ollama server**

   ```bash
   ollama serve
   ```

5. **Run the Flask app**

   ```bash
   python3 app.py
   ```

6. **Access the Web UI**
   Open browser and go to:
   👉 [http://localhost:5000](http://localhost:5000)

---

## 🎤 Usage

* Select an available Ollama model from the UI.
* Enter text in the chat box to interact with the model.
* Use microphone input to transcribe speech via Whisper.
* Responses are streamed in real-time from the model.

---

## 🩺 Health Check

Check server status at:

```bash
curl http://localhost:5000/health
```

---

## 📹 Demo

Here’s a demo video of the project in action:

👉 ![Output Demo](output.mp4)


---

## 🛠️ Tech Stack

* **Backend:** Flask, Python 3.10
* **Frontend:** HTML, CSS, JavaScript
* **AI Models:** Ollama (LLMs), Whisper (STT)
* **Hardware:** NVIDIA Jetson Orin NX

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to add.

---

