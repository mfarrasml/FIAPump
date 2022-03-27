const { app, BrowserWindow, nativeImage, Menu } = require('electron');
const path = require('path');
const isMac = process.platform === 'darwin';

// variable for application icon
var image = nativeImage.createFromPath(__dirname + '/resources/icons/app_icon.ico');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

/** Function to start the application */
function boot() {
  let win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      devTools: false
    },
    // window size settings
    width: 1200,
    height: 900,
    minWidth: 1050,
    minHeight: 800,
    icon: image //set app icon image
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

//remove menu
Menu.setApplicationMenu(null);

// start application
app.on('ready', boot);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    boot();
  }
});