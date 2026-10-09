/**
 * IDE Indómito - Generador de Tabla de Símbolos basado en Árbol Sintáctico (AST)
 * Modulo Tabla de Simbolos Client-side
 */
const SymbolTableGenerator = {
    generar(codigo, astResult) {
        if (typeof codigo !== 'string') codigo = '';

        const simbolos = {};

        const registrarSimbolo = (identificador, tipo, linea) => {
            if (!identificador || typeof identificador !== 'string') return;
            const idLimpio = identificador.trim();
            if (!idLimpio) return;

            if (!simbolos[idLimpio]) {
                simbolos[idLimpio] = {
                    tipo: tipo,
                    lineas: []
                };
            }
            if (linea && !simbolos[idLimpio].lineas.includes(linea)) {
                simbolos[idLimpio].lineas.push(linea);
            }
        };

        // Si no se proporcionó un AST previo, generarlo con Lexer + Parser
        let ast = null;
        if (astResult && astResult.tree) {
            ast = astResult.tree;
        } else if (typeof Lexer !== 'undefined' && typeof Parser !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const parser = new Parser(lex.tokens);
            const res = parser.parse();
            ast = res.tree;
        }

        // Recorrido recursivo del Árbol Sintáctico (AST)
        const recorrerAST = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || null;

            // 1. Programa principal
            if (name.includes('Programa Principal') || name.toLowerCase().includes('main')) {
                registrarSimbolo('main', 'Punto de Entrada', linea || 1);
            }

            // 2. Declaración de variables: Nodo "Declaración Variable" con hijos Tipo e ID
            if (name.startsWith('Declaración Variable') && nodo.children) {
                let tipoVar = 'Variable';
                const tipoHijo = nodo.children.find(c => c.name && c.name.startsWith('Tipo: '));
                if (tipoHijo) {
                    tipoVar = tipoHijo.name.replace('Tipo: ', '').trim();
                }

                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        registrarSimbolo(id, tipoVar, c.linea || linea);
                    }
                });
            }

            // 3. Asignación: Nodo "Asignación (=)" con hijo Variable
            if (name.startsWith('Asignación') && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    registrarSimbolo(id, 'Asignación/Uso', varHijo.linea || linea);
                }
            }

            // 4. Incremento / Decremento
            if ((name.startsWith('Incremento') || name.startsWith('Decremento')) && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    registrarSimbolo(id, 'Incremento/Uso', varHijo.linea || linea);
                }
            }

            // 5. Entrada cin: Sentencia IN con ID
            if (name.startsWith('Sentencia IN') && nodo.children) {
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        registrarSimbolo(id, 'Entrada (cin)', c.linea || linea);
                    }
                });
            }

            // 6. Referencias a Identificadores en expresiones u otros nodos hoja
            if (name.startsWith('Identificador: ')) {
                const id = name.replace('Identificador: ', '').trim();
                registrarSimbolo(id, 'Identificador/Uso', linea);
            }

            // Visitar hijos del nodo del árbol
            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(recorrerAST);
            }
        };

        if (ast) {
            recorrerAST(ast);
        }

        // Si el AST no produjo símbolos o falló sintácticamente, extraer de los tokens del código
        if (Object.keys(simbolos).length === 0 && typeof Lexer !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            (lex.tokens || []).forEach(tok => {
                if (tok.tipo === 'ID') {
                    registrarSimbolo(tok.lexema, 'Identificador', tok.linea);
                } else if (tok.tipo === 'RESERVADA' && tok.lexema === 'main') {
                    registrarSimbolo('main', 'Punto de Entrada', tok.linea);
                }
            });
        }

        // Ordenar alfabéticamente
        const output = [];
        const sortedKeys = Object.keys(simbolos).sort();
        for (const id of sortedKeys) {
            output.push({
                identificador: id,
                tipo: simbolos[id].tipo,
                lineas: simbolos[id].lineas.join(', ')
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
