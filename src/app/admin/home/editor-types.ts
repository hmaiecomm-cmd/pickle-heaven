export type HomeTheme = 'purple' | 'green' | 'blue' | 'berry'

export interface EditorState {
  theme: HomeTheme
  hero: {
    title: string
    subtitle: string
    description: string
    buttonText: string
    buttonLink: string
    imageId?: string
  }
  sections: {
    plans: { title: string; description: string; visible: boolean }
    coaching: { title: string; description: string; visible: boolean }
    story: { title: string; description: string; imageId?: string; visible: boolean }
    visit: { title: string; description: string; visible: boolean }
    invite: { title: string; description: string; visible: boolean }
  }
  selectedActivityIds: string[]
}
