use crate::expression::*;
use crate::protocol::*;
use crate::values::*;
use serde_json::Value;

pub trait ServerHandler {
    fn write(&mut self, value: &str);
    fn end(&mut self);
}

pub fn handle_btr(protocol: BuildTimeRenderingProtocol, state: Value, server_handler: &mut dyn ServerHandler) {
    for stream in protocol.streams {
        match stream {
            BuildTimeRenderingStream::Attribute(attribute_stream) => {
                let value = find_value_by_dotted_path(&attribute_stream.value, &state);
                let value_string = match value {
                    Some(Value::String(s)) => s.clone(),
                    Some(value) => value.to_string(),
                    None => {
                        if let Some(default_value) = attribute_stream.default_value.as_ref() {
                            default_value.clone()
                        } else {
                            String::new()
                        }
                    }
                };
                server_handler.write(&format!("{}={}", attribute_stream.name, value_string));
            }
            BuildTimeRenderingStream::Raw(raw_stream) => {
                server_handler.write(&raw_stream.value);
            }
            BuildTimeRenderingStream::Repeat(repeat_stream) => {
                if let Some(value) = find_value_by_dotted_path(&repeat_stream.value, &state) {
                    if let Value::Array(array) = value {
                        for item in array {
                            server_handler.write(&format!("<{}><template shadowrootmode=\"open\">", repeat_stream.template));
                            if let Some(style) = protocol.templates.get(&repeat_stream.template).and_then(|t| t.style.as_ref()) {
                                server_handler.write(&format!("<style>{}</style>", style));
                            }

                            let template = protocol.templates.get(&repeat_stream.template).unwrap().template.clone();
                            server_handler.write(&format!("{}</template>", template));

                            match item {
                                Value::String(s) => {
                                    server_handler.write(&s.to_string());
                                },
                                Value::Number(n) => {
                                    server_handler.write(&n.to_string());
                                },
                                Value::Bool(b) => {
                                    server_handler.write(&b.to_string());
                                },
                                Value::Array(arr) => {
                                    let s: String = arr.iter().map(|v| v.to_string()).collect::<Vec<String>>().join(",");
                                    server_handler.write(&s);
                                },
                                Value::Object(map) => {
                                    for (key, value) in map {
                                        let value_str = match value {
                                            Value::String(s) => s,
                                            Value::Array(arr) => arr.iter().map(|v| v.to_string()).collect::<Vec<String>>().join(","),
                                            _ => value.to_string(),
                                        };
                                        server_handler.write(&format!("<span slot=\"{}\">{}</span>", key, value_str));
                                    }
                                },
                                _ => {}
                            }

                            server_handler.write(&format!("</{}>", repeat_stream.template));
                        }
                    }
                }
            }
            BuildTimeRenderingStream::Signal(signal_stream) => {
                let value = find_value_by_dotted_path(&signal_stream.value, &state);
                match value {
                    Some(Value::String(s)) => server_handler.write(&s),
                    Some(value) => server_handler.write(&value.to_string()),
                    None => {
                        if let Some(default_value) = signal_stream.default_value.as_ref() {
                            server_handler.write(default_value);
                        }
                    }
                }
            }
            BuildTimeRenderingStream::When(when_stream) => {
                let parts = parse_expression(&when_stream.value);
                let value = safe_evaluate_expression(&parts.join(""), &state);
                if !value {
                    server_handler.write("style=\"display: none\"");
                }
            }
        }
    }
    server_handler.end();
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::RefCell;
    use std::collections::HashMap;

    struct TestServerHandler {
        output: RefCell<String>,
    }

    impl TestServerHandler {
        fn new() -> Self {
            TestServerHandler {
                output: RefCell::new(String::new()),
            }
        }

        fn get_output(&self) -> String {
            self.output.borrow().clone()
        }
    }

    impl ServerHandler for TestServerHandler {
        fn write(&mut self, value: &str) {
            self.output.borrow_mut().push_str(value);
        }

        fn end(&mut self) {}
    }

    #[test]
    fn test_handle_btr_raw() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Raw(
                    BuildTimeRenderingStreamRaw {
                        value: "Hello, ".to_string(),
                    }
                ),
                BuildTimeRenderingStream::Raw(
                    BuildTimeRenderingStreamRaw {
                        value: "world!".to_string(),
                    }
                ),
            ],
            templates: HashMap::new(),
        };
        let state = json!({});
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "Hello, world!");
    }

    #[test]
    fn test_handle_btr_signal() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Signal(
                    BuildTimeRenderingStreamSignal {
                        value: "a".to_string(),
                        default_value: Some("a".to_string()),
                    }
                ),
                BuildTimeRenderingStream::Signal(
                    BuildTimeRenderingStreamSignal {
                        value: "b".to_string(),
                        default_value: Some("b".to_string()),
                    }
                ),
            ],
            templates: HashMap::new(),
        };
        let state = json!({
            "a": "apple"
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "appleb");
    }

    #[test]
    fn test_handle_btr_attribute() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Attribute(
                    BuildTimeRenderingStreamAttribute {
                        value: "fruit".to_string(),
                        name: "href".to_string(),
                        default_value: None,
                    }
                )
            ],
            templates: HashMap::new(),
        };
        let state = json!({
            "fruit": "apple"
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "href=apple");
    }
    
    #[test]
    fn test_handle_btr_attribute_default() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Attribute(
                    BuildTimeRenderingStreamAttribute {
                        value: "fruit".to_string(),
                        name: "href".to_string(),
                        default_value: Some("pineapple".to_string()),
                    }
                )
            ],
            templates: HashMap::new(),
        };
        let state = json!({
            "liquid": "water"
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "href=pineapple");
    }

    #[test]
    fn test_handle_btr_when_visible() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::When(
                    BuildTimeRenderingStreamWhen {
                        value: "a > 5".to_string(),
                    }
                ),
            ],
            templates: HashMap::new(),
        };
        let state = json!({
            "a": 10
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "");
    }

    #[test]
    fn test_handle_btr_when_hidden() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::When(
                    BuildTimeRenderingStreamWhen {
                        value: "a > 10".to_string(),
                    }
                ),
            ],
            templates: HashMap::new(),
        };
        let state = json!({
            "a": 10
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "style=\"display: none\"");
    }

    #[test]
    fn test_handle_btr_repeat() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Repeat(
                    BuildTimeRenderingStreamRepeat {
                        template: "item".to_string(),
                        value: "items".to_string(),
                    }
                ),
            ],
            templates: {
                let mut map = HashMap::new();
                map.insert(
                    "item".to_string(),
                    BuildTimeRenderingTemplate {
                        template: "<div></div>".to_string(),
                        style: None,
                    },
                );
                map
            },
        };
        let state = json!({
            "items": ["item1", "item2", "item3"]
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(
            server_handler.get_output(),
            "<item><template shadowrootmode=\"open\"><div></div></template>item1</item>\
            <item><template shadowrootmode=\"open\"><div></div></template>item2</item>\
            <item><template shadowrootmode=\"open\"><div></div></template>item3</item>"
        );
    }

    #[test]
    fn test_handle_btr_repeat_with_objects() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Repeat(
                    BuildTimeRenderingStreamRepeat {
                        template: "item".to_string(),
                        value: "items".to_string(),
                    }
                ),
            ],
            templates: {
                let mut map = HashMap::new();
                map.insert(
                    "item".to_string(),
                    BuildTimeRenderingTemplate {
                        template: "<div></div>".to_string(),
                        style: None,
                    },
                );
                map
            },
        };
        let state = json!({
            "items": [
                {
                    "color": "red",
                    "size": "large"
                },
                {
                    "color": "blue",
                    "quantities": 123
                },
                {
                    "authors": ["a", 1],
                    "color": "teal",
                }
            ]
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(
            server_handler.get_output(),
            "<item><template shadowrootmode=\"open\"><div></div></template><span slot=\"color\">red</span><span slot=\"size\">large</span></item>\
            <item><template shadowrootmode=\"open\"><div></div></template><span slot=\"color\">blue</span><span slot=\"quantities\">123</span></item>\
            <item><template shadowrootmode=\"open\"><div></div></template><span slot=\"authors\">\"a\",1</span><span slot=\"color\">teal</span></item>"
        );
    }

    #[test]
    fn test_handle_btr_repeat_with_style() {
        let protocol = BuildTimeRenderingProtocol {
            streams: vec![
                BuildTimeRenderingStream::Repeat(
                    BuildTimeRenderingStreamRepeat {
                        template: "item".to_string(),
                        value: "items".to_string(),
                    }
                ),
            ],
            templates: {
                let mut map = HashMap::new();
                map.insert(
                    "item".to_string(),
                    BuildTimeRenderingTemplate {
                        template: "<div></div>".to_string(),
                        style: Some(":host\\{color:red;\\}".to_string()),
                    },
                );
                map
            },
        };
        let state = json!({
            "items": ["item"]
        });
        let mut server_handler = TestServerHandler::new();
        handle_btr(protocol, state, &mut server_handler);
        assert_eq!(server_handler.get_output(), "<item><template shadowrootmode=\"open\"><style>:host\\{color:red;\\}</style><div></div></template>item</item>");
    }
}
