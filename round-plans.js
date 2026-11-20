// Explicit, per-quiz finales. Short sets are pilots, never padded with repeats.
(() => {
  'use strict';
  const choice = (id, text, answers, explanation, source) => ({id, text, answers, correct: 0, explanation, source});
  const number = (id, text, value, explanation) => ({id, text, correctValue: String(value), answerMode: 'number', unit: '', explanation});
  const music = [
    choice('final-rock-1', 'Подсказки: братья Лиам и Ноэл Галлахеры, альбом Definitely Maybe. Назовите группу.', ['Oasis','Blur','Radiohead','Pulp'], 'Definitely Maybe — дебютный альбом Oasis; в группе играли братья Галлахеры.', 'https://www.oasisinet.com/the-story/'),
    choice('final-rock-2', 'Подсказки: Фредди Меркьюри, Брайан Мэй и выступление на Live Aid. Какая это группа?', ['Queen','The Beatles','Pink Floyd','The Who'], 'Меркьюри и Мэй — участники Queen, выступившей на Live Aid в 1985 году.', 'https://www.queenonline.com/queen')
  ];
  const queen = [
    choice('final-queen-1', 'На полке нужен альбом Queen с Bohemian Rhapsody и Love of My Life. Какой выбрать?', ['A Night at the Opera','News of the World','The Game','The Miracle'], 'Обе песни входят в A Night at the Opera.', 'https://store-us.queenonline.com/products/a-night-at-the-opera-50th-anniversary-edition'),
    choice('final-queen-2', 'Ищем участника Queen: гитарист, вместе с отцом построил Red Special. Кто это?', ['Брайан Мэй','Роджер Тейлор','Джон Дикон','Фредди Меркьюри'], 'Red Special — гитара Брайана Мэя.', 'https://brianmay.com/brian-news/2020/10/how-the-red-special-got-its-name/')
  ];
  const pop = [
    choice('final-pop-1', 'Подсказки: шведский квартет и победа на Евровидении с Waterloo. Кто это?', ['ABBA','a-ha','Ace of Base','Roxette'], 'ABBA победили на Евровидении 1974 года с Waterloo.', 'https://abbasite.com/story/'),
    choice('final-pop-2', 'Ищем исполнительницу: альбом 21, песни Rolling in the Deep и Someone Like You. Кто это?', ['Адель','Эми Уайнхаус','Мадонна','Шакира'], 'Эти песни входят в альбом 21 Адель.', 'https://www.adele.com/')
  ];
  const cinema = [
    choice('final-film-1', 'Герой ищет древний ковчег, носит шляпу и пользуется кнутом. Кто это?', ['Индиана Джонс','Люк Скайуокер','Шерлок Холмс','Джеймс Бонд'], 'Археолог Индиана Джонс — герой «В поисках утраченного ковчега».', 'https://www.lucasfilm.com/productions/raiders-of-the-lost-ark/'),
    choice('final-film-2', 'Контрабандист летает с Чубаккой на «Тысячелетнем соколе». Назовите героя.', ['Хан Соло','Оби-Ван Кеноби','Дарт Вейдер','Лэндо Калриссиан'], 'Хан Соло и Чубакка — экипаж «Тысячелетнего сокола».', 'https://www.starwars.com/databank/han-solo')
  ];
  const soviet = [
    choice('final-soviet-1', 'Студент работает на стройке, готовится к экзамену и охраняет склад. Как зовут героя трёх новелл?', ['Шурик','Гоша','Деточкин','Остап Бендер'], 'Это три новеллы фильма «Операция „Ы“ и другие приключения Шурика».', 'https://www.mosfilm.ru/cinema/films/operatsiya-y-i-drugie-priklyucheniya-shurika/'),
    choice('final-soviet-2', 'Управдом оказывается в XVI веке, а царь — в квартире изобретателя. Назовите фильм.', ['Иван Васильевич меняет профессию','Джентльмены удачи','Берегись автомобиля','Служебный роман'], 'Машина времени меняет местами управдома и Ивана Грозного.', 'https://www.mosfilm.ru/cinema/films/ivan-vasilevich-menyaet-professiyu/')
  ];
  const auto = [
    {id:'final-auto-1',text:'У четырёхтактного двигателя рабочий цикл включает впуск, сжатие, рабочий ход и выпуск.',answers:['Правда','Вымысел'],correct:0,explanation:'Четыре такта — впуск, сжатие, рабочий ход и выпуск.',source:'https://global.honda/en/technical-review/PDF/026-2/Vol.26-2e.pdf'},
    {id:'final-auto-2',text:'В обозначении полного привода 4×4 второе число означает число передач коробки.',answers:['Правда','Вымысел'],correct:1,explanation:'Второе число обозначает число ведущих колёс, а не передач.',source:'https://www.jeep.com/4x4/faq-and-glossary.html'}
  ];
  const geography = [
    number('final-geo-1','На карте масштаба 1:100 000 маршрут занимает 7 см. Сколько это километров?',7,'1 см соответствует 1 км; 7 см — 7 км.'),
    number('final-geo-2','Путешественник идёт 3 часа со скоростью 4 км/ч. Сколько километров он пройдёт?',12,'Расстояние равно скорости, умноженной на время: 4 × 3 = 12 км.')
  ];
  const space = [
    number('final-space-1','Учебная модель: сигнал идёт со скоростью 300 000 км/с. Сколько секунд нужно на 900 000 км?',3,'900 000 / 300 000 = 3 секунды. Используется указанная в условии модель.'),
    number('final-space-2','Учебная орбита: аппарат совершает оборот за 90 минут. Сколько полных оборотов займут 9 часов?',6,'9 часов — 540 минут; 540 / 90 = 6 оборотов.')
  ];
  const physics = [
    number('final-physics-1','Поезд движется равномерно со скоростью 20 м/с. Сколько метров он пройдёт за 15 секунд?',300,'20 × 15 = 300 метров.'),
    number('final-physics-2','Лампа мощностью 60 Вт работает 5 часов. Сколько ватт-часов энергии она потребит?',300,'60 Вт × 5 ч = 300 Вт·ч.')
  ];
  const logic = [
    number('final-logic-1','В турнире 6 игроков. Каждый играет с каждым ровно один раз. Сколько всего игр?',15,'6 × 5 / 2 = 15 пар.'),
    number('final-logic-2','Код состоит из трёх цифр от 0 до 9, повторы и ведущий ноль разрешены. Сколько разных кодов?',1000,'Для каждого разряда 10 вариантов: 10³ = 1000.')
  ];
  const finales = {};
  const extra=window.QUIZ_FINALE_EXTRAS;
  for(const [name,bank] of Object.entries({music,queen,pop,cinema,soviet,auto,geography,space,physics,logic}))bank.push(...extra[name]);
  const register = (ids, title, type, questions) => ids.forEach(id => {finales[id] = {title, type, questions};});
  register(['rock-legends','music-groups'], 'Группа по подсказкам', 'choice', music);
  register(['queen-story'], 'Досье Queen', 'choice', queen);
  register(['pop-hits','music-hits'], 'Исполнитель по подсказкам', 'choice', pop);
  register(['screen-worlds','big-cinema','film-cinema','film-makers'], 'Герой в ситуации', 'choice', cinema);
  register(['soviet-cinema'], 'Узнай сюжет', 'choice', soviet);
  register(['auto-cars','auto-engine'], 'Автомифы: правда или вымысел', 'true-false', auto);
  register(['world-travel','geo-globe','geo-mountains'], 'Маршрут в числах', 'closest', geography);
  register(['space-discoveries','science-space'], 'Космический расчёт', 'closest', space);
  register(['science-atom'], 'Физика в числах', 'closest', physics);
  register(['visual-logic','logic-numbers'], 'Числовая логика', 'closest', logic);
  // Reserve these facts for the finale instead of asking the same relationship twice.
  finales['queen-story'].excludeTexts = [
    'Как называется альбом Queen с песней «Bohemian Rhapsody»?',
    'Как называется знаменитая самодельная гитара Брайана Мэя?'
  ];
  finales['soviet-cinema'].excludeTexts = ['Какое устройство построил инженер Шурик Тимофеев в фильме «Иван Васильевич меняет профессию»?'];

  function plan(quiz, pool) {
    if (quiz.multiRound) return extendFinal(window.QUIZ_SLENG.rounds,extra.slang);
    if (quiz.multiQuiz) return extendFinal(quiz.multiQuiz.rounds,
      quiz.multiQuiz===window.QUIZ_AUDIO?window.QUIZ_LICENSED_AUDIO:
      quiz.multiQuiz===window.QUIZ_MEDIA_PREVIEW?window.QUIZ_LICENSED_VIDEO:extra.facts);
    if (quiz.id === 'closest-numbers') return [
      {title:'Время и счёт',type:'closest',questions:pool.slice(0,4)},
      {title:'Размеры и формы',type:'closest',questions:pool.slice(4,7)},
      {title:'Числовые задачи',type:'closest',questionLimit:3,questions:[...pool.slice(7),...extra.logic]}
    ];
    const finale = finales[quiz.id];
    if (!finale) return [];
    const unique = [...new Map(pool.filter(q=>!(finale.excludeTexts||[]).includes(q.text)).map(q => [q.text,q])).values()];
    const split = Math.ceil(Math.min(20,unique.length)/2);
    return [
      {title:'Разминка',type:'choice',questions:unique.slice(0,split)},
      {title:'Проверка знаний',type:'choice',allowWager:true,questions:unique.slice(split,20)},
      {...finale,questionLimit:4}
    ];
  }
  function extendFinal(rounds,questions){return rounds.map((r,i)=>i===2?{...r,questionLimit:Math.min(10,r.questions.length),questions:[...r.questions,...questions]}:r);}
  function counts(rounds) {return rounds.map(r => Math.min(r.questionLimit||10,r.questions.length));}
  const previousFinals=new Map();
  function select(rounds,key,random=Math.random){
    return rounds.map((r,i)=>{
      const count=counts([r])[0];
      if(i!==2)return r.questions.slice(0,count);
      const pool=r.questions.slice();
      for(let j=pool.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[pool[j],pool[k]]=[pool[k],pool[j]];}
      const picked=pool.slice(0,count),previous=previousFinals.get(key);
      const id=q=>q.id||q.text;
      // A replay must change the set, even when the random draw repeats it.
      if(previous&&pool.length>count&&picked.every(q=>previous.has(id(q)))){
        const replacement=pool.slice(count).find(q=>!previous.has(id(q)));
        if(replacement)picked[picked.length-1]=replacement;
      }
      previousFinals.set(key,new Set(picked.map(id)));
      return picked;
    });
  }
  function label(rounds) {
    const sizes=counts(rounds);
    return '3 раунда · '+sizes.join(' / ')+(sizes.every(n=>n===10)?' вопросов':' · пилот');
  }
  window.QuizRoundPlans=Object.freeze({plan,counts,label,finales,select});
})();
