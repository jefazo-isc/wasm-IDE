use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::parser::AstNode;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SemanticError {
    pub linea: usize,
    pub var: String,
    pub msg: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SemanticResult {
    pub success: bool,
    pub output: String,
    pub errores: Vec<SemanticError>,
    pub annotated_tree: Option<AstNode>,
    pub tree: Option<AstNode>,
}

#[derive(Clone, Debug, PartialEq)]
enum TipoDato {
    Int,
    Float,
    Bool,
    String,
    Char,
    Error,
    Desconocido,
}

impl TipoDato {
    fn from_str(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "int" | "entero" => TipoDato::Int,
            "float" | "real" | "decimal" => TipoDato::Float,
            "bool" | "booleano" => TipoDato::Bool,
            "string" | "cadena" => TipoDato::String,
            "char" | "caracter" | "carácter" => TipoDato::Char,
            "error" => TipoDato::Error,
            _ => TipoDato::Desconocido,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            TipoDato::Int => "int",
            TipoDato::Float => "float",
            TipoDato::Bool => "bool",
            TipoDato::String => "string",
            TipoDato::Char => "char",
            TipoDato::Error => "error",
            TipoDato::Desconocido => "desconocido",
        }
    }

    fn es_numerico(&self) -> bool {
        matches!(self, TipoDato::Int | TipoDato::Float)
    }
}

fn formatear_etiqueta(texto: &str, tipo: Option<&str>, valor: Option<&str>) -> String {
    if let (Some(t), Some(v)) = (tipo, valor) {
        format!("{}  [tipo: {}, valor: {}]", texto, t, v)
    } else if let Some(t) = tipo {
        format!("{}  [tipo: {}, valor: null]", texto, t)
    } else if let Some(v) = valor {
        format!("{}  [valor: {}]", texto, v)
    } else {
        texto.to_string()
    }
}

#[derive(Clone, Debug)]
struct Simbolo {
    #[allow(dead_code)]
    nombre: String,
    tipo: TipoDato,
    valor: String,
    linea: usize,
    #[allow(dead_code)]
    localidad: usize,
}

fn evaluar_a_numero(v: &str) -> Option<f64> {
    let s = v.trim().trim_matches(|c| c == '\'' || c == '"');
    if s.is_empty() || s == "null" || s == "dinámico" {
        return None;
    }
    s.parse::<f64>().ok()
}

fn formatear_resultado(res: f64, tipo_res: &TipoDato) -> String {
    if *tipo_res == TipoDato::Int {
        (res as i64).to_string()
    } else if *tipo_res == TipoDato::Float {
        if res.fract() == 0.0 {
            format!("{}.0", res as i64)
        } else {
            let rounded = (res * 10000.0).round() / 10000.0;
            format!("{}", rounded)
        }
    } else {
        res.to_string()
    }
}

struct AnalizadorSemantico {
    declaradas: HashMap<String, Simbolo>,
    contador_localidad: usize,
    errores: Vec<SemanticError>,
    output: String,
}

impl AnalizadorSemantico {
    fn new() -> Self {
        Self {
            declaradas: HashMap::new(),
            contador_localidad: 0,
            errores: Vec::new(),
            output: String::from("--- ANÁLISIS SEMÁNTICO (Árbol Sintáctico Anotado) ---\n\n"),
        }
    }

    fn registrar_error(&mut self, linea: usize, msg: String, var: String) {
        if !self.errores.iter().any(|e| e.linea == linea && e.msg == msg) {
            self.output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
            self.errores.push(SemanticError { linea, var, msg });
        }
    }

    fn procesar_nodo(&mut self, nodo: &AstNode) -> (AstNode, TipoDato, String) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };
        let hijos_raw = nodo.children.as_deref().unwrap_or(&[]);

        // -------------------------------------------------------------
        // 1. Declaración de variables: int x, y, z;
        // -------------------------------------------------------------
        if name.starts_with("Declaración Variable") || name == "Declaracion" || name == "Declaración" {
            let mut tipo_decl = TipoDato::Desconocido;
            for c in hijos_raw {
                if c.name.starts_with("Tipo:") {
                    let tipo_str = c.name.replacen("Tipo:", "", 1).trim().to_string();
                    tipo_decl = TipoDato::from_str(&tipo_str);
                    break;
                }
            }

            let mut hijos_anotados = Vec::new();

            for c in hijos_raw {
                let h_linea = if c.linea > 0 { c.linea } else { linea };
                if c.name.starts_with("Tipo:") {
                    hijos_anotados.push(AstNode {
                        name: format!("Tipo: {}  [tipo: {}, valor: null]", tipo_decl.as_str(), tipo_decl.as_str()),
                        linea: h_linea,
                        children: None,
                    });
                } else if c.name.starts_with("Variable:") || c.name.starts_with("ID:") {
                    let var_name = if c.name.starts_with("Variable:") {
                        c.name.replacen("Variable:", "", 1).trim().to_string()
                    } else {
                        c.name.replacen("ID:", "", 1).trim().to_string()
                    };

                    if self.declaradas.contains_key(&var_name) {
                        let prev_line = self.declaradas.get(&var_name).map(|s| s.linea).unwrap_or(h_linea);
                        let msg = format!("Variable '{}' ya ha sido declarada previamente (Línea {})", var_name, prev_line);
                        self.registrar_error(h_linea, msg, var_name.clone());
                        hijos_anotados.push(AstNode {
                            name: format!("Variable: {}  [ERROR: Ya declarada]  [tipo: error, valor: null]", var_name),
                            linea: h_linea,
                            children: None,
                        });
                    } else {
                        let loc = self.contador_localidad;
                        self.contador_localidad += 1;
                        self.declaradas.insert(
                            var_name.clone(),
                            Simbolo {
                                nombre: var_name.clone(),
                                tipo: tipo_decl.clone(),
                                valor: "null".to_string(),
                                linea: h_linea,
                                localidad: loc,
                            },
                        );
                        self.output.push_str(&format!("Validación (Línea {}): Variable '{}' ({}) declarada correctamente.\n", h_linea, var_name, tipo_decl.as_str()));
                        hijos_anotados.push(AstNode {
                            name: format!("Variable: {} (declarada)  [tipo: {}, valor: null]", var_name, tipo_decl.as_str()),
                            linea: h_linea,
                            children: None,
                        });
                    }
                }
            }

            let nodo_decl = AstNode {
                name: format!("Declaración (Tipo: {})  [tipo: {}, valor: null]", tipo_decl.as_str(), tipo_decl.as_str()),
                linea,
                children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
            };
            return (nodo_decl, tipo_decl, "null".to_string());
        }

        // -------------------------------------------------------------
        // 2. Asignación: x = expr; ó x++;
        // -------------------------------------------------------------
        if name.starts_with("Asignación") || name.starts_with("Asignacion") {
            let mut var_destino = String::new();
            let mut linea_dest = linea;
            let mut es_inc_dec = false;
            let mut op_inc_dec = String::new();
            let mut nodo_expr_opt = None;

            for c in hijos_raw {
                if c.name.starts_with("Destino:") || c.name.starts_with("Variable:") {
                    var_destino = if c.name.starts_with("Destino:") {
                        c.name.replacen("Destino:", "", 1).trim().to_string()
                    } else {
                        c.name.replacen("Variable:", "", 1).trim().to_string()
                    };
                    if c.linea > 0 { linea_dest = c.linea; }
                } else if c.name.starts_with("Operacion:") || c.name.starts_with("Incremento") || c.name.starts_with("Decremento") {
                    es_inc_dec = true;
                    if c.name.contains("++") { op_inc_dec = "++".to_string(); }
                    else if c.name.contains("--") { op_inc_dec = "--".to_string(); }
                } else {
                    if c.name == "Valor" {
                        if let Some(ch) = &c.children {
                            if let Some(first_sub) = ch.first() {
                                nodo_expr_opt = Some(first_sub);
                            }
                        }
                    } else {
                        nodo_expr_opt = Some(c);
                    }
                }
            }

            let sim_opt = self.declaradas.get(&var_destino).cloned();
            let mut hijos_anotados = Vec::new();

            // Nodo destino
            if let Some(sim) = &sim_opt {
                hijos_anotados.push(AstNode {
                    name: format!("Destino: {}  [tipo: {}, valor: {}]", var_destino, sim.tipo.as_str(), sim.valor),
                    linea: linea_dest,
                    children: None,
                });
            } else {
                let msg = format!("Variable destino '{}' no ha sido declarada", var_destino);
                self.registrar_error(linea_dest, msg, var_destino.clone());
                hijos_anotados.push(AstNode {
                    name: format!("Destino: {}  [ERROR: No declarada]  [tipo: error, valor: null]", var_destino),
                    linea: linea_dest,
                    children: None,
                });
            }

            if es_inc_dec {
                let mut val_nuevo = "null".to_string();
                let mut tipo_res = TipoDato::Error;

                if let Some(sim) = &sim_opt {
                    if !sim.tipo.es_numerico() {
                        let msg = format!("Operador '{}' solo es válido para variables numéricas (no para '{}')", op_inc_dec, sim.tipo.as_str());
                        self.registrar_error(linea, msg, op_inc_dec.clone());
                        hijos_anotados.push(AstNode {
                            name: format!("Operación: {}  [ERROR: Tipo incompatible]  [tipo: error, valor: null]", op_inc_dec),
                            linea,
                            children: None,
                        });
                    } else {
                        tipo_res = sim.tipo.clone();
                        if let Some(n_val) = evaluar_a_numero(&sim.valor) {
                            let n_res = if op_inc_dec == "++" { n_val + 1.0 } else { n_val - 1.0 };
                            val_nuevo = formatear_resultado(n_res, &sim.tipo);
                            if let Some(s) = self.declaradas.get_mut(&var_destino) {
                                s.valor = val_nuevo.clone();
                            }
                            if let Some(first) = hijos_anotados.first_mut() {
                                first.name = format!("Destino: {}  [tipo: {}, valor: {}]", var_destino, sim.tipo.as_str(), val_nuevo);
                            }
                        }
                        hijos_anotados.push(AstNode {
                            name: format!("Operación: {}  [tipo: {}, valor: {}]", op_inc_dec, sim.tipo.as_str(), val_nuevo),
                            linea,
                            children: None,
                        });
                    }
                } else {
                    hijos_anotados.push(AstNode {
                        name: format!("Operación: {}  [tipo: error, valor: null]", op_inc_dec),
                        linea,
                        children: None,
                    });
                }

                let parent_name = if tipo_res == TipoDato::Error {
                    "Asignación  [tipo: error, valor: null]".to_string()
                } else {
                    format!("Asignación  [tipo: {}, valor: {}]", tipo_res.as_str(), val_nuevo)
                };

                return (
                    AstNode {
                        name: parent_name,
                        linea,
                        children: Some(hijos_anotados),
                    },
                    tipo_res,
                    val_nuevo,
                );
            }

            // Expresión en lado derecho
            let (expr_node, tipo_expr, val_expr) = if let Some(e) = nodo_expr_opt {
                self.procesar_nodo(e)
            } else {
                (
                    AstNode { name: "Expresión Vacía".to_string(), linea, children: None },
                    TipoDato::Desconocido,
                    "null".to_string(),
                )
            };
            hijos_anotados.push(expr_node);

            let parent_name: String;
            let final_tipo: TipoDato;

            if let Some(sim) = &sim_opt {
                if tipo_expr != TipoDato::Error && tipo_expr != TipoDato::Desconocido {
                    if sim.tipo == tipo_expr {
                        final_tipo = sim.tipo.clone();
                        parent_name = format!("Asignación  [tipo: {}, valor: {}]", final_tipo.as_str(), val_expr);
                        if let Some(s) = self.declaradas.get_mut(&var_destino) {
                            s.valor = val_expr.clone();
                        }
                        if let Some(first) = hijos_anotados.first_mut() {
                            first.name = format!("Destino: {}  [tipo: {}, valor: {}]", var_destino, sim.tipo.as_str(), val_expr);
                        }
                    } else if sim.tipo == TipoDato::Float && tipo_expr == TipoDato::Int {
                        final_tipo = TipoDato::Float;
                        let val_prom = if let Some(n) = evaluar_a_numero(&val_expr) {
                            format!("{}.0", n as i64)
                        } else {
                            val_expr.clone()
                        };
                        parent_name = format!("Asignación  [tipo: float, valor: {}]", val_prom);
                        if let Some(s) = self.declaradas.get_mut(&var_destino) {
                            s.valor = val_prom.clone();
                        }
                        if let Some(first) = hijos_anotados.first_mut() {
                            first.name = format!("Destino: {}  [tipo: float, valor: {}]", var_destino, val_prom);
                        }
                    } else if sim.tipo == TipoDato::Int && tipo_expr == TipoDato::Float {
                        let msg = format!("Incompatibilidad de tipos: No se puede asignar un valor 'float' a la variable entera '{}'", var_destino);
                        self.registrar_error(linea, msg, var_destino.clone());
                        final_tipo = TipoDato::Error;
                        parent_name = format!("Asignación  [ERROR: Incompatibilidad int = float]  [tipo: error, valor: {}]", val_expr);
                        if let Some(first) = hijos_anotados.first_mut() {
                            first.name = format!("Destino: {}  [tipo: int, valor: {}]", var_destino, val_expr);
                        }
                    } else {
                        let msg = format!("Incompatibilidad de tipos: No se puede asignar tipo '{}' a variable '{}' de tipo '{}'", tipo_expr.as_str(), var_destino, sim.tipo.as_str());
                        self.registrar_error(linea, msg, var_destino.clone());
                        final_tipo = TipoDato::Error;
                        parent_name = format!("Asignación  [ERROR: Incompatibilidad {} = {}]  [tipo: error, valor: {}]", sim.tipo.as_str(), tipo_expr.as_str(), val_expr);
                    }
                } else {
                    final_tipo = TipoDato::Error;
                    parent_name = format!("Asignación  [tipo: error, valor: {}]", val_expr);
                }
            } else {
                final_tipo = TipoDato::Error;
                parent_name = format!("Asignación  [tipo: error, valor: {}]", val_expr);
            }

            return (
                AstNode {
                    name: parent_name,
                    linea,
                    children: Some(hijos_anotados),
                },
                final_tipo,
                val_expr,
            );
        }

        // -------------------------------------------------------------
        // 3. Incremento (++) / Decremento (--) aislados
        // -------------------------------------------------------------
        if name.starts_with("Incremento") || name.starts_with("Decremento") {
            let is_inc = name.contains("++");
            let op = if is_inc { "++" } else { "--" };
            let mut var_destino = String::new();
            let mut linea_dest = linea;

            for c in hijos_raw {
                if c.name.starts_with("Variable:") || c.name.starts_with("Destino:") || c.name.starts_with("ID:") {
                    var_destino = c.name.split(':').nth(1).unwrap_or("").trim().to_string();
                    if c.linea > 0 { linea_dest = c.linea; }
                }
            }

            let sim_opt = self.declaradas.get(&var_destino).cloned();
            let mut hijos_anotados = Vec::new();

            if let Some(sim) = &sim_opt {
                if !sim.tipo.es_numerico() {
                    let msg = format!("Operador '{}' solo es válido para variables numéricas (no para '{}')", op, sim.tipo.as_str());
                    self.registrar_error(linea, msg, op.to_string());
                    hijos_anotados.push(AstNode {
                        name: format!("Destino: {}  [tipo: {}, valor: {}]", var_destino, sim.tipo.as_str(), sim.valor),
                        linea: linea_dest,
                        children: None,
                    });
                    hijos_anotados.push(AstNode {
                        name: format!("Operación: {}  [ERROR: Tipo incompatible]  [tipo: error, valor: null]", op),
                        linea,
                        children: None,
                    });
                    return (
                        AstNode {
                            name: "Asignación  [tipo: error, valor: null]".to_string(),
                            linea,
                            children: Some(hijos_anotados),
                        },
                        TipoDato::Error,
                        "null".to_string(),
                    );
                }

                let mut val_nuevo = "null".to_string();
                if let Some(n_val) = evaluar_a_numero(&sim.valor) {
                    let n_res = if is_inc { n_val + 1.0 } else { n_val - 1.0 };
                    val_nuevo = formatear_resultado(n_res, &sim.tipo);
                    if let Some(s) = self.declaradas.get_mut(&var_destino) {
                        s.valor = val_nuevo.clone();
                    }
                }

                hijos_anotados.push(AstNode {
                    name: format!("Destino: {}  [tipo: {}, valor: {}]", var_destino, sim.tipo.as_str(), val_nuevo),
                    linea: linea_dest,
                    children: None,
                });
                hijos_anotados.push(AstNode {
                    name: format!("Operación: {}  [tipo: {}, valor: {}]", op, sim.tipo.as_str(), val_nuevo),
                    linea,
                    children: None,
                });

                return (
                    AstNode {
                        name: format!("Asignación  [tipo: {}, valor: {}]", sim.tipo.as_str(), val_nuevo),
                        linea,
                        children: Some(hijos_anotados),
                    },
                    sim.tipo.clone(),
                    val_nuevo,
                );
            } else {
                let msg = format!("Variable destino '{}' no ha sido declarada", var_destino);
                self.registrar_error(linea_dest, msg, var_destino.clone());
                hijos_anotados.push(AstNode {
                    name: format!("Destino: {}  [ERROR: No declarada]  [tipo: error, valor: null]", var_destino),
                    linea: linea_dest,
                    children: None,
                });
                hijos_anotados.push(AstNode {
                    name: format!("Operación: {}  [tipo: error, valor: null]", op),
                    linea,
                    children: None,
                });
                return (
                    AstNode {
                        name: "Asignación  [tipo: error, valor: null]".to_string(),
                        linea,
                        children: Some(hijos_anotados),
                    },
                    TipoDato::Error,
                    "null".to_string(),
                );
            }
        }

        // -------------------------------------------------------------
        // 4. Operaciones Aritméticas (+, -, *, /, %, ^)
        // -------------------------------------------------------------
        if name.starts_with("Op_Aritmetico:") || name.starts_with("Operación Aditiva") || name.starts_with("Operación Multiplicativa") || name.starts_with("Potencia") {
            let op = if name.starts_with("Op_Aritmetico:") {
                name.replacen("Op_Aritmetico:", "", 1).trim().to_string()
            } else if let Some(start) = name.find('(') {
                if let Some(end) = name.find(')') {
                    name[start + 1..end].trim().to_string()
                } else {
                    "+".to_string()
                }
            } else if name.starts_with("Potencia") {
                "^".to_string()
            } else {
                "+".to_string()
            };

            let mut hijos_a_procesar = Vec::new();
            if hijos_raw.len() == 2 && (hijos_raw[0].name == "Izq" || hijos_raw[0].name == "Base") && (hijos_raw[1].name == "Der" || hijos_raw[1].name == "Exponente") {
                if let Some(ch0) = &hijos_raw[0].children {
                    if let Some(f0) = ch0.first() { hijos_a_procesar.push(f0); }
                }
                if let Some(ch1) = &hijos_raw[1].children {
                    if let Some(f1) = ch1.first() { hijos_a_procesar.push(f1); }
                }
            } else {
                for h in hijos_raw {
                    hijos_a_procesar.push(h);
                }
            }

            let mut hijos_anotados = Vec::new();
            let mut tipos_hijos = Vec::new();
            let mut vals_hijos = Vec::new();

            for h in &hijos_a_procesar {
                let (h_node, h_tipo, h_val) = self.procesar_nodo(h);
                tipos_hijos.push(h_tipo);
                vals_hijos.push(h_val);
                hijos_anotados.push(h_node);
            }

            let mut tipo_res = TipoDato::Int;
            let mut val_res = "null".to_string();

            if hijos_anotados.len() == 2 {
                let t1 = &tipos_hijos[0];
                let t2 = &tipos_hijos[1];
                let v1_num = evaluar_a_numero(&vals_hijos[0]);
                let v2_num = evaluar_a_numero(&vals_hijos[1]);

                if op == "/" && v2_num == Some(0.0) {
                    self.registrar_error(linea, "División entre cero detectada en tiempo de compilación".to_string(), "/".to_string());
                }

                if *t1 == TipoDato::Error || *t2 == TipoDato::Error {
                    tipo_res = TipoDato::Error;
                } else if *t1 == TipoDato::String || *t1 == TipoDato::Bool || *t2 == TipoDato::String || *t2 == TipoDato::Bool {
                    let msg = format!("Operador aritmético '{}' no es válido para operandos de tipo '{}' y '{}'", op, t1.as_str(), t2.as_str());
                    self.registrar_error(linea, msg, op.clone());
                    tipo_res = TipoDato::Error;
                } else if op == "%" {
                    if *t1 == TipoDato::Int && *t2 == TipoDato::Int {
                        tipo_res = TipoDato::Int;
                        if let (Some(n1), Some(n2)) = (v1_num, v2_num) {
                            if n2 != 0.0 {
                                val_res = ((n1 as i64) % (n2 as i64)).to_string();
                            }
                        }
                    } else {
                        let msg = format!("Operador módulo '%' requiere operandos enteros, no '{}' y '{}'", t1.as_str(), t2.as_str());
                        self.registrar_error(linea, msg, "%".to_string());
                        tipo_res = TipoDato::Int;
                    }
                } else {
                    if *t1 == TipoDato::Float || *t2 == TipoDato::Float {
                        tipo_res = TipoDato::Float;
                    } else {
                        tipo_res = TipoDato::Int;
                    }

                    if let (Some(n1), Some(n2)) = (v1_num, v2_num) {
                        let res_calc_opt = match op.as_str() {
                            "+" => Some(n1 + n2),
                            "-" => Some(n1 - n2),
                            "*" => Some(n1 * n2),
                            "/" => if n2 != 0.0 { Some(n1 / n2) } else { None },
                            "^" => Some(n1.powf(n2)),
                            _ => None,
                        };
                        if let Some(res_calc) = res_calc_opt {
                            val_res = formatear_resultado(res_calc, &tipo_res);
                        }
                    }
                }
            } else if hijos_anotados.len() == 1 {
                tipo_res = tipos_hijos[0].clone();
                val_res = vals_hijos[0].clone();
            }

            let node_name = formatear_etiqueta(
                &format!("Operador Aritmético: {}", op),
                Some(tipo_res.as_str()),
                Some(&val_res),
            );

            return (
                AstNode {
                    name: node_name,
                    linea,
                    children: Some(hijos_anotados),
                },
                tipo_res,
                val_res,
            );
        }

        // -------------------------------------------------------------
        // 5. Operaciones Relacionales (<, >, <=, >=, ==, !=)
        // -------------------------------------------------------------
        if name.starts_with("Op_Relacional:") || name.starts_with("Operación Relacional") {
            let op = if name.starts_with("Op_Relacional:") {
                name.replacen("Op_Relacional:", "", 1).trim().to_string()
            } else if let Some(start) = name.find('(') {
                if let Some(end) = name.find(')') {
                    name[start + 1..end].trim().to_string()
                } else {
                    "<".to_string()
                }
            } else {
                "<".to_string()
            };

            let mut hijos_a_procesar = Vec::new();
            if hijos_raw.len() == 2 && hijos_raw[0].name == "Izq" && hijos_raw[1].name == "Der" {
                if let Some(ch0) = &hijos_raw[0].children {
                    if let Some(f0) = ch0.first() { hijos_a_procesar.push(f0); }
                }
                if let Some(ch1) = &hijos_raw[1].children {
                    if let Some(f1) = ch1.first() { hijos_a_procesar.push(f1); }
                }
            } else {
                for h in hijos_raw {
                    hijos_a_procesar.push(h);
                }
            }

            let mut hijos_anotados = Vec::new();
            let mut tipos_hijos = Vec::new();
            let mut vals_hijos = Vec::new();

            for h in &hijos_a_procesar {
                let (h_node, h_tipo, h_val) = self.procesar_nodo(h);
                tipos_hijos.push(h_tipo);
                vals_hijos.push(h_val);
                hijos_anotados.push(h_node);
            }

            let mut val_res = "null".to_string();

            if hijos_anotados.len() == 2 {
                let t1 = &tipos_hijos[0];
                let t2 = &tipos_hijos[1];
                if *t1 != TipoDato::Error && *t2 != TipoDato::Error {
                    if t1.es_numerico() != t2.es_numerico() {
                        let msg = format!("Comparación relacional '{}' entre tipos incompatibles ('{}' y '{}')", op, t1.as_str(), t2.as_str());
                        self.registrar_error(linea, msg, op.clone());
                    }
                }
                let v1_num = evaluar_a_numero(&vals_hijos[0]);
                let v2_num = evaluar_a_numero(&vals_hijos[1]);

                if let (Some(n1), Some(n2)) = (v1_num, v2_num) {
                    let b_val = match op.as_str() {
                        "<" => n1 < n2,
                        ">" => n1 > n2,
                        "<=" => n1 <= n2,
                        ">=" => n1 >= n2,
                        "==" => n1 == n2,
                        "!=" => n1 != n2,
                        _ => false,
                    };
                    val_res = if b_val { "true".to_string() } else { "false".to_string() };
                }
            }

            let node_name = formatear_etiqueta(
                &format!("Operador Relacional: {}", op),
                Some("bool"),
                Some(&val_res),
            );

            return (
                AstNode {
                    name: node_name,
                    linea,
                    children: Some(hijos_anotados),
                },
                TipoDato::Bool,
                val_res,
            );
        }

        // -------------------------------------------------------------
        // 6. Operaciones Lógicas (&&, ||, !)
        // -------------------------------------------------------------
        if name.starts_with("Op_Logica:") || name.starts_with("Op Lógico") {
            let op = if name.starts_with("Op_Logica:") {
                name.replacen("Op_Logica:", "", 1).trim().to_string()
            } else if let Some(start) = name.find('(') {
                if let Some(end) = name.find(')') {
                    name[start + 1..end].trim().to_string()
                } else {
                    "&&".to_string()
                }
            } else {
                "&&".to_string()
            };

            let mut hijos_a_procesar = Vec::new();
            if hijos_raw.len() == 2 && hijos_raw[0].name == "Izq" && hijos_raw[1].name == "Der" {
                if let Some(ch0) = &hijos_raw[0].children {
                    if let Some(f0) = ch0.first() { hijos_a_procesar.push(f0); }
                }
                if let Some(ch1) = &hijos_raw[1].children {
                    if let Some(f1) = ch1.first() { hijos_a_procesar.push(f1); }
                }
            } else {
                for h in hijos_raw {
                    hijos_a_procesar.push(h);
                }
            }

            let mut hijos_anotados = Vec::new();
            let mut tipos_hijos = Vec::new();
            let mut vals_hijos = Vec::new();

            for h in &hijos_a_procesar {
                let (h_node, h_tipo, h_val) = self.procesar_nodo(h);
                if h_tipo != TipoDato::Bool && h_tipo != TipoDato::Error {
                    let msg = format!("Operador lógico '{}' requiere expresiones booleanas, se encontró '{}'", op, h_tipo.as_str());
                    self.registrar_error(linea, msg, op.clone());
                }
                tipos_hijos.push(h_tipo);
                vals_hijos.push(h_val);
                hijos_anotados.push(h_node);
            }

            let mut val_res = "null".to_string();

            if hijos_anotados.len() == 2 {
                let v1 = vals_hijos[0].to_lowercase();
                let v2 = vals_hijos[1].to_lowercase();
                if (v1 == "true" || v1 == "false") && (v2 == "true" || v2 == "false") {
                    let b1 = v1 == "true";
                    let b2 = v2 == "true";
                    let b_res = if op == "&&" { b1 && b2 } else { b1 || b2 };
                    val_res = if b_res { "true".to_string() } else { "false".to_string() };
                }
            } else if hijos_anotados.len() == 1 {
                let v1 = vals_hijos[0].to_lowercase();
                if (v1 == "true" || v1 == "false") && op == "!" {
                    let b1 = v1 == "true";
                    val_res = if !b1 { "true".to_string() } else { "false".to_string() };
                }
            }

            let node_name = formatear_etiqueta(
                &format!("Operador Lógico: {}", op),
                Some("bool"),
                Some(&val_res),
            );

            return (
                AstNode {
                    name: node_name,
                    linea,
                    children: Some(hijos_anotados),
                },
                TipoDato::Bool,
                val_res,
            );
        }

        // -------------------------------------------------------------
        // 7. Agrupación ( ) - Transparente
        // -------------------------------------------------------------
        if name.starts_with("Agrupación") {
            if let Some(primer_hijo) = hijos_raw.first() {
                return self.procesar_nodo(primer_hijo);
            }
        }

        // -------------------------------------------------------------
        // 8. Identificadores en expresiones
        // -------------------------------------------------------------
        if name.starts_with("ID:") || name.starts_with("Identificador:") {
            let var_name = name.replacen("ID:", "", 1).replacen("Identificador:", "", 1).trim().to_string();
            if let Some(sim) = self.declaradas.get(&var_name).cloned() {
                let node_name = formatear_etiqueta(
                    &format!("ID: {}", var_name),
                    Some(sim.tipo.as_str()),
                    Some(&sim.valor),
                );
                return (
                    AstNode { name: node_name, linea, children: None },
                    sim.tipo,
                    sim.valor,
                );
            } else {
                let msg = format!("Variable '{}' no ha sido declarada", var_name);
                self.registrar_error(linea, msg, var_name.clone());
                let node_name = format!("ID: {}  [ERROR: No declarada]  [tipo: error, valor: null]", var_name);
                return (
                    AstNode { name: node_name, linea, children: None },
                    TipoDato::Error,
                    "null".to_string(),
                );
            }
        }

        // -------------------------------------------------------------
        // 9. Literales y Constantes
        // -------------------------------------------------------------
        if name.starts_with("Numero:") || name.starts_with("Número:") {
            let val_str = name.replacen("Numero:", "", 1).replacen("Número:", "", 1).trim().to_string();
            let tipo = if val_str.contains('.') { TipoDato::Float } else { TipoDato::Int };
            let node_name = formatear_etiqueta(
                &format!("Número: {}", val_str),
                Some(tipo.as_str()),
                Some(&val_str),
            );
            return (
                AstNode { name: node_name, linea, children: None },
                tipo,
                val_str,
            );
        }

        if name.starts_with("Cadena:") {
            let val_str = name.replacen("Cadena:", "", 1).trim().to_string();
            let node_name = formatear_etiqueta(
                &format!("Cadena: {}", val_str),
                Some("string"),
                Some(&val_str),
            );
            return (
                AstNode { name: node_name, linea, children: None },
                TipoDato::String,
                val_str,
            );
        }

        if name.starts_with("Caracter:") || name.starts_with("Carácter:") {
            let val_str = name.replacen("Caracter:", "", 1).replacen("Carácter:", "", 1).trim().to_string();
            let node_name = formatear_etiqueta(
                &format!("Carácter: {}", val_str),
                Some("char"),
                Some(&val_str),
            );
            return (
                AstNode { name: node_name, linea, children: None },
                TipoDato::Char,
                val_str,
            );
        }

        if name.starts_with("Booleano:") {
            let val_str = name.replacen("Booleano:", "", 1).trim().to_string();
            let node_name = formatear_etiqueta(
                &format!("Booleano: {}", val_str),
                Some("bool"),
                Some(&val_str),
            );
            return (
                AstNode { name: node_name, linea, children: None },
                TipoDato::Bool,
                val_str,
            );
        }

        if name.starts_with("Signo_Unario:") || name.starts_with("Op Unaria") {
            let op = if name.contains('-') { "-" } else { "+" };
            let (h_node, h_tipo, h_val) = if let Some(first_sub) = hijos_raw.first() {
                self.procesar_nodo(first_sub)
            } else {
                (AstNode { name: "Exp".to_string(), linea, children: None }, TipoDato::Int, "null".to_string())
            };

            let mut val_res = "null".to_string();
            if let Some(n) = evaluar_a_numero(&h_val) {
                let n_u = if op == "-" { -n } else { n };
                val_res = formatear_resultado(n_u, &h_tipo);
            }

            let node_name = formatear_etiqueta(
                &format!("Signo Unario: {}", op),
                Some(h_tipo.as_str()),
                Some(&val_res),
            );

            return (
                AstNode {
                    name: node_name,
                    linea,
                    children: Some(vec![h_node]),
                },
                h_tipo,
                val_res,
            );
        }

        // -------------------------------------------------------------
        // 10. Sentencias de Control: IF, WHILE, DO
        // -------------------------------------------------------------
        if name.starts_with("Sentencia_IF") || name.starts_with("Sentencia IF")
            || name.starts_with("Ciclo_WHILE") || name.starts_with("Bucle WHILE")
            || name.starts_with("Ciclo_DO") || name.starts_with("Ciclo DO")
            || name.starts_with("Bucle DO-")
        {
            let etiqueta = if name.contains("WHILE") && !name.contains("DO") {
                "Ciclo WHILE"
            } else if name.contains("DO") {
                "Ciclo DO"
            } else {
                "Sentencia IF"
            };

            let mut hijos_anotados = Vec::new();
            for h in hijos_raw {
                let (h_proc, _, _) = self.procesar_nodo(h);
                hijos_anotados.push(h_proc);
            }

            return (
                AstNode {
                    name: etiqueta.to_string(),
                    linea,
                    children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
                },
                TipoDato::Desconocido,
                "null".to_string(),
            );
        }

        // -------------------------------------------------------------
        // 11. Entrada y Salida: CIN y COUT
        // -------------------------------------------------------------
        if name.starts_with("Entrada_CIN") || name.starts_with("Entrada (cin)") || name.starts_with("Sentencia IN") {
            let mut hijos_anotados = Vec::new();
            for h in hijos_raw {
                if h.name.starts_with("Variable:") || h.name.starts_with("Destino:") || h.name.starts_with("ID:") {
                    let var_name = h.name.split(':').nth(1).unwrap_or("").trim().to_string();
                    let h_linea = if h.linea > 0 { h.linea } else { linea };
                    if let Some(sim) = self.declaradas.get(&var_name) {
                        hijos_anotados.push(AstNode {
                            name: format!("Variable: {}  [tipo: {}, valor: dinámico]", var_name, sim.tipo.as_str()),
                            linea: h_linea,
                            children: None,
                        });
                    } else {
                        let msg = format!("Variable '{}' en cin no ha sido declarada", var_name);
                        self.registrar_error(h_linea, msg, var_name.clone());
                        hijos_anotados.push(AstNode {
                            name: format!("Variable: {}  [ERROR: No declarada]  [tipo: error, valor: null]", var_name),
                            linea: h_linea,
                            children: None,
                        });
                    }
                } else {
                    let (h_proc, _, _) = self.procesar_nodo(h);
                    hijos_anotados.push(h_proc);
                }
            }

            return (
                AstNode {
                    name: "Entrada (cin)".to_string(),
                    linea,
                    children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
                },
                TipoDato::Desconocido,
                "null".to_string(),
            );
        }

        if name.starts_with("Salida_COUT") || name.starts_with("Salida (cout)") {
            let mut hijos_anotados = Vec::new();
            for h in hijos_raw {
                let (h_proc, _, _) = self.procesar_nodo(h);
                hijos_anotados.push(h_proc);
            }
            return (
                AstNode {
                    name: "Salida (cout)".to_string(),
                    linea,
                    children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
                },
                TipoDato::Desconocido,
                "null".to_string(),
            );
        }

        // -------------------------------------------------------------
        // 12. Bloques y Raíz: Programa, Cuerpo_Programa, etc.
        // -------------------------------------------------------------
        if name == "Programa Principal" || name == "Programa" {
            // Si los hijos no tienen Cuerpo_Programa, envolverlos
            let mut hijos_anotados = Vec::new();
            let mut tiene_cuerpo = false;

            for h in hijos_raw {
                if h.name == "Cuerpo_Programa" {
                    tiene_cuerpo = true;
                }
                let (h_proc, _, _) = self.procesar_nodo(h);
                hijos_anotados.push(h_proc);
            }

            if !tiene_cuerpo {
                let cuerpo_node = AstNode {
                    name: "Cuerpo_Programa".to_string(),
                    linea,
                    children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
                };
                return (
                    AstNode {
                        name: "Programa".to_string(),
                        linea,
                        children: Some(vec![
                            AstNode {
                                name: "Reservada: main".to_string(),
                                linea,
                                children: None,
                            },
                            cuerpo_node,
                        ]),
                    },
                    TipoDato::Desconocido,
                    "null".to_string(),
                );
            } else {
                return (
                    AstNode {
                        name: "Programa".to_string(),
                        linea,
                        children: Some(hijos_anotados),
                    },
                    TipoDato::Desconocido,
                    "null".to_string(),
                );
            }
        }

        let mut hijos_anotados = Vec::new();
        for h in hijos_raw {
            let (h_proc, _, _) = self.procesar_nodo(h);
            hijos_anotados.push(h_proc);
        }

        (
            AstNode {
                name: name.clone(),
                linea,
                children: if hijos_anotados.is_empty() { None } else { Some(hijos_anotados) },
            },
            TipoDato::Desconocido,
            "null".to_string(),
        )
    }
}

pub fn analizar_con_ast(_codigo: &str, ast_root: Option<&AstNode>) -> SemanticResult {
    let mut analizador = AnalizadorSemantico::new();

    let annotated_tree = ast_root.map(|ast| analizador.procesar_nodo(ast).0);

    if analizador.errores.is_empty() {
        analizador.output.push_str("\nVerificación semántica completada con éxito. Todos los tipos y variables concuerdan correctamente con el AST.\n");
    }

    SemanticResult {
        success: analizador.errores.is_empty(),
        output: analizador.output,
        errores: analizador.errores,
        annotated_tree: annotated_tree.clone(),
        tree: annotated_tree,
    }
}
