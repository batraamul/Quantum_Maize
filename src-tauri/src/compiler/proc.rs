//! Safe process execution. Every external program is started from an absolute
//! executable path with an explicit argument array — never via a shell — in its
//! own process group so cancellation/timeouts kill the whole tree
//! (latexmk → pdflatex → bibtex …).

use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::{Duration, Instant};

pub fn hidden_command(program: &Path) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.stdin(Stdio::null());
    cmd
}

pub struct Captured {
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

/// Run to completion, capturing output, killing after `timeout`.
pub fn run_capture(mut cmd: Command, timeout: Duration) -> std::io::Result<Captured> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn()?;
    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    let t1 = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = so.read_to_end(&mut b);
        b
    });
    let t2 = std::thread::spawn(move || {
        let mut b = Vec::new();
        let _ = se.read_to_end(&mut b);
        b
    });
    let start = Instant::now();
    let code = loop {
        if let Some(st) = child.try_wait()? {
            break st.code();
        }
        if start.elapsed() > timeout {
            kill_tree(&mut child);
            let _ = child.wait();
            break None;
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    Ok(Captured {
        stdout: String::from_utf8_lossy(&t1.join().unwrap_or_default()).into_owned(),
        stderr: String::from_utf8_lossy(&t2.join().unwrap_or_default()).into_owned(),
        code,
    })
}

pub fn kill_tree(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        // Negative pid = the whole process group created by process_group(0).
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        if let Some(root) = std::env::var_os("SystemRoot") {
            let taskkill = Path::new(&root).join("System32").join("taskkill.exe");
            let mut c = hidden_command(&taskkill);
            c.args(["/PID", &child.id().to_string(), "/T", "/F"]);
            let _ = c.stdout(Stdio::null()).stderr(Stdio::null()).status();
        }
    }
    let _ = child.kill();
}

pub enum Outcome {
    Exited(Option<i32>),
    Cancelled,
    TimedOut,
}

/// Run a command, streaming each output line to `on_line`, honouring a cancel
/// flag and an absolute deadline.
pub fn run_streaming(
    mut cmd: Command,
    cancel: &Arc<AtomicBool>,
    deadline: Instant,
    mut on_line: impl FnMut(&str, bool),
) -> std::io::Result<Outcome> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn()?;
    let (tx, rx) = mpsc::channel::<(String, bool)>();
    let so = child.stdout.take().unwrap();
    let se = child.stderr.take().unwrap();
    let tx2 = tx.clone();
    let r1 = std::thread::spawn(move || pump(so, false, tx));
    let r2 = std::thread::spawn(move || pump(se, true, tx2));

    let outcome = loop {
        while let Ok((line, err)) = rx.try_recv() {
            on_line(&line, err);
        }
        if let Some(st) = child.try_wait()? {
            break Outcome::Exited(st.code());
        }
        if cancel.load(Ordering::SeqCst) {
            kill_tree(&mut child);
            let _ = child.wait();
            break Outcome::Cancelled;
        }
        if Instant::now() > deadline {
            kill_tree(&mut child);
            let _ = child.wait();
            break Outcome::TimedOut;
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    let _ = r1.join();
    let _ = r2.join();
    while let Ok((line, err)) = rx.try_recv() {
        on_line(&line, err);
    }
    Ok(outcome)
}

fn pump(r: impl Read, is_err: bool, tx: mpsc::Sender<(String, bool)>) {
    let mut br = BufReader::new(r);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match br.read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buf).trim_end_matches(['\r', '\n']).to_string();
                if tx.send((line, is_err)).is_err() {
                    break;
                }
            }
        }
    }
}
