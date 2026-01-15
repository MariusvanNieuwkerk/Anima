export type DiagramHighlight = {
  id: string
  color?: string
}

export type DiagramLabel = {
  text: string
  x: number
  y: number
  color?: string
}

export type DiagramSpec = {
  templateId: 'human_organs_basic' | 'human_skeleton_basic'
  title?: string
  highlights?: DiagramHighlight[]
  labels?: DiagramLabel[]
}


