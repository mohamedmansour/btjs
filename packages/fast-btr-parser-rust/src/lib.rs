extern crate serde_json;

use serde_json::Value;

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
