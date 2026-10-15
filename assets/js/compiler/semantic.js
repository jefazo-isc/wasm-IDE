/**
 * IDE Indómito - Analizador Semántico basado en Árbol Sintáctico (AST)
 * Fase 2: Inferencia en Postorden, soporte multitipo (int, float, bool) y verificación estricta
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

        const normalizarTipo = (t) => {
            const s = (t || '').toLowerCase().trim();
            if (s === 'int' || s === 'entero') return 'int';
            if (s === 'float' || s === 'real') return 'float';
            if (s === 'bool' || s === 'booleano') return 'bool';
            return 'desconocido';
        };

        const esNumerico = (t) => t === 'int' || t === 'float';

        // =========================================================================
        // FASE 1: Recorrer AST en Preorden para registrar declaraciones (Atributos Heredados)
        // =========================================================================
        const recolectarDeclaraciones = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.startsWith('Declaración Variable') && nodo.children) {
                let tipoVar = 'int';
                const tipoHijo = nodo.children.find(c => c.name && c.name.startsWith('Tipo: '));
                if (tipoHijo) {
                    tipoVar = normalizarTipo(tipoHijo.name.replace('Tipo: ', '').trim());
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

        output += "\n--- Verificación Semántica y Chequeo de Tipos (Postorden) ---\n";

        // =========================================================================
        // FASE 2: Inferencia de Tipos en Postorden (Atributos Sintetizados)
        // =========================================================================
        const inferirTipoPostorden = (nodo) => {
            if (!nodo) return 'desconocido';

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            // 1. Nodos Hoja
            if (name.startsWith('Número: ')) {
                const numVal = name.replace('Número: ', '').trim();
                return numVal.includes('.') ? 'float' : 'int';
            }

            if (name.startsWith('Booleano: ')) {
                return 'bool';
            }

            if (name.startsWith('Identificador: ')) {
                const id = name.replace('Identificador: ', '').trim();
                if (declaradas[id]) {
                    return declaradas[id].tipo;
                } else if (id === 'true' || id === 'false') {
                    return 'bool';
                } else if (id !== 'main') {
                    const msg = `Variable '${id}' referenciada sin declaración previa.`;
                    output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                    errores.push({ linea, var: id, msg });
                }
                return 'desconocido';
            }

            // 2. Agrupación ( )
            if (name.startsWith('Agrupación') && nodo.children && nodo.children.length > 0) {
                return inferirTipoPostorden(nodo.children[0]);
            }

            // 3. Operación Unaria
            if (name.startsWith('Op Unaria') && nodo.children && nodo.children.length > 0) {
                const tipoHijo = inferirTipoPostorden(nodo.children[0]);
                if (name.includes('!')) {
                    if (tipoHijo !== 'bool' && tipoHijo !== 'desconocido') {
                        const msg = `Operador lógico '!' aplicado a operando de tipo '${tipoHijo}' (se esperaba bool).`;
                        output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                        errores.push({ linea, var: '!', msg });
                    }
                    return 'bool';
                } else if (name.includes('-') || name.includes('++') || name.includes('--')) {
                    if (!esNumerico(tipoHijo) && tipoHijo !== 'desconocido') {
                        const msg = `Operador aritmético unario aplicado a operando no numérico '${tipoHijo}'.`;
                        output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                        errores.push({ linea, var: '-', msg });
                    }
                    return tipoHijo;
                }
            }

            // Extraer operandos Izq y Der en recorrido postorden
            let tipoIzq = 'desconocido';
            let tipoDer = 'desconocido';
            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(c => {
                    if (c.name === 'Izq' || c.name === 'Base') {
                        if (c.children && c.children[0]) tipoIzq = inferirTipoPostorden(c.children[0]);
                    } else if (c.name === 'Der' || c.name === 'Exponente') {
                        if (c.children && c.children[0]) tipoDer = inferirTipoPostorden(c.children[0]);
                    }
                });
            }

            // 4. Operaciones Aritméticas
            if (name.startsWith('Operación Aditiva') || name.startsWith('Operación Multiplicativa') || name.startsWith('Potencia')) {
                if (tipoIzq !== 'desconocido' && !esNumerico(tipoIzq)) {
                    const msg = `Operación aritmética aplicada a tipo no numérico '${tipoIzq}' en operando izquierdo.`;
                    output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                    errores.push({ linea, var: name, msg });
                }
                if (tipoDer !== 'desconocido' && !esNumerico(tipoDer)) {
                    const msg = `Operación aritmética aplicada a tipo no numérico '${tipoDer}' en operando derecho.`;
                    output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                    errores.push({ linea, var: name, msg });
                }

                if (tipoIzq === 'float' || tipoDer === 'float') return 'float';
                return 'int';
            }

            // 5. Operaciones Relacionales
            if (name.startsWith('Operación Relacional')) {
                if (name.includes('==') || name.includes('!=')) {
                    if (tipoIzq !== 'desconocido' && tipoDer !== 'desconocido') {
                        if (esNumerico(tipoIzq) !== esNumerico(tipoDer)) {
                            const msg = `Comparación de igualdad entre tipos incompatibles ('${tipoIzq}' y '${tipoDer}').`;
                            output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                            errores.push({ linea, var: '==', msg });
                        }
                    }
                } else {
                    if (tipoIzq !== 'desconocido' && !esNumerico(tipoIzq)) {
                        const msg = `Comparación relacional con operando izquierdo no numérico '${tipoIzq}'.`;
                        output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                        errores.push({ linea, var: '<', msg });
                    }
                    if (tipoDer !== 'desconocido' && !esNumerico(tipoDer)) {
                        const msg = `Comparación relacional con operando derecho no numérico '${tipoDer}'.`;
                        output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                        errores.push({ linea, var: '<', msg });
                    }
                }
                return 'bool';
            }

            // 6. Operaciones Lógicas
            if (name.startsWith('Op Lógico')) {
                if (tipoIzq !== 'desconocido' && tipoIzq !== 'bool') {
                    const msg = `Operador lógico con operando izquierdo de tipo '${tipoIzq}' (se esperaba bool).`;
                    output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                    errores.push({ linea, var: name, msg });
                }
                if (tipoDer !== 'desconocido' && tipoDer !== 'bool') {
                    const msg = `Operador lógico con operando derecho de tipo '${tipoDer}' (se esperaba bool).`;
                    output += `Error Semántico (Línea ${linea}): ${msg}\n`;
                    errores.push({ linea, var: name, msg });
                }
                return 'bool';
            }

            return 'desconocido';
        };

        // =========================================================================
        // Validar Sentencias (Asignaciones, Incrementos, Sentencias IN y Condiciones)
        // =========================================================================
        const validarSentencias = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.startsWith('Asignación') && nodo.children) {
                let varId = '';
                let lineaVar = linea;
                let tipoDestino = 'desconocido';

                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    varId = varHijo.name.replace('Variable: ', '').trim();
                    lineaVar = varHijo.linea || linea;
                    if (declaradas[varId]) {
                        tipoDestino = declaradas[varId].tipo;
                    } else if (varId !== 'main') {
                        const msg = `La variable '${varId}' está siendo asignada pero no fue declarada.`;
                        output += `Error Semántico (Línea ${lineaVar}): ${msg}\n`;
                        errores.push({ linea: lineaVar, var: varId, msg });
                    }
                }

                const valorHijo = nodo.children.find(c => c.name === 'Valor');
                if (valorHijo && valorHijo.children && valorHijo.children[0]) {
                    const tipoExp = inferirTipoPostorden(valorHijo.children[0]);
                    if (tipoDestino !== 'desconocido' && tipoExp !== 'desconocido') {
                        if (tipoDestino === 'int' && tipoExp === 'float') {
                            const msg = `Incompatibilidad de tipos: no se puede asignar float a variable int '${varId}'.`;
                            output += `Error Semántico (Línea ${lineaVar}): ${msg}\n`;
                            errores.push({ linea: lineaVar, var: varId, msg });
                        } else if (tipoDestino === 'int' && tipoExp === 'bool') {
                            const msg = `Incompatibilidad de tipos: no se puede asignar bool a variable int '${varId}'.`;
                            output += `Error Semántico (Línea ${lineaVar}): ${msg}\n`;
                            errores.push({ linea: lineaVar, var: varId, msg });
                        } else if (tipoDestino === 'float' && tipoExp === 'bool') {
                            const msg = `Incompatibilidad de tipos: no se puede asignar bool a variable float '${varId}'.`;
                            output += `Error Semántico (Línea ${lineaVar}): ${msg}\n`;
                            errores.push({ linea: lineaVar, var: varId, msg });
                        } else if (tipoDestino === 'bool' && esNumerico(tipoExp)) {
                            const msg = `Incompatibilidad de tipos: no se puede asignar valor numérico a variable bool '${varId}'.`;
                            output += `Error Semántico (Línea ${lineaVar}): ${msg}\n`;
                            errores.push({ linea: lineaVar, var: varId, msg });
                        }
                    }
                }
                return;
            }

            if ((name.startsWith('Incremento') || name.startsWith('Decremento')) && nodo.children) {
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    const lineaUso = varHijo.linea || linea;
                    if (declaradas[id]) {
                        if (!esNumerico(declaradas[id].tipo)) {
                            const msg = `Operador de incremento/decremento aplicado a variable no numérica '${id}' (tipo ${declaradas[id].tipo}).`;
                            output += `Error Semántico (Línea ${lineaUso}): ${msg}\n`;
                            errores.push({ linea: lineaUso, var: id, msg });
                        }
                    } else {
                        const msg = `La variable '${id}' fue modificada pero no está declarada.`;
                        output += `Error Semántico (Línea ${lineaUso}): ${msg}\n`;
                        errores.push({ linea: lineaUso, var: id, msg });
                    }
                }
                return;
            }

            if (name.startsWith('Sentencia IN') && nodo.children) {
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        const lineaUso = c.linea || linea;
                        if (!declaradas[id]) {
                            const msg = `La variable '${id}' en 'cin' no fue declarada.`;
                            output += `Error Semántico (Línea ${lineaUso}): ${msg}\n`;
                            errores.push({ linea: lineaUso, var: id, msg });
                        }
                    }
                });
                return;
            }

            if (name.startsWith('Sentencia IF') || name.startsWith('Bucle WHILE') || name.startsWith('Bucle DO-')) {
                if (nodo.children) {
                    nodo.children.forEach(c => {
                        if (c.name === 'Condición') {
                            if (c.children && c.children[0]) {
                                const tipoCond = inferirTipoPostorden(c.children[0]);
                                if (tipoCond !== 'bool' && tipoCond !== 'desconocido') {
                                    const msg = `La condición en '${name}' debe ser de tipo bool, pero se obtuvo '${tipoCond}'.`;
                                    output += `Error Semántico (Línea ${c.linea || linea}): ${msg}\n`;
                                    errores.push({ linea: c.linea || linea, var: name, msg });
                                }
                            }
                        } else {
                            validarSentencias(c);
                        }
                    });
                }
                return;
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(validarSentencias);
            }
        };

        if (ast) {
            validarSentencias(ast);
        }

        // =========================================================================
        // FASE 2.3: Generación del Árbol Anotado (Decorado con Tipos y Atributos Semánticos)
        // =========================================================================
        const construirArbolAnotado = (nodo) => {
            if (!nodo) return null;
            const name = nodo.name || '';
            let annotatedName = name;
            let tipoSintetizado = null;

            if (name.startsWith('Número: ')) {
                const numVal = name.replace('Número: ', '').trim();
                const t = numVal.includes('.') ? 'float' : 'int';
                annotatedName = `${name} [tipo: ${t}]`;
                tipoSintetizado = t;
            } else if (name.startsWith('Booleano: ')) {
                annotatedName = `${name} [tipo: bool]`;
                tipoSintetizado = 'bool';
            } else if (name.startsWith('Identificador: ')) {
                const id = name.replace('Identificador: ', '').trim();
                if (declaradas[id]) {
                    annotatedName = `${name} [tipo: ${declaradas[id].tipo}]`;
                    tipoSintetizado = declaradas[id].tipo;
                } else if (id === 'true' || id === 'false') {
                    annotatedName = `${name} [tipo: bool]`;
                    tipoSintetizado = 'bool';
                } else if (id !== 'main') {
                    annotatedName = `${name} [no declarada!]`;
                }
            } else if (name.startsWith('Tipo: ')) {
                annotatedName = `${name} [tipo base]`;
                tipoSintetizado = normalizarTipo(name.replace('Tipo: ', '').trim());
            } else if (name.startsWith('Variable: ') || name.startsWith('Destino: ') || name.startsWith('ID: ')) {
                const prefijo = name.startsWith('Variable:') ? 'Variable: ' : name.startsWith('Destino:') ? 'Destino: ' : 'ID: ';
                const id = name.replace(prefijo, '').trim();
                if (declaradas[id]) {
                    annotatedName = `${name} [tipo: ${declaradas[id].tipo}]`;
                    tipoSintetizado = declaradas[id].tipo;
                } else if (id !== 'main') {
                    annotatedName = `${name} [no declarada!]`;
                }
            }

            const annotatedChildren = [];
            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(c => {
                    const resHijo = construirArbolAnotado(c);
                    if (resHijo) {
                        annotatedChildren.push(resHijo);
                        if ((c.name === 'Izq' || c.name === 'Base' || c.name === 'Der' || c.name === 'Exponente' || c.name === 'Valor') && !tipoSintetizado) {
                            if (resHijo._tipoSintetizado) {
                                tipoSintetizado = resHijo._tipoSintetizado;
                            }
                        }
                    }
                });
            }

            if (name.startsWith('Operación Aditiva') || name.startsWith('Operación Multiplicativa') || name.startsWith('Potencia')) {
                const tieneTipoFloat = (c) => {
                    if (!c) return false;
                    if (c._tipoSintetizado === 'float' || (c.name && c.name.includes('[tipo: float]'))) return true;
                    if (c.children && Array.isArray(c.children)) return c.children.some(tieneTipoFloat);
                    return false;
                };
                const tieneFloat = annotatedChildren.some(tieneTipoFloat);
                const tipoOp = tieneFloat ? 'float' : 'int';
                annotatedName = `${name} [tipo: ${tipoOp}]`;
                tipoSintetizado = tipoOp;
            } else if (name.startsWith('Operación Relacional') || name.startsWith('Op Lógico')) {
                annotatedName = `${name} [tipo: bool]`;
                tipoSintetizado = 'bool';
            } else if (name.startsWith('Op Unaria')) {
                if (name.includes('!')) {
                    annotatedName = `${name} [tipo: bool]`;
                    tipoSintetizado = 'bool';
                } else {
                    const tieneFloat = annotatedChildren.some(c => (c.name && c.name.includes('[tipo: float]')) || c._tipoSintetizado === 'float');
                    const tipoOp = tieneFloat ? 'float' : 'int';
                    annotatedName = `${name} [tipo: ${tipoOp}]`;
                    tipoSintetizado = tipoOp;
                }
            } else if (name.startsWith('Asignación')) {
                let varTipo = '';
                annotatedChildren.forEach(c => {
                    if (c.name && c.name.startsWith('Variable: ')) {
                        const id = c.name.replace('Variable: ', '').trim();
                        if (declaradas[id]) varTipo = declaradas[id].tipo;
                    }
                });
                if (varTipo) {
                    annotatedName = `${name} [asigna a: ${varTipo}]`;
                }
            }

            return {
                name: annotatedName,
                linea: nodo.linea || 1,
                children: annotatedChildren.length > 0 ? annotatedChildren : undefined,
                _tipoSintetizado: tipoSintetizado
            };
        };

        const annotatedTree = ast ? construirArbolAnotado(ast) : null;

        if (errores.length === 0) {
            output += "\nVerificación semántica completada con éxito. Todos los tipos y variables concuerdan correctamente con el AST.\n";
        }

        return {
            success: errores.length === 0,
            output,
            errores,
            annotated_tree: annotatedTree,
            tree: annotatedTree
        };
    }
};

if (typeof window !== 'undefined') {
    window.SemanticAnalyzer = SemanticAnalyzer;
}
