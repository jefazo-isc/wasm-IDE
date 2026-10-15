// ==========================================================================
// IDE INDÓMITO - CLIENT-SIDE & WEB ASSEMBLY CORE ENGINE
// ==========================================================================

function initDOM() {
    DOM.editor = document.getElementById('editor');
    DOM.highlighting = document.getElementById('highlighting');
    DOM.lineNumbers = document.getElementById('line_numbers');
    DOM.cursorPos = document.getElementById('cursor_pos');
    DOM.currentFilename = document.getElementById('current_filename');
    DOM.fileIndicator = document.getElementById('file_indicator');
    DOM.bracketMatches = document.getElementById('bracket_matches');
    DOM.statusMsg = document.getElementById('status_msg');
    DOM.workspacePath = document.getElementById('workspace_path');
    DOM.explorerContent = document.getElementById('explorer_content');
    DOM.fileExplorer = document.getElementById('file_explorer');
    DOM.editorContainer = document.getElementById('editor_container');
    DOM.rightPanels = document.getElementById('right_panels');
    DOM.bottomPanels = document.getElementById('bottom_panels');
    DOM.topLayout = document.querySelector('.top-layout');
    DOM.resizerV = document.getElementById('resizer_v');
    DOM.resizerExp = document.getElementById('resizer_explorer');
    DOM.resizerH = document.getElementById('resizer_h');

    DOM.resizerV?.addEventListener('mousedown', () => enableResize('v', 'col-resize'));
    DOM.resizerExp?.addEventListener('mousedown', () => enableResize('exp', 'col-resize'));
    DOM.resizerH?.addEventListener('mousedown', () => enableResize('h', 'row-resize'));
}

const DOM = {
    editor: null,
    highlighting: null,
    lineNumbers: null,
    cursorPos: null,
    currentFilename: null,
    fileIndicator: null,
    bracketMatches: null,
    statusMsg: null,
    workspacePath: null,
    explorerContent: null,
    fileExplorer: null,
    editorContainer: null,
    rightPanels: null,
    bottomPanels: null,
    topLayout: null,
    resizerV: null,
    resizerExp: null,
    resizerH: null,
    activeLineIndicator: null
};

let currentExt = 'txt';
let currentOpenedFileAbsPath = '/testLexico.txt';
let currentLineCount = 0;
let saveInProgress = false;

// ==========================================================================
// SISTEMA DE PESTAÑAS (Tabs de archivos abiertos)
// ==========================================================================
const openTabs = []; // { path, name, content, scrollTop, cursorPos }
let activeTabPath = null;

const TabManager = {
    /** Abre o enfoca una pestaña. Si ya existe, la activa; si no, la crea. */
    open(path, name, content) {
        const existing = openTabs.find(t => t.path === path);
        if (existing) {
            this.activate(path);
            return;
        }
        openTabs.push({
            path,
            name,
            content: content ?? '',
            scrollTop: 0,
            cursorPos: 0
        });
        this.activate(path);
    },

    /** Activa una pestaña, guardando el estado de la anterior */
    activate(path) {
        if (activeTabPath) {
            const current = openTabs.find(t => t.path === activeTabPath);
            if (current && DOM.editor) {
                current.content = DOM.editor.value;
                current.scrollTop = DOM.editor.scrollTop;
                current.cursorPos = DOM.editor.selectionStart;
            }
        }

        activeTabPath = path;
        const tab = openTabs.find(t => t.path === path);
        if (tab && DOM.editor) {
            DOM.editor.value = tab.content;
            currentOpenedFileAbsPath = tab.path;
            setFilename(tab.name);
            procesarCambiosPesados();

            requestAnimationFrame(() => {
                if (DOM.editor) {
                    DOM.editor.scrollTop = tab.scrollTop;
                    DOM.editor.setSelectionRange(tab.cursorPos, tab.cursorPos);
                    actualizarCursorRápido();
                }
            });
        }
        this.render();
    },

    /** Cierra una pestaña, con confirmación si tiene cambios */
    async close(path) {
        const idx = openTabs.findIndex(t => t.path === path);
        if (idx === -1) return;

        if (path === activeTabPath && DOM.editor) {
            openTabs[idx].content = DOM.editor.value;
        }

        if (typeof VirtualFS !== 'undefined') {
            const saved = VirtualFS.cargarArchivo(path);
            if (saved.success && saved.contenido !== openTabs[idx].content) {
                const confirmar = await Modals.confirm('Cerrar pestaña', `¿Cerrar <b>${openTabs[idx].name}</b> sin guardar los cambios?`, 'Cerrar', 'Cancelar');
                if (!confirmar) return;
            }
        }

        openTabs.splice(idx, 1);

        if (path === activeTabPath) {
            if (openTabs.length > 0) {
                const newIdx = Math.min(idx, openTabs.length - 1);
                this.activate(openTabs[newIdx].path);
            } else {
                activeTabPath = null;
                currentOpenedFileAbsPath = '';
                if (DOM.editor) DOM.editor.value = '';
                setFilename('Sin título');
                limpiarPaneles();
                procesarCambiosPesados();
                this.render();
            }
        } else {
            this.render();
        }
    },

    /** Actualiza el contenido guardado de la pestaña activa */
    syncActive() {
        if (!activeTabPath) return;
        const tab = openTabs.find(t => t.path === activeTabPath);
        if (tab && DOM.editor) {
            tab.content = DOM.editor.value;
        }
    },

    /** Renderiza la barra de pestañas */
    render() {
        const container = document.getElementById('editor_tabs');
        if (!container) return;

        if (openTabs.length === 0) {
            container.innerHTML = '<div class="editor-tabs-empty">Sin archivos abiertos</div>';
            return;
        }

        container.innerHTML = openTabs.map(tab => {
            const isActive = tab.path === activeTabPath;
            const safeP = tab.path.replace(/'/g, "\\'");
            return `<div class="editor-tab ${isActive ? 'active' : ''}" onclick="TabManager.activate('${safeP}')" title="${tab.path}">
                        <i data-lucide="file-code-2" class="editor-tab-icon"></i>
                        <span class="editor-tab-name">${tab.name}</span>
                        <button class="editor-tab-close" onclick="event.stopPropagation(); TabManager.close('${safeP}')" title="Cerrar">×</button>
                    </div>`;
        }).join('');

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    }
};

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
            if (b.primary) {
                return `<button id="mbtn_${i}" style="padding: 8px 18px; cursor: pointer; background: #1a8cef; color: #fff; border: 1px solid #3aa0f5; border-radius: 5px; margin-left: 10px; font-weight: bold; font-size: 13px; transition: background 0.2s, transform 0.1s;" onmouseover="this.style.background='#3aa0f5'" onmouseout="this.style.background='#1a8cef'">${b.text}</button>`;
            } else {
                return `<button id="mbtn_${i}" style="padding: 8px 18px; cursor: pointer; background: rgba(255,255,255,0.08); color: var(--text-primary); border: 1px solid var(--text-muted); border-radius: 5px; margin-left: 10px; font-weight: 500; font-size: 13px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">${b.text}</button>`;
            }
        }).join('');

        const box = document.createElement('div');
        box.style.cssText = 'background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; min-width: 350px; max-width: 500px; box-shadow: 0 5px 15px var(--shadow-color); font-family: var(--font-sans);';
        box.innerHTML = `<h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 15px;">${titulo}</h3><div style="color: var(--text-primary); margin-bottom: 20px; font-size: 14px; max-height: 60vh; overflow-y: auto;">${htmlContent}</div><div style="display: flex; justify-content: flex-end;">${btnsHtml}</div>`;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        buttons.forEach((b, i) => {
            document.getElementById(`mbtn_${i}`)?.addEventListener('click', () => {
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
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1')?.click(); });
            }
        }, 50);
        const res = await Modals.show(titulo, html, [{ text: 'Cancelar', value: null }, { text: 'Aceptar', value: 'OK', primary: true }]);
        return res === 'OK' ? document.getElementById('modal_input')?.value ?? null : null;
    },

    confirm: async (tit, msg, btnSi = 'Sí', btnNo = 'No') =>
        await Modals.show(tit, `<p>${msg}</p>`, [{ text: btnNo, value: false }, { text: btnSi, value: true, primary: true }]),

    alert: async (tit, msg) =>
        await Modals.show(tit, `<pre style="white-space: pre-wrap; font-family: var(--font-mono); margin: 0;">${msg}</pre>`, [{ text: 'Aceptar', value: true, primary: true }]),

    promptPassword: async (titulo, mensaje) => {
        const html = `<p style="margin-bottom: 10px;">${mensaje}</p><input type="password" id="modal_input" style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: var(--font-mono); box-sizing: border-box;">`;
        setTimeout(() => {
            const input = document.getElementById('modal_input');
            if (input) {
                input.focus();
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1')?.click(); });
            }
        }, 50);
        const res = await Modals.show(titulo, html, [{ text: 'Cancelar', value: null }, { text: 'Aceptar', value: 'OK', primary: true }]);
        return res === 'OK' ? document.getElementById('modal_input')?.value ?? null : null;
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
    if (DOM.editor) DOM.editor.style.pointerEvents = 'none';
};

document.addEventListener('mousemove', e => {
    if (!isResizing.v && !isResizing.h && !isResizing.exp) return;
    if (animFrame) cancelAnimationFrame(animFrame);

    animFrame = requestAnimationFrame(() => {
        if (isResizing.v && DOM.rightPanels) {
            const w = document.body.clientWidth - e.clientX;
            if (w > 200 && w < window.innerWidth - 200) DOM.rightPanels.style.width = w + 'px';
        }
        if (isResizing.exp && DOM.fileExplorer) {
            const w = e.clientX;
            if (w > 150 && w < window.innerWidth / 2) DOM.fileExplorer.style.width = w + 'px';
        }
        if (isResizing.h && DOM.topLayout) {
            const mainLayout = document.querySelector('.main-layout');
            const topOffset = mainLayout ? mainLayout.getBoundingClientRect().top : 0;
            const h = e.clientY - topOffset;
            if (h > 100 && h < window.innerHeight - 100) DOM.topLayout.style.flex = `0 0 ${h}px`;
        }
    });
});

document.addEventListener('mouseup', () => {
    isResizing = { v: false, exp: false, h: false };
    document.body.style.cursor = 'default';
    if (DOM.editor) DOM.editor.style.pointerEvents = 'auto';
});
window.addEventListener('resize', synchronizeScrollbarOffset);

// ==========================================================================
// EXPLORADOR Y ATAJOS CLIENT-SIDE
// ==========================================================================
document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        guardarArchivo();
    } else if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        if (await Modals.confirm("Recargar IDE", "¿Deseas recargar la aplicación? Cualquier cambio no guardado en el archivo actual se perderá.")) {
            window.location.reload();
        }
    }
});

window.addEventListener('beforeunload', (e) => {
    if (DOM.editor && DOM.editor.value.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function cargarExplorador(rutaSolicitada = null) {
    const ruta = rutaSolicitada ?? DOM.workspacePath?.value.trim() ?? '/';

    if (typeof VirtualFS === 'undefined') return;
    const res = VirtualFS.listarDirectorio(ruta);

    if (res.success) {
        if (DOM.workspacePath) DOM.workspacePath.value = res.ruta_actual;
        if (DOM.explorerContent) {
            DOM.explorerContent.innerHTML = res.elementos.length ? res.elementos.map(el => {
                const rEsc = el.ruta.replace(/'/g, "\\'");
                const mName = el.nombre;

                if (el.es_directorio) {
                    return `<div class="explorer-item folder" onclick="cargarExplorador('${rEsc}')">
                                <span style="display:flex; align-items:center; flex:1; overflow:hidden; text-overflow:ellipsis;">
                                    <i data-lucide="folder" style="width:14px; height:14px; margin-right:5px; color:var(--text-muted); flex-shrink:0;"></i>
                                    <span class="folder-name">${mName}</span>
                                </span>
                                <button class="btn-delete-file" onclick="borrarCarpeta(event, '${rEsc}', '${mName}')" title="Borrar carpeta"><i data-lucide="trash-2"></i></button>
                            </div>`;
                } else {
                    return `<div class="explorer-item file" onclick="abrirDesdeExplorador('${rEsc}', '${mName}')">
                                <span style="display:flex; align-items:center;"><i data-lucide="file-code-2" style="width:14px; height:14px; margin-right:5px; color:var(--text-muted);"></i><span class="file-name">${mName}</span></span>
                                <button class="btn-delete-file" onclick="borrarArchivo(event, '${rEsc}', '${mName}')" title="Borrar"><i data-lucide="trash-2"></i></button>
                            </div>`;
                }
            }).join('') : '<div style="padding: 10px; color: var(--text-muted); font-style: italic;">Carpeta vacía</div>';
        }

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    }
}

function subirDirectorio() {
    const rutaActual = DOM.workspacePath?.value.trim() || '/';
    if (rutaActual === '/') return;

    const partes = rutaActual.split('/').filter(Boolean);
    partes.pop();
    const nuevaRuta = partes.length === 0 ? '/' : '/' + partes.join('/');
    cargarExplorador(nuevaRuta);
}

function abrirDesdeExplorador(rutaAbsoluta, nombre) {
    if (typeof VirtualFS === 'undefined') return;
    const res = VirtualFS.cargarArchivo(rutaAbsoluta);
    if (res.success) {
        TabManager.open(res.ruta_absoluta, res.nombre, res.contenido);
        mostrarNotificacion('<i data-lucide="folder-open" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Abierto');
    } else {
        mostrarNotificacion("Error al abrir archivo", true);
    }
}

const togglePanel = (el, resizer) => { el?.classList.toggle('panel-hidden'); resizer?.classList.toggle('panel-hidden'); };
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
    if (DOM.currentFilename) DOM.currentFilename.value = filename;
    if (DOM.fileIndicator) DOM.fileIndicator.textContent = 'Archivo: ' + filename;
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
    if (!DOM.activeLineIndicator || !DOM.editor) return;
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
    if (!DOM.editor) return;
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
    if (!DOM.editor) return;
    if (DOM.highlighting) {
        DOM.highlighting.scrollTop = DOM.editor.scrollTop;
        DOM.highlighting.scrollLeft = DOM.editor.scrollLeft;
    }
    if (DOM.lineNumbers) {
        DOM.lineNumbers.scrollTop = DOM.editor.scrollTop;
    }
    updateActiveLine();
    highlightMatchingBrackets();
}

let highlightTimeout = null;
function handleInput(limpiarErrores = true) {
    if (limpiarErrores) window.sintacticoErrores = [];
    actualizarContadorLineas();
    actualizarCursorRápido();

    if (!DOM.editor || !DOM.highlighting) return;
    const text = DOM.editor.value;
    if (text.length > 5000) {
        DOM.highlighting.textContent = text + '\n';
        clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(() => {
            if (DOM.highlighting && DOM.editor) {
                DOM.highlighting.innerHTML = applySyntaxHighlighting(DOM.editor.value) + '\n';
            }
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
    if (!DOM.editor || !DOM.lineNumbers) return;
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
    if (!DOM.editor || !DOM.cursorPos) return;
    const pos = getLineAndCol(DOM.editor.value, DOM.editor.selectionStart);
    requestAnimationFrame(() => {
        if (DOM.cursorPos) DOM.cursorPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;
        updateActiveLine();
        highlightMatchingBrackets();
    });
}

function highlightMatchingBrackets() {
    if (!DOM.bracketMatches || !DOM.editor) return;
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

function synchronizeScrollbarOffset() {
    if (DOM.lineNumbers && DOM.editor) {
        DOM.lineNumbers.style.paddingBottom = `${10 + DOM.editor.offsetHeight - DOM.editor.clientHeight}px`;
    }
}

function limpiarPaneles() {
    ['lexico', 'sintactico', 'semantico', 'intermedio', 'simbolos', 'ejecucion'].forEach(id => {
        const p = document.getElementById('panel_' + id);
        if (p) p.textContent = "Esperando...";
    });
    ['lex', 'sin', 'sem'].forEach(id => {
        const p = document.getElementById('panel_err_' + id);
        if (p) p.textContent = "Sin errores.";
    });
}

function irALinea(linea) {
    if (!DOM.editor) return;
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

    if (DOM.editorContainer) {
        const prevShadow = DOM.editorContainer.style.boxShadow;
        DOM.editorContainer.style.boxShadow = "inset 0 0 15px var(--accent-primary)";
        setTimeout(() => DOM.editorContainer.style.boxShadow = prevShadow, 300);
    }
}

// ==========================================================================
// COMPILADOR Y GENERACIÓN DE RESULTADOS (CLIENT-SIDE)
// ==========================================================================
function getLexicalClass(tipo) {
    if (tipo === 'EOF') return 'badge-default';
    if (tipo.includes('ERR')) return 'badge-error';
    switch (tipo) {
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

        const codigoFuente = DOM.editor ? DOM.editor.value : '';
        const res = await CompilerEngine.compilar(fase, codigoFuente);

        if (fase === 'lexico') {
            const data = res;

            let tablaHTML = `
                <div class="panel-header-sticky">
                    <div style="font-size: 11px; color: var(--text-muted);">Clic en una fila para ir al código</div>
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
            if (panelActivo) panelActivo.innerHTML = tablaHTML;

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
                    <div style="font-size: 11px; color: var(--text-muted);" id="sintactico_hint">Arrastra • Rueda para Zoom • Clic para colapsar</div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-reload" id="btn_toggle_anotado" onclick="toggleModoArbolAnotado()" title="Alternar Árbol Estándar vs Anotado Semántico" style="padding: 3px 8px; display:flex; align-items:center; gap:3px; background: rgba(59, 130, 246, 0.2); border-color: var(--accent-primary);"><i data-lucide="tag" style="width:14px; height:14px; color:var(--accent-primary);"></i> <span id="lbl_arbol_anotado">${window.modoArbolAnotado ? 'Árbol Normal' : 'Árbol Anotado'}</span></button>
                        <button class="btn-reload" onclick="exportarSintactico()" title="Exportar JSON" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="download" style="width:14px; height:14px;"></i> Exportar</button>
                        <button class="btn-reload" onclick="toggleVistaSintactica()" title="Alternar Vista" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="eye" style="width:14px; height:14px;"></i> Vista</button>
                        <button class="btn-reload" onclick="toggleAmpliarSintactico(this)" title="Ampliar panel" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="maximize" style="width:14px; height:14px;"></i> Ampliar</button>
                        <button class="btn-reload" onclick="compilarFase('sintactico')" title="Refrescar" style="padding: 3px 8px; display:flex; align-items:center;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                    </div>
                </div>
                <div id="d3_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: hidden; background: var(--bg-primary);"></div>
                <div id="folder_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: auto; padding: 15px; font-family: var(--font-mono); font-size: 14px; display: none;"></div>
            `;

            if (panelActivo) panelActivo.innerHTML = html;

            const arbolParaMostrar = (window.modoArbolAnotado && window.lastAnnotatedTree) ? window.lastAnnotatedTree : data.tree;

            const hint = document.getElementById('sintactico_hint');
            if (hint) {
                if (window.modoArbolAnotado) {
                    hint.innerHTML = '<span style="color:var(--accent-success); font-weight:600;">Árbol Anotado (Tipos y Atributos Semánticos)</span> • Clic para colapsar';
                } else {
                    hint.textContent = 'Árbol Sintáctico Estándar • Arrastra • Zoom • Clic para colapsar';
                }
            }

            if (arbolParaMostrar && arbolParaMostrar.children && arbolParaMostrar.children.length > 0) {
                setTimeout(() => drawD3Tree(arbolParaMostrar, "#d3_tree_container"), 50);
                const newFc = document.getElementById('folder_tree_container');
                if (newFc) newFc.innerHTML = renderTreeTextual(arbolParaMostrar);

                if (window.vistaSintacticaActiva === 'carpetas') {
                    const d3c = document.getElementById('d3_tree_container');
                    const fc = document.getElementById('folder_tree_container');
                    if (d3c) d3c.style.display = 'none';
                    if (fc) fc.style.display = 'block';
                    if (hint) hint.textContent = window.modoArbolAnotado 
                        ? 'Árbol Anotado (Carpetas anidadas - Clic para colapsar o ir a línea)'
                        : 'Carpetas anidadas (Haz clic para colapsar o ir a línea)';
                }
            } else if (data.errores && data.errores.length > 0) {
                const d3c = document.getElementById('d3_tree_container');
                const fc = document.getElementById('folder_tree_container');
                const hint = document.getElementById('sintactico_hint');
                if (d3c) d3c.style.display = 'none';
                if (fc) {
                    fc.style.display = 'block';
                    fc.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 15px; color: var(--text-muted); text-align: center; padding: 20px;">
                            <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ff6b6b;"></i>
                            <div style="font-size: 16px; font-weight: bold; color: var(--text-primary);">No se pudo generar el árbol sintáctico</div>
                            <div style="font-size: 12px; max-width: 400px;">El análisis encontró errores que impiden construir el árbol. Corrige los errores e intenta de nuevo.</div>
                            <div style="text-align: left; width: 100%; max-width: 500px; margin-top: 10px;">
                                ${data.errores.map(err => `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})" style="margin-bottom: 4px; padding: 6px 10px; border-radius: 4px; background: rgba(255,80,80,0.08); border-left: 3px solid #ff6b6b; cursor: pointer; font-family: var(--font-mono); font-size: 12px;"><strong>Ln ${err.linea}</strong> \vert{}${err.msg}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }
                if (hint) hint.textContent = 'Errores de análisis detectados';
            } else if (arbolParaMostrar) {
                setTimeout(() => drawD3Tree(arbolParaMostrar, "#d3_tree_container"), 50);
                const newFc = document.getElementById('folder_tree_container');
                if (newFc) newFc.innerHTML = renderTreeTextual(arbolParaMostrar);
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
            const rawOutput = (res && typeof res.output === 'string') ? res.output : (typeof res === 'string' ? res : '');
            if (res && res.annotated_tree) {
                window.lastAnnotatedTree = res.annotated_tree;
            }

            const lineas = rawOutput.split('\n').filter(l => l.trim());
            const errores = lineas.filter(l => l.startsWith('Error Semántico') || l.includes('Error'));
            const info = lineas.filter(l => !l.startsWith('Error Semántico') && !l.includes('Error'));

            let html = `
                <div class="panel-header-sticky" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size: 11px; color: var(--text-muted);">${info.length} resultado(s) de análisis</div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-reload" onclick="verArbolAnotadoDesdeSemantico()" title="Ver Árbol Anotado en el visualizador gráfico" style="padding: 3px 8px; display:flex; align-items:center; gap:3px; background: rgba(59, 130, 246, 0.2); border-color: var(--accent-primary);"><i data-lucide="git-branch" style="width:14px; height:14px; color:var(--accent-primary);"></i> Ver Árbol Anotado</button>
                        <button class="btn-reload" onclick="compilarFase('semantico')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                    </div>
                </div>
                <div class="semantic-output">
            `;

            if (info.length === 0) {
                html += '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px;"></i> Análisis semántico completado sin errores.</div>';
            }

            info.forEach(l => {
                const matchLn = l.match(/Línea\s+(\d+)/i);
                const ln = matchLn ? matchLn[1] : null;
                const clickAttr = ln ? `onclick="irALinea(${ln})" style="cursor:pointer;"` : '';

                if (l.includes('Tabla de Símbolos') || l.includes('===') || l.includes('---')) {
                    html += `<div class="semantic-section-title">${l}</div>`;
                } else {
                    html += `<div class="semantic-info-line" ${clickAttr}>${l}</div>`;
                }
            });

            html += '</div>';
            if (panelActivo) panelActivo.innerHTML = html;

            const panelErrores = document.getElementById('panel_err_sem');
            if (panelErrores) {
                if (errores.length > 0) {
                    panelErrores.innerHTML = errores.map(l => {
                        const m = l.match(/Línea\s+(\d+)/i);
                        const ln = m ? m[1] : 1;
                        return `<div class="interactive-log-line error-log" onclick="irALinea(${ln})">${l}</div>`;
                    }).join('');
                } else {
                    panelErrores.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px;"></i> Análisis semántico completado sin inconsistencias.</div>';
                }
            }
        } else if (fase === 'simbolos') {
            const data = res;
            let html = `
                <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">Variables e identificadores detectados</div>
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
            if (panelActivo) panelActivo.innerHTML = html;
        } else if (fase === 'intermedio') {
            window.lastIntermedioRaw = res;
            const lineas = res.split('\n');
            let bloquesHTML = '';
            let bloqueActual = null;
            let totalInstrucciones = 0;

            const formatInstruction = (inst) => {
                const tokenRegex = /(ret|READ|WRITE)\b|(t\d+)\b|([0-9]+(?:\.[0-9]+)?)\b|([\$a-zA-Z_][a-zA-Z0-9_]*)|([=+\-*\/^%])|(\S+)/g;
                return inst.replace(tokenRegex, (match, kw, temp, num, id, op, other) => {
                    if (kw) return `<span class="tac-keyword">${kw}</span>`;
                    if (temp) return `<span class="tac-temp">${temp}</span>`;
                    if (num) return `<span class="tac-val">${num}</span>`;
                    if (id) return `<span class="tac-var">${id}</span>`;
                    if (op) return `<span class="tac-op">${op}</span>`;
                    const safe = (other || match).replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return safe;
                });
            };

            const renderTacBlock = (bloque) => {
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

            let html = `
                <div class="tac-container">
                    <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: var(--text-muted);">Código de 3 direcciones</div>
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
            if (panelActivo) panelActivo.innerHTML = html;
        } else if (panelActivo) {
            const lineas = res.split('\n');
            let html = `
                <div class="panel-header-sticky">
                    <div style="font-size: 11px; color: var(--text-muted);">${lineas.length} línea(s) de salida</div>
                    <button class="btn-reload" onclick="compilarFase('${fase}')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                </div>
                <div class="execution-output">
            `;
            lineas.forEach((l, i) => {
                const safe = l.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (l.includes('Error') || l.includes('error')) {
                    html += `<div class="exec-line exec-error"><span class="exec-line-num">${i + 1}</span>${safe}</div>`;
                } else if (l.trim() === '') {
                    html += `<div class="exec-line"><span class="exec-line-num">${i + 1}</span>&nbsp;</div>`;
                } else {
                    html += `<div class="exec-line"><span class="exec-line-num">${i + 1}</span>${safe}</div>`;
                }
            });
            html += '</div>';
            panelActivo.innerHTML = html;
        }

        if (fase === 'ejecucion' || fase === 'sintactico') {
            playNotificationSound();
        }

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
    } catch (e) {
        console.error("Error en compilación:", e);
        if (panelActivo) panelActivo.innerHTML = `<div class="panel-header-sticky"><div style="font-size: 11px; color: #ff6b6b;">Error en compilación</div></div><div class="interactive-log-line error-log" style="margin-top:8px;">${e.message}</div>`;
    }
}

function showRightPanel(e, id) {
    document.querySelectorAll('.right-content').forEach(el => el.classList.add('oculto'));
    document.querySelectorAll('.right-panels .tab').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById('panel_' + id);
    if (panel) panel.classList.remove('oculto');
    e.target.classList.add('active');
    compilarFase(id);
}

function toggleAmpliarSintactico(btn) {
    const panels = document.getElementById('right_panels');
    if (!panels) return;

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
        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.overflow = '';
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
        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.overflow = 'hidden';
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
        if (hint) hint.textContent = 'Carpetas anidadas (Haz clic para colapsar o ir a línea)';
        window.vistaSintacticaActiva = 'carpetas';
    } else {
        d3Cont.style.display = 'block';
        fCont.style.display = 'none';
        if (hint) hint.textContent = 'Arrastra para mover • Rueda para Zoom • Clic para colapsar';
        window.vistaSintacticaActiva = 'grafico';
    }
}

window.modoArbolAnotado = false;
window.lastAnnotatedTree = null;

async function toggleModoArbolAnotado() {
    window.modoArbolAnotado = !window.modoArbolAnotado;
    const btn = document.getElementById('btn_toggle_anotado');
    const lbl = document.getElementById('lbl_arbol_anotado');
    if (window.modoArbolAnotado) {
        const codigoFuente = DOM.editor ? DOM.editor.value : '';
        const resSem = await CompilerEngine.compilar('semantico', codigoFuente);
        if (resSem && resSem.annotated_tree) {
            window.lastAnnotatedTree = resSem.annotated_tree;
        }
        if (lbl) lbl.textContent = 'Árbol Normal';
        if (btn) btn.style.background = 'rgba(16, 185, 129, 0.25)';
        mostrarNotificacion('<i data-lucide="tag" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Mostrando Árbol Anotado Semántico');
    } else {
        if (lbl) lbl.textContent = 'Árbol Anotado';
        if (btn) btn.style.background = 'rgba(59, 130, 246, 0.2)';
        mostrarNotificacion('Mostrando Árbol Sintáctico Estándar');
    }
    compilarFase('sintactico');
}

async function verArbolAnotadoDesdeSemantico() {
    window.modoArbolAnotado = true;
    const codigoFuente = DOM.editor ? DOM.editor.value : '';
    const resSem = await CompilerEngine.compilar('semantico', codigoFuente);
    if (resSem && resSem.annotated_tree) {
        window.lastAnnotatedTree = resSem.annotated_tree;
    }
    const tabSintactico = document.querySelector('.right-panels .tab[onclick*="sintactico"]');
    if (tabSintactico) {
        showRightPanel({ target: tabSintactico }, 'sintactico');
    } else {
        compilarFase('sintactico');
    }
    mostrarNotificacion('<i data-lucide="tag" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Visualizando Árbol Anotado');
}

function exportarSintactico() {
    const arbolExportar = (window.modoArbolAnotado && window.lastAnnotatedTree) 
        ? window.lastAnnotatedTree 
        : (window.lastSintacticoData && window.lastSintacticoData.tree);

    if (!arbolExportar) {
        mostrarNotificacion("No hay árbol para exportar", true);
        return;
    }
    const dataStr = JSON.stringify(arbolExportar, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = window.modoArbolAnotado ? "arbol_anotado_semantico.json" : "arbol_sintactico.json";
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
    const panel = document.getElementById('panel_' + id);
    if (panel) panel.classList.remove('oculto');
    e.target.classList.add('active');

    if (id === 'err_lex') compilarFase('lexico');
    else if (id === 'err_sin') compilarFase('sintactico');
    else if (id === 'err_sem') compilarFase('semantico');
}

// ==========================================================================
// GESTIÓN DE ARCHIVOS Y WORKSPACE
// ==========================================================================
async function nuevoArchivo() {
    const rutaBase = DOM.workspacePath?.value.trim() || '/';
    let error = '';
    let defName = 'codigo.' + currentExt;
    while (true) {
        const msg = (error ? `<div style="color:#ff6666; margin-bottom:8px; font-size:13px;">⚠ ${error}</div>` : '') + `Nombre del archivo en <b>${rutaBase}</b>:`;
        if (error) {
            setTimeout(() => {
                const modal = document.querySelector('#ide_modal_overlay > div');
                if (modal) {
                    modal.style.animation = 'modal-shake 0.45s ease';
                    modal.addEventListener('animationend', () => modal.style.animation = '', { once: true });
                }
            }, 30);
        }
        const nombre = await Modals.prompt("Nuevo Archivo", msg, defName);
        if (!nombre) return;
        defName = nombre;
        const path = (rutaBase === '/' ? '/' + nombre : rutaBase + '/' + nombre).replace(/\/+/g, '/');
        if (typeof VirtualFS !== 'undefined' && VirtualFS.cargarArchivo(path).success) {
            error = `El archivo <b>${nombre}</b> ya existe.`;
            continue;
        }
        if (typeof VirtualFS !== 'undefined') {
            VirtualFS.guardarArchivo(path, '');
        }
        TabManager.open(path, nombre, '');
        cargarExplorador(rutaBase);
        return;
    }
}

async function cerrarArchivo() {
    if (activeTabPath) {
        TabManager.close(activeTabPath);
    }
}

async function guardarArchivoEnWorkspace(nombreArchivo, esGuardarComo = false) {
    if (typeof VirtualFS === 'undefined') return;
    const ruta = currentOpenedFileAbsPath || ('/' + nombreArchivo);
    const contenido = DOM.editor ? DOM.editor.value : '';
    const res = await VirtualFS.guardarArchivoFisico(ruta, contenido);

    let icon = '<i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i>';
    let text = res.savedToDisk ? 'Guardado en disco' : 'Guardado en Workspace';
    if (esGuardarComo && !res.savedToDisk) text = 'Guardado en Workspace';

    mostrarNotificacion(`${icon} ${text}`);
    cargarExplorador();
}

async function guardarArchivo() {
    TabManager.syncActive();
    const name = DOM.currentFilename ? DOM.currentFilename.value : '';
    (name === 'Sin título' || !name) ? guardarComoArchivo() : guardarArchivoEnWorkspace(name, false);
}

async function guardarComoArchivo() {
    TabManager.syncActive();
    const nombreActual = (DOM.currentFilename ? DOM.currentFilename.value.replace(/^\//, '') : '') || 'archivo.txt';
    const contenido = DOM.editor ? DOM.editor.value : '';

    if (typeof VirtualFS !== 'undefined' && 'showSaveFilePicker' in window) {
        const res = await VirtualFS.descargarArchivoLocal(nombreActual, contenido);
        if (res && res.success && res.isNative) {
            setFilename(res.handleName);
            currentOpenedFileAbsPath = res.ruta;
            await guardarArchivoEnWorkspace(res.handleName, true);
            mostrarNotificacion('<i data-lucide="download" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Descargado');
        }
        return;
    }

    let nombre = await Modals.prompt("Descargar", "Nombre del archivo:", nombreActual);
    if (!nombre) return;
    setFilename(nombre);
    currentOpenedFileAbsPath = '/' + nombre;
    await guardarArchivoEnWorkspace(nombre, true);
    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.descargarArchivoLocal(nombre, contenido);
    }
}

async function abrirArchivo() {
    if (typeof VirtualFS !== 'undefined') {
        const res = await VirtualFS.abrirArchivoDesdeDisco();
        if (res && res.success) {
            TabManager.open(res.ruta, res.nombre, res.contenido);
            cargarExplorador();
            mostrarNotificacion('<i data-lucide="upload" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Archivo importado');
        }
    }
}

async function borrarArchivo(event, rutaAbsoluta, nombre) {
    if (event) event.stopPropagation();
    if (!await Modals.confirm('Eliminar Archivo', `¿Eliminar <b>${nombre}</b> del Workspace?<br><br>No se puede deshacer.`, 'Eliminar', 'Cancelar')) return;

    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.borrarArchivo(rutaAbsoluta);
        mostrarNotificacion('<i data-lucide="trash" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Archivo eliminado');

        const tabIdx = openTabs.findIndex(t => t.path === rutaAbsoluta);
        if (tabIdx !== -1) {
            openTabs.splice(tabIdx, 1);
            if (activeTabPath === rutaAbsoluta) {
                if (openTabs.length > 0) {
                    const newIdx = Math.min(tabIdx, openTabs.length - 1);
                    TabManager.activate(openTabs[newIdx].path);
                } else {
                    activeTabPath = null;
                    currentOpenedFileAbsPath = '';
                    if (DOM.editor) DOM.editor.value = '';
                    setFilename('Sin título');
                    limpiarPaneles();
                    procesarCambiosPesados();
                    TabManager.render();
                }
            } else {
                TabManager.render();
            }
        }
        cargarExplorador();
    }
}

async function nuevaCarpeta() {
    const rutaBase = DOM.workspacePath?.value.trim() || '/';
    const nombre = await Modals.prompt("Nueva Carpeta", `Crear subcarpeta en <b>${rutaBase}</b>:`, "mi_carpeta");
    if (!nombre) return;

    const rutaFinal = (rutaBase === '/' ? '/' + nombre : rutaBase + '/' + nombre).replace(/\/+/g, '/');
    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.crearCarpeta(rutaFinal);
        mostrarNotificacion('<i data-lucide="folder-plus" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Carpeta creada');
        cargarExplorador(rutaBase);
    }
}

async function abrirCarpeta() {
    if (typeof VirtualFS !== 'undefined') {
        const res = await VirtualFS.abrirDirectorioDesdeDisco();
        if (res && res.success) {
            cargarExplorador('/' + (res.dirName || ''));
            mostrarNotificacion(`<i data-lucide="folder-check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Carpeta '${res.dirName}' cargada (${res.count} archivos)`);
        }
    }
}

async function borrarCarpeta(event, rutaAbsoluta, nombre) {
    if (event) event.stopPropagation();
    if (!await Modals.confirm('Eliminar Carpeta', `¿Eliminar carpeta <b>${nombre}</b> y todo su contenido?<br><br>No se puede deshacer.`, 'Eliminar', 'Cancelar')) return;

    if (typeof VirtualFS !== 'undefined') {
        VirtualFS.borrarDirectorio(rutaAbsoluta);
        mostrarNotificacion('<i data-lucide="trash" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Carpeta eliminada');

        // Cerrar tabs que pertenecían a esa carpeta
        const prefijo = rutaAbsoluta.endsWith('/') ? rutaAbsoluta : rutaAbsoluta + '/';
        const indicesParaCerrar = [];
        openTabs.forEach((t, i) => {
            if (t.path === rutaAbsoluta || t.path.startsWith(prefijo)) {
                indicesParaCerrar.push(t.path);
            }
        });
        indicesParaCerrar.forEach(p => TabManager.close(p));

        const rutaBase = DOM.workspacePath?.value.trim() || '/';
        cargarExplorador(rutaBase);
    }
}

// ==========================================================================
// UTILS
// ==========================================================================
function mostrarNotificacion(msg, esError = false) {
    const el = document.getElementById('status_msg');
    if (!el) return;
    el.innerHTML = (esError ? '<i data-lucide="alert-circle" style="width:14px; height:14px; vertical-align:-2px;"></i> ' : '') + msg + ' - ' + new Date().toLocaleTimeString();
    el.style.color = esError ? '#ffaaaa' : 'rgba(255, 255, 255, 0.9)';
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => { el.style.color = "#fff"; el.textContent = "⚡ Motor WebAssembly Activo"; }, 3000);
}

function verLogErrores() {
    const logInfo = `Estado: Activo\n` +
        `Núcleo: WebAssembly (Rust) & Motor de Ejecución\n` +
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
        window.close();

        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background-color:var(--bg-primary, #1e1e1e); color:var(--text-primary, #ffffff); font-family:sans-serif;">
                <h1 style="font-size: 40px; margin-bottom: 10px;">IDE Cerrado</h1>
                <p style="font-size: 18px; opacity: 0.7;">El entorno ha finalizado. Ya puedes cerrar esta pestaña con seguridad.</p>
            </div>
        `;
    }
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';

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
    initDOM();
    const theme = localStorage.getItem('ide_theme');
    if (theme === 'light') document.body.classList.add('light-theme');
    else if (theme === 'rgb') document.body.classList.add('rgb-theme');

    DOM.activeLineIndicator = document.createElement('div');
    DOM.activeLineIndicator.id = 'active_line_indicator';
    const codeArea = document.querySelector('.code-area');
    if (codeArea) codeArea.prepend(DOM.activeLineIndicator);

    DOM.lineNumbers?.addEventListener('mousedown', (e) => {
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

    if (typeof VirtualFS !== 'undefined') {
        const initFile = VirtualFS.cargarArchivo('/testLexico.txt');
        if (initFile.success) {
            TabManager.open('/testLexico.txt', 'testLexico.txt', initFile.contenido);
        } else {
            TabManager.render();
        }
    } else {
        TabManager.render();
    }

    cargarExplorador();
    compilarFase('sintactico');
    if (window.lucide) lucide.createIcons();
});

// Exposición global para que los onclick de HTML siempre los encuentren
window.nuevoArchivo = nuevoArchivo;
window.nuevaCarpeta = nuevaCarpeta;
window.abrirCarpeta = abrirCarpeta;
window.borrarCarpeta = borrarCarpeta;
window.abrirArchivo = abrirArchivo;
window.guardarArchivo = guardarArchivo;
window.guardarComoArchivo = guardarComoArchivo;
window.cerrarArchivo = cerrarArchivo;
window.borrarArchivo = borrarArchivo;
window.cargarExplorador = cargarExplorador;
window.subirDirectorio = subirDirectorio;
window.abrirDesdeExplorador = abrirDesdeExplorador;
window.toggleExplorer = toggleExplorer;
window.toggleRightPanel = toggleRightPanel;
window.toggleBottomPanel = toggleBottomPanel;
window.toggleTheme = toggleTheme;
window.toggleRGB = toggleRGB;
window.abrirAutomata = abrirAutomata;
window.verLogErrores = verLogErrores;
window.salirIDE = salirIDE;
window.compilarFase = compilarFase;
window.toggleModoArbolAnotado = toggleModoArbolAnotado;
window.verArbolAnotadoDesdeSemantico = verArbolAnotadoDesdeSemantico;
window.TabManager = TabManager;
window.Modals = Modals;

// ==========================================================================
// D3.js TREE VISUALIZATION
// ==========================================================================
function drawD3Tree(treeData, containerId) {
    const container = document.querySelector(containerId);
    if (!container || typeof d3 === 'undefined') return;

    container.innerHTML = '';

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

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
            .attr('width', function (d) {
                const textNode = this.parentNode.querySelector('text');
                const textWidth = textNode ? textNode.getBBox().width : 80;
                return textWidth + 20;
            })
            .attr('x', function (d) {
                const textNode = this.parentNode.querySelector('text');
                const textWidth = textNode ? textNode.getBBox().width : 80;
                return -(textWidth + 20) / 2;
            })
            .style("fill", d => {
                if (d._children) return "var(--bg-secondary)";
                const name = (d.data && d.data.name) || '';
                if (name.includes('[tipo: int]')) return "rgba(59, 130, 246, 0.15)";
                if (name.includes('[tipo: float]')) return "rgba(16, 185, 129, 0.15)";
                if (name.includes('[tipo: bool]')) return "rgba(245, 158, 11, 0.15)";
                if (name.includes('[asigna a:')) return "rgba(139, 92, 246, 0.15)";
                if (name.includes('[tipo base]')) return "rgba(6, 182, 212, 0.15)";
                if (name.includes('[no declarada!]')) return "rgba(239, 68, 68, 0.2)";
                return "var(--bg-tertiary)";
            })
            .style("stroke", d => {
                if (d._children) return "var(--text-primary)";
                const name = (d.data && d.data.name) || '';
                if (name.includes('[tipo: int]')) return "#3b82f6";
                if (name.includes('[tipo: float]')) return "#10b981";
                if (name.includes('[tipo: bool]')) return "#f59e0b";
                if (name.includes('[asigna a:')) return "#8b5cf6";
                if (name.includes('[tipo base]')) return "#06b6d4";
                if (name.includes('[no declarada!]')) return "#ef4444";
                return "var(--accent-primary)";
            });

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
                const o = { x: source.x0, y: source.y0 };
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);
        linkUpdate.transition().duration(500)
            .attr('d', d => diagonal(d, d.parent));

        const linkExit = link.exit().transition().duration(500)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
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
