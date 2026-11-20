(() => {
  'use strict';
  const choice = (id, text, correctAnswer, answers, explanation, source) => ({
    id, text, type: 'choice', answers, correct: answers.indexOf(correctAnswer), explanation, source,
  });
  const free = (id, text, correctAnswer, acceptableAnswers, explanation, source) => ({
    id, text, type: 'free-text', correctAnswer, acceptableAnswers, explanation, source,
  });
  const truth = (id, text, isTrue, explanation, source) => ({
    id, text, type: 'true-false', answers: ['Правда', 'Вымысел'], correct: isTrue ? 0 : 1,
    explanation, source,
  });

  window.QUIZ_FACTS = Object.freeze({
    category: 'Эрудиция', topic: 'Расшифруй аббревиатуру', title: 'Аббревиатуры без подсказки',
    description: 'Контекст, свободный ответ и раунд «Правда или вымысел»', cover: 'logic-numbers',
    rounds: [
      { title: 'Расшифруй в контексте', type: 'choice', questions: [
        choice('abbr-mgu', 'Как полностью называется МГУ, основанный в 1755 году?', 'Московский государственный университет имени М. В. Ломоносова', [
          'Московский государственный университет имени М. В. Ломоносова', 'Московское городское управление',
          'Международный гуманитарный университет', 'Московский государственный университет имени А. С. Пушкина',
        ], 'Официальное название — Московский государственный университет имени М. В. Ломоносова; он основан в 1755 году.', 'https://openday.msu.ru/ru/history'),
        choice('abbr-vdnh', 'Как расшифровывается название выставки ВДНХ?', 'Выставка достижений народного хозяйства', [
          'Выставка достижений народного хозяйства', 'Всероссийский дом народных художеств',
          'Выставка детского научного творчества', 'Ведомство дорожного и народного хозяйства',
        ], 'Сегодня это Выставка достижений народного хозяйства. При открытии в 1939 году она называлась ВСХВ.', 'https://vdnh.ru/visitors/about/'),
        choice('abbr-un', 'В названии международной организации ООН означает…', 'Организация Объединённых Наций', [
          'Организация Объединённых Наций', 'Общество открытых научных наблюдений',
          'Объединение отечественных новаторов', 'Организация общественных наставников',
        ], 'ООН — русское название международной организации United Nations.', 'https://www.un.org/ru/observances/russian-language-day/resources'),
        choice('abbr-ras', 'Как называется академия, сокращённо именуемая РАН?', 'Российская академия наук', [
          'Российская академия наук', 'Региональная ассоциация научных журналов',
          'Республиканская академия новейших технологий', 'Российское агентство нанотехнологий',
        ], 'РАН — Российская академия наук.', 'https://new.ras.ru/'),
        choice('abbr-mchs', 'В сообщении о спасателях и чрезвычайной ситуации МЧС — это…', 'Министерство по делам гражданской обороны, чрезвычайным ситуациям и ликвидации последствий стихийных бедствий', [
          'Министерство по делам гражданской обороны, чрезвычайным ситуациям и ликвидации последствий стихийных бедствий',
          'Международный центр гуманитарного сотрудничества', 'Министерство чрезвычайной связи',
          'Московская часть спасательной службы',
        ], 'Полное официальное название федерального ведомства — Министерство по делам гражданской обороны, чрезвычайным ситуациям и ликвидации последствий стихийных бедствий.', 'https://nac.gov.ru/list/contacts'),
        choice('abbr-usb','Что означает USB в стандарте подключения устройств?','Universal Serial Bus',['Universal Serial Bus','Universal System Board','Unified Signal Bridge','User Storage Block'],'В названии USB слово Bus означает шину передачи данных.','https://www.usb.org/'),
        choice('abbr-esa','Как называется межправительственное космическое агентство ESA?','European Space Agency',['European Space Agency','Earth Science Assembly','European Satellite Association','Experimental Space Administration'],'ESA — Европейское космическое агентство.','https://www.esa.int/About_Us/ESA_in_your_country/United_Kingdom/What_is_ESA'),
        choice('abbr-fide','Как называется организация FIDE, которая присваивает звание международного гроссмейстера?','Международная шахматная федерация',['Международная шахматная федерация','Международная федерация шашек','Олимпийский комитет','Международная федерация фехтования'],'Сокращение FIDE образовано от французского названия федерации.','https://www.fide.com/'),
        choice('abbr-dna','Как расшифровывается ДНК в русском названии молекулы?','Дезоксирибонуклеиновая кислота',['Дезоксирибонуклеиновая кислота','Двойная нуклеиновая кислота','Дегидрированная никотиновая кислота','Динатриевая нуклеиновая кислота'],'ДНК хранит наследственную информацию.','https://www.genome.gov/genetics-glossary/Deoxyribonucleic-Acid'),
        choice('abbr-ioc','Как по-русски называется IOC, руководящий орган олимпийского движения?','Международный олимпийский комитет',['Международный олимпийский комитет','Международный организационный совет','Всемирный совет спорта','Международный комитет арбитров'],'IOC — International Olympic Committee.','https://www.olympics.com/ioc'),
      ]},
      { title: 'Напиши расшифровку', type: 'free-text', questions: [
        free('abbr-smi', 'В новости о печати, телевидении и новостных сайтах: что означает «СМИ»?', 'средства массовой информации', ['СМИ — средства массовой информации', 'средства массовой информации'], 'Так расшифровывается сокращение в названии закона РФ «О средствах массовой информации».', 'https://www.consultant.ru/document/cons_doc_LAW_1511/'),
        free('abbr-ufo', 'Как расшифровывается «НЛО» в сообщении о неопознанном объекте в небе?', 'неопознанный летающий объект', ['НЛО — неопознанный летающий объект', 'неопознанный летающий объект'], 'НЛО — сокращение от «неопознанный летающий объект».', 'https://gramota.ru/storage/public/normdicts/orfograficheskij_slovar.pdf'),
        free('abbr-hydro', 'В заметке о выработке электричества энергией воды: что означает «ГЭС»?', 'гидроэлектростанция', ['ГЭС — гидроэлектростанция', 'гидроэлектростанция'], 'РусГидро использует ГЭС как сокращение от «гидроэлектростанция».', 'https://ar2017.rushydro.ru/ru/glossary'),
        free('abbr-zags', 'Куда обращаются, чтобы зарегистрировать рождение или заключение брака? Расшифруй «ЗАГС».', 'запись актов гражданского состояния', ['ЗАГС — запись актов гражданского состояния', 'запись актов гражданского состояния', 'записи актов гражданского состояния'], 'Словарная статья Института русского языка имени А. С. Пушкина связывает аббревиатуру с записью актов гражданского состояния.', 'https://ls.pushkininstitute.ru/lsslovar/?title=%D0%97%D0%90%D0%93%D0%A1%2FC1-C2'),
        free('abbr-mvd', 'Как расшифровывается «МВД» в названии российского министерства?', 'Министерство внутренних дел', ['МВД — Министерство внутренних дел', 'Министерство внутренних дел', 'Министерство внутренних дел Российской Федерации'], 'Национальный антитеррористический комитет указывает полное название «Министерство внутренних дел Российской Федерации».', 'https://nac.gov.ru/list/contacts'),
        free('abbr-iss','Расшифруйте МКС в сообщении об орбитальной станции.','Международная космическая станция',['международная космическая станция'],'По-английски — International Space Station (ISS).','https://www.nasa.gov/international-space-station/'),
        free('abbr-pc','Что означает ПК в инструкции по установке программы на домашний компьютер?','персональный компьютер',['персональный компьютер'],'ПК — персональный компьютер.','https://www.ibm.com/history/personal-computer'),
        free('abbr-rzd','Расшифруйте РЖД в названии перевозчика.','Российские железные дороги',['российские железные дороги','оао российские железные дороги'],'Название компании — «Российские железные дороги».','https://company.rzd.ru/'),
        free('abbr-vvs','Как расшифровывается ВВС в названии рода военной авиации?','военно-воздушные силы',['военно-воздушные силы','военно воздушные силы'],'ВВС — военно-воздушные силы.','https://gramota.ru/poisk?query=ВВС&mode=slovari'),
        free('abbr-zkh','Расшифруйте ЖКХ в квитанции за коммунальные услуги.','жилищно-коммунальное хозяйство',['жилищно-коммунальное хозяйство','жилищно коммунальное хозяйство'],'ЖКХ означает жилищно-коммунальное хозяйство.','https://minstroyrf.gov.ru/trades/zhilishno-kommunalnoe-hozyajstvo/'),
      ]},
      { title: 'Правда или вымысел', type: 'true-false', questions: [
        truth('fact-nasa', 'NASA расшифровывается как National Aeronautics and Space Administration.', true, 'Официальное название агентства: National Aeronautics and Space Administration.', 'https://science.nasa.gov/learning-resources/for-kids-and-students/what-is-nasa/'),
        truth('fact-pdf', 'PDF — это Portable Data File.', false, 'PDF означает Portable Document Format.', 'https://www.adobe.com/acrobat/about-adobe-pdf.html'),
        truth('fact-html', 'HTML означает HyperText Markup Language.', true, 'W3C расшифровывает HTML как HyperText Markup Language.', 'https://www.w3.org/wiki/HTML/Training/What_is_HTML'),
        truth('fact-gps', 'GPS расшифровывается как Global Positioning Service.', false, 'GPS означает Global Positioning System: последняя буква — S от System.', 'https://www.gps.gov/gps'),
        truth('fact-aids', 'AIDS расшифровывается как Acquired Immunodeficiency Syndrome.', true, 'ВОЗ использует полную форму Acquired immunodeficiency syndrome.', 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids'),
        truth('fact-wcag','WCAG означает Web Content Accessibility Guidelines.',true,'Это рекомендации по доступности веб-контента.','https://www.w3.org/TR/WCAG22/'),
        truth('fact-si','Сокращение SI для международной системы единиц образовано от французского названия.',true,'SI — Système international d’unités.','https://www.bipm.org/en/measurement-units'),
        truth('fact-emf','В названии института CERN буква N первоначально означала National.',false,'В исходном французском названии Conseil Européen pour la Recherche Nucléaire N означает Nucléaire.','https://home.cern/about/who-we-are/our-history'),
        truth('fact-unesco','Буква C в UNESCO относится к слову Cultural.',true,'Полное английское название — United Nations Educational, Scientific and Cultural Organization.','https://www.unesco.org/en'),
        truth('fact-oecd','OECD означает Organisation for Economic Coordination and Development.',false,'Буква C означает Co-operation.','https://www.oecd.org/en/about.html'),
      ]},
    ],
  });
})();
