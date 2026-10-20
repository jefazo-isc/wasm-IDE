/**
 * IDE Indómito - Generador de Tabla de Símbolos basado en Árbol Sintáctico (AST)
 * Fase 1: Construcción en Preorden, Tabla Hash y Rechazo Estricto de no-declarados
 *
 * NOTA: La maestra quiere que si una variable se repite en la misma línea,
 * el número de línea se duplique en la tabla de símbolos.
 * Ejemplo: "x = x + x;" en línea 3 → Líneas de aparición: 3, 3, 3
 * Por eso se usa el Lexer para contar TODAS las apariciones léxicas reales.
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
        //    Esto solo sirve para DECLARAR las variables y obtener su tipo.
        const recolectarDeclaracionesPreorden = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.includes('Programa Principal') || name.toLowerCase().includes('main')) {
                tablaHash['main'] = {
                    tipo: 'Punto de Entrada',
                    lineas: []
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
                        if (id && !tablaHash[id]) {
                            tablaHash[id] = {
                                tipo: tipoHeredado,
                                lineas: []
                            };
                        }
                    }
                });
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(recolectarDeclaracionesPreorden);
            }
        };

        if (ast) {
            recolectarDeclaracionesPreorden(ast);
        }

        // 2. Conteo de apariciones léxicas reales usando los tokens del Lexer.
        //    Así la maestra quiere: si "x" aparece 3 veces en la línea 5,
        //    la tabla muestra "5, 5, 5" (el número se duplica por cada aparición).
        if (typeof Lexer !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const tokens = lex.tokens || [];

            // Si el AST no encontró declaraciones, intentar con el fallback léxico
            if (Object.keys(tablaHash).length === 0) {
                let i = 0;
                while (i < tokens.length) {
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
                            } else if (nxt.lexema === ';') {
                                break;
                            }
                            i++;
                        }
                    } else if (tok.tipo === 'RESERVADA' && tok.lexema === 'main') {
                        if (!tablaHash['main']) {
                            tablaHash['main'] = { tipo: 'Punto de Entrada', lineas: [] };
                        }
                    }
                    i++;
                }
            }

            // Recorrer TODOS los tokens y registrar CADA aparición de cada ID declarado.
            // Esto garantiza que si "x" aparece 3 veces en la línea 5, se registre 5, 5, 5.
            tokens.forEach(tok => {
                if (tok.tipo === 'ID' && tablaHash[tok.lexema]) {
                    tablaHash[tok.lexema].lineas.push(tok.linea);
                } else if (tok.tipo === 'RESERVADA' && tok.lexema === 'main' && tablaHash['main']) {
                    tablaHash['main'].lineas.push(tok.linea);
                }
            });
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
