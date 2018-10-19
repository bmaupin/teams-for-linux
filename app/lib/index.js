'use strict';
const windowStateKeeper = require('electron-window-state');
const path = require('path');
const { shell, app, ipcMain, BrowserWindow } = require('electron');
const login = require('./login');
const NativeNotification = require('electron-native-notification');
const Menus = require('./menus');

const teamsUrl = 'https://teams.microsoft.com/'
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36';

function createWindow(iconPath) {
  // Load the previous state with fallback to defaults
  let windowState = windowStateKeeper({
    defaultWidth: 0,
    defaultHeight: 0
  });

  // Create the window
  const window = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,

    width: windowState.width,
    height: windowState.height,

    show: false,
    iconPath,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icons', 'icon-96x96.png'),

    webPreferences: {
      partition: 'persist:teams-linux',
      preload: path.join(__dirname, 'browser', 'index.js'),
      nativeWindowOpen: true,
      plugins: true,
      nodeIntegration: false
    }
  });

  windowState.manage(window);
  window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
  }

  return window;
}

app.commandLine.appendSwitch('auth-server-whitelist', '*');
app.commandLine.appendSwitch('enable-ntlm-v2', 'true');

app.on('ready', () => {
  const iconPath = path.join(
    app.getAppPath(),
    'lib/assets/icons/icon-96x96.png'
  );
  let isFirstLoginTry = true;
  var window = createWindow(iconPath);
  let menus = new Menus(iconPath);
  menus.register(window);

  window.on('page-title-updated', (event, title) => {
    window.webContents.send('page-title', title)
  });

  // ipcMain.on('nativeNotificationClick', event => {
  //   console.log('nativeNotificationClick called');
  //   window.show();
  //   window.focus();
  // });

  ipcMain.on('notifications', async (e, msg) => {
    if (msg.count > 0) {
      const body = "You got " + msg.count + " notification(s). " + ((msg.text) ? " <i>" + msg.text + "</i> " : "");
      const notification = new NativeNotification(
        "Microsoft Teams",
        {
          "body": body,
          "icon": iconPath,
        });
      if (notification.show !== undefined) {
        notification.show();
      }
    }
  });

  window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
    console.error('did-fail-load. Please try to reload.');
    // window.reload();
  });

  window.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  window.webContents.on('login', (event, request, authInfo, callback) => {
    event.preventDefault();
    if (isFirstLoginTry) {
      isFirstLoginTry = false;
      login.loginService(window, callback);
    } else {
      isFirstLoginTry = true;
      app.relaunch();
      app.exit(0);
    }
  });

  window.webContents.setUserAgent(userAgent);

  window.once('ready-to-show', () => window.show());

  window.webContents.on('did-finish-load', function () {
    window.webContents.insertCSS('#download-mobile-app-button, #download-app-button, #get-app-button { display:none; }');
    window.webContents.insertCSS('.zoetrope { animation-iteration-count: 1 !important; }');
  });

  window.on('closed', () => window = null);

  window.loadURL(teamsUrl);
});