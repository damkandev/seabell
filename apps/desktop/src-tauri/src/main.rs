// Evita la consola extra en Windows para builds de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Mutex, time::UNIX_EPOCH};

use tauri::{ipc::Response, AppHandle, Manager, State};

/// PDFs que el sistema pidió abrir ("Abrir con", doble clic) y que el frontend aún no importa.
/// `granted` limita `read_opened_pdf` a esas rutas: la webview no puede leer otros archivos.
#[derive(Default)]
struct Opened {
    pending: Mutex<Vec<PathBuf>>,
    granted: Mutex<Vec<PathBuf>>,
}

fn is_pdf(path: &PathBuf) -> bool {
    path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pdf")) && path.is_file()
}

/// Encola los PDFs, avisa al frontend y trae la ventana al frente.
fn open_pdfs(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    let paths: Vec<_> = paths.into_iter().filter(is_pdf).collect();
    if paths.is_empty() {
        return;
    }
    app.state::<Opened>().pending.lock().unwrap().extend(paths);
    if let Some(window) = app.get_webview_window("main") {
        // Si la página aún no carga, el frontend lee la cola al montar.
        let _ = window.eval("dispatchEvent(new Event('seabell:opened'))");
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Devuelve `[ruta, modificado en ms]` de cada PDF pendiente.
#[tauri::command]
fn opened_pdfs(opened: State<Opened>) -> Vec<(String, u64)> {
    let paths: Vec<_> = opened.pending.lock().unwrap().drain(..).collect();
    opened.granted.lock().unwrap().extend(paths.iter().cloned());
    paths
        .into_iter()
        .map(|path| {
            let modified = std::fs::metadata(&path)
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |since| since.as_millis() as u64);
            (path.to_string_lossy().into_owned(), modified)
        })
        .collect()
}

#[tauri::command]
fn read_opened_pdf(path: String, opened: State<Opened>) -> Result<Response, String> {
    let path = PathBuf::from(path);
    let mut granted = opened.granted.lock().unwrap();
    let index = granted.iter().position(|item| *item == path).ok_or("PDF no autorizado")?;
    granted.remove(index);
    drop(granted);
    std::fs::read(&path).map(Response::new).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        // Debe ir primero: una segunda instancia reenvía sus argumentos y se cierra.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            open_pdfs(app, argv.into_iter().skip(1).map(|arg| PathBuf::from(&cwd).join(arg)));
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Opened::default())
        .invoke_handler(tauri::generate_handler![opened_pdfs, read_opened_pdf])
        .setup(|app| {
            open_pdfs(app.handle(), std::env::args().skip(1).map(PathBuf::from));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Seabell")
        .run(|_app, _event| {
            // En macOS los archivos llegan como evento, no como argumentos.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                open_pdfs(_app, urls.into_iter().filter_map(|url| url.to_file_path().ok()));
            }
        });
}
