use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;

pub mod lexer;
pub mod parser;
pub mod semantic;
pub mod symbols;
pub mod intermediate;

#[wasm_bindgen]
pub fn analizar_lexico(codigo: &str) -> JsValue {
    let result = lexer::analizar(codigo);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn analizar_sintactico(codigo: &str) -> JsValue {
    let result_lexer = lexer::analizar(codigo);
    let mut p = parser::Parser::new(result_lexer.tokens);
    let result_parser = p.parse();
    serde_wasm_bindgen::to_value(&result_parser).unwrap()
}

#[wasm_bindgen]
pub fn analizar_semantico(codigo: &str) -> JsValue {
    let result_lexer = lexer::analizar(codigo);
    let mut p = parser::Parser::new(result_lexer.tokens);
    let result_parser = p.parse();
    let result = semantic::analizar_con_ast(codigo, result_parser.tree.as_ref());
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn generar_simbolos(codigo: &str) -> JsValue {
    let result_lexer = lexer::analizar(codigo);
    let mut p = parser::Parser::new(result_lexer.tokens);
    let result_parser = p.parse();
    let result = symbols::generar_con_ast(codigo, result_parser.tree.as_ref());
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn generar_intermedio(codigo: &str) -> String {
    intermediate::generar(codigo)
}
