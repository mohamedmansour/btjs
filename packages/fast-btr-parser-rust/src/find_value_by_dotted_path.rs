extern crate serde_json;

use serde_json::Value;

// Finds a value in a JSON object by a dotted path.
pub fn find_value_by_dotted_path<'a>(path: &'a str, state: &'a Value) -> Option<&'a Value> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current_value: &Value = state;

    for part in parts.iter() {
        match current_value {
            Value::Object(map) => {
                current_value = map.get(*part)?;
            },
            _ => return None,
        }
    }

    Some(current_value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_find_value_by_dotted_path() {
        // Create a JSON object
        let data = json!({
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
            "age": 30
        });

        // Test a successful path
        let value = find_value_by_dotted_path("name.first", &data);
        assert_eq!(value, Some(&Value::String("John".to_string())));

        // Test a path that leads to single string
        let value = find_value_by_dotted_path("age", &data);
        assert_eq!(value, Some(&Value::Number(serde_json::Number::from(30))));

        // Test a path that leads to an array
        let value = find_value_by_dotted_path("favorite.categories.music", &data);
        assert_eq!(value, Some(&Value::Array(vec![
            Value::String("Jazz".to_string()),
            Value::String("Blues".to_string())
        ])));

        // Test a non-existent path
        let value = find_value_by_dotted_path("name.middle", &data);
        assert_eq!(value, None);

        // Test a path that leads to a non-object value
        let value = find_value_by_dotted_path("age.years", &data);
        assert_eq!(value, None);
    }
}
