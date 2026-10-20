// ==========================================================================
// IDE INDÓMITO - MOTOR DEL EDITOR, RESALTADO Y CURSOR
// ==========================================================================

let currentLineCount = 0;
let scrollAnimFrame = null;
let highlightTimeout = null;

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
    const dom = window.DOM || {};
    if (dom.currentFilename) dom.currentFilename.value = filename;
    if (dom.fileIndicator) dom.fileIndicator.textContent = 'Archivo: ' + filename;
    setExtension(filename);
}

function setExtension(filename) {
    window.currentExt = filename.includes('.') ? filename.split('.').pop().toLowerCase() : 'txt';
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
    const dom = window.DOM || {};
    if (!dom.editor) return;
    const pos = dom.editor.selectionStart;
    const val = dom.editor.value;
    let currentLine = 1;
    for (let i = 0; i < pos; i++) {
        if (val[i] === '\n') currentLine++;
    }
    const lineHeight = 21; // 14px * 1.5
    if (dom.activeLineIndicator) {
        const topPos = 10 + (currentLine - 1) * lineHeight - dom.editor.scrollTop;
        dom.activeLineIndicator.style.top = `${topPos}px`;
    }

    // Sincronizar resalte en las carpetas/nodos del árbol que corresponden a esta línea
    document.querySelectorAll('.ast-tree .node-active-line').forEach(el => {
        el.classList.remove('node-active-line');
    });
    const nodosEnLinea = document.querySelectorAll(`.ast-tree [data-linea="${currentLine}"]`);
    nodosEnLinea.forEach(el => {
        el.classList.add('node-active-line');
    });
}

function seleccionarLinea(linea) {
    const dom = window.DOM || {};
    if (!dom.editor) return;
    const val = dom.editor.value;
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

    dom.editor.focus();
    dom.editor.setSelectionRange(posInicio, posFin);
    actualizarCursorRápido();
}

function syncScroll() {
    const dom = window.DOM || {};
    if (!dom.editor) return;
    if (scrollAnimFrame) cancelAnimationFrame(scrollAnimFrame);
    scrollAnimFrame = requestAnimationFrame(() => {
        if (!dom.editor) return;
        if (dom.highlighting) {
            dom.highlighting.scrollTop = dom.editor.scrollTop;
            dom.highlighting.scrollLeft = dom.editor.scrollLeft;
        }
        if (dom.lineNumbers) {
            dom.lineNumbers.scrollTop = dom.editor.scrollTop;
        }
        updateActiveLine();
        highlightMatchingBrackets();
    });
}

function handleInput(limpiarErrores = true) {
    if (limpiarErrores) window.sintacticoErrores = [];
    actualizarContadorLineas();
    actualizarCursorRápido();

    const dom = window.DOM || {};
    if (!dom.editor || !dom.highlighting) return;
    const text = dom.editor.value;
    if (text.length > 5000) {
        dom.highlighting.textContent = text + '\n';
        clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(() => {
            if (dom.highlighting && dom.editor) {
                dom.highlighting.innerHTML = applySyntaxHighlighting(dom.editor.value) + '\n';
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
        dom.highlighting.innerHTML = applySyntaxHighlighting(text) + '\n' + errorHtml;
    }

    syncScroll();

    // Recompilar en tiempo real para mantener los árboles y análisis siempre actualizados
    if (typeof autoCompilarEnTiempoReal === 'function') {
        autoCompilarEnTiempoReal();
    }
}

function actualizarSubrayadoErrores() {
    const dom = window.DOM || {};
    if (!dom.editor || !dom.highlighting) return;
    const text = dom.editor.value;
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
    dom.highlighting.innerHTML = applySyntaxHighlighting(text) + '\n' + errorHtml;
}

function actualizarContadorLineas() {
    const dom = window.DOM || {};
    if (!dom.editor || !dom.lineNumbers) return;
    const val = dom.editor.value;
    let lines = 1;
    for (let i = 0; i < val.length; i++) {
        if (val[i] === '\n') lines++;
    }

    if (lines !== currentLineCount) {
        currentLineCount = lines;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += `<span data-line="${i}">${i}</span>\n`;
        }
        dom.lineNumbers.innerHTML = html;
        synchronizeScrollbarOffset();
    }
}

function procesarCambiosPesados() {
    currentLineCount = -1;
    handleInput();
}

function actualizarCursorRápido() {
    const dom = window.DOM || {};
    if (!dom.editor || !dom.cursorPos) return;
    const pos = getLineAndCol(dom.editor.value, dom.editor.selectionStart);
    requestAnimationFrame(() => {
        if (dom.cursorPos) dom.cursorPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;
        updateActiveLine();
        highlightMatchingBrackets();
    });
}

function highlightMatchingBrackets() {
    const dom = window.DOM || {};
    if (!dom.bracketMatches || !dom.editor) return;
    const rawText = dom.editor.value;
    const pos = dom.editor.selectionStart;
    dom.bracketMatches.innerHTML = '';

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
            const topPos = 10 + (loc.line - 1) * 21 - dom.editor.scrollTop;
            const leftPos = 10 - dom.editor.scrollLeft;
            return `<div style="position: absolute; top: ${topPos}px; left: ${leftPos}px; pointer-events: none; white-space: pre; tab-size: 4;"><span style="color: transparent; pointer-events: none;">${escaped}</span><span class="syntax-bracket-match">${bracketEscaped}</span></div>`;
        };
        dom.bracketMatches.innerHTML = buildSpan(activePos) + buildSpan(matchPos);
    }
}

function synchronizeScrollbarOffset() {
    const dom = window.DOM || {};
    if (dom.lineNumbers && dom.editor) {
        dom.lineNumbers.style.paddingBottom = `${10 + dom.editor.offsetHeight - dom.editor.clientHeight}px`;
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
    if (typeof resetearUltimoCodigoCompilado === 'function') {
        resetearUltimoCodigoCompilado();
    }
}

function irALinea(linea) {
    const dom = window.DOM || {};
    if (!dom.editor) return;
    const val = dom.editor.value;
    let currentLine = 1;
    let pos = 0;
    for (let i = 0; i < val.length; i++) {
        if (currentLine === linea) break;
        if (val[i] === '\n') {
            currentLine++;
            pos = i + 1;
        }
    }

    dom.editor.focus();
    dom.editor.setSelectionRange(pos, pos);
    dom.editor.scrollTop = (linea - 1) * 21 - (dom.editor.clientHeight / 2) + 30;

    if (dom.editorContainer) {
        const prevShadow = dom.editorContainer.style.boxShadow;
        dom.editorContainer.style.boxShadow = "inset 0 0 15px var(--accent-primary)";
        setTimeout(() => dom.editorContainer.style.boxShadow = prevShadow, 300);
    }
}

// Resaltado de líneas en el gutter desde la tabla de símbolos
function resaltarLineasGutter(lineas) {
    limpiarResaltadoGutter();
    const dom = window.DOM || {};
    if (!dom.lineNumbers) return;
    lineas.forEach(l => {
        const span = dom.lineNumbers.querySelector(`span[data-line="${l}"]`);
        if (span) span.classList.add('line-highlight');
    });
}

function limpiarResaltadoGutter() {
    const dom = window.DOM || {};
    if (!dom.lineNumbers) return;
    dom.lineNumbers.querySelectorAll('.line-highlight').forEach(el => {
        el.classList.remove('line-highlight');
    });
}

// Exposición global
window.applySyntaxHighlighting = applySyntaxHighlighting;
window.setFilename = setFilename;
window.setExtension = setExtension;
window.getLineAndCol = getLineAndCol;
window.updateActiveLine = updateActiveLine;
window.seleccionarLinea = seleccionarLinea;
window.syncScroll = syncScroll;
window.handleInput = handleInput;
window.actualizarSubrayadoErrores = actualizarSubrayadoErrores;
window.actualizarContadorLineas = actualizarContadorLineas;
window.procesarCambiosPesados = procesarCambiosPesados;
window.actualizarCursorRápido = actualizarCursorRápido;
window.highlightMatchingBrackets = highlightMatchingBrackets;
window.synchronizeScrollbarOffset = synchronizeScrollbarOffset;
window.limpiarPaneles = limpiarPaneles;
window.irALinea = irALinea;
window.resaltarLineasGutter = resaltarLineasGutter;
window.limpiarResaltadoGutter = limpiarResaltadoGutter;

