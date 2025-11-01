const { app, ipcMain, nativeTheme } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const rpc = require('discord-rich-presence')('1433958687621251132'); // Ton ID Discord

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let dev = process.env.NODE_ENV === 'dev';

/* === Chemins en mode dev === */
if (dev) {
    const appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    const appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata);
}

/* === Empêcher plusieurs instances === */
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    if (dev) return MainWindow.createWindow();
    UpdateWindow.createWindow();
});

/* === Gestion fenêtres === */
ipcMain.on('main-window-open', () => MainWindow.createWindow());
ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools());
ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload());
ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1));
ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2));
ipcMain.on('main-window-minimize', () => MainWindow.getWindow().minimize());

ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1));
ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2));

ipcMain.handle('path-user-data', () => app.getPath('userData'));
ipcMain.handle('appData', () => app.getPath('appData'));

ipcMain.on('main-window-maximize', () => {
    const win = MainWindow.getWindow();
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
});

ipcMain.on('main-window-hide', () => MainWindow.getWindow().hide());
ipcMain.on('main-window-show', () => MainWindow.getWindow().show());

/* === Auth Microsoft === */
ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
});

/* === Thème clair/sombre === */
ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return nativeTheme.shouldUseDarkColors;
});

/* === Quitter l’app === */
app.on('window-all-closed', () => app.quit());

/* === Mises à jour automatiques === */
autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
    return await new Promise((resolve, reject) => {
        autoUpdater.checkForUpdates().then(res => resolve(res)).catch(error => reject({ error: true, message: error }));
    });
});

autoUpdater.on('update-available', () => {
    const win = UpdateWindow.getWindow();
    if (win) win.webContents.send('updateAvailable');
});

ipcMain.on('start-update', () => autoUpdater.downloadUpdate());

autoUpdater.on('update-not-available', () => {
    const win = UpdateWindow.getWindow();
    if (win) win.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());

autoUpdater.on('download-progress', (progress) => {
    const win = UpdateWindow.getWindow();
    if (win) win.webContents.send('download-progress', progress);
});

autoUpdater.on('error', (err) => {
    const win = UpdateWindow.getWindow();
    if (win) win.webContents.send('error', err);
});

/* === Discord Rich Presence statique avec retry automatique === */
const discordStatus = {
    details: 'IriCraft',
    state: 'https://iricraft.site',
    startTimestamp: Date.now(),
    largeImageKey: 'logo', // Image de ton bot Discord
    largeImageText: 'IriCraft',
    buttons: [
        { label: '🌐 Site Web', url: 'https://iricraft.site' },
    ]
};

function setDiscordPresence() {
    try {
        rpc.updatePresence(discordStatus);
        console.log('✅ Discord RPC initialisé avec succès');
    } catch (err) {
        console.warn('⚠️ Impossible de se connecter à Discord RPC, réessai dans 10s');
        setTimeout(setDiscordPresence, 10000);
    }
}

// Lancer la mise à jour RPC
setDiscordPresence();
