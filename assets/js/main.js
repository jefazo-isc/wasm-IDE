// ==========================================================================
// IDE INDÓMITO - CLIENT-SIDE & WEB ASSEMBLY CORE ENGINE
// ==========================================================================

// ==========================================================================
// CACHÉ DEL DOM (Optimización de rendimiento)
// ==========================================================================
const DOM = {
    editor: document.getElementById('editor'),
    highlighting: document.getElementById('highlighting'),
    lineNumbers: document.getElementById('line_numbers'),
    cursorPos: document.getElementById('cursor_pos'),
    currentFilename: document.getElementById('current_filename'),
    fileIndicator: document.getElementById('file_indicator'),
    bracketMatches: document.getElementById('bracket_matches'),
    statusMsg: document.getElementById('status_msg'),
    workspacePath: document.getElementById('workspace_path'),
    explorerContent: document.getElementById('explorer_content'),
    fileExplorer: document.getElementById('file_explorer'),
    editorContainer: document.getElementById('editor_container'),
    rightPanels: document.getElementById('right_panels'),
    bottomPanels: document.getElementById('bottom_panels'),
    topLayout: document.querySelector('.top-layout'),
    resizerV: document.getElementById('resizer_v'),
    resizerExp: document.getElementById('resizer_explorer'),
    resizerH: document.getElementById('resizer_h'),
    activeLineIndicator: null
};

let currentExt = 'txt';
let currentOpenedFileAbsPath = '/testLexico.txt';
let currentLineCount = 0;
let saveInProgress = false;

// ==========================================================================
// SISTEMA DE MODALES
// ==========================================================================
const Modals = {
    show: (titulo, htmlContent, buttons) => new Promise((resolve) => {
        document.getElementById('ide_modal_overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ide_modal_overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center;';
        
        const btnsHtml = buttons.map((b, i) => {
            const bg = b.primary ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
            const fw = b.primary ? 'bold' : 'normal';
            return `<button id="mbtn_${i}" style="padding: 8px 15px; cursor: pointer; background: ${bg}; color: #fff; border: 1px solid var(--border-color); border-radius: 4px; margin-left: 10px; font-weight: ${fw}; transition: background 0.2s;">${b.text}</button>`;
        }).join('');

        const box = document.createElement('div');
        box.style.cssText = 'background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; min-width: 350px; max-width: 500px; box-shadow: 0 5px 15px var(--shadow-color); font-family: var(--font-sans);';
        box.innerHTML = `<h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 15px;">${titulo}</h3><div style="color: var(--text-primary); margin-bottom: 20px; font-size: 14px; max-height: 60vh; overflow-y: auto;">${htmlContent}</div><div style="display: flex; justify-content: flex-end;">${btnsHtml}</div>`;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        buttons.forEach((b, i) => {
            document.getElementById(`mbtn_${i}`).addEventListener('click', () => {
                overlay.style.display = 'none';
                resolve(b.value);
                setTimeout(() => overlay.remove(), 50);
            });
        });
    }),
    prompt: async (titulo, mensaje, def = '') => {
        const html = `<p style="margin-bottom: 10px;">${mensaje}</p><input type="text" id="modal_input" value="${def}" style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: var(--font-mono); box-sizing: border-box;">`;
        setTimeout(() => {
            const input = document.getElementById('modal_input');
            if (input) {
                input.focus();
                const dotIndex = input.value.lastIndexOf('.');
                dotIndex > 0 ? input.setSelectionRange(0, dotIndex) : input.select();
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1').click(); });
            }
        }, 50);
        return await Modals.show(titulo, html, [{text: 'Cancelar', value: null}, {text: 'Aceptar', value: 'OK', primary: true}]) === 'OK' ? document.getElementById('modal_input').value : null;
    },
    confirm: async (tit, msg, btnSi = 'Sí', btnNo = 'No') => await Modals.show(tit, `<p>${msg}</p>`, [{text: btnNo, value: false}, {text: btnSi, value: true, primary: true}]),
    alert: async (tit, msg) => await Modals.show(tit, `<pre style="white-space: pre-wrap; font-family: var(--font-mono); margin: 0;">${msg}</pre>`, [{text: 'Aceptar', value: true, primary: true}]),
    promptPassword: async (titulo, mensaje) => {
        const html = `<p style="margin-bottom: 10px;">${mensaje}</p><input type="password" id="modal_input" style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: var(--font-mono); box-sizing: border-box;">`;
        setTimeout(() => {
            const input = document.getElementById('modal_input');
            if (input) {
                input.focus();
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1').click(); });
            }
        }, 50);
        return await Modals.show(titulo, html, [{text: 'Cancelar', value: null}, {text: 'Aceptar', value: 'OK', primary: true}]) === 'OK' ? document.getElementById('modal_input').value : null;
    }
};

// ==========================================================================
// RESIZERS
// ==========================================================================
let isResizing = { v: false, exp: false, h: false };
let animFrame = null;

const enableResize = (type, cursor) => {
    isResizing[type] = true;
    document.body.style.cursor = cursor;
    DOM.editor.style.pointerEvents = 'none';
};

DOM.resizerV.addEventListener('mousedown', () => enableResize('v', 'col-resize'));
DOM.resizerExp.addEventListener('mousedown', () => enableResize('exp', 'col-resize'));
DOM.resizerH.addEventListener('mousedown', () => enableResize('h', 'row-resize'));

document.addEventListener('mousemove', e => {
    if (!isResizing.v && !isResizing.h && !isResizing.exp) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    
    animFrame = requestAnimationFrame(() => {
        if (isResizing.v) {
            let w = document.body.clientWidth - e.clientX;
            if (w > 200 && w < window.innerWidth - 200) DOM.rightPanels.style.width = w + 'px';
        }
        if (isResizing.exp) {
            let w = e.clientX;
            if (w > 150 && w < window.innerWidth / 2) DOM.fileExplorer.style.width = w + 'px';
        }
        if (isResizing.h) {
            let h = e.clientY - document.querySelector('.main-layout').getBoundingClientRect().top;
            if (h > 100 && h < window.innerHeight - 100) DOM.topLayout.style.flex = `0 0 ${h}px`;
        }
    });
});

document.addEventListener('mouseup', () => {
    isResizing = { v: false, exp: false, h: false };
    document.body.style.cursor = 'default';
    DOM.editor.style.pointerEvents = 'auto';
});
window.addEventListener('resize', synchronizeScrollbarOffset);

// ==========================================================================
// EXPLORADOR Y ATAJOS CLIENT-SIDE
// ==========================================================================
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); guardarArchivo(); } });

function cargarExplorador(rutaSolicitada = null) {
    const ruta = rutaSolicitada ?? DOM.workspacePath.value.trim() ?? '/';
    
    if (typeof VirtualFS === 'undefined') return;
    const res = VirtualFS.listarDirectorio(ruta);

    if (res.success) {
        DOM.workspacePath.value = res.ruta_actual;
        DOM.explorerContent.innerHTML = res.elementos.length ? res.elementos.map(el => {
            const rEsc = el.ruta.replace(/'/g, "\\'");
            const mName = el.nombre;
            
            if (el.es_directorio) {
                return `<div class="explorer-item folder" onclick="cargarExplorador('${rEsc}')"><i data-lucide="folder" style="width:14px; height:14px; margin-right:5px; color:var(--text-muted);"></i>${mName}</div>`;
            } else {
                return `<div class="explorer-item file" onclick="abrirDesdeExplorador('${rEsc}', '${mName}')">
                            <span style="display:flex; align-items:center;"><i data-lucide="file-code-2" style="width:14px; height:14px; margin-right:5px; color:var(--text-muted);"></i><span class="file-name">${mName}</span></span>
                            <button class="btn-delete-file" onclick="borrarArchivo(event, '${rEsc}', '${mName}')" title="Borrar"><i data-lucide="trash-2"></i></button>
                        </div>`;
            }
        }).join('') : '<div style="padding: 10px; color: var(--text-muted); font-style: italic;">Carpeta vacía</div>';
        
        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    }
}

function subirDirectorio() {
    const rutaActual = DOM.workspacePath.value.trim() || '/';
    if (rutaActual === '/') return;
    
    let partes = rutaActual.split('/').filter(Boolean);
    partes.pop();
    const nuevaRuta = partes.length === 0 ? '/' : '/' + partes.join('/');
    cargarExplorador(nuevaRuta);
}

function abrirDesdeExplorador(rutaAbsoluta, nombre) {
    if (typeof VirtualFS === 'undefined') return;
    const res = VirtualFS.cargarArchivo(rutaAbsoluta);
    if (res.success) {
        DOM.editor.value = res.contenido;
        setFilename(res.nombre);
        currentOpenedFileAbsPath = res.ruta_absoluta;
        procesarCambiosPesados();
        limpiarPaneles();
        mostrarNotificacion('<i data-lucide="folder-open" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Abierto');
    } else {
        mostrarNotificacion("Error al abrir archivo", true);
    }
}

const togglePanel = (el, resizer) => { el.classList.toggle('panel-hidden'); resizer.classList.toggle('panel-hidden'); };
function toggleExplorer() { togglePanel(DOM.fileExplorer, DOM.resizerExp); }
function toggleRightPanel() { togglePanel(DOM.rightPanels, DOM.resizerV); }
function toggleBottomPanel() { togglePanel(DOM.bottomPanels, DOM.resizerH); }

// ==========================================================================
// EDITOR Y SINTAXIS
// ==========================================================================
function applySyntaxHighlighting(text) {
    const html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const kw = 'if|else|end|do|while|switch|case|int|float|main|cin|cout|real|then|until';
    const regex = new RegExp(`(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*)|("[^"]*"|'[^']*')|\\b(${kw})\\b|(&lt;=|&gt;=|!=|==|&lt;|&gt;|&amp;&amp;|&amp;|\\|\\||\\||!)|(\\+\\+|--|\\+|-|\\*|\\/|%|\\^|~)|\\b\\d+(\\.\\d+)?\\b|\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g');

    return html.replace(regex, (m, p1, p2, p3, p4, p5, p6, p7) => {
        if (p1) return `<span class="syntax-color3">${m}</span>`;
        if (p2) return `<span class="syntax-string">${m}</span>`;
        if (p3) return `<span class="syntax-color4">${m}</span>`;
        if (p4) return `<span class="syntax-color6">${m}</span>`;
        if (p5) return `<span class="syntax-color5">${m}</span>`;
        if (p6) return `<span class="syntax-color1">${m}</span>`;
        if (p7) return `<span class="syntax-color2">${m}</span>`;
        return m;
    });
}

function setFilename(filename) {
    DOM.currentFilename.value = filename;
    DOM.fileIndicator.textContent = 'Archivo: ' + filename;
    setExtension(filename);
}

function setExtension(filename) {
    currentExt = filename.includes('.') ? filename.split('.').pop().toLowerCase() : 'txt';
    procesarCambiosPesados();
}

function getLineAndCol(val, pos) {
    let line = 1;
    let lastNewLine = -1;
    for (let i = 0; i < pos; i++) {
        if (val[i] === '\n') {
            line++;
            lastNewLine = i;
        }
    }
    return { line, col: pos - lastNewLine };
}

function updateActiveLine() {
    if (!DOM.activeLineIndicator) return;
    const pos = DOM.editor.selectionStart;
    const val = DOM.editor.value;
    let currentLine = 1;
    for (let i = 0; i < pos; i++) {
        if (val[i] === '\n') currentLine++;
    }
    const lineHeight = 21; // 14px * 1.5
    const topPos = 10 + (currentLine - 1) * lineHeight - DOM.editor.scrollTop;
    DOM.activeLineIndicator.style.top = `${topPos}px`;
}

function seleccionarLinea(linea) {
    const val = DOM.editor.value;
    let currentLine = 1;
    let posInicio = 0;
    for (let i = 0; i < val.length; i++) {
        if (currentLine === linea) break;
        if (val[i] === '\n') {
            currentLine++;
            posInicio = i + 1;
        }
    }
    let posFin = posInicio;
    while (posFin < val.length && val[posFin] !== '\n') {
        posFin++;
    }

    DOM.editor.focus();
    DOM.editor.setSelectionRange(posInicio, posFin);
    actualizarCursorRápido();
}

function syncScroll() {
    DOM.highlighting.scrollTop = DOM.editor.scrollTop;
    DOM.highlighting.scrollLeft = DOM.editor.scrollLeft;
    DOM.lineNumbers.scrollTop = DOM.editor.scrollTop;
    updateActiveLine();
    highlightMatchingBrackets();
}

let highlightTimeout = null;
function handleInput(limpiarErrores = true) {
    if (limpiarErrores) window.sintacticoErrores = [];
    actualizarContadorLineas();
    actualizarCursorRápido();
    
    const text = DOM.editor.value;
    if (text.length > 5000) {
        DOM.highlighting.textContent = text + '\n';
        clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(() => {
            DOM.highlighting.innerHTML = applySyntaxHighlighting(DOM.editor.value) + '\n';
        }, 50);
    } else {
        let errorHtml = '';
        if (window.sintacticoErrores) {
            window.sintacticoErrores.forEach(err => {
                if (err && err.linea) {
                    const col = err.col || 1;
                    const len = err.len || 1;
                    const spaces = ' '.repeat(Math.max(0, col - 1));
                    const underline = ' '.repeat(Math.max(1, len));
                    errorHtml += `<div class="error-underline" style="top: ${10 + (err.linea - 1) * 21}px;">${spaces}<span>${underline}</span></div>`;
                }
            });
        }
        DOM.highlighting.innerHTML = applySyntaxHighlighting(text) + '\n' + errorHtml;
    }
    
    syncScroll();
}

function actualizarContadorLineas() {
    const val = DOM.editor.value;
    let lines = 1;
    for (let i = 0; i < val.length; i++) {
        if (val[i] === '\n') lines++;
    }
    
    if (lines !== currentLineCount) {
        currentLineCount = lines;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += i + '\n';
        }
        DOM.lineNumbers.textContent = html;
        synchronizeScrollbarOffset();
    }
}

function procesarCambiosPesados() { currentLineCount = -1; handleInput(); }

function actualizarCursorRápido() {
    const pos = getLineAndCol(DOM.editor.value, DOM.editor.selectionStart);
    requestAnimationFrame(() => {
        DOM.cursorPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;
        updateActiveLine();
        highlightMatchingBrackets();
    });
}

function highlightMatchingBrackets() {
    if (!DOM.bracketMatches) return;
    const rawText = DOM.editor.value;
    const pos = DOM.editor.selectionStart;
    DOM.bracketMatches.innerHTML = '';
    
    const pairs = { '{': '}', '}': '{', '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<' };
    const openBrackets = ['{', '(', '[', '<'];
    
    let text = "";
    let inString = false;
    let stringChar = '';
    let inLineComment = false;
    let inMultiComment = false;
    
    for (let i = 0; i < rawText.length; i++) {
        let char = rawText[i];
        let next = rawText[i + 1] || '';
        
        if (inLineComment) {
            if (char === '\n') { inLineComment = false; text += char; }
            else { text += ' '; }
            continue;
        }
        if (inMultiComment) {
            if (char === '*' && next === '/') { text += '  '; i++; inMultiComment = false; }
            else { text += char === '\n' ? '\n' : ' '; }
            continue;
        }
        if (inString) {
            if (char === '\\') { text += '  '; i++; }
            else if (char === stringChar) { text += ' '; inString = false; }
            else { text += char === '\n' ? '\n' : ' '; }
            continue;
        }
        
        if (char === '/' && next === '/') { inLineComment = true; text += '  '; i++; continue; }
        if (char === '/' && next === '*') { inMultiComment = true; text += '  '; i++; continue; }
        if (char === '"' || char === "'") { inString = true; stringChar = char; text += ' '; continue; }
        
        text += char;
    }
    
    let activeChar = '', activePos = -1;
    if (pos < text.length && pairs[text[pos]]) {
        activeChar = text[pos];
        activePos = pos;
    } else if (pos > 0 && pairs[text[pos - 1]]) {
        activeChar = text[pos - 1];
        activePos = pos - 1;
    }
    
    if (activePos === -1) return;
    
    const isForward = openBrackets.includes(activeChar);
    const targetChar = pairs[activeChar];
    let matchPos = -1;
    let depth = 0;
    
    if (isForward) {
        for (let i = activePos + 1; i < text.length; i++) {
            if (text[i] === activeChar) depth++;
            else if (text[i] === targetChar) {
                if (depth === 0) { matchPos = i; break; }
                depth--;
            }
        }
    } else {
        for (let i = activePos - 1; i >= 0; i--) {
            if (text[i] === activeChar) depth++;
            else if (text[i] === targetChar) {
                if (depth === 0) { matchPos = i; break; }
                depth--;
            }
        }
    }
    
    if (matchPos !== -1) {
        const buildSpan = (index) => {
            const loc = getLineAndCol(rawText, index);
            const lineText = rawText.split('\n')[loc.line - 1];
            const textBefore = lineText.substring(0, loc.col - 1);
            const escaped = textBefore.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const bracketEscaped = rawText[index].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const topPos = 10 + (loc.line - 1) * 21 - DOM.editor.scrollTop;
            const leftPos = 10 - DOM.editor.scrollLeft;
            return `<div style="position: absolute; top: ${topPos}px; left: ${leftPos}px; pointer-events: none; white-space: pre; tab-size: 4;"><span style="color: transparent; pointer-events: none;">${escaped}</span><span class="syntax-bracket-match">${bracketEscaped}</span></div>`;
        };
        DOM.bracketMatches.innerHTML = buildSpan(activePos) + buildSpan(matchPos);
    }
}

function synchronizeScrollbarOffset() { DOM.lineNumbers.style.paddingBottom = `${10 + DOM.editor.offsetHeight - DOM.editor.clientHeight}px`; }

function limpiarPaneles() {
    ['lexico','sintactico','semantico','intermedio','simbolos','ejecucion'].forEach(id => { const p = document.getElementById('panel_'+id); if(p) p.textContent = "Esperando..."; });
    ['lex','sin','sem'].forEach(id => { const p = document.getElementById('panel_err_'+id); if(p) p.textContent = "Sin errores."; });
}

function irALinea(linea) {
    const val = DOM.editor.value;
    let currentLine = 1;
    let pos = 0;
    for (let i = 0; i < val.length; i++) {
        if (currentLine === linea) break;
        if (val[i] === '\n') {
            currentLine++;
            pos = i + 1;
        }
    }
    
    DOM.editor.focus();
    DOM.editor.setSelectionRange(pos, pos);
    DOM.editor.scrollTop = (linea - 1) * 21 - (DOM.editor.clientHeight / 2) + 30;
    
    const prevShadow = DOM.editorContainer.style.boxShadow;
    DOM.editorContainer.style.boxShadow = "inset 0 0 15px var(--accent-primary)";
    setTimeout(() => DOM.editorContainer.style.boxShadow = prevShadow, 300);
}

// ==========================================================================
// COMPILADOR Y GENERACIÓN DE RESULTADOS (CLIENT-SIDE)
// ==========================================================================
function getLexicalClass(tipo) {
    if(tipo === 'EOF') return 'badge-default';
    if(tipo.includes('ERR')) return 'badge-error';
    switch(tipo) {
        case 'RESERVADA': return 'badge-keyword';
        case 'ID': return 'badge-id';
        case 'NUM_REAL':
        case 'NUM_ENTERO': return 'badge-number';
        case 'CADENA':
        case 'CARACTER': return 'badge-string';
        case 'COM_MULTI':
        case 'COM_SIMPLE': return 'badge-comment';
        case 'OP_RELACIONAL':
        case 'OP_LOGICO':
        case 'OP_ARITMETICO':
        case 'ASIGNACION': return 'badge-operator';
        default: return 'badge-default';
    }
}

async function compilarFase(fase) {
    document.querySelectorAll('.right-content').forEach(el => el.classList.add('oculto'));
    document.querySelectorAll('.right-panels .tab').forEach(el => el.classList.remove('active'));
    
    const panelActivo = document.getElementById('panel_' + fase);
    const tabActivo = document.querySelector(`.right-panels .tab[onclick*="${fase}"]`);
    
    if (panelActivo) panelActivo.classList.remove('oculto');
    if (tabActivo) tabActivo.classList.add('active');

    try {
        if (typeof CompilerEngine === 'undefined') {
            if (panelActivo) panelActivo.textContent = "Error: El motor del compilador no está cargado.";
            return;
        }

        const codigoFuente = DOM.editor.value;
        const res = await CompilerEngine.compilar(fase, codigoFuente);
        
        if (fase === 'lexico') {
            const data = res;
            
            // RENDER DE LA TABLA LÉXICA
            let tablaHTML = `
                <div class="panel-header-sticky">
                    <div>
                        <div class="panel-title-glow">=== TABLA DE TOKENS ===</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top:2px;">Haz clic en una fila para saltar al código</div>
                    </div>
                    <button class="btn-reload" onclick="compilarFase('lexico')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                </div>
                <div class="table-container">
                    <table class="lexical-table">
                        <thead>
                            <tr><th>Línea</th><th>Col</th><th>Tipo</th><th>Lexema</th></tr>
                        </thead>
                        <tbody>
            `;
            
            data.tokens.forEach(tok => {
                const cssClass = getLexicalClass(tok.tipo);
                const safeLexema = tok.lexema.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                tablaHTML += `
                    <tr class="rgb-table-row" onclick="irALinea(${tok.linea})">
                        <td>${tok.linea}</td>
                        <td>${tok.col}</td>
                        <td><span class="badge-tipo ${cssClass}">${tok.tipo}</span></td>
                        <td class="lexema-cell">${safeLexema}</td>
                    </tr>
                `;
            });
            
            tablaHTML += `</tbody></table></div>`;
            panelActivo.innerHTML = tablaHTML;

            // RENDER DEL PANEL DE ERRORES LÉXICOS
            const panelErrores = document.getElementById('panel_err_lex');
            if (panelErrores) {
                if (data.errores.length === 0) {
                    panelErrores.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px; vertical-align:middle;"></i> Análisis léxico completado sin errores.</div>';
                } else {
                    panelErrores.innerHTML = data.errores.map(err => {
                        const safeLex = err.lexema.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})">Ln ${err.linea} Col ${err.col} | ${err.tipo} | ${err.msg}: <b>${safeLex}</b></div>`;
                    }).join('');
                    
                    document.querySelectorAll('.bottom-panels .tab').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.bottom-content').forEach(el => el.classList.add('oculto'));
                    panelErrores.classList.remove('oculto');
                    document.querySelector(`.bottom-panels .tab[onclick*="err_lex"]`)?.classList.add('active');
                }
            }
        } else if (fase === 'sintactico') {
            const data = res;
            window.lastSintacticoData = data;
            
            function renderTreeTextual(node) {
                if (!node) return '';
                const clickEvent = node.linea ? `onclick="irALinea(${node.linea}); event.stopPropagation();"` : "";
                const hoverEvent = node.linea ? `onmouseenter="irALinea(${node.linea});"` : "";
                if (!node.children || node.children.length === 0) {
                    return `<div style="margin-left: 20px; padding: 2px 0; color: var(--text-secondary); cursor: pointer;" ${clickEvent} ${hoverEvent}><span style="color: var(--accent-primary);">▪</span> ${node.name}</div>`;
                }
                const summaryHover = node.linea ? `this.style.background='rgba(255,255,255,0.05)'; irALinea(${node.linea});` : `this.style.background='rgba(255,255,255,0.05)';`;
                let html = `<details open style="margin-left: 10px; margin-top: 5px;">
                    <summary style="cursor: pointer; font-weight: bold; color: var(--text-primary); padding: 3px; border-radius: 3px; transition: background 0.2s;" onmouseover="${summaryHover}" onmouseout="this.style.background='transparent'" ${clickEvent}><i data-lucide="folder-tree" style="width:14px; height:14px; margin-right:5px; color:var(--text-muted); display:inline-block; vertical-align:-2px;"></i> ${node.name}</summary>
                    <div style="border-left: 1px dashed var(--border-color); padding-left: 10px; margin-left: 7px;">`;
                node.children.forEach(child => {
                    html += renderTreeTextual(child);
                });
                html += `</div></details>`;
                return html;
            }
            
            let html = `
                <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="panel-title-glow">=== ÁRBOL SINTÁCTICO ===</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top:2px;" id="sintactico_hint">Arrastra para mover • Rueda para Zoom • Clic para colapsar</div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-reload" onclick="exportarSintactico()" title="Exportar JSON" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="download" style="width:14px; height:14px;"></i> Exportar</button>
                        <button class="btn-reload" onclick="toggleVistaSintactica()" title="Alternar Vista" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="eye" style="width:14px; height:14px;"></i> Vista</button>
                        <button class="btn-reload" onclick="toggleAmpliarSintactico(this)" title="Ampliar panel" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="maximize" style="width:14px; height:14px;"></i> Ampliar</button>
                        <button class="btn-reload" onclick="compilarFase('sintactico')" title="Refrescar" style="padding: 3px 8px; display:flex; align-items:center;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                    </div>
                </div>
                <div id="d3_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: hidden; background: var(--bg-primary);"></div>
                <div id="folder_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: auto; padding: 15px; font-family: var(--font-mono); font-size: 14px; display: none;"></div>
            `;
            
            panelActivo.innerHTML = html;
            
            if (data.tree && data.tree.children && data.tree.children.length > 0) {
                setTimeout(() => drawD3Tree(data.tree, "#d3_tree_container"), 50);
                const newFc = document.getElementById('folder_tree_container');
                newFc.innerHTML = renderTreeTextual(data.tree);
                
                if (window.vistaSintacticaActiva === 'carpetas') {
                    document.getElementById('d3_tree_container').style.display = 'none';
                    document.getElementById('folder_tree_container').style.display = 'block';
                    document.getElementById('sintactico_hint').textContent = 'Carpetas anidadas (Haz clic para colapsar o ir a línea)';
                }
            } else if (data.errores && data.errores.length > 0) {
                const d3c = document.getElementById('d3_tree_container');
                const fc = document.getElementById('folder_tree_container');
                if (d3c) d3c.style.display = 'none';
                if (fc) {
                    fc.style.display = 'block';
                    fc.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 15px; color: var(--text-muted); text-align: center; padding: 20px;">
                            <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ff6b6b;"></i>
                            <div style="font-size: 16px; font-weight: bold; color: var(--text-primary);">No se pudo generar el árbol sintáctico</div>
                            <div style="font-size: 12px; max-width: 400px;">El análisis encontró errores que impiden construir el árbol. Corrige los errores e intenta de nuevo.</div>
                            <div style="text-align: left; width: 100%; max-width: 500px; margin-top: 10px;">
                                ${data.errores.map(err => `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})" style="margin-bottom: 4px; padding: 6px 10px; border-radius: 4px; background: rgba(255,80,80,0.08); border-left: 3px solid #ff6b6b; cursor: pointer; font-family: var(--font-mono); font-size: 12px;"><strong>Ln ${err.linea}</strong> | ${err.msg}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }
                document.getElementById('sintactico_hint').textContent = 'Errores de análisis detectados';
            } else if (data.tree) {
                setTimeout(() => drawD3Tree(data.tree, "#d3_tree_container"), 50);
                const newFc = document.getElementById('folder_tree_container');
                newFc.innerHTML = renderTreeTextual(data.tree);
            }
            
            const panelErrores = document.getElementById('panel_err_sin');
            if (panelErrores) {
                if (data.errores.length === 0) {
                    panelErrores.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px; vertical-align:middle;"></i> Análisis sintáctico completado sin errores.</div>';
                } else {
                    window.sintacticoErrores = data.errores;
                    panelErrores.innerHTML = data.errores.map(err => {
                        return `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})">Ln ${err.linea} | ${err.msg}</div>`;
                    }).join('');
                    
                    handleInput(false);
                    
                    document.querySelectorAll('.bottom-panels .tab').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.bottom-content').forEach(el => el.classList.add('oculto'));
                    panelErrores.classList.remove('oculto');
                    document.querySelector(`.bottom-panels .tab[onclick*="err_sin"]`)?.classList.add('active');
                }
            }
        } else if (fase === 'semantico') {
            panelActivo.textContent = res;
            
            // Actualizar panel inferior de errores semánticos
            const panelErrores = document.getElementById('panel_err_sem');
            if (panelErrores) {
                if (res.includes("Error Semántico")) {
                    const lineasError = res.split('\n').filter(l => l.startsWith('Error Semántico'));
                    panelErrores.innerHTML = lineasError.map(l => `<div class="interactive-log-line error-log">${l}</div>`).join('');
                } else {
                    panelErrores.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px; vertical-align:middle;"></i> Análisis semántico completado sin inconsistencias.</div>';
                }
            }
        } else if (fase === 'simbolos') {
            const data = res;
            let html = `
                <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="panel-title-glow">=== TABLA DE SÍMBOLOS ===</div>
                    </div>
                    <button class="btn-reload" onclick="compilarFase('simbolos')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                </div>
                <div class="table-container">
                    <table class="lexical-table">
                        <thead>
                            <tr><th>Identificador</th><th>Tipo / Contexto</th><th>Líneas de Aparición</th></tr>
                        </thead>
                        <tbody>
            `;
            if (!data.simbolos || data.simbolos.length === 0) {
                html += `<tr><td colspan="3" style="text-align: center; font-style: italic; color: var(--text-muted);">No se detectaron símbolos</td></tr>`;
            } else {
                data.simbolos.forEach(simbolo => {
                    const safeId = simbolo.identificador.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    html += `
                        <tr class="rgb-table-row">
                            <td><strong>${safeId}</strong></td>
                            <td><span class="badge-tipo badge-id">${simbolo.tipo}</span></td>
                            <td style="font-family: var(--font-mono);">${simbolo.lineas}</td>
                        </tr>
                    `;
                });
            }
            html += `</tbody></table></div>`;
            panelActivo.innerHTML = html;
        } else if (fase === 'intermedio') {
            window.lastIntermedioRaw = res;
            const lineas = res.split('\n');
            let bloquesHTML = '';
            let bloqueActual = null;
            let totalInstrucciones = 0;

            const formatInstruction = (inst) => {
                const safe = inst.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return safe
                    .replace(/\b(ret|READ|WRITE)\b/g, '<span class="tac-keyword">$1</span>')
                    .replace(/\b(t\d+)\b/g, '<span class="tac-temp">$1</span>')
                    .replace(/(=|\+|\-|\*|\/|\^|%)/g, '<span class="tac-op">$1</span>')
                    .replace(/\b(\d+)\b/g, '<span class="tac-val">$1</span>')
                    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*<\/span>)/g, (match) => {
                        if (['ret', 'READ', 'WRITE', 'span', 'class', 'tac'].includes(match)) return match;
                        return `<span class="tac-var">${match}</span>`;
                    });
            };

            lineas.forEach(linea => {
                const l = linea.trim();
                if (!l || l.startsWith('---') || l.startsWith('Generación finalizada')) return;

                const matchComment = l.match(/^;\s*Traducción de la línea\s+(\d+)/i);
                if (matchComment) {
                    if (bloqueActual) {
                        bloquesHTML += renderTacBlock(bloqueActual);
                    }
                    bloqueActual = {
                        numLinea: matchComment[1],
                        instrucciones: []
                    };
                } else if (bloqueActual) {
                    bloqueActual.instrucciones.push(l);
                    totalInstrucciones++;
                } else {
                    if (!bloqueActual) {
                        bloqueActual = { numLinea: null, instrucciones: [] };
                    }
                    bloqueActual.instrucciones.push(l);
                    totalInstrucciones++;
                }
            });

            if (bloqueActual && bloqueActual.instrucciones.length > 0) {
                bloquesHTML += renderTacBlock(bloqueActual);
            }

            function renderTacBlock(bloque) {
                const header = bloque.numLinea 
                    ? `<div class="tac-block-header" onclick="irALinea(${bloque.numLinea})" title="Clic para ir a la línea ${bloque.numLinea} en el editor">
                        <span class="tac-line-badge"><i data-lucide="corner-down-right" style="width:12px; height:12px;"></i> Línea ${bloque.numLinea}</span>
                        <span style="font-size:10px;"><i data-lucide="external-link" style="width:11px; height:11px; vertical-align:-1px;"></i> Ir al código</span>
                       </div>`
                    : `<div class="tac-block-header"><span>Instrucciones</span></div>`;

                let rows = '';
                bloque.instrucciones.forEach((inst, idx) => {
                    rows += `
                        <div class="tac-inst-row">
                            <span class="tac-inst-num">${idx + 1}.</span>
                            <span class="tac-inst-content">${formatInstruction(inst)}</span>
                        </div>
                    `;
                });

                return `
                    <div class="tac-block">
                        ${header}
                        <div class="tac-block-body">
                            ${rows}
                        </div>
                    </div>
                `;
            }

            let html = `
                <div class="tac-container">
                    <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div class="panel-title-glow">=== CÓDIGO INTERMEDIO (3AC) ===</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top:2px;">Código de 3 direcciones generado</div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-reload" onclick="copiarCodigoIntermedio()" title="Copiar código al portapapeles" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="copy" style="width:14px; height:14px;"></i> Copiar</button>
                            <button class="btn-reload" onclick="compilarFase('intermedio')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                        </div>
                    </div>
                    <div class="tac-code-area">
                        ${bloquesHTML || '<div style="color:var(--text-muted); text-align:center; padding: 20px; font-style:italic;">No se generaron instrucciones intermedias.</div>'}
                        <div class="tac-summary-badge">
                            <i data-lucide="check-circle-2" style="width:15px; height:15px;"></i>
                            <span>Generación finalizada (${totalInstrucciones} instrucciones en 3 direcciones)</span>
                        </div>
                    </div>
                </div>
            `;
            panelActivo.innerHTML = html;
        } else if (panelActivo) {
            panelActivo.textContent = res;
        }

        if (fase === 'ejecucion' || fase === 'sintactico') {
            playNotificationSound();
        }

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    } catch (e) { 
        console.error("Error en compilación:", e);
        if (panelActivo) panelActivo.textContent = "Error al procesar: " + e.message; 
    }
}

function showRightPanel(e, id) {
    document.querySelectorAll('.right-content').forEach(el => el.classList.add('oculto'));
    document.querySelectorAll('.right-panels .tab').forEach(el => el.classList.remove('active'));
    document.getElementById('panel_' + id).classList.remove('oculto');
    e.target.classList.add('active');
    compilarFase(id);
}

function toggleAmpliarSintactico(btn) {
    const panels = document.getElementById('right_panels');
    if (panels.dataset.ampliado === "true") {
        panels.style.position = '';
        panels.style.top = '';
        panels.style.right = '';
        panels.style.bottom = '';
        panels.style.left = '';
        panels.style.width = panels.dataset.prevWidth || '300px';
        panels.style.zIndex = '';
        panels.dataset.ampliado = "false";
        btn.innerHTML = '<i data-lucide="maximize" style="width:14px; height:14px;"></i> Ampliar';
        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
        document.querySelector('.main-layout').style.overflow = '';
    } else {
        panels.dataset.prevWidth = panels.style.width || window.getComputedStyle(panels).width;
        panels.style.position = 'fixed';
        panels.style.top = '0';
        panels.style.right = '0';
        panels.style.bottom = '0';
        panels.style.left = '0';
        panels.style.width = '100vw';
        panels.style.height = '100vh';
        panels.style.zIndex = '9999';
        panels.dataset.ampliado = "true";
        btn.innerHTML = '<i data-lucide="minimize" style="width:14px; height:14px;"></i> Restaurar';
        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
        document.querySelector('.main-layout').style.overflow = 'hidden';
    }
}

window.vistaSintacticaActiva = 'grafico';
function toggleVistaSintactica() {
    const d3Cont = document.getElementById('d3_tree_container');
    const fCont = document.getElementById('folder_tree_container');
    const hint = document.getElementById('sintactico_hint');
    if (!d3Cont || !fCont) return;
    
    if (window.vistaSintacticaActiva === 'grafico') {
        d3Cont.style.display = 'none';
        fCont.style.display = 'block';
        hint.textContent = 'Carpetas anidadas (Haz clic para colapsar o ir a línea)';
        window.vistaSintacticaActiva = 'carpetas';
    } else {
        d3Cont.style.display = 'block';
        fCont.style.display = 'none';
        hint.textContent = 'Arrastra para mover • Rueda para Zoom • Clic para colapsar';
        window.vistaSintacticaActiva = 'grafico';
    }
}

function exportarSintactico() {
    if (!window.lastSintacticoData || !window.lastSintacticoData.tree) {
        mostrarNotificacion("No hay árbol sintáctico para exportar", true);
        return;
    }
    const dataStr = JSON.stringify(window.lastSintacticoData.tree, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arbol_sintactico.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarNotificacion('<i data-lucide="download" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Árbol exportado');
}

function copiarCodigoIntermedio() {
    if (!window.lastIntermedioRaw) {
        mostrarNotificacion("No hay código intermedio generado para copiar", true);
        return;
    }
    navigator.clipboard.writeText(window.lastIntermedioRaw).then(() => {
        mostrarNotificacion('<i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Código 3AC copiado al portapapeles');
    }).catch(() => {
        mostrarNotificacion("Error al copiar al portapapeles", true);
    });
}

function showBottomPanel(e, id) {
    document.querySelectorAll('.bottom-content').forEach(el => el.classList.add('oculto'));
    document.querySelectorAll('.bottom-panels .tab').forEach(el => el.classList.remove('active'));
    document.getElementById('panel_' + id).classList.remove('oculto');
    e.target.classList.add('active');
    
    if (id === 'err_lex') compilarFase('lexico');
    else if (id === 'err_sin') compilarFase('sintactico');
    else if (id === 'err_sem') compilarFase('semantico');
}

// ==========================================================================
// ARCHIVOS CLIENT-SIDE
// ==========================================================================
async function nuevoArchivo() {
    if (DOM.editor.value.trim() !== '' && !await Modals.confirm('Nuevo', '¿Crear nuevo archivo? Se perderá lo no guardado.', 'Crear', 'Cancelar')) return;
    let nombre = await Modals.prompt("Nuevo Archivo", "Nombre del archivo:", "codigo." + currentExt);
    if (!nombre) return;
    DOM.editor.value = '';
    setFilename(nombre);
    currentOpenedFileAbsPath = '/' + nombre;
    limpiarPaneles();
    procesarCambiosPesados();
    guardarEnServidor(nombre, false);
}

async function cerrarArchivo() {
    if (DOM.editor.value.trim() !== '' && !await Modals.confirm('Cerrar', '¿Cerrar sin guardar?', 'Cerrar', 'Cancelar')) return;
    DOM.editor.value = '';
    setFilename('Sin título');
    currentOpenedFileAbsPath = '';
    limpiarPaneles();
    procesarCambiosPesados();
}

async function guardarEnServidor(nombreArchivo, esGuardarComo = false) {
    if (typeof VirtualFS === 'undefined') return;
    const ruta = currentOpenedFileAbsPath || ('/' + nombreArchivo);
    const res = await VirtualFS.guardarArchivoFisico(ruta, DOM.editor.value);
    
    let icon = '<i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i>';
    let text = res.savedToDisk ? 'Guardado en disco' : 'Guardado en Workspace';
    if (esGuardarComo && !res.savedToDisk) text = 'Guardado en Workspace';
    
    mostrarNotificacion(`${icon} ${text}`);
    cargarExplorador();
}

async function guardarArchivo() {
    const name = DOM.currentFilename.value;
    (name === 'Sin título' || !name) ? guardarComoArchivo() : guardarEnServidor(name, false);
}

async function guardarComoArchivo() {
    if (typeof VirtualFS !== 'undefined' && 'showSaveFilePicker' in window) {
        const res = await VirtualFS.descargarArchivoLocal(DOM.currentFilename.value.replace(/^\//, ''), DOM.editor.value);
        if (res && res.success && res.isNative) {
            setFilename(res.handleName);
            currentOpenedFileAbsPath = res.ruta;
            await guardarEnServidor(res.handleName, true);
            return;
        } else if (res && res.cancelado) {
            return;
        }
    }

    let nombre = await Modals.prompt("Guardar Como", "Nombre del archivo a descargar y guardar:", DOM.currentFilename.value.replace(/^\//, ''));
    if (!nombre) return;
    setFilename(nombre);
    currentOpenedFileAbsPath = '/' + nombre;
    await guardarEnServidor(nombre, true);
    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.descargarArchivoLocal(nombre, DOM.editor.value);
    }
}

async function abrirArchivo() {
    if (typeof VirtualFS !== 'undefined') {
        const res = await VirtualFS.abrirArchivoDesdeDisco();
        if (res && res.success) {
            DOM.editor.value = res.contenido;
            setFilename(res.nombre);
            currentOpenedFileAbsPath = res.ruta;
            procesarCambiosPesados();
            limpiarPaneles();
            cargarExplorador();
            mostrarNotificacion('<i data-lucide="folder-open" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Archivo cargado');
        }
    }
}

async function borrarArchivo(event, rutaAbsoluta, nombre) {
    if (event) event.stopPropagation();
    if (!await Modals.confirm('Eliminar Archivo', `¿Eliminar <b>${nombre}</b> del Workspace?<br><br>No se puede deshacer.`, 'Eliminar', 'Cancelar')) return;

    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.borrarArchivo(rutaAbsoluta);
        mostrarNotificacion('<i data-lucide="trash" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Archivo eliminado');
        if (currentOpenedFileAbsPath === rutaAbsoluta) {
            DOM.editor.value = '';
            setFilename('Sin título');
            currentOpenedFileAbsPath = '';
            limpiarPaneles();
            procesarCambiosPesados();
        }
        cargarExplorador();
    }
}

// ==========================================================================
// UTILS
// ==========================================================================
function mostrarNotificacion(msg, esError = false) {
    const el = document.getElementById('status_msg');
    el.innerHTML = (esError ? '<i data-lucide="alert-circle" style="width:14px; height:14px; vertical-align:-2px;"></i> ' : '') + msg + ' - ' + new Date().toLocaleTimeString();
    el.style.color = esError ? '#ff6666' : 'var(--text-muted)';
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => { el.style.color = ""; el.textContent = "⚡ Motor WebAssembly & Client-Side Activo"; }, 3000);
}

function verLogErrores() {
    const logInfo = `=== LOG DEL IDE INDÓMITO (CLIENT-SIDE) ===\n\n` +
        `Estado: Activo\n` +
        `Plataforma: Navegador Web (Cero Dependencias de PHP)\n` +
        `Analizador Léxico: Listo\n` +
        `Analizador Sintáctico AST: Listo\n` +
        `Analizador Semántico: Listo\n` +
        `Tabla de Símbolos: Lista\n` +
        `Generador 3AC: Listo\n` +
        `Workspace Virtual: Inicializado\n`;
    Modals.alert("LOG DEL SISTEMA", logInfo);
}

async function salirIDE() {
    if (await Modals.confirm("Reiniciar Workspace", "¿Deseas reiniciar los archivos del Workspace a su estado inicial?")) {
        localStorage.removeItem('ide_indomito_virtual_workspace_v1');
        window.location.reload();
    }
}

async function cerrarVentana() {
    if (await Modals.confirm("Salir del IDE", "¿Estás seguro que deseas salir y cerrar el entorno?")) {
        // Intenta cerrar la pestaña
        window.close();
        
        // Si el navegador bloquea el cierre, muestra una pantalla negra de "Cerrado"
        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background-color:var(--bg-primary, #1e1e1e); color:var(--text-primary, #ffffff); font-family:sans-serif;">
                <h1 style="font-size: 40px; margin-bottom: 10px;">IDE Cerrado</h1>
                <p style="font-size: 18px; opacity: 0.7;">El entorno ha finalizado. Ya puedes cerrar esta pestaña con seguridad.</p>
            </div>
        `;
    }
}

// Sonido de notificación de actividad terminada
function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        
        // Melodía alegre (arpegio de éxito)
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.7);
    } catch (e) {
        console.log("Audio API no soportada en este navegador.");
    }
}

async function finalizarActividad() {
    playNotificationSound();
    await Modals.alert("¡Actividad Terminada!", "La actividad se ha completado exitosamente. Se ha reproducido el sonido de notificación.");
}

function toggleTheme() {
    document.body.classList.remove('rgb-theme');
    document.body.classList.toggle('light-theme');
    localStorage.setItem('ide_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
}

function toggleRGB() {
    document.body.classList.remove('light-theme');
    document.body.classList.toggle('rgb-theme');
    localStorage.setItem('ide_theme', document.body.classList.contains('rgb-theme') ? 'rgb' : 'dark');
}

function abrirAutomata() { window.open('automata.html', '_blank', 'width=1100,height=800'); }

document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('ide_theme');
    if (theme === 'light') document.body.classList.add('light-theme');
    else if (theme === 'rgb') document.body.classList.add('rgb-theme');
    
    DOM.activeLineIndicator = document.createElement('div');
    DOM.activeLineIndicator.id = 'active_line_indicator';
    document.querySelector('.code-area').prepend(DOM.activeLineIndicator);
    
    DOM.lineNumbers.addEventListener('mousedown', (e) => {
        const rect = DOM.lineNumbers.getBoundingClientRect();
        const clickY = e.clientY - rect.top + DOM.lineNumbers.scrollTop - 10;
        if (clickY < 0) return;
        const clickedLine = Math.floor(clickY / 21) + 1;
        seleccionarLinea(clickedLine);
    });
    
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === DOM.editor) {
            actualizarCursorRápido();
        }
    });
    
    // Cargar archivo inicial del VirtualFS si existe
    if (typeof VirtualFS !== 'undefined') {
        const initFile = VirtualFS.cargarArchivo('/testLexico.txt');
        if (initFile.success) {
            DOM.editor.value = initFile.contenido;
            setFilename('testLexico.txt');
            currentOpenedFileAbsPath = '/testLexico.txt';
        }
    }
    
    procesarCambiosPesados();
    cargarExplorador();
    compilarFase('sintactico');
    if (window.lucide) lucide.createIcons();
});

// ==========================================================================
// D3.js TREE VISUALIZATION
// ==========================================================================
function drawD3Tree(treeData, containerId) {
    const container = document.querySelector(containerId);
    if (!container || typeof d3 === 'undefined') return;
    
    container.innerHTML = '';
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const margin = {top: 20, right: 120, bottom: 20, left: 120};

    const zoom = d3.zoom().scaleExtent([0.1, 3]).on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

    const svg = d3.select(containerId).append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("font-family", "var(--font-sans)")
        .call(zoom)
        .on("dblclick.zoom", null);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree().nodeSize([40, 200]);
    const root = d3.hierarchy(treeData, d => d.children);
    root.x0 = height / 2;
    root.y0 = 0;

    let i = 0;
    
    function update(source) {
        const treeDataResult = tree(root);
        const nodes = treeDataResult.descendants();
        const links = treeDataResult.descendants().slice(1);

        nodes.forEach(d => d.y = d.depth * 220);

        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('mouseover', (event, d) => {
                if (d.data.linea) {
                    irALinea(d.data.linea);
                }
            })
            .on('click', (event, d) => {
                if (d.data.linea) {
                    irALinea(d.data.linea);
                }
                
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
            });

        nodeEnter.append('rect')
            .attr('class', 'node-box')
            .attr('y', -15)
            .attr('height', 30)
            .attr('rx', 5)
            .attr('ry', 5)
            .style("fill", d => d._children ? "var(--accent-primary)" : "var(--bg-tertiary)")
            .style("stroke", "var(--accent-primary)")
            .style("stroke-width", "1px")
            .style("cursor", "pointer");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", 0)
            .attr("text-anchor", "middle")
            .text(d => d.data.name)
            .style("fill", "var(--text-primary)")
            .style("font-size", "12px")
            .style("pointer-events", "none");

        const nodeUpdate = nodeEnter.merge(node);
        nodeUpdate.transition().duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('rect')
            .attr('width', function(d) {
                const textNode = this.parentNode.querySelector('text');
                const textWidth = textNode ? textNode.getBBox().width : 80;
                return textWidth + 20;
            })
            .attr('x', function(d) {
                const textNode = this.parentNode.querySelector('text');
                const textWidth = textNode ? textNode.getBBox().width : 80;
                return -(textWidth + 20) / 2;
            })
            .style("fill", d => d._children ? "var(--bg-secondary)" : "var(--bg-tertiary)")
            .style("stroke", d => d._children ? "var(--text-primary)" : "var(--accent-primary)");

        const nodeExit = node.exit().transition().duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();
        nodeExit.select('rect').attr('width', 0).attr('height', 0);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        const link = g.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .style("fill", "none")
            .style("stroke", "var(--border-color)")
            .style("stroke-width", "2px")
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);
        linkUpdate.transition().duration(500)
            .attr('d', d => diagonal(d, d.parent));

        const linkExit = link.exit().transition().duration(500)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    update(root);
    
    const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(0.85);
    svg.call(zoom.transform, initialTransform);
}