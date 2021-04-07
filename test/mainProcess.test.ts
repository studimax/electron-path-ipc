import {assert, expect} from 'chai';
import createIPCMock  from 'electron-mock-ipc';
import {IpcMainType, IpcRendererType} from "../src";
import {IpcMainEvent, WebContents} from "electron";

const proxyquire: any = require('proxyquire');
const ipcMock = createIPCMock();

const mockWebContents: {webContents:WebContents}[] = [];
const {ipcMain,ipcRenderer}: {ipcMain:IpcMainType, ipcRenderer:IpcRendererType} = proxyquire('../src/index', {
    electron: {
        ipcMain:ipcMock.ipcMain,
        ipcRenderer:ipcMock.ipcRenderer,
        BrowserWindow:{
            getAllWindows(){
                return mockWebContents
            }
        }
    }
});

describe('ipc', () => {
    before((done) => {
        ipcMock.ipcMain.once('saveMockWebContentsSend', (event: IpcMainEvent) => {
            mockWebContents.push({webContents:event.sender})
            done();
        });
        ipcMock.ipcRenderer.send('saveMockWebContentsSend');
    });
    afterEach(()=>{
        ipcMain.removeAllListeners();
        ipcMain.removeHandler();

        ipcRenderer.removeAllListeners();
        ipcRenderer.removeHandler();
    })
    describe('ipcMain', () => {

        it('test ipcMain.addListener', () => {
            ipcMain.addListener('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello')
        })

        it('test ipcMain.on', () => {
            ipcMain.on('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello')
        })

        it('test ipcMain.once', () => {
            ipcMain.once('test', (headers, ...args) => {
                expect(args).to.be.eql(['hello']);
            });
            ipcRenderer.send('test', 'hello')
        })

        it('test ipcMain.handle', async () => {
            ipcMain.handle('test', (headers, args) => {
                return args + ' world'
            });
            expect(await ipcRenderer.invoke('test', 'hello')).to.be.equal('hello world')
        })

        it('test ipcMain.invoke no handler', async () => {
            try{
                await ipcMain.invoke('test', 'hello')
            }catch (e) {
                return assert.equal(e, "Error: No handler found for 'test'")
            }
            assert.fail( 'invoke must throw')
        })

        it('test ipcMain.handleOnce', async () => {
            ipcMain.handleOnce('test', (headers, args) => {
                return args + ' world'
            });
            expect(await ipcRenderer.invoke('test', 'hello')).to.be.equal('hello world')
            try{
                await ipcRenderer.invoke('test', 'hello')
            }catch (e) {
                return assert.equal(e, "Error: No handler found for 'test'")
            }
            assert.fail( 'invoke must throw')
        })
    });
    describe('ipcRenderer', () => {
        it('test ipcRenderer.addListener', ()=>{
            ipcRenderer.addListener('test',(headers,...args)=>{
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test','hello')
        })

        it('test ipcRenderer.on', ()=>{
            ipcRenderer.on('test',(headers,...args)=>{
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test','hello')
        })

        it('test ipcRenderer.once', ()=>{
            ipcRenderer.once('test',(headers,...args)=>{
                expect(args).to.be.eql(['hello']);
            });
            ipcMain.send('test','hello')
        })

        it('test ipcRenderer.handle', async ()=>{
            ipcRenderer.handle('test',(headers,args)=>{
                return args+' world'
            });
            expect(await ipcMain.invoke('test','hello')).to.be.equal('hello world')
        })

        it('test ipcRenderer.invoke no handler', async () => {
            try{
                await ipcRenderer.invoke('test', 'hello')
            }catch (e) {
                return assert
            }
            assert.fail( 'invoke must throw')
        })

        it('test ipcRenderer.handleOnce', async () => {
            ipcRenderer.handleOnce('test', (headers, args) => {
                return args + ' world'
            });
            expect(await ipcMain.invoke('test', 'hello')).to.be.equal('hello world')
            try{
                await ipcMain.invoke('test', 'hello')
            }catch (e) {
                return assert
            }
            assert.fail( 'invoke must throw')
        })
    });
});

