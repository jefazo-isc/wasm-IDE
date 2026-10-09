/**
 * IDE Indómito - Analizador Semántico basado en Árbol Sintáctico (AST)
 * Modulo Semantico Client-side
 */
const SemanticAnalyzer = {
    analizar(codigo, astResult) {
        if (typeof codigo !== 'string') codigo = '';

        let output = "--- ANÁLISIS SEMÁNTICO (Basado en AST) ---\n\n";
        const declaradas = {};
        const errores = [];

        // Obtener o construir el AST
        let ast = null;
        if (astResult && astResult.tree) {
            ast = astResult.tree;
        } else if (typeof Lexer !== 'undefined' && typeof Parser !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const parser = new Parser(lex.tokens);
            const res = parser.parse();
            ast = res.tree;
        }

        // FASE 1: Recorrer AST para registrar declaraciones
        const recolectarDeclaraciones = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.startsWith('Declaración Variable') && nodo.children) {
                let tipoVar = 'Desconocido';
                const tipoHijo = nodo.children.find(c => c.name && c.name.startsWith('Tipo: '));
                if (tipoHijo) {
                    tipoVar = tipoHijo.name.replace('Tipo: ', '').trim();
                }

                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        const lineaDecl = c.linea || linea;
                        if (declaradas[id]) {
                            output += `Advertencia (Línea ${lineaDecl}): Variable '${id}' ya había sido declarada previamente.\n`;
                        } else {
                            declaradas[id] = { tipo: tipoVar, linea: lineaDecl };
                            output += `Validación (Línea ${lineaDecl}): Variable '${id}' (${tipoVar}) declarada correctamente.\n`;
                        }
                    }
                });
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(recolectarDeclaraciones);
            }
        };

        if (ast) {
            recolectarDeclaraciones(ast);
        }

        output += "\n--- Verificación de Uso en el Árbol Sintáctico ---\n";

        // FASE 2: Recorrer AST para validar uso y asignaciones
        const validarUsos = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            // Validar destino de asignación
            if (name.startsWith('Asignación') && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    const lineaUso = varHijo.linea || linea;
                    if (!declaradas[id] && id !== 'main') {
                        output += `Error Semántico (Línea ${lineaUso}): La variable '${id}' está siendo asignada pero no fue declarada.\n`;
                        errores.push({
                            linea: lineaUso,
                            var: id,
                            msg: `La variable '${id}' está siendo asignada pero no fue declarada.`
                        });
                    }
                }
            }

            // Validar incrementos / decrementos
            if ((name.startsWith('Incremento') || name.startsWith('Decremento')) && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    const lineaUso = varHijo.linea || linea;
                    if (!declaradas[id]) {
                        output += `Error Semántico (Línea ${lineaUso}): La variable '${id}' fue modificada pero no está declarada.\n`;
                        errores.push({
                            linea: lineaUso,
                            var: id,
                            msg: `La variable '${id}' fue modificada pero no está declarada.`
                        });
                    }
                }
            }

            // Validar sentencias cin
            if (name.startsWith('Sentencia IN') && nodo.children) {
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        const lineaUso = c.linea || linea;
                        if (!declaradas[id]) {
                            output += `Error Semántico (Línea ${lineaUso}): La variable '${id}' en 'cin' no fue declarada.\n`;
                            errores.push({
                                linea: lineaUso,
                                var: id,
                                msg: `La variable '${id}' en 'cin' no fue declarada.`
                            });
                        }
                    }
                });
            }

            // Validar uso de identificadores en expresiones
            if (name.startsWith('Identificador: ')) {
                const id = name.replace('Identificador: ', '').trim();
                if (!declaradas[id] && id !== 'main') {
                    output += `Error Semántico (Línea ${linea}): Variable '${id}' referenciada sin declaración previa.\n`;
                    errores.push({
                        linea: linea,
                        var: id,
                        msg: `Variable '${id}' referenciada sin declaración previa.`
                    });
                }
            }

            // Continuar recorrido recursivo por los hijos
            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(validarUsos);
            }
        };

        if (ast) {
            validarUsos(ast);
        }

        if (errores.length === 0) {
            output += "\nVerificación semántica completada con éxito. Todas las variables usadas concuerdan con el árbol sintáctico.\n";
        }

        return {
            success: errores.length === 0,
            output: output,
            errores: errores
        };
    }
};

if (typeof window !== 'undefined') {
    window.SemanticAnalyzer = SemanticAnalyzer;
}
