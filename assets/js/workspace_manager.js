// ==========================================================================
// IDE INDÓMITO - GESTOR DE WORKSPACE, PESTAÑAS Y ARCHIVOS
// ==========================================================================

const openTabs = []; // { path, name, content, scrollTop, cursorPos }
let activeTabPath = null;
let currentOpenedFileAbsPath = '/testLexico.txt';
window.currentExt = 'txt';

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
        const dom = window.DOM || {};
        if (activeTabPath) {
            const current = openTabs.find(t => t.path === activeTabPath);
            if (current && dom.editor) {
                current.content = dom.editor.value;
                current.scrollTop = dom.editor.scrollTop;
                current.cursorPos = dom.editor.selectionStart;
            }
        }

        activeTabPath = path;
        const tab = openTabs.find(t => t.path === path);
        if (tab && dom.editor) {
            dom.editor.value = tab.content;
            currentOpenedFileAbsPath = tab.path;
            window.currentOpenedFileAbsPath = tab.path;
            if (typeof setFilename === 'function') setFilename(tab.name);
            if (typeof procesarCambiosPesados === 'function') procesarCambiosPesados();

            requestAnimationFrame(() => {
                if (dom.editor) {
                    dom.editor.scrollTop = tab.scrollTop;
                    dom.editor.setSelectionRange(tab.cursorPos, tab.cursorPos);
                    if (typeof actualizarCursorRápido === 'function') actualizarCursorRápido();
                }
            });
        }
        this.render();
    },

    /** Cierra una pestaña, con confirmación si tiene cambios */
    async close(path) {
        const dom = window.DOM || {};
        const idx = openTabs.findIndex(t => t.path === path);
        if (idx === -1) return;

        if (path === activeTabPath && dom.editor) {
            openTabs[idx].content = dom.editor.value;
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
                window.currentOpenedFileAbsPath = '';
                if (dom.editor) dom.editor.value = '';
                if (typeof setFilename === 'function') setFilename('Sin título');
                if (typeof limpiarPaneles === 'function') limpiarPaneles();
                if (typeof procesarCambiosPesados === 'function') procesarCambiosPesados();
                this.render();
            }
        } else {
            this.render();
        }
    },

    /** Actualiza el contenido guardado de la pestaña activa */
    syncActive() {
        const dom = window.DOM || {};
        if (!activeTabPath) return;
        const tab = openTabs.find(t => t.path === activeTabPath);
        if (tab && dom.editor) {
            tab.content = dom.editor.value;
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
// EXPLORADOR DE ARCHIVOS
// ==========================================================================
function cargarExplorador(rutaSolicitada = null) {
    const dom = window.DOM || {};
    const ruta = rutaSolicitada ?? dom.workspacePath?.value.trim() ?? '/';

    if (typeof VirtualFS === 'undefined') return;
    const res = VirtualFS.listarDirectorio(ruta);

    if (res.success) {
        if (dom.workspacePath) dom.workspacePath.value = res.ruta_actual;
        if (dom.explorerContent) {
            dom.explorerContent.innerHTML = res.elementos.length ? res.elementos.map(el => {
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
    const dom = window.DOM || {};
    const rutaActual = dom.workspacePath?.value.trim() || '/';
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

// ==========================================================================
// OPERACIONES DE ARCHIVOS
// ==========================================================================
async function nuevoArchivo() {
    const dom = window.DOM || {};
    const rutaBase = dom.workspacePath?.value.trim() || '/';
    let error = '';
    let defName = 'codigo.' + (window.currentExt || 'txt');
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
    const dom = window.DOM || {};
    const ruta = currentOpenedFileAbsPath || ('/' + nombreArchivo);
    const contenido = dom.editor ? dom.editor.value : '';
    const res = await VirtualFS.guardarArchivoFisico(ruta, contenido);

    let icon = '<i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i>';
    let text = res.savedToDisk ? 'Guardado en disco' : 'Guardado en Workspace';
    if (esGuardarComo && !res.savedToDisk) text = 'Guardado en Workspace';

    mostrarNotificacion(`${icon} ${text}`);
    cargarExplorador();
}

async function guardarArchivo() {
    const dom = window.DOM || {};
    TabManager.syncActive();
    const name = dom.currentFilename ? dom.currentFilename.value : '';
    (name === 'Sin título' || !name) ? guardarComoArchivo() : guardarArchivoEnWorkspace(name, false);
}

async function guardarComoArchivo() {
    const dom = window.DOM || {};
    TabManager.syncActive();
    const nombreActual = (dom.currentFilename ? dom.currentFilename.value.replace(/^\//, '') : '') || 'archivo.txt';
    const contenido = dom.editor ? dom.editor.value : '';

    if (typeof VirtualFS !== 'undefined' && 'showSaveFilePicker' in window) {
        const res = await VirtualFS.descargarArchivoLocal(nombreActual, contenido);
        if (res && res.success && res.isNative) {
            if (typeof setFilename === 'function') setFilename(res.handleName);
            currentOpenedFileAbsPath = res.ruta;
            window.currentOpenedFileAbsPath = res.ruta;
            await guardarArchivoEnWorkspace(res.handleName, true);
            mostrarNotificacion('<i data-lucide="download" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Descargado');
        }
        return;
    }

    let nombre = await Modals.prompt("Descargar", "Nombre del archivo:", nombreActual);
    if (!nombre) return;
    if (typeof setFilename === 'function') setFilename(nombre);
    currentOpenedFileAbsPath = '/' + nombre;
    window.currentOpenedFileAbsPath = '/' + nombre;
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
                    const dom = window.DOM || {};
                    activeTabPath = null;
                    currentOpenedFileAbsPath = '';
                    window.currentOpenedFileAbsPath = '';
                    if (dom.editor) dom.editor.value = '';
                    if (typeof setFilename === 'function') setFilename('Sin título');
                    if (typeof limpiarPaneles === 'function') limpiarPaneles();
                    if (typeof procesarCambiosPesados === 'function') procesarCambiosPesados();
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
    const dom = window.DOM || {};
    const rutaBase = dom.workspacePath?.value.trim() || '/';
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
        openTabs.forEach((t) => {
            if (t.path === rutaAbsoluta || t.path.startsWith(prefijo)) {
                indicesParaCerrar.push(t.path);
            }
        });
        indicesParaCerrar.forEach(p => TabManager.close(p));

        const dom = window.DOM || {};
        const rutaBase = dom.workspacePath?.value.trim() || '/';
        cargarExplorador(rutaBase);
    }
}

// Exposición global
window.TabManager = TabManager;
window.cargarExplorador = cargarExplorador;
window.subirDirectorio = subirDirectorio;
window.abrirDesdeExplorador = abrirDesdeExplorador;
window.nuevoArchivo = nuevoArchivo;
window.cerrarArchivo = cerrarArchivo;
window.guardarArchivoEnWorkspace = guardarArchivoEnWorkspace;
window.guardarArchivo = guardarArchivo;
window.guardarComoArchivo = guardarComoArchivo;
window.abrirArchivo = abrirArchivo;
window.borrarArchivo = borrarArchivo;
window.nuevaCarpeta = nuevaCarpeta;
window.abrirCarpeta = abrirCarpeta;
window.borrarCarpeta = borrarCarpeta;
