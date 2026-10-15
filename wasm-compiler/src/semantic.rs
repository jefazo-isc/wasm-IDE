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
}

#[derive(Clone, Debug, PartialEq)]
enum TipoDato {
    Int,
    Float,
    Bool,
    Desconocido,
}

impl TipoDato {
    fn from_str(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "int" | "entero" => TipoDato::Int,
            "float" | "real" => TipoDato::Float,
            "bool" | "booleano" => TipoDato::Bool,
            _ => TipoDato::Desconocido,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            TipoDato::Int => "int",
            TipoDato::Float => "float",
            TipoDato::Bool => "bool",
            TipoDato::Desconocido => "desconocido",
        }
    }

    fn es_numerico(&self) -> bool {
        matches!(self, TipoDato::Int | TipoDato::Float)
    }
}

#[derive(Clone, Debug)]
struct VarDecl {
    tipo: TipoDato,
    linea: usize,
}

pub fn analizar_con_ast(_codigo: &str, ast_root: Option<&AstNode>) -> SemanticResult {
    let mut output = String::from("--- ANÁLISIS SEMÁNTICO (Basado en AST) ---\n\n");
    let mut declaradas: HashMap<String, VarDecl> = HashMap::new();
    let mut errores: Vec<SemanticError> = Vec::new();

    // =========================================================================
    // FASE 1: Recorrido en Preorden para construcción de la Tabla Hash de Declaraciones
    // (Atributos Heredados)
    // =========================================================================
    fn recolectar_declaraciones(
        nodo: &AstNode,
        declaradas: &mut HashMap<String, VarDecl>,
        output: &mut String,
    ) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        if name.starts_with("Declaración Variable") {
            if let Some(children) = &nodo.children {
                let mut tipo_str = "int".to_string();
                for c in children {
                    if c.name.starts_with("Tipo: ") {
                        tipo_str = c.name.replacen("Tipo: ", "", 1).trim().to_string();
                        break;
                    }
                }
                let tipo_parsed = TipoDato::from_str(&tipo_str);

                for c in children {
                    if c.name.starts_with("ID: ") {
                        let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                        let linea_decl = if c.linea > 0 { c.linea } else { linea };

                        if declaradas.contains_key(&id) {
                            output.push_str(&format!(
                                "Advertencia (Línea {}): Variable '{}' ya había sido declarada previamente.\n",
                                linea_decl, id
                            ));
                        } else {
                            declaradas.insert(
                                id.clone(),
                                VarDecl {
                                    tipo: tipo_parsed.clone(),
                                    linea: linea_decl,
                                },
                            );
                            output.push_str(&format!(
                                "Validación (Línea {}): Variable '{}' ({}) declarada correctamente.\n",
                                linea_decl, id, tipo_parsed.as_str()
                            ));
                        }
                    }
                }
            }
        }

        if let Some(children) = &nodo.children {
            for child in children {
                recolectar_declaraciones(child, declaradas, output);
            }
        }
    }

    if let Some(ast) = ast_root {
        recolectar_declaraciones(ast, &mut declaradas, &mut output);
    }

    output.push_str("\n--- Verificación Semántica y Chequeo de Tipos (Postorden) ---\n");

    // =========================================================================
    // FASE 2: Inferencia de Tipos en Postorden (Atributos Sintetizados)
    // =========================================================================
    fn inferir_tipo_postorden(
        nodo: &AstNode,
        declaradas: &HashMap<String, VarDecl>,
        errores: &mut Vec<SemanticError>,
        output: &mut String,
    ) -> TipoDato {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        // 1. Nodos Hoja
        if name.starts_with("Número: ") {
            let num_val = name.replacen("Número: ", "", 1).trim().to_string();
            if num_val.contains('.') {
                return TipoDato::Float;
            } else {
                return TipoDato::Int;
            }
        }

        if name.starts_with("Booleano: ") {
            return TipoDato::Bool;
        }

        if name.starts_with("Identificador: ") {
            let id = name.replacen("Identificador: ", "", 1).trim().to_string();
            if let Some(var_decl) = declaradas.get(&id) {
                return var_decl.tipo.clone();
            } else if id == "true" || id == "false" {
                return TipoDato::Bool;
            } else if id != "main" {
                let msg = format!("Variable '{}' referenciada sin declaración previa.", id);
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError {
                    linea,
                    var: id,
                    msg,
                });
            }
            return TipoDato::Desconocido;
        }

        if name.starts_with("Cadena: ") {
            return TipoDato::Desconocido;
        }

        // 2. Agrupación ( )
        if name.starts_with("Agrupación") {
            if let Some(children) = &nodo.children {
                if let Some(primer_hijo) = children.first() {
                    return inferir_tipo_postorden(primer_hijo, declaradas, errores, output);
                }
            }
            return TipoDato::Desconocido;
        }

        // 3. Operación Unaria
        if name.starts_with("Op Unaria") {
            if let Some(children) = &nodo.children {
                if let Some(hijo) = children.first() {
                    let tipo_hijo = inferir_tipo_postorden(hijo, declaradas, errores, output);
                    if name.contains("!") {
                        if tipo_hijo != TipoDato::Bool && tipo_hijo != TipoDato::Desconocido {
                            let msg = format!(
                                "Operador lógico '!' aplicado a operando de tipo '{}' (se esperaba bool).",
                                tipo_hijo.as_str()
                            );
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                            errores.push(SemanticError { linea, var: "!".to_string(), msg });
                        }
                        return TipoDato::Bool;
                    } else if name.contains("-") || name.contains("++") || name.contains("--") {
                        if !tipo_hijo.es_numerico() && tipo_hijo != TipoDato::Desconocido {
                            let msg = format!(
                                "Operador aritmético unario aplicado a operando no numérico '{}'.",
                                tipo_hijo.as_str()
                            );
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                            errores.push(SemanticError { linea, var: "-".to_string(), msg });
                        }
                        return tipo_hijo;
                    }
                }
            }
            return TipoDato::Desconocido;
        }

        // Extraer hijos Izq y Der para operaciones binarias (Postorden)
        let mut tipo_izq = TipoDato::Desconocido;
        let mut tipo_der = TipoDato::Desconocido;
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name == "Izq" || c.name == "Base" {
                    if let Some(grand_children) = &c.children {
                        if let Some(gc) = grand_children.first() {
                            tipo_izq = inferir_tipo_postorden(gc, declaradas, errores, output);
                        }
                    }
                } else if c.name == "Der" || c.name == "Exponente" {
                    if let Some(grand_children) = &c.children {
                        if let Some(gc) = grand_children.first() {
                            tipo_der = inferir_tipo_postorden(gc, declaradas, errores, output);
                        }
                    }
                }
            }
        }

        // 4. Operaciones Aritméticas (Aditivas, Multiplicativas, Potencia)
        if name.starts_with("Operación Aditiva")
            || name.starts_with("Operación Multiplicativa")
            || name.starts_with("Potencia")
        {
            if tipo_izq != TipoDato::Desconocido && !tipo_izq.es_numerico() {
                let msg = format!("Operación aritmética aplicada a tipo no numérico '{}' en operando izquierdo.", tipo_izq.as_str());
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError { linea, var: name.clone(), msg });
            }
            if tipo_der != TipoDato::Desconocido && !tipo_der.es_numerico() {
                let msg = format!("Operación aritmética aplicada a tipo no numérico '{}' en operando derecho.", tipo_der.as_str());
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError { linea, var: name.clone(), msg });
            }

            if tipo_izq == TipoDato::Float || tipo_der == TipoDato::Float {
                return TipoDato::Float;
            }
            return TipoDato::Int;
        }

        // 5. Operaciones Relacionales (<, <=, >, >=, ==, !=)
        if name.starts_with("Operación Relacional") {
            if name.contains("==") || name.contains("!=") {
                if tipo_izq != TipoDato::Desconocido && tipo_der != TipoDato::Desconocido {
                    if tipo_izq.es_numerico() != tipo_der.es_numerico() {
                        let msg = format!(
                            "Comparación de igualdad entre tipos incompatibles ('{}' y '{}').",
                            tipo_izq.as_str(), tipo_der.as_str()
                        );
                        output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                        errores.push(SemanticError { linea, var: "==".to_string(), msg });
                    }
                }
            } else {
                if tipo_izq != TipoDato::Desconocido && !tipo_izq.es_numerico() {
                    let msg = format!("Comparación relacional con operando izquierdo no numérico '{}'.", tipo_izq.as_str());
                    output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                    errores.push(SemanticError { linea, var: "<".to_string(), msg });
                }
                if tipo_der != TipoDato::Desconocido && !tipo_der.es_numerico() {
                    let msg = format!("Comparación relacional con operando derecho no numérico '{}'.", tipo_der.as_str());
                    output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                    errores.push(SemanticError { linea, var: "<".to_string(), msg });
                }
            }
            return TipoDato::Bool;
        }

        // 6. Operaciones Lógicas (&&, ||)
        if name.starts_with("Op Lógico") {
            if tipo_izq != TipoDato::Desconocido && tipo_izq != TipoDato::Bool {
                let msg = format!("Operador lógico con operando izquierdo de tipo '{}' (se esperaba bool).", tipo_izq.as_str());
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError { linea, var: name.clone(), msg });
            }
            if tipo_der != TipoDato::Desconocido && tipo_der != TipoDato::Bool {
                let msg = format!("Operador lógico con operando derecho de tipo '{}' (se esperaba bool).", tipo_der.as_str());
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError { linea, var: name.clone(), msg });
            }
            return TipoDato::Bool;
        }

        TipoDato::Desconocido
    }

    // =========================================================================
    // FASE 2.2: Validación Semántica de Sentencias y Estructuras de Control
    // =========================================================================
    fn validar_sentencias(
        nodo: &AstNode,
        declaradas: &HashMap<String, VarDecl>,
        errores: &mut Vec<SemanticError>,
        output: &mut String,
    ) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        // 1. Asignación
        if name.starts_with("Asignación") {
            if let Some(children) = &nodo.children {
                let mut var_id = String::new();
                let mut linea_var = linea;
                let mut tipo_destino = TipoDato::Desconocido;

                for c in children {
                    if c.name.starts_with("Variable: ") {
                        var_id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                        linea_var = if c.linea > 0 { c.linea } else { linea };
                        if let Some(decl) = declaradas.get(&var_id) {
                            tipo_destino = decl.tipo.clone();
                        } else if var_id != "main" {
                            let msg = format!("La variable '{}' está siendo asignada pero no fue declarada.", var_id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_var, msg));
                            errores.push(SemanticError { linea: linea_var, var: var_id.clone(), msg });
                        }
                    }
                }

                for c in children {
                    if c.name == "Valor" {
                        if let Some(exp_nodes) = &c.children {
                            if let Some(exp) = exp_nodes.first() {
                                let tipo_exp = inferir_tipo_postorden(exp, declaradas, errores, output);

                                if tipo_destino != TipoDato::Desconocido && tipo_exp != TipoDato::Desconocido {
                                    if tipo_destino == TipoDato::Int && tipo_exp == TipoDato::Float {
                                        let msg = format!(
                                            "Incompatibilidad de tipos: no se puede asignar float a variable int '{}'.",
                                            var_id
                                        );
                                        output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_var, msg));
                                        errores.push(SemanticError { linea: linea_var, var: var_id.clone(), msg });
                                    } else if tipo_destino == TipoDato::Int && tipo_exp == TipoDato::Bool {
                                        let msg = format!(
                                            "Incompatibilidad de tipos: no se puede asignar bool a variable int '{}'.",
                                            var_id
                                        );
                                        output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_var, msg));
                                        errores.push(SemanticError { linea: linea_var, var: var_id.clone(), msg });
                                    } else if tipo_destino == TipoDato::Float && tipo_exp == TipoDato::Bool {
                                        let msg = format!(
                                            "Incompatibilidad de tipos: no se puede asignar bool a variable float '{}'.",
                                            var_id
                                        );
                                        output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_var, msg));
                                        errores.push(SemanticError { linea: linea_var, var: var_id.clone(), msg });
                                    } else if tipo_destino == TipoDato::Bool && tipo_exp.es_numerico() {
                                        let msg = format!(
                                            "Incompatibilidad de tipos: no se puede asignar valor numérico a variable bool '{}'.",
                                            var_id
                                        );
                                        output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_var, msg));
                                        errores.push(SemanticError { linea: linea_var, var: var_id.clone(), msg });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return;
        }

        // 2. Incremento / Decremento
        if name.starts_with("Incremento") || name.starts_with("Decremento") {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("Variable: ") {
                        let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                        let linea_uso = if c.linea > 0 { c.linea } else { linea };
                        if let Some(decl) = declaradas.get(&id) {
                            if !decl.tipo.es_numerico() {
                                let msg = format!("Operador de incremento/decremento aplicado a variable no numérica '{}' (tipo {}).", id, decl.tipo.as_str());
                                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                                errores.push(SemanticError { linea: linea_uso, var: id, msg });
                            }
                        } else {
                            let msg = format!("La variable '{}' fue modificada pero no está declarada.", id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                            errores.push(SemanticError { linea: linea_uso, var: id, msg });
                        }
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
                        let linea_uso = if c.linea > 0 { c.linea } else { linea };
                        if !declaradas.contains_key(&id) {
                            let msg = format!("La variable '{}' en 'cin' no fue declarada.", id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                            errores.push(SemanticError { linea: linea_uso, var: id, msg });
                        }
                    }
                }
            }
            return;
        }

        // 4. Sentencias con Condición: IF, WHILE, DO-UNTIL, DO-WHILE
        if name.starts_with("Sentencia IF")
            || name.starts_with("Bucle WHILE")
            || name.starts_with("Bucle DO-")
        {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name == "Condición" {
                        if let Some(cond_children) = &c.children {
                            if let Some(cond_exp) = cond_children.first() {
                                let tipo_cond = inferir_tipo_postorden(cond_exp, declaradas, errores, output);
                                if tipo_cond != TipoDato::Bool && tipo_cond != TipoDato::Desconocido {
                                    let msg = format!(
                                        "La condición en '{}' debe ser de tipo bool, pero se obtuvo '{}'.",
                                        name, tipo_cond.as_str()
                                    );
                                    output.push_str(&format!("Error Semántico (Línea {}): {}\n", c.linea, msg));
                                    errores.push(SemanticError { linea: c.linea, var: name.clone(), msg });
                                }
                            }
                        }
                    } else {
                        validar_sentencias(c, declaradas, errores, output);
                    }
                }
            }
            return;
        }

        // Recorrido recursivo sobre bloques y sentencias hijas
        if let Some(children) = &nodo.children {
            for child in children {
                validar_sentencias(child, declaradas, errores, output);
            }
        }
    }

    if let Some(ast) = ast_root {
        validar_sentencias(ast, &declaradas, &mut errores, &mut output);
    }

    // =========================================================================
    // FASE 2.3: Generación del Árbol Anotado (Decorado con Tipos y Atributos Semánticos)
    // =========================================================================
    fn construir_arbol_anotado(
        nodo: &AstNode,
        declaradas: &HashMap<String, VarDecl>,
    ) -> (AstNode, Option<TipoDato>) {
        let name = &nodo.name;
        let mut annotated_name = name.clone();
        let mut tipo_sintetizado: Option<TipoDato> = None;

        // Anotar según el tipo de nodo
        if name.starts_with("Número: ") {
            let num_val = name.replacen("Número: ", "", 1).trim().to_string();
            let t = if num_val.contains('.') { TipoDato::Float } else { TipoDato::Int };
            annotated_name = format!("{} [tipo: {}]", name, t.as_str());
            tipo_sintetizado = Some(t);
        } else if name.starts_with("Booleano: ") {
            annotated_name = format!("{} [tipo: bool]", name);
            tipo_sintetizado = Some(TipoDato::Bool);
        } else if name.starts_with("Identificador: ") {
            let id = name.replacen("Identificador: ", "", 1).trim().to_string();
            if let Some(var_decl) = declaradas.get(&id) {
                annotated_name = format!("{} [tipo: {}]", name, var_decl.tipo.as_str());
                tipo_sintetizado = Some(var_decl.tipo.clone());
            } else if id == "true" || id == "false" {
                annotated_name = format!("{} [tipo: bool]", name);
                tipo_sintetizado = Some(TipoDato::Bool);
            } else if id != "main" {
                annotated_name = format!("{} [no declarada!]", name);
            }
        } else if name.starts_with("Tipo: ") {
            let t_str = name.replacen("Tipo: ", "", 1).trim().to_string();
            annotated_name = format!("{} [tipo base]", name);
            tipo_sintetizado = Some(TipoDato::from_str(&t_str));
        }

        let mut annotated_children = Vec::new();
        if let Some(children) = &nodo.children {
            for child in children {
                let (child_annotated, child_tipo) = construir_arbol_anotado(child, declaradas);
                // Si este hijo es Izq/Der o Base/Exponente, capturamos su tipo para operaciones
                if (child.name == "Izq" || child.name == "Base" || child.name == "Der" || child.name == "Exponente" || child.name == "Valor") && tipo_sintetizado.is_none() {
                    if let Some(t) = child_tipo {
                        tipo_sintetizado = Some(t);
                    }
                }
                annotated_children.push(child_annotated);
            }
        }

        // Función auxiliar para determinar si un subárbol contiene float
        fn contiene_float(n: &AstNode) -> bool {
            if n.name.contains("[tipo: float]") {
                return true;
            }
            if let Some(ch) = &n.children {
                return ch.iter().any(contiene_float);
            }
            false
        }

        // Decorar operaciones compuestas
        if name.starts_with("Operación Aditiva")
            || name.starts_with("Operación Multiplicativa")
            || name.starts_with("Potencia")
        {
            let tiene_float = annotated_children.iter().any(contiene_float);
            let tipo_op = if tiene_float { TipoDato::Float } else { TipoDato::Int };
            annotated_name = format!("{} [tipo: {}]", name, tipo_op.as_str());
            tipo_sintetizado = Some(tipo_op);
        } else if name.starts_with("Operación Relacional") || name.starts_with("Op Lógico") {
            annotated_name = format!("{} [tipo: bool]", name);
            tipo_sintetizado = Some(TipoDato::Bool);
        } else if name.starts_with("Op Unaria") {
            if name.contains("!") {
                annotated_name = format!("{} [tipo: bool]", name);
                tipo_sintetizado = Some(TipoDato::Bool);
            } else {
                let tiene_float = annotated_children.iter().any(contiene_float);
                let t = if tiene_float { TipoDato::Float } else { TipoDato::Int };
                annotated_name = format!("{} [tipo: {}]", name, t.as_str());
                tipo_sintetizado = Some(t);
            }
        } else if name.starts_with("Asignación") {
            let mut var_tipo_str = "";
            for c in &annotated_children {
                if c.name.starts_with("Variable: ") {
                    let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                    if let Some(decl) = declaradas.get(&id) {
                        var_tipo_str = decl.tipo.as_str();
                    }
                }
            }
            if !var_tipo_str.is_empty() {
                annotated_name = format!("{} [asigna a: {}]", name, var_tipo_str);
            }
        }

        let new_node = AstNode {
            name: annotated_name,
            linea: nodo.linea,
            children: if annotated_children.is_empty() { None } else { Some(annotated_children) },
        };

        (new_node, tipo_sintetizado)
    }

    let annotated_tree = ast_root.map(|ast| construir_arbol_anotado(ast, &declaradas).0);

    if errores.is_empty() {
        output.push_str("\nVerificación semántica completada con éxito. Todos los tipos y variables concuerdan correctamente con el AST.\n");
    }

    SemanticResult {
        success: errores.is_empty(),
        output,
        errores,
        annotated_tree,
    }
}
