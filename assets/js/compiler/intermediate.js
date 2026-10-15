/**
 * IDE Indómito - Generación de Código Intermedio de 3 Direcciones (3AC) (Client-side / WebAssembly Ready)
 * Fase 3: Recorrido del AST, función newtemp(), instrucciones x = y op z, copias y saltos condicionales
 */
const IntermediateCodeGenerator = {
    generar(codigo, astResult) {
        if (typeof codigo !== 'string') codigo = '';

        let ast = null;
        if (astResult && astResult.tree) {
            ast = astResult.tree;
        } else if (typeof Lexer !== 'undefined' && typeof Parser !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const parser = new Parser(lex.tokens);
            const res = parser.parse();
            ast = res.tree;
        }

        if (!ast) {
            return "--- GENERACIÓN DE CÓDIGO INTERMEDIO (3 Direcciones) ---\n\nError: No se pudo generar el AST para el código.\n";
        }

        let output = "--- GENERACIÓN DE CÓDIGO INTERMEDIO (3 Direcciones - Basado en AST) ---\n\n";
        let tempCounter = 1;
        let labelCounter = 1;

        const newtemp = () => `t${tempCounter++}`;
        const newlabel = () => `L${labelCounter++}`;
        const emit = (line) => { output += line + '\n'; };

        // Evaluación de Expresiones en Postorden (x = y op z)
        const generarExpresion = (nodo) => {
            if (!nodo) return '';

            const name = nodo.name || '';

            // Hojas
            if (name.startsWith('Número: ')) {
                return name.replace('Número: ', '').trim();
            }
            if (name.startsWith('Booleano: ')) {
                return name.replace('Booleano: ', '').trim();
            }
            if (name.startsWith('Identificador: ')) {
                return name.replace('Identificador: ', '').trim();
            }

            // Agrupación
            if (name.startsWith('Agrupación') && nodo.children && nodo.children[0]) {
                return generarExpresion(nodo.children[0]);
            }

            // Unaria
            if (name.startsWith('Op Unaria') && nodo.children && nodo.children[0]) {
                const operando = generarExpresion(nodo.children[0]);
                const temp = newtemp();
                if (name.includes('!')) {
                    emit(`${temp} = !${operando}`);
                } else if (name.includes('-')) {
                    emit(`${temp} = -${operando}`);
                } else if (name.includes('++')) {
                    emit(`${temp} = ${operando} + 1`);
                } else if (name.includes('--')) {
                    emit(`${temp} = ${operando} - 1`);
                }
                return temp;
            }

            // Binarias
            let op = '';
            if (name.startsWith('Operación Aditiva')) {
                op = name.includes('+') ? '+' : '-';
            } else if (name.startsWith('Operación Multiplicativa')) {
                if (name.includes('*')) op = '*';
                else if (name.includes('/')) op = '/';
                else if (name.includes('%')) op = '%';
            } else if (name.startsWith('Potencia')) {
                op = '^';
            } else if (name.startsWith('Operación Relacional')) {
                if (name.includes('<=')) op = '<=';
                else if (name.includes('>=')) op = '>=';
                else if (name.includes('==')) op = '==';
                else if (name.includes('!=')) op = '!=';
                else if (name.includes('<')) op = '<';
                else if (name.includes('>')) op = '>';
            } else if (name.startsWith('Op Lógico')) {
                if (name.includes('&&')) op = '&&';
                else if (name.includes('||')) op = '||';
            }

            if (op && nodo.children) {
                let arg1 = '';
                let arg2 = '';
                nodo.children.forEach(c => {
                    if (c.name === 'Izq' || c.name === 'Base') {
                        if (c.children && c.children[0]) arg1 = generarExpresion(c.children[0]);
                    } else if (c.name === 'Der' || c.name === 'Exponente') {
                        if (c.children && c.children[0]) arg2 = generarExpresion(c.children[0]);
                    }
                });

                const temp = newtemp();
                emit(`${temp} = ${arg1} ${op} ${arg2}`);
                return temp;
            }

            return '';
        };

        // Generación de Sentencias y Saltos Condicionales
        const generarSentencias = (nodo) => {
            if (!nodo) return;

            const name = nodo.name || '';
            const linea = nodo.linea || 1;

            if (name.startsWith('Asignación') && nodo.children) {
                let destino = '';
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) destino = varHijo.name.replace('Variable: ', '').trim();

                const valHijo = nodo.children.find(c => c.name === 'Valor');
                if (valHijo && valHijo.children && valHijo.children[0]) {
                    emit(`; Línea ${linea}`);
                    const valor = generarExpresion(valHijo.children[0]);
                    emit(`${destino} = ${valor}\n`);
                }
                return;
            }

            if ((name.startsWith('Incremento') || name.startsWith('Decremento')) && nodo.children) {
                const op = name.includes('++') ? '+' : '-';
                const varHijo = nodo.children.find(c => c.name && c.name.startsWith('Variable: '));
                if (varHijo) {
                    const id = varHijo.name.replace('Variable: ', '').trim();
                    const temp = newtemp();
                    emit(`; Línea ${linea}`);
                    emit(`${temp} = ${id} ${op} 1`);
                    emit(`${id} = ${temp}\n`);
                }
                return;
            }

            if (name.startsWith('Sentencia IN') && nodo.children) {
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('ID: ')) {
                        const id = c.name.replace('ID: ', '').trim();
                        emit(`; Línea ${linea}`);
                        emit(`READ ${id}\n`);
                    }
                });
                return;
            }

            if (name.startsWith('Salida (cout)') && nodo.children) {
                emit(`; Línea ${linea}`);
                nodo.children.forEach(c => {
                    if (c.name && c.name.startsWith('Cadena: ')) {
                        emit(`WRITE ${c.name.replace('Cadena: ', '')}`);
                    } else {
                        const val = generarExpresion(c);
                        emit(`WRITE ${val}`);
                    }
                });
                emit('');
                return;
            }

            if (name.startsWith('Sentencia IF') && nodo.children) {
                const lElse = newlabel();
                const lEnd = newlabel();
                let tieneElse = false;

                emit(`; Estructura IF (Línea ${linea})`);

                const condHijo = nodo.children.find(c => c.name === 'Condición');
                if (condHijo && condHijo.children && condHijo.children[0]) {
                    const condVal = generarExpresion(condHijo.children[0]);
                    emit(`if_false ${condVal} goto ${lElse}`);
                }

                const thenHijo = nodo.children.find(c => c.name === 'Bloque THEN');
                if (thenHijo && thenHijo.children) {
                    thenHijo.children.forEach(generarSentencias);
                }

                const elseHijo = nodo.children.find(c => c.name === 'Bloque ELSE');
                if (elseHijo && elseHijo.children && elseHijo.children.length > 0) {
                    tieneElse = true;
                }

                if (tieneElse) {
                    emit(`goto ${lEnd}`);
                    emit(`${lElse}:`);
                    elseHijo.children.forEach(generarSentencias);
                    emit(`${lEnd}:\n`);
                } else {
                    emit(`${lElse}:\n`);
                }
                return;
            }

            if (name.startsWith('Bucle WHILE') && nodo.children) {
                const lStart = newlabel();
                const lEnd = newlabel();

                emit(`; Bucle WHILE (Línea ${linea})`);
                emit(`${lStart}:`);

                const condHijo = nodo.children.find(c => c.name === 'Condición');
                if (condHijo && condHijo.children && condHijo.children[0]) {
                    const condVal = generarExpresion(condHijo.children[0]);
                    emit(`if_false ${condVal} goto ${lEnd}`);
                }

                const cuerpoHijo = nodo.children.find(c => c.name === 'Cuerpo');
                if (cuerpoHijo && cuerpoHijo.children) {
                    cuerpoHijo.children.forEach(generarSentencias);
                }

                emit(`goto ${lStart}`);
                emit(`${lEnd}:\n`);
                return;
            }

            if (name.startsWith('Bucle DO-') && nodo.children) {
                const lStart = newlabel();
                const esUntil = name.includes('UNTIL');

                emit(`; ${name} (Línea ${linea})`);
                emit(`${lStart}:`);

                const cuerpoHijo = nodo.children.find(c => c.name === 'Cuerpo');
                if (cuerpoHijo && cuerpoHijo.children) {
                    cuerpoHijo.children.forEach(generarSentencias);
                }

                const condHijo = nodo.children.find(c => c.name === 'Condición');
                if (condHijo && condHijo.children && condHijo.children[0]) {
                    const condVal = generarExpresion(condHijo.children[0]);
                    if (esUntil) {
                        emit(`if_false ${condVal} goto ${lStart}\n`);
                    } else {
                        emit(`if ${condVal} goto ${lStart}\n`);
                    }
                }
                return;
            }

            if (nodo.children && Array.isArray(nodo.children)) {
                nodo.children.forEach(generarSentencias);
            }
        };

        generarSentencias(ast);
        emit('; Generación finalizada exitosamente.');
        return output;
    }
};

if (typeof window !== 'undefined') {
    window.IntermediateCodeGenerator = IntermediateCodeGenerator;
}
