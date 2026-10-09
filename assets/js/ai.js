// ==========================================================================
// ASISTENTE DE IA - INTEGRACIÓN CLIENT-SIDE
// ==========================================================================

let currentAIProvider = 'gemini';

// Cache de elementos de IA
const AIDOM = {
    panel: document.getElementById('ai_panel'),
    resizer: document.getElementById('resizer_ai'),
    chatBody: document.getElementById('ai_chat_body'),
    chatInput: document.getElementById('ai_chat_input'),
    providerSelector: document.getElementById('ai_provider_selector'),
    status: document.getElementById('ai_status'),
    statusText: document.getElementById('ai_status_text'),
};

/**
 * Alterna la visibilidad del panel de Inteligencia Artificial.
 */
function toggleAIPanel() {
    if (AIDOM.panel && AIDOM.resizer) {
        const estaOculto = AIDOM.panel.classList.contains('oculto');
        if (estaOculto) {
            AIDOM.panel.classList.remove('oculto');
            AIDOM.resizer.classList.remove('oculto');
            obtenerProveedoresIAHabilitados();
        } else {
            AIDOM.panel.classList.add('oculto');
            AIDOM.resizer.classList.add('oculto');
        }
    }
}

/**
 * Obtiene los proveedores configurados en el almacenamiento local.
 */
function obtenerProveedoresIAHabilitados() {
    if (typeof AIClient === 'undefined') return;
    const proveedores = AIClient.getAvailableProviders();
    if (AIDOM.providerSelector) {
        const options = proveedores.map(p => {
            const statusSuffix = p.enabled ? '' : ' (🔑 Requiere Llave)';
            return `<option value="${p.id}" ${p.id === currentAIProvider ? 'selected' : ''}>${p.name}${statusSuffix}</option>`;
        }).join('');
        AIDOM.providerSelector.innerHTML = options;
    }
}

/**
 * Cambia el proveedor de IA activo.
 */
function cambiarProveedorIA(val) {
    currentAIProvider = val;
    mostrarNotificacion(`🤖 Modelo cambiado a ${val}`);
}

/**
 * Modal para configurar y guardar las API Keys de los proveedores.
 */
async function configurarLlavesIA() {
    const keys = typeof AIClient !== 'undefined' ? AIClient.getStoredKeys() : {};
    const html = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
                <label style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 4px;">Google Gemini API Key:</label>
                <input type="password" id="key_gemini" value="${keys.gemini || ''}" placeholder="AIzaSy..." style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-family: var(--font-mono); box-sizing: border-box;">
                <small style="color: var(--text-muted); font-size: 11px;">Consíguela gratis en Google AI Studio.</small>
            </div>
            <div>
                <label style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 4px;">Mercury 2 API Key (Opcional):</label>
                <input type="password" id="key_mercury" value="${keys.mercury || ''}" placeholder="sk-..." style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-family: var(--font-mono); box-sizing: border-box;">
            </div>
            <div>
                <label style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 4px;">xAI Grok API Key (Opcional):</label>
                <input type="password" id="key_grok" value="${keys.grok || ''}" placeholder="xai-..." style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-family: var(--font-mono); box-sizing: border-box;">
            </div>
            <div style="background: rgba(0, 150, 255, 0.08); padding: 8px 12px; border-radius: 4px; font-size: 11px; color: var(--text-secondary); border-left: 3px solid var(--accent-primary);">
                🔒 <strong>Seguridad:</strong> Tus llaves se almacenan exclusivamente en el <code>localStorage</code> de tu navegador. Nunca se envían a ningún servidor intermedio.
            </div>
        </div>
    `;

    const res = await Modals.show("⚙️ Configuración de APIs de IA", html, [
        { text: "Cancelar", value: false },
        { text: "Guardar Llaves", value: true, primary: true }
    ]);

    if (res) {
        const keyGemini = document.getElementById('key_gemini')?.value.trim() || '';
        const keyMercury = document.getElementById('key_mercury')?.value.trim() || '';
        const keyGrok = document.getElementById('key_grok')?.value.trim() || '';

        if (typeof AIClient !== 'undefined') {
            AIClient.setApiKey('gemini', keyGemini);
            AIClient.setApiKey('mercury', keyMercury);
            AIClient.setApiKey('grok', keyGrok);
            obtenerProveedoresIAHabilitados();
            mostrarNotificacion("🔑 Llaves de IA guardadas correctamente.");
        }
    }
}

/**
 * Inserta el último bloque de código del asistente en el editor.
 */
function insertarEnEditor() {
    const editor = document.getElementById('editor');
    if (!editor || !AIDOM.chatBody) return;

    const codeBlocks = AIDOM.chatBody.querySelectorAll('pre code');
    if (codeBlocks.length === 0) {
        mostrarNotificacion("No hay bloques de código en el chat para insertar", true);
        return;
    }

    const lastCode = codeBlocks[codeBlocks.length - 1].innerText;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    editor.value = val.substring(0, start) + "\n" + lastCode + "\n" + val.substring(end);
    if (typeof procesarCambiosPesados === 'function') procesarCambiosPesados();
    mostrarNotificacion("Código insertado en el editor");
}

/**
 * Envía la pregunta ingresada por el usuario en el chat.
 */
async function enviarMensajeIA() {
    if (!AIDOM.chatInput || !AIDOM.chatBody) return;
    
    const texto = AIDOM.chatInput.value.trim();
    if (!texto) return;

    appendMessage('user', texto);
    AIDOM.chatInput.value = '';

    const editor = document.getElementById('editor');
    let codigoContexto = '';
    if (editor) {
        codigoContexto = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    }

    await realizarConsultaIA('chat', texto, codigoContexto);
}

/**
 * Ejecuta una de las acciones rápidas de IA (Explicar, Corregir, Optimizar).
 */
async function ejecutarAccionIA(accion) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const codigo = editor.value.substring(editor.selectionStart, editor.selectionEnd) || editor.value;
    
    if (!codigo.trim()) {
        appendMessage('assistant', "⚠️ No hay código en el editor para procesar.");
        return;
    }

    let tituloAccion = '';
    if (accion === 'explicar') tituloAccion = 'Explicar código seleccionado';
    if (accion === 'corregir') tituloAccion = 'Analizar errores y corregir código';
    if (accion === 'optimizar') tituloAccion = 'Optimizar código';

    appendMessage('user', `✨ Acción rápida: ${tituloAccion}`);
    
    await realizarConsultaIA(accion, '', codigo);
}

/**
 * Realiza la petición directa de IA en el navegador.
 */
async function realizarConsultaIA(accionIa, prompt, codigo) {
    mostrarCargando(true, `Consultando a ${currentAIProvider}...`);

    const filename = document.getElementById('current_filename')?.value || 'Sin título';

    try {
        if (typeof AIClient === 'undefined') {
            throw new Error("El cliente de IA no está cargado.");
        }

        const respuesta = await AIClient.generateResponse(currentAIProvider, prompt, codigo, accionIa, filename);
        
        appendMessage('assistant', respuesta);
        
        if (accionIa === 'chat') {
            AIClient.history.push({ role: 'user', content: prompt });
            AIClient.history.push({ role: 'assistant', content: respuesta });
        }
    } catch (e) {
        appendMessage('assistant', `❌ **Error:** ${e.message}\n\n*Haz clic en el icono de llave 🔑 arriba a la derecha del panel para configurar tu API Key si no lo has hecho.*`);
        console.error("Error en IA:", e);
    } finally {
        mostrarCargando(false);
    }
}

/**
 * Agrega un mensaje a la ventana de chat.
 */
function appendMessage(sender, content) {
    if (!AIDOM.chatBody) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ai-message-${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'ai-message-avatar';
    avatar.innerHTML = sender === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="bot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-message-content';
    contentDiv.innerHTML = sender === 'user' ? escapeHTML(content) : renderMarkdown(content);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    
    AIDOM.chatBody.appendChild(msgDiv);

    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    AIDOM.chatBody.scrollTop = AIDOM.chatBody.scrollHeight;
}

/**
 * Escapa caracteres HTML para evitar XSS en el chat.
 */
function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Parser Markdown para formatear las respuestas de la IA.
 */
function renderMarkdown(text) {
    let html = escapeHTML(text);

    // Encabezados
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Bloques de código
    html = html.replace(/```(?:[a-zA-Z0-9_\-+]+)?\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>');
    
    // Tablas Markdown
    html = html.replace(/^\|(.+)\|$/gm, (match, inner) => {
        if (/^[\s\-|:]+$/.test(inner)) return '';
        const cells = inner.split('|').map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
    });
    
    html = html.replace(/(?:<tr>.*?<\/tr>[\s\n]*)+/gs, match => {
        let rows = match.trim().split(/<\/tr>[\s\n]*/).filter(r => r.startsWith('<tr'));
        if (rows.length === 0) return match;
        
        let headRow = rows[0] + '</tr>';
        headRow = headRow.replace(/<td/g, '<th').replace(/<\/td>/g, '</th>');
        
        let bodyRows = rows.slice(1).map(r => r + '</tr>').join('\n');
        return `<div class="ai-table-wrapper"><table class="ai-table">\n<thead>\n${headRow}\n</thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table></div>\n`;
    });
    
    // Código en línea
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // Negrita
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Listas
    html = html.replace(/^(?:\s*)[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Saltos de línea
    html = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.match(/^(<pre>|<\/pre>|<li>|<ul>|<\/ul>|<div|<\/div>|<table|<\/table>|<thead|<\/thead>|<tbody|<\/tbody>|<tr|<\/tr>|<td|<th|<h1|<h2|<h3)/i)) {
            return line;
        }
        return line + '<br>';
    }).join('\n');

    html = html.replace(/(<br>\s*){2,}/g, '<br><br>');
    return html;
}

/**
 * Controla el spinner de carga de IA.
 */
function mostrarCargando(visible, texto = 'Pensando...') {
    if (AIDOM.status && AIDOM.statusText) {
        if (visible) {
            AIDOM.statusText.textContent = texto;
            AIDOM.status.classList.remove('oculto');
        } else {
            AIDOM.status.classList.add('oculto');
        }
    }
}

// Resizer Vertical de IA
let isResizingAI = false;
let animFrameAI = null;

if (AIDOM.resizer && AIDOM.panel) {
    AIDOM.resizer.addEventListener('mousedown', (e) => {
        isResizingAI = true;
        document.body.style.cursor = 'col-resize';
        const editor = document.getElementById('editor');
        if (editor) editor.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingAI) return;
        if (animFrameAI) cancelAnimationFrame(animFrameAI);

        animFrameAI = requestAnimationFrame(() => {
            let w = document.body.clientWidth - e.clientX;
            if (w > 220 && w < window.innerWidth / 2) {
                AIDOM.panel.style.width = w + 'px';
            }
        });
    });

    document.addEventListener('mouseup', () => {
        if (isResizingAI) {
            isResizingAI = false;
            document.body.style.cursor = 'default';
            const editor = document.getElementById('editor');
            if (editor) editor.style.pointerEvents = 'auto';
        }
    });
}
