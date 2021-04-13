import {assert, expect} from 'chai';
import createIPCMock from 'electron-mock-ipc';
import {IpcMain,IpcRenderer} from "../src";
import {IpcMainEvent, WebContents} from "electron";


const proxyquire: any = require('proxyquire');
const ipcMock = createIPCMock();

const mockWebContents: { webContents: WebContents }[] = [];
const {ipcMain, ipcRenderer}: { ipcMain: IpcMain; ipcRenderer: IpcRenderer } = proxyquire('../src/index', {
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

        it('test ipcMain.prefix2', () => {
            ipcMain
                .on('A',()=>{});
            const prefix1 = ipcMain.prefix('B')
                .on('C',()=>{})
                .on('D',()=>{});
            const prefix2 = prefix1.prefix('E')
                .on('F',()=>{});

            expect(ipcMain.eventNames()).to.be.eql(['A','B/C','B/D', 'B/E/F']);
            expect(prefix1.eventNames()).to.be.eql(['C','D', 'E/F']);
            expect(prefix2.eventNames()).to.be.eql(['F']);
            prefix2.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql(['C','D']);
            expect(ipcMain.eventNames()).to.be.eql(['A','B/C','B/D']);
            prefix1.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql([]);
            expect(ipcMain.eventNames()).to.be.eql(['A']);
            ipcMain.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql([]);
            expect(ipcMain.eventNames()).to.be.eql([]);
        });

        it('test ipcMain.prefix3', () => {
            ipcMain
                .handle('A',()=>{});
            const prefix1 = ipcMain.prefix('B/')
                .handle('C',()=>{})
                .handle('D',()=>{});
            const prefix2 = prefix1.prefix('E/')
                .handle('F',()=>{});

            expect(ipcMain.handlerNames()).to.be.eql(['A','B/C','B/D', 'B/E/F']);
            expect(prefix1.handlerNames()).to.be.eql(['C','D', 'E/F']);
            expect(prefix2.handlerNames()).to.be.eql(['F']);
            prefix2.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql(['C','D']);
            expect(ipcMain.handlerNames()).to.be.eql(['A','B/C','B/D']);
            prefix1.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql([]);
            expect(ipcMain.handlerNames()).to.be.eql(['A']);
            ipcMain.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql([]);
            expect(ipcMain.handlerNames()).to.be.eql([]);
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

        it('test ipcRenderer.prefix2', () => {
            ipcRenderer
                .on('A',()=>{});
            const prefix1 = ipcRenderer.prefix('B/')
                .on('C',()=>{})
                .on('D',()=>{});
            const prefix2 = prefix1.prefix('E/')
                .on('F',()=>{});

            expect(ipcRenderer.eventNames()).to.be.eql(['A','B/C','B/D', 'B/E/F']);
            expect(prefix1.eventNames()).to.be.eql(['C','D', 'E/F']);
            expect(prefix2.eventNames()).to.be.eql(['F']);
            prefix2.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql(['C','D']);
            expect(ipcRenderer.eventNames()).to.be.eql(['A','B/C','B/D']);
            prefix1.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql([]);
            expect(ipcRenderer.eventNames()).to.be.eql(['A']);
            ipcRenderer.removeAll();
            expect(prefix2.eventNames()).to.be.eql([]);
            expect(prefix1.eventNames()).to.be.eql([]);
            expect(ipcRenderer.eventNames()).to.be.eql([]);
        });

        it('test ipcRenderer.prefix3', () => {
            ipcRenderer
                .handle('A',()=>{});
            const prefix1 = ipcRenderer.prefix('B/')
                .handle('C',()=>{})
                .handle('D',()=>{});
            const prefix2 = prefix1.prefix('E/')
                .handle('F',()=>{});

            expect(ipcRenderer.handlerNames()).to.be.eql(['A','B/C','B/D', 'B/E/F']);
            expect(prefix1.handlerNames()).to.be.eql(['C','D', 'E/F']);
            expect(prefix2.handlerNames()).to.be.eql(['F']);
            prefix2.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql(['C','D']);
            expect(ipcRenderer.handlerNames()).to.be.eql(['A','B/C','B/D']);
            prefix1.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql([]);
            expect(ipcRenderer.handlerNames()).to.be.eql(['A']);
            ipcRenderer.removeAll();
            expect(prefix2.handlerNames()).to.be.eql([]);
            expect(prefix1.handlerNames()).to.be.eql([]);
            expect(ipcRenderer.handlerNames()).to.be.eql([]);
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
