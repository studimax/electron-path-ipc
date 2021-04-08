# electron-path-ipc
[![npm](https://img.shields.io/npm/v/electron-path-ipc)](https://www.npmjs.com/package/electron-path-ipc)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg?logo=google&logoColor=white)](https://github.com/google/gts)
[![Code: TypeScript](https://img.shields.io/badge/made%20with-typescript-blue.svg?logo=typescript&logoColor=white)](https://github.com/microsoft/TypeScript)
[![Made By: StudiMax](https://img.shields.io/badge/made%20by-studimax-red.svg)](https://github.com/studimax)

# Installation
```bash
# with npm
$ npm install electron-path-ipc
# with yarn
$ yarn add electron-path-ipc
```
# Usage
By default, the main process send a request to all renderer process.
```js
// main process
import {ipcMain} from 'electron-path-ipc';
ipcMain.on(':identifier/action', (headers,...args)=>{
    console.log(headers.params); // {identifier: 'my-identifier'}
    console.log(args); // ['hello world']
})

// renderer process
import {ipcRenderer} from 'electron-path-ipc';
ipcRenderer.send('my-identifier/action', 'hello world');
```
You can use invoke/handle in both main and renderer process.

```js
// main process
import {ipcMain} from 'electron-path-ipc';

ipcMain.handle(':identifier/action', (headers, arg) => {
    console.log(headers.params); // { identifier: 'my-identifier' }
    return `${arg} world !`
})

// renderer process
import {ipcRenderer} from 'electron-path-ipc';

ipcRenderer.invoke('my-identifier/action', 'hello')
    .then(console.log) // 'hello world'
```


