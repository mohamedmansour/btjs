
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    static ref SEPARATORS: [&'static str; 8] = ["&&", "||", "!", "==", ">", ">=", "<", "<="];
    static ref RE: Regex = {
        let mut patterns: Vec<_> = SEPARATORS.iter()
            .map(|&separator| regex::escape(separator))
            .collect();
        patterns.sort_by(|a, b| b.len().cmp(&a.len()));
        let pattern = patterns.join("|");
        Regex::new(&pattern).unwrap()
    };
}

// Parses an expression into a vector of strings. The strings are either operators or operands.
pub fn parse_expression(expression: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut last = 0;
    for mat in RE.find_iter(expression) {
        if last != mat.start() {
            result.push(expression[last..mat.start()].trim().to_string());
        }
        result.push(mat.as_str().to_string());
        last = mat.end();
    }
    if last < expression.len() {
        result.push(expression[last..].trim().to_string());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_expression() {
        let test_cases = vec![
            ("a && b || c", vec!["a", "&&", "b", "||", "c"]),
            ("d == e", vec!["d", "==", "e"]),
            ("f > g", vec!["f", ">", "g"]),
            ("k&&l", vec!["k", "&&", "l"]),
            ("  m  ||  n  ", vec!["m", "||", "n"]),
            ("o > p && q <= r || s == t", vec!["o", ">", "p", "&&", "q", "<=", "r", "||", "s", "==", "t"]),
        ];
        
        for (expression, expected) in test_cases {
            assert_eq!(parse_expression(expression), expected);
        }
    }
}
