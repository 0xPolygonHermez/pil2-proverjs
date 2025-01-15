use deno_core::serde_json;
use deno_core::{error::AnyError, JsRuntime, RuntimeOptions};
use std::env;
use std::fs;
use tokio::runtime::Builder;

fn main() -> Result<(), AnyError> {
    // Read the JavaScript file
    let script_path = "./hello_world.js";
    let script_content =
        fs::read_to_string(script_path).expect("Failed to read the JavaScript file.");

    // Capture command-line arguments (excluding the binary name)
    let args: Vec<String> = env::args().skip(1).collect();

    // Build a single-threaded async runtime
    let runtime = Builder::new_current_thread().enable_all().build().unwrap();

    runtime.block_on(async {
        // Initialize the Deno runtime
        let mut js_runtime = JsRuntime::new(RuntimeOptions::default());

        // Inject command-line arguments into the JS environment
        let setup_script = format!(
            r#"
            globalThis.process = {{ argv: {} }};
            "#,
            serde_json::to_string(&args)?,
        );
        js_runtime.execute_script("setup.js", setup_script)?;

        // Execute the JavaScript file
        js_runtime.execute_script(script_path, script_content)?;

        // Await async tasks
        js_runtime.run_event_loop(Default::default()).await?;

        Ok(())
    })
}
