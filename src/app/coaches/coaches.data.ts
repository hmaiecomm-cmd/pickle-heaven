export type CoachProfile = {
  id: string
  name: string
  /** 教練照片網址；null 時顯示品牌紫 placeholder */
  image: string | null
  specialty: string[]
  teachingStyle: string[]
  suitableFor: string[]
  experience: string
  introduction: string
  /** 教練個人 LINE 連結；空字串代表尚未設定 */
  lineUrl: string
}

export const defaultCoaches: CoachProfile[] = [
  {
    id: 'alex',
    name: 'Alex 教練',
    image: null,
    specialty: ['基礎技巧', '進階訓練', '比賽策略'],
    teachingStyle: ['系統化', '重視實戰', '清晰易懂'],
    suitableFor: ['新手／初階', '中階以上', '想提升比賽能力的球友'],
    experience: '8 年以上匹克球教學經驗',
    introduction: '擅長從基礎動作開始，協助學員建立穩定的擊球與移動能力，並將技巧應用在實際比賽中。',
    lineUrl: '',
  },
  {
    id: 'emma',
    name: 'Emma 教練',
    image: null,
    specialty: ['動作修正', '穩定控球', '雙打配合'],
    teachingStyle: ['親切耐心', '循序漸進', '重視學員理解'],
    suitableFor: ['新手', '初階', '想建立正確動作的學員'],
    experience: '5 年以上匹克球教學經驗',
    introduction: '擅長協助初學者建立正確的動作與節奏，透過循序漸進的方式提升控球穩定度。',
    lineUrl: '',
  },
  {
    id: 'lin',
    name: '林教練',
    image: null,
    specialty: ['進階訓練', '戰術應用', '比賽心理'],
    teachingStyle: ['強調觀念', '重視實戰', '協助建立比賽判斷力'],
    suitableFor: ['中階以上', '參加比賽的球友', '想提升戰術能力的學員'],
    experience: '6 年以上匹克球教學經驗',
    introduction: '擅長從戰術、站位與比賽判斷切入，協助學員提升比賽中的決策能力與臨場表現。',
    lineUrl: '',
  },
]
