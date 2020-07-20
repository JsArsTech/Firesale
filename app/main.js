const { app, BrowserWindow, dialog, Menu } = require('electron');
const applicationMenu = require('./application-menu');
const fs = require('fs');

const windows = new Set();

const openFiles = new Map();

let mainWindow = null;


app.on('ready', () => { 
	Menu.setApplicationMenu(applicationMenu);
	createWindow();
});


app.on('window-all-closed', () => {

	console.log(process.platform);
	
	if (process.platform === 'darwin') {
		return false;
	}
	app.quit();
});


app.on('activate', (event, hasVisibleWinodws) => {
	if (!hasVisibleWinodws) {
		createWindow();
	}
});


app.on('will-finish-launching', () => {
	app.on('open-file', (event, file) => {
		const win = createWindow();
		win.once('ready-to-show', () => {
			openFile(win, file);
		});
	});
});

const getFileFromUser = (targetWindow) => {

	const result = dialog.showOpenDialog(targetWindow, {
		properties: ['openFile'],
		defaultPath: app.getPath('documents'),
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


const saveHtml = (targetWindow, content) => {

	const result = dialog.showSaveDialog(targetWindow, {
		title: 'Save HTML',
		defaultPath: app.getPath('documents'),
		filters: [
			{ name: 'HTML Files', extensions: ['html', 'htm'] }
		]
	});

	if (result) {
		result.then(data => {
			if (!data.canceled) {
				fs.writeFileSync(data.filePaths[0]);
			}
		})
	}	
};


const saveMarkdown = (targetWindow, file, content) => {
	
	if (!file) {
		file = dialog.showSaveDialogSync(targetWindow, {
			title: 'Save Markdown',
			defaultPath: app.getPath('documents'),
			filters: [
				{ name: 'Markdown Files', extensions: [ 'md', 'markdown' ] }
			]
		});
	}

	if (!file) 
		return;

	fs.writeFileSync(file, content);
	openFile(targetWindow, file);	
};


const openFile = (targetWindow, file) => {
	const content = fs.readFileSync(file).toString();
	app.addRecentDocument(file);
	targetWindow.setRepresentedFilename(file);
	targetWindow.webContents.send('file-opened', file, content);
};


const createWindow = () => {

	let x = 0, y = 0;

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

	newWindow.once('ready-to-show', newWindow.show);

	newWindow.on('close', (event) => {

		if (newWindow.isDocumentEdited()) {
			event.preventDefault();

			const result = dialog.showMessageBoxSync(newWindow, {
				type: 'warning',
				title: 'Quit with Unsaved Changes?',
				message: 'Your changes will be lost if you do not save.',
				button: [
					'Quit Anyway',
					'Cancel'
				],
				defaultId: 0,
				cancelId: 1
			});

			if (result === 0)
				newWindow.destroy();
		}
	});

	newWindow.on('closed', (event) => {
		windows.delete(newWindow);
		stopWatchingFile(newWindow);
		newWindow = null;
	});

	windows.add(newWindow);
	return newWindow;
};


const startWatchingFile = (targetWindow, file) => {

	stopWatchingFile(targetWindow);

	const watcher = fs.watchFile(file, (event) => {
		if (event === 'change') {
			const content = fs.readFileSync(file);
			targetWindow.webContents.send('file-changed', file, content);
		}
	});

	openFiles.set(targetWindow, watcher);
};


const stopWatchingFile = (targetWindow) => {

	if (openFiles.has(targetWindow)) {
		openFiles.get(targetWindow).stop();
		openFiles.delete(targetWindow);
	}
};



exports.getFileFromUser = getFileFromUser; 
exports.createWindow = createWindow
exports.saveHtml = saveHtml;
exports.saveMarkdown = saveMarkdown;
exports.openFile = openFile
