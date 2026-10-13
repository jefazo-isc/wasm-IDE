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
}

#[derive(Clone, Debug)]
struct VarDecl {
    tipo: String,
    #[allow(dead_code)]
    linea: usize,
}

pub fn analizar_con_ast(_codigo: &str, ast_root: Option<&AstNode>) -> SemanticResult {
    let mut output = String::from("--- ANÁLISIS SEMÁNTICO (Basado en AST) ---\n\n");
    let mut declaradas: HashMap<String, VarDecl> = HashMap::new();
    let mut errores: Vec<SemanticError> = Vec::new();

    // FASE 1: Recorrer AST para registrar declaraciones
    fn recolectar_declaraciones(
        nodo: &AstNode,
        declaradas: &mut HashMap<String, VarDecl>,
        output: &mut String,
    ) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        if name.starts_with("Declaración Variable") {
            if let Some(children) = &nodo.children {
                let mut tipo_var = "Desconocido".to_string();
                for c in children {
                    if c.name.starts_with("Tipo: ") {
                        tipo_var = c.name.replacen("Tipo: ", "", 1).trim().to_string();
                        break;
                    }
                }

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
                                    tipo: tipo_var.clone(),
                                    linea: linea_decl,
                                },
                            );
                            output.push_str(&format!(
                                "Validación (Línea {}): Variable '{}' ({}) declarada correctamente.\n",
                                linea_decl, id, tipo_var
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

    output.push_str("\n--- Verificación de Uso en el Árbol Sintáctico ---\n");

    // FASE 2: Recorrer AST para validar uso y asignaciones
    fn validar_usos(
        nodo: &AstNode,
        declaradas: &HashMap<String, VarDecl>,
        errores: &mut Vec<SemanticError>,
        output: &mut String,
    ) {
        let name = &nodo.name;
        let linea = if nodo.linea > 0 { nodo.linea } else { 1 };

        // Validar destino de asignación
        if name.starts_with("Asignación") {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("Variable: ") {
                        let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                        let linea_uso = if c.linea > 0 { c.linea } else { linea };
                        if !declaradas.contains_key(&id) && id != "main" {
                            let msg = format!("La variable '{}' está siendo asignada pero no fue declarada.", id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                            errores.push(SemanticError {
                                linea: linea_uso,
                                var: id,
                                msg,
                            });
                        }
                    }
                }
            }
        }

        // Validar incrementos / decrementos
        if name.starts_with("Incremento") || name.starts_with("Decremento") {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("Variable: ") {
                        let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                        let linea_uso = if c.linea > 0 { c.linea } else { linea };
                        if !declaradas.contains_key(&id) {
                            let msg = format!("La variable '{}' fue modificada pero no está declarada.", id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                            errores.push(SemanticError {
                                linea: linea_uso,
                                var: id,
                                msg,
                            });
                        }
                    }
                }
            }
        }

        // Validar sentencias cin
        if name.starts_with("Sentencia IN") {
            if let Some(children) = &nodo.children {
                for c in children {
                    if c.name.starts_with("ID: ") {
                        let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                        let linea_uso = if c.linea > 0 { c.linea } else { linea };
                        if !declaradas.contains_key(&id) {
                            let msg = format!("La variable '{}' en 'cin' no fue declarada.", id);
                            output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea_uso, msg));
                            errores.push(SemanticError {
                                linea: linea_uso,
                                var: id,
                                msg,
                            });
                        }
                    }
                }
            }
        }

        // Validar uso de identificadores en expresiones
        if name.starts_with("Identificador: ") {
            let id = name.replacen("Identificador: ", "", 1).trim().to_string();
            if !declaradas.contains_key(&id) && id != "main" {
                let msg = format!("Variable '{}' referenciada sin declaración previa.", id);
                output.push_str(&format!("Error Semántico (Línea {}): {}\n", linea, msg));
                errores.push(SemanticError {
                    linea,
                    var: id,
                    msg,
                });
            }
        }

        // Continuar recorrido recursivo por los hijos
        if let Some(children) = &nodo.children {
            for child in children {
                validar_usos(child, declaradas, errores, output);
            }
        }
    }

    if let Some(ast) = ast_root {
        validar_usos(ast, &declaradas, &mut errores, &mut output);
    }

    if errores.is_empty() {
        output.push_str("\nVerificación semántica completada con éxito. Todas las variables usadas concuerdan con el árbol sintáctico.\n");
    }

    SemanticResult {
        success: errores.is_empty(),
        output,
        errores,
    }
}
