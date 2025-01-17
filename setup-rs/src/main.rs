use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use deno_cache::SqliteBackedCache;
use deno_core::{extension, op2};
use deno_fs::{FileSystem, RealFs};
use deno_node::NodeExtInitServices;
use deno_permissions::PermissionsContainer;
use include_dir::{include_dir, Dir};
use std::sync::Arc;
use sys_traits::impls::RealSys;

use std::path::Path;
use std::rc::Rc;

use deno_core::error::AnyError;
use deno_core::FsModuleLoader;
use deno_core::ModuleSpecifier;
use deno_resolver::npm::DenoInNpmPackageChecker;
use deno_resolver::npm::NpmResolver;
use deno_runtime::permissions::RuntimePermissionDescriptorParser;
use deno_runtime::worker::MainWorker;
use deno_runtime::worker::WorkerOptions;
use deno_runtime::worker::WorkerServiceOptions;

// // Embed JavaScript files
// const JS_FILES: Dir = include_dir!("$CARGO_MANIFEST_DIR/../src");

// struct EmbeddedModuleLoader;

// impl EmbeddedModuleLoader {
//     pub fn new() -> Self {
//         Self
//     }

//     fn fetch_embedded_module(&self, module_specifier: &str) -> Option<String> {
//         let trimmed_path = module_specifier.trim_start_matches('/');
//         JS_FILES
//             .get_file(trimmed_path)
//             .and_then(|file| file.contents_utf8())
//             .map(String::from)
//     }
// }

// // Declare the `op_set_raw` operation
// #[op2(fast)]
// fn op_set_raw(is_raw: bool) {
//     if is_raw {
//         enable_raw_mode().unwrap();
//     } else {
//         disable_raw_mode().unwrap();
//     }
// }

// // Register the terminal extension
// extension!(terminal, ops = [op_set_raw]);

// // Register the `primordials` extension
// extension!(
//     primordials,
//     esm = [r#"ext:primordials_polyfill"# = {
//         source = r#"
//         globalThis.primordials = {
//             SafeRegExp: RegExp,
//             RegExpPrototypeTest: RegExp.prototype.test.bind(RegExp.prototype),
//             Symbol,
//         };
//         "#
//     }]
// );

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    let js_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/main_setup.js");
    let main_module = ModuleSpecifier::from_file_path(js_path).unwrap();
    eprintln!("Running {main_module}...");
    let fs = Arc::new(RealFs);
    let permission_desc_parser = Arc::new(RuntimePermissionDescriptorParser::new(
        sys_traits::impls::RealSys,
    ));
    // Create the file system service using `RealFs`
    //let file_system: Arc<dyn FileSystem> = Arc::new(RealFs);

    // // Initialize Node.js extensions with RealSys for system services
    // let maybe_init: Option<
    //     NodeExtInitServices<DenoInNpmPackageChecker, NpmResolver<RealSys>, RealSys>,
    // > = None;

    // // Initialize extensions
    // let webidl_extensions = deno_webidl::deno_webidl::init_ops_and_esm();
    // let url_extensions = deno_url::deno_url::init_ops_and_esm();
    // let console_extensions = deno_console::deno_console::init_ops_and_esm();
    // let web_extensions = deno_web::deno_web::init_ops_and_esm::<PermissionsContainer>(
    //     Arc::new(deno_web::BlobStore::default()),
    //     None,
    // );
    // let io_extensions = deno_io::deno_io::init_ops_and_esm(Some(Default::default()));
    // let fs_extensions =
    //     deno_fs::deno_fs::init_ops_and_esm::<PermissionsContainer>(file_system.clone());
    // let node_extensions = deno_node::deno_node::init_ops_and_esm::<
    //     PermissionsContainer,
    //     DenoInNpmPackageChecker,
    //     _,
    //     _,
    // >(maybe_init, file_system);
    // let tls_extensions = deno_tls::deno_tls::init_ops_and_esm();
    // let fetch_extensions = deno_fetch::deno_fetch::init_ops_and_esm::<PermissionsContainer>(
    //     deno_fetch::Options::default(),
    // );
    // let cache_extensions =
    //     deno_cache::deno_cache::init_ops_and_esm::<SqliteBackedCache>(Default::default());
    // //let ws_extensions = deno_websocket::deno_websocket::init_ops_and_esm();

    // // Include the terminal and primordials extensions
    // let terminal_extensions = terminal::init_ops_and_esm();
    // let primordials_extensions = primordials::init_ops_and_esm();

    let mut worker = MainWorker::bootstrap_from_options(
        &main_module,
        WorkerServiceOptions::<
            DenoInNpmPackageChecker,
            NpmResolver<sys_traits::impls::RealSys>,
            sys_traits::impls::RealSys,
        > {
            module_loader: Rc::new(FsModuleLoader),
            permissions: PermissionsContainer::allow_all(permission_desc_parser),
            blob_store: Default::default(),
            broadcast_channel: Default::default(),
            feature_checker: Default::default(),
            node_services: Default::default(),
            npm_process_state_provider: Default::default(),
            root_cert_store_provider: Default::default(),
            fetch_dns_resolver: Default::default(),
            shared_array_buffer_store: Default::default(),
            compiled_wasm_module_store: Default::default(),
            v8_code_cache: Default::default(),
            fs,
        },
        WorkerOptions {
            extensions: vec![
                //primordials_extensions, // Ensure primordials are loaded first
                //webidl_extensions,
                //url_extensions,
                //console_extensions,
                //web_extensions,
                //io_extensions,
                //fs_extensions,
                //node_extensions,
                //terminal_extensions,
                //tls_extensions,
                //fetch_extensions,
                //cache_extensions,
                deno_runtime::runtime::init_ops_and_esm(),
            ],
            ..Default::default()
        },
    );
    worker.execute_main_module(&main_module).await?;
    worker.run_event_loop(false).await?;
    Ok(())
}
