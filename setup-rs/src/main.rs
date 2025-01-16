use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use deno_core::{extension, op2, JsRuntime, RuntimeOptions};
use deno_fs::{FileSystem, RealFs};
use deno_node::NodeExtInitServices;
use deno_permissions::PermissionsContainer;
use include_dir::{include_dir, Dir};
use std::sync::Arc;
use sys_traits::impls::RealSys;

// Embed JavaScript files
const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

// Declare the `op_set_raw` operation
#[op2(fast)]
fn op_set_raw(is_raw: bool) {
    if is_raw {
        enable_raw_mode().unwrap();
    } else {
        disable_raw_mode().unwrap();
    }
}

// Register the operation in an extension
extension!(terminal, ops = [op_set_raw]);

struct EmbeddedModuleLoader;

impl EmbeddedModuleLoader {
    pub fn new() -> Self {
        Self
    }

    fn fetch_embedded_module(&self, module_specifier: &str) -> Option<String> {
        let trimmed_path = module_specifier.trim_start_matches('/');
        JS_FILES
            .get_file(trimmed_path)
            .and_then(|file| file.contents_utf8())
            .map(String::from)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create the file system service using `RealFs`
    let file_system: Arc<dyn FileSystem> = Arc::new(RealFs);

    // Initialize Node.js extensions with RealSys for system services
    let maybe_init: Option<NodeExtInitServices<RealSys>> = None;

    // Initialize extensions
    let webidl_extensions = deno_webidl::deno_webidl::init_ops_and_esm();
    let url_extensions = deno_url::deno_url::init_ops_and_esm();
    let console_extensions = deno_console::deno_console::init_ops_and_esm();
    let web_extensions = deno_web::deno_web::init_ops_and_esm::<PermissionsContainer>(
        Arc::new(deno_web::BlobStore::default()),
        None,
    );
    let io_extensions = deno_io::deno_io::init_ops_and_esm(Some(Default::default()));
    let fs_extensions =
        deno_fs::deno_fs::init_ops_and_esm::<PermissionsContainer>(file_system.clone());
    let node_extensions = deno_node::deno_node::init_ops_and_esm::<PermissionsContainer, RealSys>(
        maybe_init,
        file_system,
    );

    // Include the terminal extension
    let terminal_extensions = terminal::init_ops_and_esm();

    // Create the JavaScript runtime
    let mut js_runtime = JsRuntime::new(RuntimeOptions {
        extensions: vec![
            webidl_extensions,
            url_extensions,
            console_extensions,
            web_extensions,
            io_extensions,
            fs_extensions,
            node_extensions,
            terminal_extensions, // Add the terminal extension here
        ],
        ..Default::default()
    });

    // Load and execute `entrypoint.js`
    let loader = EmbeddedModuleLoader::new();

    if let Some(entrypoint_code) = loader.fetch_embedded_module("entrypoint.js") {
        js_runtime.execute_script("entrypoint.js", entrypoint_code)?;
    } else {
        panic!("Error: entrypoint.js not found in embedded files");
    }

    println!("Running event loop...");
    js_runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
