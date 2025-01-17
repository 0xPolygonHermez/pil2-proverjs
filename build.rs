use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;
use std::process::Command;
use walkdir::WalkDir;

fn hash_directory<P: AsRef<Path>>(directory: P) -> Result<String, io::Error> {
    let mut hasher = Sha256::new();

    let dir_ref = directory.as_ref(); // Borrow the directory reference once
    for entry in WalkDir::new(dir_ref) {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            // Hash the relative path
            if let Ok(relative_path) = path.strip_prefix(dir_ref) {
                hasher.update(relative_path.to_string_lossy().as_bytes());
            }

            // Hash the file contents
            let mut file = File::open(path)?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            hasher.update(&buffer);
        }
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn main() {
    println!("cargo:rerun-if-changed=update_binaries.sh");
    println!("cargo:rerun-if-changed=src");
    println!("cargo:rerun-if-changed=bin/src_hash");

    // Directories and hash file setup
    let current_dir = env::current_dir().expect("Failed to get current directory");
    let src_dir = current_dir.join("src");
    let bin_dir = current_dir.join("bin");
    let hash_file = bin_dir.join("src_hash");

    // Create the bin directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(&bin_dir) {
        build_print::error!("proofman-setup: Failed to create bin directory: {}", e);
        return;
    }

    // Generate the hash of the `src` directory
    let current_hash = match hash_directory(&src_dir) {
        Ok(hash) => hash,
        Err(e) => {
            build_print::error!("proofman-setup: Error hashing src directory: {}", e);
            return;
        }
    };

    // Check if the hash file exists and compare hashes
    if let Ok(stored_hash) = fs::read_to_string(&hash_file) {
        if stored_hash.trim() == current_hash {
            build_print::info!("proofman-setup: src directory is unchanged, skipping update.");
            return;
        }
    }

    // Save the current hash to the file
    if let Err(e) = fs::write(&hash_file, &current_hash) {
        build_print::error!("proofman-setup: Error writing hash to file: {}", e);
        return;
    }

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

    // Construct the path to `update_binaries.sh`
    let script_path = current_dir.join("update_binaries.sh");
    build_print::info!("proofman-setup: src dir has changed, rebuilding node binaries...");
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
    build_print::info!("proofman-setup: node binaries rebuilt successfully");
}
