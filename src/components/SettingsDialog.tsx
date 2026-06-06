import type { Ref } from "preact";

export type SettingsDialogMode = "export" | "import";

export type SettingsDialogState = {
  open: boolean;
  mode: SettingsDialogMode;
  text: string;
  help: string;
  error: string;
  success: boolean;
};

export function closedSettingsDialog(): SettingsDialogState {
  return {
    open: false,
    mode: "import",
    text: "",
    help: "Paste a CS Venues settings JSON, then import it.",
    error: "",
    success: false,
  };
}

export function SettingsDialog(props: {
  dialogRef: Ref<HTMLDialogElement>;
  textRef: Ref<HTMLTextAreaElement>;
  dialog: SettingsDialogState;
  onTextChange: (text: string) => void;
  onClose: () => void;
  onImportFile: () => void;
  onCopy: () => void;
  onSave: () => void;
  onImport: () => void;
}) {
  const exportMode = props.dialog.mode === "export";
  return (
    <dialog ref={props.dialogRef} id="settingsDialog" class="settings-dialog" onCancel={props.onClose} onClose={props.onClose}>
      <form method="dialog">
        <div class="dialog-head">
          <h2 id="settingsDialogTitle">{exportMode ? "Export settings" : "Import settings"}</h2>
          <button type="button" id="settingsDialogClose" class="dialog-close" aria-label="Close" onClick={props.onClose}>×</button>
        </div>
        <textarea ref={props.textRef} id="settingsText" spellcheck={false} autocomplete="off" readOnly={exportMode} value={props.dialog.text} onInput={(event) => props.onTextChange(event.currentTarget.value)} />
        <p id="settingsHelp" class={`dialog-help ${props.dialog.success ? "success" : ""}`}>
          {props.dialog.success
            ? (
              <>
                <span class="status-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="M3.2 8.4 6.4 11.6 12.8 4.8" />
                  </svg>
                </span>
                <span>{props.dialog.help}</span>
              </>
            )
            : props.dialog.help}
        </p>
        <p id="settingsError" class="dialog-error" hidden={!props.dialog.error}>{props.dialog.error}</p>
        <div class="dialog-actions">
          <button type="button" id="settingsImportFile" hidden={exportMode} onClick={props.onImportFile}>Import file...</button>
          <button type="button" id="settingsCopy" hidden={!exportMode} onClick={props.onCopy}>Copy</button>
          <button type="button" id="settingsSaveFile" hidden={!exportMode} onClick={props.onSave}>Save file...</button>
          <button type="button" id="settingsCancel" onClick={props.onClose}>{exportMode ? "Close" : "Cancel"}</button>
          <button type="button" id="settingsImport" class="primary-action" hidden={exportMode} onClick={props.onImport}>Import</button>
        </div>
      </form>
    </dialog>
  );
}
