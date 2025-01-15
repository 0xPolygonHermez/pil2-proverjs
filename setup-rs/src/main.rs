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
        let base = if referrer.is_empty() {
            Url::parse("file:///").map_err(|err| {
                deno_core::error::ModuleLoaderError::Resolution(
                    deno_core::ModuleResolutionError::InvalidBaseUrl(err),
                )
            })?
        } else {
            Url::parse(referrer).map_err(|err| {
                deno_core::error::ModuleLoaderError::Resolution(
                    deno_core::ModuleResolutionError::InvalidBaseUrl(err),
                )
            })?
        };

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
        let path = module_specifier.path();
        let trimmed_path = path.strip_prefix('/').unwrap_or(path);

        if let Some(file) = JS_FILES.get_file(trimmed_path) {
            if let Some(source) = file.contents_utf8() {
                return deno_core::ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                    deno_core::ModuleType::JavaScript,
                    ModuleSourceCode::String(source.to_string().into()),
                    module_specifier,
                    None,
                )));
            }
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

    // Inject the require polyfill
    js_runtime.execute_script("require_polyfill.js", require_polyfill)?;

    // Inject and execute the entrypoint script
    js_runtime.execute_script("entrypoint.js", entrypoint_code)?;

    // Run the event loop
    js_runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
