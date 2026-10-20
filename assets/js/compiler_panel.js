// ==========================================================================
// IDE INDÓMITO - PANELES Y VISUALIZADORES DEL COMPILADOR
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

let autoCompileTimer = null;
let ultimoCodigoCompilado = { sintactico: null, semantico: null, lexico: null, simbolos: null, intermedio: null };

function resetearUltimoCodigoCompilado() {
    ultimoCodigoCompilado = { sintactico: null, semantico: null, lexico: null, simbolos: null, intermedio: null };
}

function autoCompilarEnTiempoReal() {
    clearTimeout(autoCompileTimer);
    autoCompileTimer = setTimeout(() => {
        // Encontrar qué pestaña de la derecha está activa
        const tabActiva = document.querySelector('.right-panels .tab.active');
        let faseActiva = 'sintactico';
        if (tabActiva) {
            const match = tabActiva.getAttribute('onclick') || '';
            const m = match.match(/showRightPanel\(event,\s*['"]([^'"]+)['"]\)/) || match.match(/compilarFase\(['"]([^'"]+)['"]\)/);
            if (m && m[1]) {
                faseActiva = m[1];
            }
        }
        if (faseActiva === 'ejecucion') return;
        compilarFase(faseActiva, true);
    }, 450);
}

function toggleExpandirArbol(containerId, btn) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const detailsList = cont.querySelectorAll('details');
    if (detailsList.length === 0) return;

    const estaExpandido = btn.dataset.expandido === "true";
    detailsList.forEach(d => {
        d.open = !estaExpandido;
    });

    if (estaExpandido) {
        btn.dataset.expandido = "false";
        btn.innerHTML = '<i data-lucide="chevrons-down" style="width:14px; height:14px;"></i> Expandir Todo';
    } else {
        btn.dataset.expandido = "true";
        btn.innerHTML = '<i data-lucide="chevrons-up" style="width:14px; height:14px;"></i> Colapsar Todo';
    }
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
}

/**
 * Actualiza el árbol AST aplicando una transición elegante si hubo nodos eliminados
 * o si la estructura se corrigió tras borrar o modificar líneas.
 */
function actualizarArbolConAnimacion(container, nuevoHTML, nuevoArbol) {
    if (!container) return;

    const arbolViejo = container.querySelector('.ast-tree');
    // Si no había árbol antes o si el nuevo contenido no es un árbol, actualizar directamente
    if (!arbolViejo || !nuevoHTML.includes('ast-tree')) {
        container.innerHTML = nuevoHTML;
        return;
    }

    // Extraer todas las líneas presentes en el nuevo árbol
    const nuevasLineas = new Set();
    function extraerLineas(n) {
        if (!n) return;
        if (n.linea) nuevasLineas.add(parseInt(n.linea, 10));
        if (n.children && n.children.length > 0) {
            n.children.forEach(extraerLineas);
        }
    }
    if (nuevoArbol) extraerLineas(nuevoArbol);

    // Buscar elementos en el árbol actual cuyas líneas ya no existan
    const nodosActuales = arbolViejo.querySelectorAll('[data-linea]');
    const nodosAEliminar = [];

    nodosActuales.forEach(el => {
        const l = parseInt(el.getAttribute('data-linea'), 10);
        if (l && !nuevasLineas.has(l)) {
            const li = el.closest('li');
            if (li && !nodosAEliminar.includes(li)) {
                nodosAEliminar.push(li);
            }
        }
    });

    // Guardar el estado de apertura de las carpetas que el usuario haya expandido o colapsado
    const estadoCarpetas = new Map();
    arbolViejo.querySelectorAll('details').forEach(d => {
        const sum = d.querySelector(':scope > summary');
        if (sum) {
            const key = (sum.getAttribute('data-linea') || '') + '::' + sum.textContent.trim();
            estadoCarpetas.set(key, d.open);
        }
    });

    const aplicarNuevoArbol = () => {
        container.innerHTML = nuevoHTML;
        const arbolNuevo = container.querySelector('.ast-tree');
        if (arbolNuevo) {
            arbolNuevo.classList.add('tree-correcting');
            // Restaurar estado de carpetas si existía previamente
            arbolNuevo.querySelectorAll('details').forEach(d => {
                const sum = d.querySelector(':scope > summary');
                if (sum) {
                    const key = (sum.getAttribute('data-linea') || '') + '::' + sum.textContent.trim();
                    if (estadoCarpetas.has(key)) {
                        d.open = estadoCarpetas.get(key);
                    }
                }
            });
        }
        if (typeof window.updateActiveLine === 'function') {
            window.updateActiveLine();
        }
    };

    if (nodosAEliminar.length > 0) {
        // Animar la salida sutil y elegante de los nodos eliminados
        nodosAEliminar.forEach(li => li.classList.add('node-deleting'));
        setTimeout(aplicarNuevoArbol, 320);
    } else {
        aplicarNuevoArbol();
    }
}

async function compilarFase(fase, esTiempoReal = false) {
    const editorEl = (window.DOM && window.DOM.editor) ? window.DOM.editor : document.getElementById('editor');
    const codigoFuente = editorEl ? editorEl.value : '';

    // Si es tiempo real y el código no cambió para esta fase, omitir render innecesario
    if (esTiempoReal && ultimoCodigoCompilado[fase] === codigoFuente) {
        return;
    }
    ultimoCodigoCompilado[fase] = codigoFuente;

    if (!esTiempoReal) {
        document.querySelectorAll('.right-content').forEach(el => el.classList.add('oculto'));
        document.querySelectorAll('.right-panels .tab').forEach(el => el.classList.remove('active'));
    }

    const panelActivo = document.getElementById('panel_' + fase);
    const tabActivo = document.querySelector(`.right-panels .tab[onclick*="${fase}"]`);

    if (panelActivo && !esTiempoReal) panelActivo.classList.remove('oculto');
    if (tabActivo && !esTiempoReal) tabActivo.classList.add('active');

    try {
        if (typeof CompilerEngine === 'undefined') {
            if (panelActivo) panelActivo.textContent = "Error: El motor del compilador no está cargado.";
            return;
        }

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

            function renderTreeTextual(node, esRaiz = true) {
                if (!node) return '';
                const clickEvent = node.linea ? `onclick="irALinea(${node.linea}); event.stopPropagation();"` : "";
                const dataLineaAttr = node.linea ? `data-linea="${node.linea}"` : "";
                
                if (!node.children || node.children.length === 0) {
                    return `<li ${clickEvent}><span class="leaf-node" ${dataLineaAttr}>📄 ${node.name}</span></li>`;
                }
                
                const atributoAbierto = esRaiz ? 'open' : '';
                let html = `<li>
                    <details ${atributoAbierto}>
                        <summary class="parent-node" ${clickEvent} ${dataLineaAttr}><span class="tree-arrow">▶</span><span class="folder-icon">📁</span> ${node.name}</summary>
                        <ul>`;
                node.children.forEach(child => {
                    html += renderTreeTextual(child, false);
                });
                html += `</ul></details></li>`;
                return html;
            }

            let folderContainer = document.getElementById('folder_tree_container');
            if (!folderContainer || !panelActivo.querySelector('#folder_tree_container')) {
                let html = `
                    <div class="panel-header-sticky" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: var(--text-muted);" id="sintactico_hint">Árbol Sintáctico (Carpetas anidadas - Clic para colapsar o ir a línea)</div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-reload" onclick="toggleExpandirArbol('folder_tree_container', this)" data-expandido="false" title="Expandir o Colapsar Todo" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="chevrons-down" style="width:14px; height:14px;"></i> Expandir Todo</button>
                            <button class="btn-reload" onclick="exportarSintactico()" title="Exportar JSON" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="download" style="width:14px; height:14px;"></i> Exportar</button>
                        </div>
                    </div>
                    <div id="folder_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: auto; padding: 15px; font-family: var(--font-mono); font-size: 14px; display: block;"></div>
                `;
                if (panelActivo) panelActivo.innerHTML = html;
                folderContainer = document.getElementById('folder_tree_container');
            }

            const arbolParaMostrar = data.tree;

            if (folderContainer) {
                if (arbolParaMostrar && arbolParaMostrar.children && arbolParaMostrar.children.length > 0) {
                    actualizarArbolConAnimacion(folderContainer, '<ul class="ast-tree">' + renderTreeTextual(arbolParaMostrar, true) + '</ul>', arbolParaMostrar);
                } else if (data.errores && data.errores.length > 0) {
                    folderContainer.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 15px; color: var(--text-muted); text-align: center; padding: 20px;">
                            <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ff6b6b;"></i>
                            <div style="font-size: 16px; font-weight: bold; color: var(--text-primary);">No se pudo generar el árbol sintáctico</div>
                            <div style="font-size: 12px; max-width: 400px;">El análisis encontró errores que impiden construir el árbol. Corrige los errores e intenta de nuevo.</div>
                            <div style="text-align: left; width: 100%; max-width: 500px; margin-top: 10px;">
                                ${data.errores.map(err => `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})" style="margin-bottom: 4px; padding: 6px 10px; border-radius: 4px; background: rgba(255,80,80,0.08); border-left: 3px solid #ff6b6b; cursor: pointer; font-family: var(--font-mono); font-size: 12px;"><strong>Ln ${err.linea}</strong> | ${err.msg}</div>`).join('')}
                            </div>
                        </div>
                    `;
                } else if (arbolParaMostrar) {
                    actualizarArbolConAnimacion(folderContainer, '<ul class="ast-tree">' + renderTreeTextual(arbolParaMostrar, true) + '</ul>', arbolParaMostrar);
                }
            }

            const panelErrores = document.getElementById('panel_err_sin');
            if (panelErrores) {
                if (data.errores.length === 0) {
                    panelErrores.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px; vertical-align:middle;"></i> Análisis sintáctico completado sin errores.</div>';
                    window.sintacticoErrores = [];
                } else {
                    window.sintacticoErrores = data.errores;
                    panelErrores.innerHTML = data.errores.map(err => {
                        return `<div class="interactive-log-line error-log" onclick="irALinea(${err.linea})">Ln ${err.linea} | ${err.msg}</div>`;
                    }).join('');

                    if (typeof window.actualizarSubrayadoErrores === 'function') {
                        window.actualizarSubrayadoErrores();
                    }

                    if (!esTiempoReal) {
                        document.querySelectorAll('.bottom-panels .tab').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.bottom-content').forEach(el => el.classList.add('oculto'));
                        panelErrores.classList.remove('oculto');
                        document.querySelector(`.bottom-panels .tab[onclick*="err_sin"]`)?.classList.add('active');
                    }
                }
            }
        } else if (fase === 'semantico') {
            const rawOutput = (res && typeof res.output === 'string') ? res.output : (typeof res === 'string' ? res : '');
            if (res && (res.annotated_tree || res.tree)) {
                window.lastAnnotatedTree = res.annotated_tree || res.tree;
            }

            const lineas = rawOutput.split('\n').filter(l => l.trim());
            const errores = lineas.filter(l => l.startsWith('Error Semántico') || l.includes('Error'));
            const info = lineas.filter(l => !l.startsWith('Error Semántico') && !l.includes('Error'));

            function formatNodeLabel(name) {
                if (!name) return '';
                let escaped = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                escaped = escaped.replace(/(\[ERROR:[^\]]+\])/g, '<span style="color:#ff6b6b; font-weight:bold; margin-left:4px;">$1</span>');
                escaped = escaped.replace(/(\[tipo:[^,\]]+(?:,\s*valor:[^\]]+)?\])/g, '<span style="color:#4ec9b0; font-weight:500; margin-left:8px; font-size:12px;">$1</span>');
                return escaped;
            }

            function renderTreeTextual(node, esRaiz = true) {
                if (!node) return '';
                const clickEvent = node.linea ? `onclick="irALinea(${node.linea}); event.stopPropagation();"` : "";
                const dataLineaAttr = node.linea ? `data-linea="${node.linea}"` : "";
                
                if (!node.children || node.children.length === 0) {
                    return `<li ${clickEvent}><span class="leaf-node" ${dataLineaAttr}>📄 ${formatNodeLabel(node.name)}</span></li>`;
                }
                
                const atributoAbierto = esRaiz ? 'open' : '';
                let html = `<li>
                    <details ${atributoAbierto}>
                        <summary class="parent-node" ${clickEvent} ${dataLineaAttr}><span class="tree-arrow">▶</span><span class="folder-icon">📁</span> ${formatNodeLabel(node.name)}</summary>
                        <ul>`;
                node.children.forEach(child => {
                    html += renderTreeTextual(child, false);
                });
                html += `</ul></details></li>`;
                return html;
            }

            const arbolAnotado = window.lastAnnotatedTree;

            let semTreeCont = document.getElementById('semantico_tree_container');
            if (!semTreeCont || !panelActivo.querySelector('#semantico_tree_container')) {
                let html = `
                    <div class="panel-header-sticky" style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size: 11px; color: var(--text-muted);"><span style="color:var(--accent-success); font-weight:600;">Árbol Sintáctico Anotado (AST Semántico)</span> (Carpetas anidadas - Clic para colapsar o ir a línea)</div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-reload" onclick="toggleExpandirArbol('semantico_tree_container', this)" data-expandido="false" title="Expandir o Colapsar Todo" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="chevrons-down" style="width:14px; height:14px;"></i> Expandir Todo</button>
                            <button class="btn-reload" onclick="exportarSemantico()" title="Exportar Árbol Anotado JSON" style="padding: 3px 8px; display:flex; align-items:center; gap:3px;"><i data-lucide="download" style="width:14px; height:14px;"></i> Exportar</button>
                        </div>
                    </div>
                    <div id="semantico_tree_container" style="width: 100%; height: calc(100% - 50px); overflow: auto; padding: 15px; font-family: var(--font-mono); font-size: 14px; display: block;"></div>
                `;
                if (panelActivo) panelActivo.innerHTML = html;
                semTreeCont = document.getElementById('semantico_tree_container');
            }

            if (semTreeCont) {
                if (arbolAnotado && arbolAnotado.children && arbolAnotado.children.length > 0) {
                    actualizarArbolConAnimacion(semTreeCont, '<ul class="ast-tree">' + renderTreeTextual(arbolAnotado, true) + '</ul>', arbolAnotado);
                } else if (errores.length > 0) {
                    semTreeCont.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 15px; color: var(--text-muted); text-align: center; padding: 20px;">
                            <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ff6b6b;"></i>
                            <div style="font-size: 16px; font-weight: bold; color: var(--text-primary);">Errores Semánticos Detectados</div>
                            <div style="text-align: left; width: 100%; max-width: 500px; margin-top: 10px;">
                                ${errores.map(l => {
                                    const m = l.match(/Línea\s+(\d+)/i);
                                    const ln = m ? m[1] : 1;
                                    return `<div class="interactive-log-line error-log" onclick="irALinea(${ln})" style="margin-bottom: 4px; padding: 6px 10px; border-radius: 4px; background: rgba(255,80,80,0.08); border-left: 3px solid #ff6b6b; cursor: pointer; font-family: var(--font-mono); font-size: 12px;">${l}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                } else if (arbolAnotado) {
                    actualizarArbolConAnimacion(semTreeCont, '<ul class="ast-tree">' + renderTreeTextual(arbolAnotado, true) + '</ul>', arbolAnotado);
                } else {
                    semTreeCont.innerHTML = '<div class="success-log"><i data-lucide="check-circle" style="width:16px; height:16px; margin-right:5px;"></i> Análisis semántico completado sin árbol generado.</div>';
                }
            }

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
                    <div style="font-size: 11px; color: var(--text-muted);">Variables e identificadores detectados${esTiempoReal ? ' <span style="color: var(--accent-success); font-weight: 600;">● En vivo</span>' : ''}</div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-reload" onclick="compilarFase('simbolos')" title="Refrescar" style="padding: 3px 8px;"><i data-lucide="refresh-cw" style="width:14px; height:14px;"></i></button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="lexical-table">
                        <thead>
                            <tr><th>Identificador</th><th>Tipo / Contexto</th><th>Apariciones</th><th>Líneas de Aparición</th></tr>
                        </thead>
                        <tbody>
            `;
            if (!data.simbolos || data.simbolos.length === 0) {
                html += `<tr><td colspan="4" style="text-align: center; font-style: italic; color: var(--text-muted);">No se detectaron símbolos</td></tr>`;
            } else {
                data.simbolos.forEach(simbolo => {
                    const safeId = simbolo.identificador.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const lineasArr = simbolo.lineas ? simbolo.lineas.split(',').map(l => l.trim()).filter(l => l) : [];
                    const totalApariciones = lineasArr.length;
                    // Líneas únicas para el resaltado del gutter
                    const lineasUnicas = [...new Set(lineasArr.map(l => parseInt(l, 10)))];
                    const lineasJSON = JSON.stringify(lineasUnicas);
                    // Crear links clickables para cada línea
                    const lineasClickables = lineasArr.map(l =>
                        `<span class="badge-tipo badge-number" style="cursor:pointer; margin: 1px 2px; padding: 1px 6px; font-size: 11px;" onclick="irALinea(${parseInt(l, 10)}); event.stopPropagation();" title="Ir a línea ${l}">${l}</span>`
                    ).join(' ');
                    html += `
                        <tr class="rgb-table-row" onclick="irALinea(${parseInt(lineasArr[0] || '1', 10)})"
                            onmouseenter="resaltarLineasGutter(${lineasJSON.replace(/"/g, '&quot;')})"
                            onmouseleave="limpiarResaltadoGutter()">
                            <td><strong>${safeId}</strong></td>
                            <td><span class="badge-tipo badge-id">${simbolo.tipo}</span></td>
                            <td style="text-align: center;"><span class="badge-tipo badge-keyword" style="font-size: 11px; padding: 1px 8px;">${totalApariciones}</span></td>
                            <td style="font-family: var(--font-mono);">${lineasClickables}</td>
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
                const escaped = inst.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                // Etiquetas tipo L1: o L_start:
                if (/^[A-Za-z_][A-Za-z0-9_]*:$/.test(inst.trim())) {
                    return `<span class="tac-label">${escaped}</span>`;
                }
                const tokenRegex = /\b(if_false|if_true|if|goto|jmp|je|jne|jl|jg|jle|jge|call|ret|READ|WRITE)\b|(t\d+)\b|(L\d+)\b|([0-9]+(?:\.[0-9]+)?)\b|([\$a-zA-Z_][a-zA-Z0-9_]*)|([=!<>]=|[=+\-*\/^%<>!&|]+)|(\S+)/g;
                return escaped.replace(tokenRegex, (match, kw, temp, label, num, id, op, other) => {
                    if (kw) return `<span class="tac-keyword">${kw}</span>`;
                    if (temp) return `<span class="tac-temp">${temp}</span>`;
                    if (label) return `<span class="tac-label-ref">${label}</span>`;
                    if (num) return `<span class="tac-val">${num}</span>`;
                    if (id) return `<span class="tac-var">${id}</span>`;
                    if (op) return `<span class="tac-op">${op}</span>`;
                    return other || match;
                });
            };

            const renderTacBlock = (bloque) => {
                const header = bloque.numLinea
                    ? `<div class="tac-block-header" onclick="irALinea(${bloque.numLinea})" title="Clic para ir a la línea ${bloque.numLinea} en el editor">
                        <span class="tac-line-badge"><i data-lucide="corner-down-right" style="width:12px; height:12px;"></i> ${bloque.titulo || ('Línea ' + bloque.numLinea)}</span>
                        <span style="font-size:10px;"><i data-lucide="external-link" style="width:11px; height:11px; vertical-align:-1px;"></i> Ir al código</span>
                       </div>`
                    : `<div class="tac-block-header"><span>${bloque.titulo || 'Instrucciones'}</span></div>`;

                let rows = '';
                bloque.instrucciones.forEach((inst, idx) => {
                    const isLabel = /^[A-Za-z_][A-Za-z0-9_]*:$/.test(inst.trim());
                    const rowClass = isLabel ? 'tac-inst-row tac-label-row' : 'tac-inst-row';
                    rows += `
                        <div class="${rowClass}">
                            <span class="tac-inst-num">${isLabel ? '🏷️' : (idx + 1) + '.'}</span>
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

                // Soporte para comentarios de tipo "; Línea X", "; Estructura IF (Línea X)", "; Bucle WHILE (Línea X)"
                const matchComment = l.match(/^;\s*(?:(?:Traducción de la\s+)?Línea\s+(\d+)|(.+?\(Línea\s+(\d+)\)))/i);
                if (matchComment) {
                    if (bloqueActual && bloqueActual.instrucciones.length > 0) {
                        bloquesHTML += renderTacBlock(bloqueActual);
                    }
                    const numLn = matchComment[1] || matchComment[3] || null;
                    const desc = matchComment[2] ? matchComment[2] : (numLn ? `Línea ${numLn}` : 'Instrucciones');
                    bloqueActual = {
                        numLinea: numLn,
                        titulo: desc,
                        instrucciones: []
                    };
                } else if (l.startsWith(';')) {
                    // Otros comentarios
                    if (!bloqueActual) {
                        bloqueActual = { numLinea: null, titulo: l.replace(/^;\s*/, ''), instrucciones: [] };
                    }
                } else if (bloqueActual) {
                    bloqueActual.instrucciones.push(l);
                    totalInstrucciones++;
                } else {
                    if (!bloqueActual) {
                        bloqueActual = { numLinea: null, titulo: 'Inicialización', instrucciones: [] };
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

        if (fase === 'ejecucion') {
            if (typeof playNotificationSound === 'function') {
                playNotificationSound();
            }
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

window.lastAnnotatedTree = null;

function exportarSintactico() {
    const arbolExportar = window.lastSintacticoData && window.lastSintacticoData.tree;
    if (!arbolExportar) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("No hay árbol sintáctico para exportar", true);
        }
        return;
    }
    const dataStr = JSON.stringify(arbolExportar, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arbol_sintactico.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('<i data-lucide="download" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Árbol sintáctico exportado');
    }
}

function exportarSemantico() {
    const arbolExportar = window.lastAnnotatedTree;
    if (!arbolExportar) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("No hay árbol anotado para exportar", true);
        }
        return;
    }
    const dataStr = JSON.stringify(arbolExportar, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arbol_anotado_semantico.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('<i data-lucide="download" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Árbol semántico exportado');
    }
}

function copiarCodigoIntermedio() {
    if (!window.lastIntermedioRaw) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("No hay código intermedio generado para copiar", true);
        }
        return;
    }
    navigator.clipboard.writeText(window.lastIntermedioRaw).then(() => {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('<i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px; margin-right:4px;"></i> Código 3AC copiado al portapapeles');
        }
    }).catch(() => {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("Error al copiar al portapapeles", true);
        }
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

// Exposición global
window.compilarFase = compilarFase;
window.autoCompilarEnTiempoReal = autoCompilarEnTiempoReal;
window.resetearUltimoCodigoCompilado = resetearUltimoCodigoCompilado;
window.showRightPanel = showRightPanel;
window.showBottomPanel = showBottomPanel;
window.toggleExpandirArbol = toggleExpandirArbol;
window.toggleAmpliarSintactico = toggleAmpliarSintactico;
window.exportarSintactico = exportarSintactico;
window.exportarSemantico = exportarSemantico;
window.copiarCodigoIntermedio = copiarCodigoIntermedio;
window.getLexicalClass = getLexicalClass;
