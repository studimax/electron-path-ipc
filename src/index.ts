import electron, {IpcMainEvent, IpcRendererEvent} from 'electron';
import EventEmitter from 'events';
import {match, pathToRegexp} from 'path-to-regexp';
import * as uuid from 'uuid';

type HandleListener = (headers: IpcHeaders, ...args: any[]) => Promise<any> | any;
type Listener = (headers: IpcHeaders, ...args: any[]) => any;
type IpcHeaders = {
  reqId: string;
  handler?: true;
  resId?: string;
  error?: Error;
  params?: {[key: string]: string};
  [key: string]: any;
};

interface IpcRequest {
  path: string;
  headers: IpcHeaders;
  args: any[];
}

abstract class Ipc extends EventEmitter {
  private readonly eventList = new Map<string, {regexp: RegExp; listeners: Listener[]}>();
  private readonly handlerList = new Map<string, {regexp: RegExp; listener: HandleListener}>();
  private readonly handlerEvent = new EventEmitter();
  private readonly responseEvent = new EventEmitter();

  constructor() {
    super();
    this.init();
  }

  protected abstract init(): void;

  protected onRequest(event: IpcMainEvent | IpcRendererEvent, path: string, headers: IpcHeaders, ...args: any[]) {
    this.eventList.forEach(({regexp}, eventName) => {
      if (regexp.test(path)) {
        const result = match<{[key: string]: string}>(eventName)(path);
        headers.params = result ? result.params : {};
        this.emit(eventName, headers, ...args);
      }
    });

    if (headers.handler && !Array.from(this.handlerList.entries())
        .map(([eventName, {regexp}]) => {
          if (regexp.test(path)) {
            const result = match<{ [key: string]: string }>(eventName)(path);
            headers.params = result ? result.params : {};
            return this.handlerEvent.emit(eventName, headers, ...args);
          }
          return false;
        })
        .some(t => t)) {
      this.respond(headers.reqId, path, new Error(`No handler found for '${path}'`));
    }
    if (headers.resId) {
      this.responseEvent.emit(headers.resId, headers, ...args);
    }
  }

  public removeListener(path: string, listener: (...args: any[]) => void): this {
    const entry = this.eventList.get(path);
    if (entry) {
      entry.listeners = entry.listeners.filter(l => l !== listener);
      if (entry.listeners.length <= 0) this.eventList.delete(path);
    }
    super.removeListener(path, listener);
    return this;
  }

  public removeAllListeners(path?: string): this {
    if (path) this.eventList.delete(path);
    else this.eventList.clear();
    super.removeAllListeners(path);
    return this;
  }

  public addListener(path: string, listener: (...args: any[]) => void): this {
    return this.on(path, listener);
  }

  public on(path: string, listener: Listener): this {
    if (!this.eventList.get(path)?.listeners.push(listener)) {
      this.eventList.set(path, {regexp: pathToRegexp(path), listeners: [listener]});
    }
    super.on(path, listener);
    return this;
  }

  public off(path: string, listener: (...args: any[]) => void): this {
    return this.removeListener(path, listener);
  }

  public once(path: string, listener: Listener): this {
    super.once(path, listener);
    return this;
  }

  public send(path: string, ...args: any[]): void {
    this.sendRequest(path, {}, ...args);
  }

  public respond(reqId: string, path: string, error: Error | undefined, ...args: any[]): void;
  public respond(reqId: string, path: string, ...args: any[]): void {
    const error = args[0] instanceof Error ? args.shift() : undefined;
    this.sendRequest(path, {resId: reqId, error}, ...args);
  }

  public handle(path: string, listener: HandleListener) {
    if (this.handlerList.has(path)) throw new Error(`Attempted to register a second handler for '${path}'`);
    this.handlerList.set(path, {regexp: pathToRegexp(path), listener});
    this.handlerEvent.on(path, async (headers: IpcHeaders, ...args: any[]) => {
      const response = await listener(headers, ...args);
      this.respond(headers.reqId, path, response);
    });
  }

  public handleOnce(path: string, listener: HandleListener) {
    this.handle(path, (headers: IpcHeaders, ...args: any[]) => {
      this.removeHandler(path);
      return listener(headers, ...args);
    });
  }

  public removeHandler(path?: string): void {
    if (path) this.handlerList.delete(path);
    else this.handlerList.clear();
    this.handlerEvent.removeAllListeners(path);
  }

  protected onResponse<T = any>(reqId: string): Promise<T> {
    return new Promise((resolve, reject) =>
      this.responseEvent.once(reqId, (header, args) => (header.error ? reject(header.error) : resolve(args)))
    );
  }

  public invoke<T = any>(path: string, ...args: any[]): Promise<T> {
    const req = this.sendRequest(path, {handler: true}, ...args);
    return this.onResponse(req.headers.reqId);
  }

  protected sendRequest(path: string, headers: Partial<IpcHeaders>, ...args: any[]): IpcRequest {
    const req: IpcRequest = {path, headers: {...headers, reqId: uuid.v4()}, args};
    return req;
  }
}

class IpcMain extends Ipc {
  protected init() {
    electron.ipcMain.on('request', this.onRequest.bind(this));
  }

  protected onRequest(event: IpcMainEvent, path: string, headers: IpcHeaders, ...args: any[]) {
    super.onRequest(event, path, headers, ...args);
  }

  protected sendRequest(path: string, headers: Partial<IpcHeaders>, ...args: any[]) {
    const req = super.sendRequest(path, headers, ...args);
    electron.BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('request', req.path, req.headers, ...req.args);
    });
    return req;
  }
}

class IpcRenderer extends Ipc {
  protected init() {
    electron.ipcRenderer.on('request', this.onRequest.bind(this));
  }

  protected onRequest(event: IpcRendererEvent, path: string, headers: IpcHeaders, ...args: any[]) {
    super.onRequest(event, path, headers, ...args);
  }

  public sendRequest(path: string, headers: Partial<IpcHeaders>, ...args: any[]) {
    const req = super.sendRequest(path, headers, ...args);
    electron.ipcRenderer.send('request', req.path, req.headers, ...req.args);
    return req;
  }
}

export type IpcMainType = IpcMain;
export type IpcRendererType = IpcRenderer;
export const ipcMain = (electron.ipcMain ? new IpcMain() : undefined) as IpcMain;
export const ipcRenderer = (electron.ipcRenderer ? new IpcRenderer() : undefined) as IpcRenderer;
