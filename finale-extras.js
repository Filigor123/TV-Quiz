// Authored questions. Numerical tasks are self-contained; cultural clues link to the creator.
(() => {
  const c=(id,text,answers,explanation,source)=>({id,text,answers,correct:0,explanation,source});
  const n=(id,text,value,explanation)=>({id,text,correctValue:String(value),answerMode:'number',unit:'',explanation});
  const t=(id,text,truth,explanation,source)=>({id,text,answers:['Правда','Вымысел'],correct:truth?0:1,explanation,source});
  const extras={
    music:[
      c('rock-3','Ливерпульская четвёрка: Леннон, Маккартни, Харрисон и Старр. Кто это?',['The Beatles','The Doors','The Who','The Kinks'],'Это участники The Beatles.','https://www.thebeatles.com/'),
      c('rock-4','Курт Кобейн, альбом Nevermind, песня Smells Like Teen Spirit. Назовите группу.',['Nirvana','Pearl Jam','Soundgarden','Alice in Chains'],'Все подсказки относятся к Nirvana.','https://www.nirvana.com/'),
      c('rock-5','Альбом The Dark Side of the Moon и обложка с призмой. Чья это запись?',['Pink Floyd','Deep Purple','Led Zeppelin','Genesis'],'The Dark Side of the Moon — альбом Pink Floyd.','https://www.pinkfloyd.com/'),
      c('rock-6','Ангус Янг в школьной форме и альбом Back in Black. Какая группа?',['AC/DC','Kiss','Aerosmith','Scorpions'],'Ангус Янг — гитарист AC/DC.','https://www.acdc.com/')],
    queen:[
      c('queen-3','Дебютный альбом группы: Keep Yourself Alive и Liar. Как он называется?',['Queen','Queen II','Jazz','Innuendo'],'Обе песни выпущены на дебютном альбоме Queen.','https://www.queenonline.com/music'),
      c('queen-4','На альбоме Queen соседствуют We Will Rock You и We Are the Champions. Назовите альбом.',['News of the World','Jazz','The Miracle','Made in Heaven'],'Обе композиции открывают News of the World.','https://www.queenonline.com/music'),
      c('queen-5','На какой студийной пластинке Queen искать Another One Bites the Dust и Crazy Little Thing Called Love?',['The Game','Jazz','The Miracle','Queen II'],'Обе песни входят в The Game.','https://store.queenonline.com/products/the-game-cd'),
      c('queen-6','Какой студийный альбом Queen завершается песней The Show Must Go On?',['Innuendo','The Game','Jazz','News of the World'],'The Show Must Go On завершает Innuendo.','https://www.youtube.com/watch?v=ShdqMj7dKr8')],
    pop:[
      c('pop-3','Дуэт французов в роботизированных шлемах, альбом Random Access Memories. Кто это?',['Daft Punk','Pet Shop Boys','Roxette','Eurythmics'],'Random Access Memories записали Daft Punk.','https://www.daftpunk.com/'),
      c('pop-4','Норвежская группа и клип Take On Me с рисованным миром. Кто это?',['a-ha','ABBA','Ace of Base','Europe'],'Take On Me — хит a-ha.','https://a-ha.com/'),
      c('pop-5','Альбом Thriller, песни Beat It и Billie Jean. Чьё имя на обложке?',['Michael Jackson','Prince','George Michael','Elton John'],'Все эти песни входят в Thriller Майкла Джексона.','https://www.michaeljackson.com/'),
      c('pop-6','Песня Poker Face и альбом The Fame. Назовите исполнительницу.',['Lady Gaga','Madonna','Adele','Shakira'],'Poker Face входит в The Fame Lady Gaga.','https://www.ladygaga.com/')],
    cinema:[
      c('film-3','Юный джедай, сын Дарта Вейдера, вырос на Татуине. Кто это?',['Люк Скайуокер','Хан Соло','Йода','Чубакка'],'Это история Люка Скайуокера.','https://www.starwars.com/databank/luke-skywalker'),
      c('film-4','Астромеханический дроид с сине-белым куполом общается писком. Назовите героя.',['R2-D2','C-3PO','Дарт Вейдер','Йода'],'R2-D2 — астромеханический дроид.','https://www.starwars.com/databank/r2-d2'),
      c('film-5','Зелёный мастер-джедай обучает Люка на Дагобе. Кто это?',['Йода','Хан Соло','Палпатин','Чубакка'],'Йода обучает Люка владению Силой.','https://www.starwars.com/databank/yoda'),
      c('film-6','Золотистый дроид-переводчик, спутник R2-D2. Назовите героя.',['C-3PO','BB-8','K-2SO','Джабба'],'C-3PO — протокольный дроид.','https://www.starwars.com/databank/c-3po')],
    soviet:[
      c('soviet-3','Семён Горбунков возвращается из круиза с контрабандой в гипсе. Назовите фильм.',['Бриллиантовая рука','Спортлото-82','Кавказская пленница','Гараж'],'Горбунков — герой «Бриллиантовой руки».','https://www.mosfilm.ru/cinema/'),
      c('soviet-4','Страховой агент Деточкин угоняет автомобили, а деньги отдаёт детям. Назовите фильм.',['Берегись автомобиля','Служебный роман','Афоня','Мимино'],'Юрий Деточкин — герой «Берегись автомобиля».','https://www.mosfilm.ru/cinema/'),
      c('soviet-5','Новосельцев работает у строгой Людмилы Прокофьевны Калугиной. Назовите фильм.',['Служебный роман','Карнавальная ночь','Девчата','Вокзал для двоих'],'Новосельцев и Калугина — герои «Служебного романа».','https://www.mosfilm.ru/cinema/'),
      c('soviet-6','Трус, Балбес и Бывалый похищают студентку Нину. В каком фильме?',['Кавказская пленница','Бриллиантовая рука','Джентльмены удачи','Спортлото-82'],'Речь о «Кавказской пленнице, или Новых приключениях Шурика».','https://www.mosfilm.ru/cinema/')],
    auto:[
      t('auto-3','В обозначении шины 205/55 R16 число 16 — посадочный диаметр в дюймах.',true,'Последнее число задаёт посадочный диаметр обода в дюймах.','https://www.michelinman.com/auto/auto-tips-and-advice/tires-101/tire-markings-explained'),
      t('auto-4','Литера R в маркировке шины означает радиус колеса.',false,'R обозначает радиальную конструкцию шины.','https://www.michelinman.com/auto/auto-tips-and-advice/tires-101/tire-markings-explained'),
      t('auto-5','Чистый аккумуляторный электромобиль требует бензина для работы тягового электромотора.',false,'Тяговый электромотор получает электрическую энергию от батареи.','https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work'),
      t('auto-6','При рекуперативном торможении электромотор может работать генератором.',true,'Энергия движения преобразуется в электрическую энергию для батареи.','https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work')],
    geography:[n('geo-3','На карте 1:50 000 между точками 6 см. Сколько это метров?',3000,'Каждый сантиметр — 500 м; 6 × 500 = 3000.'),n('geo-4','Маршрут 18 км пройден за 3 часа. Средняя скорость в км/ч?',6,'18 / 3 = 6.'),n('geo-5','Отметки высоты двух точек: 850 и 1250 м. Перепад высоты в метрах?',400,'1250 − 850 = 400.'),n('geo-6','Группа прошла 8 км на север и 6 км на восток. Каково расстояние до старта по прямой в км на плоской карте?',10,'По теореме Пифагора: √(8²+6²)=10.')],
    space:[n('space-3','Модельный спутник делает 16 оборотов за сутки. Сколько минут длится оборот?',90,'1440 / 16 = 90.'),n('space-4','В модели 1 см — 10 000 км. Какой длины в сантиметрах отрезок 250 000 км?',25,'250 000 / 10 000 = 25.'),n('space-5','На борту 4 человека. Каждому нужно 2 литра воды в день. Сколько литров на 5 дней?',40,'4 × 2 × 5 = 40.'),n('space-6','Учебная ракета расходует 3 кг топлива в секунду. Сколько кг за 20 секунд?',60,'3 × 20 = 60.')],
    physics:[n('physics-3','Сила 12 Н действует на массу 3 кг. Ускорение в м/с²?',4,'a=F/m=12/3=4.'),n('physics-4','При напряжении 12 В сопротивление 6 Ом. Сила тока в амперах?',2,'I=U/R=12/6=2.'),n('physics-5','Тело массой 2 кг занимает 500 см³. Плотность в г/см³?',4,'2000 г / 500 см³ = 4.'),n('physics-6','Звук в модели движется со скоростью 340 м/с. Расстояние за 2 секунды в метрах?',680,'340 × 2 = 680.')],
    logic:[n('logic-3','В ящике 5 красных и 5 синих носков. Сколько нужно достать вслепую, чтобы гарантировать пару одного цвета?',3,'Первые два могут быть разных цветов; третий совпадёт с одним из них.'),n('logic-4','Сколькими способами можно расставить в ряд три разные книги?',6,'3 × 2 × 1 = 6.'),n('logic-5','У куба покрасили все грани и разрезали на 27 равных кубиков. Сколько маленьких кубиков имеют ровно три окрашенные грани?',8,'Только восемь угловых кубиков.'),n('logic-6','Сколько двузначных чисел можно составить из цифр 1, 2, 3 без повторения цифр?',6,'Три варианта первой цифры, два второй: 3 × 2 = 6.')]
  };
  extras.slang=[
    c('context-extra-1','«Удалил пост, но он уже завирусился». Что произошло с постом?',['Его быстро распространяют','Он заражает компьютер','Он стал платным','Он исчез у всех'],'«Завирусился» здесь означает быстрое распространение.','Авторский контекст'),
    c('context-extra-2','«Не спойлери, я ещё не смотрел финал!» О чём просят?',['Не раскрывать сюжет заранее','Не выключать звук','Не переводить субтитры','Не советовать сериал'],'Спойлер раскрывает события сюжета до просмотра.','Авторский контекст')];
  extras.facts=[t('fact-css','CSS означает Cascading Style Sheets.',true,'Это каскадные таблицы стилей.','https://www.w3.org/Style/CSS/'),t('fact-svg','SVG означает Scalable Video Graphics.',false,'SVG — Scalable Vector Graphics.','https://www.w3.org/Graphics/SVG/')];
  window.QUIZ_FINALE_EXTRAS=extras;
})();
