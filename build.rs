use std::env;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=update_binaries.sh");
    println!("cargo:rerun-if-changed=src");
    // Check if `npm` is installed by attempting to run `npm -v`
    let npm_installed = Command::new("npm")
        .arg("-v")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if !npm_installed {
        build_print::info!("proofman-setup: npm not installed, using pre-compiled binaries");
        return;
    }

    // Get current dir
    let current_dir = env::current_dir()
        .expect("Failed to get current directory")
        .to_path_buf();

    // Construct the path to `update_binaries.sh`
    let script_path = current_dir.join("update_binaries.sh");

    if !script_path.exists() {
        build_print::error!(
            "proofman-setup: `update_binaries.sh` script not found in parent directory."
        );
        return;
    }

    // Run the `update_binaries.sh` script
    let status = Command::new("sh")
        .arg(script_path)
        .current_dir(&current_dir) // Set working directory to the parent directory
        .status()
        .expect("Failed to execute update_binaries.sh");

    if !status.success() {
        build_print::error!(
            "proofman-setup: `update_binaries.sh` script failed with status {:?}",
            status.code()
        );
        return;
    }
    build_print::info!("proofman-setup: node binaries are up-to-date");
}
