// app/p/_lib/i18n.ts
//
// The parent pages' vocabulary, in the app's three languages (docs/PARENTS.md).
//
// ⚠️ Its own dictionary, not the student panel's: a parent is not a learner. The
// tone is deliberately plain — no XP jargon in the headlines, no "θ", no level
// names a parent has never heard. Anything measured is explained in the sentence
// next to it.

export type ParentLangKey = 'uz' | 'ru' | 'en';

const UZ = {
  appName: 'Edify',
  loading: 'Yuklanmoqda...',
  notFoundTitle: 'Havola topilmadi',
  notFoundBody: "Kod noto'g'ri yoki eskirgan. QR ni qayta skanerlang yoki o'quv markazga murojaat qiling.",
  revokedTitle: 'Kirish yopilgan',
  revokedBody: "Bu havolani o'quv markaz bekor qilgan. Yangi QR olish uchun markazga murojaat qiling.",
  claimedTitle: 'Bu havola boshqa qurilmaga ulangan',
  claimedBody: "Har bir farzand uchun faqat BITTA qurilma ulanadi. Agar bu havola sizniki bo'lsa (telefon almashtirgan yoki brauzer tozalangan bo'lsa), o'quv markazga aytsangiz — ular havolani qayta ochib beradi va shu QR yana ishlaydi.",
  rateTitle: 'Biroz kuting',
  rateBody: "Juda ko'p so'rov yuborildi. Bir daqiqadan so'ng qayta urinib ko'ring.",
  errorTitle: 'Xatolik',
  errorBody: "Ma'lumotlarni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
  retry: 'Qayta urinish',

  myChildren: 'Farzandlarim',
  addChild: 'Farzand qo\'shish',
  addChildTitle: 'Yana bir farzand qo\'shish',
  addChildBody: "Ikkinchi farzandingiz uchun o'quv markaz bergan QR ni skanerlang yoki kodni kiriting.",
  codePlaceholder: 'Kodni kiriting',
  open: 'Ochish',
  badCode: "Kod noto'g'ri. 24 ta belgidan iborat kodni tekshiring.",
  remove: "Ro'yxatdan olib tashlash",
  noChildren: 'Hali farzand qo\'shilmagan',
  noChildrenBody: "O'quv markaz bergan QR ni skanerlang — ro'yxatdan o'tish shart emas.",

  level: 'Matematika darajasi',
  levelOf: '5 dan',
  levelNone: "Hali o'lchanmagan",
  levelHint: "Daraja imtihon javoblari asosida o'lchanadi — bahodan farqli, u qiyinlikni ham hisobga oladi.",
  dimensions: "Yo'nalishlar bo'yicha",
  milliy: 'Milliy sertifikat variantlari',

  results: 'Natijalar',
  average: "O'rtacha",
  improvement: "O'sish",
  improvementUp: (n: number) => `So'nggi natijalar ${n}% ga yaxshilangan`,
  improvementDown: (n: number) => `So'nggi natijalar ${n}% ga pasaygan`,
  improvementFlat: "So'nggi natijalar deyarli o'zgarmagan",
  improvementNone: "O'sishni ko'rsatish uchun natijalar hali yetarli emas",
  trend: 'Oylar bo\'yicha',
  recent: "So'nggi ishlar",
  pending: 'Tekshirilmoqda',
  noResults: 'Hali natijalar yo\'q',

  attendance: 'Davomat',
  attendanceRate: 'Kelgan darslar',
  present: 'Kelgan',
  late: 'Kechikkan',
  absent: 'Kelmagan',
  excused: 'Sababli',
  attendanceHint: "So'nggi 8 hafta. Sababli kelmaslik foizga ta'sir qilmaydi.",
  noAttendance: 'Bu davrda davomat belgilanmagan',

  finance: 'To\'lovlar',
  balanceOwed: 'Qarz',
  balancePaid: 'Qarz yo\'q',
  balanceAdvance: 'Oldindan to\'langan',
  nextDue: 'Keyingi to\'lov sanasi',
  charges: 'Hisoblangan to\'lovlar',
  payments: 'Qabul qilingan to\'lovlar',
  noFinance: 'To\'lov ma\'lumotlari yo\'q',
  chargeStatus: {
    pending: 'To\'lanmagan',
    partial: 'Qisman',
    paid: 'To\'langan',
    waived: 'Kechirilgan',
    cancelled: 'Bekor qilingan',
  } as Record<string, string>,

  groups: 'Guruhlar',
  teacher: 'O\'qituvchi',
  noGroups: 'Guruhga qo\'shilmagan',

  xpLevel: 'Faollik darajasi',
  streak: 'Kunlik seriya',
  days: 'kun',
  updated: 'Yangilandi',
  footer: "Bu sahifa faqat siz uchun. Havolani boshqalarga bermang.",
};

export type ParentT = typeof UZ;

const RU: ParentT = {
  appName: 'Edify',
  loading: 'Загрузка...',
  notFoundTitle: 'Ссылка не найдена',
  notFoundBody: 'Код неверный или устарел. Отсканируйте QR заново или обратитесь в учебный центр.',
  revokedTitle: 'Доступ закрыт',
  revokedBody: 'Учебный центр отозвал эту ссылку. Обратитесь в центр за новым QR.',
  claimedTitle: 'Ссылка уже подключена к другому устройству',
  claimedBody: 'К каждому ребёнку подключается только ОДНО устройство. Если ссылка ваша (сменили телефон или очистили браузер), сообщите в учебный центр — они откроют ссылку заново, и тот же QR снова заработает.',
  rateTitle: 'Подождите немного',
  rateBody: 'Слишком много запросов. Попробуйте через минуту.',
  errorTitle: 'Ошибка',
  errorBody: 'Не удалось загрузить данные. Проверьте интернет и попробуйте снова.',
  retry: 'Повторить',

  myChildren: 'Мои дети',
  addChild: 'Добавить ребёнка',
  addChildTitle: 'Добавить ещё одного ребёнка',
  addChildBody: 'Отсканируйте QR второго ребёнка или введите код, выданный центром.',
  codePlaceholder: 'Введите код',
  open: 'Открыть',
  badCode: 'Неверный код. Он состоит из 24 символов.',
  remove: 'Убрать из списка',
  noChildren: 'Дети ещё не добавлены',
  noChildrenBody: 'Отсканируйте QR из учебного центра — регистрация не нужна.',

  level: 'Уровень по математике',
  levelOf: 'из 5',
  levelNone: 'Пока не измерен',
  levelHint: 'Уровень измеряется по ответам на экзаменах — в отличие от оценки, он учитывает сложность.',
  dimensions: 'По направлениям',
  milliy: 'Варианты Milliy sertifikat',

  results: 'Результаты',
  average: 'Средний балл',
  improvement: 'Прогресс',
  improvementUp: (n: number) => `Последние результаты выросли на ${n}%`,
  improvementDown: (n: number) => `Последние результаты снизились на ${n}%`,
  improvementFlat: 'Последние результаты почти не изменились',
  improvementNone: 'Результатов пока мало для оценки прогресса',
  trend: 'По месяцам',
  recent: 'Последние работы',
  pending: 'На проверке',
  noResults: 'Результатов пока нет',

  attendance: 'Посещаемость',
  attendanceRate: 'Посещено занятий',
  present: 'Был',
  late: 'Опоздал',
  absent: 'Не был',
  excused: 'По уважительной',
  attendanceHint: 'Последние 8 недель. Уважительные пропуски не влияют на процент.',
  noAttendance: 'За этот период посещаемость не отмечена',

  finance: 'Платежи',
  balanceOwed: 'Долг',
  balancePaid: 'Задолженности нет',
  balanceAdvance: 'Предоплата',
  nextDue: 'Следующий платёж',
  charges: 'Начисления',
  payments: 'Принятые платежи',
  noFinance: 'Нет данных по платежам',
  chargeStatus: {
    pending: 'Не оплачено',
    partial: 'Частично',
    paid: 'Оплачено',
    waived: 'Списано',
    cancelled: 'Отменено',
  } as Record<string, string>,

  groups: 'Группы',
  teacher: 'Учитель',
  noGroups: 'Не состоит в группе',

  xpLevel: 'Уровень активности',
  streak: 'Серия дней',
  days: 'дн.',
  updated: 'Обновлено',
  footer: 'Эта страница только для вас. Не передавайте ссылку другим.',
};

const EN: ParentT = {
  appName: 'Edify',
  loading: 'Loading...',
  notFoundTitle: 'Link not found',
  notFoundBody: 'The code is wrong or out of date. Scan the QR again or contact the learning center.',
  revokedTitle: 'Access closed',
  revokedBody: 'The learning center revoked this link. Ask them for a new QR.',
  claimedTitle: 'This link is connected to another device',
  claimedBody: 'Only ONE device can be connected per child. If this link is yours (you changed phone or cleared your browser), ask the learning center — they can release it and the same QR will work again.',
  rateTitle: 'Please wait a moment',
  rateBody: 'Too many requests. Try again in a minute.',
  errorTitle: 'Something went wrong',
  errorBody: 'The data could not be loaded. Check your connection and try again.',
  retry: 'Try again',

  myChildren: 'My children',
  addChild: 'Add a child',
  addChildTitle: 'Add another child',
  addChildBody: "Scan your second child's QR, or type the code the center gave you.",
  codePlaceholder: 'Enter the code',
  open: 'Open',
  badCode: 'That code is not valid. It is 24 characters long.',
  remove: 'Remove from the list',
  noChildren: 'No children added yet',
  noChildrenBody: 'Scan the QR from your learning center — no signup needed.',

  level: 'Mathematics level',
  levelOf: 'of 5',
  levelNone: 'Not measured yet',
  levelHint: 'The level is measured from exam answers — unlike a grade, it accounts for difficulty.',
  dimensions: 'By area',
  milliy: 'Milliy sertifikat papers',

  results: 'Results',
  average: 'Average',
  improvement: 'Progress',
  improvementUp: (n: number) => `Recent results are up by ${n}%`,
  improvementDown: (n: number) => `Recent results are down by ${n}%`,
  improvementFlat: 'Recent results are about the same',
  improvementNone: 'Not enough results yet to show progress',
  trend: 'By month',
  recent: 'Recent work',
  pending: 'Being marked',
  noResults: 'No results yet',

  attendance: 'Attendance',
  attendanceRate: 'Lessons attended',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
  attendanceHint: 'The last 8 weeks. Excused absences do not affect the percentage.',
  noAttendance: 'No attendance was marked in this period',

  finance: 'Payments',
  balanceOwed: 'Owed',
  balancePaid: 'Nothing owed',
  balanceAdvance: 'Paid in advance',
  nextDue: 'Next payment due',
  charges: 'Charges',
  payments: 'Payments received',
  noFinance: 'No payment records',
  chargeStatus: {
    pending: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
    waived: 'Waived',
    cancelled: 'Cancelled',
  } as Record<string, string>,

  groups: 'Groups',
  teacher: 'Teacher',
  noGroups: 'Not in a group',

  xpLevel: 'Activity level',
  streak: 'Day streak',
  days: 'days',
  updated: 'Updated',
  footer: 'This page is for you only. Do not share the link.',
};

export const PARENT_TEXTS: Record<ParentLangKey, ParentT> = { uz: UZ, ru: RU, en: EN };

/** Attendance status → its label, in the parent's language. */
export const attendanceLabel = (t: ParentT, status: string): string =>
  status === 'present' ? t.present
  : status === 'late' ? t.late
  : status === 'absent' ? t.absent
  : status === 'excused' ? t.excused
  : status;
