import { Observable } from 'rxjs'
import type { DLMetadata, RPCRequest, RPCResponse, RPCResult } from '../types'

import { WebSocketSubject, webSocket } from 'rxjs/webSocket'

type DownloadRequestArgs = {
  url: string,
  args: string,
  pathOverride?: string,
  renameTo?: string,
  playlist?: boolean
}

export class RPCClient {
  private seq: number
  private httpEndpoint: string
  private readonly _socket$: WebSocketSubject<any>

  constructor(httpEndpoint: string, webSocketEndpoint: string) {
    this.seq = 0
    this.httpEndpoint = httpEndpoint
    this._socket$ = webSocket<any>({
      url: webSocketEndpoint
    })
  }

  public get socket$(): Observable<RPCResponse<RPCResult[]>> {
    return this._socket$
  }

  private incrementSeq() {
    return String(this.seq++)
  }

  private send(req: RPCRequest) {
    this._socket$.next({
      ...req,
      id: this.incrementSeq(),
    })
  }

  private argsSanitizer(args: string) {
    return args
      .split(' ')
      .map(a => a.trim().replaceAll("'", '').replaceAll('"', ''))
      .filter(Boolean)
  }

  private async sendHTTP<T>(req: RPCRequest) {
    const res = await fetch(this.httpEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        ...req,
        id: this.incrementSeq(),
      })
    })
    const data: RPCResponse<T> = await res.json()

    return data
  }

  public download(req: DownloadRequestArgs) {
    if (!req.url) {
      return
    }

    const rename = req.args.includes('-o')
      ? req.args
        .substring(req.args.indexOf('-o'))
        .replaceAll("'", '')
        .replaceAll('"', '')
        .split('-o')
        .map(s => s.trim())
        .join('')
        .split(' ')
        .at(0) ?? ''
      : ''

    const sanitizedArgs = this.argsSanitizer(
      req.args.replace('-o', '').replace(rename, '')
    )

    if (req.playlist) {
      return this.sendHTTP({
        method: 'Service.ExecPlaylist',
        params: [{
          URL: req.url,
          Params: sanitizedArgs,
          Path: req.pathOverride,
          Rename: req.renameTo || rename,
        }]
      })
    }
    this.sendHTTP({
      method: 'Service.Exec',
      params: [{
        URL: req.url.split('?list').at(0)!,
        Params: sanitizedArgs,
        Path: req.pathOverride,
        Rename: req.renameTo || rename,
      }]
    })
  }

  public formats(url: string) {
    if (url) {
      return this.sendHTTP<DLMetadata>({
        method: 'Service.Formats',
        params: [{
          URL: url.split('?list').at(0)!,
        }]
      })
    }
  }

  public running() {
    this.send({
      method: 'Service.Running',
      params: [],
    })
  }

  public kill(id: string) {
    this.sendHTTP({
      method: 'Service.Kill',
      params: [id],
    })
  }

  public killAll() {
    this.sendHTTP({
      method: 'Service.KillAll',
      params: [],
    })
  }

  public freeSpace() {
    return this.sendHTTP<number>({
      method: 'Service.FreeSpace',
      params: [],
    })
  }

  public directoryTree() {
    return this.sendHTTP<string[]>({
      method: 'Service.DirectoryTree',
      params: [],
    })
  }

  public updateExecutable() {
    return this.sendHTTP({
      method: 'Service.UpdateExecutable',
      params: []
    })
  }
}