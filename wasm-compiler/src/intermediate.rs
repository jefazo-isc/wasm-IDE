use crate::parser::{self, AstNode};
use crate::lexer;

struct CodeGen {
    temp_counter: usize,
    label_counter: usize,
    output: String,
}

impl CodeGen {
    fn new() -> Self {
        Self {
            temp_counter: 1,
            label_counter: 1,
            output: String::from("--- GENERACIÓN DE CÓDIGO INTERMEDIO (3 Direcciones - Basado en AST) ---\n\n"),
        }
    }

    /// newtemp(): Genera secuencialmente t1, t2, t3, ... para resultados intermedios
    fn new_temp(&mut self) -> String {
        let t = format!("t{}", self.temp_counter);
        self.temp_counter += 1;
        t
    }

    /// newlabel(): Genera etiquetas secuenciales L1, L2, L3, ... para estructuras de control y saltos
    fn new_label(&mut self) -> String {
        let l = format!("L{}", self.label_counter);
        self.label_counter += 1;
        l
    }

    fn emit(&mut self, s: &str) {
        self.output.push_str(s);
        self.output.push('\n');
    }

    /// Recorrido en Postorden del subárbol de expresiones
    /// Estructura fundamental: x = y op z o copias x = y
    fn generar_expresion(&mut self, nodo: &AstNode) -> String {
        let name = &nodo.name;

        // 1. Constantes y Variables (Hojas)
        if name.starts_with("Número: ") {
            return name.replacen("Número: ", "", 1).trim().to_string();
        }

        if name.starts_with("Booleano: ") {
            return name.replacen("Booleano: ", "", 1).trim().to_string();
        }

        if name.starts_with("Identificador: ") {
            return name.replacen("Identificador: ", "", 1).trim().to_string();
        }

        // 2. Agrupación ( )
        if name.starts_with("Agrupación") {
            if let Some(children) = &nodo.children {
                if let Some(child) = children.first() {
                    return self.generar_expresion(child);
                }
            }
            return String::new();
        }

        // 3. Operación Unaria (!, -, ++, --)
        if name.starts_with("Op Unaria") {
            if let Some(children) = &nodo.children {
                if let Some(hijo) = children.first() {
                    let operando = self.generar_expresion(hijo);
                    let temp = self.new_temp();
                    if name.contains("!") {
                        self.emit(&format!("{} = !{}", temp, operando));
                    } else if name.contains("-") {
                        self.emit(&format!("{} = -{}", temp, operando));
                    } else if name.contains("++") {
                        self.emit(&format!("{} = {} + 1", temp, operando));
                    } else if name.contains("--") {
                        self.emit(&format!("{} = {} - 1", temp, operando));
                    }
                    return temp;
                }
            }
            return String::new();
        }

        // 4. Operaciones Binarias (Aritméticas, Relacionales y Lógicas)
        let mut op_simbolo = "";
        if name.starts_with("Operación Aditiva") {
            if name.contains('+') { op_simbolo = "+"; } else { op_simbolo = "-"; }
        } else if name.starts_with("Operación Multiplicativa") {
            if name.contains('*') { op_simbolo = "*"; }
            else if name.contains('/') { op_simbolo = "/"; }
            else if name.contains('%') { op_simbolo = "%"; }
        } else if name.starts_with("Potencia") {
            op_simbolo = "^";
        } else if name.starts_with("Operación Relacional") {
            if name.contains("<=") { op_simbolo = "<="; }
            else if name.contains(">=") { op_simbolo = ">="; }
            else if name.contains("==") { op_simbolo = "=="; }
            else if name.contains("!=") { op_simbolo = "!="; }
            else if name.contains('<') { op_simbolo = "<"; }
            else if name.contains('>') { op_simbolo = ">"; }
        } else if name.starts_with("Op Lógico") {
            if name.contains("&&") { op_simbolo = "&&"; }
            else if name.contains("||") { op_simbolo = "||"; }
        }

        if !op_simbolo.is_empty() {
            let mut arg1 = String::new();
            let mut arg2 = String::new();

            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name == "Izq" || c.name == "Base" {
                        if let Some(gc) = &c.children {
                            if let Some(sub) = gc.first() {
                                arg1 = self.generar_expresion(sub);
                            }
                        }
                    } else if c.name == "Der" || c.name == "Exponente" {
                        if let Some(gc) = &c.children {
                            if let Some(sub) = gc.first() {
                                arg2 = self.generar_expresion(sub);
                            }
                        }
                    }
                }
            }

            // Forma fundamental de 3 direcciones: x = y op z
            let temp = self.new_temp();
            self.emit(&format!("{} = {} {} {}", temp, arg1, op_simbolo, arg2));
            return temp;
        }

        String::new()
    }

    /// Recorrido de Sentencias del AST y generación de saltos condicionales
    fn generar_sentencia(&mut self, nodo: &AstNode) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        // 1. Asignación: x = y o x = t_n
        if name.starts_with("Asignación") {
            if let Some(children) = &nodo.children {
                let mut destino = String::new();
                for c in children {
                    if c.name.starts_with("Variable: ") {
                        destino = c.name.replacen("Variable: ", "", 1).trim().to_string();
                    }
                }

                for c in children {
                    if c.name == "Valor" {
                        if let Some(vals) = &c.children {
                            if let Some(exp_node) = vals.first() {
                                self.emit(&format!("; Línea {}", linea));
                                let valor = self.generar_expresion(exp_node);
                                // Instrucción de copia: x = y
                                self.emit(&format!("{} = {}\n", destino, valor));
                            }
                        }
                    }
                }
            }
            return;
        }

        // 2. Incremento / Decremento
        if name.starts_with("Incremento") || name.starts_with("Decremento") {
            let op = if name.contains("++") { "+" } else { "-" };
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("Variable: ") {
                        let var_id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                        let temp = self.new_temp();
                        self.emit(&format!("; Línea {}", linea));
                        self.emit(&format!("{} = {} {} 1", temp, var_id, op));
                        self.emit(&format!("{} = {}\n", var_id, temp));
                    }
                }
            }
            return;
        }

        // 3. Sentencia IN (cin)
        if name.starts_with("Sentencia IN") {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("ID: ") {
                        let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                        self.emit(&format!("; Línea {}", linea));
                        self.emit(&format!("READ {}\n", id));
                    }
                }
            }
            return;
        }

        // 4. Sentencia OUT (cout)
        if name.starts_with("Salida (cout)") {
            if let Some(children) = &nodo.children {
                self.emit(&format!("; Línea {}", linea));
                for c in children {
                    if c.name.starts_with("Cadena: ") {
                        let cad = c.name.replacen("Cadena: ", "", 1);
                        self.emit(&format!("WRITE {}", cad));
                    } else {
                        let val = self.generar_expresion(c);
                        self.emit(&format!("WRITE {}", val));
                    }
                }
                self.emit("");
            }
            return;
        }

        // 5. Sentencia IF (con o sin ELSE)
        if name.starts_with("Sentencia IF") {
            let l_else = self.new_label();
            let l_end = self.new_label();
            let mut tiene_else = false;

            self.emit(&format!("; Estructura IF (Línea {})", linea));

            if let Some(children) = &nodo.children {
                // Condición
                for c in children {
                    if c.name == "Condición" {
                        if let Some(cond_nodes) = &c.children {
                            if let Some(cond_exp) = cond_nodes.first() {
                                let cond_res = self.generar_expresion(cond_exp);
                                self.emit(&format!("if_false {} goto {}", cond_res, l_else));
                            }
                        }
                    }
                }

                // THEN
                for c in children {
                    if c.name == "Bloque THEN" {
                        if let Some(then_stmts) = &c.children {
                            for s in then_stmts {
                                self.generar_sentencia(s);
                            }
                        }
                    }
                }

                // Revisar si hay ELSE
                for c in children {
                    if c.name == "Bloque ELSE" {
                        tiene_else = true;
                    }
                }

                if tiene_else {
                    self.emit(&format!("goto {}", l_end));
                    self.emit(&format!("{}:", l_else));
                    for c in children {
                        if c.name == "Bloque ELSE" {
                            if let Some(else_stmts) = &c.children {
                                for s in else_stmts {
                                    self.generar_sentencia(s);
                                }
                            }
                        }
                    }
                    self.emit(&format!("{}:\n", l_end));
                } else {
                    self.emit(&format!("{}:\n", l_else));
                }
            }
            return;
        }

        // 6. Bucle WHILE
        if name.starts_with("Bucle WHILE") {
            let l_start = self.new_label();
            let l_end = self.new_label();

            self.emit(&format!("; Bucle WHILE (Línea {})", linea));
            self.emit(&format!("{}:", l_start));

            if let Some(children) = &nodo.children {
                // Condición
                for c in children {
                    if c.name == "Condición" {
                        if let Some(cond_nodes) = &c.children {
                            if let Some(cond_exp) = cond_nodes.first() {
                                let cond_res = self.generar_expresion(cond_exp);
                                self.emit(&format!("if_false {} goto {}", cond_res, l_end));
                            }
                        }
                    }
                }

                // Cuerpo
                for c in children {
                    if c.name == "Cuerpo" {
                        if let Some(cuerpo_stmts) = &c.children {
                            for s in cuerpo_stmts {
                                self.generar_sentencia(s);
                            }
                        }
                    }
                }
            }

            self.emit(&format!("goto {}", l_start));
            self.emit(&format!("{}:\n", l_end));
            return;
        }

        // 7. Bucle DO-UNTIL / DO-WHILE
        if name.starts_with("Bucle DO-") {
            let l_start = self.new_label();
            let es_until = name.contains("UNTIL");

            self.emit(&format!("; {} (Línea {})", name, linea));
            self.emit(&format!("{}:", l_start));

            if let Some(children) = &nodo.children {
                // Cuerpo
                for c in children {
                    if c.name == "Cuerpo" {
                        if let Some(cuerpo_stmts) = &c.children {
                            for s in cuerpo_stmts {
                                self.generar_sentencia(s);
                            }
                        }
                    }
                }

                // Condición
                for c in children {
                    if c.name == "Condición" {
                        if let Some(cond_nodes) = &c.children {
                            if let Some(cond_exp) = cond_nodes.first() {
                                let cond_res = self.generar_expresion(cond_exp);
                                if es_until {
                                    // until se repite MIENTRAS sea falso (sale cuando es verdadero)
                                    self.emit(&format!("if_false {} goto {}\n", cond_res, l_start));
                                } else {
                                    // while se repite MIENTRAS sea verdadero
                                    self.emit(&format!("if {} goto {}\n", cond_res, l_start));
                                }
                            }
                        }
                    }
                }
            }
            return;
        }

        // Recorrer hijos generales
        if let Some(children) = &nodo.children {
            for child in children {
                self.generar_sentencia(child);
            }
        }
    }
}

pub fn generar(codigo: &str) -> String {
    let result_lexer = lexer::analizar(codigo);
    let mut p = parser::Parser::new(result_lexer.tokens);
    let result_parser = p.parse();

    if let Some(ast) = result_parser.tree.as_ref() {
        let mut gen = CodeGen::new();
        gen.generar_sentencia(ast);
        gen.output.push_str("; Generación finalizada exitosamente.\n");
        return gen.output;
    }

    String::from("Error: No se pudo generar el Árbol de Sintaxis Abstracta (AST) para el código intermedio.\n")
}
