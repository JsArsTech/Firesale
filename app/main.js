const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');

const windows = new Set();

let mainWindow = null;

app.on('ready', () => {
	createWindow();
});

app.on('window-all-closed', () => {

	console.log(process.platform);
	
	if (process.platform === 'darwin') {
		return false;
	}
});

app.on('activate', (event, hasVisibleWinodws) => {
	if (!hasVisibleWinodws) {
		createWindow();
	}
});


const getFileFromUser = (targetWindow) => {

	const result = dialog.showOpenDialog(targetWindow, {
		properties: ['openFile'],
		filters: [
			{ name: 'Text Files', extensions: ['txt'] },
			{ name: 'Markdown Files', extensions: ['md', 'markdown'] }
		]
	});

	if (result) {
		result.then(data => {
			if (!data.canceled) {
				openFile(targetWindow, data.filePaths[0]);
			}
		}).catch(console.log);
	}
};

const openFile = (targetWindow, file) => {
	const content = fs.readFileSync(file).toString();
	targetWindow.webContents.send('file-opened', file, content);
};


const createWindow = () => {

	let x, y;

	const currentWindow = BrowserWindow.getFocusedWindow();

	if (currentWindow) {
		const [ currentWindowX, currentWindowY ] = 
			currentWindow.getPosition();
		x = currentWindowX + 10;
		y = currentWindowY + 10;
	}


	let newWindow = new BrowserWindow({ 
		show: false,
		x, 
		y,
		webPreferences: {
			nodeIntegration: true
		}
	});

	newWindow.loadFile('index.html');

	newWindow.once('ready-to-show', () => {
		newWindow.show();
	});

	newWindow.on('closed', () => {
		windows.delete(newWindow);
		newWindow = null;
	});

	windows.add(newWindow);
	return newWindow;
};


exports.getFileFromUser = getFileFromUser; 
exports.createWindow = createWindow;