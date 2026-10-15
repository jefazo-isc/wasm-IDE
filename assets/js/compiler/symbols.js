/**
 * IDE Indómito - Generador de Tabla de Símbolos basado en Árbol Sintáctico (AST)
 * Fase 1: Construcción en Preorden, Tabla Hash y Rechazo Estricto de no-declarados
 */
const SymbolTableGenerator = {
    generar(codigo, astResult) {
        if (typeof codigo !== 'string') codigo = '';

        // Estructura de Tabla Hash para almacenar los identificadores
        const tablaHash = {};

        // Obtener AST
        let ast = null;
        if (astResult && astResult.tree) {
            ast = astResult.tree;
        } else if (typeof Lexer !== 'undefined' && typeof Parser !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const parser = new Parser(lex.tokens);
            const res = parser.parse();
            ast = res.tree;
        }

        // 1. Recorrido en Preorden sobre el AST para construir memoria contextual (atributos heredados)
        const recolectarDeclaracionesPreorden = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.includes('Programa Principal') || name.toLowerCase().includes('main')) {
                tablaHash['main'] = {
                    tipo: 'Punto de Entrada',
                    lineas: [linea]
                };
            }

            if (name.startsWith('Declaración Variable') && nodo.children) {
                let tipoHeredado = 'Variable';
                const tipoHijo = nodo.children.find(c => c.name && c.name.startsWith('Tipo: '));
                if (tipoHijo) {
                    tipoHeredado = tipoHijo.name.replace('Tipo: ', '').trim();
                }

                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        const l = c.linea || linea;
                        if (id) {
                            if (!tablaHash[id]) {
                                tablaHash[id] = {
                                    tipo: tipoHeredado,
                                    lineas: []
                                };
                            }
                            if (l && !tablaHash[id].lineas.includes(l)) {
                                tablaHash[id].lineas.push(l);
                            }
                        }
                    }
                });
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(recolectarDeclaracionesPreorden);
            }
        };

        // 2. Registro de líneas de uso bajo la Regla Estricta (Rechazar variables no declaradas)
        const registrarUsos = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            const intentarRegistrarUso = (id, l) => {
                const idLimpio = (id || '').trim();
                if (!idLimpio || idLimpio === 'true' || idLimpio === 'false') return;
                // Solo registrar uso si la variable ya fue declarada previamente en la tabla hash
                if (tablaHash[idLimpio]) {
                    if (l && !tablaHash[idLimpio].lineas.includes(l)) {
                        tablaHash[idLimpio].lineas.push(l);
                    }
                }
            };

            if (name.startsWith('Asignación') && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    intentarRegistrarUso(id, varHijo.linea || linea);
                }
            } else if ((name.startsWith('Incremento') || name.startsWith('Decremento')) && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    intentarRegistrarUso(id, varHijo.linea || linea);
                }
            } else if (name.startsWith('Sentencia IN') && nodo.children) {
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        intentarRegistrarUso(id, c.linea || linea);
                    }
                });
            } else if (name.startsWith('Identificador: ')) {
                const id = name.replace('Identificador: ', '').trim();
                intentarRegistrarUso(id, linea);
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(registrarUsos);
            }
        };

        if (ast) {
            recolectarDeclaracionesPreorden(ast);
            registrarUsos(ast);
        }

        // Si la tabla quedó vacía y se dispone de tokens léxicos (fallback)
        if (Object.keys(tablaHash).length === 0 && typeof Lexer !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const tokens = lex.tokens || [];
            let i = 0;
            while (i < tokens.len) {
                const tok = tokens[i];
                if (tok.tipo === 'RESERVADA' && ['int', 'float', 'bool', 'real'].includes(tok.lexema)) {
                    const tipo = tok.lexema;
                    i++;
                    while (i < tokens.length) {
                        const nxt = tokens[i];
                        if (nxt.tipo === 'ID') {
                            if (!tablaHash[nxt.lexema]) {
                                tablaHash[nxt.lexema] = { tipo, lineas: [] };
                            }
                            tablaHash[nxt.lexema].lineas.push(nxt.linea);
                        } else if (nxt.lexema === ';') {
                            break;
                        }
                        i++;
                    }
                } else if (tok.tipo === 'RESERVADA' && tok.lexema === 'main') {
                    tablaHash['main'] = { tipo: 'Punto de Entrada', lineas: [tok.linea] };
                }
                i++;
            }
        }

        // Formato para la vista del IDE
        const output = [];
        const sortedKeys = Object.keys(tablaHash).sort();
        for (const id of sortedKeys) {
            const lineas = tablaHash[id].lineas.sort((a, b) => a - b);
            output.push({
                identificador: id,
                tipo: tablaHash[id].tipo,
                lineas: lineas.join(', ')
            });
        }

        return {
            success: true,
            simbolos: output
        };
    }
};

if (typeof window !== 'undefined') {
    window.SymbolTableGenerator = SymbolTableGenerator;
}
