use deno_core::{
    error::AnyError, url::Url, JsRuntime, ModuleLoader, ModuleSource, ModuleSourceCode,
    ModuleSpecifier, ResolutionKind, RuntimeOptions,
};
use include_dir::{include_dir, Dir};
use std::rc::Rc;

// Embed the JavaScript files
const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

// Custom module loader for embedded JavaScript files
struct EmbeddedModuleLoader;

impl ModuleLoader for EmbeddedModuleLoader {
    fn resolve(
        &self,
        specifier: &str,
        referrer: &str,
        _kind: ResolutionKind,
    ) -> Result<ModuleSpecifier, deno_core::error::ModuleLoaderError> {
        println!(
            "Resolving specifier: '{}' with referrer: '{}'",
            specifier, referrer
        );

        // Use "file:///src/" as the base URL for resolution
        let base = Url::parse("file:///src/").unwrap();

        base.join(specifier)
            .map_err(|_| deno_core::error::ModuleLoaderError::NotFound)
    }

    fn load(
        &self,
        module_specifier: &ModuleSpecifier,
        _maybe_referrer: Option<&ModuleSpecifier>,
        _is_dyn_import: bool,
        _module_type: deno_core::RequestedModuleType,
    ) -> deno_core::ModuleLoadResponse {
        let path = module_specifier
            .path()
            .strip_prefix("/src/")
            .unwrap_or(module_specifier.path());
        println!("Loading module: '{}'", path);

        if let Some(file) = JS_FILES.get_file(path) {
            let source = file.contents();
            return deno_core::ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                deno_core::ModuleType::JavaScript,
                ModuleSourceCode::Bytes(source.into()),
                module_specifier,
                None,
            )));
        }

        println!(
            "Module '{}' not found in embedded files. Available files:",
            path
        );
        for file in JS_FILES.files() {
            println!("- {}", file.path().display());
        }

        deno_core::ModuleLoadResponse::Sync(Err(deno_core::error::ModuleLoaderError::NotFound))
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    // Include the require polyfill and entrypoint code
    let require_polyfill = include_str!("../require_polyfill.js");
    let entrypoint_code = include_str!("../entrypoint.js");

    // Initialize the runtime with the custom module loader
    let mut js_runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(EmbeddedModuleLoader)),
        ..Default::default()
    });

    println!("Embedded files:");
    for file in JS_FILES.files() {
        println!("- {}", file.path().display());
    }

    // Inject the require polyfill
    println!("Injecting require polyfill...");
    js_runtime.execute_script("require_polyfill.js", require_polyfill)?;

    // Inject and execute the entrypoint script
    println!("Injecting entrypoint script...");
    js_runtime.execute_script("entrypoint.js", entrypoint_code)?;

    println!("Running event loop...");
    js_runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
