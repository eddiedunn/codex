use std::fs::OpenOptions;
use std::io::Write;

pub struct LogWriter {
    file: std::fs::File,
}

impl LogWriter {
    pub fn new(path: &str) -> Self {
        let file = OpenOptions::new().create(true).append(true).open(path).expect("Failed to open log file");
        LogWriter { file }
    }
    pub fn log(&mut self, msg: String) {
        let _ = writeln!(self.file, "{}", msg);
    }
}
