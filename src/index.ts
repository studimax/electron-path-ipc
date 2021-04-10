import electron, {IpcMainEvent, IpcRendererEvent} from 'electron';
import EventEmitter from 'events';
import {match, pathToRegexp} from 'path-to-regexp';
import * as uuid from 'uuid';

type HandleListener = (headers: IpcHeaders, ...args: any[]) => Promise<any> | any;
type Listener = (headers: IpcHeaders, ...args: any[]) => any;
type IpcHeaders = {
  [key: string]: any;
  error?: Error;
  handler?: true;
  params: {[key: string]: string};
  reqId: string;
  resId?: string;
};

interface IpcRequest {
  path: string;
  headers: IpcHeaders;
  args: any[];
}

abstract class IpcCore extends EventEmitter {
  private readonly eventList = new Map<string, {regexp: RegExp; listeners: Listener[]}>();
  private readonly handlerList = new Map<string, {regexp: RegExp; listener: HandleListener}>();
  private readonly handlerEvent = new EventEmitter();
  private readonly responseEvent = new EventEmitter();

  constructor() {
    super();
    this.init();
  }

  protected onRequest(event: IpcMainEvent | IpcRendererEvent, path: string, headers: IpcHeaders, ...args: any[]) {
    this.eventList.forEach(({regexp}, eventName) => {
      if (regexp.test(path)) {
        const result = match<{[key: string]: string}>(eventName)(path);
        headers.params = result ? result.params : {};
        this.emit(eventName, headers, ...args);
      }
    });

    if (
      headers.handler &&
      !Array.from(this.handlerList.entries())
        .map(([eventName, {regexp}]) => {
          if (regexp.test(path)) {
            const result = match<{[key: string]: string}>(eventName)(path);
            headers.params = result ? result.params : {};
            return this.handlerEvent.emit(eventName, headers, ...args);
          }
          return false;
        })
        .some(t => t)
    ) {
      this.respond(headers.reqId, path, new Error(`No handler found for '${path}'`));
    }
    if (headers.resId) {
      this.responseEvent.emit(headers.resId, headers, ...args);
    }
  }

  protected onResponse<T = any>(reqId: string, opts = {timeout: 10000}): Promise<T> {
    let timeout: NodeJS.Timeout;
    return new Promise<T>((resolve, reject) => {
      timeout = setTimeout(() => {
        this.responseEvent.removeAllListeners(reqId);
        return reject(new Error(`Timeout for response with reqId '${reqId}'`));
      }, opts.timeout);
      this.responseEvent.once(reqId, (header: IpcHeaders, args) =>
        header.error ? reject(header.error) : resolve(args)
      );
    }).finally(() => clearTimeout(timeout));
  }

  protected sendRequest(path: string, headers: Partial<IpcHeaders>, ...args: any[]): IpcRequest {
    return {path, headers: {params: {}, ...headers, reqId: uuid.v4()}, args};
  }

  protected abstract init(): void;

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
    if (path) {
      this.eventList.delete(path);
      super.removeAllListeners(path);
    } else {
      this.eventList.clear();
      super.removeAllListeners();
    }
    return this;
  }

  public removeAll(): this {
    this.removeAllListeners();
    this.removeHandler();
    return this;
  }

  public eventNames(): string[] {
    return super.eventNames() as string[];
  }

  public handle(path: string, listener: HandleListener): this {
    if (this.handlerList.has(path)) throw new Error(`Attempted to register a second handler for '${path}'`);
    this.handlerList.set(path, {regexp: pathToRegexp(path), listener});
    this.handlerEvent.on(path, async (headers: IpcHeaders, ...args: any[]) => {
      const response = await listener(headers, ...args);
      this.respond(headers.reqId, path, response);
    });
    return this;
  }

  public handleOnce(path: string, listener: HandleListener): this {
    return this.handle(path, (headers: IpcHeaders, ...args: any[]) => {
      this.removeHandler(path);
      return listener(headers, ...args);
    });
  }

  public invoke<T = any>(path: string, ...args: any[]): Promise<T> {
    const req = this.sendRequest(path, {handler: true}, ...args);
    return this.onResponse(req.headers.reqId);
  }

  public handlerNames(): string[] {
    return this.handlerEvent.eventNames() as string[];
  }

  public removeHandler(path?: string): this {
    if (path) {
      this.handlerList.delete(path);
      this.handlerEvent.removeAllListeners(path);
    } else {
      this.handlerList.clear();
      this.handlerEvent.removeAllListeners();
    }
    return this;
  }

  public send(path: string, ...args: any[]): void {
    this.sendRequest(path, {}, ...args);
  }

  public respond(reqId: string, path: string, error: Error | undefined, ...args: any[]): void;
  public respond(reqId: string, path: string, ...args: any[]): void;
  public respond(reqId: string, path: string, ...args: any[]): void {
    const error = args[0] instanceof Error ? args.shift() : undefined;
    this.sendRequest(path, {resId: reqId, error}, ...args);
  }

  public prefix(prefix: string): PrefixedIpc {
    return new PrefixedIpcCore(this, prefix);
  }
}

class IpcCoreMain extends IpcCore {
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

class IpcCoreRenderer extends IpcCore {
  protected init() {
    electron.ipcRenderer.on('request', this.onRequest.bind(this));
  }

  protected onRequest(event: IpcRendererEvent, path: string, headers: IpcHeaders, ...args: any[]) {
    super.onRequest(event, path, headers, ...args);
  }

  protected sendRequest(path: string, headers: Partial<IpcHeaders>, ...args: any[]) {
    const req = super.sendRequest(path, headers, ...args);
    electron.ipcRenderer.send('request', req.path, req.headers, ...req.args);
    return req;
  }
}

class PrefixedIpcCore extends IpcCore {
  constructor(private readonly parent: IpcCore, private readonly prefixPath: string) {
    super();
  }

  protected init(): void {}

  public addListener(path: string, listener: (...args: any[]) => void): this {
    return this.on(path, listener);
  }

  public on(path: string, listener: Listener): this {
    this.parent.on(this.prefixPath + path, listener);
    return this;
  }

  public off(path: string, listener: (...args: any[]) => void): this {
    return this.removeListener(path, listener);
  }

  public once(path: string, listener: Listener): this {
    this.parent.once(this.prefixPath + path, listener);
    return this;
  }

  public removeListener(path: string, listener: (...args: any[]) => void): this {
    this.parent.removeListener(this.prefixPath + path, listener);
    return this;
  }

  public removeAllListeners(path?: string): this {
    if (path) {
      this.parent.removeAllListeners(this.prefixPath + path);
    } else {
      this.eventNames().forEach(event => this.removeAllListeners(event));
    }
    return this;
  }

  public removeAll(): this {
    this.removeAllListeners();
    this.removeHandler();
    return this;
  }

  public eventNames(): string[] {
    return this.parent
      .eventNames()
      .filter(event => event.startsWith(this.prefixPath))
      .map(event => event.slice(this.prefixPath.length));
  }

  public handle(path: string, listener: HandleListener): this {
    this.parent.handle(this.prefixPath + path, listener);
    return this;
  }

  public handleOnce(path: string, listener: HandleListener): this {
    this.parent.handleOnce(this.prefixPath + path, listener);
    return this;
  }

  public invoke<T = any>(path: string, ...args: any[]): Promise<T> {
    return this.parent.invoke(this.prefixPath + path, ...args);
  }

  public handlerNames(): string[] {
    return this.parent
      .handlerNames()
      .filter(event => event.startsWith(this.prefixPath))
      .map(event => event.slice(this.prefixPath.length));
  }

  public removeHandler(path?: string): this {
    if (path) {
      this.parent.removeHandler(this.prefixPath + path);
    } else {
      this.handlerNames().forEach(event => this.removeHandler(event));
    }
    return this;
  }

  public send(path: string, ...args: any[]): void {
    this.parent.send(this.prefixPath + path, ...args);
  }

  public respond(reqId: string, path: string, ...args: any[]): void {
    this.parent.respond(reqId, this.prefixPath + path, ...args);
  }
}

export type IpcMain = IpcCoreMain;
export type IpcRenderer = IpcCoreRenderer;
export type PrefixedIpc = PrefixedIpcCore;

export const ipcMain:IpcMain = (electron.ipcMain ? new IpcCoreMain() : undefined) as IpcMain;
export const ipcRenderer:IpcRenderer = (electron.ipcRenderer ? new IpcCoreRenderer() : undefined) as IpcRenderer;
