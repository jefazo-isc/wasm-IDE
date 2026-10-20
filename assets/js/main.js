// ==========================================================================
// IDE INDÓMITO - ORQUESTADOR PRINCIPAL Y GESTIÓN DE LAYOUT
// ==========================================================================

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
window.DOM = DOM;

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

// ==========================================================================
// RESIZERS DE PANELES
// ==========================================================================
let isResizing = { v: false, exp: false, h: false };
let animFrame = null;

const enableResize = (type, cursor) => {
    isResizing[type] = true;
    document.body.style.cursor = cursor;
    if (DOM.editor) DOM.editor.style.pointerEvents = 'none';
};

window.addEventListener('mousemove', (e) => {
    if (!isResizing.v && !isResizing.exp && !isResizing.h) return;
    if (animFrame) cancelAnimationFrame(animFrame);

    animFrame = requestAnimationFrame(() => {
        if (isResizing.v && DOM.rightPanels) {
            const w = document.body.clientWidth - e.clientX;
            if (w > 180 && w < document.body.clientWidth * 0.7) {
                DOM.rightPanels.style.width = `${w}px`;
            }
        }
        if (isResizing.exp && DOM.fileExplorer) {
            const w = e.clientX;
            if (w > 140 && w < document.body.clientWidth * 0.4) {
                DOM.fileExplorer.style.width = `${w}px`;
            }
        }
        if (isResizing.h && DOM.bottomPanels && DOM.topLayout) {
            const h = document.body.clientHeight - e.clientY - 22; // barra de estado
            if (h > 60 && h < document.body.clientHeight * 0.6) {
                DOM.bottomPanels.style.height = `${h}px`;
            }
        }
    });
});

window.addEventListener('mouseup', () => {
    if (animFrame) cancelAnimationFrame(animFrame);
    isResizing.v = isResizing.exp = isResizing.h = false;
    document.body.style.cursor = 'default';
    if (DOM.editor) DOM.editor.style.pointerEvents = 'auto';
});
window.addEventListener('resize', () => {
    if (typeof synchronizeScrollbarOffset === 'function') synchronizeScrollbarOffset();
});

// ==========================================================================
// CONTROL DE VISIBILIDAD DE PANELES
// ==========================================================================
const togglePanel = (el, resizer) => {
    el?.classList.toggle('panel-hidden');
    resizer?.classList.toggle('panel-hidden');
};
function toggleExplorer() { togglePanel(DOM.fileExplorer, DOM.resizerExp); }
function toggleRightPanel() { togglePanel(DOM.rightPanels, DOM.resizerV); }
function toggleBottomPanel() { togglePanel(DOM.bottomPanels, DOM.resizerH); }

// ==========================================================================
// ATAJOS DE TECLADO GLOBALES
// ==========================================================================
document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (typeof guardarArchivo === 'function') guardarArchivo();
    } else if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        if (typeof Modals !== 'undefined') {
            if (await Modals.confirm("Recargar IDE", "¿Deseas recargar la aplicación? Cualquier cambio no guardado en el archivo actual se perderá.")) {
                window.location.reload();
            }
        } else {
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

// ==========================================================================
// INICIALIZACIÓN DEL SISTEMA (BOOTSTRAP)
// ==========================================================================
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
        if (typeof seleccionarLinea === 'function') seleccionarLinea(clickedLine);
    });

    document.addEventListener('selectionchange', () => {
        if (document.activeElement === DOM.editor) {
            if (typeof actualizarCursorRápido === 'function') actualizarCursorRápido();
        }
    });

    if (typeof VirtualFS !== 'undefined') {
        const initFile = VirtualFS.cargarArchivo('/testLexico.txt');
        if (initFile.success && typeof TabManager !== 'undefined') {
            TabManager.open('/testLexico.txt', 'testLexico.txt', initFile.contenido);
        } else if (typeof TabManager !== 'undefined') {
            TabManager.render();
        }
    } else if (typeof TabManager !== 'undefined') {
        TabManager.render();
    }

    if (typeof cargarExplorador === 'function') cargarExplorador();
    if (typeof compilarFase === 'function') compilarFase('sintactico');
    if (window.lucide) lucide.createIcons();
});

// Exposición global para que los onclick de HTML siempre los encuentren
window.initDOM = initDOM;
window.toggleExplorer = toggleExplorer;
window.toggleRightPanel = toggleRightPanel;
window.toggleBottomPanel = toggleBottomPanel;
