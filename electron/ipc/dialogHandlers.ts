import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';

export function registerDialogHandlers(): void {
  // Select Executable file (.exe)
  ipcMain.handle('dialog:selectExecutable', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow || undefined as any, {
      title: 'Select Game Executable',
      properties: ['openFile'],
      filters: [
        { name: 'Windows Executables (*.exe)', extensions: ['exe'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath, path.extname(filePath));
    const folderPath = path.dirname(filePath);

    // Humanize file name (e.g. "half_life_2" -> "Half Life 2")
    const suggestedName = fileName
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      filePath,
      suggestedName,
      folderPath,
    };
  });

  // Select Installation Folder
  ipcMain.handle('dialog:selectFolder', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow || undefined as any, {
      title: 'Select Game Installation Folder',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Select Cover / Background Image
  ipcMain.handle('dialog:selectImage', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow || undefined as any, {
      title: 'Select Artwork Image',
      properties: ['openFile'],
      filters: [
        { name: 'Image Files (*.jpg, *.png, *.webp)', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}
