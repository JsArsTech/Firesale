const marked = require('marked');
const { remote, ipcRenderer, shell } = require('electron');
const { Menu } = remote;
const mainProcess = remote.require('./main.js');
const path = require('path');

let filePath = null;
let originalContent = '';



// context menu, appears when a user right-clicks the
// left editor pane
// recreate context menu each time is called and 
// enabled items based on whether  there is a filePath
const createContextMenu = () => {
	return Menu.buildFromTemplate([
		{ label: 'Open File', click() { mainProcess.getFileFrmUser(); } },
		// call the click functions directly because we're in the
		// renderer process
		{ 
			label: 'Show file in folder',
			click: showFile,
			enabled: !!filePath
		}, 
		{
			label: 'Open in default editor',
			click: openInDefaultApplication,
			enabled: !!filePath
		},
		{ type: 'separator' },
		{ label: 'Cut', role: 'cut' },
		{ label: 'Copy', role: 'copy' },
		{ label: 'Paste', role: 'paste' },
		{ label: 'Select All', role: 'selectall' }
	]);
}



const currentWindow = remote.getCurrentWindow();


const markdownView = document.querySelector('#markdown');
const htmlView = document.querySelector('#html');
const newFileButton = document.querySelector('#new-file');
const openFileButton = document.querySelector('#open-file');
const saveMarkdownButton = document.querySelector('#save-markdown');
const revertButton = document.querySelector('#revert');
const saveHtmlButton = document.querySelector('#save-html');
const showFileButton = document.querySelector('#show-file');
const openInDefaultButton = document.querySelector('#open-in-default');


const renderMarkdownToHtml = (markdown) => {
	htmlView.innerHTML = marked(markdown, { sanitize: true });
};


markdownView.addEventListener('keyup', (event) => {
	const currentContent = event.target.value;
	renderMarkdownToHtml(currentContent);
	updateUserInterface(currentContent !== originalContent);
});


markdownView.addEventListener('contextmenu', (event) => {
	event.preventDefault();
	createContextMenu().popup();
});

newFileButton.addEventListener('click', () => {
	mainProcess.createWindow();
});


saveHtmlButton.addEventListener('click', () => {
	mainProcess.saveHtml(currentWindow, htmlView.innerHTML);
});


saveMarkdownButton.addEventListener('click', () => {
	mainProcess.saveMarkdown(currentWindow, filePath, markdownView.value);
});


revertButton.addEventListener('click', () => {
	markdownView.value = originalContent;
	renderMarkdownToHtml(originalContent);
});


openFileButton.addEventListener('click', () => {
	mainProcess.getFileFromUser(currentWindow);
});


ipcRenderer.on('file-opened', (event, file, content) => { 

	if (currentWindow.isDocumentEdited()) 
	{
		const result = remote.dialog.showMessageBox(currentWindow, {
			type: 'warning',
			title: 'Overwrite Current Unsaved Changes?',
			message: 'Opening a new file in this window will overwrite your unsaved changes. Open this file anyway?',
			buttons: [
				'Yes',
				'Cancel'
			],
			defaultId: 0,
			cancelId: 1
		});

		if (result === 1)
			return;
	}

	renderFile(file, content);
}); 


ipcRenderer.on('file-changed', (event, file, content) => {

	const result = remote.dialog.showMessageBox(currentWindow, {
		type: 'warning',
		title: 'Overwrite Current Unsaved Changes?',
		buttons: [
			'Yes', 
			'Cancel'
		],
		defaultId: 0,
		cancelId: 1
	});

	if (result === 0)
		renderFile(file, content);
});


ipcRenderer.on('save-markdown', () => {
	mainProcess.saveMarkdown(currentWindow, filePath, 
		markdownView.value);
});


ipcRenderer.on('save-html', () => {
	mainProcess.saveHtml(currentWindow, filePath, 
		htmlView.innerHTML);
});





const updateUserInterface = (isEdited) => {
	
	let title = 'Fire Sale';

	if (filePath) {
		title = `${path.basename(filePath)} - ${title}`;
	}

	if (isEdited) {
		title = `${title} (Edited)`;
	}

	currentWindow.setTitle(title);
	currentWindow.setDocumentEdited(isEdited);

	saveMarkdownButton.disabled = !isEdited;
	revertButton.disabled = !isEdited;
};

/*
Prevent drag and drop on the browser window (document), 
the default behavior replaces the UI with the contents of the file
*/
document.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('dragleave', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

/*
Helper methods
*/
const getDraggedFile = (event) => event.dataTransfer.items[0];
const getDroppedFile = (event) => event.dataTransfer.files[0];

const fileTypeIsSupported = (file) => {
	return ['text/plain', 'text/markdown'].includes(file.type);
};


markdownView.addEventListener('dragover', (event) => {

	const file = getDraggedFile(event);

	if (fileTypeIsSupported(file)) {
		markdownView.classList.add('drag-over');
	}
	else {
		markdownView.classList.add('drag-error');
	}
});


markdownView.addEventListener('dragleave', () => {
	markdownView.classList.remove('drag-over');
	markdownView.classList.remove('drag-error');
});


markdownView.addEventListener('drop', (event) => {

	const file = getDroppedFile(event);

	if (fileTypeIsSupported(file)) {
		mainProcess.openFile(currentWindow, file.path);
	}
	else {
		alert('That file type is not supported');
	}

	markdownView.classList.remove('drag-over');
	markdownView.classList.remove('drag-error');
});

const renderFile = (file, content) => {
	filePath = file;
	originalContent = content;

	markdownView.value = content;
	renderMarkdownToHtml(content);

	// enable buttons when there is a file stored in the filesystem
	showFileButton.disabled = false;
	openInDefaultButton.disabled = false;

	updateUserInterface(false);
};

// event handler to showFileButton.click
const showFile = () => {

	// if filePath is not asigned showFileButton is disabled
	// this is a guard against errors
	if (!filePath) {
		return alert('This file has not been saved to the filesystem.');
	} 

	// open file in systems's native browser
	shell.showItemInFolder(filePath);
};

// event handler to openInDefaultButton.click
const openInDefaultApplication = () => {

	if (!filePath) {
		return alert('This is file has not been saved to the filesystem.');
	}

	// open file by the default application
	shell.openPath(filePath);
};

showFileButton.addEventListener('click', showFile);
openInDefaultButton.addEventListener('click', openInDefaultApplication);

// main process (menu) event listeners
ipcRenderer.on('show-file', showFile);
ipcRenderer.on('open-in-default', openInDefaultApplication);

