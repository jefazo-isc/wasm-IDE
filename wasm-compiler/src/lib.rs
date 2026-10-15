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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semantica_txt() {
        let code = include_str!("../../workspace/TestSemantica.txt");
        let lex_res = lexer::analizar(code);
        println!("Lexer errors: {:?}", lex_res.errores);
        assert!(lex_res.errores.is_empty(), "Lexer should have no errors");

        let mut parser = parser::Parser::new(lex_res.tokens);
        let parse_res = parser.parse();
        println!("Parser errors: {:?}", parse_res.errores);
        assert!(parse_res.success, "Parser should succeed");

        let sem_res = semantic::analizar_con_ast(code, parse_res.tree.as_ref());
        println!("Semantic output:\n{}", sem_res.output);
        println!("Semantic errors: {:?}", sem_res.errores);

        let sym_res = symbols::generar_con_ast(code, parse_res.tree.as_ref());
        println!("Symbols count: {}", sym_res.simbolos.len());
        for sym in &sym_res.simbolos {
            println!("  Sym: {} ({}) lines: {}", sym.identificador, sym.tipo, sym.lineas);
        }

        let inter_res = intermediate::generar(code);
        println!("Intermediate Code Output:\n{}", inter_res);
        assert!(inter_res.contains("if_false"), "Should generate control flow jumps");
        assert!(inter_res.contains("goto"), "Should generate goto jumps");
        assert!(inter_res.contains("t1"), "Should generate temporary variables");
    }

    #[test]
    fn test_lexico_txt() {
        let code = include_str!("../../workspace/testLexico.txt");
        let lex_res = lexer::analizar(code);
        println!("Lexer errors on testLexico.txt: {}", lex_res.errores.len());
        for err in &lex_res.errores {
            println!("  Err: Ln {} Col {} {} ({})", err.linea, err.col, err.msg, err.lexema);
        }
    }
}
