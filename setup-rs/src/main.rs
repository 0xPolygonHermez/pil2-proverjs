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
            .map_err(|e| deno_core::error::ModuleLoaderError::ResolutionError(e.into()))
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
                deno_core::ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                    deno_core::ModuleType::JavaScript,
                    ModuleSourceCode::Text(source.to_string()),
                    module_specifier,
                    None, // No caching
                )))
            } else {
                deno_core::ModuleLoadResponse::Sync(Err(
                    deno_core::error::ModuleLoaderError::LoadingError(
                        anyhow::anyhow!("File is not valid UTF-8: {}", trimmed_path).into(),
                    ),
                ))
            }
        } else {
            deno_core::ModuleLoadResponse::Sync(Err(
                deno_core::error::ModuleLoaderError::LoadingError(
                    anyhow::anyhow!("Module not found: {}", trimmed_path).into(),
                ),
            ))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    let mut runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(Rc::new(EmbeddedModuleLoader)),
        ..Default::default()
    });

    runtime.execute_script(
        "setup.js",
        r#"import 'src/setup/setup_cmd.js';"#, // Adjusted for your use case
    )?;

    runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
