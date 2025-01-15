use deno_core::{
    error::AnyError, JsRuntime, ModuleLoader, ModuleSource, ModuleSourceCode, ModuleSpecifier,
    RuntimeOptions,
};
use include_dir::{include_dir, Dir};
use std::rc::Rc;

const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

struct EmbeddedModuleLoader;

impl ModuleLoader for EmbeddedModuleLoader {
    fn resolve(
        &self,
        specifier: &str,
        referrer: &str,
        _kind: deno_core::ResolutionKind,
    ) -> Result<ModuleSpecifier, deno_core::error::ModuleLoaderError> {
        ModuleSpecifier::parse(specifier)
            .or_else(|_| ModuleSpecifier::from_file_path(specifier))
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
        let trimmed_path = path.strip_prefix('/').unwrap_or(path); // Strip leading `/`

        if let Some(file) = JS_FILES.get_file(trimmed_path) {
            if let Some(source) = file.contents_utf8() {
                deno_core::ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                    deno_core::ModuleType::JavaScript,
                    ModuleSourceCode::String(source.to_string().into()),
                    module_specifier,
                    None, // No caching
                )))
            } else {
                deno_core::ModuleLoadResponse::Sync(Err(
                    deno_core::error::ModuleLoaderError::Unsupported {
                        specifier: Box::new(module_specifier.clone()),
                        maybe_referrer: None,
                    },
                ))
            }
        } else {
            deno_core::ModuleLoadResponse::Sync(Err(deno_core::error::ModuleLoaderError::NotFound))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    let mut runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(EmbeddedModuleLoader)),
        ..Default::default()
    });

    // Reference the `setup_cmd.js` relative to `src` (embedded directory)
    runtime.execute_script("setup.js", r#"import './setup/setup_cmd.js';"#)?;

    runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
