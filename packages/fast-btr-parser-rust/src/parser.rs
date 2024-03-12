use crate::values::*;
use crate::expression::*;
use crate::protocol::*;
use serde_json::Value;

pub trait ServerHandler {
    fn write(&mut self, value: &str);
    fn end(&mut self);
}

pub fn handle_btr(protocol: BuildTimeRenderingProtocol, state: Value, server_handler: &mut dyn ServerHandler) {
    for stream in protocol.streams {
        match stream {
            BuildTimeRenderingStream::Raw(raw_stream) => {
                server_handler.write(&raw_stream.value);
            }
            BuildTimeRenderingStream::Repeat(repeat_stream) => {
                if let Some(value) = find_value_by_dotted_path(&repeat_stream.value, &state) {
                    if let Value::Array(array) = value {
                        for item in array {
                            server_handler.write(&format!("<{}><template shadowrootmode=\"open\">", repeat_stream.template));
                            if let Some(style) = protocol.templates.get(&repeat_stream.template).and_then(|t| Some(&t.style)) {
                                server_handler.write(&format!("<style>{}</style>", style));
                            }
                            let template = protocol.templates.get(&repeat_stream.template).unwrap().template.clone();
                            server_handler.write(&format!("{}</template>{}</{}>", template, item, repeat_stream.template));
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
    use std::cell::RefCell;
    use serde_json::json;
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
    fn test_handle_btr_when() {
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
}