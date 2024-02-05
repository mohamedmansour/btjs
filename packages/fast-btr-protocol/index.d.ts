export interface BuildTimeRenderingStreamRepeat {
  type: 'repeat'
  value: string
  template: string
}

export interface BuildTimeRenderingStreamRaw {
  type: 'raw'
  value: string
}

export interface BuildTimeRenderingStreamSignal {
  type: 'signal'
  value: string
  defaultValue?: string
}

export type BuildTimeRenderingStream =
  | BuildTimeRenderingStreamRaw
  | BuildTimeRenderingStreamRepeat
  | BuildTimeRenderingStreamSignal

export interface BuildTimeRenderingTemplate {
  style: string
  template: string
}

export type BuildTimeRenderingStreamTemplateRecords = Record<string, BuildTimeRenderingTemplate>

export interface BuildTimeRenderingProtocol {
  streams: BuildTimeRenderingStream[]
  templates: BuildTimeRenderingStreamTemplateRecords
}
