/**
 * widget/widget.js
 * Embeddable chatbot widget — add to any site with one <script> tag:
 *
 *   <script
 *     src="https://chatbot.flowcrafted.me/widget/widget.js"
 *     data-api-url="https://chatbot.flowcrafted.me"
 *     data-site-id="portfolio"
 *     data-theme="dark"
 *     data-position="bottom-right"
 *   ></script>
 */

(function () {
  'use strict';

  // ── Config from script tag ───────────────────────────────────────────────
  const script   = document.currentScript || document.querySelector('script[data-api-url]');
  const API_URL  = (script && script.getAttribute('data-api-url')) || 'http://localhost:8000';
  const THEME    = (script && script.getAttribute('data-theme')) || 'dark';
  const POSITION = (script && script.getAttribute('data-position')) || 'bottom-right';
  const ACCENT   = (script && script.getAttribute('data-accent')) || '#7c3aed';
  const GREETING = (script && script.getAttribute('data-greeting')) ||
    "Hi! I'm Mash 👋 Ask me anything about this portfolio.";

  let sessionId  = localStorage.getItem('chatbot_session_id') || null;
  let isOpen     = false;
  let isTyping   = false;

  // ── CSS injection ────────────────────────────────────────────────────────
  const css = `
    #chatbot-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #chatbot-widget { position: fixed; ${POSITION.includes('right') ? 'right:24px' : 'left:24px'}; bottom:24px; z-index:999999; }

    #chatbot-bubble {
      width:56px; height:56px; border-radius:50%;
      background:${ACCENT}; color:#fff; border:none;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      font-size:24px; box-shadow:0 4px 20px rgba(0,0,0,0.3);
      transition:transform .2s, box-shadow .2s;
    }
    #chatbot-bubble:hover { transform:scale(1.1); box-shadow:0 6px 28px rgba(0,0,0,0.4); }

    #chatbot-panel {
      position:absolute; ${POSITION.includes('right') ? 'right:0' : 'left:0'}; bottom:68px;
      width:360px; height:520px; border-radius:16px; overflow:hidden;
      box-shadow:0 8px 48px rgba(0,0,0,0.35);
      display:flex; flex-direction:column;
      background:${THEME === 'dark' ? '#1a1a2e' : '#ffffff'};
      border:1px solid ${THEME === 'dark' ? '#2d2d4e' : '#e5e7eb'};
      transform:scale(0.9) translateY(20px); opacity:0; pointer-events:none;
      transition:transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    #chatbot-panel.open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }

    #chatbot-header {
      padding:14px 16px; display:flex; align-items:center; gap:10px;
      background:${ACCENT}; color:#fff; flex-shrink:0;
    }
    #chatbot-header .avatar { font-size:22px; }
    #chatbot-header .title  { font-weight:600; font-size:15px; }
    #chatbot-header .status { font-size:11px; opacity:.8; }
    #chatbot-close {
      margin-left:auto; background:none; border:none; color:#fff;
      font-size:20px; cursor:pointer; line-height:1; padding:2px 6px; border-radius:4px;
    }
    #chatbot-close:hover { background:rgba(255,255,255,0.2); }

    #chatbot-messages {
      flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px;
      scrollbar-width:thin; scrollbar-color:${ACCENT}55 transparent;
    }

    .msg-row { display:flex; gap:8px; }
    .msg-row.user { flex-direction:row-reverse; }

    .msg-bubble {
      max-width:80%; padding:10px 14px; border-radius:14px;
      font-size:13.5px; line-height:1.5; word-wrap:break-word;
    }
    .msg-row.assistant .msg-bubble {
      background:${THEME === 'dark' ? '#2d2d4e' : '#f3f4f6'};
      color:${THEME === 'dark' ? '#e2e8f0' : '#1f2937'};
      border-bottom-left-radius:4px;
    }
    .msg-row.user .msg-bubble {
      background:${ACCENT}; color:#fff; border-bottom-right-radius:4px;
    }

    .msg-sources { margin-top:6px; display:flex; flex-wrap:wrap; gap:4px; }
    .msg-source-chip {
      font-size:11px; padding:2px 8px; border-radius:20px;
      background:${ACCENT}22; color:${ACCENT};
      text-decoration:none; border:1px solid ${ACCENT}44;
      transition:background .15s;
    }
    .msg-source-chip:hover { background:${ACCENT}44; }

    .typing-dot { display:inline-block; width:6px; height:6px; border-radius:50%;
      background:${ACCENT}; animation:bounce .9s infinite; margin:0 2px; }
    .typing-dot:nth-child(2) { animation-delay:.15s; }
    .typing-dot:nth-child(3) { animation-delay:.3s; }
    @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }

    #chatbot-footer {
      padding:12px; border-top:1px solid ${THEME === 'dark' ? '#2d2d4e' : '#e5e7eb'};
      flex-shrink:0; display:flex; flex-direction:column; gap:8px;
    }
    #chatbot-input-row { display:flex; gap:8px; align-items:flex-end; }
    #chatbot-input {
      flex:1; border:1.5px solid ${THEME === 'dark' ? '#3d3d6e' : '#d1d5db'};
      border-radius:10px; padding:9px 12px; font-size:13.5px; resize:none;
      background:${THEME === 'dark' ? '#12122a' : '#f9fafb'};
      color:${THEME === 'dark' ? '#e2e8f0' : '#1f2937'};
      max-height:96px; outline:none; transition:border-color .15s;
    }
    #chatbot-input:focus { border-color:${ACCENT}; }
    #chatbot-input::placeholder { color:${THEME === 'dark' ? '#6b7280' : '#9ca3af'}; }

    #chatbot-send, #chatbot-upload-btn {
      width:38px; height:38px; border-radius:10px; border:none;
      background:${ACCENT}; color:#fff; cursor:pointer; font-size:16px;
      display:flex; align-items:center; justify-content:center;
      transition:opacity .15s, transform .1s; flex-shrink:0;
    }
    #chatbot-send:hover, #chatbot-upload-btn:hover { opacity:.85; transform:scale(1.05); }
    #chatbot-send:disabled { opacity:.5; cursor:not-allowed; transform:none; }
    #chatbot-upload-input { display:none; }

    @media (max-width:400px) {
      #chatbot-panel { width:calc(100vw - 32px); right:16px; left:16px; }
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'chatbot-widget';
  widget.innerHTML = `
    <div id="chatbot-panel">
      <div id="chatbot-header">
        <span class="avatar">🤖</span>
        <div><div class="title">Mash</div><div class="status">Mashookh's AI Assistant</div></div>
        <button id="chatbot-close" title="Close">✕</button>
      </div>
      <div id="chatbot-messages"></div>
      <div id="chatbot-footer">
        <div id="chatbot-input-row">
          <textarea id="chatbot-input" rows="1" placeholder="Ask me anything…"></textarea>
          <input type="file" id="chatbot-upload-input" accept="image/*">
          <button id="chatbot-upload-btn" title="Upload image">📎</button>
          <button id="chatbot-send" title="Send">➤</button>
        </div>
      </div>
    </div>
    <button id="chatbot-bubble">💬</button>
  `;
  document.body.appendChild(widget);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const panel      = document.getElementById('chatbot-panel');
  const bubble     = document.getElementById('chatbot-bubble');
  const closeBtn   = document.getElementById('chatbot-close');
  const messages   = document.getElementById('chatbot-messages');
  const input      = document.getElementById('chatbot-input');
  const sendBtn    = document.getElementById('chatbot-send');
  const uploadBtn  = document.getElementById('chatbot-upload-btn');
  const uploadInput= document.getElementById('chatbot-upload-input');

  // ── Helpers ───────────────────────────────────────────────────────────────
  function addMessage(role, text, sources = []) {
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    if (sources && sources.length) {
      const srcDiv = document.createElement('div');
      srcDiv.className = 'msg-sources';
      sources.forEach(s => {
        const a = document.createElement('a');
        a.className = 'msg-source-chip';
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '↗ ' + s.title;
        srcDiv.appendChild(a);
      });
      bubble.appendChild(srcDiv);
    }

    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function addTyping() {
    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = 'typing-indicator';
    row.innerHTML = `<div class="msg-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    bubble.textContent = isOpen ? '✕' : '💬';
    if (isOpen && messages.children.length === 0) {
      addMessage('assistant', GREETING);
    }
    if (isOpen) input.focus();
  }

  function setSending(sending) {
    isTyping = sending;
    sendBtn.disabled = sending;
    input.disabled   = sending;
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text, imageFile = null) {
    if (!text.trim() && !imageFile) return;
    setSending(true);

    if (text) addMessage('user', text);
    addTyping();
    input.value = '';
    input.style.height = 'auto';

    try {
      let data;
      if (imageFile) {
        const form = new FormData();
        form.append('message', text);
        form.append('image', imageFile);
        if (sessionId) form.append('session_id', sessionId);

        const res = await fetch(`${API_URL}/api/chat/upload`, {
          method: 'POST', body: form,
        });
        data = await res.json();
      } else {
        const res = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, session_id: sessionId }),
        });
        data = await res.json();
      }

      sessionId = data.session_id;
      localStorage.setItem('chatbot_session_id', sessionId);

      removeTyping();
      addMessage('assistant', data.response, data.sources || []);
    } catch (err) {
      removeTyping();
      addMessage('assistant', '⚠️ Something went wrong. Please try again.');
      console.error('[Chatbot]', err);
    } finally {
      setSending(false);
      input.focus();
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  bubble.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  sendBtn.addEventListener('click', () => {
    const file = uploadInput.files[0] || null;
    sendMessage(input.value.trim(), file);
    uploadInput.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  });

  uploadBtn.addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files[0];
    if (file) {
      const name = file.name.length > 20 ? file.name.slice(0, 20) + '…' : file.name;
      input.placeholder = `📎 ${name} — type a question or just send`;
    }
  });
})();
