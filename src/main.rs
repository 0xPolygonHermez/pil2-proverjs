#[cfg(target_os = "linux")]
const EMBEDDED_BINARY: &[u8] = include_bytes!("../bin/proofman-setup-linux");

#[cfg(target_os = "macos")]
const EMBEDDED_BINARY: &[u8] = include_bytes!("../bin/proofman-setup-macos");

use std::env;
use std::io::{self, Write};
use std::process::{exit, Command, Stdio};
use tempfile::NamedTempFile;

fn proofman_setup(args: &[&str]) -> io::Result<()> {
    // Create a temporary file to hold the embedded binary
    let mut temp_file = NamedTempFile::new()?;

    // Write the embedded binary content to the temporary file
    temp_file.write_all(EMBEDDED_BINARY)?;

    // Make the temporary file executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = temp_file.as_file().metadata()?.permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        temp_file.as_file().set_permissions(perms)?;
    }

    // Get the current working directory
    let current_dir = env::current_dir()?;

    // Run the binary from the temporary file with arguments
    Command::new(temp_file.path())
        .current_dir(&current_dir) // Set the current directory for the process
        .args(args) // Pass the provided arguments
        .stdin(Stdio::inherit()) // Attach stdin
        .stdout(Stdio::inherit()) // Attach stdout
        .stderr(Stdio::inherit()) // Attach stderr
        .status() // Run the process and wait for it to finish
        .map(|status| if !status.success() { exit(1) } else { Ok(()) })?
}

fn main() {
    // Forward command-line arguments to the embedded binary
    let args: Vec<String> = env::args().skip(1).collect();
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    // Execute the embedded binary
    if let Err(e) = proofman_setup(&args_ref) {
        eprintln!("{}", e);
        std::process::exit(1); // Propagate error by exiting with a non-zero status code
    }
}
