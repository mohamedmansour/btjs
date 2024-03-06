use crate::find_value_by_dotted_path::find_value_by_dotted_path;
use lazy_static::lazy_static;
use regex::Regex;
use serde_json::Value;

const OPERATORS: [&str; 10] = ["&&", "||", "!", "==", ">", ">=", "<", "<=", "(", ")"];

lazy_static! {
    static ref RE: Regex = {
        let mut patterns: Vec<_> = OPERATORS
            .iter()
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

// Safely evaluates an expression using a state object. The expression is a string that can contain
// logical operators and dotted paths to properties in the state object.
pub fn safe_evaluate_expression(expression: &str, state: &Value) -> bool {
    let mut stack = Vec::new();
    let expression_parts = parse_expression(expression);
    let mut current_value: Option<Value> = None;
    let mut current_operator: Option<String> = None;

    for part in expression_parts.iter() {
        if part == "(" {
            stack.push((current_value, current_operator));
            current_value = None;
            current_operator = None;
        } else if part == ")" {
            let part_value = current_value.take().unwrap_or(Value::Null);
            let (value, operator) = stack.pop().unwrap();
            current_value = value;
            current_operator = operator;
            if let Some(op) = current_operator {
                current_value = Some(evaluate_expression(
                    current_value.clone(),
                    Some(op),
                    part_value,
                ));
                current_operator = None;
            }
        } else if OPERATORS.contains(&part.as_str()) {
            current_operator = Some(part.clone());
        } else {
            let part_value = if part.starts_with(|c: char| c.is_digit(10)) {
                serde_json::from_str(part)
                    .unwrap_or_else(|_| Value::Number(serde_json::Number::from(0)))
            } else if part.starts_with(|c: char| c == '\'' || c == '"' || c == '`') {
                Value::String(
                    part.trim_matches(|c: char| c == '\'' || c == '"' || c == '`')
                        .to_string(),
                )
            } else if part == "true" {
                Value::Bool(true)
            } else if part == "false" {
                Value::Bool(false)
            } else {
                match find_value_by_dotted_path(part, state) {
                    Some(value) => value.clone(),
                    None => Value::Null,
                }
            };

            if let Some(op) = current_operator {
                current_value = Some(evaluate_expression(
                    current_value.clone(),
                    Some(op),
                    part_value.clone(),
                ));
                current_operator = None;
            } else {
                current_value = Some(part_value);
            }
        }
    }

    // Evaluate the remaining expression
    if let Some(op) = current_operator {
        current_value = Some(evaluate_expression(
            current_value.clone(),
            Some(op),
            current_value.take().unwrap_or(Value::Null),
        ));
    }

    current_value
        .as_ref()
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn evaluate_expression(value: Option<Value>, operator: Option<String>, part_value: Value) -> Value {
    println!("value: {:?}, operator: {:?}, part_value: {:?}", value, operator, part_value);
    match operator.as_deref() {
        Some("==") => match (value.clone(), part_value.clone()) {
            (Some(Value::Bool(b1)), Value::Bool(b2)) => Value::Bool(b1 == b2),
            (Some(Value::Number(n1)), Value::Number(n2)) => Value::Bool(n1.as_f64() == n2.as_f64()),
            (Some(Value::String(s1)), Value::String(s2)) => Value::Bool(s1 == s2),
            (Some(Value::Array(a1)), Value::Array(a2)) => Value::Bool(a1 == a2),
            (Some(Value::Object(o1)), Value::Object(o2)) => Value::Bool(o1 == o2),
            _ => Value::Bool(false),
        },
        Some(">") => {
            if let (Some(Value::Number(n1)), Value::Number(n2)) = (value.clone(), part_value.clone()) {
                return Value::Bool(n1.as_f64() > n2.as_f64());
            }
            Value::Bool(false)
        }
        Some("<") => {
            if let (Some(Value::Number(n1)), Value::Number(n2)) = (value.clone(), part_value.clone())  {
                return Value::Bool(n1.as_f64() < n2.as_f64());
            }
            Value::Bool(false)
        }
        Some(">=") => {
            if let (Some(Value::Number(n1)), Value::Number(n2)) = (value.clone(), part_value.clone()) {
                return Value::Bool(n1.as_f64() >= n2.as_f64());
            }
            Value::Bool(false)
        }
        Some("<=") => {
            if let (Some(Value::Number(n1)), Value::Number(n2)) = (value.clone(), part_value.clone()) {
                return Value::Bool(n1.as_f64() <= n2.as_f64());
            }
            Value::Bool(false)
        }
        Some("&&") => {
            let b1 = match value.clone() {
                Some(Value::Bool(b)) => b,
                Some(Value::Number(n)) => n.as_f64() != Some(0.0),
                Some(Value::String(s)) => !s.is_empty(),
                Some(Value::Array(a)) => !a.is_empty(),
                Some(Value::Object(o)) => !o.is_empty(),
                _ => false,
            };
            let b2 = match part_value.clone() {
                Value::Bool(b) => b,
                Value::Number(n) => n.as_f64() != Some(0.0),
                Value::String(s) => !s.is_empty(),
                Value::Array(a) => !a.is_empty(),
                Value::Object(o) => !o.is_empty(),
                _ => false,
            };
            Value::Bool(b1 && b2)
        }
        Some("||") => {
            let b1 = match value.clone() {
                Some(Value::Bool(b)) => b,
                Some(Value::Number(n)) => n.as_f64() != Some(0.0),
                Some(Value::String(s)) => !s.is_empty(),
                Some(Value::Array(a)) => !a.is_empty(),
                Some(Value::Object(o)) => !o.is_empty(),
                _ => false,
            };
            let b2 = match part_value.clone() {
                Value::Bool(b) => b,
                Value::Number(n) => n.as_f64() != Some(0.0),
                Value::String(s) => !s.is_empty(),
                Value::Array(a) => !a.is_empty(),
                Value::Object(o) => !o.is_empty(),

                _ => false,
            };
            Value::Bool(b1 || b2)
        }
        Some("!") => {
            let b = match part_value.clone() {
                Value::Bool(b) => b,
                Value::Number(n) => n.as_f64() != Some(0.0),
                Value::String(s) => !s.is_empty(),
                Value::Array(a) => !a.is_empty(),
                Value::Object(o) => !o.is_empty(),
                _ => false,
            };
            Value::Bool(!b)
        }
        _ => Value::Bool(false),
    }
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
            (
                "o > p && q <= r || s == t",
                vec!["o", ">", "p", "&&", "q", "<=", "r", "||", "s", "==", "t"],
            ),
        ];

        for (expression, expected) in test_cases {
            assert_eq!(parse_expression(expression), expected);
        }
    }

    #[test]
    fn test_safe_evaluate_expression() {
        // Create a JSON object
        let data = serde_json::json!({
            "name": {
                "first": "John",
                "last": "Doe"
            },
            "favorite": {
                "categories": {
                    "movies": ["The Matrix", "The Godfather"],
                    "music": ["Jazz", "Blues"]
                }
            },
            "age": 30,
            "is_student": true
        });

        let test_cases = vec![
            ("name.first && age", true),
            ("age == 30", true),
            ("favorite.categories.music && favorite.categories.movies", true),
            ("age > 10", true),
            ("name.first &&", true),
            ("name && name.first", true),
            ("is_student", true),
            ("is_student && name.first", true),
            ("!is_student || true", true),
            ("name.middle", false),
            ("name.first && (age == 31)", false),
            ("name.first && false", false),
            ("\"a\" == \"b\"", false),
            ("!is_student", false),
            ("!is_student && name.first", false),
        ];

        for (expression, expected) in test_cases {
            assert_eq!(safe_evaluate_expression(expression, &data), expected);
        }
    }
}
