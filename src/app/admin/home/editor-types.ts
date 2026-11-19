export type HomeTheme = 'purple' | 'green' | 'blue' | 'berry'

export interface EditorCoach {
  id: string
  name: string
  specialties: string[]
  bio: string
  hourlyRate: number
  photoId?: string
}

export interface EditorState {
  theme: HomeTheme
  hero: {
    title: string
    subtitle: string
    description: string
    buttonText: string
    buttonLink: string
    photoId?: string
  }
  sections: {
    plans: {
      title: string
      description: string
      visible: boolean
      selectedSessionIds: string[]
    }
    coaching: {
      title: string
      description: string
      visible: boolean
      coaches: EditorCoach[]
    }
    story: {
      title: string
      description: string
      visible: boolean
      photo1Id?: string
      photo2Id?: string
      photo3Id?: string
    }
    visit: {
      title: string
      description: string
      visible: boolean
      photoId?: string
    }
    invite: {
      title: string
      description: string
      visible: boolean
      backgroundPhotoId?: string
    }
  }
  selectedActivityIds?: string[]
}

export interface VersionHistoryItem {
  id: string
  config: EditorState
  versionType: 'DRAFT' | 'PUBLISHED'
  operatedBy: string
  createdAt: Date
  changeNote?: string
}

export interface VersionHistoryResult {
  success: boolean
  data?: VersionHistoryItem[]
  error?: string
}
