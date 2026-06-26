// ICDR 5-grade scale with Uzbek (Latin) labels.
// Referable DR = grade >= 2 (moderate or worse). ARCHITECTURE.md §2/§4.

export const GRADES = [
  {
    grade: 0,
    en: 'No DR',
    uz: 'DR belgilari yo‘q',
    short: 'DR yo‘q',
    desc: 'Diabetik retinopatiya belgilari aniqlanmadi.',
  },
  {
    grade: 1,
    en: 'Mild',
    uz: 'Yengil',
    short: 'Yengil',
    desc: 'Yengil nostproliferativ o‘zgarishlar.',
  },
  {
    grade: 2,
    en: 'Moderate',
    uz: 'O‘rtacha',
    short: 'O‘rtacha',
    desc: 'O‘rtacha nostproliferativ retinopatiya.',
  },
  {
    grade: 3,
    en: 'Severe',
    uz: 'Og‘ir',
    short: 'Og‘ir',
    desc: 'Og‘ir nostproliferativ retinopatiya.',
  },
  {
    grade: 4,
    en: 'Proliferative',
    uz: 'Proliferativ',
    short: 'Proliferativ',
    desc: 'Proliferativ diabetik retinopatiya.',
  },
]

export const REFERABLE_THRESHOLD = 2

export function isReferable(grade) {
  return typeof grade === 'number' && grade >= REFERABLE_THRESHOLD
}

export function gradeInfo(grade) {
  return GRADES.find((g) => g.grade === grade) || null
}

// Calm green when no referral is needed; warm amber accent when referable.
export const REFERRAL_COPY = {
  notReferable: {
    title: 'Yo‘naltirish shart emas',
    sub: 'Hozircha mutaxassis ko‘rigiga zaruriyat yo‘q. Rejali skriningni davom ettiring.',
  },
  referable: {
    title: 'Mutaxassis ko‘rigiga yo‘naltirilsin',
    sub: 'Aniqlangan o‘zgarishlar bo‘yicha oftalmolog ko‘rigi tavsiya etiladi.',
  },
}
