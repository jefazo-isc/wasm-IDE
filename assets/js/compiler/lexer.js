/**
 * IDE Indómito - Analizador Léxico (Client-side / WebAssembly Ready)
 * Modulo Lexico Client-side
 */
const Lexer = {
    patrones: [
        { tipo: 'COM_MULTI',     regex: /^\/\*[\s\S]*?\*\// },
        { tipo: 'COM_SIMPLE',    regex: /^\/\/[^\n]*/ },
        { tipo: 'RESERVADA',     regex: /^(if|else|end|do|while|switch|case|int|float|bool|main|cin|cout|real|then|until)\b/ },
        { tipo: 'ID',            regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
        { tipo: 'NUM_REAL',      regex: /^[0-9]+\.[0-9]+/ },
        { tipo: 'ERR_NUM',       regex: /^[0-9]+\.(?![0-9])/ },
        { tipo: 'NUM_ENTERO',    regex: /^[0-9]+/ },
        { tipo: 'OP_RELACIONAL', regex: /^(<\s*<|>\s*>|<\s*=|>\s*=|!\s*=|=\s*=|<|>)/ },
        { tipo: 'OP_LOGICO',     regex: /^(&\s*&|\|\s*\||!)/ },
        { tipo: 'OP_ARITMETICO', regex: /^(\+[ \t]*\+|-[ \t]*-|\+|-|\*|\/|%|\^)/ },
        { tipo: 'ASIGNACION',    regex: /^=/ },
        { tipo: 'CADENA',        regex: /^"[^"]*"/ },
        { tipo: 'CARACTER',      regex: /^'[^']*'/ },
        { tipo: 'SIMBOLO',       regex: /^(\(|\)|\{|\}|,|;|"|\')/ }
    ],

    analizar(codigo) {
        if (typeof codigo !== 'string') {
            codigo = '';
        }

        const longitud = codigo.length;
        let offset = 0;
        let linea_actual = 1;
        let col_actual = 1;

        const tokens = [];
        const errores = [];

        while (offset < longitud) {
            const subcadena = codigo.substring(offset);
            let matched = false;

            // Soporte para espacios y saltos de línea
            const matchEspacio = subcadena.match(/^(\s+)/);
            if (matchEspacio) {
                const espacios = matchEspacio[1];
                const saltos = (espacios.match(/\n/g) || []).length;

                if (saltos > 0) {
                    linea_actual += saltos;
                    const ultimoSalto = espacios.lastIndexOf('\n');
                    const textoDespues = espacios.substring(ultimoSalto + 1);
                    col_actual = textoDespues.length + 1;
                } else {
                    col_actual += espacios.length;
                }
                offset += espacios.length;
                continue;
            }

            for (const { tipo, regex } of this.patrones) {
                const coincidencia = subcadena.match(regex);
                if (coincidencia) {
                    const lexema_original = coincidencia[0];
                    let lexema_mostrar = lexema_original;

                    // Limpiamos los saltos de línea internos solo para la interfaz (ej. "=\n\n=" -> "==")
                    if (['OP_RELACIONAL', 'OP_LOGICO', 'OP_ARITMETICO'].includes(tipo)) {
                        lexema_mostrar = lexema_original.replace(/\s+/g, '');
                    }

                    if (tipo === 'ERR_NUM') {
                        errores.push({
                            linea: linea_actual,
                            col: col_actual,
                            tipo: 'ERROR_LÉXICO',
                            lexema: lexema_mostrar,
                            msg: 'Número malformado'
                        });
                    } else if (tipo !== 'COM_MULTI' && tipo !== 'COM_SIMPLE') {
                        tokens.push({
                            linea: linea_actual,
                            col: col_actual,
                            tipo: tipo,
                            lexema: lexema_mostrar
                        });
                    }

                    const saltosLex = (lexema_original.match(/\n/g) || []).length;
                    if (saltosLex > 0) {
                        linea_actual += saltosLex;
                        const ultimoSaltoLex = lexema_original.lastIndexOf('\n');
                        const textoDespuesLex = lexema_original.substring(ultimoSaltoLex + 1);
                        col_actual = textoDespuesLex.length + 1;
                    } else {
                        col_actual += lexema_original.length;
                    }

                    offset += lexema_original.length;
                    matched = true;
                    break;
                }
            }

            if (!matched && offset < longitud) {
                const charError = subcadena.charAt(0);
                errores.push({
                    linea: linea_actual,
                    col: col_actual,
                    tipo: 'ERROR_LÉXICO',
                    lexema: charError,
                    msg: 'Carácter inválido no reconocido'
                });
                col_actual += 1;
                offset += 1;
            }
        }

        tokens.push({
            linea: linea_actual,
            col: col_actual,
            tipo: 'EOF',
            lexema: 'EOF'
        });

        return {
            success: true,
            tokens: tokens,
            errores: errores
        };
    }
};

if (typeof window !== 'undefined') {
    window.Lexer = Lexer;
}
