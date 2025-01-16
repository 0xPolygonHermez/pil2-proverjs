use deno_core::error::ModuleLoaderError;
use deno_core::{
    error::AnyError, url::Url, JsRuntime, ModuleLoadResponse, ModuleLoader, ModuleSource,
    ModuleSourceCode, ModuleSpecifier, ResolutionKind, RuntimeOptions,
};
use include_dir::{include_dir, Dir};
use reqwest::Client;
use std::rc::Rc;

// Embed the JavaScript files
const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

fn node_module_url(module_name: &str) -> Option<String> {
    match module_name {
        "fs" => Some("https://deno.land/std@0.206.0/node/fs.ts".to_string()),
        "util" => Some("https://deno.land/std@0.206.0/node/util.ts".to_string()),
        "child_process" => Some("https://deno.land/std@0.206.0/node/child_process.ts".to_string()),
        "path" => Some("https://deno.land/std@0.206.0/node/path.ts".to_string()),
        _ => None,
    }
}

struct EmbeddedModuleLoader {
    client: Client,
}

impl EmbeddedModuleLoader {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    async fn fetch_remote_module(&self, url: &str) -> Result<String, AnyError> {
        println!("Fetching remote module: {}", url);
        let response = self.client.get(url).send().await?.text().await?;
        Ok(response)
    }

    fn fetch_embedded_module(&self, module_specifier: &ModuleSpecifier) -> ModuleLoadResponse {
        let path = module_specifier.path();
        let trimmed_path = path.trim_start_matches('/');

        if let Some(file) = JS_FILES.get_file(trimmed_path) {
            if let Some(source) = file.contents_utf8() {
                return ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                    deno_core::ModuleType::JavaScript,
                    ModuleSourceCode::String(source.to_string().into()),
                    module_specifier,
                    None,
                )));
            }
        }

        let available_files: Vec<_> = JS_FILES
            .files()
            .map(|file| file.path().display().to_string())
            .collect();
        eprintln!(
            "Module '{}' not found in embedded files. Available files:\n{}",
            trimmed_path,
            available_files.join("\n")
        );

        ModuleLoadResponse::Sync(Err(ModuleLoaderError::NotFound))
    }
}

impl ModuleLoader for EmbeddedModuleLoader {
    fn resolve(
        &self,
        specifier: &str,
        referrer: &str,
        _kind: ResolutionKind,
    ) -> Result<ModuleSpecifier, ModuleLoaderError> {
        let base = if referrer.is_empty() || !referrer.starts_with("file://") {
            Url::parse("file:///").map_err(|err| {
                ModuleLoaderError::Resolution(deno_core::ModuleResolutionError::InvalidBaseUrl(err))
            })?
        } else {
            Url::parse(referrer).map_err(|err| {
                ModuleLoaderError::Resolution(deno_core::ModuleResolutionError::InvalidBaseUrl(err))
            })?
        };

        base.join(specifier)
            .map_err(|_| ModuleLoaderError::NotFound)
    }

    fn load(
        &self,
        module_specifier: &ModuleSpecifier,
        _maybe_referrer: Option<&ModuleSpecifier>,
        _is_dyn_import: bool,
        _module_type: deno_core::RequestedModuleType,
    ) -> ModuleLoadResponse {
        if let Some(url) = node_module_url(module_specifier.path()) {
            match tokio::runtime::Handle::current().block_on(self.fetch_remote_module(&url)) {
                Ok(source) => {
                    return ModuleLoadResponse::Sync(Ok(ModuleSource::new(
                        deno_core::ModuleType::JavaScript,
                        ModuleSourceCode::String(source.into()),
                        module_specifier,
                        None,
                    )));
                }
                Err(e) => eprintln!("Failed to fetch remote module: {}", e),
            }
        }

        self.fetch_embedded_module(module_specifier)
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    let require_polyfill = include_str!("../require_polyfill.js");
    let entrypoint_code = include_str!("../entrypoint.js");

    let loader = Rc::new(EmbeddedModuleLoader::new());

    let mut js_runtime = JsRuntime::new(RuntimeOptions {
        module_loader: Some(loader),
        ..Default::default()
    });

    println!("Injecting require polyfill...");
    js_runtime
        .execute_script("require_polyfill.js", require_polyfill)
        .map_err(|e| {
            println!("Error injecting require polyfill: {:?}", e);
            e
        })?;

    println!("Injecting entrypoint script...");
    js_runtime
        .execute_script("entrypoint.js", entrypoint_code)
        .map_err(|e| {
            println!("Error injecting entrypoint script: {:?}", e);
            e
        })?;

    println!("Running event loop...");
    js_runtime.run_event_loop(Default::default()).await?;
    Ok(())
}
