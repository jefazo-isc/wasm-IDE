/**
 * IDE Indómito - Analizador Semántico basado en Árbol Sintáctico (AST)
 * Decoración de atributos semánticos de tipo y valor en cada nodo
 */

class SimboloSemantico {
    constructor(nombre, tipo, localidad = 0, lineas = null, valor = "null", ambito = "main", linea = "?") {
        this.nombre = nombre;
        this.tipo = tipo;
        this.localidad = localidad;
        this.lineas = lineas || [];
        this.valor = valor;
        this.ambito = ambito;
        this._linea_declaracion = linea;
    }

    get linea() {
        return this.lineas.length > 0 ? this.lineas[0] : this._linea_declaracion;
    }

    set linea(val) {
        this._linea_declaracion = val;
        if (!this.lineas.includes(val) && val !== "?") {
            this.lineas.unshift(val);
        }
    }

    agregar_linea(num_linea) {
        const nl = isNaN(parseInt(num_linea, 10)) ? String(num_linea) : parseInt(num_linea, 10);
        this.lineas.push(nl);
    }

    obtener_lineas_str() {
        return this.lineas.join(', ');
    }

    toTuple() {
        return [this.nombre, String(this.localidad), this.obtener_lineas_str(), this.tipo, String(this.valor)];
    }
}

class TablaSimbolosSemantico {
    constructor() {
        this._simbolos = new Map();
        this._contador_localidad = 0;
    }

    insertar(nombre, tipo, ambito = "main", linea = "?", valor = "null") {
        if (this._simbolos.has(nombre)) return false;
        const loc = this._contador_localidad++;
        const lNum = parseInt(linea, 10);
        const lineas = (!isNaN(lNum) && lNum > 0) ? [lNum] : [];
        this._simbolos.set(nombre, new SimboloSemantico(nombre, tipo, loc, lineas, valor, ambito, linea));
        return true;
    }

    buscar(nombre) {
        return this._simbolos.get(nombre) || null;
    }

    actualizar_valor(nombre, valor) {
        const s = this._simbolos.get(nombre);
        if (s) {
            s.valor = String(valor);
            return true;
        }
        return false;
    }

    obtener_todos() {
        return Array.from(this._simbolos.values()).map(s => s.toTuple());
    }

    limpiar() {
        this._simbolos.clear();
        this._contador_localidad = 0;
    }
}

class NodoASTDecorado {
    constructor(texto, tipo_dato = null, valor = null, linea = 0, columna = 0) {
        this.texto = texto;
        this.tipo_dato = tipo_dato;
        this.valor = valor;
        this.linea = linea;
        this.columna = columna;
        this.hijos = [];
    }

    agregar_hijo(nodo) {
        if (nodo) this.hijos.push(nodo);
    }

    obtener_etiqueta() {
        if (this.tipo_dato && this.valor !== null && this.valor !== undefined) {
            return `${this.texto}  [tipo: ${this.tipo_dato}, valor: ${this.valor}]`;
        } else if (this.tipo_dato) {
            return `${this.texto}  [tipo: ${this.tipo_dato}, valor: null]`;
        } else if (this.valor !== null && this.valor !== undefined) {
            return `${this.texto}  [valor: ${this.valor}]`;
        }
        return this.texto;
    }

    toTreeObject() {
        return {
            name: this.obtener_etiqueta(),
            linea: this.linea,
            columna: this.columna,
            tipo_dato: this.tipo_dato,
            valor: this.valor,
            children: this.hijos.length > 0 ? this.hijos.map(h => h.toTreeObject()) : undefined
        };
    }
}

function _sem_evaluar_a_numero(v) {
    if (v === null || v === undefined || v === "null" || v === "dinámico") return null;
    if (typeof v === "number") return v;
    const s = String(v).trim().replace(/^['"]|['"]$/g, '');
    if (s.includes('.')) {
        const val = parseFloat(s);
        return isNaN(val) ? null : val;
    }
    const val = parseInt(s, 10);
    return isNaN(val) ? null : val;
}

function _sem_formatear_resultado(res, tipo_res) {
    if (res === null || res === undefined) return "null";
    if (typeof res === "boolean") return res ? "true" : "false";
    if (tipo_res === "int") {
        return String(Math.trunc(res));
    } else if (tipo_res === "float" || tipo_res === "real") {
        const resFloat = Number(res);
        if (Number.isInteger(resFloat)) {
            return `${Math.trunc(resFloat)}.0`;
        } else {
            return String(Math.round(resFloat * 10000) / 10000);
        }
    }
    return String(res);
}

const SemanticAnalyzer = {
    analizar(codigo, astResult, tokens) {
        if (typeof codigo !== 'string') codigo = '';

        let ast = null;
        if (astResult && astResult.tree) {
            ast = astResult.tree;
        } else if (typeof Lexer !== 'undefined' && typeof Parser !== 'undefined') {
            const lex = Lexer.analizar(codigo);
            const parser = new Parser(lex.tokens);
            const res = parser.parse();
            ast = res.tree;
            tokens = lex.tokens;
        }

        const tablaSimbolos = new TablaSimbolosSemantico();
        const errores = [];
        let output = "--- ANÁLISIS SEMÁNTICO (Árbol Sintáctico Anotado) ---\n\n";

        const registrarError = (linea, columna, mensaje, idVar = '') => {
            const l = linea || 1;
            const msg = mensaje;
            if (!errores.some(e => e.linea === l && e.msg === msg)) {
                output += `Error Semántico (Línea ${l}): ${msg}\n`;
                errores.push({ linea: l, col: columna || 1, var: idVar, msg });
            }
        };

        const normalizarTipo = (tipo) => {
            const s = String(tipo || '').trim().toLowerCase();
            if (s === "int" || s === "entero") return "int";
            if (s === "float" || s === "real" || s === "decimal") return "float";
            if (s === "bool" || s === "booleano") return "bool";
            if (s === "string" || s === "cadena") return "string";
            if (s === "char" || s === "caracter" || s === "carácter") return "char";
            return s || "desconocido";
        };

        const procesarNodo = (nodo) => {
            if (!nodo) return null;

            const nombre = nodo.name || nodo.nombre || '';
            const linea = nodo.linea || 1;
            const columna = nodo.columna || nodo.col || 1;
            const hijos = nodo.children || nodo.hijos || [];

            // 1. Declaración de variables: int x, y, z;
            if (nombre === "Declaracion" || nombre === "Declaración" || nombre.startsWith("Declaración Variable")) {
                let tipo_decl = "desconocido";
                for (const h of hijos) {
                    const hName = h.name || h.nombre || '';
                    if (hName.startsWith("Tipo:")) {
                        tipo_decl = normalizarTipo(hName.replace("Tipo:", "").trim());
                        break;
                    }
                }

                const nodo_anotado = new NodoASTDecorado(`Declaración (Tipo: ${tipo_decl})`, tipo_decl, "null", linea, columna);

                for (const h of hijos) {
                    const hName = h.name || h.nombre || '';
                    const hLinea = h.linea || linea;
                    const hCol = h.columna || h.col || columna;

                    if (hName.startsWith("Tipo:")) {
                        nodo_anotado.agregar_hijo(new NodoASTDecorado(`Tipo: ${tipo_decl}`, tipo_decl, "null", hLinea, hCol));
                    } else if (hName.startsWith("Variable:") || hName.startsWith("ID:")) {
                        const var_name = hName.replace(/^(Variable:|ID:)/, "").trim();
                        const exito = tablaSimbolos.insertar(var_name, tipo_decl, "main", hLinea, "null");
                        if (!exito) {
                            const sim_existente = tablaSimbolos.buscar(var_name);
                            const prev_l = sim_existente ? sim_existente.linea : "?";
                            registrarError(hLinea, hCol, `Variable '${var_name}' ya ha sido declarada previamente (Línea ${prev_l})`, var_name);
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Variable: ${var_name}  [ERROR: Ya declarada]`, "error", "null", hLinea, hCol));
                        } else {
                            output += `Validación (Línea ${hLinea}): Variable '${var_name}' (${tipo_decl}) declarada correctamente.\n`;
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Variable: ${var_name} (declarada)`, tipo_decl, "null", hLinea, hCol));
                        }
                    }
                }
                return nodo_anotado;
            }

            // 2. Asignación: x = expr; ó x++;
            if (nombre === "Asignacion" || nombre === "Asignación" || nombre.startsWith("Asignación (=")) {
                const nodo_anotado = new NodoASTDecorado("Asignación", null, null, linea, columna);
                let var_destino = null;
                let sim_destino = null;
                let nodo_destino_anotado = null;

                for (const hijo of hijos) {
                    const hName = hijo.name || hijo.nombre || '';
                    const hLinea = hijo.linea || linea;
                    const hCol = hijo.columna || hijo.col || columna;

                    if (hName.startsWith("Destino:") || hName.startsWith("Variable:")) {
                        var_destino = hName.replace(/^(Destino:|Variable:)/, "").trim();
                        sim_destino = tablaSimbolos.buscar(var_destino);
                        if (!sim_destino) {
                            registrarError(hLinea, hCol, `Variable destino '${var_destino}' no ha sido declarada`, var_destino);
                            nodo_destino_anotado = new NodoASTDecorado(`Destino: ${var_destino}  [ERROR: No declarada]`, "error", "null", hLinea, hCol);
                        } else {
                            nodo_destino_anotado = new NodoASTDecorado(`Destino: ${var_destino}`, sim_destino.tipo, sim_destino.valor, hLinea, hCol);
                        }
                        nodo_anotado.agregar_hijo(nodo_destino_anotado);
                    } else if (hName.startsWith("Operacion:") || hName.startsWith("Incremento") || hName.startsWith("Decremento")) {
                        let op_lex = hName.replace("Operacion:", "").trim();
                        if (hName.includes("++")) op_lex = "++";
                        if (hName.includes("--")) op_lex = "--";

                        let val_nuevo = "null";
                        if (sim_destino && sim_destino.tipo !== "int" && sim_destino.tipo !== "float") {
                            registrarError(linea, columna, `Operador '${op_lex}' solo es válido para variables numéricas (no para '${sim_destino.tipo}')`, op_lex);
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Operación: ${op_lex}  [ERROR: Tipo incompatible]`, "error", "null", linea, columna));
                        } else {
                            if (sim_destino) {
                                const n_val = _sem_evaluar_a_numero(sim_destino.valor);
                                if (n_val !== null) {
                                    const n_res = (op_lex === "++") ? n_val + 1 : n_val - 1;
                                    val_nuevo = (sim_destino.tipo === "int") ? String(Math.trunc(n_res)) : _sem_formatear_resultado(n_res, "float");
                                    sim_destino.valor = val_nuevo;
                                    if (nodo_destino_anotado) nodo_destino_anotado.valor = val_nuevo;
                                }
                            }
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Operación: ${op_lex}`, sim_destino ? sim_destino.tipo : "int", val_nuevo, linea, columna));
                        }
                        nodo_anotado.tipo_dato = sim_destino ? sim_destino.tipo : "error";
                        nodo_anotado.valor = val_nuevo;
                    } else {
                        // Expresión en el lado derecho
                        const nodoExpr = (hName === "Valor" && hijo.children && hijo.children[0]) ? hijo.children[0] : hijo;
                        const nodo_expr_anotado = procesarNodo(nodoExpr);
                        nodo_anotado.agregar_hijo(nodo_expr_anotado);

                        const tipo_expr = nodo_expr_anotado ? nodo_expr_anotado.tipo_dato : null;
                        const val_expr = (nodo_expr_anotado && nodo_expr_anotado.valor !== undefined && nodo_expr_anotado.valor !== null) ? nodo_expr_anotado.valor : "null";

                        if (sim_destino && tipo_expr && tipo_expr !== "error") {
                            const tipo_dest = sim_destino.tipo;
                            if (tipo_dest === tipo_expr) {
                                nodo_anotado.tipo_dato = tipo_dest;
                                nodo_anotado.valor = val_expr;
                                sim_destino.valor = val_expr;
                                if (nodo_destino_anotado) nodo_destino_anotado.valor = val_expr;
                            } else if (tipo_dest === "float" && tipo_expr === "int") {
                                nodo_anotado.tipo_dato = "float";
                                const val_num = _sem_evaluar_a_numero(val_expr);
                                const val_prom = val_num !== null ? `${val_num}.0` : val_expr;
                                nodo_anotado.valor = val_prom;
                                sim_destino.valor = val_prom;
                                if (nodo_destino_anotado) nodo_destino_anotado.valor = val_prom;
                            } else if (tipo_dest === "int" && (tipo_expr === "float" || tipo_expr === "real")) {
                                registrarError(linea, columna, `Incompatibilidad de tipos: No se puede asignar un valor 'float' a la variable entera '${var_destino}'`, var_destino);
                                nodo_anotado.tipo_dato = "error";
                                nodo_anotado.valor = val_expr;
                                nodo_anotado.texto = `Asignación  [ERROR: Incompatibilidad int = float]`;
                                if (nodo_destino_anotado) nodo_destino_anotado.valor = val_expr;
                            } else {
                                registrarError(linea, columna, `Incompatibilidad de tipos: No se puede asignar tipo '${tipo_expr}' a variable '${var_destino}' de tipo '${tipo_dest}'`, var_destino);
                                nodo_anotado.tipo_dato = "error";
                                nodo_anotado.valor = val_expr;
                                nodo_anotado.texto = `Asignación  [ERROR: Incompatibilidad ${tipo_dest} = ${tipo_expr}]`;
                            }
                        } else if (!sim_destino) {
                            nodo_anotado.tipo_dato = "error";
                            nodo_anotado.valor = val_expr;
                        } else {
                            nodo_anotado.tipo_dato = (nodo_expr_anotado && nodo_expr_anotado.tipo_dato) || "null";
                            nodo_anotado.valor = val_expr;
                        }
                    }
                }
                return nodo_anotado;
            }

            // 3. Incremento (++) / Decremento (--) aislados
            if (nombre.startsWith("Incremento") || nombre.startsWith("Decremento")) {
                const is_inc = nombre.includes("++");
                const op = is_inc ? "++" : "--";
                let var_destino = "";
                let linea_dest = linea;

                for (const c of hijos) {
                    const cName = c.name || c.nombre || '';
                    if (cName.startsWith("Variable:") || cName.startsWith("Destino:") || cName.startsWith("ID:")) {
                        var_destino = cName.split(':')[1].trim();
                        if (c.linea > 0) linea_dest = c.linea;
                    }
                }

                const sim = tablaSimbolos.buscar(var_destino);
                const nodo_anotado = new NodoASTDecorado("Asignación", null, null, linea, columna);

                if (sim) {
                    if (sim.tipo !== "int" && sim.tipo !== "float") {
                        registrarError(linea, columna, `Operador '${op}' solo es válido para variables numéricas (no para '${sim.tipo}')`, op);
                        nodo_anotado.tipo_dato = "error";
                        nodo_anotado.valor = "null";
                        nodo_anotado.agregar_hijo(new NodoASTDecorado(`Destino: ${var_destino}`, sim.tipo, sim.valor, linea_dest, columna));
                        nodo_anotado.agregar_hijo(new NodoASTDecorado(`Operación: ${op}  [ERROR: Tipo incompatible]`, "error", "null", linea, columna));
                        return nodo_anotado;
                    }

                    let val_nuevo = "null";
                    const n_val = _sem_evaluar_a_numero(sim.valor);
                    if (n_val !== null) {
                        const n_res = is_inc ? n_val + 1 : n_val - 1;
                        val_nuevo = (sim.tipo === "int") ? String(Math.trunc(n_res)) : _sem_formatear_resultado(n_res, "float");
                        sim.valor = val_nuevo;
                    }

                    nodo_anotado.tipo_dato = sim.tipo;
                    nodo_anotado.valor = val_nuevo;
                    nodo_anotado.agregar_hijo(new NodoASTDecorado(`Destino: ${var_destino}`, sim.tipo, val_nuevo, linea_dest, columna));
                    nodo_anotado.agregar_hijo(new NodoASTDecorado(`Operación: ${op}`, sim.tipo, val_nuevo, linea, columna));
                    return nodo_anotado;
                } else {
                    registrarError(linea_dest, columna, `Variable destino '${var_destino}' no ha sido declarada`, var_destino);
                    nodo_anotado.tipo_dato = "error";
                    nodo_anotado.valor = "null";
                    nodo_anotado.agregar_hijo(new NodoASTDecorado(`Destino: ${var_destino}  [ERROR: No declarada]`, "error", "null", linea_dest, columna));
                    nodo_anotado.agregar_hijo(new NodoASTDecorado(`Operación: ${op}`, "error", "null", linea, columna));
                    return nodo_anotado;
                }
            }

            // 4. Operaciones Aritméticas (+, -, *, /, %, ^)
            if (nombre.startsWith("Op_Aritmetico:") || nombre.startsWith("Operación Aditiva") || nombre.startsWith("Operación Multiplicativa") || nombre.startsWith("Potencia")) {
                let op = '+';
                if (nombre.startsWith("Op_Aritmetico:")) {
                    op = nombre.replace("Op_Aritmetico:", "").trim();
                } else {
                    const matchOp = nombre.match(/\(([^)]+)\)/);
                    op = matchOp ? matchOp[1].trim() : (nombre.startsWith("Potencia") ? '^' : '+');
                }

                let hijosAProcesar = hijos;
                if (hijos.length === 2 && (hijos[0].name === "Izq" || hijos[0].name === "Base") && (hijos[1].name === "Der" || hijos[1].name === "Exponente")) {
                    hijosAProcesar = [
                        (hijos[0].children && hijos[0].children[0]) ? hijos[0].children[0] : hijos[0],
                        (hijos[1].children && hijos[1].children[0]) ? hijos[1].children[0] : hijos[1]
                    ];
                }

                const hijos_anotados = hijosAProcesar.map(procesarNodo);
                let tipo_res = "int";
                let val_res = "null";

                if (hijos_anotados.length === 2) {
                    const t1 = hijos_anotados[0] ? hijos_anotados[0].tipo_dato : null;
                    const t2 = hijos_anotados[1] ? hijos_anotados[1].tipo_dato : null;
                    const v1_num = _sem_evaluar_a_numero(hijos_anotados[0] ? hijos_anotados[0].valor : null);
                    const v2_num = _sem_evaluar_a_numero(hijos_anotados[1] ? hijos_anotados[1].valor : null);

                    if (op === "/" && v2_num === 0) {
                        registrarError(linea, columna, "División entre cero detectada en tiempo de compilación", "/");
                    }

                    if (t1 === "error" || t2 === "error") {
                        tipo_res = "error";
                    } else if (t1 === "string" || t1 === "bool" || t2 === "string" || t2 === "bool") {
                        registrarError(linea, columna, `Operador aritmético '${op}' no es válido para operandos de tipo '${t1}' y '${t2}'`, op);
                        tipo_res = "error";
                    } else if (op === "%") {
                        if (t1 === "int" && t2 === "int") {
                            tipo_res = "int";
                            if (v1_num !== null && v2_num !== null && v2_num !== 0) {
                                val_res = String(Math.trunc(v1_num) % Math.trunc(v2_num));
                            }
                        } else {
                            registrarError(linea, columna, `Operador módulo '%' requiere operandos enteros, no '${t1}' y '${t2}'`, "%");
                            tipo_res = "int";
                        }
                    } else {
                        if (t1 === "float" || t2 === "float" || t1 === "real" || t2 === "real") {
                            tipo_res = "float";
                        } else {
                            tipo_res = "int";
                        }

                        if (v1_num !== null && v2_num !== null && tipo_res !== "error") {
                            let res_calc = null;
                            if (op === "+") res_calc = v1_num + v2_num;
                            else if (op === "-") res_calc = v1_num - v2_num;
                            else if (op === "*") res_calc = v1_num * v2_num;
                            else if (op === "/") res_calc = (v2_num !== 0) ? v1_num / v2_num : null;
                            else if (op === "^") res_calc = Math.pow(v1_num, v2_num);

                            val_res = _sem_formatear_resultado(res_calc, tipo_res);
                        }
                    }
                } else if (hijos_anotados.length === 1) {
                    tipo_res = (hijos_anotados[0] && hijos_anotados[0].tipo_dato) || "int";
                    val_res = (hijos_anotados[0] && hijos_anotados[0].valor) || "null";
                }

                const nodo_anotado = new NodoASTDecorado(`Operador Aritmético: ${op}`, tipo_res, val_res, linea, columna);
                hijos_anotados.forEach(h => nodo_anotado.agregar_hijo(h));
                return nodo_anotado;
            }

            // 5. Operaciones Relacionales (<, >, <=, >=, ==, !=)
            if (nombre.startsWith("Op_Relacional:") || nombre.startsWith("Operación Relacional")) {
                let op = '<';
                if (nombre.startsWith("Op_Relacional:")) {
                    op = nombre.replace("Op_Relacional:", "").trim();
                } else {
                    const matchOp = nombre.match(/\(([^)]+)\)/);
                    op = matchOp ? matchOp[1].trim() : '<';
                }

                let hijosAProcesar = hijos;
                if (hijos.length === 2 && hijos[0].name === "Izq" && hijos[1].name === "Der") {
                    hijosAProcesar = [
                        (hijos[0].children && hijos[0].children[0]) ? hijos[0].children[0] : hijos[0],
                        (hijos[1].children && hijos[1].children[0]) ? hijos[1].children[0] : hijos[1]
                    ];
                }

                const hijos_anotados = hijosAProcesar.map(procesarNodo);
                let val_res = "null";

                if (hijos_anotados.length === 2) {
                    const t1 = hijos_anotados[0] ? hijos_anotados[0].tipo_dato : null;
                    const t2 = hijos_anotados[1] ? hijos_anotados[1].tipo_dato : null;
                    if (t1 && t2 && t1 !== "error" && t2 !== "error") {
                        const num1 = (t1 === "int" || t1 === "float" || t1 === "real");
                        const num2 = (t2 === "int" || t2 === "float" || t2 === "real");
                        if (num1 !== num2) {
                            registrarError(linea, columna, `Comparación relacional '${op}' entre tipos incompatibles ('${t1}' y '${t2}')`, op);
                        }
                    }
                    const v1_num = _sem_evaluar_a_numero(hijos_anotados[0] ? hijos_anotados[0].valor : null);
                    const v2_num = _sem_evaluar_a_numero(hijos_anotados[1] ? hijos_anotados[1].valor : null);
                    if (v1_num !== null && v2_num !== null) {
                        let b_val = null;
                        if (op === "<") b_val = (v1_num < v2_num);
                        else if (op === ">") b_val = (v1_num > v2_num);
                        else if (op === "<=") b_val = (v1_num <= v2_num);
                        else if (op === ">=") b_val = (v1_num >= v2_num);
                        else if (op === "==") b_val = (v1_num === v2_num);
                        else if (op === "!=") b_val = (v1_num !== v2_num);
                        val_res = (b_val !== null) ? (b_val ? "true" : "false") : "null";
                    }
                }

                const nodo_anotado = new NodoASTDecorado(`Operador Relacional: ${op}`, "bool", val_res, linea, columna);
                hijos_anotados.forEach(h => nodo_anotado.agregar_hijo(h));
                return nodo_anotado;
            }

            // 6. Operaciones Lógicas (&&, ||, !)
            if (nombre.startsWith("Op_Logica:") || nombre.startsWith("Op Lógico")) {
                let op = '&&';
                if (nombre.startsWith("Op_Logica:")) {
                    op = nombre.replace("Op_Logica:", "").trim();
                } else {
                    const matchOp = nombre.match(/\(([^)]+)\)/);
                    op = matchOp ? matchOp[1].trim() : '&&';
                }

                let hijosAProcesar = hijos;
                if (hijos.length === 2 && hijos[0].name === "Izq" && hijos[1].name === "Der") {
                    hijosAProcesar = [
                        (hijos[0].children && hijos[0].children[0]) ? hijos[0].children[0] : hijos[0],
                        (hijos[1].children && hijos[1].children[0]) ? hijos[1].children[0] : hijos[1]
                    ];
                }

                const hijos_anotados = hijosAProcesar.map(procesarNodo);
                let val_res = "null";

                for (const h of hijos_anotados) {
                    const t = h ? h.tipo_dato : null;
                    if (t && t !== "bool" && t !== "error") {
                        registrarError(linea, columna, `Operador lógico '${op}' requiere expresiones booleanas, se encontró '${t}'`, op);
                    }
                }

                if (hijos_anotados.length === 2) {
                    const v1 = String((hijos_anotados[0] && hijos_anotados[0].valor) || '').toLowerCase();
                    const v2 = String((hijos_anotados[1] && hijos_anotados[1].valor) || '').toLowerCase();
                    if ((v1 === "true" || v1 === "false") && (v2 === "true" || v2 === "false")) {
                        const b1 = (v1 === "true");
                        const b2 = (v2 === "true");
                        const b_res = (op === "&&") ? (b1 && b2) : (b1 || b2);
                        val_res = b_res ? "true" : "false";
                    }
                } else if (hijos_anotados.length === 1) {
                    const v1 = String((hijos_anotados[0] && hijos_anotados[0].valor) || '').toLowerCase();
                    if ((v1 === "true" || v1 === "false") && op === "!") {
                        val_res = (v1 === "true") ? "false" : "true";
                    }
                }

                const nodo_anotado = new NodoASTDecorado(`Operador Lógico: ${op}`, "bool", val_res, linea, columna);
                hijos_anotados.forEach(h => nodo_anotado.agregar_hijo(h));
                return nodo_anotado;
            }

            // 7. Agrupación ( ) - Transparente
            if (nombre.startsWith("Agrupación")) {
                if (hijos.length > 0) {
                    return procesarNodo(hijos[0]);
                }
            }

            // 8. Identificadores en expresiones
            if (nombre.startsWith("ID:") || nombre.startsWith("Identificador:")) {
                const var_name = nombre.replace(/^(ID:|Identificador:)/, "").trim();
                const sim = tablaSimbolos.buscar(var_name);
                if (!sim) {
                    registrarError(linea, columna, `Variable '${var_name}' no ha sido declarada`, var_name);
                    return new NodoASTDecorado(`ID: ${var_name}  [ERROR: No declarada]`, "error", "null", linea, columna);
                } else {
                    return new NodoASTDecorado(`ID: ${var_name}`, sim.tipo, sim.valor, linea, columna);
                }
            }

            // 9. Literales y Constantes
            if (nombre.startsWith("Numero:") || nombre.startsWith("Número:")) {
                const val_str = nombre.replace(/^(Numero:|Número:)/, "").trim();
                const tipo_num = val_str.includes('.') ? "float" : "int";
                return new NodoASTDecorado(`Número: ${val_str}`, tipo_num, val_str, linea, columna);
            }

            if (nombre.startsWith("Cadena:")) {
                const cad_str = nombre.replace("Cadena:", "").trim();
                return new NodoASTDecorado(`Cadena: ${cad_str}`, "string", cad_str, linea, columna);
            }

            if (nombre.startsWith("Caracter:") || nombre.startsWith("Carácter:")) {
                const car_str = nombre.replace(/^(Caracter:|Carácter:)/, "").trim();
                return new NodoASTDecorado(`Carácter: ${car_str}`, "char", car_str, linea, columna);
            }

            if (nombre.startsWith("Booleano:")) {
                const bool_str = nombre.replace("Booleano:", "").trim();
                return new NodoASTDecorado(`Booleano: ${bool_str}`, "bool", bool_str, linea, columna);
            }

            if (nombre.startsWith("Signo_Unario:") || nombre.startsWith("Op Unaria")) {
                let op = '-';
                if (nombre.startsWith("Signo_Unario:")) {
                    op = nombre.replace("Signo_Unario:", "").trim();
                } else {
                    op = nombre.includes('!') ? '!' : '-';
                }
                const primerHijo = hijos[0] ? procesarNodo(hijos[0]) : null;
                const tipo_u = primerHijo ? primerHijo.tipo_dato : "int";
                const val_u = primerHijo ? primerHijo.valor : null;
                let val_res = "null";
                if (val_u !== null && val_u !== undefined && val_u !== "null") {
                    const n_u = _sem_evaluar_a_numero(val_u);
                    if (n_u !== null) {
                        val_res = (op === "-") ? String(-n_u) : String(n_u);
                    }
                }

                const nodo_anotado = new NodoASTDecorado(`Signo Unario: ${op}`, tipo_u, val_res, linea, columna);
                if (primerHijo) nodo_anotado.agregar_hijo(primerHijo);
                return nodo_anotado;
            }

            // 10. Sentencias de Control: IF, WHILE, DO
            if (["Sentencia_IF", "Sentencia IF", "Ciclo_WHILE", "Bucle WHILE", "Ciclo_DO", "Ciclo DO", "Bucle DO-WHILE", "Bucle DO-UNTIL"].some(s => nombre.startsWith(s))) {
                let etiqueta = "Sentencia IF";
                if (nombre.includes("WHILE") && !nombre.includes("DO")) etiqueta = "Ciclo WHILE";
                else if (nombre.includes("DO")) etiqueta = "Ciclo DO";

                const nodo_anotado = new NodoASTDecorado(etiqueta, null, null, linea, columna);
                for (const h of hijos) {
                    nodo_anotado.agregar_hijo(procesarNodo(h));
                }
                return nodo_anotado;
            }

            // 11. Entrada y Salida: CIN y COUT
            if (nombre === "Entrada_CIN" || nombre.startsWith("Entrada (cin)") || nombre.startsWith("Sentencia IN")) {
                const nodo_anotado = new NodoASTDecorado("Entrada (cin)", null, null, linea, columna);
                for (const h of hijos) {
                    const hName = h.name || h.nombre || '';
                    if (hName.startsWith("Variable:") || hName.startsWith("Destino:") || hName.startsWith("ID:")) {
                        const var_name = hName.replace(/^(Variable:|Destino:|ID:)/, "").trim();
                        const sim = tablaSimbolos.buscar(var_name);
                        if (!sim) {
                            registrarError(h.linea || linea, h.columna || columna, `Variable '${var_name}' en cin no ha sido declarada`, var_name);
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Variable: ${var_name}  [ERROR: No declarada]`, "error", "null", h.linea || linea, h.columna || columna));
                        } else {
                            nodo_anotado.agregar_hijo(new NodoASTDecorado(`Variable: ${var_name}`, sim.tipo, "dinámico", h.linea || linea, h.columna || columna));
                        }
                    } else {
                        nodo_anotado.agregar_hijo(procesarNodo(h));
                    }
                }
                return nodo_anotado;
            }

            if (nombre === "Salida_COUT" || nombre.startsWith("Salida (cout)")) {
                const nodo_anotado = new NodoASTDecorado("Salida (cout)", null, null, linea, columna);
                for (const h of hijos) {
                    nodo_anotado.agregar_hijo(procesarNodo(h));
                }
                return nodo_anotado;
            }

            // 12. Bloques y Raíz: Programa, Cuerpo_Programa, etc.
            if (nombre === "Programa Principal" || nombre === "Programa") {
                let hijos_anotados = [];
                let tiene_cuerpo = false;

                for (const h of hijos) {
                    const hName = h.name || h.nombre || '';
                    if (hName === "Cuerpo_Programa") tiene_cuerpo = true;
                    hijos_anotados.push(procesarNodo(h));
                }

                if (!tiene_cuerpo) {
                    const cuerpo_nodo = new NodoASTDecorado("Cuerpo_Programa", null, null, linea, columna);
                    hijos_anotados.forEach(h => cuerpo_nodo.agregar_hijo(h));
                    const raiz = new NodoASTDecorado("Programa", null, null, linea, columna);
                    raiz.agregar_hijo(new NodoASTDecorado("Reservada: main", null, null, linea, columna));
                    raiz.agregar_hijo(cuerpo_nodo);
                    return raiz;
                } else {
                    const raiz = new NodoASTDecorado("Programa", null, null, linea, columna);
                    hijos_anotados.forEach(h => raiz.agregar_hijo(h));
                    return raiz;
                }
            }

            const nodo_anotado = new NodoASTDecorado(nombre, null, null, linea, columna);
            for (const h of hijos) {
                nodo_anotado.agregar_hijo(procesarNodo(h));
            }
            return nodo_anotado;
        };

        const astAnotadoInterno = ast ? procesarNodo(ast) : null;
        const treeResult = astAnotadoInterno ? astAnotadoInterno.toTreeObject() : null;

        if (errores.length === 0) {
            output += "\nVerificación semántica completada con éxito. Todos los tipos y variables concuerdan correctamente con el AST.\n";
        }

        return {
            success: errores.length === 0,
            output,
            errores,
            annotated_tree: treeResult,
            tree: treeResult
        };
    }
};

if (typeof window !== 'undefined') {
    window.SemanticAnalyzer = SemanticAnalyzer;
}
