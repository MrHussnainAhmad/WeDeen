export type GuideStep = {
  titleEn: string;
  titleUr: string;
  descEn: string;
  descUr: string;
};

export type GuideInfo = {
  id: string;
  titleEn: string;
  titleUr: string;
  icon: string;
  coverImage: any;
  steps: GuideStep[];
};

export const GUIDES: GuideInfo[] = [
  {
    id: 'ghusl',
    titleEn: 'Ghusl Guide',
    titleUr: 'طریقہ غسل',
    icon: 'water-outline',
    coverImage: require('@/assets/images/guide/ghusl.png'),
    steps: [
      {
        titleEn: 'Intention (Niyyah)',
        titleUr: 'نیت کرنا',
        descEn: 'Make the intention in your heart to perform Ghusl for purification.',
        descUr: 'دل میں پاکی حاصل کرنے کی نیت کریں۔',
      },
      {
        titleEn: 'Wash Hands',
        titleUr: 'ہاتھ دھونا',
        descEn: 'Wash both hands up to the wrists three times.',
        descUr: 'دونوں ہاتھوں کو گٹوں تک تین بار دھوئیں۔',
      },
      {
        titleEn: 'Wash Private Parts',
        titleUr: 'استنجا کرنا',
        descEn: 'Wash the private parts and any impurities on the body.',
        descUr: 'شرمگاہ اور جسم پر لگی کسی بھی نجاست کو دھوئیں۔',
      },
      {
        titleEn: 'Perform Wudu',
        titleUr: 'وضو کرنا',
        descEn: 'Perform a complete Wudu (ablution) exactly as you would for prayer.',
        descUr: 'نماز کی طرح مکمل وضو کریں۔',
      },
      {
        titleEn: 'Pour Water on Head',
        titleUr: 'سر پر پانی ڈالنا',
        descEn: 'Pour water over the head three times, ensuring it reaches the roots of the hair.',
        descUr: 'سر پر تین بار پانی ڈالیں تاکہ بالوں کی جڑوں تک پہنچ جائے۔',
      },
      {
        titleEn: 'Wash the Entire Body',
        titleUr: 'پورا جسم دھونا',
        descEn: 'Pour water over the right side of the body, then the left side, ensuring no part remains dry.',
        descUr: 'پہلے جسم کے دائیں حصے پر، پھر بائیں حصے پر پانی ڈالیں، اس بات کو یقینی بنائیں کہ کوئی حصہ خشک نہ رہے۔',
      },
    ],
  },
  {
    id: 'wudu',
    titleEn: 'Wudu Guide',
    titleUr: 'طریقہ وضو',
    icon: 'hand-left-outline',
    coverImage: require('@/assets/images/guide/wudu.png'),
    steps: [
      {
        titleEn: 'Intention and Bismillah',
        titleUr: 'نیت اور بسم اللہ',
        descEn: 'Make the intention for Wudu and say Bismillah.',
        descUr: 'وضو کی نیت کریں اور بسم اللہ پڑھیں۔',
      },
      {
        titleEn: 'Wash Hands',
        titleUr: 'ہاتھ دھونا',
        descEn: 'Wash both hands up to the wrists three times, ensuring water goes between fingers.',
        descUr: 'دونوں ہاتھوں کو گٹوں تک تین بار دھوئیں۔',
      },
      {
        titleEn: 'Rinse Mouth',
        titleUr: 'کلی کرنا',
        descEn: 'Take water into your mouth and rinse it three times.',
        descUr: 'منہ میں پانی ڈال کر تین بار کلی کریں۔',
      },
      {
        titleEn: 'Clean Nose',
        titleUr: 'ناک میں پانی ڈالنا',
        descEn: 'Sniff water into the nose and blow it out three times using the left hand.',
        descUr: 'ناک میں نرم ہڈی تک پانی چڑھا کر تین بار صاف کریں۔',
      },
      {
        titleEn: 'Wash Face',
        titleUr: 'چہرہ دھونا',
        descEn: 'Wash the entire face from the hairline to the chin, and from ear to ear, three times.',
        descUr: 'پیشانی کے بالوں سے ٹھوڑی تک اور ایک کان کی لو سے دوسرے کان تک چہرہ تین بار دھوئیں۔',
      },
      {
        titleEn: 'Wash Arms',
        titleUr: 'بازو دھونا',
        descEn: 'Wash the right arm up to and including the elbow three times, then the left arm.',
        descUr: 'پہلے دایاں بازو کہنیوں سمیت تین بار دھویں پھر بایاں بازو۔',
      },
      {
        titleEn: 'Wipe Head (Masah)',
        titleUr: 'مسح کرنا',
        descEn: 'Wipe the head with wet hands, starting from the front to the back and bringing them forward again. Then wipe the inside and outside of the ears.',
        descUr: 'گیلے ہاتھوں سے سر کا مسح کریں اور پھر کانوں کا مسح کریں۔',
      },
      {
        titleEn: 'Wash Feet',
        titleUr: 'پاؤں دھونا',
        descEn: 'Wash the right foot up to the ankle three times, ensuring water reaches between the toes. Repeat with the left foot.',
        descUr: 'دایاں پاؤں ٹخنوں سمیت تین بار دھوئیں پھر بایاں پاؤں دھوئیں۔',
      },
    ],
  },
  {
    id: 'prayer',
    titleEn: 'Prayer (Salah)',
    titleUr: 'طریقہ نماز',
    icon: 'body-outline',
    coverImage: require('@/assets/images/guide/prayer.png'),
    steps: [
      {
        titleEn: 'Takbeer & Intention',
        titleUr: 'تکبیر اور نیت',
        descEn: 'Face the Qibla, make the intention, and say "Allahu Akbar" while raising hands to the ears.',
        descUr: 'قبلہ رخ ہوکر نیت کریں اور ہاتھ کانوں تک اٹھا کر "اللہ اکبر" کہیں۔',
      },
      {
        titleEn: 'Qiyam (Standing)',
        titleUr: 'قیام',
        descEn: 'Fold your hands (right over left) and recite Surah Al-Fatiha, followed by another Surah.',
        descUr: 'ہاتھ باندھیں (دایاں بائیں کے اوپر) اور سورۃ الفاتحہ کے ساتھ کوئی اور سورۃ پڑھیں۔',
      },
      {
        titleEn: 'Ruku (Bowing)',
        titleUr: 'رکوع',
        descEn: 'Say "Allahu Akbar" and bow, resting your hands on your knees. Recite "Subhana Rabbiyal Azim" 3 times.',
        descUr: '"اللہ اکبر" کہہ کر رکوع میں جائیں اور "سبحان ربی العظیم" 3 بار پڑھیں۔',
      },
      {
        titleEn: 'Qiyam (Rising)',
        titleUr: 'قومہ',
        descEn: 'Stand up straight saying "Sami Allahu liman hamidah", then say "Rabbana walakal hamd".',
        descUr: '"سمع اللہ لمن حمدہ" کہتے ہوئے سیدھے کھڑے ہوں، پھر "ربنا ولک الحمد" کہیں۔',
      },
      {
        titleEn: 'Sujood (Prostration)',
        titleUr: 'سجدہ',
        descEn: 'Say "Allahu Akbar" and prostrate (forehead, nose, hands, knees, and toes touching the ground). Recite "Subhana Rabbiyal A\'la" 3 times.',
        descUr: '"اللہ اکبر" کہہ کر سجدے میں جائیں اور "سبحان ربی الاعلیٰ" 3 بار پڑھیں۔',
      },
      {
        titleEn: 'Sitting & Second Sujood',
        titleUr: 'جلسہ اور دوسرا سجدہ',
        descEn: 'Sit up briefly saying "Allahu Akbar", then perform the second prostration.',
        descUr: 'تھوڑی دیر کے لئے بیٹھیں پھر دوسرا سجدہ کریں۔',
      },
      {
        titleEn: 'Tashahhud & Salam',
        titleUr: 'تشہد اور سلام',
        descEn: 'In the final rakat, sit for Tashahhud, recite Durood, and finish by turning the head right and left saying "Assalamu alaikum wa rahmatullah".',
        descUr: 'آخری رکعت میں تشہد اور درود پڑھیں، پھر دائیں اور بائیں سلام پھیریں۔',
      },
    ],
  },
  {
    id: 'janazah',
    titleEn: 'Janazah Prayer',
    titleUr: 'صلاة الجنازة',
    icon: 'people-outline',
    coverImage: require('@/assets/images/guide/janazah.png'),
    steps: [
      {
        titleEn: 'Intention',
        titleUr: 'نیت',
        descEn: 'Make the intention for Janazah prayer (which has 4 Takbeers and no Ruku or Sujood).',
        descUr: 'نماز جنازہ کی نیت کریں (اس میں 4 تکبیریں ہوتی ہیں اور رکوع یا سجدہ نہیں ہوتا)۔',
      },
      {
        titleEn: 'First Takbeer',
        titleUr: 'پہلی تکبیر',
        descEn: 'Say "Allahu Akbar", fold your hands, and recite Sana (Subhanaka) or Surah Al-Fatiha.',
        descUr: '"اللہ اکبر" کہہ کر ہاتھ باندھیں اور ثناء پڑھیں۔',
      },
      {
        titleEn: 'Second Takbeer',
        titleUr: 'دوسری تکبیر',
        descEn: 'Say "Allahu Akbar" (without raising hands) and recite Durood-e-Ibrahim.',
        descUr: '"اللہ اکبر" کہیں (ہاتھ اٹھائے بغیر) اور درود ابراہیمی پڑھیں۔',
      },
      {
        titleEn: 'Third Takbeer',
        titleUr: 'تیسری تکبیر',
        descEn: 'Say "Allahu Akbar" and recite the Dua for the deceased.',
        descUr: '"اللہ اکبر" کہیں اور میت کے لئے دعا پڑھیں۔',
      },
      {
        titleEn: 'Fourth Takbeer & Salam',
        titleUr: 'چوتھی تکبیر اور سلام',
        descEn: 'Say "Allahu Akbar", then turn your head to the right and left to say Salam.',
        descUr: '"اللہ اکبر" کہیں، پھر دائیں اور بائیں سلام پھیر کر نماز ختم کریں۔',
      },
    ],
  },
  {
    id: 'umrah',
    titleEn: 'Umrah Guide',
    titleUr: 'طریقہ عمرہ',
    icon: 'compass-outline',
    coverImage: require('@/assets/images/guide/umrah.png'),
    steps: [
      {
        titleEn: 'Ihram',
        titleUr: 'احرام',
        descEn: 'Perform Ghusl, put on Ihram garments at the Miqat, make the intention for Umrah, and begin reciting Talbiyah.',
        descUr: 'غسل کریں، میقات پر احرام باندھیں، عمرہ کی نیت کریں اور تلبیہ پڑھنا شروع کریں۔',
      },
      {
        titleEn: 'Entering Masjid al-Haram',
        titleUr: 'مسجد الحرام میں داخلہ',
        descEn: 'Enter with the right foot, reciting the Dua for entering the mosque. Keep your gaze lowered until you see the Kaaba.',
        descUr: 'دایاں پاؤں اندر رکھ کر دعا پڑھتے ہوئے مسجد میں داخل ہوں۔',
      },
      {
        titleEn: 'Tawaf',
        titleUr: 'طواف',
        descEn: 'Circle the Kaaba 7 times counter-clockwise, starting from the Black Stone (Hajar al-Aswad). Men should uncover their right shoulder (Idtiba).',
        descUr: 'حجر اسود سے شروع کرکے کعبہ کے 7 چکر لگائیں۔',
      },
      {
        titleEn: 'Maqam Ibrahim & Zamzam',
        titleUr: 'مقام ابراہیم اور زمزم',
        descEn: 'Pray 2 Rakats behind Maqam Ibrahim, then drink Zamzam water and make Dua.',
        descUr: 'مقام ابراہیم کے پیچھے 2 نفل پڑھیں، پھر آبِ زمزم پی کر دعا کریں۔',
      },
      {
        titleEn: 'Sa\'i (Safa and Marwah)',
        titleUr: 'سعی (صفا اور مروہ)',
        descEn: 'Walk 7 times between the hills of Safa and Marwah, starting at Safa and ending at Marwah.',
        descUr: 'صفا اور مروہ کے درمیان 7 چکر لگائیں۔',
      },
      {
        titleEn: 'Halq or Taqsir',
        titleUr: 'حلق یا قصر',
        descEn: 'Men should shave their heads (Halq) or trim their hair (Taqsir). Women trim a fingertip\'s length of their hair. The Ihram is now complete.',
        descUr: 'مرد سر منڈوائیں یا بال کٹوائیں۔ عورتیں انگلی کے پور کے برابر بال کاٹیں۔ عمرہ مکمل ہو گیا۔',
      },
    ],
  },
  {
    id: 'hajj',
    titleEn: 'Hajj Guide',
    titleUr: 'طریقہ حج',
    icon: 'earth',
    coverImage: require('@/assets/images/guide/hajj.png'),
    steps: [
      {
        titleEn: 'Day 1: 8th Dhul-Hijjah (Mina)',
        titleUr: 'پہلا دن: 8 ذوالحجہ (منیٰ)',
        descEn: 'Enter Ihram, go to Mina, and stay there for Dhuhr, Asr, Maghrib, Isha, and Fajr prayers.',
        descUr: 'احرام باندھ کر منیٰ جائیں اور وہاں پانچوں نمازیں پڑھیں۔',
      },
      {
        titleEn: 'Day 2: 9th Dhul-Hijjah (Arafat & Muzdalifah)',
        titleUr: 'دوسرا دن: 9 ذوالحجہ (عرفات اور مزدلفہ)',
        descEn: 'Go to Arafat after Fajr. This is the most important day. Stand in prayer and Dua until sunset. After sunset, go to Muzdalifah, pray Maghrib & Isha combined, and collect pebbles.',
        descUr: 'عرفات میں وقوف کریں، یہ حج کا سب سے اہم رکن ہے۔ سورج غروب ہونے کے بعد مزدلفہ جائیں اور کنکریاں جمع کریں۔',
      },
      {
        titleEn: 'Day 3: 10th Dhul-Hijjah (Eid & Rami)',
        titleUr: 'تیسرا دن: 10 ذوالحجہ (قربانی اور رمی)',
        descEn: 'Go to Mina, throw 7 pebbles at Jamarat al-Aqabah. Then offer the sacrifice (Qurbani), shave/trim hair, and take off Ihram.',
        descUr: 'منیٰ میں بڑے شیطان کو 7 کنکریاں ماریں، قربانی کریں، اور بال منڈوا کر احرام کھول دیں۔',
      },
      {
        titleEn: 'Tawaf al-Ifadah',
        titleUr: 'طواف زیارت',
        descEn: 'Go to Mecca, perform Tawaf al-Ifadah and Sa\'i. Then return to Mina.',
        descUr: 'مکہ جاکر طواف زیارت اور سعی کریں، پھر واپس منیٰ آجائیں۔',
      },
      {
        titleEn: 'Days 4 & 5: 11th-12th Dhul-Hijjah (Rami)',
        titleUr: 'چوتھا اور پانچواں دن: 11-12 ذوالحجہ',
        descEn: 'Stay in Mina and throw 7 pebbles at each of the 3 Jamarat (pillars) on both days.',
        descUr: 'منیٰ میں قیام کریں اور تینوں شیطانوں کو کنکریاں ماریں۔',
      },
      {
        titleEn: 'Tawaf al-Wida (Farewell)',
        titleUr: 'طواف وداع',
        descEn: 'Perform the final farewell Tawaf before leaving Mecca.',
        descUr: 'مکہ سے روانگی سے پہلے آخری طواف وداع کریں۔',
      },
    ],
  },
  {
    id: 'tayammum',
    titleEn: 'Tayammum Guide',
    titleUr: 'طریقہ تیمم',
    icon: 'water-outline',
    coverImage: require('@/assets/images/guide/tayammum.png'),
    steps: [
      {
        titleEn: 'Intention (Niyyah)',
        titleUr: 'نیت کرنا',
        descEn: 'Make the intention in your heart to perform Tayammum for purity.',
        descUr: 'دل میں پاکی حاصل کرنے کے لیے تیمم کی نیت کریں۔',
      },
      {
        titleEn: 'Strike the Earth',
        titleUr: 'مٹی پر ہاتھ مارنا',
        descEn: 'Strike both palms on clean earth, sand, or stone once.',
        descUr: 'دونوں ہاتھوں کو ایک بار پاک مٹی، ریت یا پتھر پر ماریں۔',
      },
      {
        titleEn: 'Blow Excess Dust',
        titleUr: 'گرد جھاڑنا',
        descEn: 'Lightly blow off any excess dust from your hands.',
        descUr: 'ہاتھوں سے اضافی گرد کو ہلکا سا پھونک مار کر جھاڑ دیں۔',
      },
      {
        titleEn: 'Wipe the Face',
        titleUr: 'چہرے کا مسح',
        descEn: 'Wipe your entire face with your hands completely, just as you would wash it in Wudu.',
        descUr: 'اپنے ہاتھوں سے پورے چہرے کا مسح کریں، بالکل اسی طرح جیسے وضو میں دھوتے ہیں۔',
      },
      {
        titleEn: 'Wipe the Arms',
        titleUr: 'بازوؤں کا مسح',
        descEn: 'Strike the earth again, then wipe the right arm up to the elbow with the left hand, and the left arm with the right hand.',
        descUr: 'دوبارہ مٹی پر ہاتھ ماریں، پھر بائیں ہاتھ سے دائیں بازو کا کہنی تک مسح کریں، اور دائیں ہاتھ سے بائیں بازو کا مسح کریں۔',
      }
    ],
  },
  {
    id: 'eid',
    titleEn: 'Eid Prayer',
    titleUr: 'طریقہ نماز عید',
    icon: 'moon-outline',
    coverImage: require('@/assets/images/guide/eid.png'),
    steps: [
      {
        titleEn: 'Intention',
        titleUr: 'نیت',
        descEn: 'Make the intention to pray 2 Rakats of Eid prayer with 6 extra Takbeers behind the Imam.',
        descUr: 'امام کے پیچھے 6 زائد تکبیروں کے ساتھ عید کی 2 رکعت نماز کی نیت کریں۔',
      },
      {
        titleEn: 'First Takbeer & Sana',
        titleUr: 'پہلی تکبیر اور ثناء',
        descEn: 'Say "Allahu Akbar", fold your hands, and quietly recite Sana (Subhanaka).',
        descUr: '"اللہ اکبر" کہہ کر ہاتھ باندھیں اور خاموشی سے ثناء پڑھیں۔',
      },
      {
        titleEn: 'Three Extra Takbeers',
        titleUr: 'تین زائد تکبیریں',
        descEn: 'The Imam will say "Allahu Akbar" 3 times. Raise your hands to your ears and drop them by your sides for the first two, and fold them on the third.',
        descUr: 'امام 3 بار "اللہ اکبر" کہے گا۔ پہلی دو تکبیروں پر ہاتھ کانوں تک اٹھا کر چھوڑ دیں، اور تیسری پر ہاتھ باندھ لیں،',
      },
      {
        titleEn: 'First Rakat Completion',
        titleUr: 'پہلی رکعت کی تکمیل',
        descEn: 'The Imam recites Surah Al-Fatiha and another Surah, then completes the Ruku and Sujood normally.',
        descUr: 'امام سورۃ الفاتحہ اور دوسری سورۃ پڑھے گا، پھر معمول کے مطابق رکوع اور سجدہ مکمل کریں۔',
      },
      {
        titleEn: 'Second Rakat Extra Takbeers',
        titleUr: 'دوسری رکعت کی تکبیریں',
        descEn: 'In the second Rakat, after the Imam finishes reciting the Quran and before bowing, he will say "Allahu Akbar" 3 times. Drop your hands by your sides each time.',
        descUr: 'دوسری رکعت میں قراءت کے بعد اور رکوع سے پہلے، امام 3 بار "اللہ اکبر" کہے گا۔ ہر بار ہاتھ کانوں تک اٹھا کر چھوڑ دیں۔',
      },
      {
        titleEn: 'Fourth Takbeer for Ruku',
        titleUr: 'رکوع کی چوتھی تکبیر',
        descEn: 'The Imam will say "Allahu Akbar" a 4th time without raising hands, going directly into Ruku. Complete the prayer normally.',
        descUr: 'امام چوتھی بار ہاتھ اٹھائے بغیر "اللہ اکبر" کہے گا اور سیدھا رکوع میں جائے گا۔ پھر معمول کے مطابق نماز مکمل کریں۔',
      }
    ],
  },
  {
    id: 'istikhara',
    titleEn: 'Istikhara Prayer',
    titleUr: 'طریقہ استخارہ',
    icon: 'star-outline',
    coverImage: require('@/assets/images/guide/istikhara.png'),
    steps: [
      {
        titleEn: 'Perform Wudu',
        titleUr: 'وضو کرنا',
        descEn: 'Ensure you are clean and perform a complete Wudu.',
        descUr: 'یقینی بنائیں کہ آپ پاک ہیں اور مکمل وضو کریں۔',
      },
      {
        titleEn: 'Pray 2 Rakats',
        titleUr: 'دو رکعت نفل',
        descEn: 'Pray two Rakats of voluntary (Nafl) prayer. It is sunnah to recite Surah Al-Kafirun in the first and Surah Al-Ikhlas in the second.',
        descUr: 'دو رکعت نفل نماز پڑھیں۔ پہلی رکعت میں سورۃ الکافرون اور دوسری میں سورۃ الاخلاص پڑھنا سنت ہے۔',
      },
      {
        titleEn: 'Praise Allah & Send Blessings',
        titleUr: 'اللہ کی حمد اور درود',
        descEn: 'After the prayer, begin your Dua by praising Allah and sending Durood upon Prophet Muhammad (PBUH).',
        descUr: 'نماز کے بعد اللہ کی حمد و ثنا اور نبی کریم ﷺ پر درود بھیج کر دعا کا آغاز کریں۔',
      },
      {
        titleEn: 'Recite Istikhara Dua',
        titleUr: 'دعا استخارہ پڑھنا',
        descEn: 'Recite the specific Dua of Istikhara. When reaching the part mentioning "this matter", focus your heart on the decision you need to make.',
        descUr: 'استخارہ کی مخصوص دعا پڑھیں۔ جب اس معاملے کا ذکر آئے، تو اپنے دل میں اس فیصلے کا تصور کریں۔',
      },
      {
        titleEn: 'Trust in Allah\'s Plan',
        titleUr: 'اللہ پر توکل',
        descEn: 'You do not need to see a dream. Whichever option becomes easier or feels right in your heart, proceed with it trusting Allah.',
        descUr: 'خواب دیکھنا ضروری نہیں۔ جو راستہ آسان ہو جائے یا دل کو مطمئن کرے، اللہ پر توکل کرتے ہوئے اس پر عمل کریں۔',
      }
    ],
  },
  {
    id: 'sajda',
    titleEn: 'Sajdah Tilawat',
    titleUr: 'سجدہ تلاوت',
    icon: 'book-outline',
    coverImage: require('@/assets/images/guide/sajda.png'),
    steps: [
      {
        titleEn: 'Requirements',
        titleUr: 'شرائط',
        descEn: 'You must be in a state of Wudu, properly covered, and facing the Qibla.',
        descUr: 'وضو کا ہونا، جسم کا ڈھکا ہونا اور قبلہ رخ ہونا ضروری ہے۔',
      },
      {
        titleEn: 'Intention',
        titleUr: 'نیت',
        descEn: 'Make the intention in your heart to perform the Prostration of Recitation.',
        descUr: 'دل میں سجدہ تلاوت ادا کرنے کی نیت کریں۔',
      },
      {
        titleEn: 'Go into Prostration',
        titleUr: 'سجدے میں جانا',
        descEn: 'Say "Allahu Akbar" (without raising your hands) and go directly down into a single prostration (Sujood).',
        descUr: '"اللہ اکبر" کہیں (ہاتھ اٹھائے بغیر) اور سیدھا ایک سجدے میں جائیں۔',
      },
      {
        titleEn: 'Recite Tasbih',
        titleUr: 'تسبیح پڑھنا',
        descEn: 'Recite "Subhana Rabbiyal A\'la" 3 times while in prostration.',
        descUr: 'سجدے میں 3 بار "سبحان ربی الاعلیٰ" پڑھیں۔',
      },
      {
        titleEn: 'Rise Up',
        titleUr: 'سجدے سے اٹھنا',
        descEn: 'Say "Allahu Akbar" and sit or stand back up. There is no Salam required.',
        descUr: '"اللہ اکبر" کہہ کر اٹھیں۔ اس میں سلام پھیرنے کی ضرورت نہیں ہوتی۔',
      }
    ],
  },
  {
    id: 'fasting',
    titleEn: 'Fasting (Sawm)',
    titleUr: 'طریقہ صوم',
    icon: 'nutrition-outline',
    coverImage: require('@/assets/images/guide/fasting.png'),
    steps: [
      {
        titleEn: 'Intention',
        titleUr: 'نیت',
        descEn: 'Make the intention to fast before Fajr. You can make it in your heart or by reciting the Dua for fasting.',
        descUr: 'فجر سے پہلے روزے کی نیت کریں۔ یہ دل میں بھی کی جا سکتی ہے یا روزے کی دعا پڑھ کر۔',
      },
      {
        titleEn: 'Suhoor (Pre-dawn Meal)',
        titleUr: 'سحری',
        descEn: 'Wake up before dawn and eat Suhoor. It is a highly recommended Sunnah that contains blessings.',
        descUr: 'فجر سے پہلے اٹھ کر سحری کھائیں۔ یہ ایک مبارک سنت ہے۔',
      },
      {
        titleEn: 'Abstain Throughout the Day',
        titleUr: 'دن بھر پرہیز',
        descEn: 'Completely abstain from eating, drinking, smoking, and intimate relations from dawn (Fajr) until sunset (Maghrib).',
        descUr: 'طلوع فجر سے غروب آفتاب تک کھانے، پینے، اور نفسانی خواہشات سے مکمل پرہیز کریں۔',
      },
      {
        titleEn: 'Guarding the Fast',
        titleUr: 'روزے کی حفاظت',
        descEn: 'A true fast also means guarding your tongue from lying, backbiting, and arguing, and guarding your eyes from forbidden things.',
        descUr: 'حقیقی روزہ یہ ہے کہ زبان کو جھوٹ اور غیبت سے، اور آنکھوں کو حرام چیزوں سے بچایا جائے۔',
      },
      {
        titleEn: 'Iftar (Breaking the Fast)',
        titleUr: 'افطار',
        descEn: 'Break your fast immediately at sunset (Maghrib). It is Sunnah to break it with dates and water while reciting the Dua for Iftar.',
        descUr: 'غروب آفتاب کے فوراً بعد روزہ افطار کریں۔ کھجور اور پانی سے روزہ کھولنا اور افطار کی دعا پڑھنا سنت ہے۔',
      }
    ],
  }
];
