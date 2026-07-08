// Electron main process. Creates the window and loads the built game.
//
// Packaging layout (electron-builder, see package.json):
//   terrath/
//     terrath.exe
//     resources/app.asar   (the built dist/ lives here)
//     mods/                 (user mods, next to the .exe — read at runtime)
//
// In dev we load the Vite dev server; in production we load dist/index.html
// from inside the app bundle.

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

// Remove the default File/Edit/View menu bar.
Menu.setApplicationMenu(null);

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'Terrath',
        backgroundColor: '#028af8',
        webPreferences: {
            // The mod loader reaches the filesystem only through this preload's
            // narrow contextBridge API; the renderer itself has no Node access.
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // Toggle DevTools with F12 (handy in dev, harmless in production).
    win.webContents.on('before-input-event', (_e, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
            win.webContents.toggleDevTools();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
