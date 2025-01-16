use deno_core::{error::AnyError, JsRuntime, RuntimeOptions};
use deno_node::{deno_node, NodeExtInitServices, RealIsBuiltInNodeModuleChecker};
use deno_permissions::PermissionsContainer;
use include_dir::{include_dir, Dir};
use std::sync::Arc;
use sys_traits::impls::RealSys;

// Embed JavaScript files
const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

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
async fn main() -> Result<(), AnyError> {
    // Initialize Node.js extensions
    let maybe_init: Option<NodeExtInitServices<RealSys>> = None;
    let file_system = Arc::new(RealSys);
    let extensions =
        vec![deno_node::init_ops_and_esm::<PermissionsContainer, RealSys>(maybe_init, file_system)];

    // Create the JavaScript runtime
    let mut js_runtime = JsRuntime::new(RuntimeOptions {
        extensions,
        ..Default::default()
    });

    // Load and execute `require_polyfill.js`
    let loader = EmbeddedModuleLoader::new();

    // Load and execute `entrypoint.js`
    if let Some(entrypoint_code) = loader.fetch_embedded_module("entrypoint.js") {
        js_runtime.execute_script("entrypoint.js", entrypoint_code)?;
    } else {
        eprintln!("Error: entrypoint.js not found in embedded files");
        return Err(AnyError::msg("entrypoint.js missing"));
    }

    println!("Running event loop...");
    js_runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
