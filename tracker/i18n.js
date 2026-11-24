// =====================================================================
//  i18n.js — English / Arabic. The English text is the key; AR holds the
//  Arabic translation. Missing translations fall back to English.
//  Use {name} for values that are filled in, e.g. t('Added {x}', { x: 'Koshari' }).
// =====================================================================
let lang = 'en';
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
export function t(s, v) {
  let out = (lang === 'ar' && AR[s]) || s;
  if (v) out = out.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
  return out;
}
// dates with Western digits in both languages, so numbers look the same everywhere
export const locale = () => (lang === 'ar' ? 'ar-EG-u-nu-latn' : undefined);

// Food categories
export const CAT_AR = {
  'Egyptian breakfast': 'فطار مصري', 'Bread': 'عيش ومخبوزات', 'Egyptian salads': 'سلطات ومقبلات مصرية', 'Egyptian mains': 'أكلات مصرية',
  'Egyptian desserts': 'حلويات مصرية', 'Egyptian snacks': 'تسالي مصرية', 'Drinks': 'مشروبات', 'Dairy': 'ألبان', 'International breakfast': 'فطار عالمي',
  'Middle Eastern': 'أكلات شرقية', 'Italian': 'إيطالي', 'Salads': 'سلطات', 'Fast food': 'وجبات سريعة', 'Mexican': 'مكسيكي', 'Asian': 'آسيوي',
  'Indian': 'هندي', 'Western': 'غربي', 'Healthy': 'صحي', 'Proteins': 'بروتينات', 'Legumes': 'بقوليات', 'Fats & oils': 'دهون وزيوت', 'Grains': 'حبوب ونشويات',
  'Vegetables': 'خضروات', 'Fruits': 'فواكه', 'Nuts & snacks': 'مكسرات وسناكس', 'Sweets': 'حلويات', 'My foods': 'أكلاتي', 'Scanned products': 'منتجات ممسوحة',
};
// Serving sizes like "1 cup", "2 slices", "1/4 pie" → Arabic words, numbers kept
const UNIT_AR = [
  ['medium box', 'علبة وسط'], ['large box', 'علبة كبيرة'], ['small bag', 'كيس صغير'], ['cup sliced', 'كوب مقطع'], ['can drained', 'علبة مصفاة'],
  ['tbsp', 'ملعقة كبيرة'], ['tsp', 'ملعقة صغيرة'], ['cups', 'كوب'], ['cup', 'كوب'], ['pieces', 'قطع'], ['piece', 'قطعة'], ['slices', 'شرائح'], ['slice', 'شريحة'],
  ['plate', 'طبق'], ['bowl', 'طبق'], ['sandwiches', 'ساندوتشات'], ['sandwich', 'ساندوتش'], ['loaf', 'رغيف'], ['roll', 'عيش فينو'], ['glass', 'كوباية'], ['can', 'علبة'],
  ['pack', 'باكو'], ['bar', 'لوح'], ['scoop', 'مغرفة'], ['shot', 'شوت'], ['jar', 'برطمان'], ['box', 'علبة'], ['wrap', 'راب'], ['burger', 'برجر'], ['hot dog', 'هوت دوج'],
  ['pancakes', 'بان كيك'], ['waffle', 'وافل'], ['omelette', 'أومليت'], ['eggs', 'بيض'], ['large', 'كبير'], ['medium', 'وسط'], ['small', 'صغير'], ['square', 'قطعة'],
  ['portion', 'حصة'], ['serving', 'حصة'], ['pie', 'فطيرة'], ['chicken', 'فرخة'], ['pigeon', 'حمامة'], ['cob', 'كوز'], ['fruits', 'ثمرات'], ['fruit', 'ثمرة'],
  ['dates', 'تمرات'], ['date', 'تمرة'], ['figs', 'تينات'], ['olives', 'زيتونات'], ['almonds', 'لوزات'], ['halves', 'أنصاف'], ['biscuits', 'بسكويتات'], ['fingers', 'أصابع'],
  ['squares', 'مربعات'], ['cakes', 'قطع'], ['tacos', 'تاكو'], ['quesadilla', 'كاساديا'], ['burrito', 'بوريتو'], ['donut', 'دونات'], ['nuggets', 'قطع'], ['rabbit', 'أرانب'],
  ['rolls', 'صوابع'], ['AI estimate', 'تقدير ذكي'], ['g', 'جم'], ['ml', 'مل'],
];
export function serving(s) {
  if (lang !== 'ar' || !s) return s || '';
  let out = String(s);
  for (const [en, ar] of UNIT_AR) out = out.replace(new RegExp('\\b' + en.replace(/ /g, '\\s') + '\\b', 'gi'), ar);
  return out;
}
export const cat = (c) => (lang === 'ar' && CAT_AR[c]) || c;

const AR = {
  // navigation
  'Today': 'اليوم', 'Plans': 'الخطط', 'Ideas': 'اقتراحات', 'History': 'السجل', 'Foods': 'الأكلات', 'Settings': 'الإعدادات',
  'My Nutrition': 'تغذيتي', 'Loading…': 'جارِ التحميل…', 'Language': 'اللغة',
  // today
  'Previous day': 'اليوم السابق', 'Next day': 'اليوم التالي',
  'You have no nutrition plan yet.': 'لسه معندكش خطة تغذية.', 'Create your plan': 'اعمل خطتك',
  'to get your personal calorie target.': 'علشان تعرف السعرات المناسبة ليك.',
  'kcal left': 'سعر متبقي', 'kcal over': 'سعر زيادة', 'kcal': 'سعر',
  'Plan': 'الخطة', 'target': 'الهدف', 'eaten': 'أكلت', 'P': 'ب', 'C': 'ك', 'F': 'د', 'Protein': 'بروتين', 'Carbs': 'كربوهيدرات', 'Fat': 'دهون', 'g': 'جم',
  'Water': 'المياه', 'glasses': 'كوباية', 'AI meal scan': 'مسح الوجبة بالذكاء الاصطناعي', 'Scan barcode': 'مسح الباركود',
  'Copy yesterday': 'انسخ امبارح', "Log my plan's menu": 'سجّل منيو خطتي',
  'Nothing logged yet.': 'لسه متسجلش حاجة.', '+ Add food': '+ أضف أكل', 'Less': 'أقل', 'More': 'أكتر', 'Remove': 'احذف',
  "Today's weight": 'وزن النهارده', 'kg (optional)': 'كجم (اختياري)', 'e.g. {x}': 'مثلاً {x}', 'Notes': 'ملاحظات', 'How did today go?': 'يومك كان عامل إزاي؟',
  'Nothing logged yesterday.': 'مفيش حاجة متسجلة امبارح.', "Copied yesterday's meals": 'تم نسخ وجبات امبارح',
  'This plan has no menu yet. Open it in Plans.': 'الخطة دي ملهاش منيو. افتحها من الخطط.',
  "Your plan's menu was added — edit anything you changed": 'تمت إضافة منيو خطتك — عدّل أي حاجة غيرتها',
  'Weight saved': 'تم حفظ الوزن', 'Default (no plan yet)': 'افتراضي (من غير خطة)',
  // meals
  'Breakfast': 'الفطار', 'Lunch': 'الغدا', 'Dinner': 'العشا', 'Snacks': 'السناكس',
  // add sheet
  'Close': 'إغلاق', 'Add to': 'أضف إلى', 'Search': 'بحث', 'AI scan': 'مسح ذكي', 'Barcode': 'باركود', 'Recent & ★': 'الأخيرة و★', 'Custom': 'أكلة جديدة',
  'Added {x}': 'تمت إضافة {x}', '1 serving = {x}': 'الحصة = {x}', 'Servings': 'عدد الحصص', 'or grams': 'أو بالجرام',
  'Add to {x}': 'أضف إلى {x}', '★ Favorite': '★ مفضلة', '☆ Favorite': '☆ أضف للمفضلة', 'Add {x}': 'أضف {x}',
  'Search: koshari, كشري, chicken, pizza…': 'ابحث: كشري، فول، فراخ، بيتزا…', 'All': 'الكل', 'Egyptian': 'مصري', 'International': 'عالمي', 'Basic': 'أساسي', 'My foods': 'أكلاتي',
  'No match. Try the AI scan, or add it under Custom.': 'مفيش نتيجة. جرّب المسح الذكي، أو أضفها كأكلة جديدة.',
  'Favorites': 'المفضلة', 'Tap ☆ Favorite when adding a food.': 'دوس ☆ وانت بتضيف أكلة علشان تحطها في المفضلة.',
  'Recently eaten': 'أكلتها مؤخراً', 'Nothing yet.': 'لسه مفيش.', 'Saved to My foods': 'اتحفظت في أكلاتي',
  'Point the camera at the barcode of a packaged product. Data from Open Food Facts.': 'وجّه الكاميرا على باركود المنتج المعبأ. البيانات من Open Food Facts.',
  'Starting camera…': 'جارِ تشغيل الكاميرا…', 'or type the barcode number': 'أو اكتب رقم الباركود', 'Look up': 'بحث',
  'Barcode {x} — looking it up…': 'باركود {x} — جارِ البحث…', 'Product {x} was not found. Add it under Custom.': 'المنتج {x} مش موجود. أضفه كأكلة جديدة.',
  'Found it. Tap + to add.': 'لقيناه. دوس + للإضافة.', 'Could not reach the product database. Check your internet.': 'مقدرناش نوصل لقاعدة المنتجات. اتأكد من الإنترنت.',
  'Camera is not available here. Type the barcode instead.': 'الكاميرا مش متاحة هنا. اكتب الباركود بدلها.',
  'Camera could not start ({x}). Allow camera access, or type the barcode.': 'الكاميرا مشتغلتش ({x}). اسمح بالوصول للكاميرا، أو اكتب الباركود.',
  'Hold the barcode inside the frame.': 'خلّي الباركود جوه الإطار.',
  'The AI scanner needs your own Anthropic API key.': 'المسح الذكي محتاج مفتاح Anthropic API الخاص بيك.', 'Add it in Settings': 'أضفه من الإعدادات',
  'Until then, use Search or Barcode.': 'لحد ما تضيفه، استخدم البحث أو الباركود.',
  'Take a photo of your plate (or choose one), and/or describe it. The AI lists each food with estimated grams and calories — check and adjust before adding.':
    'صوّر طبقك (أو اختار صورة) و/أو اوصفه. الذكاء الاصطناعي هيكتب كل أكلة بالجرامات والسعرات التقريبية — راجعها وعدّلها قبل الإضافة.',
  '📷 Take or choose a photo': '📷 صوّر أو اختار صورة', 'Change photo': 'غيّر الصورة', 'Description (optional)': 'الوصف (اختياري)',
  "e.g. 2 ta'ameya sandwiches and tea with 2 sugars": 'مثلاً: 2 ساندوتش طعمية وشاي بمعلقتين سكر', 'Analyse meal': 'حلّل الوجبة',
  'Add a photo or a description': 'أضف صورة أو وصف', 'Analysing your meal…': 'جارِ تحليل وجبتك…', 'No food found.': 'مفيش أكل في الصورة.',
  'confidence': 'الثقة', 'high': 'عالية', 'medium': 'متوسطة', 'low': 'منخفضة', 'Total': 'الإجمالي', 'Add selected': 'أضف المختار',
  'Added {x} items': 'تمت إضافة {x} أصناف', '{x} g (AI estimate)': '{x} جم (تقدير ذكي)',
  // AI errors
  'Add your Anthropic API key in Settings to use the AI meal scanner.': 'أضف مفتاح Anthropic API من الإعدادات علشان تستخدم المسح الذكي.',
  'The AI could not analyse this photo. Try another photo or type a description.': 'مقدرناش نحلل الصورة دي. جرّب صورة تانية أو اكتب وصف.',
  'The answer was cut off. Please try again.': 'الرد اتقطع. حاول تاني.', 'Could not read the AI answer. Please try again.': 'مقدرناش نقرا الرد. حاول تاني.',
  'Your API key was rejected. Check it in Settings.': 'مفتاح الـ API مرفوض. راجعه في الإعدادات.',
  'Too many requests right now. Wait a minute and try again.': 'طلبات كتير دلوقتي. استنى دقيقة وحاول تاني.',
  'The AI service is busy. Please try again shortly.': 'الخدمة مشغولة. حاول كمان شوية.',
  'No internet connection, or the AI service could not be reached.': 'مفيش إنترنت، أو مقدرناش نوصل للخدمة.', 'Something went wrong.': 'حصلت مشكلة.',
  'Could not read the photo.': 'مقدرناش نقرا الصورة.',
  // custom food form
  'Food name': 'اسم الأكلة', 'Arabic name (optional)': 'الاسم بالعربي (اختياري)', 'English name (optional)': 'الاسم بالإنجليزي (اختياري)',
  'Serving (e.g. 1 plate)': 'الحصة (مثلاً طبق)', 'Serving weight': 'وزن الحصة', 'Calories': 'السعرات', 'kcal / serving': 'سعر / حصة',
  'Type': 'النوع', 'Save food': 'احفظ الأكلة', '1 serving': 'حصة واحدة',
  // plans list
  'My nutrition plans': 'خطط التغذية', '+ New plan': '+ خطة جديدة',
  'Make as many plans as you like (e.g. "Cutting", "Ramadan", "Maintenance"). The active plan sets your daily targets.':
    'اعمل خطط زي ما تحب (مثلاً "تنشيف"، "رمضان"، "ثبات"). الخطة النشطة هي اللي بتحدد أهدافك اليومية.',
  'Active': 'نشطة', 'kcal/day': 'سعر/يوم', 'meals': 'وجبات', 'Mixed': 'متنوع', 'food': 'أكل', 'Goal': 'الهدف',
  'Make active': 'فعّلها', 'Open / edit': 'فتح / تعديل', 'Duplicate': 'نسخ', 'Delete': 'حذف', 'No plans yet.': 'لسه مفيش خطط.', 'Create my first plan': 'اعمل أول خطة',
  'Plan activated': 'تم تفعيل الخطة', '(copy)': '(نسخة)', 'Delete the plan "{x}"? Your food log is kept.': 'تحذف الخطة "{x}"؟ سجل أكلك هيفضل موجود.',
  'Cancel': 'إلغاء', 'Maintain weight': 'ثبات الوزن', 'Lose {x} kg/week': 'خسارة {x} كجم/أسبوع', 'Gain {x} kg/week': 'زيادة {x} كجم/أسبوع',
  // plan editor
  '‹ All plans': '› كل الخطط', 'New nutrition plan': 'خطة تغذية جديدة', 'Edit plan': 'تعديل الخطة', 'My plan': 'خطتي',
  '1 · About you': '1 · بياناتك', 'Plan name': 'اسم الخطة', 'Sex': 'النوع', 'Female': 'أنثى', 'Male': 'ذكر', 'Age': 'السن', 'years': 'سنة',
  'Height': 'الطول', 'cm': 'سم', 'Weight': 'الوزن', 'kg': 'كجم', 'Activity': 'النشاط',
  'Sedentary (desk job, little exercise)': 'خامل (شغل مكتب، رياضة قليلة)', 'Lightly active (exercise 1–3 days/week)': 'نشاط خفيف (رياضة 1–3 أيام/أسبوع)',
  'Moderately active (3–5 days/week)': 'نشاط متوسط (3–5 أيام/أسبوع)', 'Very active (6–7 days/week)': 'نشاط عالي (6–7 أيام/أسبوع)',
  'Athlete / physical job + training': 'رياضي / شغل مجهود + تمرين',
  '2 · Goal': '2 · الهدف', 'Lose weight': 'خسارة وزن', 'Maintain': 'ثبات', 'Gain weight / muscle': 'زيادة وزن / عضل', 'Speed': 'السرعة', 'kg per week': 'كجم في الأسبوع',
  'Override calories': 'سعرات يدوية', 'optional': 'اختياري', 'auto': 'تلقائي',
  '3 · Macros & meals': '3 · العناصر والوجبات', 'Diet style': 'نوع الدايت', '% kcal': '% سعرات', 'Meals per day': 'عدد الوجبات',
  '3 meals': '3 وجبات', '3 meals + 1 snack': '3 وجبات + سناك', '3 meals + 2 snacks': '3 وجبات + 2 سناك', 'Food style': 'نوع الأكل',
  'Mixed (Egyptian + international)': 'متنوع (مصري + عالمي)', 'Mostly Egyptian': 'مصري غالباً', 'Mostly international': 'عالمي غالباً',
  '4 · Daily menu': '4 · منيو اليوم', '↻ Generate new menu': '↻ منيو جديد',
  'A sample day that fits your plan. Regenerate for new ideas, remove items, or add your own.': 'يوم مقترح مناسب لخطتك. اعمل منيو جديد لأفكار تانية، احذف أصناف، أو أضف أكلك.',
  'Save plan': 'احفظ الخطة', 'Save changes': 'احفظ التعديلات', 'Make this my active plan': 'اجعلها خطتي النشطة',
  'BMR (Mifflin-St Jeor)': 'معدل الحرق الأساسي (Mifflin-St Jeor)', 'Daily burn (TDEE)': 'الحرق اليومي (TDEE)', 'Your daily target': 'هدفك اليومي',
  '(−{x} kcal/day → about {y} kg/week)': '(−{x} سعر/يوم ← حوالي {y} كجم/أسبوع)', '(+{x} kcal/day)': '(+{x} سعر/يوم)',
  'This is below the usual safe minimum ({x} kcal). It was raised to {x}.': 'ده أقل من الحد الآمن المعتاد ({x} سعر). اترفع لـ {x}.',
  'g/kg': 'جم/كجم', 'Percentages add up to {x}%, they should add to 100%.': 'مجموع النسب {x}%، لازم يكون 100%.',
  'Menu total': 'إجمالي المنيو', '+ Add': '+ أضف', 'Search foods': 'ابحث عن أكلة', 'Macro percentages must add up to 100%': 'مجموع النسب لازم يكون 100%',
  'Plan saved': 'تم حفظ الخطة',
  'Balanced': 'متوازن', 'High protein': 'بروتين عالي', 'Low carb': 'كارب قليل', 'Keto': 'كيتو', 'Custom %': 'نسب مخصصة', 'Mediterranean': 'متوسطي', 'Endurance / sport': 'رياضة / تحمّل',
  // recommendations
  'Meal recommendations': 'اقتراحات الوجبات', 'kcal left today': 'السعرات المتبقية النهارده', 'Protein left': 'البروتين المتبقي', 'Budget for {x}': 'المسموح لـ{x}',
  'All food': 'كل الأكل', '💡 Tips for you': '💡 نصايح ليك', 'Complete {x} ideas': 'أفكار {x} كاملة', '+ Add both': '+ أضف الاتنين',
  '🇪🇬 Egyptian picks that fit': '🇪🇬 اختيارات مصرية مناسبة', '🌍 International picks that fit': '🌍 اختيارات عالمية مناسبة',
  '💪 High-protein choices': '💪 اختيارات عالية البروتين', 'Most protein for the calories.': 'أعلى بروتين مقابل السعرات.',
  '★ Your favorites that fit': '★ مفضلاتك المناسبة', '🥗 Light snacks (≤ 100 kcal)': '🥗 سناكس خفيفة (≤ 100 سعر)',
  'For when you are hungry but close to your target.': 'لما تكون جعان وقربت من هدفك.', 'Added {x} to {y}': 'تمت إضافة {x} إلى {y}', 'Added to {x}': 'تمت الإضافة إلى {x}',
  'You are {x} kcal over today. Choose water, tea without sugar, salad or vegetables if you are still hungry, and a walk helps.':
    'انت زودت {x} سعر النهارده. لو لسه جعان اختار مياه، شاي من غير سكر، سلطة أو خضار، والمشي هيساعدك.',
  'You still need {x} g protein. Good Egyptian picks: gebna areesh, eggs, ful, grilled chicken or fish, termes, Greek yogurt.':
    'لسه محتاج {x} جم بروتين. اختيارات مصرية كويسة: جبنة قريش، بيض، فول، فراخ أو سمك مشوي، ترمس، زبادي يوناني.',
  'Only {x} glasses of water so far. Aim for {y}.': 'شربت {x} كوبايات مياه بس لحد دلوقتي. هدفك {y}.',
  'Your fat budget is almost used. Prefer grilled or boiled foods over fried ones, and go easy on oil, tahini and ghee.':
    'الدهون قربت تخلص. اختار المشوي أو المسلوق بدل المقلي، وقلل الزيت والطحينة والسمنة.',
  'Carbs are over target. Swap bread or rice for extra vegetables or salad at the next meal.': 'الكربوهيدرات زادت عن الهدف. بدّل العيش أو الرز بخضار أو سلطة في الوجبة الجاية.',
  'You are on track. Keep meals balanced: a protein, a vegetable or salad, and a carb portion that fits.': 'انت ماشي صح. خلي وجباتك متوازنة: بروتين، خضار أو سلطة، وحصة نشويات مناسبة.',
  // history
  'History & progress': 'السجل والتقدم', '{x} days': '{x} يوم', 'Avg kcal': 'متوسط السعرات', 'Avg protein': 'متوسط البروتين',
  'Days on target': 'أيام في الهدف', 'within ±10%': 'في حدود ±10%', 'Streak': 'أيام متتالية', 'days logged': 'يوم مسجل',
  'Calories per day': 'السعرات في اليوم', 'Daily log': 'السجل اليومي', 'Day': 'اليوم', 'Start': 'البداية', 'Latest': 'الأحدث', 'Change': 'التغيير',
  'Log your weight on the Today page to see your progress here.': 'سجّل وزنك في صفحة اليوم علشان تشوف تقدمك هنا.',
  // foods
  'Food database': 'قاعدة الأكلات', '{x} built-in Egyptian & international foods, plus {y} of your own. Search in English or Arabic.':
    '{x} أكلة مصرية وعالمية، و{y} من أكلاتك. ابحث بالعربي أو بالإنجليزي.',
  '+ Add my own food': '+ أضف أكلة من عندي', 'Search foods…': 'ابحث عن أكلة…', 'delete': 'حذف', 'Food saved': 'اتحفظت الأكلة',
  'Delete this food from My foods?': 'تحذف الأكلة دي من أكلاتي؟', 'Meal': 'الوجبة', 'Add to today': 'أضف للنهارده', 'Added to today': 'اتضافت للنهارده',
  // settings
  '📷 AI meal scanner': '📷 المسح الذكي للوجبات',
  'The photo scanner uses Claude (by Anthropic) to recognise foods and estimate calories. Paste your own API key from':
    'المسح بالصورة بيستخدم Claude (من Anthropic) علشان يتعرف على الأكل ويقدّر السعرات. حط مفتاح الـ API الخاص بيك من',
  'The key is stored only on this device and is sent only to Anthropic. Each scan costs a few cents or less on your Anthropic account.':
    'المفتاح بيتحفظ على الجهاز ده بس وبيتبعت لـ Anthropic بس. كل مسح بيتكلف سنتات قليلة أو أقل من حسابك في Anthropic.',
  'Anthropic API key': 'مفتاح Anthropic API', 'Save key': 'احفظ المفتاح', 'Remove key': 'احذف المفتاح',
  'The barcode scanner and food search work without a key.': 'مسح الباركود والبحث شغالين من غير مفتاح.', 'Key saved': 'اتحفظ المفتاح', 'Key cleared': 'اتمسح المفتاح',
  '💧 Water goal': '💧 هدف المياه', 'Glasses per day': 'كوبايات في اليوم', 'Saved': 'اتحفظ',
  '💾 Backup': '💾 نسخة احتياطية',
  'Your plans, log and foods are saved in this browser. Download a backup to keep them safe or move them to another phone or computer.':
    'خططك وسجلك وأكلاتك محفوظين في المتصفح ده. نزّل نسخة احتياطية علشان تحافظ عليهم أو تنقلهم لموبايل أو كمبيوتر تاني.',
  'Download backup': 'نزّل نسخة احتياطية', 'Restore backup': 'استرجع نسخة احتياطية', 'Danger zone': 'منطقة خطر',
  'Delete all my nutrition data': 'احذف كل بياناتي', 'Replace the data on this device with the backup?': 'تستبدل البيانات اللي على الجهاز بالنسخة الاحتياطية؟',
  'Restore': 'استرجاع', 'Backup restored': 'تم الاسترجاع', 'This file is not a valid nutrition backup.': 'الملف ده مش نسخة احتياطية صحيحة.',
  'Delete ALL plans, food logs and custom foods on this device? This cannot be undone.': 'تحذف كل الخطط وسجل الأكل والأكلات اللي ضفتها من الجهاز ده؟ مينفعش ترجع.',
  'All data deleted': 'اتحذفت كل البيانات',
  'Calorie targets use the Mifflin-St Jeor equation. Food values are typical portions and are estimates. This app supports, and does not replace, advice from a dietitian or doctor.':
    'الهدف اليومي محسوب بمعادلة Mifflin-St Jeor. قيم الأكل لحصص معتادة وهي تقديرية. التطبيق ده مساعد ومش بديل عن أخصائي التغذية أو الدكتور.',
  'Could not save on this device: {x}': 'مقدرناش نحفظ على الجهاز: {x}',
  'The app could not start.': 'التطبيق مشتغلش.', 'Check your internet connection and reload. Your data is safe.': 'اتأكد من الإنترنت وحمّل الصفحة تاني. بياناتك في أمان.', 'Reload': 'إعادة تحميل',
};
