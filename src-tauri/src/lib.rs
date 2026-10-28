mod commands;
mod error;

use commands::{
    cancel_job, convert_file, default_output_directory, document_tool, engine_status,
    expand_input_paths, get_file_info, open_feedback, open_result, preview_file, reveal_file,
    save_file, save_to_directory, zip_conversion_results, Jobs,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "vert_desktop_lib=info".into()),
        )
        .init();

    tauri::Builder::default()
        .manage(Jobs::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            default_output_directory,
            open_feedback,
            preview_file,
            open_result,
            convert_file,
            get_file_info,
            expand_input_paths,
            zip_conversion_results,
            save_file,
            save_to_directory,
            document_tool,
            reveal_file,
            engine_status,
            cancel_job
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
