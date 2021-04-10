import {assert, expect} from 'chai';
import {IpcMainEvent, WebContents} from 'electron';
import createIPCMock from 'electron-mock-ipc';

import {IpcMainType, IpcRendererType} from '../src';

const proxyquire: any = require('proxyquire');
const ipcMock = createIPCMock();

const mockWebContents: { webContents: WebContents }[] = [];
const {ipcMain, ipcRenderer}: { ipcMain: IpcMainType; ipcRenderer: IpcRendererType } = proxyquire('../src/index', {
    electron: {
        ipcMain: ipcMock.ipcMain,
        ipcRenderer: ipcMock.ipcRenderer,
        BrowserWindow: {
            getAllWindows() {
                return mockWebContents;
            },
        },
    },
});

describe('ipc', () => {
    before(done => {
        ipcMock.ipcMain.once('saveMockWebContentsSend', (event: IpcMainEvent) => {
            mockWebContents.push({webContents: event.sender});
            done();
        });
        ipcMock.ipcRenderer.send('saveMockWebContentsSend');
    });
    beforeEach(() => {
        ipcMain.removeAll()
        ipcRenderer.removeAll()
    });
    describe('ipcMain', () => {

        it('test ipcMain.prefix', async () => {
            ipcMain.prefix('test/').prefix('test/').handle('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            await ipcRenderer.prefix('test/').prefix('test/').invoke('test','hello');
        });

        it('test ipcMain.addListener', () => {
            ipcMain.addListener('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello');
        });

        it('test ipcMain.on', () => {
            ipcMain.on('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello');
        });

        it('test ipcMain.once', () => {
            ipcMain.once('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello');
        });

        it('test ipcMain.header', async () => {
            ipcMain
                .once('test/:id1/:id2', (headers) => {
                    expect(headers.params).to.be.eql({id1: 'a', id2: '2'});
                })
                .handle('test/:id1/:id2?', (headers) => {
                    expect(headers.params.id1).to.be.equal('a');
                    expect(headers.params.id2).to.be.undefined;
                })
                .handleOnce('test', (headers) => {
                    expect(headers.params).to.be.eql({});
                });
            ipcRenderer.send('test/a/2');
            await ipcRenderer.invoke('test/a');
            await ipcRenderer.invoke('test');
        });

        it('test ipcMain.eventNames', () => {
            ipcMain
                .addListener('test', () => {
                })
                .on('test2', () => {
                })
                .once('test3', () => {
                });
            expect(ipcMain.eventNames()).to.be.eql(['test', 'test2', 'test3']);
        });

        it('test ipcMain.handlerNames', () => {
            ipcMain
                .handle('test', () => {
                })
                .handle('test2', () => {
                })
                .handleOnce('test3', () => {
                });
            expect(ipcMain.handlerNames()).to.be.eql(['test', 'test2', 'test3']);
        });

        it('test ipcMain.handle', async () => {
            ipcMain.handle('test', (headers, args) => {
                return args + ' world';
            });
            expect(await ipcRenderer.invoke('test', 'hello')).to.be.equal('hello world');
        });

        it('test ipcMain.invoke no handler', async () => {
            try {
                await ipcMain.invoke('test', 'hello');
            } catch (e) {
                return assert.equal(e, "Error: No handler found for 'test'");
            }
            assert.fail('invoke must throw');
        });

        it('test ipcMain.handleOnce', async () => {
            ipcMain.handleOnce('test', (headers, args) => {
                return args + ' world';
            });
            expect(await ipcRenderer.invoke('test', 'hello')).to.be.equal('hello world');
            try {
                await ipcRenderer.invoke('test', 'hello');
            } catch (e) {
                return assert.match(e, /Error: No handler found for '(.*)'/);
            }
            assert.fail('invoke must throw');
        });

        it('test ipcMain.handle timeout', async () => {
            ipcMain.handle('test', (headers, args) => {
                return new Promise(resolve => {
                    setTimeout(resolve, 15000);
                });
            });
            try {
                await ipcRenderer.invoke('test', 'hello');
            } catch (e) {
                return assert.match(e, /Timeout for response with reqId '(.*)'/);
            }
            assert.fail('invoke must throw');
        }).timeout(15000);
    });
    describe('ipcRenderer', () => {

        it('test ipcRenderer.prefix', async () => {
            ipcRenderer.prefix('test/').prefix('test/').handle('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            await ipcMain.prefix('test/').prefix('test/').invoke('test','hello');
        });

        it('test ipcRenderer.addListener', () => {
            ipcRenderer.addListener('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test', 'hello');
        });

        it('test ipcRenderer.on', () => {
            ipcRenderer.on('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test', 'hello');
        });

        it('test ipcRenderer.once', () => {
            ipcRenderer.once('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test', 'hello');
        });

        it('test ipcRenderer.header', async () => {
            ipcRenderer
                .once('test/:id1/:id2', (headers) => {
                    expect(headers.params).to.be.eql({id1: 'a', id2: '2'});
                })
                .handle('test/:id1/:id2?', (headers) => {
                    expect(headers.params.id1).to.be.equal('a');
                    expect(headers.params.id2).to.be.undefined;
                })
                .handleOnce('test', (headers) => {
                    expect(headers.params).to.be.eql({});
                });
            ipcMain.send('test/a/2');
            await ipcMain.invoke('test/a');
            await ipcMain.invoke('test');
        });

        it('test ipcRenderer.eventNames', () => {
            ipcRenderer
                .addListener('test', () => {
                })
                .on('test2', () => {
                })
                .once('test3', () => {
                });
            expect(ipcRenderer.eventNames()).to.be.eql(['test', 'test2', 'test3']);
        });

        it('test ipcRenderer.handlerNames', () => {
            ipcRenderer
                .handle('test', () => {
                })
                .handle('test2', () => {
                })
                .handleOnce('test3', () => {
                });
            expect(ipcRenderer.handlerNames()).to.be.eql(['test', 'test2', 'test3']);
        });

        it('test ipcRenderer.handle', async () => {
            ipcRenderer.handle('test', (headers, args) => {
                return args + ' world';
            });
            expect(await ipcMain.invoke('test', 'hello')).to.be.equal('hello world');
        });

        it('test ipcRenderer.invoke no handler', async () => {
            try {
                await ipcRenderer.invoke('test', 'hello');
            } catch (e) {
                return assert;
            }
            assert.fail('invoke must throw');
        });

        it('test ipcRenderer.handleOnce', async () => {
            ipcRenderer.handleOnce('test', (headers, args) => {
                return args + ' world';
            });
            expect(await ipcMain.invoke('test', 'hello')).to.be.equal('hello world');
            try {
                await ipcMain.invoke('test', 'hello');
            } catch (e) {
                return assert;
            }
            assert.fail('invoke must throw');
        });

        it('test ipcRenderer.handle timeout', async () => {
            ipcRenderer.handle('test', (headers, args) => {
                return new Promise(resolve => {
                    setTimeout(resolve, 15000);
                });
            });
            try {
                await ipcMain.invoke('test', 'hello');
            } catch (e) {
                return assert.match(e, /Timeout for response with reqId '(.*)'/);
            }
            assert.fail('invoke must throw');
        }).timeout(15000);
    });
});
